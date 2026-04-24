import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_REVIEW_REPLY_KEYWORD_MAX_OUTPUT_TOKENS,
  GEMINI_REVIEW_REPLY_MODEL,
  GEMINI_REVIEW_REPLY_THINKING_CONFIG,
  getGeminiApiKeyFromEnv,
} from "@/lib/config/gemini-review-reply";
import { extractGeminiReplyVisibleText } from "@/lib/utils/ai/extract-gemini-reply-visible-text";
import {
  buildReviewKeywordExtractionSystemPrompt,
  buildReviewKeywordExtractionUserPrompt,
} from "@/lib/prompts/review-keyword-extraction-prompts";
import {
  REVIEW_KEYWORD_ALLOWED_SET,
  REVIEW_KEYWORD_CANONICAL_COERCE,
  REVIEW_KEYWORD_CANONICAL_TO_CATEGORY,
} from "@/lib/reviews/review-keyword-design";

const DEFAULT_BATCH = 10;

const geminiItemSchema = z.object({
  review_id: z.string().uuid(),
  keywords: z.array(
    z.object({
      canonicalKeyword: z.string().min(1).max(50),
      category: z.enum([
        "taste",
        "quantity_price",
        "packaging_delivery",
        "revisit_recommend",
        "context",
      ]),
      sentiment: z.enum(["positive", "negative"]),
      alias: z.string().min(1).max(200),
    }),
  ),
});

const geminiResponseSchema = z.array(geminiItemSchema);

export type ReviewKeywordExtractionBatchResult = {
  /** 이번 배치에 포함된 리뷰 수(본문 있음) */
  candidateCount: number;
  /** DB에 upsert 시도한 행 수 */
  rowsUpserted: number;
  /** Gemini 미설정 등 */
  skippedReason?: "missing_gemini_api_key" | "no_candidates" | "gemini_empty";
  /** 파싱 실패 시(다음 실행에서 재시도) */
  parseError?: string;
};

function stripJsonFences(text: string): string {
  return text
    .trim()
    .replace(/^```[a-zA-Z]*\s*/m, "")
    .replace(/\s*```$/m, "")
    .trim();
}

const FETCH_PAGE = 200;
/** 한 배치 후보를 채우기 위해 스캔하는 최대 행 수 (공백 본문만 연속일 때 조기 종료 방지) */
const FETCH_SCAN_CAP = 10_000;

/**
 * 본문이 있고 `keyword_extracted_at` 이 NULL인 리뷰만 가져온다.
 * PostgREST는 `trim(content)` 필터가 없어서, 페이지를 넘기며 `trim` 후 본문 있는 행만 채운다.
 */
export async function fetchReviewsPendingKeywordExtraction(
  supabase: SupabaseClient,
  batchSize: number,
): Promise<{ id: string; content: string }[]> {
  const out: { id: string; content: string }[] = [];
  let from = 0;

  while (out.length < batchSize && from < FETCH_SCAN_CAP) {
    const { data, error } = await supabase
      .from("reviews")
      .select("id, content")
      .is("keyword_extracted_at", null)
      .not("content", "is", null)
      .order("written_at", { ascending: false, nullsFirst: false })
      .range(from, from + FETCH_PAGE - 1);

    if (error) throw error;
    const page = data ?? [];
    if (page.length === 0) break;

    for (const raw of page) {
      const row = raw as { id: string; content: string | null };
      const t = (row.content ?? "").trim();
      if (t.length === 0) continue;
      out.push({ id: row.id, content: t });
      if (out.length >= batchSize) break;
    }

    if (page.length < FETCH_PAGE) break;
    from += FETCH_PAGE;
  }

  return out;
}

/**
 * 한 배치: Gemini → `review_keywords` upsert → 해당 리뷰 `keyword_extracted_at` 갱신.
 * 실패 시 `keyword_extracted_at` 은 건드리지 않아 재시도 가능.
 */
