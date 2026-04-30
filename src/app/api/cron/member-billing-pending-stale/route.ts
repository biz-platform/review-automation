import { NextRequest, NextResponse } from "next/server";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { isCronRequestAuthorized } from "@/lib/config/server-env-readers";
import { listStaleBillingPendingDowngrades } from "@/lib/billing/stale-billing-pending-downgrades";
import { withRouteHandler } from "@/lib/utils/with-route-handler";

async function getHandler(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let now = new Date();
  if (process.env.NODE_ENV !== "production") {
    const raw = request.nextUrl.searchParams.get("now");
    if (raw) {
      const ms = Date.parse(raw);
      if (Number.isFinite(ms)) now = new Date(ms);
    }
  }

  const { totalStale, sample } = await listStaleBillingPendingDowngrades({
    now,
    sampleLimit: 50,
  });

  const result = {
    checkedAt: now.toISOString(),
    totalStale,
    sample,
  };

  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({
    result,
  });
}

export const GET = withRouteHandler(getHandler);
