import { NextRequest, NextResponse } from "next/server";
import { ReviewService } from "@/lib/services/review-service";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { getUser } from "@/lib/utils/auth/get-user";
import { requireMemberManageSubscriptionAccess } from "@/lib/billing/require-member-manage-subscription";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const reviewService = new ReviewService();

async function getHandler(
  request: NextRequest,
  context?: { params?: Promise<Record<string, string>> }
) {
  const params = (await (context?.params ?? Promise.resolve({}))) as Record<string, string>;
  const id = params.id ?? "";
  const { user, supabase } = await getUser(request);
  await requireMemberManageSubscriptionAccess(supabase, user.id);
  const result = await reviewService.findById(id, user.id);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

export const GET = withRouteHandler(getHandler);