export async function runReviewKeywordExtractionBatch(
  supabase: SupabaseClient,
  options?: { batchSize?: number },
): Promise<ReviewKeywordExtractionBatchResult> {
  const batchSize = options?.batchSize ?? DEFAULT_BATCH;
  const apiKey = getGeminiApiKeyFromEnv();
  if (!apiKey) {
    return {
      candidateCount: 0,
      rowsUpserted: 0,
      skippedReason: "missing_gemini_api_key",
    };
  }

  const candidates = await fetchReviewsPendingKeywordExtraction(
    supabase,
    batchSize,
  );
  if (candidates.length === 0) {
    return { candidateCount: 0, rowsUpserted: 0, skippedReason: "no_candidates" };
  }

  const ids = new Set(candidates.map((c) => c.id));
  const system = buildReviewKeywordExtractionSystemPrompt();
  const user = buildReviewKeywordExtractionUserPrompt(candidates);

  let rawText: string;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: GEMINI_REVIEW_REPLY_MODEL,
      contents: user,
      config: {
        systemInstruction: system,
        maxOutputTokens: GEMINI_REVIEW_REPLY_KEYWORD_MAX_OUTPUT_TOKENS,
        thinkingConfig: { ...GEMINI_REVIEW_REPLY_THINKING_CONFIG },
      },
    });
    rawText = extractGeminiReplyVisibleText(response).combined;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      candidateCount: candidates.length,
      rowsUpserted: 0,
      parseError: msg,
    };
  }

  if (!rawText) {
    return {
      candidateCount: candidates.length,
      rowsUpserted: 0,
      skippedReason: "gemini_empty",
    };
  }

  let parsed: z.infer<typeof geminiResponseSchema>;
  try {
    const json = JSON.parse(stripJsonFences(rawText));
    parsed = geminiResponseSchema.parse(json);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      candidateCount: candidates.length,
      rowsUpserted: 0,
      parseError: msg,
    };
  }

  const keywordRows: { review_id: string; keyword: string; sentiment: string }[] =
    [];
  const aliasRows: {
    sentiment: "positive" | "negative";
    canonical_keyword: string;
    alias: string;
  }[] = [];

  for (const item of parsed) {
    if (!ids.has(item.review_id)) continue;
    const seen = new Set<string>();
    for (const k of item.keywords) {
      const sent = k.sentiment;
      let canonical = k.canonicalKeyword.trim();
      if (!canonical) continue;

      // 1) 흔한 변형 강제 치환 (설계서 canonical로)
      canonical = REVIEW_KEYWORD_CANONICAL_COERCE[sent]?.[canonical] ?? canonical;

      // 2) 설계서 허용 canonical만 통과
      if (!REVIEW_KEYWORD_ALLOWED_SET.has(`${sent}::${canonical}`)) {
        // alias(본문 표현) 자체가 설계서 canonical로 이미 치환 가능한 경우도 한번 더 시도
        const aliasNorm = (k.alias ?? "").trim();
        const aliasCoerced =
          aliasNorm && REVIEW_KEYWORD_CANONICAL_COERCE[sent]?.[aliasNorm]
            ? REVIEW_KEYWORD_CANONICAL_COERCE[sent]?.[aliasNorm]
            : null;
        if (aliasCoerced && REVIEW_KEYWORD_ALLOWED_SET.has(`${sent}::${aliasCoerced}`)) {
          canonical = aliasCoerced;
        } else {
          continue;
        }
      }

      const key = `${sent}::${canonical.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      keywordRows.push({
        review_id: item.review_id,
        keyword: canonical,
        sentiment: sent,
      });

      const alias = (k.alias ?? "").trim();
      if (alias) {
        aliasRows.push({
          sentiment: sent,
          canonical_keyword: canonical,
          alias,
        });
      }
    }
  }

  // NOTE:
  // - dictionary는 설계서 canonical 세트가 source of truth라서
  //   Gemini 결과로 dictionary를 확장(upsert)하지 않는다. (드리프트 방지)

  // 2) alias upsert (원문 표현 → canonical)
  if (aliasRows.length > 0) {
    const uniqueCanon = [
      ...new Set(aliasRows.map((r) => `${r.sentiment}::${r.canonical_keyword}`)),
    ].map((k) => {
      const [sentiment, canonical_keyword] = k.split("::");
      return { sentiment, canonical_keyword };
    });

    const { data: dictIds, error: dictIdErr } = await supabase
      .from("review_keyword_dictionary")
      .select("id, sentiment, canonical_keyword")
      .in("canonical_keyword", [...new Set(uniqueCanon.map((x) => x.canonical_keyword))]);
    if (dictIdErr) throw dictIdErr;

    const idMap = new Map<string, string>();
    for (const raw of dictIds ?? []) {
      const r = raw as { id: string; sentiment: string; canonical_keyword: string };
      if (!r.id) continue;
      idMap.set(`${r.sentiment}::${r.canonical_keyword}`, r.id);
    }

    const aliasUpserts: { dictionary_id: string; alias: string }[] = [];
    const seenAlias = new Set<string>();
    for (const r of aliasRows) {
      const a = r.alias.trim();
      if (!a) continue;
      const dictId = idMap.get(`${r.sentiment}::${r.canonical_keyword}`);
      if (!dictId) continue;
      const key = a.toLowerCase();
      if (seenAlias.has(key)) continue;
      seenAlias.add(key);
      aliasUpserts.push({ dictionary_id: dictId, alias: a });
    }

    if (aliasUpserts.length > 0) {
      const { error: aliasErr } = await supabase
        .from("review_keyword_dictionary_aliases")
        .upsert(aliasUpserts, { onConflict: "alias" });
      if (aliasErr) throw aliasErr;
    }
  }

  // 3) review_keywords upsert (canonical만 저장)
  if (keywordRows.length > 0) {
    const { error: upErr } = await supabase.from("review_keywords").upsert(
      keywordRows.map((r) => ({
        review_id: r.review_id,
        keyword: r.keyword,
        sentiment: r.sentiment,
      })),
      { onConflict: "review_id,keyword" },
    );
    if (upErr) throw upErr;
  }

  const now = new Date().toISOString();
  const { error: markErr } = await supabase
    .from("reviews")
    .update({ keyword_extracted_at: now })
    .in(
      "id",
      candidates.map((c) => c.id),
    );
  if (markErr) throw markErr;

  return {
    candidateCount: candidates.length,
    rowsUpserted: keywordRows.length,
  };
}
