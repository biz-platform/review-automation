import { NextRequest, NextResponse } from "next/server";
import { ReplyDraftService } from "@/lib/services/reply-draft-service";
import { approveReplySchema } from "@/lib/types/dto/reply-dto";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const replyDraftService = new ReplyDraftService();

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const reviewId = params.id ?? "";
  const { user } = await getUser(request);
  const body = await request.json();
  const dto = approveReplySchema.parse(body);
  const result = await replyDraftService.approve(reviewId, user.id, dto.approved_content);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result }, { status: 200 });
}

export const POST = withRouteHandler(postHandler);
