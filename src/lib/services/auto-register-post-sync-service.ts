import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  getReplyWriteDeadlineDays,
  isReplyWriteExpired,
} from "@/entities/review/lib/review-utils";
import { generateDraftContentWithServiceRole } from "@/lib/services/ai-draft-service";
import {
  createBrowserJobWithServiceRole,
  type BrowserJobType,
} from "@/lib/services/browser-job-service";
import { sendDissatisfiedReviewAlimtalkIfNeeded } from "@/lib/notifications/oliview-alimtalk";

const PLATFORM_TO_REGISTER_REPLY_TYPE: Record<
  "baemin" | "yogiyo" | "ddangyo" | "coupang_eats",
  BrowserJobType
> = {
  baemin: "baemin_register_reply",
  yogiyo: "yogiyo_register_reply",
  ddangyo: "ddangyo_register_reply",
  coupang_eats: "coupang_eats_register_reply",
};

const LOG = "[auto_register_post_sync]";

function platformLabel(platform: string): string {
  switch (platform) {
    case "baemin":
      return "배민";
    case "yogiyo":
      return "요기요";
    case "ddangyo":
      return "땡겨요";
    case "coupang_eats":
      return "쿠팡이츠";
    default:
      return platform;
  }
}

function formatKstDateTime(d: Date): string {
  return d.toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
}

export type AutoRegisterPostSyncResult = {
  draftCreatedCount: number;
  registerJobsCreated: number;
  skippedNoExternalId: number;
  skippedLowRating: number;
  eligibleReviewCount: number;
  /** 워커/로그용: 조기 종료 이유 */
  skipReason?:
    | "not_auto_mode"
    | "reviews_query_error"
    | "no_reviews_in_window";
  /** 톤 설정 값 (스킵 시 진단) */
  commentRegisterMode?: string | null;
  /** DB에서 가져온 미답변·기한 내 행 수(필터 전) */
  reviewsFetched?: number;
};

/**
 * 동기화 직후 1회 실행: 미답변·기한 내·별점 4점 이상(3점 이하 제외) 리뷰에 대해
 * 1) reply_drafts 없으면 AI 초안 생성 후 upsert
 * 2) 초안이 있는 리뷰마다 register_reply job 생성
 */
