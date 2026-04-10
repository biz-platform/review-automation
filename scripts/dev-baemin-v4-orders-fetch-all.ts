/**
 * 배민 샵인샵 주문내역 전량 fetch (v4/orders 페이지네이션).
 *
 * 사용법:
 *   pnpm exec tsx scripts/dev-baemin-v4-orders-fetch-all.ts <store_id>
 *   pnpm run dev:baemin-v4-fetch-all -- <store_id>
 *
 * 데이터 소스:
 * - 크레덴셜: DB `store_platform_sessions.credentials_encrypted` 우선, 없으면 env (BAEMIN_V4_FETCH_ID/PW 또는 BAEMIN_FETCH_*)
 * - shop_owner_number / shopNumbers: DB (`store_platform_sessions` + `store_platform_shops`)
 *
 * 출력:
 * - `./tmp/baemin-v4-orders-<storeId>-<timestamp>.json`
 *
 * DB 저장(선택):
 * - `pnpm run dev:baemin-v4-fetch-all -- <store_id> --persist`
 * - 또는 `BAEMIN_V4_PERSIST=1`
 * → `store_platform_orders` + `store_baemin_dashboard_daily` / `store_baemin_dashboard_menu_daily`
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { config as loadEnv } from "dotenv";
import type { BaeminV4OrderContentRow } from "@/lib/dashboard/baemin-dashboard-types";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const persistFlag =
    process.env.BAEMIN_V4_PERSIST === "1" ||
    argv.includes("--persist") ||
    argv.includes("-p");
  const storeId = argv.find((a) => !a.startsWith("-"))?.trim();
  if (!storeId) {
    console.error(
      "첫 번째 인자로 stores.id (UUID) 필요.\n" +
        "  예: pnpm run dev:baemin-v4-fetch-all -- <store_id> [--persist]",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  process.env.WORKER_MODE = "1";

  const { loginBaeminAndGetCookies } = await import(
    "@/lib/services/baemin/baemin-login-service"
  );
  const {
    getBaeminV4OrderContextFromDb,
    fetchBaeminV4OrdersAllInPage,
  } = await import("@/lib/services/baemin/baemin-v4-orders-smoke");
  const { getStoredCredentials } = await import(
    "@/lib/services/platform-session-service"
  );

  const credsDb = await getStoredCredentials(storeId, "baemin");
  const idEnv =
    process.env.BAEMIN_V4_FETCH_ID?.trim() || process.env.BAEMIN_FETCH_ID?.trim();
  const pwEnv =
    process.env.BAEMIN_V4_FETCH_PW?.trim() || process.env.BAEMIN_FETCH_PW?.trim();
  const username = credsDb?.username ?? idEnv;
  const password = credsDb?.password ?? pwEnv;
  if (!username || !password) {
    console.error(
      "배민 로그인 정보 없음: DB credentials_encrypted 또는 BAEMIN_V4_FETCH_ID/PW 설정.",
    );
    process.exit(1);
  }

  const dbCtx = await getBaeminV4OrderContextFromDb(storeId);
  console.log(
    "[baemin-v4-fetch-all] store_id=",
    storeId,
    "shopOwnerNumber=",
    dbCtx.ordersShopOwnerNumber,
    "shopNumbers=",
    dbCtx.ordersShopNumbersParam,
  );

  await loginBaeminAndGetCookies(username, password, {
    sessionHints: dbCtx.sessionHints,
    beforeClose: async ({ page }) => {
      const out = await fetchBaeminV4OrdersAllInPage({
        page,
        shopOwnerNumber: dbCtx.ordersShopOwnerNumber,
        shopNumbersParam: dbCtx.ordersShopNumbersParam,
        limit: 50,
        logPrefix: "[baemin-v4-fetch-all]",
      });

      const ts = new Date().toISOString().replaceAll(":", "").replaceAll(".", "");
      const outDir = path.resolve(process.cwd(), "tmp");
      await fs.mkdir(outDir, { recursive: true });
      const outPath = path.join(outDir, `baemin-v4-orders-${storeId}-${ts}.json`);

      await fs.writeFile(
        outPath,
        JSON.stringify(
          {
            storeId,
            fetchedAt: new Date().toISOString(),
            shopOwnerNumber: dbCtx.ordersShopOwnerNumber,
            shopNumbersParam: dbCtx.ordersShopNumbersParam,
            meta: {
              ok: out.ok,
              totalSize: out.totalSize,
              totalPayAmount: out.totalPayAmount,
              fetchedCount: out.fetchedCount,
              pages: out.pages,
              lastStatus: out.lastStatus,
              lastError: out.lastError,
            },
            contents: out.contents,
          },
          null,
          2,
        ),
        "utf8",
      );

      console.log("[baemin-v4-fetch-all] 저장:", outPath);
      if (!out.ok) process.exitCode = 1;

      if (persistFlag && out.contents?.length) {
        const { createServiceRoleClient } = await import(
          "@/lib/db/supabase-server"
        );
        const { persistBaeminV4OrdersSnapshot } = await import(
          "@/lib/dashboard/persist-baemin-v4-orders-to-tables"
        );
        const supabase = createServiceRoleClient();
        const snap = await persistBaeminV4OrdersSnapshot({
          supabase,
          storeId,
          contents: out.contents as BaeminV4OrderContentRow[],
          mergeReviewIntoDashboard: true,
        });
        console.log(
          "[baemin-v4-fetch-all] DB 반영: platform_orders=",
          snap.platformOrdersUpserted,
          "skipped=",
          snap.platformOrdersSkipped,
          "shops=",
          snap.dashboardByShop.length,
        );
        if (snap.warnings.length) {
          console.warn("[baemin-v4-fetch-all] warnings:", snap.warnings);
        }
      }
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

