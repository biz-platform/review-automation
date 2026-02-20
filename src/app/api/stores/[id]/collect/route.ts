import { NextRequest, NextResponse } from "next/server";
import { ReviewService } from "@/lib/services/review-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { getStoreIdFromContext, withRouteHandler, type RouteContext } from "@/lib/utils/with-route-handler";

const reviewService = new ReviewService();

async function postHandler(request: NextRequest, context?: RouteContext) {
  const storeId = await getStoreIdFromContext(context);
  const { user } = await getUser(request);
  const result = await reviewService.collectMockByStore(storeId, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result }, { status: 201 });
}

export const POST = withRouteHandler(postHandler);
