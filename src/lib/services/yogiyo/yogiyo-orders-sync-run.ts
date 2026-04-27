/**
 * 워커 `yogiyo_orders_sync`: Bearer로 proxy/orders 전량·증분 수집 후 DB upsert.
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { kstClosedRangeFromIsoDatePair } from "@/lib/dashboard/dashboard-order-sync-kst-range";
import { persistYogiyoOrdersSnapshot } from "@/lib/dashboard/persist-yogiyo-orders";
import { getYogiyoOrdersInitialDaysBack } from "@/lib/config/platform-orders-sync";
import {
  fetchYogiyoContractedVendors,
} from "@/lib/services/yogiyo/yogiyo-review-service";
import {
  fetchYogiyoOrdersAllPagesForRestaurants,
  isYogiyoOrdersProxyTokenExpiredError,
  yogiyoOrdersDateRangeLastDays,
  type FetchYogiyoOrdersForRestaurantsResult,
} from "@/lib/services/yogiyo/yogiyo-orders-fetch";
import { fetchYogiyoSettlementAllPages } from "@/lib/services/yogiyo/yogiyo-settlement-fetch";
import * as YogiyoSession from "@/lib/services/yogiyo/yogiyo-session-service";
import { isWorkerOrdersSyncVerbose } from "@/lib/config/worker-orders-sync-verbose";
import { addCalendarDaysKst, formatKstYmd } from "@/lib/utils/kst-date";
import { formatBusinessRegistrationDisplay } from "@/lib/utils/format-business-registration";

export type YogiyoOrdersSyncWindow = "initial" | "previous_kst_day";

function previousKstDayYmd(): string {
  const todayKst = formatKstYmd(new Date());
  return addCalendarDaysKst(todayKst, -1);
}

/**
 * @param ordersWindow `initial`: 최근 N일( env `YOGIYO_ORDERS_INITIAL_DAYS_BACK`, 기본 60 )
 *   `previous_kst_day`: KST 기준 **어제** 하루만 (`date_from` = `date_to`)
 */
