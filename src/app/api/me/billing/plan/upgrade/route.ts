import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type { MeBillingPlanUpgradeData } from "@/lib/api/billing-api";
import { applyMemberProToPremiumUpgrade } from "@/lib/billing/member-plan-change";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

const bodySchema = z.object({
  clientExpectedChargeWon: z.coerce.number().int(),
});

async function postHandler(request: NextRequest) {
  const { user } = await getUser(request);
  const json = await request.json().catch(() => ({}));
  const body = bodySchema.parse(json);

  const result: MeBillingPlanUpgradeData = await applyMemberProToPremiumUpgrade({
    userId: user.id,
    clientExpectedChargeWon: body.clientExpectedChargeWon,
  });

  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

export const POST = withRouteHandler(postHandler);
