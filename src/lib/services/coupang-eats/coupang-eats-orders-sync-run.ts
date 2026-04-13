/**
 * 워커 `coupang_eats_orders_sync`: 저장 세션 쿠키로 order/condition 매장별 전량 수집 후 DB 반영.
 * Node `fetch`는 Akamai 403이 나므로 **Playwright in-page fetch + x-request-meta** 만 사용한다.
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { kstClosedRangeFromIsoDatePair } from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { persistCoupangEatsOrdersSnapshot } from "@/lib/dashboard/persist-coupang-eats-orders";
import {
  getCoupangEatsOrdersInitialDaysBack,
} from "@/lib/config/platform-orders-sync";
import { isWorkerOrdersSyncVerbose } from "@/lib/config/worker-orders-sync-verbose";
import { loginCoupangEatsAndGetCookies } from "@/lib/services/coupang-eats/coupang-eats-login-service";
import { fetchCoupangEatsOrdersAllShopsPlaywright } from "@/lib/services/coupang-eats/coupang-eats-orders-fetch-playwright";
import {
  CoupangEatsOrdersFetchError,
  coupangEatsOrderConditionMsRangeFromKstYmd,
  coupangEatsOrdersDateRangeLastDays,
} from "@/lib/services/coupang-eats/coupang-eats-orders-fetch";
import * as CoupangEatsSession from "@/lib/services/coupang-eats/coupang-eats-session-service";
import { listStorePlatformShopExternalIds } from "@/lib/services/platform-shop-service";
import { getStoredCredentials } from "@/lib/services/platform-session-service";
import { addCalendarDaysKst, formatKstYmd } from "@/lib/utils/kst-date";

export type CoupangEatsOrdersSyncWindow = "initial" | "previous_kst_day";

function previousKstDayYmd(): string {
  const todayKst = formatKstYmd(new Date());
  return addCalendarDaysKst(todayKst, -1);
}

function isAuthLikelyFailure(e: unknown): boolean {
  if (e instanceof CoupangEatsOrdersFetchError) {
    return e.status === 401 || e.status === 403;
  }
  return false;
}

async function refreshCoupangSessionFromStoredCredentials(
  storeId: string,
  userId: string,
): Promise<boolean> {
  const creds = await getStoredCredentials(storeId, "coupang_eats");
  if (!creds?.username || !creds?.password) return false;
  const login = await loginCoupangEatsAndGetCookies(creds.username, creds.password);
  await CoupangEatsSession.saveCoupangEatsSession(storeId, userId, login.cookies, {
    externalShopId: login.external_shop_id,
  });
  return true;
}

/**
 * @param ordersWindow `initial`: KST 최근 N일 (`COUPANG_EATS_ORDERS_INITIAL_DAYS_BACK`, 기본 60)
 *   `previous_kst_day`: KST **어제** 하루만
 */
export async function runCoupangEatsOrdersSyncJob(args: {
  storeId: string;
  userId: string;
  ordersWindow: CoupangEatsOrdersSyncWindow;
}): Promise<{
  ok: true;
  ordersWindow: CoupangEatsOrdersSyncWindow;
  range: { startYmd: string; endYmd: string; startDate: number; endDate: number };
  coupang_store_ids: string[];
  total_order_rows: number;
  platform_orders_upserted: number;
  platform_orders_skipped: number;
  per_shop: {
    platform_shop_external_id: string;
    rows: number;
    fetched_pages: number;
    total_elements: number;
  }[];
  warnings: string[];
  dashboardByShop: {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[];
}> {
  const { storeId, userId, ordersWindow } = args;

  console.log("[coupang_eats_orders_sync] start", { storeId, ordersWindow });

  let startYmd: string;
  let endYmd: string;
  let startDate: number;
  let endDate: number;

  if (ordersWindow === "initial") {
    const n = getCoupangEatsOrdersInitialDaysBack();
    const r = coupangEatsOrdersDateRangeLastDays(n);
    startYmd = r.startYmd;
    endYmd = r.endYmd;
    startDate = r.startDate;
    endDate = r.endDate;
  } else {
    const ymd = previousKstDayYmd();
    startYmd = ymd;
    endYmd = ymd;
    const ms = coupangEatsOrderConditionMsRangeFromKstYmd({ startYmd, endYmd });
    startDate = ms.startDate;
    endDate = ms.endDate;
  }

  const supabase = createServiceRoleClient();
  let shopIds = await listStorePlatformShopExternalIds(
    supabase,
    storeId,
    "coupang_eats",
  );
  if (shopIds.length === 0) {
    const single = await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
    if (single?.trim()) shopIds = [single.trim()];
  }
  if (shopIds.length === 0) {
    throw new Error(
      "쿠팡이츠 연동 매장 목록이 없습니다. 먼저 연동 후 동기화해 주세요.",
    );
  }

  let cookies = await CoupangEatsSession.getCoupangEatsCookies(storeId, userId);
  if (!cookies?.length) {
    await refreshCoupangSessionFromStoredCredentials(storeId, userId);
    cookies = await CoupangEatsSession.getCoupangEatsCookies(storeId, userId);
  }
  if (!cookies?.length) {
    throw new Error(
      "쿠팡이츠 세션 쿠키가 없습니다. 연동을 다시 진행하거나 계정 정보를 확인해 주세요.",
    );
  }

  const verbose = isWorkerOrdersSyncVerbose();
  if (verbose) {
    console.log("[coupang_eats_orders_sync] range", {
      startYmd,
      endYmd,
      startDate,
      endDate,
      shopIds,
    });
  }

  console.log(
    "[coupang_eats_orders_sync] order/condition → Playwright (in-page fetch, x-request-meta)",
  );

  let bundle: Awaited<ReturnType<typeof fetchCoupangEatsOrdersAllShopsPlaywright>>;
  try {
    bundle = await fetchCoupangEatsOrdersAllShopsPlaywright({
      cookies,
      shopExternalIds: shopIds,
      startDate,
      endDate,
      delayMsBetweenPages: 180,
    });
  } catch (e) {
    if (!isAuthLikelyFailure(e)) throw e;
    console.log(
      "[coupang_eats_orders_sync] order/condition 401/403 → 저장 계정으로 재로그인 후 1회 재시도",
    );
    const refreshed = await refreshCoupangSessionFromStoredCredentials(storeId, userId);
    if (!refreshed) throw e;
    cookies = await CoupangEatsSession.getCoupangEatsCookies(storeId, userId);
    if (!cookies?.length) throw e;
    bundle = await fetchCoupangEatsOrdersAllShopsPlaywright({
      cookies,
      shopExternalIds: shopIds,
      startDate,
      endDate,
      delayMsBetweenPages: 180,
    });
  }

  const { perShop, allRows } = bundle;

  if (verbose) {
    for (const row of perShop) {
      console.log("[coupang_eats_orders_sync] shop", row);
    }
  }

  const dashboardReplaceKstRangeFallback = kstClosedRangeFromIsoDatePair(
    startYmd,
    endYmd,
  );

  const snap = await persistCoupangEatsOrdersSnapshot({
    supabase,
    storeId,
    orders: allRows,
    dashboardReplaceKstRangeFallback,
  });

  return {
    ok: true,
    ordersWindow,
    range: { startYmd, endYmd, startDate, endDate },
    coupang_store_ids: shopIds,
    total_order_rows: allRows.length,
    platform_orders_upserted: snap.platformOrdersUpserted,
    platform_orders_skipped: snap.platformOrdersSkipped,
    per_shop: perShop,
    warnings: snap.warnings,
    dashboardByShop: snap.dashboardByShop,
  };
}