export async function runAutoRegisterPostSyncPipeline(
  storeId: string,
  platform: "baemin" | "yogiyo" | "ddangyo" | "coupang_eats",
  userId: string,
): Promise<AutoRegisterPostSyncResult> {
  const base: AutoRegisterPostSyncResult = {
    draftCreatedCount: 0,
    registerJobsCreated: 0,
    skippedNoExternalId: 0,
    skippedLowRating: 0,
    eligibleReviewCount: 0,
  };

  console.log(LOG, "파이프라인 시작", { storeId, platform, userId });

  const supabase = createServiceRoleClient();
  const { data: userRow } = await supabase
    .from("users")
    .select("phone")
    .eq("id", userId)
    .maybeSingle();
  const userPhone =
    typeof (userRow as { phone?: unknown } | null)?.phone === "string"
      ? ((userRow as { phone?: unknown } | null)?.phone as string).trim()
      : "";

  const { data: toneRow } = await supabase
    .from("tone_settings")
    .select("comment_register_mode")
    .eq("store_id", storeId)
    .maybeSingle();
  const mode = (toneRow?.comment_register_mode as string) ?? null;
  if (mode !== "auto") {
    console.warn(LOG, "즉시 종료: comment_register_mode 가 auto 가 아님", {
      storeId,
      platform,
      comment_register_mode: mode ?? "(tone_settings 없음)",
    });
    return {
      ...base,
      skipReason: "not_auto_mode",
      commentRegisterMode: mode,
    };
  }

  const replyWindowDays = getReplyWriteDeadlineDays(platform);
  const replyWriteDeadlineAgo = new Date(
    Date.now() - replyWindowDays * 24 * 60 * 60 * 1000,
  ).toISOString();

  const { data: reviews, error: reviewsError } = await supabase
    .from("reviews")
    .select(
      "id, external_id, written_at, rating, content, author_name, platform_shop_external_id",
    )
    .eq("store_id", storeId)
    .eq("platform", platform)
    .is("platform_reply_content", null)
    .is("platform_operator_reply_content", null)
    .gte("written_at", replyWriteDeadlineAgo)
    .order("written_at", { ascending: true });

  if (reviewsError) {
    console.error(LOG, "reviews 조회 실패", { storeId, platform, reviewsError });
    return { ...base, skipReason: "reviews_query_error" };
  }

  const n = reviews?.length ?? 0;
  if (n === 0) {
    console.log(LOG, "대상 없음: 미답변·작성기한 이내 리뷰 0건", {
      storeId,
      platform,
      written_at_gte: replyWriteDeadlineAgo,
      days: replyWindowDays,
    });
    return {
      ...base,
      skipReason: "no_reviews_in_window",
      reviewsFetched: 0,
    };
  }

  console.log(LOG, "미답변(기한 내) 후보", {
    storeId,
    platform,
    reviewsFetched: n,
  });

  const reviewIds = reviews.map((r) => r.id as string);
  const { data: drafts } = await supabase
    .from("reply_drafts")
    .select("review_id, approved_content, draft_content")
    .in("review_id", reviewIds);

  const contentByReviewId = new Map<string, string>();
  for (const d of drafts ?? []) {
    const rid = d.review_id as string;
    const c =
      (d.approved_content as string)?.trim() ||
      (d.draft_content as string)?.trim() ||
      "";
    if (c) contentByReviewId.set(rid, c);
  }

  const registerReplyType = PLATFORM_TO_REGISTER_REPLY_TYPE[platform];
  let draftCreatedCount = 0;
  let skippedNoExternalId = 0;
  let skippedLowRating = 0;
  let eligibleReviewCount = 0;
  let needDraftIndex = 0;
  const needDraftTotal = reviews.filter((r) => {
    if (!(r.external_id as string)?.trim()) return false;
    const rating = r.rating != null ? Math.round(Number(r.rating)) : null;
    if (rating !== null && rating <= 3) return false;
    return !contentByReviewId.has(r.id as string);
  }).length;

  for (const r of reviews) {
    if (!(r.external_id as string)?.trim()) {
      skippedNoExternalId += 1;
      continue;
    }
    const rating = r.rating != null ? Math.round(Number(r.rating)) : null;
    if (rating !== null && rating <= 3) {
      skippedLowRating += 1;
      if (userPhone) {
        try {
          const writtenAt = r.written_at ? new Date(r.written_at as string) : null;
          await sendDissatisfiedReviewAlimtalkIfNeeded(supabase, {
            userId,
            storeId,
            reviewId: r.id as string,
            phone: userPhone,
            platformName: platformLabel(platform),
            rating: String(rating),
            content: (r.content as string | null) ?? "",
            authorNickname: (r.author_name as string | null) ?? "",
            writtenAtKst: writtenAt ? formatKstDateTime(writtenAt) : "",
          });
        } catch (e) {
          console.error(LOG, "불만족 리뷰 알림톡 실패(무시)", {
            storeId,
            platform,
            reviewId: r.id,
          });
        }
      }
      continue;
    }
    eligibleReviewCount += 1;

    const rid = r.id as string;
    if (contentByReviewId.has(rid)) continue;

    needDraftIndex += 1;
    console.log(LOG, "AI 초안 생성 중", {
      platform,
      reviewId: rid,
      progress: `${needDraftIndex}/${needDraftTotal}`,
    });
    try {
      const content = await generateDraftContentWithServiceRole(rid);
      const { error: upsertError } = await supabase.from("reply_drafts").upsert(
        {
          review_id: rid,
          draft_content: content,
          status: "pending",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "review_id" },
      );
      if (upsertError) throw upsertError;
      contentByReviewId.set(rid, content);
      draftCreatedCount += 1;
    } catch (e) {
      console.error(
        "[runAutoRegisterPostSyncPipeline] draft create failed",
        { storeId, platform, reviewId: rid },
        e,
      );
    }
  }

  let registerJobsCreated = 0;
  for (const r of reviews) {
    if (!(r.external_id as string)?.trim()) continue;
    const rating = r.rating != null ? Math.round(Number(r.rating)) : null;
    if (rating !== null && rating <= 3) continue;

    const rid = r.id as string;
    const content = contentByReviewId.get(rid);
    if (!content?.trim()) continue;

    if (isReplyWriteExpired(r.written_at as string | null, platform)) {
      continue;
    }

    try {
      const platformShopId =
        (platform === "baemin" ||
          platform === "yogiyo" ||
          platform === "ddangyo") &&
        typeof r.platform_shop_external_id === "string" &&
        r.platform_shop_external_id.trim() !== ""
          ? r.platform_shop_external_id.trim()
          : undefined;
      await createBrowserJobWithServiceRole(registerReplyType, storeId, userId, {
        reviewId: rid,
        external_id: r.external_id,
        content,
        written_at: r.written_at ?? undefined,
        trigger: "cron",
        ...(platformShopId != null
          ? { platform_shop_external_id: platformShopId }
          : {}),
      });
      registerJobsCreated += 1;
    } catch (e) {
      console.error(
        "[runAutoRegisterPostSyncPipeline] register_reply job create failed",
        { storeId, platform, reviewId: rid },
        e,
      );
    }
  }

  const out: AutoRegisterPostSyncResult = {
    draftCreatedCount,
    registerJobsCreated,
    skippedNoExternalId,
    skippedLowRating,
    eligibleReviewCount,
    reviewsFetched: n,
    commentRegisterMode: "auto",
  };
  console.log(LOG, "파이프라인 끝", { storeId, platform, ...out });
  return out;
}
