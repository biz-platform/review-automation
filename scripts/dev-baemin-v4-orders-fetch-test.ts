/**
 * 배민 self `GET /v4/orders` 스모크: Playwright 로그인 후
 * https://self.baemin.com/orders/history 문서 컨텍스트에서 `fetch(credentials:'include')`.
 *
 * 사용법:
 *   pnpm exec tsx scripts/dev-baemin-v4-orders-fetch-test.ts <store_id>
 *   pnpm run dev:baemin-v4-fetch-test -- <store_id>
 *
 * 자격증명·shop_owner·매장 번호: **DB 우선** (`credentials_encrypted`, `store_platform_sessions` / `store_platform_shops`).
 * 폴백: `BAEMIN_V4_FETCH_ID` / `BAEMIN_V4_FETCH_PW` (또는 `BAEMIN_FETCH_*`).
 *
 * .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 선택: BAEMIN_X_WEB_VERSION, BAEMIN_X_E_REQUEST, BAEMIN_V4_* (날짜·limit·헤더 캡처)
 *
 * 연동 직후 워커에서 동일 스모크: `BAEMIN_V4_ORDERS_SMOKE_AFTER_LINK=1` (워커 프로세스 env)
 *
 * 첫 실행·reCAPTCHA: DEBUG_BROWSER_HEADED=1
 */
import path from "node:path";
import { config as loadEnv } from "dotenv";

loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv();

async function main(): Promise<void> {
  const { loginBaeminAndGetCookies } =
    await import("@/lib/services/baemin/baemin-login-service");
  const { getBaeminV4OrderContextFromDb, runBaeminV4OrdersSmokeInPage } =
    await import("@/lib/services/baemin/baemin-v4-orders-smoke");
  const { getStoredCredentials } =
    await import("@/lib/services/platform-session-service");

  const storeId = process.argv[2]?.trim();
  if (!storeId) {
    console.error(
      "첫 번째 인자로 stores.id (UUID) 필요.\n" +
        "  예: pnpm exec tsx scripts/dev-baemin-v4-orders-fetch-test.ts <store_id>\n" +
        "  예: pnpm run dev:baemin-v4-fetch-test -- <store_id>",
    );
    process.exit(1);
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    console.error("SUPABASE_SERVICE_ROLE_KEY 가 필요합니다.");
    process.exit(1);
  }
  process.env.WORKER_MODE = "1";

  const credsDb = await getStoredCredentials(storeId, "baemin");
  const idEnv =
    process.env.BAEMIN_V4_FETCH_ID?.trim() ||
    process.env.BAEMIN_FETCH_ID?.trim();
  const pwEnv =
    process.env.BAEMIN_V4_FETCH_PW?.trim() ||
    process.env.BAEMIN_FETCH_PW?.trim();
  const username = credsDb?.username ?? idEnv;
  const password = credsDb?.password ?? pwEnv;
  if (!username || !password) {
    console.error(
      "배민 로그인 정보 없음: store의 credentials_encrypted 또는 BAEMIN_V4_FETCH_ID/PW 설정.",
    );
    process.exit(1);
  }

  let dbCtx: Awaited<ReturnType<typeof getBaeminV4OrderContextFromDb>>;
  try {
    dbCtx = await getBaeminV4OrderContextFromDb(storeId);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
  console.log(
    "[baemin-v4-fetch-test] store_id=",
    storeId,
    "sessionHints=",
    JSON.stringify(dbCtx.sessionHints),
  );

  await loginBaeminAndGetCookies(username, password, {
    sessionHints: dbCtx.sessionHints,
    beforeClose: async ({ page }) => {
      const out = await runBaeminV4OrdersSmokeInPage({
        page,
        shopOwnerNumber: dbCtx.ordersShopOwnerNumber,
        shopNumbersParam: dbCtx.ordersShopNumbersParam,
        logPrefix: "[baemin-v4-fetch-test]",
      });
      if (!out.ok) {
        process.exitCode = 1;
      }
    },
  });

  console.log(
    "[baemin-v4-fetch-test] 로그인·쿠키 수집까지 완료(브라우저 종료됨).",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
