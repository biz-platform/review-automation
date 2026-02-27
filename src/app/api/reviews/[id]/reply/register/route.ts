import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AppBadRequestError } from "@/lib/errors/app-error";
import { ReviewService } from "@/lib/services/review-service";
import { createBrowserJob } from "@/lib/services/browser-job-service";
import type { BrowserJobType } from "@/lib/services/browser-job-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const registerReplySchema = z.object({
  content: z.string().min(1, "등록할 댓글 내용은 필수입니다"),
});

type RegisterReplyPlatform = "baemin" | "yogiyo" | "ddangyo" | "coupang_eats";

const REGISTER_REPLY_JOB_BY_PLATFORM: Record<RegisterReplyPlatform, BrowserJobType> = {
  baemin: "baemin_register_reply",
  yogiyo: "yogiyo_register_reply",
  ddangyo: "ddangyo_register_reply",
  coupang_eats: "coupang_eats_register_reply",
};

const reviewService = new ReviewService();

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> },
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = registerReplySchema.parse(body);

  const review = await reviewService.findById(reviewId, user.id);
  const jobType = REGISTER_REPLY_JOB_BY_PLATFORM[review.platform as RegisterReplyPlatform];
  if (!jobType) {
    throw new AppBadRequestError({
      code: "PLATFORM_NOT_SUPPORTED",
      message: "이 플랫폼은 사장님 댓글 등록을 지원하지 않습니다.",
    });
  }
  if (!review.external_id?.trim()) {
    throw new AppBadRequestError({
      code: "NO_EXTERNAL_ID",
      message: "리뷰의 플랫폼 ID가 없습니다.",
    });
  }

  const jobId = await createBrowserJob(jobType, review.store_id, user.id, {
    reviewId,
    external_id: review.external_id,
    content: dto.content,
    written_at: review.written_at ?? undefined,
  });

  return NextResponse.json<AppRouteHandlerResponse<{ jobId: string }>>(
    { result: { jobId } },
    { status: 202 },
  );
}

export const POST = withRouteHandler(postHandler);
