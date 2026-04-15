import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  getStorePlatformOrdersRetentionDays,
  isCronRequestAuthorized,
} from "@/lib/config/server-env-readers";

/**
 * Vercel Cron 등에서 일 1회. `order_at`이 보관 일수(기본 90일)보다 오래된 `store_platform_orders` 행을 배치 삭제.
 * Authorization: Bearer CRON_SECRET 또는 x-cron-secret
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const retentionDays = getStorePlatformOrdersRetentionDays();
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("purge_old_store_platform_orders", {
    p_retention_days: retentionDays,
    p_batch_size: 5000,
    p_max_batches: 100,
  });

  if (error) {
    console.error("[cron/purge-store-platform-orders]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = typeof data === "number" ? data : Number(data ?? 0);
  return NextResponse.json({
    ok: true,
    deleted,
    retention_days: retentionDays,
  });
}
