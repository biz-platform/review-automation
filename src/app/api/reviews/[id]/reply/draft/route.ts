import { NextRequest, NextResponse } from "next/server";
import { ReplyDraftService } from "@/lib/services/reply-draft-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { generateDraftContent } from "@/lib/services/ai-draft-service";

const replyDraftService = new ReplyDraftService();

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user } = await getUser(request);
  const draftContent = await generateDraftContent(reviewId, user.id);
  const result = await replyDraftService.createDraft(reviewId, draftContent, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result }, { status: 201 });
}

export const POST = withRouteHandler(postHandler);
