import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { isCronRequestAuthorized } from "@/lib/config/server-env-readers";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { runWeeklyStoreReportCron } from "@/lib/notifications/weekly-store-report-cron";

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

  const supabase = createServiceRoleClient();
  const result = await runWeeklyStoreReportCron(supabase, now);
  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

export const GET = withRouteHandler(getHandler);
