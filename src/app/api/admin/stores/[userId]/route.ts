import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError, AppNotFoundError } from "@/lib/errors/app-error";
import type {
  AdminStoreDetailData,
  AdminStorePlatform,
  AdminStoreSessionRow,
} from "@/entities/admin/types";
import { getAdminWorkStatusErrorWindowStartIso } from "@/lib/config/admin-work-status-error-window";

const PLATFORMS: AdminStorePlatform[] = [
  "baemin",
  "coupang_eats",
  "yogiyo",
  "ddangyo",
];

/** GET: 어드민 매장 상세 (해당 고객의 매장 요약 + 플랫폼별 세션 목록) */
async function getHandler(
  _request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<AdminStoreDetailData>>> {
  const { user } = await getUser(_request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_admin) {
    throw new AppForbiddenError({
      code: "ADMIN_REQUIRED",
      message: "관리자 권한이 필요합니다.",
    });
  }

  const resolved = await (context?.params ?? Promise.resolve({}));
  const userId = (resolved as { userId?: string }).userId;
  if (!userId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id, email")
    .eq("id", userId)
    .maybeSingle();

  if (!userRow) {
    throw new AppNotFoundError({
      code: "USER_NOT_FOUND",
      message: "해당 고객을 찾을 수 없습니다.",
    });
  }

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .eq("user_id", userId);
  if (!stores?.length) {
    return NextResponse.json({
      result: {
        summary: {
          userId,
          email: (userRow.email as string) ?? null,
          registerMethod: "수동",
          registeredReplyCount: 0,
          baeminCount: 0,
          coupangCount: 0,
          yogiyoCount: 0,
          ddangyoCount: 0,
          hasError: false,
          errorCount: 0,
        },
        sessions: [],
      },
    });
  }

  const storeIds = stores.map((s) => s.id as string);

  const { data: toneRow } = await supabase
    .from("tone_settings")
    .select("comment_register_mode, auto_register_scheduled_hour")
    .eq("store_id", storeIds[0])
    .maybeSingle();
  const registerMethod =
    toneRow?.comment_register_mode === "auto" && toneRow?.auto_register_scheduled_hour != null
      ? `자동 | ${toneRow.auto_register_scheduled_hour}시`
      : "수동";

  const { data: sessions } = await supabase
    .from("store_platform_sessions")
    .select("id, store_id, platform, store_name, business_registration_number")
    .in("store_id", storeIds);

  const platformCount = { baemin: 0, coupang_eats: 0, yogiyo: 0, ddangyo: 0 };
  for (const s of sessions ?? []) {
    const p = (s.platform as string)?.toLowerCase();
    if (p in platformCount) (platformCount as Record<string, number>)[p]++;
  }

  const { data: reviews } = await supabase
    .from("reviews")
    .select("store_id, platform, platform_reply_content")
    .in("store_id", storeIds);
  let registeredReplyCount = 0;
  const byStorePlatform = new Map<string, { total: number; registered: number }>();
  for (const r of reviews ?? []) {
    const key = `${r.store_id}:${r.platform}`;
    const cur = byStorePlatform.get(key) ?? { total: 0, registered: 0 };
    cur.total++;
    if (r.platform_reply_content != null) {
      cur.registered++;
      registeredReplyCount++;
    }
    byStorePlatform.set(key, cur);
  }

  const failedSince = getAdminWorkStatusErrorWindowStartIso();
  const { data: failedJobs } = await supabase
    .from("browser_jobs")
    .select("store_id")
    .eq("status", "failed")
    .gte("created_at", failedSince)
    .in("store_id", storeIds);
  const errorCountByStoreId = new Map<string, number>();
  for (const j of failedJobs ?? []) {
    const sid = j.store_id as string;
    errorCountByStoreId.set(sid, (errorCountByStoreId.get(sid) ?? 0) + 1);
  }
  const totalErrorCount = (failedJobs ?? []).length;

  const storeNameById = new Map(stores.map((s) => [s.id as string, s.name as string]));

  const sessionRows: AdminStoreSessionRow[] = (sessions ?? []).map((s) => {
    const key = `${s.store_id}:${s.platform}`;
    const counts = byStorePlatform.get(key) ?? { total: 0, registered: 0 };
    const storeId = s.store_id as string;
    const hasError = (errorCountByStoreId.get(storeId) ?? 0) > 0;
    return {
      storeId,
      platform: (s.platform as string)?.toLowerCase() as AdminStorePlatform,
      storeName: (s.store_name as string) ?? storeNameById.get(storeId) ?? null,
      businessRegistrationNumber: (s.business_registration_number as string) ?? null,
      reviewCount: counts.total,
      unregisteredCount: counts.total - counts.registered,
      registeredCount: counts.registered,
      hasError,
    };
  });

  return NextResponse.json({
    result: {
      summary: {
        userId,
        email: (userRow.email as string) ?? null,
        registerMethod,
        registeredReplyCount,
        baeminCount: platformCount.baemin,
        coupangCount: platformCount.coupang_eats,
        yogiyoCount: platformCount.yogiyo,
        ddangyoCount: platformCount.ddangyo,
        hasError: totalErrorCount > 0,
        errorCount: totalErrorCount,
      },
      sessions: sessionRows,
    },
  });
}

export const GET = withRouteHandler(getHandler);
