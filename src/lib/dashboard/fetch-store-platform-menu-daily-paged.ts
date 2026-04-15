import type { SupabaseClient } from "@supabase/supabase-js";
import type { MenuDailyRow } from "@/lib/dashboard/dashboard-menu-aggregate";

const MENU_PAGE_SIZE = 1000;

/**
 * PostgREST 기본 max-rows(1000)를 넘기면 이전 기간 행이 잘려
 * `previousQuantity` 등이 전부 0처럼 보이므로 페이지 단위로 전부 적재한다.
 */
export async function fetchStorePlatformDashboardMenuDailyRowsPaged(
  supabase: SupabaseClient,
  args: {
    storeIdsForQuery: string[];
    kstDateFrom: string;
    kstDateTo: string;
    platformEq: string | null;
    shopEq: string | null;
  },
): Promise<MenuDailyRow[]> {
  const { storeIdsForQuery, kstDateFrom, kstDateTo, platformEq, shopEq } = args;
  if (storeIdsForQuery.length === 0) return [];

  const out: MenuDailyRow[] = [];
  let from = 0;
  for (;;) {
    let mq = supabase
      .from("store_platform_dashboard_menu_daily")
      .select(
        "menu_name, quantity, line_total, share_of_day_revenue, kst_date, store_id, platform, platform_shop_external_id",
      )
      .in("store_id", storeIdsForQuery)
      .gte("kst_date", kstDateFrom)
      .lte("kst_date", kstDateTo)
      .order("kst_date", { ascending: true })
      .order("store_id", { ascending: true })
      .order("platform", { ascending: true })
      .order("platform_shop_external_id", { ascending: true })
      .order("menu_name", { ascending: true })
      .range(from, from + MENU_PAGE_SIZE - 1);
    if (platformEq) mq = mq.eq("platform", platformEq);
    if (shopEq) mq = mq.eq("platform_shop_external_id", shopEq);

    const { data, error } = await mq;
    if (error) throw error;
    const batch = (data ?? []) as MenuDailyRow[];
    out.push(...batch);
    if (batch.length < MENU_PAGE_SIZE) break;
    from += MENU_PAGE_SIZE;
  }
  return out;
}
