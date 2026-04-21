import { NextRequest, NextResponse } from "next/server";
import { AppConflictError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import { ReplyDraftService } from "@/lib/services/reply-draft-service";
import { ReviewService } from "@/lib/services/review-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { generateDraftContent } from "@/lib/services/ai-draft-service";
import { updateDraftSchema, createDraftSchema } from "@/lib/types/dto/reply-dto";
import { isReviewManageAnswered } from "@/entities/review/lib/review-utils";

const replyDraftService = new ReplyDraftService();
const reviewService = new ReviewService();

async function getHandler(
  _request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user, supabase } = await getUser(_request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const result = await replyDraftService.getByReviewId(reviewId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result | null>>({ result });
}

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
      detail: "플랫폼에 답변이 있어 초안을 만들 수 없습니다.",
    });
  }
  const body = await request.json().catch(() => ({}));
  const parsed = createDraftSchema.safeParse(body);
  const initialContent = parsed.success ? parsed.data.draft_content : undefined;
  const draftContent =
    typeof initialContent === "string" && initialContent.trim()
      ? initialContent.trim()
      : await generateDraftContent(reviewId, user.id);
  const result = await replyDraftService.createDraft(reviewId, draftContent, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result }, { status: 201 });
}

async function patchHandler(
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
      detail: "플랫폼에 답변이 있어 초안을 수정할 수 없습니다.",
    });
  }
  const body = await request.json();
  const { draft_content } = updateDraftSchema.parse(body);
  const result = await replyDraftService.updateDraftContent(reviewId, draft_content, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

async function deleteHandler(
  _request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user, supabase } = await getUser(_request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const reviewRow = await reviewService.findById(reviewId, user.id);
  if (isReviewManageAnswered(reviewRow)) {
    throw new AppConflictError({
      ...ERROR_CODES.REPLY_MANAGE_CLOSED,
      detail: "플랫폼에 답변이 있어 초안을 삭제할 수 없습니다.",
    });
  }
  await replyDraftService.delete(reviewId, user.id);
  return new NextResponse(null, { status: 204 });
}

export const GET = withRouteHandler(getHandler);
export const POST = withRouteHandler(postHandler);
export const PATCH = withRouteHandler(patchHandler);
export const DELETE = withRouteHandler(deleteHandler);
