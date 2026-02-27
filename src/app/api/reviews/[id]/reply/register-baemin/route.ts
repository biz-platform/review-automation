import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ReviewService } from "@/lib/services/review-service";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

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
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = registerBaeminReplySchema.parse(body);

  const review = await reviewService.findById(reviewId, user.id);
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
    },
  );

  return NextResponse.json<AppRouteHandlerResponse<{ jobId: string }>>(
    { result: { jobId } },
    { status: 202 },
  );
}

export const POST = withRouteHandler(postHandler);
