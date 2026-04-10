/**
 * 워커 `baemin_orders_sync`: Playwright 로그인 후 v4/orders 전량·증분 수집 → DB upsert.
 */
import type { BaeminV4OrderContentRow } from "@/lib/dashboard/baemin-dashboard-types";
import {
  persistBaeminV4OrdersSnapshot,
  type PersistBaeminV4OrdersSnapshotResult,
} from "@/lib/dashboard/persist-baemin-orders";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  fetchBaeminV4OrdersAllInPage,
  getBaeminV4OrderContextFromDb,
} from "@/lib/services/baemin/baemin-orders-fetch";
import { loginBaeminAndGetCookies } from "@/lib/services/baemin/baemin-login-service";
import { getStoredCredentials } from "@/lib/services/platform-session-service";
import { getBaeminOrdersInitialDaysBack } from "@/lib/config/platform-orders-sync";
import { isWorkerOrdersSyncVerbose } from "@/lib/config/worker-orders-sync-verbose";
import {
  addCalendarDaysKst,
  formatKstYmd,
  platformOrdersDateRangeInclusiveKst,
} from "@/lib/utils/kst-date";

export type BaeminOrdersSyncWindow = "initial" | "previous_kst_day";

function previousKstDayYmd(): string {
  const todayKst = formatKstYmd(new Date());
  return addCalendarDaysKst(todayKst, -1);
}

/**
 * @param ordersWindow `initial`: KST 최근 N일 (`BAEMIN_ORDERS_INITIAL_DAYS_BACK`, 기본 60)
 *   `previous_kst_day`: KST **어제** 하루만
 */
export async function runBaeminOrdersSyncJob(args: {
  storeId: string;
  ordersWindow: BaeminOrdersSyncWindow;
}): Promise<{
  ok: true;
  ordersWindow: BaeminOrdersSyncWindow;
  range: { startDate: string; endDate: string };
  fetchedCount: number;
  pages: number;
  totalSize: number | null;
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

  console.log("[baemin_orders_sync] start", { storeId, ordersWindow });
  if (isWorkerOrdersSyncVerbose()) {
    console.log("[baemin_orders_sync] verbose: v4/orders 요청·응답은 [baemin_orders_sync] 접두 로그로 출력");
  }

  const creds = await getStoredCredentials(storeId, "baemin");
  if (!creds) {
    throw new Error("배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.");
  }

  const ctx = await getBaeminV4OrderContextFromDb(storeId);

  let startDate: string;
  let endDate: string;
  if (ordersWindow === "initial") {
    const n = getBaeminOrdersInitialDaysBack();
    const r = platformOrdersDateRangeInclusiveKst(n);
    startDate = r.startYmd;
    endDate = r.endYmd;
  } else {
    const ymd = previousKstDayYmd();
    startDate = ymd;
    endDate = ymd;
  }

  let snap: PersistBaeminV4OrdersSnapshotResult | null = null;
  let fetchedCount = 0;
  let pages = 0;
  let totalSize: number | null = null;

  await loginBaeminAndGetCookies(creds.username, creds.password, {
    sessionHints: ctx.sessionHints,
    beforeClose: async ({ page }) => {
      const out = await fetchBaeminV4OrdersAllInPage({
        page,
        shopOwnerNumber: ctx.ordersShopOwnerNumber,
        shopNumbersParam: ctx.ordersShopNumbersParam,
        startDate,
        endDate,
        limit: 50,
        maxLimit: 50,
        logPrefix: "[baemin_orders_sync]",
      });

      fetchedCount = out.fetchedCount;
      pages = out.pages;
      totalSize = out.totalSize;

      if (!out.ok) {
        throw new Error(
          out.lastError ?? `v4/orders 실패 status=${out.lastStatus ?? "?"}`,
        );
      }

      const contents = out.contents as BaeminV4OrderContentRow[];
      const supabase = createServiceRoleClient();
      snap = await persistBaeminV4OrdersSnapshot({
        supabase,
        storeId,
        contents,
        mergeReviewIntoDashboard: true,
        dashboardReplaceKstRangeFallback: {
          startYmd: startDate,
          endYmd: endDate,
        },
      });
    },
  });

  if (snap === null) {
    throw new Error("배민 주문 스냅샷이 저장되지 않았습니다.");
  }
  const persisted: PersistBaeminV4OrdersSnapshotResult = snap;

  return {
    ok: true,
    ordersWindow,
    range: { startDate, endDate },
    fetchedCount,
    pages,
    totalSize,
    platform_orders_upserted: persisted.platformOrdersUpserted,
    platform_orders_skipped: persisted.platformOrdersSkipped,
    dashboardByShop: persisted.dashboardByShop,
    warnings: persisted.warnings,
  };
}
