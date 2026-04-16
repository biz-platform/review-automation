import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import {
  GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS,
  GEMINI_REVIEW_REPLY_MODEL,
  GEMINI_REVIEW_REPLY_THINKING_BUDGET,
  getGeminiApiKeyFromEnv,
} from "@/lib/config/gemini-review-reply";
import {
  buildReviewKeywordExtractionSystemPrompt,
  buildReviewKeywordExtractionUserPrompt,
} from "@/lib/prompts/review-keyword-extraction-prompts";

const DEFAULT_BATCH = 10;

const geminiItemSchema = z.object({
  review_id: z.string().uuid(),
  keywords: z.array(
    z.object({
      keyword: z.string().min(1).max(50),
      sentiment: z.enum(["positive", "negative"]),
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
        maxOutputTokens: GEMINI_REVIEW_REPLY_MAX_OUTPUT_TOKENS,
        thinkingConfig: { thinkingBudget: GEMINI_REVIEW_REPLY_THINKING_BUDGET },
      },
    });
    rawText = (response.text ?? "").trim();
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

  const rows: { review_id: string; keyword: string; sentiment: string }[] =
    [];
  for (const item of parsed) {
    if (!ids.has(item.review_id)) continue;
    const seen = new Set<string>();
    for (const k of item.keywords) {
      const kw = k.keyword.trim();
      if (!kw) continue;
      const key = kw.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({
        review_id: item.review_id,
        keyword: kw,
        sentiment: k.sentiment,
      });
    }
  }

  if (rows.length > 0) {
    const { error: upErr } = await supabase.from("review_keywords").upsert(
      rows.map((r) => ({
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
    rowsUpserted: rows.length,
  };
}
