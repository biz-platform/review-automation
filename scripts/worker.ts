/**
 * 로컬 워커: 서버에서 pending 작업을 가져와 Playwright로 실행 후 결과 제출.
 * 개발/프로덕션 동일하게 사용. 24시간 상시 실행 권장 (systemd, PM2 등).
 *
 * env: .env.local 또는 SERVER_URL, WORKER_SECRET, WORKER_ID(선택), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * run: npm run worker  또는  npx tsx scripts/worker.ts  (node로 직접 실행 시 모듈 해석 실패)
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

  const url = `${SERVER_URL}/api/worker/jobs/${jobId}/result`;
  const res = await fetch(url, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit result ${res.status}: ${text}`);
  }
  if (body.result && typeof (body.result as { reviewId?: unknown }).reviewId === "string") {
    console.log("[worker] result submitted OK → 서버에서 reviews.platform_reply_content 갱신 예정", jobId);
  }
}

/** 워커: 사용자 취소 여부 확인 (GET /api/worker/jobs/[jobId]) */
async function isJobCancelled(jobId: string): Promise<boolean> {
  try {
    const res = await fetch(`${SERVER_URL}/api/worker/jobs/${jobId}`, {
      headers: authHeaders(),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === "cancelled";
  } catch {
    return false;
  }
}

async function runJob(
  type: string,
  storeId: string,
  userId: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}> {
  try {
    switch (type) {
      case "baemin_link": {
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(storeId, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage: "저장된 연동 정보가 없습니다. 다시 연동을 요청해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId, shopOwnerNumber, shop_category } =
          await loginBaeminAndGetCookies(creds.username, creds.password);
        return {
          success: true,
          result: {
            cookies,
            external_shop_id: baeminShopId,
            shop_owner_number: shopOwnerNumber,
            shop_category: shop_category ?? undefined,
          },
        };
      }
      case "baemin_sync": {
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(storeId, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId } =
          await loginBaeminAndGetCookies(creds.username, creds.password);
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const { fetchBaeminReviewViaBrowser } =
          await import("../src/lib/services/baemin/baemin-browser-review-service");
        const { list, shop_category } = await fetchBaeminReviewViaBrowser(
          storeId,
          userId,
          {
            from: String(payload.from ?? ""),
            to: String(payload.to ?? ""),
            offset: String(payload.offset ?? "0"),
            limit: String(payload.limit ?? "10"),
            fetchAll: Boolean(payload.fetchAll),
          },
          {
            isCancelled: () => isJobCancelled(jobId),
            sessionOverride: { cookies, shopNo: baeminShopId },
          },
        );
        const reviews = (list?.reviews ?? []) as unknown[];
        return {
          success: true,
          result: { list: { reviews }, reviews, shop_category: shop_category ?? undefined },
        };
      }
      case "baemin_register_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId =
          (payload.reviewId as string | undefined) ??
          (payload.review_id as string | undefined);
        const writtenAt = payload.written_at as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(storeId, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId } =
          await loginBaeminAndGetCookies(creds.username, creds.password);
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const { registerBaeminReplyViaBrowser } =
          await import("../src/lib/services/baemin/baemin-register-reply-service");
        await registerBaeminReplyViaBrowser(
          storeId,
          userId,
          {
            reviewExternalId: externalId,
            content,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, shopNo: baeminShopId } },
        );
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "yogiyo_register_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        const { registerYogiyoReplyViaBrowser } =
          await import("../src/lib/services/yogiyo/yogiyo-register-reply-service");
        await registerYogiyoReplyViaBrowser(storeId, userId, {
          reviewExternalId: externalId,
          content,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "ddangyo_register_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        const { registerDdangyoReplyViaBrowser } =
          await import("../src/lib/services/ddangyo/ddangyo-register-reply-service");
        await registerDdangyoReplyViaBrowser(storeId, userId, {
          reviewExternalId: externalId,
          content,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "coupang_eats_register_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        const { registerCoupangEatsReplyViaBrowser } =
          await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
        await registerCoupangEatsReplyViaBrowser(storeId, userId, {
          reviewExternalId: externalId,
          content,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "coupang_eats_link": {
        const { loginCoupangEatsAndGetCookies } =
          await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(
            String(payload.username ?? ""),
            String(payload.password ?? ""),
          );
        return {
          success: true,
          result: { cookies, external_shop_id: external_shop_id ?? undefined },
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
          await import("../src/lib/services/ddangyo/ddangyo-review-service");
        const { list } = await fetchAllDdangyoReviews(storeId, userId);
        return { success: true, result: { list } };
      }
      default:
        return { success: false, errorMessage: `Unknown job type: ${type}` };
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "CANCELLED") {
      return { success: false, errorMessage: "사용자에 의해 취소됨" };
    }
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
    job.id,
  );
  let resultSubmitted = false;
  try {
    await submitResult(
      job.id,
      outcome.success,
      outcome.result,
      outcome.errorMessage,
    );
    resultSubmitted = true;
  } catch (e: unknown) {
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
        "[worker] server unreachable, result NOT submitted for",
        job.id,
        "- DB가 갱신되지 않습니다. SERVER_URL 확인 후 서버 기동 여부 확인.",
      );
    } else {
      console.error("[worker] submit result error (result NOT submitted)", e);
    }
  }
  if (outcome.success && resultSubmitted) {
    console.log("[worker] completed", job.id);
  } else if (outcome.success && !resultSubmitted) {
    console.error("[worker] job 성공했으나 result 제출 실패 → DB 미반영", job.id);
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
