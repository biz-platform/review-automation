import type { BrowserJobType } from "./browser-job-service";

const SYNC_TYPES: readonly string[] = [
  "baemin_sync",
  "yogiyo_sync",
  "ddangyo_sync",
  "coupang_eats_sync",
];

const LINK_TYPES: readonly string[] = [
  "baemin_link",
  "yogiyo_link",
  "ddangyo_link",
  "coupang_eats_link",
];

const REPLY_TYPES: readonly string[] = [
  "baemin_register_reply",
  "baemin_modify_reply",
  "baemin_delete_reply",
  "yogiyo_register_reply",
  "yogiyo_modify_reply",
  "yogiyo_delete_reply",
  "ddangyo_register_reply",
  "ddangyo_modify_reply",
  "ddangyo_delete_reply",
  "coupang_eats_register_reply",
  "coupang_eats_modify_reply",
  "coupang_eats_delete_reply",
];

export type PersistedBrowserJobOutcome = {
  result: Record<string, unknown> | null;
  result_summary: Record<string, unknown>;
};

/** 조회·로그용: 구버전 full result 우선, 없으면 result_summary */
export function effectiveBrowserJobResult(job: {
  result: unknown;
  result_summary?: unknown;
}): unknown {
  const r = job.result;
  if (r != null && typeof r === "object" && !Array.isArray(r)) {
    return r;
  }
  const s = job.result_summary;
  if (s != null && typeof s === "object" && !Array.isArray(s)) {
    return s;
  }
  return null;
}

function countReviewsInMerged(merged: Record<string, unknown>): number {
  const raw = merged.reviews ?? merged.list ?? merged.data;
  if (Array.isArray(raw)) return raw.length;
  if (raw && typeof raw === "object" && Array.isArray((raw as { reviews?: unknown[] }).reviews)) {
    return (raw as { reviews: unknown[] }).reviews.length;
  }
  const list = merged.list;
  if (list && typeof list === "object" && !Array.isArray(list)) {
    const reviews = (list as { reviews?: unknown[] }).reviews;
    if (Array.isArray(reviews)) return reviews.length;
  }
  return 0;
}

function extractListNext(merged: Record<string, unknown>): boolean | undefined {
  const list = merged.list;
  if (list && typeof list === "object" && !Array.isArray(list)) {
    const n = (list as { next?: unknown }).next;
    if (typeof n === "boolean") return n;
  }
  return undefined;
}

function extractReviewCountFromApi(merged: Record<string, unknown>): number | undefined {
  const countBody = merged.count;
  if (typeof countBody === "number" && Number.isInteger(countBody) && countBody >= 0) {
    return countBody;
  }
  if (countBody && typeof countBody === "object") {
    const rc = (countBody as { reviewCount?: unknown }).reviewCount;
    if (typeof rc === "number" && Number.isInteger(rc) && rc >= 0) return rc;
  }
  return undefined;
}

function pickScalarMeta(merged: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (!(k in merged)) continue;
    const v = merged[k];
    if (v == null) continue;
    const t = typeof v;
    if (t === "string" || t === "number" || t === "boolean") {
      out[k] = v;
    }
  }
  return out;
}

/**
 * applyBrowserJobResult에 넘긴 full mergedResult 기준으로 DB 저장분을 나눔.
 * sync/link: result=null (리뷰 배열·쿠키 등 대용량 제외), result_summary만 경량 유지.
 */
export function buildPersistedBrowserJobOutcome(
  jobType: BrowserJobType | string,
  merged: Record<string, unknown>,
): PersistedBrowserJobOutcome {
  const baseSummary: Record<string, unknown> = { jobType };

  if (SYNC_TYPES.includes(jobType)) {
    const reviewCount = countReviewsInMerged(merged);
    const reviewCountFromApi = extractReviewCountFromApi(merged);
    const syncLogStats = merged.sync_log_stats;
    const summary: Record<string, unknown> = {
      ...baseSummary,
      reviewCount,
      reviewCountFromApi,
      shop_category: merged.shop_category ?? undefined,
      store_name: merged.store_name ?? undefined,
      listNext: extractListNext(merged),
    };
    if (
      syncLogStats != null &&
      typeof syncLogStats === "object" &&
      !Array.isArray(syncLogStats)
    ) {
      summary.sync_log_stats = syncLogStats;
    }
    return {
      result: null,
      result_summary: summary,
    };
  }

  if (LINK_TYPES.includes(jobType)) {
    return {
      result: null,
      result_summary: {
        ...baseSummary,
        external_shop_id: merged.external_shop_id ?? merged.baeminShopId ?? undefined,
        shop_category: merged.shop_category ?? undefined,
        store_name: merged.store_name ?? undefined,
        business_registration_number: merged.business_registration_number ?? undefined,
        shop_owner_number: merged.shop_owner_number ?? undefined,
        external_user_id: merged.external_user_id ?? undefined,
      },
    };
  }

  if (REPLY_TYPES.includes(jobType)) {
    const summary: Record<string, unknown> = {
      ...baseSummary,
      reviewId: merged.reviewId ?? merged.review_id ?? undefined,
      contentLength: typeof merged.content === "string" ? merged.content.length : undefined,
      orderReviewReplyId: merged.orderReviewReplyId ?? undefined,
    };
    if (typeof merged.count === "number" && Number.isInteger(merged.count) && merged.count >= 0) {
      summary.count = merged.count;
    }
    return {
      result: null,
      result_summary: summary,
    };
  }

  if (jobType === "internal_auto_register_draft") {
    return {
      result: null,
      result_summary: {
        ...baseSummary,
        reviewId: merged.reviewId ?? merged.review_id ?? undefined,
        external_id: merged.external_id ?? undefined,
      },
    };
  }

  return {
    result: null,
    result_summary: {
      ...baseSummary,
      ...pickScalarMeta(merged, [
        "message",
        "count",
        "reviewId",
        "review_id",
        "external_id",
        "external_shop_id",
        "orderReviewReplyId",
      ]),
    },
  };
}
