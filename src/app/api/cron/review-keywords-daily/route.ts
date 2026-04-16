import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { isCronRequestAuthorized } from "@/lib/config/server-env-readers";
import { runReviewKeywordExtractionBatch } from "@/lib/services/review-keyword-extraction-service";

function readPositiveIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

function readNonNegativeIntEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/**
 * KST 새벽: `keyword_extracted_at` 이 비어 있고 본문이 있는 리뷰만 Gemini로 키워드 추출(증분).
 * 주문 일배치와 무관하게, 미처리 큐를 비우는 용도.
 *
 * Vercel Cron: `20 16 * * *` (UTC 16:20 ≈ KST 01:20, 주문 00:05·00:10 이후).
 * `CRON_SECRET` 검증.
 *
 * Env (optional):
 * - `REVIEW_KEYWORD_CRON_MAX_BATCHES` (default 15)
 * - `REVIEW_KEYWORD_CRON_BATCH_SIZE` (default 10)
 * - `REVIEW_KEYWORD_CRON_SLEEP_MS` (default 600)
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const maxBatches = readPositiveIntEnv("REVIEW_KEYWORD_CRON_MAX_BATCHES", 15);
  const batchSize = readPositiveIntEnv("REVIEW_KEYWORD_CRON_BATCH_SIZE", 10);
  const sleepMs = readNonNegativeIntEnv("REVIEW_KEYWORD_CRON_SLEEP_MS", 600);

  const supabase = createServiceRoleClient();
  const batches: Array<{
    candidateCount: number;
    rowsUpserted: number;
    skippedReason?: string;
  }> = [];
  let totalRowsUpserted = 0;
  let stopped: "no_candidates" | "max_batches" | "missing_gemini" | "parse_error" | "gemini_empty" | "done" =
    "done";

  for (let i = 0; i < maxBatches; i++) {
    const r = await runReviewKeywordExtractionBatch(supabase, { batchSize });
    batches.push({
      candidateCount: r.candidateCount,
      rowsUpserted: r.rowsUpserted,
      skippedReason: r.skippedReason,
    });

    if (r.skippedReason === "missing_gemini_api_key") {
      stopped = "missing_gemini";
      return NextResponse.json(
        {
          ok: false,
          stopped,
          batches,
          totalRowsUpserted,
          message: "GEMINI_API_KEY / GOOGLE_API_KEY 없음",
        },
        { status: 503 },
      );
    }

    if (r.skippedReason === "no_candidates") {
      stopped = "no_candidates";
      break;
    }

    if (r.parseError) {
      stopped = "parse_error";
      console.error("[cron/review-keywords-daily] parseError", r.parseError);
      return NextResponse.json(
        {
          ok: false,
          stopped,
          batches,
          totalRowsUpserted,
          detail: r.parseError,
        },
        { status: 500 },
      );
    }

    if (r.skippedReason === "gemini_empty") {
      stopped = "gemini_empty";
      console.warn("[cron/review-keywords-daily] gemini_empty");
      return NextResponse.json(
        {
          ok: false,
          stopped,
          batches,
          totalRowsUpserted,
        },
        { status: 502 },
      );
    }

    totalRowsUpserted += r.rowsUpserted;
    if (r.candidateCount === 0) {
      stopped = "no_candidates";
      break;
    }
    if (sleepMs > 0 && i < maxBatches - 1) {
      await new Promise((res) => setTimeout(res, sleepMs));
    }
  }

  if (stopped === "done" && batches.length >= maxBatches) {
    const last = batches[batches.length - 1];
    if (last && !last.skippedReason && last.candidateCount > 0) {
      stopped = "max_batches";
    }
  }

  return NextResponse.json({
    ok: true,
    stopped,
    maxBatches,
    batchSize,
    batchesRun: batches.length,
    totalRowsUpserted,
    batches,
  });
}
