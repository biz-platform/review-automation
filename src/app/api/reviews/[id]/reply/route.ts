import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppBadRequestError, AppConflictError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { ReviewService } from "@/lib/services/review-service";
import {
  createBrowserJob,
  type BrowserJobType,
} from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { hasShopPlatformReplyContent } from "@/entities/review/lib/review-utils";

const modifyReplySchema = z.object({
  content: z.string().min(1, "수정할 댓글 내용은 필수입니다"),
  order_review_reply_id: z.union([z.number(), z.string()]).optional(),
});

const REPLY_MODIFY_JOB: Record<string, BrowserJobType> = {
  baemin: "baemin_modify_reply",
  yogiyo: "yogiyo_modify_reply",
  ddangyo: "ddangyo_modify_reply",
  coupang_eats: "coupang_eats_modify_reply",
};

const REPLY_DELETE_JOB: Record<string, BrowserJobType> = {
  baemin: "baemin_delete_reply",
  yogiyo: "yogiyo_delete_reply",
  ddangyo: "ddangyo_delete_reply",
  coupang_eats: "coupang_eats_delete_reply",
};

const reviewService = new ReviewService();

async function patchHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  let body: unknown;
  try {
    const text = await request.text();
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new AppBadRequestError({
      code: "INVALID_JSON",
      message: "요청 본문이 올바른 JSON이 아닙니다.",
    });
  }
  const dto = modifyReplySchema.parse(body);

  const review = await reviewService.findById(reviewId, user.id);
  if (!hasShopPlatformReplyContent(review)) {
    throw new AppConflictError({
      ...ERROR_CODES.REPLY_MANAGE_CLOSED,
      detail: "사장님 플랫폼 답글이 없어 수정할 수 없습니다.",
    });
  }
  const modifyJobType = REPLY_MODIFY_JOB[review.platform];
  if (!modifyJobType) {
    throw new AppBadRequestError({
      code: "PLATFORM_NOT_SUPPORTED",
      message: "이 플랫폼은 댓글 수정을 지원하지 않습니다.",
    });
  }
  if (!review.external_id?.trim()) {
    throw new AppBadRequestError({
      code: "NO_EXTERNAL_ID",
      message: "리뷰의 플랫폼 ID가 없습니다.",
    });
  }
  const orderReviewReplyId =
    dto.order_review_reply_id ?? review.platform_reply_id;
  const orderReviewReplyIdStr =
    orderReviewReplyId != null && String(orderReviewReplyId).trim() !== ""
      ? String(Number(orderReviewReplyId) || orderReviewReplyId)
      : undefined;

  const jobId = await createBrowserJob(modifyJobType, review.store_id, user.id, {
    reviewId,
    external_id: review.external_id,
    content: dto.content,
    ...(orderReviewReplyIdStr != null && { order_review_reply_id: orderReviewReplyIdStr }),
    written_at: review.written_at ?? undefined,
    ...(review.platform === "baemin" && review.author_name?.trim()
      ? { author_name: review.author_name.trim() }
      : {}),
    ...((review.platform === "baemin" ||
      review.platform === "coupang_eats" ||
      review.platform === "yogiyo" ||
      review.platform === "ddangyo") &&
    review.platform_shop_external_id?.trim()
      ? { platform_shop_external_id: review.platform_shop_external_id.trim() }
      : {}),
  });

  return NextResponse.json<AppRouteHandlerResponse<{ jobId: string }>>(
    { result: { jobId } },
    { status: 202 },
  );
}

async function deleteHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);

  const review = await reviewService.findById(reviewId, user.id);
  if (!hasShopPlatformReplyContent(review)) {
    throw new AppConflictError({
      ...ERROR_CODES.REPLY_MANAGE_CLOSED,
      detail: "사장님 플랫폼 답글이 없어 삭제할 수 없습니다.",
    });
  }
  const deleteJobType = REPLY_DELETE_JOB[review.platform];
  if (!deleteJobType) {
    throw new AppBadRequestError({
      code: "PLATFORM_NOT_SUPPORTED",
      message: "이 플랫폼은 댓글 삭제를 지원하지 않습니다.",
    });
  }
  if (!review.external_id?.trim()) {
    throw new AppBadRequestError({
      code: "NO_EXTERNAL_ID",
      message: "리뷰의 플랫폼 ID가 없습니다.",
    });
  }
  const orderReviewReplyId = review.platform_reply_id;
  const orderReviewReplyIdStr =
    orderReviewReplyId != null && String(orderReviewReplyId).trim() !== ""
      ? String(Number(orderReviewReplyId) || orderReviewReplyId)
      : undefined;

  const jobId = await createBrowserJob(deleteJobType, review.store_id, user.id, {
    reviewId,
    external_id: review.external_id,
    ...(orderReviewReplyIdStr != null && { order_review_reply_id: orderReviewReplyIdStr }),
    written_at: review.written_at ?? undefined,
    ...((review.platform === "baemin" ||
      review.platform === "coupang_eats" ||
      review.platform === "yogiyo" ||
      review.platform === "ddangyo") &&
    review.platform_shop_external_id?.trim()
      ? { platform_shop_external_id: review.platform_shop_external_id.trim() }
      : {}),
  });

  return NextResponse.json<AppRouteHandlerResponse<{ jobId: string }>>(
    { result: { jobId } },
    { status: 202 },
  );
}

export const PATCH = withRouteHandler(patchHandler);
export const DELETE = withRouteHandler(deleteHandler);
