import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { createBrowserJobWithServiceRole } from "@/lib/services/browser-job-service";

/**
 * KST 매일 00:05 즈음: **어제(KST)** 요기요 주문만 증분 수집.
 *
 * Vercel Cron: `5 15 * * *` (UTC 15:05 = KST 다음날 00:05 — 서울 자정 직후).
 * `CRON_SECRET` 검증.
 */
export async function GET(request: NextRequest) {
  const secret =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    request.headers.get("x-cron-secret") ??
    "";
  const expected = process.env.CRON_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();

  const { data: sessions, error: sessError } = await supabase
    .from("store_platform_sessions")
    .select("store_id")
    .eq("platform", "yogiyo");

  if (sessError) {
    console.error("[cron/yogiyo-orders-daily] sessions", sessError);
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
      message: "No yogiyo sessions",
    });
  }

  const { data: stores, error: storesError } = await supabase
    .from("stores")
    .select("id, user_id")
    .in("id", storeIds);

  if (storesError) {
    console.error("[cron/yogiyo-orders-daily] stores", storesError);
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
        "yogiyo_orders_sync",
        storeId,
        userId,
        {
          ordersWindow: "previous_kst_day",
          trigger: "cron_yogiyo_orders",
        },
      );
      jobsCreated.push(id);
    } catch (e) {
      console.error("[cron/yogiyo-orders-daily] create job failed", { storeId }, e);
    }
  }

  return NextResponse.json({
    ok: true,
    storeCount: storeIds.length,
    jobsCreated: jobsCreated.length,
    jobIds: jobsCreated,
  });
}
