import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { isCronRequestAuthorized } from "@/lib/config/server-env-readers";

/**
 * Vercel Cron 등에서 일 1회 호출. `retain_until` 경과 스냅샷 행 삭제.
 * Authorization: Bearer CRON_SECRET 또는 x-cron-secret
 */
export async function GET(request: NextRequest) {
  if (!isCronRequestAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("purge_expired_reviews_unlink_retention");

  if (error) {
    console.error("[cron/purge-unlink-retention]", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const deleted = typeof data === "number" ? data : Number(data ?? 0);
  return NextResponse.json({ ok: true, deleted });
}
