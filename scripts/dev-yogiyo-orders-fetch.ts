/**
 * 요기요 주문내역 `POST https://ceo-api.yogiyo.co.kr/proxy/orders/` 스모크.
 * 로그인 → https://ceo.yogiyo.co.kr/order-history/list/ 이동 → Node fetch로 전 페이지 수집 (Bearer).
 *
 * 사용법:
 *   pnpm exec tsx scripts/dev-yogiyo-orders-fetch.ts <store_id>
 *   pnpm run dev:yogiyo-orders-fetch -- <store_id>
 *
 * 크레덴셜: DB `credentials_encrypted` 우선, 없으면 `YOGIYO_FETCH_ID` / `YOGIYO_FETCH_PW`
 *
 * 선택 env:
 *   YOGIYO_ORDERS_DAYS_BACK 또는 YOGIYO_ORDERS_INITIAL_DAYS_BACK (기본 60일)
 *   YOGIYO_ORDERS_RESTAURANT_IDS=1,2    vendors 대신 고정 매장 ID (숫자)
 *
 * 출력: `./tmp/yogiyo-orders-<storeId>-<timestamp>.json`
 *
 * DB 저장(선택):
 * - `pnpm run dev:yogiyo-orders-fetch -- <store_id> --persist`
 * - 또는 `YOGIYO_ORDERS_PERSIST=1`
 * → `store_platform_orders` + `store_platform_dashboard_*`
 *
 * .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { config as loadEnv } from "dotenv";
import {
  ENV_YOGIYO_ORDERS_PERSIST,
  getYogiyoDevOrdersDaysBack,
} from "@/lib/config/platform-orders-sync";
import { kstClosedRangeFromIsoDatePair } from "@/lib/dashboard/dashboard-order-sync-kst-range";
import type { YogiyoOrderProxyItem } from "@/lib/services/yogiyo/yogiyo-orders-fetch";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

const ORDER_HISTORY_URL = "https://ceo.yogiyo.co.kr/order-history/list/";

function parseRestaurantIdsFromEnv(raw: string | undefined): number[] | null {
  if (!raw?.trim()) return null;
  const ids = raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
  return ids.length > 0 ? ids : null;
}

function resolveRestaurantIds(params: {
  envIds: number[] | null;
  vendors: { id: number }[];
  external_shop_id: string | null;
}): number[] {
  if (params.envIds?.length) return params.envIds;
  if (params.vendors.length > 0) return params.vendors.map((v) => v.id);
  if (params.external_shop_id && /^\d+$/.test(params.external_shop_id.trim())) {
    return [Number(params.external_shop_id.trim())];
  }
  return [];
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const persistFlag =
    process.env[ENV_YOGIYO_ORDERS_PERSIST] === "1" ||
    argv.includes("--persist") ||
    argv.includes("-p");
  const storeId = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!storeId) {
    console.error(
      "첫 번째 인자로 stores.id (UUID) 필요.\n" +
        "  예: pnpm exec tsx scripts/dev-yogiyo-orders-fetch.ts <store_id> [--persist]\n" +
        "  예: pnpm run dev:yogiyo-orders-fetch -- <store_id>",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  process.env.WORKER_MODE = "1";

  const { loginYogiyoAndGetCookies } = await import(
    "@/lib/services/yogiyo/yogiyo-login-service"
  );
  const { getStoredCredentials } = await import(
    "@/lib/services/platform-session-service"
  );
  const {
    fetchYogiyoOrdersAllPagesForRestaurants,
    yogiyoOrdersDateRangeLastDays,
  } = await import("@/lib/services/yogiyo/yogiyo-orders-fetch");

  const credsDb = await getStoredCredentials(storeId, "yogiyo");
  const idEnv = process.env.YOGIYO_FETCH_ID?.trim();
  const pwEnv = process.env.YOGIYO_FETCH_PW?.trim();
  const username = credsDb?.username ?? idEnv;
  const password = credsDb?.password ?? pwEnv;
  if (!username || !password) {
    console.error(
      "요기요 로그인 정보 없음: DB credentials_encrypted 또는 YOGIYO_FETCH_ID / YOGIYO_FETCH_PW",
    );
    process.exit(1);
  }

  const daysBack = getYogiyoDevOrdersDaysBack();
  const envRestaurantIds = parseRestaurantIdsFromEnv(
    process.env.YOGIYO_ORDERS_RESTAURANT_IDS,
  );

  let fetchResult: Awaited<
    ReturnType<typeof fetchYogiyoOrdersAllPagesForRestaurants>
  > | null = null;

  await loginYogiyoAndGetCookies(username, password, {
    beforeClose: async ({ page, token, vendors, external_shop_id }) => {
      await page.goto(ORDER_HISTORY_URL, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1_500);

      const restaurantIds = resolveRestaurantIds({
        envIds: envRestaurantIds,
        vendors,
        external_shop_id,
      });
      if (restaurantIds.length === 0) {
        throw new Error(
          "주문 수집할 매장 ID가 없습니다. 연동 매장(vendors) 확인 또는 YOGIYO_ORDERS_RESTAURANT_IDS 설정.",
        );
      }

      const range = yogiyoOrdersDateRangeLastDays(daysBack);
      console.log("[yogiyo-orders-fetch] range=", range, "restaurant_ids=", restaurantIds);

      fetchResult = await fetchYogiyoOrdersAllPagesForRestaurants(
        token,
        restaurantIds,
        range.date_from,
        range.date_to,
        { delayMsBetweenPages: 120, delayMsBetweenRestaurants: 200 },
      );

      console.log(
        "[yogiyo-orders-fetch] done total_order_rows=",
        fetchResult.total_order_rows,
        "per_restaurant=",
        fetchResult.per_restaurant.map((p) => ({
          id: p.restaurant_id,
          rows: p.orders.length,
          pages: p.fetched_pages,
          count_hint: p.total_count_from_first_page,
        })),
      );
    },
  });

  if (!fetchResult) {
    console.error("[yogiyo-orders-fetch] beforeClose가 실행되지 않았습니다.");
    process.exit(1);
  }

  const ts = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
  const outDir = path.resolve(process.cwd(), "tmp");
  await fs.mkdir(outDir, { recursive: true });
  const outPath = path.join(outDir, `yogiyo-orders-${storeId}-${ts}.json`);
  const savedJson = JSON.stringify(
    {
      store_id: storeId,
      fetched_at: new Date().toISOString(),
      days_back: daysBack,
      result: fetchResult,
    },
    null,
    2,
  );
  await fs.writeFile(outPath, savedJson, "utf8");
  console.log("[yogiyo-orders-fetch] wrote", outPath);

  if (persistFlag) {
    const parsed = JSON.parse(savedJson) as {
      result?: {
        range?: { date_from: string; date_to: string };
        per_restaurant?: { orders?: YogiyoOrderProxyItem[] }[];
      };
    };
    const flat: YogiyoOrderProxyItem[] =
      parsed.result?.per_restaurant?.flatMap((p) => p.orders ?? []) ?? [];
    const dashboardReplaceKstRangeFallback =
      parsed.result?.range != null
        ? kstClosedRangeFromIsoDatePair(
            parsed.result.range.date_from,
            parsed.result.range.date_to,
          )
        : null;
    if (flat.length === 0) {
      console.warn(
        "[yogiyo-orders-fetch] --persist 였으나 수집 행이 없어 DB 스킵",
      );
    } else {
      const { createServiceRoleClient } = await import(
        "@/lib/db/supabase-server"
      );
      const { persistYogiyoOrdersSnapshot } = await import(
        "@/lib/dashboard/persist-yogiyo-orders"
      );
      const supabase = createServiceRoleClient();
      const snap = await persistYogiyoOrdersSnapshot({
        supabase,
        storeId,
        orders: flat,
        dashboardReplaceKstRangeFallback,
      });
      console.log("[yogiyo-orders-fetch] DB 반영:", {
        platform_orders_upserted: snap.platformOrdersUpserted,
        platform_orders_skipped: snap.platformOrdersSkipped,
        dashboard_shops: snap.dashboardByShop.length,
        warnings: snap.warnings.length,
      });
      if (snap.warnings.length > 0) {
        console.warn("[yogiyo-orders-fetch] warnings:", snap.warnings);
      }
    }
  }

  console.log("[yogiyo-orders-fetch] 로그인·수집 완료(브라우저 종료됨).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
