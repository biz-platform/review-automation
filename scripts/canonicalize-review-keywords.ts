/**
 * review_keywords에 남아있는 raw(=alias) 키워드를 canonical로 정리한다.
 *
 * 동작:
 * - alias로 매핑되는 review_keywords를 찾아 canonical 키워드 행을 upsert
 * - alias 행(원문 표현)은 review_keywords에서 삭제
 *
 * env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * run: pnpm run canonicalize-review-keywords
 * 옵션:
 * - --alias-page-size=500 (default 500)
 * - --work-batch-size=200 (default 200)  # review_keywords in() chunk
 * - --max-alias-pages=0 (0이면 전체)
 * - --dry-run=1
 */
import { createClient } from "@supabase/supabase-js";

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

function hasArg(name: string): boolean {
  return process.argv.some((a) => a === name || a.startsWith(`${name}=`));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const aliasPageSize = parseArgInt("--alias-page-size", 500);
  const workBatchSize = parseArgInt("--work-batch-size", 200);
  const maxAliasPages = parseArgInt("--max-alias-pages", 0);
  const dryRun = hasArg("--dry-run") || process.argv.some((a) => a === "--dry-run=1");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  let totalAliasRows = 0;
  let totalCanonicalUpserts = 0;
  let totalAliasKeywordRowsDeleted = 0;

  for (let pageIdx = 0; ; pageIdx++) {
    if (maxAliasPages > 0 && pageIdx >= maxAliasPages) break;

    const from = pageIdx * aliasPageSize;
    const to = from + aliasPageSize - 1;

    const { data: aliasRows, error: aliasErr } = await supabase
      .from("review_keyword_dictionary_aliases")
      .select("alias, dictionary_id")
      .range(from, to);
    if (aliasErr) throw aliasErr;
    const aliases = (aliasRows ?? [])
      .map((r) => (r as { alias?: string }).alias ?? "")
      .map((s) => s.trim())
      .filter(Boolean);

    if (aliases.length === 0) break;
    totalAliasRows += aliases.length;

    // dictionary_id → canonical + sentiment (필요한 dictionary_id만)
    const dictIds = [...new Set((aliasRows ?? []).map((r) => (r as any).dictionary_id))].filter(Boolean);
    const { data: dictRows, error: dictErr } = await supabase
      .from("review_keyword_dictionary")
      .select("id, sentiment, canonical_keyword")
      .in("id", dictIds);
    if (dictErr) throw dictErr;
    const dictMap = new Map<string, { sentiment: "positive" | "negative"; canonical: string }>();
    for (const raw of dictRows ?? []) {
      const r = raw as { id: string; sentiment: "positive" | "negative"; canonical_keyword: string };
      dictMap.set(r.id, { sentiment: r.sentiment, canonical: r.canonical_keyword });
    }

    const aliasToCanon = new Map<string, { sentiment: "positive" | "negative"; canonical: string }>();
    for (const raw of aliasRows ?? []) {
      const r = raw as { alias: string; dictionary_id: string };
      const a = (r.alias ?? "").trim();
      if (!a) continue;
      const d = dictMap.get(r.dictionary_id);
      if (!d) continue;
      aliasToCanon.set(a, d);
    }

    // review_keywords에서 alias 키워드 행을 찾아 canonical을 upsert하고 alias 행 삭제
    for (let i = 0; i < aliases.length; i += workBatchSize) {
      const chunk = aliases.slice(i, i + workBatchSize);
      const { data: rkRows, error: rkErr } = await supabase
        .from("review_keywords")
        .select("review_id, keyword, sentiment")
        .in("keyword", chunk);
      if (rkErr) throw rkErr;

      const canonicalUpserts: Array<{ review_id: string; keyword: string; sentiment: string }> = [];
      for (const raw of rkRows ?? []) {
        const r = raw as { review_id: string; keyword: string; sentiment: "positive" | "negative" };
        const dict = aliasToCanon.get(r.keyword);
        if (!dict) continue;
        if (dict.sentiment !== r.sentiment) continue;
        canonicalUpserts.push({
          review_id: r.review_id,
          keyword: dict.canonical,
          sentiment: r.sentiment,
        });
      }

      const uniqueUpsertsMap = new Map<string, (typeof canonicalUpserts)[number]>();
      for (const r of canonicalUpserts) {
        const key = `${r.review_id}::${r.keyword}`;
        uniqueUpsertsMap.set(key, r);
      }
      const uniqueUpserts = [...uniqueUpsertsMap.values()];

      if (!dryRun && uniqueUpserts.length > 0) {
        const { error: upErr } = await supabase
          .from("review_keywords")
          .upsert(uniqueUpserts, { onConflict: "review_id,keyword" });
        if (upErr) throw upErr;
      }
      totalCanonicalUpserts += uniqueUpserts.length;

      const deleteTargetCount = (rkRows ?? []).length;
      if (!dryRun && deleteTargetCount > 0) {
        const { error: delErr } = await supabase
          .from("review_keywords")
          .delete()
          .in("keyword", chunk);
        if (delErr) throw delErr;
      }
      totalAliasKeywordRowsDeleted += deleteTargetCount;
    }

    console.log(
      `[page ${pageIdx + 1}] aliases=${aliases.length} canonicalUpsertsAttempted=${totalCanonicalUpserts} aliasKeywordRowsDeleted=${totalAliasKeywordRowsDeleted} dryRun=${dryRun}`,
    );
  }

  console.log({
    ok: true,
    dryRun,
    aliasRowsScanned: totalAliasRows,
    canonicalUpsertsAttempted: totalCanonicalUpserts,
    aliasKeywordRowsDeleted: totalAliasKeywordRowsDeleted,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

