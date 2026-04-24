import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { isCronRequestAuthorized } from "@/lib/config/server-env-readers";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { defaultBillingGuideUrls, runMemberBillingAlimtalkCron } from "@/lib/notifications/oliview-alimtalk";

async function getHandler(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 로컬/개발 테스트 편의: production이 아니면 now(ISO)를 주입 가능.
  // 예: /api/cron/member-billing-alimtalk?now=2026-05-29T00:10:00%2B09:00
  let now = new Date();
  if (process.env.NODE_ENV !== "production") {
    const raw = request.nextUrl.searchParams.get("now");
    if (raw) {
      const ms = Date.parse(raw);
      if (Number.isFinite(ms)) now = new Date(ms);
    }
  }

  const supabase = createServiceRoleClient();
  const result = await runMemberBillingAlimtalkCron(
    supabase,
    now,
    defaultBillingGuideUrls(),
  );

  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({ result });
}

export const GET = withRouteHandler(getHandler);

