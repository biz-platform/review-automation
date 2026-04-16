/**
 * 본문이 있고 아직 키워드 추출 안 된 리뷰를 배치로 Gemini 분석 후 review_keywords·keyword_extracted_at 반영.
 *
 * env: .env.local — NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, GEMINI_API_KEY(또는 GOOGLE_API_KEY)
 * run: pnpm run backfill-review-keywords
 * 옵션: --max-batches=20 --batch-size=10 --sleep-ms=1200
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
  return Number.isFinite(v) && v > 0 ? Math.floor(v) : fallback;
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url?.trim() || !key?.trim()) {
    console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
    process.exit(1);
  }

  const maxBatches = parseArgInt("--max-batches", 50);
  const batchSize = parseArgInt("--batch-size", 10);
  const sleepMs = parseArgInt("--sleep-ms", 1000);

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { runReviewKeywordExtractionBatch } = await import(
    "@/lib/services/review-keyword-extraction-service"
  );

  let totalUpsert = 0;
  for (let i = 0; i < maxBatches; i++) {
    const r = await runReviewKeywordExtractionBatch(supabase, { batchSize });
    console.log(`[batch ${i + 1}]`, r);

    if (r.skippedReason === "missing_gemini_api_key") {
      console.error("GEMINI_API_KEY / GOOGLE_API_KEY 없음.");
      process.exit(1);
    }
    if (r.skippedReason === "no_candidates") break;

    if (r.parseError) {
      console.error("파싱/호출 실패 — 중단:", r.parseError);
      process.exit(1);
    }
    if (r.skippedReason === "gemini_empty") {
      console.warn("Gemini 빈 응답 — 중단");
      process.exit(1);
    }

    totalUpsert += r.rowsUpserted;
    if (r.candidateCount === 0) break;
    if (sleepMs > 0 && i < maxBatches - 1) {
      await new Promise((res) => setTimeout(res, sleepMs));
    }
  }

  console.log("done. total keyword rows upserted (approx):", totalUpsert);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
