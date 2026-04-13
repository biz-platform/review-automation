/**
 * 쿠팡이츠 주문 `POST .../order/condition` 스모크 / 전체 동기화 테스트.
 *
 * 사용법:
 *   pnpm run dev:coupang-eats-orders-fetch -- <store_id>
 *   pnpm run dev:coupang-eats-orders-fetch -- <store_id> --yesterday
 *   pnpm run dev:coupang-eats-orders-fetch -- <store_id> --json-only
 *
 * - 기본: `runCoupangEatsOrdersSyncJob` → `store_platform_orders` + 대시보드 집계까지 (DB 반영)
 * - `--yesterday`: KST 어제 하루만 (빠른 확인)
 * - `--json-only`: DB 반영 없이 Playwright 수집 결과만 `./tmp/coupang-eats-orders-<storeId>-<ts>.json` 저장
 *
 * 전제: 해당 `stores.id`에 쿠팡이츠 연동 세션(쿠키) + 가능하면 `store_platform_shops`(coupang_eats).
 * 세션 만료 시 DB에 저장된 coupang_eats 계정으로 재로그인 시도(동기화 런과 동일).
 *
 * .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import path from "node:path";
import { promises as fs } from "node:fs";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

async function main(): Promise<void> {
  const argv = process.argv.slice(2).filter((a) => a !== "--");
  const jsonOnly = argv.includes("--json-only");
  const yesterday = argv.includes("--yesterday");
  const storeId = argv.find((a) => !a.startsWith("-"))?.trim();

  if (!storeId) {
    console.error(
      "첫 번째 인자로 stores.id (UUID) 필요.\n" +
        "  예: pnpm run dev:coupang-eats-orders-fetch -- <store_id>\n" +
        "  예: pnpm run dev:coupang-eats-orders-fetch -- <store_id> --yesterday\n" +
        "  예: pnpm run dev:coupang-eats-orders-fetch -- <store_id> --json-only",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  process.env.WORKER_MODE = "1";

  const { createServiceRoleClient } = await import("@/lib/db/supabase-server");
  const supabase = createServiceRoleClient();
  const { data: row, error } = await supabase
    .from("stores")
    .select("id, user_id, name")
    .eq("id", storeId)
    .maybeSingle();

  if (error || !row?.user_id) {
    console.error("stores 조회 실패 또는 user_id 없음", error?.message ?? row);
    process.exit(1);
  }

  const userId = row.user_id as string;
  console.log("[dev-coupang-eats-orders]", {
    storeId,
    storeName: row.name,
    userId,
    mode: jsonOnly ? "json-only" : "full-sync",
    ordersWindow: yesterday ? "previous_kst_day" : "initial",
  });

  if (jsonOnly) {
    const CoupangEatsSession = await import(
      "@/lib/services/coupang-eats/coupang-eats-session-service",
    );
    const { listStorePlatformShopExternalIds } = await import(
      "@/lib/services/platform-shop-service"
    );
    const {
      coupangEatsOrderConditionMsRangeFromKstYmd,
      coupangEatsOrdersDateRangeLastDays,
    } = await import("@/lib/services/coupang-eats/coupang-eats-orders-fetch");
    const { fetchCoupangEatsOrdersAllShopsPlaywright } = await import(
      "@/lib/services/coupang-eats/coupang-eats-orders-fetch-playwright"
    );
    const { getCoupangEatsOrdersInitialDaysBack } = await import(
      "@/lib/config/platform-orders-sync"
    );
    const { addCalendarDaysKst, formatKstYmd } = await import("@/lib/utils/kst-date");

    let startYmd: string;
    let endYmd: string;
    let startDate: number;
    let endDate: number;
    if (yesterday) {
      const ymd = addCalendarDaysKst(formatKstYmd(new Date()), -1);
      startYmd = ymd;
      endYmd = ymd;
      const ms = coupangEatsOrderConditionMsRangeFromKstYmd({ startYmd, endYmd });
      startDate = ms.startDate;
      endDate = ms.endDate;
    } else {
      const n = getCoupangEatsOrdersInitialDaysBack();
      const r = coupangEatsOrdersDateRangeLastDays(n);
      startYmd = r.startYmd;
      endYmd = r.endYmd;
      startDate = r.startDate;
      endDate = r.endDate;
    }

    let shopIds = await listStorePlatformShopExternalIds(supabase, storeId, "coupang_eats");
    if (shopIds.length === 0) {
      const single = await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
      if (single?.trim()) shopIds = [single.trim()];
    }
    if (shopIds.length === 0) {
      console.error("쿠팡이츠 매장 ID 없음 (store_platform_shops 또는 세션 external_shop_id)");
      process.exit(1);
    }

    let cookies = await CoupangEatsSession.getCoupangEatsCookies(storeId, userId);
    if (!cookies?.length) {
      const { getStoredCredentials } = await import("@/lib/services/platform-session-service");
      const { loginCoupangEatsAndGetCookies } = await import(
        "@/lib/services/coupang-eats/coupang-eats-login-service"
      );
      const creds = await getStoredCredentials(storeId, "coupang_eats");
      if (!creds?.username || !creds?.password) {
        console.error("세션 쿠키 없고 저장된 coupang_eats 계정도 없음");
        process.exit(1);
      }
      const login = await loginCoupangEatsAndGetCookies(creds.username, creds.password);
      await CoupangEatsSession.saveCoupangEatsSession(storeId, userId, login.cookies, {
        externalShopId: login.external_shop_id,
      });
      cookies = await CoupangEatsSession.getCoupangEatsCookies(storeId, userId);
    }
    if (!cookies?.length) {
      console.error("저장된 쿠키 없음");
      process.exit(1);
    }

    const { perShop, allRows } = await fetchCoupangEatsOrdersAllShopsPlaywright({
      cookies,
      shopExternalIds: shopIds,
      startDate,
      endDate,
      delayMsBetweenPages: 180,
    });

    const out = {
      storeId,
      range: { startYmd, endYmd, startDate, endDate },
      per_shop: perShop,
      orders: allRows,
    };
    const dir = path.resolve(process.cwd(), "tmp");
    await fs.mkdir(dir, { recursive: true });
    const file = path.join(
      dir,
      `coupang-eats-orders-${storeId}-${new Date().toISOString().replace(/[:.]/g, "-")}.json`,
    );
    await fs.writeFile(file, JSON.stringify(out, null, 2), "utf8");
    console.log("[dev-coupang-eats-orders] wrote", file, "total rows", allRows.length);
    return;
  }

  const { runCoupangEatsOrdersSyncJob } = await import(
    "@/lib/services/coupang-eats/coupang-eats-orders-sync-run"
  );
  const out = await runCoupangEatsOrdersSyncJob({
    storeId,
    userId,
    ordersWindow: yesterday ? "previous_kst_day" : "initial",
  });
  console.log("[dev-coupang-eats-orders] done", JSON.stringify(out, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
