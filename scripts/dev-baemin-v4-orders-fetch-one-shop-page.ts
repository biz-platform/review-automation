/**
 * 배민 v4/orders: 특정 샵 1개만 + limit 크게(예: 100) 1페이지 테스트.
 *
 * 사용법:
 *   pnpm exec tsx scripts/dev-baemin-v4-orders-fetch-one-shop-page.ts <store_id> <shopNo> [limit]
 *   pnpm run dev:baemin-v4-fetch-one-shop-page -- <store_id> <shopNo> [limit]
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

async function main(): Promise<void> {
  const storeId = process.argv[2]?.trim();
  const shopNo = process.argv[3]?.trim();
  const limitArg = process.argv[4]?.trim();
  const limit = Math.max(1, Number(limitArg ?? "100") || 100);

  if (!storeId || !shopNo) {
    console.error(
      "인자 필요: <store_id> <shopNo> [limit]\n" +
        "예: pnpm run dev:baemin-v4-fetch-one-shop-page -- <store_id> 10652466 100",
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
  const { getBaeminV4OrderContextFromDb } = await import(
    "@/lib/services/baemin/baemin-v4-orders-smoke"
  );
  const { fetchBaeminV4OrdersPageInPage } = await import(
    "@/lib/services/baemin/baemin-v4-orders-smoke"
  );
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
    "[one-shop-page] store_id=",
    storeId,
    "owner=",
    dbCtx.ordersShopOwnerNumber,
    "shopNo=",
    shopNo,
    "limit=",
    limit,
  );

  await loginBaeminAndGetCookies(username, password, {
    sessionHints: dbCtx.sessionHints,
    beforeClose: async ({ page }) => {
      const out = await fetchBaeminV4OrdersPageInPage({
        page,
        shopOwnerNumber: dbCtx.ordersShopOwnerNumber,
        shopNumbersParam: shopNo,
        limit,
        maxLimit: limit, // 캡 해제(테스트용)
        offset: 0,
        logPrefix: "[one-shop-page]",
      });

      const contents = Array.isArray(out.json?.contents) ? out.json?.contents : [];
      const row0 = contents[0] as any;
      const order0 = row0?.order as any;
      const sample = order0
        ? {
            orderNumber: order0.orderNumber ?? null,
            status: order0.status ?? null,
            orderDateTime: order0.orderDateTime ?? null,
            shopNumber: order0.shopNumber ?? null,
            payAmount: order0.payAmount ?? null,
          }
        : null;

      let mismatchShop = 0;
      let invalidOrderNumber = 0;
      let invalidDate = 0;
      let nonClosed = 0;
      let minT: number | null = null;
      let maxT: number | null = null;

      for (const r of contents as any[]) {
        const o = r?.order;
        if (!o || typeof o !== "object") {
          invalidOrderNumber += 1;
          continue;
        }
        const on = o.orderNumber;
        if (typeof on !== "string" || on.trim() === "") invalidOrderNumber += 1;
        const sn = o.shopNumber;
        if (sn != null && String(sn) !== shopNo) mismatchShop += 1;
        const st = o.status;
        if (st != null && String(st) !== "CLOSED") nonClosed += 1;
        const dt = o.orderDateTime;
        if (typeof dt === "string") {
          const t = Date.parse(dt);
          if (!Number.isFinite(t)) {
            invalidDate += 1;
          } else {
            if (minT == null || t < minT) minT = t;
            if (maxT == null || t > maxT) maxT = t;
          }
        } else {
          invalidDate += 1;
        }
      }

      console.log(
        "[one-shop-page] status=",
        out.status,
        "ok=",
        out.ok,
        "contentsLen=",
        contents.length,
        "totalSize=",
        out.json?.totalSize ?? null,
      );
      console.log(
        "[one-shop-page] sample=",
        JSON.stringify(sample),
        "minDate=",
        minT != null ? new Date(minT).toISOString() : null,
        "maxDate=",
        maxT != null ? new Date(maxT).toISOString() : null,
      );
      console.log(
        "[one-shop-page] validations:",
        JSON.stringify({
          mismatchShop,
          nonClosed,
          invalidOrderNumber,
          invalidDate,
        }),
      );

      // 상태가 200이어도 구조/필터가 깨지면 실패로 표시
      const hasFatal =
        !out.ok ||
        !out.json ||
        mismatchShop > 0 ||
        invalidOrderNumber > 0 ||
        invalidDate > 0;
      if (hasFatal) process.exitCode = 1;
    },
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

