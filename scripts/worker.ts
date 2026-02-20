/**
 * 로컬 워커: 서버에서 pending 작업을 가져와 Playwright로 실행 후 결과 제출.
 * 개발/프로덕션 동일하게 사용. 24시간 상시 실행 권장 (systemd, PM2 등).
 *
 * env: .env.local 또는 SERVER_URL, WORKER_SECRET, WORKER_ID(선택), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * run: npx tsx scripts/worker.ts  또는  npm run worker
 */
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  // dotenv 없으면 env는 이미 설정된 값 사용
}
process.env.WORKER_MODE = "1";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const WORKER_SECRET = process.env.WORKER_SECRET ?? "";
const WORKER_ID = process.env.WORKER_ID ?? "local-1";
const POLL_INTERVAL_MS = 5_000;

function authHeaders(): Record<string, string> {
  return {
    "x-worker-secret": WORKER_SECRET,
    "Content-Type": "application/json",
  };
}

async function claimJob(): Promise<{
  id: string;
  type: string;
  store_id: string;
  user_id: string;
  payload: Record<string, unknown>;
} | null> {
  const res = await fetch(
    `${SERVER_URL}/api/worker/jobs?workerId=${encodeURIComponent(WORKER_ID)}`,
    { headers: authHeaders() },
  );
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error(`claim jobs ${res.status}: ${await res.text()}`);
  return res.json();
}

async function submitResult(
  jobId: string,
  success: boolean,
  result?: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  const body: Record<string, unknown> = { success };
  if (result) body.result = result;
  if (errorMessage) body.errorMessage = errorMessage;

  const res = await fetch(`${SERVER_URL}/api/worker/jobs/${jobId}/result`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok)
    throw new Error(`submit result ${res.status}: ${await res.text()}`);
}

async function runJob(
  type: string,
  storeId: string,
  userId: string,
  payload: Record<string, unknown>,
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}> {
  try {
    switch (type) {
      case "baemin_link": {
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId, shopOwnerNumber } =
          await loginBaeminAndGetCookies(
            String(payload.username ?? ""),
            String(payload.password ?? ""),
          );
        return {
          success: true,
          result: {
            cookies,
            external_shop_id: baeminShopId,
            shop_owner_number: shopOwnerNumber,
          },
        };
      }
      case "baemin_sync": {
        const { fetchBaeminReviewViaBrowser } =
          await import("../src/lib/services/baemin/baemin-browser-review-service");
        const { list } = await fetchBaeminReviewViaBrowser(storeId, userId, {
          from: String(payload.from ?? ""),
          to: String(payload.to ?? ""),
          offset: String(payload.offset ?? "0"),
          limit: String(payload.limit ?? "10"),
          fetchAll: Boolean(payload.fetchAll),
        });
        const reviews = (list?.reviews ?? []) as unknown[];
        return { success: true, result: { list: { reviews }, reviews } };
      }
      case "coupang_eats_link": {
        // 쿠팡이츠 로그인 서비스 미구현 — 워커에서 실패 처리
        return {
          success: false,
          errorMessage:
            "쿠팡이츠 연동(로그인)은 현재 워커에서 지원되지 않습니다.",
        };
      }
      case "coupang_eats_sync": {
        const { fetchAllCoupangEatsReviews } =
          await import("../src/lib/services/coupang-eats/coupang-eats-review-service");
        const { list } = await fetchAllCoupangEatsReviews(storeId, userId);
        return { success: true, result: { list } };
      }
      case "yogiyo_link": {
        const { loginYogiyoAndGetCookies } =
          await import("../src/lib/services/yogiyo/yogiyo-login-service");
        const { cookies, external_shop_id } = await loginYogiyoAndGetCookies(
          String(payload.username ?? ""),
          String(payload.password ?? ""),
        );
        return { success: true, result: { cookies, external_shop_id } };
      }
      case "yogiyo_sync": {
        const { fetchAllYogiyoReviews } =
          await import("../src/lib/services/yogiyo/yogiyo-review-service");
        const { list } = await fetchAllYogiyoReviews(storeId, userId);
        return { success: true, result: { list } };
      }
      case "ddangyo_link": {
        const { loginDdangyoAndGetCookies } =
          await import("../src/lib/services/ddangyo/ddangyo-login-service");
        const { cookies, external_shop_id } = await loginDdangyoAndGetCookies(
          String(payload.username ?? ""),
          String(payload.password ?? ""),
        );
        return { success: true, result: { cookies, external_shop_id } };
      }
      case "ddangyo_sync": {
        const { fetchAllDdangyoReviews } =
          await import("../src/lib/services/danggeoyo/danggeoyo-review-service");
        const { list } = await fetchAllDdangyoReviews(storeId, userId);
        return { success: true, result: { list } };
      }
      default:
        return { success: false, errorMessage: `Unknown job type: ${type}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { success: false, errorMessage: msg };
  }
}

async function loop(): Promise<void> {
  if (!WORKER_SECRET) {
    console.error("[worker] WORKER_SECRET not set. Set env and restart.");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    return;
  }

  const job = await claimJob().catch((e: unknown) => {
    const cause =
      e instanceof Error
        ? (e as Error & { cause?: { code?: string } }).cause
        : null;
    const isConnectionRefused =
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ECONNREFUSED";
    if (isConnectionRefused) {
      console.warn(
        "[worker] server unreachable, retry in",
        POLL_INTERVAL_MS / 1000,
        "s",
      );
    } else {
      console.error("[worker] claim error", e);
    }
    return null;
  });

  if (!job) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    return;
  }

  console.log("[worker] job", job.id, job.type);
  const outcome = await runJob(
    job.type,
    job.store_id,
    job.user_id,
    job.payload,
  );
  await submitResult(
    job.id,
    outcome.success,
    outcome.result,
    outcome.errorMessage,
  ).catch((e: unknown) => {
    const cause =
      e instanceof Error
        ? (e as Error & { cause?: { code?: string } }).cause
        : null;
    const isConnectionRefused =
      cause &&
      typeof cause === "object" &&
      "code" in cause &&
      cause.code === "ECONNREFUSED";
    if (isConnectionRefused) {
      console.warn(
        "[worker] server unreachable, result not submitted for",
        job.id,
      );
    } else {
      console.error("[worker] submit result error", e);
    }
  });
  if (outcome.success) {
    console.log("[worker] completed", job.id);
  } else {
    console.error("[worker] failed", job.id, outcome.errorMessage);
  }
}

async function main(): Promise<void> {
  console.log("[worker] start", { SERVER_URL, WORKER_ID });
  for (;;) {
    await loop();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
