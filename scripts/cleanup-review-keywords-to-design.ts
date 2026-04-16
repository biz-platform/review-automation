/**
 * 누적 데이터 전체를 "설계서 canonical 세트"로 정리한다.
 *
 * 목표:
 * - review_keywords.keyword는 review_keyword_dictionary(canonical) 안에 있는 값만 남긴다.
 * - 그 외 키워드는:
 *   1) review_keyword_dictionary_aliases로 매핑 가능하면 canonical로 치환(upsert 후 원본 삭제)
 *   2) 코드 강제치환(REVIEW_KEYWORD_CANONICAL_COERCE)으로 매핑 가능하면 canonical로 치환
 *   3) 둘 다 아니면 삭제 (설계서 밖 키워드는 대시보드에 노출하지 않음)
 *
 * env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * run: pnpm run cleanup-review-keywords-to-design
 *
 * 옵션:
 * - --dry-run=1
 * - --page-size=1000 (distinct keyword scan page, default 1000)
 * - --work-batch-size=200 (review_keywords in() chunk, default 200)
 * - --max-keywords=0 (0이면 제한 없음)
 */
import { createClient } from "@supabase/supabase-js";
import {
  REVIEW_KEYWORD_ALLOWED_SET,
  REVIEW_KEYWORD_CANONICAL_COERCE,
} from "@/lib/reviews/review-keyword-design";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  // optional
}

function parseArgInt(name: string, fallback: number): number {
  const raw = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!raw) return fallback;
  const v = Number(raw.split("=")[1]);
  return Number.isFinite(v) && v >= 0 ? Math.floor(v) : fallback;
}

function parseArgBool(name: string): boolean {
  const raw = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!raw) return false;
  const v = raw.split("=")[1];
  return v === "1" || v === "true";
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const dryRun = parseArgBool("--dry-run");
  const pageSize = parseArgInt("--page-size", 1000);
  const workBatchSize = parseArgInt("--work-batch-size", 200);
  const maxKeywords = parseArgInt("--max-keywords", 0);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  // 0) canonical set (설계서 allowed set)
  const canonicalSet = REVIEW_KEYWORD_ALLOWED_SET;

  // 1) alias → canonical 매핑 로드
  const { data: aliasRows, error: aliasErr } = await supabase
    .from("review_keyword_dictionary_aliases")
    .select("alias, dictionary_id, review_keyword_dictionary(sentiment, canonical_keyword)");
  if (aliasErr) throw aliasErr;
  const aliasMap = new Map<string, { sentiment: "positive" | "negative"; canonical: string }>();
  for (const raw of aliasRows ?? []) {
    const r = raw as {
      alias: string;
      review_keyword_dictionary?: { sentiment: "positive" | "negative"; canonical_keyword: string } | null;
    };
    const a = (r.alias ?? "").trim();
    const d = r.review_keyword_dictionary;
    if (!a || !d) continue;
    aliasMap.set(`${d.sentiment}::${a}`, { sentiment: d.sentiment, canonical: d.canonical_keyword });
  }

  // 2) distinct 키워드 스캔 (canonical 밖만)
  const targets: Array<{ sentiment: "positive" | "negative"; keyword: string }> = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from("review_keywords")
      .select("sentiment, keyword")
      .order("keyword", { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const batch = (data ?? []) as unknown as { sentiment: string; keyword: string }[];
    if (batch.length === 0) break;

    for (const r of batch) {
      const sent = r.sentiment as "positive" | "negative";
      if (sent !== "positive" && sent !== "negative") continue;
      const kw = (r.keyword ?? "").trim();
      if (!kw) continue;
      if (canonicalSet.has(`${sent}::${kw}`)) continue;
      targets.push({ sentiment: sent, keyword: kw });
      if (maxKeywords > 0 && targets.length >= maxKeywords) break;
    }
    if (maxKeywords > 0 && targets.length >= maxKeywords) break;
    if (batch.length < pageSize) break;
    from += pageSize;
  }

  // de-dupe distinct targets
  const uniqTargetMap = new Map<string, { sentiment: "positive" | "negative"; keyword: string }>();
  for (const t of targets) uniqTargetMap.set(`${t.sentiment}::${t.keyword}`, t);
  const uniqTargets = [...uniqTargetMap.values()];

  console.log({
    dryRun,
    canonicalCount: canonicalSet.size,
    aliasCount: aliasMap.size,
    distinctNonCanonicalKeywords: uniqTargets.length,
  });

  let mappedKeywordCount = 0;
  let deletedKeywordCount = 0;
  let upsertedRows = 0;
  let deletedRows = 0;

  // helper: map keyword → canonical if possible
  function resolveCanonical(sentiment: "positive" | "negative", keyword: string): string | null {
    const aliasHit = aliasMap.get(`${sentiment}::${keyword}`);
    if (aliasHit && canonicalSet.has(`${sentiment}::${aliasHit.canonical}`)) {
      return aliasHit.canonical;
    }
    const coerced = REVIEW_KEYWORD_CANONICAL_COERCE[sentiment]?.[keyword];
    if (coerced && canonicalSet.has(`${sentiment}::${coerced}`)) return coerced;
    return null;
  }

  for (const t of uniqTargets) {
    const canonical = resolveCanonical(t.sentiment, t.keyword);

    // 해당 keyword의 실제 행들을 뽑아 canonical upsert + 원본 삭제/정리
    let offset = 0;
    const page = 1000;
    for (;;) {
      const { data, error } = await supabase
        .from("review_keywords")
        .select("review_id, keyword, sentiment")
        .eq("sentiment", t.sentiment)
        .eq("keyword", t.keyword)
        .range(offset, offset + page - 1);
      if (error) throw error;
      const rows = (data ?? []) as unknown as { review_id: string; keyword: string; sentiment: string }[];
      if (rows.length === 0) break;

      if (canonical) {
        mappedKeywordCount += 1;
        const upsertsMap = new Map<string, { review_id: string; keyword: string; sentiment: string }>();
        for (const r of rows) {
          const key = `${r.review_id}::${canonical}`;
          upsertsMap.set(key, { review_id: r.review_id, keyword: canonical, sentiment: t.sentiment });
        }
        const upserts = [...upsertsMap.values()];
        upsertedRows += upserts.length;
        if (!dryRun && upserts.length > 0) {
          const { error: upErr } = await supabase
            .from("review_keywords")
            .upsert(upserts, { onConflict: "review_id,keyword" });
          if (upErr) throw upErr;
        }
      } else {
        deletedKeywordCount += 1;
      }

      deletedRows += rows.length;
      if (!dryRun) {
        const { error: delErr } = await supabase
          .from("review_keywords")
          .delete()
          .eq("sentiment", t.sentiment)
          .eq("keyword", t.keyword);
        if (delErr) throw delErr;
      }

      if (rows.length < page) break;
      offset += page;
    }
  }

  console.log({
    ok: true,
    dryRun,
    mappedKeywordCount,
    deletedKeywordCount,
    upsertedRowsAttempted: upsertedRows,
    deletedRowsAttempted: deletedRows,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

