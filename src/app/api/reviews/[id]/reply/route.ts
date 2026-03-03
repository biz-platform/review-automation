import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ReviewService } from "@/lib/services/review-service";
import {
  createBrowserJob,
  type BrowserJobType,
} from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

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
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = modifyReplySchema.parse(body);

  const review = await reviewService.findById(reviewId, user.id);
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
  const { user } = await getUser(request);

  const review = await reviewService.findById(reviewId, user.id);
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
  });

  return NextResponse.json<AppRouteHandlerResponse<{ jobId: string }>>(
    { result: { jobId } },
    { status: 202 },
  );
}

export const PATCH = withRouteHandler(patchHandler);
export const DELETE = withRouteHandler(deleteHandler);
