/**
 * 워커 `ddangyo_orders_sync`: 브라우저 로그인 후 주문 목록 전량 수집 → DB upsert + 대시보드 집계.
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { kstClosedRangeFromDdangyoSettleCompact } from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { persistDdangyoOrdersSnapshot } from "@/lib/dashboard/persist-ddangyo-orders";
import { fetchDdangyoOrderListAllPagesWithPlaywright } from "@/lib/services/ddangyo/ddangyo-orders-browser-fetch";
import { getStoredCredentials } from "@/lib/services/platform-session-service";
import { getDdangyoOrdersInitialDaysBack } from "@/lib/config/platform-orders-sync";
import { isWorkerOrdersSyncVerbose } from "@/lib/config/worker-orders-sync-verbose";
import { addCalendarDaysKst, formatKstYmd } from "@/lib/utils/kst-date";

export type DdangyoOrdersSyncWindow = "initial" | "previous_kst_day";

/**
 * `previous_kst_day`: 어제 하루만 — 브라우저 fetch는 `daysBack=1` 구간으로 호출.
 */
export async function runDdangyoOrdersSyncJob(args: {
  storeId: string;
  userId: string;
  ordersWindow: DdangyoOrdersSyncWindow;
}): Promise<{
  ok: true;
  ordersWindow: DdangyoOrdersSyncWindow;
  settle_range: { setl_dt_st: string; setl_dt_ed: string };
  total_rows: number;
  pages: number;
  platform_orders_upserted: number;
  platform_orders_skipped: number;
  dashboardByShop: {
    platformShopExternalId: string;
    dailyRows: number;
    menuRows: number;
    dailyError?: string;
    menuError?: string;
  }[];
  warnings: string[];
}> {
  const { storeId, ordersWindow } = args;

  console.log("[ddangyo_orders_sync] start", { storeId, ordersWindow });

  const creds = await getStoredCredentials(storeId, "ddangyo");
  const idEnv = process.env.DDANGYO_FETCH_ID?.trim();
  const pwEnv = process.env.DDANGYO_FETCH_PW?.trim();
  const username = creds?.username ?? idEnv;
  const password = creds?.password ?? pwEnv;
  if (!username || !password) {
    throw new Error(
      "땡겨요 로그인 정보가 없습니다. 연동 또는 DDANGYO_FETCH_ID/PW 를 설정해 주세요.",
    );
  }

  const todayKst = formatKstYmd(new Date());
  const yesterdayYmd = addCalendarDaysKst(todayKst, -1);
  const yesterdayCompact = yesterdayYmd.replace(/-/g, "");

  const verbose = isWorkerOrdersSyncVerbose();
  const log = verbose
    ? (msg: string, extra?: unknown) =>
        extra !== undefined ? console.log(msg, extra) : console.log(msg)
    : () => {};

  const fetched = await fetchDdangyoOrderListAllPagesWithPlaywright(
    ordersWindow === "previous_kst_day"
      ? {
          username,
          password,
          settleRange: {
            setl_dt_st: yesterdayCompact,
            setl_dt_ed: yesterdayCompact,
          },
          log,
        }
      : {
          username,
          password,
          daysBack: getDdangyoOrdersInitialDaysBack(),
          log,
        },
  );

  console.log("[ddangyo_orders_sync] settlement counts", {
    storeId,
    settlements: fetched.settlements.length,
    settlementDetails: fetched.settlementDetails.length,
  });

  const supabase = createServiceRoleClient();
  const dashboardReplaceKstRangeFallback = kstClosedRangeFromDdangyoSettleCompact(
    fetched.settle_range,
  );

  const snap = await persistDdangyoOrdersSnapshot({
    supabase,
    storeId,
    rows: fetched.rows,
    settlements: fetched.settlements,
    settlementDetails: fetched.settlementDetails,
    dashboardReplaceKstRangeFallback,
  });

  return {
    ok: true,
    ordersWindow,
    settle_range: fetched.settle_range,
    total_rows: fetched.rows.length,
    pages: fetched.pages,
    platform_orders_upserted: snap.platformOrdersUpserted,
    platform_orders_skipped: snap.platformOrdersSkipped,
    dashboardByShop: snap.dashboardByShop,
    warnings: snap.warnings,
  };
}
