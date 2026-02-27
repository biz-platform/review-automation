import { NextRequest, NextResponse } from "next/server";
import { ReplyDraftService } from "@/lib/services/reply-draft-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { generateDraftContent } from "@/lib/services/ai-draft-service";
import { updateDraftSchema, createDraftSchema } from "@/lib/types/dto/reply-dto";

const replyDraftService = new ReplyDraftService();

async function getHandler(
  _request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user } = await getUser(_request);
  const result = await replyDraftService.getByReviewId(reviewId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result | null>>({ result });
}

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user } = await getUser(request);
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
  const { user } = await getUser(request);
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
  const { user } = await getUser(_request);
  await replyDraftService.delete(reviewId, user.id);
  return new NextResponse(null, { status: 204 });
}

export const GET = withRouteHandler(getHandler);
export const POST = withRouteHandler(postHandler);
export const PATCH = withRouteHandler(patchHandler);
export const DELETE = withRouteHandler(deleteHandler);
