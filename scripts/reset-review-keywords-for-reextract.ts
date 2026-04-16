/**
 * (선택) 이미 처리된 리뷰를 재추출하기 위해 keyword_extracted_at을 NULL로 되돌린다.
 * - 기본: 최근 N일(written_at 기준)만 리셋
 * - 옵션으로 해당 리뷰들의 review_keywords도 삭제해서 "완전 재생성" 가능
 *
 * env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * run: pnpm run reset-review-keywords-for-reextract
 *
 * 옵션:
 * - --days=30 (default 30)
 * - --delete-keywords=1  # 해당 리뷰의 review_keywords 삭제
 * - --limit=0 (0이면 제한 없음)
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

function parseArgBool(name: string): boolean {
  const raw = process.argv.find((a) => a.startsWith(`${name}=`));
  if (!raw) return false;
  const v = raw.split("=")[1];
  return v === "1" || v === "true";
}

function hasArg(name: string): boolean {
  return process.argv.some((a) => a === name);
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const days = parseArgInt("--days", 30);
  const limit = parseArgInt("--limit", 0);
  const deleteKeywords =
    parseArgBool("--delete-keywords") || hasArg("--delete-keywords");
  const dryRun =
    parseArgBool("--dry-run") || hasArg("--dry-run") || hasArg("--dry-run=1");

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const page = 1000;
  let from = 0;
  const ids: string[] = [];

  for (;;) {
    let q = supabase
      .from("reviews")
      .select("id")
      .not("keyword_extracted_at", "is", null)
      .gte("written_at", since)
      .order("written_at", { ascending: false, nullsFirst: false })
      .range(from, from + page - 1);

    const { data, error } = await q;
    if (error) throw error;
    const batch = (data ?? []) as unknown as { id: string }[];
    for (const r of batch) {
      ids.push(r.id);
      if (limit > 0 && ids.length >= limit) break;
    }
    if (limit > 0 && ids.length >= limit) break;
    if (batch.length < page) break;
    from += page;
  }

  console.log({ since, candidateReviewCount: ids.length, deleteKeywords, dryRun });
  if (ids.length === 0) return;

  const CHUNK = 200;
  let deletedKeywordRows = 0;
  let resetReviews = 0;

  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);

    if (deleteKeywords) {
      // 삭제 대상 카운트(로그용)
      const { data: kwRows, error: kwCountErr } = await supabase
        .from("review_keywords")
        .select("id")
        .in("review_id", chunk);
      if (kwCountErr) throw kwCountErr;
      const count = (kwRows ?? []).length;

      if (!dryRun && count > 0) {
        const { error: delErr } = await supabase
          .from("review_keywords")
          .delete()
          .in("review_id", chunk);
        if (delErr) throw delErr;
      }
      deletedKeywordRows += count;
    }

    if (!dryRun) {
      const { error: updErr } = await supabase
        .from("reviews")
        .update({ keyword_extracted_at: null })
        .in("id", chunk);
      if (updErr) throw updErr;
    }
    resetReviews += chunk.length;
  }

  console.log({
    ok: true,
    dryRun,
    reviewsReset: resetReviews,
    reviewKeywordsDeleted: deleteKeywords ? deletedKeywordRows : 0,
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

