import { NextRequest, NextResponse } from "next/server";
import { ReviewService } from "@/lib/services/review-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const reviewService = new ReviewService();

async function postHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const id = params.id ?? "";
  const { user } = await getUser(request);
  const result = await reviewService.collectMock(id, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result }, { status: 201 });
}

export const POST = withRouteHandler(postHandler);
