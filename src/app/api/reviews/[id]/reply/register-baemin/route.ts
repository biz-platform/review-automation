import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppBadRequestError, AppConflictError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { ReviewService } from "@/lib/services/review-service";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { isReviewManageAnswered } from "@/entities/review/lib/review-utils";

const registerBaeminReplySchema = z.object({
  content: z.string().min(1, "등록할 댓글 내용은 필수입니다"),
});

const reviewService = new ReviewService();

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const body = await request.json();
  const dto = registerBaeminReplySchema.parse(body);

  const review = await reviewService.findById(reviewId, user.id);
  if (isReviewManageAnswered(review)) {
    throw new AppConflictError({
      ...ERROR_CODES.REPLY_MANAGE_CLOSED,
      detail: "플랫폼에 이미 답변이 있어 등록 작업을 시작할 수 없습니다.",
    });
  }
  if (review.platform !== "baemin") {
    throw new AppBadRequestError({
      code: "PLATFORM_NOT_BAEMIN",
      message: "배민 리뷰에만 사용 가능합니다.",
    });
  }
  if (!review.external_id?.trim()) {
    throw new AppBadRequestError({
      code: "NO_EXTERNAL_ID",
      message: "리뷰의 플랫폼 ID가 없습니다.",
    });
  }

  const jobId = await createBrowserJob(
    "baemin_register_reply",
    review.store_id,
    user.id,
    {
      reviewId,
      external_id: review.external_id,
      content: dto.content,
      written_at: review.written_at ?? undefined,
      ...(review.platform_shop_external_id
        ? { platform_shop_external_id: review.platform_shop_external_id }
        : {}),
    },
  );

  return NextResponse.json<AppRouteHandlerResponse<{ jobId: string }>>(
    { result: { jobId } },
    { status: 202 },
  );
}

export const POST = withRouteHandler(postHandler);
