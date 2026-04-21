import { NextRequest, NextResponse } from "next/server";
import { AppConflictError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { ReplyDraftService } from "@/lib/services/reply-draft-service";
import { ReviewService } from "@/lib/services/review-service";
import { approveReplySchema } from "@/lib/types/dto/reply-dto";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { isReviewManageAnswered } from "@/entities/review/lib/review-utils";

const replyDraftService = new ReplyDraftService();
const reviewService = new ReviewService();

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const reviewRow = await reviewService.findById(reviewId, user.id);
  if (isReviewManageAnswered(reviewRow)) {
    throw new AppConflictError({
      ...ERROR_CODES.REPLY_MANAGE_CLOSED,
      detail: "플랫폼에 이미 답변이 있어 승인·등록을 진행할 수 없습니다.",
    });
  }
  const body = await request.json();
  const dto = approveReplySchema.parse(body);
  const result = await replyDraftService.approve(reviewId, user.id, dto.approved_content);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result }, { status: 200 });
}

export const POST = withRouteHandler(postHandler);
