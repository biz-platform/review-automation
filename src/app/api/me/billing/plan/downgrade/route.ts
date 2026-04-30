import { NextRequest, NextResponse } from "next/server";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type { MeBillingPlanDowngradeData } from "@/lib/api/billing-api";
import { scheduleMemberPremiumToProDowngrade } from "@/lib/billing/member-plan-change";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

async function postHandler(_request: NextRequest) {
  const { user } = await getUser(_request);
  const result: MeBillingPlanDowngradeData =
    await scheduleMemberPremiumToProDowngrade({ userId: user.id });
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

export const POST = withRouteHandler(postHandler);
