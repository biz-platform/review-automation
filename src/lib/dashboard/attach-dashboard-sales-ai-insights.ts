import type { SupabaseClient } from "@supabase/supabase-js";
import type { DashboardSalesData } from "@/entities/dashboard/sales-types";
import { resolveDashboardAiInsightWithCache } from "@/lib/dashboard/glance-ai-insight-cache";
import {
  buildMenuDashboardAiFingerprint,
  buildSalesDashboardAiFingerprint,
} from "@/lib/dashboard/sales-menu-ai-fingerprint";
import {
  buildMenuInsightByRules,
  buildSalesInsightByRules,
} from "@/lib/dashboard/sales-menu-ai-rules";

/** 플랫폼 충돌 등으로 집계가 비었을 때 API 기본값 */
export const dashboardSalesEmptyAiInsights: DashboardSalesData["aiInsights"] = {
  sales: {
    text: "매출 데이터가 없어 인사이트를 표시할 수 없어요.",
    fromCache: false,
  },
  menu: {
    text: "메뉴 데이터가 없어 인사이트를 표시할 수 없어요.",
    fromCache: false,
  },
};

function fallbackInsights(base: DashboardSalesData): DashboardSalesData["aiInsights"] {
  return {
    sales: {
      text: buildSalesInsightByRules({
        range: base.range,
        current: base.current,
        previous: base.previous,
        deltas: base.deltas,
        weekdayHourSales: base.weekdayHourSales,
      }),
      fromCache: false,
    },
    menu: {
      text: buildMenuInsightByRules({
        range: base.range,
        topMenus: base.topMenus,
      }),
      fromCache: false,
    },
  };
}

export async function attachDashboardSalesAiInsights(args: {
  supabase: SupabaseClient;
  subjectUserId: string;
  storeScopeKey: string;
  platformFilter: string | null;
  storeIdsForQuery: string[];
  base: DashboardSalesData;
}): Promise<DashboardSalesData> {
  const { supabase, subjectUserId, storeScopeKey, platformFilter, storeIdsForQuery, base } =
    args;

  if (storeIdsForQuery.length === 0) {
    return { ...base, aiInsights: dashboardSalesEmptyAiInsights };
  }

  try {
    const salesFp = buildSalesDashboardAiFingerprint({
      range: base.range,
      current: base.current,
      previous: base.previous,
      deltas: base.deltas,
      weekdayHourSales: base.weekdayHourSales,
    });
    const menuFp = buildMenuDashboardAiFingerprint({
      range: base.range,
      menuPeriodMetrics: base.menuPeriodMetrics,
      topMenus: base.topMenus,
    });

    const [salesR, menuR] = await Promise.all([
      resolveDashboardAiInsightWithCache({
        supabase,
        subjectUserId,
        storeScopeKey,
        range: base.range,
        platformFilter,
        storeIdsForQuery,
        insightTab: "sales",
        metricsFingerprint: salesFp,
        buildFreshSummary: async () => ({
          text: buildSalesInsightByRules({
            range: base.range,
            current: base.current,
            previous: base.previous,
            deltas: base.deltas,
            weekdayHourSales: base.weekdayHourSales,
          }),
          source: "rules",
        }),
      }),
      resolveDashboardAiInsightWithCache({
        supabase,
        subjectUserId,
        storeScopeKey,
        range: base.range,
        platformFilter,
        storeIdsForQuery,
        insightTab: "menu",
        metricsFingerprint: menuFp,
        buildFreshSummary: async () => ({
          text: buildMenuInsightByRules({
            range: base.range,
            topMenus: base.topMenus,
          }),
          source: "rules",
        }),
      }),
    ]);

    return {
      ...base,
      aiInsights: {
        sales: {
          text: salesR.aiSummary,
          fromCache: salesR.aiInsightFromCache,
        },
        menu: {
          text: menuR.aiSummary,
          fromCache: menuR.aiInsightFromCache,
        },
      },
    };
  } catch {
    return { ...base, aiInsights: fallbackInsights(base) };
  }
}