export async function runYogiyoOrdersSyncJob(args: {
  storeId: string;
  userId: string;
  ordersWindow: YogiyoOrdersSyncWindow;
}): Promise<{
  ok: true;
  ordersWindow: YogiyoOrdersSyncWindow;
  range: { date_from: string; date_to: string };
  restaurant_ids: number[];
  total_order_rows: number;
  platform_orders_upserted: number;
  platform_orders_skipped: number;
  settlement_fetch: {
    attempted: boolean;
    ok: boolean;
    biz_no?: string;
    row_count_hint?: number | null;
    rows: number;
    error?: string;
  };
  per_restaurant: {
    restaurant_id: number;
    rows: number;
    fetched_pages: number;
    total_count_from_first_page: number | null;
  }[];
  warnings: string[];
}> {
  const { storeId, userId, ordersWindow } = args;

  console.log("[yogiyo_orders_sync] start", { storeId, ordersWindow });

  let token = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
  if (!token) {
    await YogiyoSession.refreshYogiyoSession(storeId, userId);
    token = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
  }
  if (!token) {
    throw new Error("요기요 Bearer 토큰을 가져올 수 없습니다. 연동을 다시 진행해 주세요.");
  }

  let date_from: string;
  let date_to: string;
  if (ordersWindow === "initial") {
    const days = getYogiyoOrdersInitialDaysBack();
    const r = yogiyoOrdersDateRangeLastDays(days);
    date_from = r.date_from;
    date_to = r.date_to;
  } else {
    const ymd = previousKstDayYmd();
    date_from = ymd;
    date_to = ymd;
  }

  const fetchVendorsAndOrders = async (
    bearer: string,
  ): Promise<{
    restaurantIds: number[];
    fetched: FetchYogiyoOrdersForRestaurantsResult;
  }> => {
    const vendors = await fetchYogiyoContractedVendors(bearer);
    let restaurantIds = vendors.map((v) => v.id);
    if (restaurantIds.length === 0) {
      const single = await YogiyoSession.getYogiyoVendorId(storeId, userId);
      if (single && /^\d+$/.test(single.trim())) {
        restaurantIds = [Number(single.trim())];
      }
    }
    if (restaurantIds.length === 0) {
      throw new Error("요기요 계약 매장 ID를 찾을 수 없습니다.");
    }
    const fetched = await fetchYogiyoOrdersAllPagesForRestaurants(
      bearer,
      restaurantIds,
      date_from,
      date_to,
      { delayMsBetweenPages: 120, delayMsBetweenRestaurants: 200 },
    );
    return { restaurantIds, fetched };
  };

  const verbose = isWorkerOrdersSyncVerbose();
  if (verbose) {
    console.log("[yogiyo_orders_sync] fetch window", { date_from, date_to });
  }

  let restaurantIds: number[];
  let fetched: FetchYogiyoOrdersForRestaurantsResult;
  try {
    ({ restaurantIds, fetched } = await fetchVendorsAndOrders(token));
  } catch (e) {
    if (!isYogiyoOrdersProxyTokenExpiredError(e)) throw e;
    console.log(
      "[yogiyo_orders_sync] proxy/orders JWT 만료 → 저장 계정으로 재로그인(refreshYogiyoSession) 후 1회 재시도",
    );
    await YogiyoSession.refreshYogiyoSession(storeId, userId);
    const token2 = await YogiyoSession.getYogiyoBearerToken(storeId, userId);
    if (!token2) {
      throw new Error(
        "요기요 Bearer 토큰을 가져올 수 없습니다. 연동을 다시 진행해 주세요.",
      );
    }
    // 이후 정산(billyo/settlement) 조회도 동일 토큰으로 수행해야 한다.
    token = token2;
    ({ restaurantIds, fetched } = await fetchVendorsAndOrders(token2));
  }

  if (verbose) {
    console.log("[yogiyo_orders_sync] fetch", {
      date_from,
      date_to,
      restaurant_ids: restaurantIds,
    });
  }

  if (verbose) {
    for (const p of fetched.per_restaurant) {
      console.log("[yogiyo_orders_sync] restaurant", {
        restaurant_id: p.restaurant_id,
        rows: p.orders.length,
        fetched_pages: p.fetched_pages,
        total_count_from_first_page: p.total_count_from_first_page,
      });
    }
  }

  const flat = fetched.per_restaurant.flatMap((p) => p.orders);
  const supabase = createServiceRoleClient();
  const dashboardReplaceKstRangeFallback = kstClosedRangeFromIsoDatePair(
    date_from,
    date_to,
  );

  // 정산(입금) 내역: store_platform_sessions.business_registration_number로 조회
  let settlements: Awaited<ReturnType<typeof fetchYogiyoSettlementAllPages>>["rows"] = [];
  const settlementFetch: {
    attempted: boolean;
    ok: boolean;
    biz_no?: string;
    row_count_hint?: number | null;
    rows: number;
    error?: string;
  } = { attempted: false, ok: false, rows: 0 };
  try {
    const { data: sess } = await supabase
      .from("store_platform_sessions")
      .select("business_registration_number")
      .eq("store_id", storeId)
      .eq("platform", "yogiyo")
      .maybeSingle();
    const digits =
      sess?.business_registration_number != null
        ? String(sess.business_registration_number).replace(/\D/g, "")
        : "";
    if (digits.length >= 10) {
      const bizNoWithHyphens = formatBusinessRegistrationDisplay(digits);
      settlementFetch.attempted = true;
      settlementFetch.biz_no = digits;
      const out = await fetchYogiyoSettlementAllPages({
        bearerToken: token,
        bizNoWithHyphens,
        start_date: date_from,
        end_date: date_to,
        page_size: 50,
      });
      settlements = out.rows;
      settlementFetch.ok = true;
      settlementFetch.rows = out.rows.length;
      settlementFetch.row_count_hint = out.row_count;
      if (verbose) {
        console.log("[yogiyo_orders_sync] settlement fetched", {
          bizNoWithHyphens,
          row_count: out.row_count,
          rows: out.rows.length,
        });
      }
    } else {
      settlementFetch.attempted = false;
      settlementFetch.ok = false;
      settlementFetch.rows = 0;
      if (verbose) console.log("[yogiyo_orders_sync] settlement skipped (no biz no)");
    }
  } catch (e) {
    // 정산 실패해도 주문 집계는 계속
    settlementFetch.attempted = true;
    settlementFetch.ok = false;
    settlementFetch.rows = 0;
    settlementFetch.error = e instanceof Error ? e.message.slice(0, 500) : String(e).slice(0, 500);
    console.error("[yogiyo_orders_sync] settlement fetch failed", e);
  }

  const snap = await persistYogiyoOrdersSnapshot({
    supabase,
    storeId,
    orders: flat,
    settlements,
    dashboardReplaceKstRangeFallback,
  });

  return {
    ok: true,
    ordersWindow,
    range: fetched.range,
    restaurant_ids: restaurantIds,
    total_order_rows: fetched.total_order_rows,
    platform_orders_upserted: snap.platformOrdersUpserted,
    platform_orders_skipped: snap.platformOrdersSkipped,
    settlement_fetch: settlementFetch,
    per_restaurant: fetched.per_restaurant.map((p) => ({
      restaurant_id: p.restaurant_id,
      rows: p.orders.length,
      fetched_pages: p.fetched_pages,
      total_count_from_first_page: p.total_count_from_first_page,
    })),
    warnings: snap.warnings,
  };
}
