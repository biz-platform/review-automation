import { NextRequest, NextResponse } from "next/server";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type { MeSubscriptionPeriodEndMutationData } from "@/lib/api/me-api";
import { setUserCancelAtPeriodEnd } from "@/lib/billing/set-user-cancel-at-period-end";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

async function postHandler(request: NextRequest) {
  const { user } = await getUser(request);
  await setUserCancelAtPeriodEnd(user.id, true);
  const result: MeSubscriptionPeriodEndMutationData = { success: true };
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({
    result,
  });
}

export const POST = withRouteHandler(postHandler);
