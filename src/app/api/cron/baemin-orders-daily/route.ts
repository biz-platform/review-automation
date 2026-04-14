import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { isCronRequestAuthorized } from "@/lib/config/server-env-readers";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";

/**
 * KST 매일 00:05 즈음: **어제(KST)** 배민 v4 주문만 증분 수집.
 *
 * Vercel Cron: `5 15 * * *` (UTC 15:05 = KST 00:05).
 * `CRON_SECRET` 검증.
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: sessions, error: sessError } = await supabase
    .from("store_platform_sessions")
    .select("store_id")
    .eq("platform", "baemin");

  if (sessError) {
    console.error("[cron/baemin-orders-daily] sessions", sessError);
    return NextResponse.json(
      { error: "store_platform_sessions query failed", detail: sessError.message },
      { status: 500 },
    );
  }

  const storeIds = [
    ...new Set(
      (sessions ?? [])
        .map((r) => r.store_id as string)
        .filter((id) => typeof id === "string" && id.length > 0),
    ),
  ];

  if (storeIds.length === 0) {
    return NextResponse.json({
      ok: true,
      jobsCreated: 0,
      message: "No baemin sessions",
    });
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, user_id")
    .in("id", storeIds);

  if (storesError) {
    console.error("[cron/baemin-orders-daily] stores", storesError);
    return NextResponse.json(
      { error: "stores query failed", detail: storesError.message },
      { status: 500 },
    );
  }

  const jobsCreated: string[] = [];

  for (const s of stores ?? []) {
    const storeId = s.id as string;
    const userId = s.user_id as string | null;
    if (!userId) continue;
    try {
      const id = await createBrowserJobWithServiceRole(
        "baemin_orders_sync",
        storeId,
        userId,
        {
          ordersWindow: "previous_kst_day",
          trigger: "cron_baemin_orders",
        },
      );
      jobsCreated.push(id);
    } catch (e) {
      console.error("[cron/baemin-orders-daily] create job failed", { storeId }, e);
    }
  }

  return NextResponse.json({
    ok: true,
    storeCount: storeIds.length,
    jobsCreated: jobsCreated.length,
    jobIds: jobsCreated,
  });
}
