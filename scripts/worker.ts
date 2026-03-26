import { AsyncLocalStorage } from "node:async_hooks";

import {
  getWorkerJobStoreLogFields,
  type WorkerJobStoreLogFields,
} from "@/lib/services/worker-job-store-log";

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
const POLL_INTERVAL_MS = 10_000;

function authHeaders(): Record<string, string> {
  return {
    "x-worker-secret": WORKER_SECRET,
    "Content-Type": "application/json",
  };
}

const BATCH_LIMIT = 10;
function slotTag(slotIndex: number): string {
  return slotIndex >= 0 ? `[slot:${slotIndex}]` : "[slot:single]";
}
const slotLogStore = new AsyncLocalStorage<number>();
function currentSlotTag(): string {
  const slotIndex = slotLogStore.getStore();
  return slotTag(typeof slotIndex === "number" ? slotIndex : -1);
}
function logWithSlot(...args: unknown[]): void {
  console.log(currentSlotTag(), ...args);
}
function warnWithSlot(...args: unknown[]): void {
  console.warn(currentSlotTag(), ...args);
}
function errorWithSlot(...args: unknown[]): void {
  console.error(currentSlotTag(), ...args);
}

// MEASURE_MEMORY=1 일 때만 로드. 실제 작업 시 메모리 디버깅용.
const measureMemory = (() => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require("./lib/measure-memory") as {
      sample: (label?: string) => void;
      logSummary: (prefix?: string) => void;
      reset: () => void;
      isEnabled: () => boolean;
    };
  } catch {
    return {
      sample: () => {},
      logSummary: () => {},
      reset: () => {},
      isEnabled: () => false,
    };
  }
})();
let memoryDebugCycles = 0;

type JobClaim = {
  id: string;
  type: string;
  store_id: string | null;
  user_id: string;
  payload: Record<string, unknown>;
};

async function claimJob(): Promise<JobClaim | null> {
  const res = await fetch(
    `${SERVER_URL}/api/worker/jobs?workerId=${encodeURIComponent(WORKER_ID)}`,
    { headers: authHeaders() },
  );
  if (res.status === 204 || res.status === 404) return null;
  if (!res.ok) throw new Error(`claim jobs ${res.status}: ${await res.text()}`);
  return res.json();
}

/** Playwright "Target page, context or browser has been closed" 등 브라우저 비정상 종료 시 1회 재시도 후 사용자 안내 */
const BROWSER_CLOSED_USER_MESSAGE =
  "알 수 없는 오류로 인해 작업이 종료되었습니다. 고객센터로 문의바랍니다.";

function toErrorDebugInfo(error: unknown): {
  name?: string;
  message: string;
  stack?: string;
  cause?: unknown;
} {
  if (error instanceof Error) {
    const withCause = error as Error & { cause?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      cause: withCause.cause,
    };
  }
  return { message: typeof error === "string" ? error : String(error) };
}

function isBrowserClosedError(e: unknown): boolean {
  const msg =
    e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
  return (
    msg.includes("Target page, context or browser has been closed") ||
    msg.includes("has been closed") ||
    msg.includes("Browser has been closed") ||
    msg.includes("The service is no longer running")
  );
}

const BAEMIN_SYNC_MAX_ATTEMPTS = 3;
const BAEMIN_SYNC_RETRY_DELAY_MS = 2_000;

async function runJobWithBrowserClosedRetry(
  type: string,
  storeId: string | null,
  userId: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}> {
  const outcome = await runJob(type, storeId, userId, payload, jobId);
  if (outcome.success || !isBrowserClosedError(outcome.errorMessage ?? "")) {
    return outcome;
  }
  const storeLog = await getWorkerJobStoreLogFields(storeId, userId, type, payload);
  errorWithSlot("[worker][browser-closed][first-attempt]", {
    jobId,
    type,
    storeId,
    userId,
    ...storeLog,
    errorMessage: outcome.errorMessage,
  });
  const retry = await runJob(type, storeId, userId, payload, jobId);
  if (retry.success) return retry;
  if (isBrowserClosedError(retry.errorMessage ?? "")) {
    const storeLogRetry = await getWorkerJobStoreLogFields(
      storeId,
      userId,
      type,
      payload,
    );
    errorWithSlot("[worker][browser-closed][retry-failed]", {
      jobId,
      type,
      storeId,
      userId,
      ...storeLogRetry,
      firstErrorMessage: outcome.errorMessage,
      retryErrorMessage: retry.errorMessage,
      maskedMessage: BROWSER_CLOSED_USER_MESSAGE,
    });
    return { success: false, errorMessage: BROWSER_CLOSED_USER_MESSAGE };
  }
  return retry;
}

/** baemin_sync: 이유 불명 실패 시 최대 3회 시도(간격 2초). 그 외 job은 브라우저 종료 시 1회 재시도만. */
async function runJobWithRetries(
  type: string,
  storeId: string | null,
  userId: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}> {
  if (type !== "baemin_sync") {
    return runJobWithBrowserClosedRetry(type, storeId, userId, payload, jobId);
  }
  let last: Awaited<ReturnType<typeof runJobWithBrowserClosedRetry>> = {
    success: false,
    errorMessage: "재시도 전 초기 실행 없음",
  };
  for (let attempt = 1; attempt <= BAEMIN_SYNC_MAX_ATTEMPTS; attempt++) {
    last = await runJobWithBrowserClosedRetry(
      type,
      storeId,
      userId,
      payload,
      jobId,
    );
    if (last.success) return last;
    if (attempt < BAEMIN_SYNC_MAX_ATTEMPTS) {
      warnWithSlot(
        "[worker] baemin_sync 실패, 재시도",
        attempt + 1,
        "/",
        BAEMIN_SYNC_MAX_ATTEMPTS,
        "—",
        last.errorMessage,
      );
      await new Promise((r) => setTimeout(r, BAEMIN_SYNC_RETRY_DELAY_MS));
    }
  }
  return last;
}

function isRetriableNetworkError(e: unknown): boolean {
  const cause =
    e instanceof Error
      ? (e as Error & { cause?: { code?: string } }).cause
      : null;
  const code =
    cause && typeof cause === "object" && "code" in cause
      ? (cause as { code: string }).code
      : null;
  return (
    code === "ECONNRESET" || code === "ECONNREFUSED" || code === "ETIMEDOUT"
  );
}

/** 배치 선점: 같은 (store_id, type, user_id) job 배열 반환. 0건이면 [].
 * `platform`은 API 쿼리로 전달 — `internal`이면 internal_auto_register_draft / auto_register_post_sync만 선점. */
async function claimJobBatch(
  workerIdOverride?: string,
  platform?: string | null,
): Promise<JobClaim[]> {
  const workerId = workerIdOverride ?? WORKER_ID;
  const platformQuery = platform
    ? `&platform=${encodeURIComponent(platform)}`
    : "";
  const res = await fetch(
    `${SERVER_URL}/api/worker/jobs/batch?workerId=${encodeURIComponent(workerId)}&limit=${BATCH_LIMIT}${platformQuery}`,
    { headers: authHeaders() },
  );
  if (res.status === 204 || res.status === 404) return [];
  const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
  const safeText = async () => {
    const t = await res.text().catch(() => "");
    return t.length > 600 ? `${t.slice(0, 600)}\n...(truncated)` : t;
  };

  if (!res.ok) {
    const text = await safeText();
    throw new Error(
      `claim batch ${res.status} (${contentType || "unknown content-type"}): ${text}`,
    );
  }

  // Sometimes misconfigured SERVER_URL/auth returns HTML with 200 OK (e.g. Next.js error page)
  if (!contentType.includes("application/json")) {
    const text = await safeText();
    throw new Error(
      `claim batch expected JSON but got ${contentType || "unknown content-type"} (status ${res.status}): ${text}`,
    );
  }

  try {
    const data = (await res.json()) as { jobs?: JobClaim[] };
    return Array.isArray(data.jobs) ? data.jobs : [];
  } catch (e) {
    const text = await safeText();
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(
      `claim batch JSON parse failed (${msg}) status=${res.status} content-type=${contentType}: ${text}`,
    );
  }
}

const SLOT_PLATFORM_ORDER = [
  "baemin",
  "coupang_eats",
  "yogiyo",
  "ddangyo",
] as const;
type SlotPlatform = (typeof SLOT_PLATFORM_ORDER)[number];

async function submitResult(
  jobId: string,
  success: boolean,
  result?: Record<string, unknown>,
  errorMessage?: string,
): Promise<void> {
  if (!success && errorMessage && isBrowserClosedError(errorMessage)) {
    errorMessage = BROWSER_CLOSED_USER_MESSAGE;
  }
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
  if (
    body.result &&
    typeof (body.result as { reviewId?: unknown }).reviewId === "string"
  ) {
    logWithSlot(
      "[worker] result submitted OK → 서버에서 reviews.platform_reply_content 갱신 예정",
      jobId,
    );
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

const LINK_JOB_TYPES = [
  "baemin_link",
  "yogiyo_link",
  "ddangyo_link",
  "coupang_eats_link",
];

async function runJob(
  type: string,
  storeId: string | null,
  userId: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<{
  success: boolean;
  result?: Record<string, unknown>;
  errorMessage?: string;
}> {
  const sid = storeId;
  if (sid == null && !LINK_JOB_TYPES.includes(type)) {
    return { success: false, errorMessage: "store_id required" };
  }
  try {
    switch (type) {
      case "baemin_link": {
        let creds: { username: string; password: string } | null = null;
        let credsFromPayload = false;
        const enc = payload.credentials_encrypted;
        if (typeof enc === "string") {
          const { decryptCookieJson } =
            await import("../src/lib/utils/cookie-encrypt");
          try {
            const raw = decryptCookieJson(enc);
            const parsed = JSON.parse(raw) as {
              username?: string;
              password?: string;
            };
            if (
              typeof parsed?.username === "string" &&
              typeof parsed?.password === "string"
            ) {
              creds = {
                username: parsed.username,
                password: parsed.password,
              };
              credsFromPayload = true;
            }
          } catch {
            // ignore
          }
        }
        if (!creds && sid) {
          const { getStoredCredentials } =
            await import("../src/lib/services/platform-session-service");
          creds = await getStoredCredentials(sid, "baemin");
        }
        if (!creds) {
          const isFirstLinkAttempt = sid == null || typeof enc === "string";
          return {
            success: false,
            errorMessage: isFirstLinkAttempt
              ? "아이디·비밀번호를 확인해 주세요."
              : "저장된 연동 정보가 없습니다. 다시 연동을 요청해 주세요.",
          };
        }
        try {
          const { loginBaeminAndGetCookies } =
            await import("../src/lib/services/baemin/baemin-login-service");
          const {
            cookies,
            baeminShopId,
            shopOwnerNumber,
            shop_category,
            businessNo,
            store_name,
          } = await loginBaeminAndGetCookies(creds.username, creds.password);
          return {
            success: true,
            result: {
              cookies,
              external_shop_id: baeminShopId,
              shop_owner_number: shopOwnerNumber,
              shop_category: shop_category ?? undefined,
              business_registration_number: businessNo ?? undefined,
              store_name: store_name ?? undefined,
            },
          };
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          const isIdPwError =
            msg.includes("매장 연동에 실패") ||
            msg.includes("아이디·비밀번호를 확인");
          return {
            success: false,
            errorMessage:
              credsFromPayload || sid == null
                ? "아이디·비밀번호를 확인해 주세요."
                : isIdPwError
                  ? "저장된 연동 정보가 없습니다. 다시 연동을 요청해 주세요."
                  : msg,
          };
        }
      }
      case "baemin_sync": {
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId, store_name } =
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
          sid!,
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
          result: {
            list: { reviews },
            reviews,
            shop_category: shop_category ?? undefined,
            store_name: store_name ?? undefined,
          },
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
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
          creds.username,
          creds.password,
        );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const { registerBaeminReplyViaBrowser } =
          await import("../src/lib/services/baemin/baemin-register-reply-service");
        await registerBaeminReplyViaBrowser(
          sid!,
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
        const { registerYogiyoReplyViaApi } =
          await import("../src/lib/services/yogiyo/yogiyo-reply-api");
        const { replyId } = await registerYogiyoReplyViaApi(sid!, userId, {
          reviewId: externalId,
          content,
        });
        return {
          success: true,
          result: {
            reviewId: reviewId ?? null,
            content,
            orderReviewReplyId: replyId,
          },
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
        const { registerDdangyoReplyViaApi } =
          await import("../src/lib/services/ddangyo/ddangyo-reply-api");
        await registerDdangyoReplyViaApi(sid!, userId, {
          rviewAtclNo: externalId,
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
        const writtenAt = payload.written_at as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        // sync와 동일하게 저장 세션 우선 시도 (로그인 차단 빈도 완화)
        try {
          const { registerCoupangEatsReplyViaBrowser } =
            await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
          const storedTry = await registerCoupangEatsReplyViaBrowser(
            sid!,
            userId,
            {
              reviewExternalId: externalId,
              content,
              written_at: writtenAt ?? null,
            },
          );
          return {
            success: true,
            result: {
              reviewId: reviewId ?? null,
              content,
              ...(storedTry?.orderReviewReplyId != null && {
                orderReviewReplyId: storedTry.orderReviewReplyId,
              }),
            },
          };
        } catch (storedErr) {
          warnWithSlot(
            "[worker] coupang_eats_register_reply stored session failed, re-login",
            { jobId, error: toErrorDebugInfo(storedErr) },
          );
        }
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginCoupangEatsAndGetCookies } =
          await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
        const { saveCoupangEatsSession } =
          await import("../src/lib/services/coupang-eats/coupang-eats-session-service");
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: external_shop_id ?? undefined,
        });
        const { registerCoupangEatsReplyViaBrowser } =
          await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
        const registerResult = await registerCoupangEatsReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            content,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, external_shop_id } },
        );
        return {
          success: true,
          result: {
            reviewId: reviewId ?? null,
            content,
            ...(registerResult?.orderReviewReplyId != null && {
              orderReviewReplyId: registerResult.orderReviewReplyId,
            }),
          },
        };
      }
      case "coupang_eats_modify_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        const orderReviewReplyIdRaw =
          payload.order_review_reply_id ?? payload.orderReviewReplyId;
        const orderReviewReplyId =
          orderReviewReplyIdRaw != null &&
          String(orderReviewReplyIdRaw).trim() !== ""
            ? Number(orderReviewReplyIdRaw) || String(orderReviewReplyIdRaw)
            : undefined;
        const writtenAt = payload.written_at as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id, content가 필요합니다.",
          };
        }
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginCoupangEatsAndGetCookies } =
          await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
        const { saveCoupangEatsSession } =
          await import("../src/lib/services/coupang-eats/coupang-eats-session-service");
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: external_shop_id ?? undefined,
        });
        const { modifyCoupangEatsReplyViaBrowser } =
          await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
        await modifyCoupangEatsReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            content,
            orderReviewReplyId,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, external_shop_id } },
        );
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "coupang_eats_delete_reply": {
        const externalId = String(payload.external_id ?? "");
        const reviewId = payload.reviewId as string | undefined;
        const orderReviewReplyIdRaw =
          payload.order_review_reply_id ?? payload.orderReviewReplyId;
        const orderReviewReplyId =
          orderReviewReplyIdRaw != null &&
          String(orderReviewReplyIdRaw).trim() !== ""
            ? Number(orderReviewReplyIdRaw) || String(orderReviewReplyIdRaw)
            : undefined;
        const writtenAt = payload.written_at as string | undefined;
        if (!externalId) {
          return {
            success: false,
            errorMessage: "external_id가 필요합니다.",
          };
        }
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginCoupangEatsAndGetCookies } =
          await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
        const { saveCoupangEatsSession } =
          await import("../src/lib/services/coupang-eats/coupang-eats-session-service");
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: external_shop_id ?? undefined,
        });
        const { deleteCoupangEatsReplyViaBrowser } =
          await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
        await deleteCoupangEatsReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            orderReviewReplyId:
              Number(orderReviewReplyId) || String(orderReviewReplyId),
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, external_shop_id } },
        );
        return { success: true, result: { reviewId: reviewId ?? null } };
      }
      case "baemin_modify_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        const writtenAt = payload.written_at as string | undefined;
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
          creds.username,
          creds.password,
        );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const { modifyBaeminReplyViaBrowser } =
          await import("../src/lib/services/baemin/baemin-register-reply-service");
        await modifyBaeminReplyViaBrowser(
          sid!,
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
      case "baemin_delete_reply": {
        const externalId = String(payload.external_id ?? "");
        const reviewId = payload.reviewId as string | undefined;
        const writtenAt = payload.written_at as string | undefined;
        if (!externalId) {
          return {
            success: false,
            errorMessage: "external_id가 필요합니다.",
          };
        }
        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { loginBaeminAndGetCookies } =
          await import("../src/lib/services/baemin/baemin-login-service");
        const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
          creds.username,
          creds.password,
        );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const { deleteBaeminReplyViaBrowser } =
          await import("../src/lib/services/baemin/baemin-register-reply-service");
        await deleteBaeminReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, shopNo: baeminShopId } },
        );
        return {
          success: true,
          result: { reviewId: reviewId ?? null },
        };
      }
      case "yogiyo_modify_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        let replyIdRaw =
          payload.order_review_reply_id ?? payload.orderReviewReplyId;
        if (replyIdRaw == null || String(replyIdRaw).trim() === "") {
          const { getYogiyoReplyIdFromList } =
            await import("../src/lib/services/yogiyo/yogiyo-reply-api");
          const fromList = await getYogiyoReplyIdFromList(
            sid!,
            userId,
            externalId,
          );
          replyIdRaw = fromList;
        }
        const replyId = replyIdRaw != null ? String(replyIdRaw).trim() : "";
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        if (!replyId) {
          return {
            success: false,
            errorMessage:
              "답글 ID를 찾을 수 없습니다. 해당 리뷰에 등록된 답글이 있는지 확인해 주세요.",
          };
        }
        const { modifyYogiyoReplyViaApi } =
          await import("../src/lib/services/yogiyo/yogiyo-reply-api");
        await modifyYogiyoReplyViaApi(sid!, userId, {
          reviewId: externalId,
          replyId,
          content,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "yogiyo_delete_reply": {
        const externalId = String(payload.external_id ?? "");
        const reviewId = payload.reviewId as string | undefined;
        let replyIdRaw =
          payload.order_review_reply_id ?? payload.orderReviewReplyId;
        if (replyIdRaw == null || String(replyIdRaw).trim() === "") {
          const { getYogiyoReplyIdFromList } =
            await import("../src/lib/services/yogiyo/yogiyo-reply-api");
          const fromList = await getYogiyoReplyIdFromList(
            sid!,
            userId,
            externalId,
          );
          replyIdRaw = fromList;
        }
        const replyId = replyIdRaw != null ? String(replyIdRaw).trim() : "";
        if (!externalId) {
          return {
            success: false,
            errorMessage: "external_id가 필요합니다.",
          };
        }
        if (!replyId) {
          return {
            success: false,
            errorMessage:
              "답글 ID를 찾을 수 없습니다. 해당 리뷰에 등록된 답글이 있는지 확인해 주세요.",
          };
        }
        const { deleteYogiyoReplyViaApi } =
          await import("../src/lib/services/yogiyo/yogiyo-reply-api");
        await deleteYogiyoReplyViaApi(sid!, userId, {
          reviewId: externalId,
          replyId,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null },
        };
      }
      case "ddangyo_modify_reply": {
        const externalId = String(payload.external_id ?? "");
        const content = String(payload.content ?? "");
        const reviewId = payload.reviewId as string | undefined;
        let rplyNo =
          (payload.order_review_reply_id ??
            payload.orderReviewReplyId ??
            payload.platform_reply_id) != null
            ? String(
                payload.order_review_reply_id ??
                  payload.orderReviewReplyId ??
                  payload.platform_reply_id,
              ).trim()
            : "";
        if (!rplyNo) {
          const { getDdangyoRplyInfoFromList } =
            await import("../src/lib/services/ddangyo/ddangyo-reply-api");
          const info = await getDdangyoRplyInfoFromList(
            sid!,
            userId,
            externalId,
          );
          if (info) rplyNo = info.rplyNo;
        }
        if (!externalId || !content) {
          return {
            success: false,
            errorMessage: "external_id와 content가 필요합니다.",
          };
        }
        if (!rplyNo) {
          return {
            success: false,
            errorMessage:
              "땡겨요 답글 ID(rply_no)를 찾을 수 없습니다. 해당 리뷰에 답글이 있는지 확인해 주세요.",
          };
        }
        const { modifyDdangyoReplyViaApi } =
          await import("../src/lib/services/ddangyo/ddangyo-reply-api");
        await modifyDdangyoReplyViaApi(sid!, userId, {
          rviewAtclNo: externalId,
          rplyNo,
          content,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "ddangyo_delete_reply": {
        const externalId = String(payload.external_id ?? "");
        const reviewId = payload.reviewId as string | undefined;
        let rplyNo =
          (payload.order_review_reply_id ??
            payload.orderReviewReplyId ??
            payload.platform_reply_id) != null
            ? String(
                payload.order_review_reply_id ??
                  payload.orderReviewReplyId ??
                  payload.platform_reply_id,
              ).trim()
            : "";
        if (!rplyNo) {
          const { getDdangyoRplyInfoFromList } =
            await import("../src/lib/services/ddangyo/ddangyo-reply-api");
          const info = await getDdangyoRplyInfoFromList(
            sid!,
            userId,
            externalId,
          );
          if (info) rplyNo = info.rplyNo;
        }
        if (!externalId) {
          return { success: false, errorMessage: "external_id가 필요합니다." };
        }
        if (!rplyNo) {
          return {
            success: false,
            errorMessage:
              "땡겨요 답글 ID(rply_no)를 찾을 수 없습니다. 해당 리뷰에 답글이 있는지 확인해 주세요.",
          };
        }
        const { deleteDdangyoReplyViaApi } =
          await import("../src/lib/services/ddangyo/ddangyo-reply-api");
        await deleteDdangyoReplyViaApi(sid!, userId, {
          rviewAtclNo: externalId,
          rplyNo,
        });
        return { success: true, result: { reviewId: reviewId ?? null } };
      }
      case "coupang_eats_link": {
        const { loginCoupangEatsAndGetCookies } =
          await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
        const {
          cookies,
          external_shop_id,
          business_registration_number,
          shop_category,
        } = await loginCoupangEatsAndGetCookies(
          String(payload.username ?? ""),
          String(payload.password ?? ""),
        );
        return {
          success: true,
          result: {
            cookies,
            external_shop_id: external_shop_id ?? undefined,
            business_registration_number: business_registration_number ?? null,
            shop_category: shop_category ?? null,
          },
        };
      }
      case "coupang_eats_sync": {
        const DEBUG_CE = process.env.DEBUG_COUPANG_EATS_SYNC === "1";
        const { getCoupangEatsCookies, getCoupangEatsStoreId } =
          await import("../src/lib/services/coupang-eats/coupang-eats-session-service");
        const { fetchAllCoupangEatsReviews } =
          await import("../src/lib/services/coupang-eats/coupang-eats-review-service");

        const storedCookies = await getCoupangEatsCookies(sid!, userId);
        const external_shop_id = await getCoupangEatsStoreId(sid!, userId);
        if (DEBUG_CE) {
          logWithSlot("[worker] coupang_eats_sync stored", {
            cookieCount: storedCookies?.length ?? 0,
            hasExternalShopId: !!external_shop_id,
          });
        }

        if (storedCookies?.length && external_shop_id) {
          try {
            const { list, store_name } = await fetchAllCoupangEatsReviews(
              sid!,
              userId,
              {
                sessionOverride: { cookies: storedCookies, external_shop_id },
              },
            );
            if (DEBUG_CE || process.env.DEBUG_COUPANG_EATS_STORE_NAME === "1") {
              if (store_name)
                logWithSlot(
                  "[worker] coupang_eats_sync store_name",
                  store_name,
                );
              else
                logWithSlot("[worker] coupang_eats_sync store_name not found");
            }
            if (DEBUG_CE)
              logWithSlot("[worker] coupang_eats_sync done (stored session)", {
                listLength: list.length,
              });
            return { success: true, result: { list, store_name } };
          } catch (e) {
            warnWithSlot(
              "[worker] coupang_eats_sync stored session failed, re-login",
              String(e),
            );
          }
        }

        const { getStoredCredentials } =
          await import("../src/lib/services/platform-session-service");
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        if (DEBUG_CE) logWithSlot("[worker] coupang_eats_sync re-login path");
        const { loginCoupangEatsAndGetCookies } =
          await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
        const { saveCoupangEatsSession } =
          await import("../src/lib/services/coupang-eats/coupang-eats-session-service");
        const { cookies, external_shop_id: newExternalId } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: newExternalId ?? undefined,
        });
        const { list, store_name } = await fetchAllCoupangEatsReviews(
          sid!,
          userId,
          {
            sessionOverride: { cookies, external_shop_id: newExternalId },
          },
        );
        if (DEBUG_CE || process.env.DEBUG_COUPANG_EATS_STORE_NAME === "1") {
          if (store_name)
            logWithSlot("[worker] coupang_eats_sync store_name", store_name);
          else logWithSlot("[worker] coupang_eats_sync store_name not found");
        }
        if (DEBUG_CE)
          logWithSlot("[worker] coupang_eats_sync done (after re-login)", {
            listLength: list.length,
          });
        return { success: true, result: { list, store_name } };
      }
      case "yogiyo_link": {
        const { loginYogiyoAndGetCookies } =
          await import("../src/lib/services/yogiyo/yogiyo-login-service");
        const {
          cookies,
          external_shop_id,
          business_registration_number,
          shop_category,
        } = await loginYogiyoAndGetCookies(
          String(payload.username ?? ""),
          String(payload.password ?? ""),
        );
        return {
          success: true,
          result: {
            cookies,
            external_shop_id,
            business_registration_number,
            shop_category,
          },
        };
      }
      case "yogiyo_sync": {
        const { fetchAllYogiyoReviews, fetchYogiyoStoreName } =
          await import("../src/lib/services/yogiyo/yogiyo-review-service");
        const { list } = await fetchAllYogiyoReviews(sid!, userId);
        const store_name =
          (await fetchYogiyoStoreName(sid!, userId)) ?? undefined;
        return { success: true, result: { list, store_name } };
      }
      case "ddangyo_link": {
        const { loginDdangyoAndGetCookies } =
          await import("../src/lib/services/ddangyo/ddangyo-login-service");
        const linkResult = await loginDdangyoAndGetCookies(
          String(payload.username ?? ""),
          String(payload.password ?? ""),
        );
        return {
          success: true,
          result: {
            cookies: linkResult.cookies,
            external_shop_id: linkResult.external_shop_id,
            external_user_id: linkResult.external_user_id ?? null,
            business_registration_number:
              linkResult.business_registration_number ?? null,
            shop_category: linkResult.shop_category ?? null,
          },
        };
      }
      case "ddangyo_sync": {
        const { fetchAllDdangyoReviews, fetchDdangyoStoreName } =
          await import("../src/lib/services/ddangyo/ddangyo-review-service");
        const { list } = await fetchAllDdangyoReviews(sid!, userId);
        const store_name =
          (await fetchDdangyoStoreName(sid!, userId)) ?? undefined;
        return { success: true, result: { list, store_name } };
      }
      case "internal_auto_register_draft": {
        const res = await fetch(
          `${SERVER_URL}/api/worker/execute-internal-draft`,
          {
            method: "POST",
            headers: authHeaders(),
            body: JSON.stringify({ jobId }),
          },
        );
        const data = (await res.json()) as {
          success?: boolean;
          errorMessage?: string;
        };
        if (res.ok && data.success) {
          return { success: true, result: {} };
        }
        return {
          success: false,
          errorMessage: data.errorMessage ?? `API ${res.status}`,
        };
      }
      case "auto_register_post_sync": {
        const platformRaw = payload.platform;
        const platform =
          platformRaw === "baemin" ||
          platformRaw === "yogiyo" ||
          platformRaw === "ddangyo" ||
          platformRaw === "coupang_eats"
            ? platformRaw
            : null;
        if (!platform) {
          return {
            success: false,
            errorMessage: "payload.platform must be baemin|yogiyo|ddangyo|coupang_eats",
          };
        }
        logWithSlot("[worker][auto_register_post_sync] 시작 (초안 생성·DB 저장 후 register job 생성, 수 분 걸릴 수 있음)", {
          jobId,
          platform,
          storeId: sid,
        });
        const { runAutoRegisterPostSyncPipeline } =
          await import("../src/lib/services/auto-register-post-sync-service");
        const stats = await runAutoRegisterPostSyncPipeline(
          sid!,
          platform,
          userId,
        );
        logWithSlot("[worker][auto_register_post_sync] 완료", {
          jobId,
          platform,
          ...stats,
        });
        return { success: true, result: stats };
      }
      default:
        return { success: false, errorMessage: `Unknown job type: ${type}` };
    }
  } catch (e) {
    const debug = toErrorDebugInfo(e);
    const storeLogEx = await getWorkerJobStoreLogFields(sid, userId, type, payload);
    errorWithSlot("[worker][runJob][exception]", {
      jobId,
      type,
      storeId: sid,
      userId,
      ...storeLogEx,
      payloadKeys: Object.keys(payload ?? {}),
      error: debug,
    });
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "CANCELLED") {
      return { success: false, errorMessage: "사용자에 의해 취소됨" };
    }
    return { success: false, errorMessage: msg };
  }
}

/** 배치 실행: 같은 (store_id, type, user_id) job들을 한 브라우저(또는 API만)에서 순차 처리. */
async function runBatch(
  jobs: JobClaim[],
  slotIndex: number = -1,
  storeLogFields?: WorkerJobStoreLogFields | null,
): Promise<void> {
  if (jobs.length === 0) return;
  const type = jobs[0].type;
  const storeId = jobs[0].store_id;
  const userId = jobs[0].user_id;
  const batchStoreLog =
    storeLogFields ??
    (storeId != null
      ? await getWorkerJobStoreLogFields(storeId, userId, type, jobs[0].payload)
      : null);
  const batchLogExtras = batchStoreLog ?? {};
  if (storeId == null) {
    for (const job of jobs) {
      const outcome = await runJobWithBrowserClosedRetry(
        job.type,
        job.store_id,
        job.user_id,
        job.payload,
        job.id,
      );
      await submitResult(
        job.id,
        outcome.success,
        outcome.result,
        outcome.errorMessage,
      ).catch(() => {});
    }
    return;
  }

  const submitOne = async (
    jobId: string,
    success: boolean,
    result?: Record<string, unknown>,
    errorMessage?: string,
  ) => {
    if (!success && errorMessage && isBrowserClosedError(errorMessage)) {
      errorMessage = BROWSER_CLOSED_USER_MESSAGE;
    }
    try {
      await submitResult(jobId, success, result, errorMessage);
    } catch (e) {
      errorWithSlot("[worker] submit result error", jobId, e);
    }
  };

  if (type === "baemin_register_reply") {
    const { getStoredCredentials } =
      await import("../src/lib/services/platform-session-service");
    const { loginBaeminAndGetCookies } =
      await import("../src/lib/services/baemin/baemin-login-service");
    const creds = await getStoredCredentials(storeId, "baemin");
    if (!creds) {
      for (const job of jobs) {
        await submitOne(job.id, false, undefined, "배민 연동 정보가 없습니다.");
      }
      return;
    }
    const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
      creds.username,
      creds.password,
    );
    if (!baeminShopId) {
      for (const job of jobs) {
        await submitOne(
          job.id,
          false,
          undefined,
          "배민 가게 정보를 가져오지 못했습니다.",
        );
      }
      return;
    }
    const { createBaeminRegisterReplySession, doOneBaeminRegisterReply } =
      await import("../src/lib/services/baemin/baemin-register-reply-service");
    const session = await createBaeminRegisterReplySession(storeId, userId, {
      cookies,
      shopNo: baeminShopId,
    });
    try {
      for (const job of jobs) {
        if (await isJobCancelled(job.id)) continue;
        const payload = job.payload;
        try {
          await doOneBaeminRegisterReply(session.page, session.shopNo, {
            reviewExternalId: String(payload.external_id ?? ""),
            content: String(payload.content ?? ""),
            written_at: (payload.written_at as string | undefined) ?? null,
          });
          await submitOne(job.id, true, {
            reviewId: payload.reviewId ?? payload.review_id ?? null,
            content: String(payload.content ?? ""),
          });
        } catch (e) {
          errorWithSlot(
            "[worker][batch][baemin_register_reply][doOne-failed]",
            {
              jobId: job.id,
              type: job.type,
              storeId,
              userId,
              ...batchLogExtras,
              error: toErrorDebugInfo(e),
            },
          );
          if (isBrowserClosedError(e)) {
            try {
              await session.close();
            } catch {}
            try {
              const session2 = await createBaeminRegisterReplySession(
                storeId,
                userId,
                { cookies, shopNo: baeminShopId },
              );
              try {
                await doOneBaeminRegisterReply(session2.page, session2.shopNo, {
                  reviewExternalId: String(payload.external_id ?? ""),
                  content: String(payload.content ?? ""),
                  written_at:
                    (payload.written_at as string | undefined) ?? null,
                });
                await submitOne(job.id, true, {
                  reviewId: payload.reviewId ?? payload.review_id ?? null,
                  content: String(payload.content ?? ""),
                });
              } finally {
                await session2.close();
              }
            } catch (e2) {
              errorWithSlot(
                "[worker][batch][baemin_register_reply][retry-failed]",
                {
                  jobId: job.id,
                  type: job.type,
                  storeId,
                  userId,
                  ...batchLogExtras,
                  error: toErrorDebugInfo(e2),
                },
              );
              await submitOne(
                job.id,
                false,
                undefined,
                isBrowserClosedError(e2)
                  ? BROWSER_CLOSED_USER_MESSAGE
                  : e2 instanceof Error
                    ? e2.message
                    : String(e2),
              );
            }
          } else {
            await submitOne(
              job.id,
              false,
              undefined,
              e instanceof Error ? e.message : String(e),
            );
          }
        }
      }
    } finally {
      await session.close();
    }
    return;
  }

  if (type === "coupang_eats_register_reply") {
    const { getStoredCredentials } =
      await import("../src/lib/services/platform-session-service");
    const { loginCoupangEatsAndGetCookies } =
      await import("../src/lib/services/coupang-eats/coupang-eats-login-service");
    const { saveCoupangEatsSession } =
      await import("../src/lib/services/coupang-eats/coupang-eats-session-service");
    const creds = await getStoredCredentials(storeId, "coupang_eats");
    const {
      createCoupangEatsRegisterReplySession,
      doOneCoupangEatsRegisterReply,
    } =
      await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
    let session: Awaited<
      ReturnType<typeof createCoupangEatsRegisterReplySession>
    > | null = null;
    try {
      // sync와 동일: 저장 세션으로 먼저 시도
      session = await createCoupangEatsRegisterReplySession(storeId, userId);
    } catch (storedErr) {
      warnWithSlot(
        "[worker] coupang_eats_register_reply batch stored session failed, re-login",
        { storeId, userId, ...batchLogExtras, error: toErrorDebugInfo(storedErr) },
      );
      if (!creds) {
        for (const job of jobs) {
          await submitOne(
            job.id,
            false,
            undefined,
            "쿠팡이츠 연동 정보가 없습니다.",
          );
        }
        return;
      }
      const { cookies, external_shop_id } = await loginCoupangEatsAndGetCookies(
        creds.username,
        creds.password,
      );
      await saveCoupangEatsSession(storeId, userId, cookies, {
        externalShopId: external_shop_id ?? undefined,
      });
      session = await createCoupangEatsRegisterReplySession(storeId, userId, {
        cookies,
        external_shop_id: external_shop_id ?? null,
      });
    }
    if (!session) {
      for (const job of jobs) {
        await submitOne(
          job.id,
          false,
          undefined,
          "쿠팡이츠 세션 생성에 실패했습니다.",
        );
      }
      return;
    }
    try {
      for (const job of jobs) {
        if (await isJobCancelled(job.id)) continue;
        const payload = job.payload;
        try {
          const oneResult = await doOneCoupangEatsRegisterReply(
            session.page,
            session.externalStoreId,
            {
              reviewExternalId: String(payload.external_id ?? ""),
              content: String(payload.content ?? ""),
              written_at: (payload.written_at as string | undefined) ?? null,
            },
          );
          await submitOne(job.id, true, {
            reviewId: payload.reviewId ?? payload.review_id ?? null,
            content: String(payload.content ?? ""),
            ...(oneResult?.orderReviewReplyId != null && {
              orderReviewReplyId: oneResult.orderReviewReplyId,
            }),
          });
        } catch (e) {
          errorWithSlot(
            "[worker][batch][coupang_eats_register_reply][doOne-failed]",
            {
              jobId: job.id,
              type: job.type,
              storeId,
              userId,
              ...batchLogExtras,
              error: toErrorDebugInfo(e),
            },
          );
          if (isBrowserClosedError(e)) {
            try {
              await session.close();
            } catch {}
            try {
              if (!creds) {
                throw new Error(
                  "쿠팡이츠 연동 정보가 없습니다. 재로그인 재시도를 할 수 없습니다.",
                );
              }
              const { cookies: cookies2, external_shop_id: external_shop_id2 } =
                await loginCoupangEatsAndGetCookies(
                  creds.username,
                  creds.password,
                );
              await saveCoupangEatsSession(storeId, userId, cookies2, {
                externalShopId: external_shop_id2 ?? undefined,
              });
              const session2 = await createCoupangEatsRegisterReplySession(
                storeId,
                userId,
                {
                  cookies: cookies2,
                  external_shop_id: external_shop_id2 ?? null,
                },
              );
              try {
                const oneResult = await doOneCoupangEatsRegisterReply(
                  session2.page,
                  session2.externalStoreId,
                  {
                    reviewExternalId: String(payload.external_id ?? ""),
                    content: String(payload.content ?? ""),
                    written_at:
                      (payload.written_at as string | undefined) ?? null,
                  },
                );
                await submitOne(job.id, true, {
                  reviewId: payload.reviewId ?? payload.review_id ?? null,
                  content: String(payload.content ?? ""),
                  ...(oneResult?.orderReviewReplyId != null && {
                    orderReviewReplyId: oneResult.orderReviewReplyId,
                  }),
                });
              } finally {
                await session2.close();
              }
            } catch (e2) {
              errorWithSlot(
                "[worker][batch][coupang_eats_register_reply][retry-failed]",
                {
                  jobId: job.id,
                  type: job.type,
                  storeId,
                  userId,
                  ...batchLogExtras,
                  error: toErrorDebugInfo(e2),
                },
              );
              await submitOne(
                job.id,
                false,
                undefined,
                isBrowserClosedError(e2)
                  ? BROWSER_CLOSED_USER_MESSAGE
                  : e2 instanceof Error
                    ? e2.message
                    : String(e2),
              );
            }
          } else {
            await submitOne(
              job.id,
              false,
              undefined,
              e instanceof Error ? e.message : String(e),
            );
          }
        }
      }
    } finally {
      await session.close();
    }
    return;
  }

  if (type === "yogiyo_register_reply" || type === "ddangyo_register_reply") {
    for (const job of jobs) {
      if (await isJobCancelled(job.id)) continue;
      const outcome = await runJobWithBrowserClosedRetry(
        job.type,
        job.store_id,
        job.user_id,
        job.payload,
        job.id,
      );
      await submitOne(
        job.id,
        outcome.success,
        outcome.result,
        outcome.errorMessage,
      );
    }
    return;
  }

  if (type === "auto_register_post_sync" && jobs.length > 1) {
    logWithSlot(
      "[worker][batch] auto_register_post_sync",
      jobs.length,
      "건 순차 처리 중 (플랫폼별 Gemini·job 생성 — 슬롯 번호와 무관, 첫 job payload.platform만 배치 헤더에 표시됨)",
    );
  }

  for (const job of jobs) {
    const outcome = await runJobWithRetries(
      job.type,
      job.store_id,
      job.user_id,
      job.payload,
      job.id,
    );
    await submitOne(
      job.id,
      outcome.success,
      outcome.result,
      outcome.errorMessage,
    );
  }
}

async function loop(
  slotIndex: number = -1,
  slotPlatform: SlotPlatform | null = null,
): Promise<void> {
  if (!WORKER_SECRET) {
    errorWithSlot("[worker] WORKER_SECRET not set. Set env and restart.");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    return;
  }

  const workerIdForClaim =
    slotIndex >= 0 ? `${WORKER_ID}-slot-${slotIndex}` : WORKER_ID;
  let jobs: JobClaim[] = [];
  const maxClaimRetries = 3;
  for (let attempt = 1; attempt <= maxClaimRetries; attempt++) {
    try {
      jobs = await claimJobBatch(workerIdForClaim, slotPlatform);
      // 플랫폼 슬롯(baemin_ 등)만 보면 auto_register_post_sync·internal_auto_register_draft가 절대 안 잡힘 → 비었을 때 internal 큐 시도
      if (jobs.length === 0 && slotPlatform != null) {
        jobs = await claimJobBatch(workerIdForClaim, "internal");
      }
      break;
    } catch (e: unknown) {
      const retriable = isRetriableNetworkError(e);
      const logSlotOnly = slotIndex <= 0; // 슬롯 0 또는 단일 워커일 때만 로그 (중복 방지)
      if (retriable && attempt < maxClaimRetries) {
        const delayMs = 1000 * attempt;
        if (logSlotOnly) {
          warnWithSlot(
            "[worker] claim failed (ECONNRESET/서버 재시작 등),",
            delayMs / 1000,
            "초 후 재시도",
            attempt + 1,
            "/",
            maxClaimRetries,
          );
        }
        await new Promise((r) => setTimeout(r, delayMs));
      } else if (retriable) {
        if (logSlotOnly) {
          warnWithSlot(
            "[worker] server unreachable after retries, retry in",
            POLL_INTERVAL_MS / 1000,
            "s",
          );
        }
      } else {
        if (logSlotOnly) errorWithSlot("[worker] claim batch error", e);
      }
      if (attempt === maxClaimRetries) jobs = [];
    }
  }

  if (jobs.length === 0) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    return;
  }

  if (measureMemory.isEnabled() && slotIndex <= 0) {
    measureMemory.sample("before_work");
  }

  if (jobs.length === 1) {
    const job = jobs[0];
    const jobStoreLog = await getWorkerJobStoreLogFields(
      job.store_id,
      job.user_id,
      job.type,
      job.payload,
    );
    logWithSlot("[worker] job", {
      jobId: job.id,
      type: job.type,
      storeId: job.store_id,
      userId: job.user_id,
      ...jobStoreLog,
    });
    const outcome = await runJobWithRetries(
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
        warnWithSlot(
          "[worker] server unreachable, result NOT submitted for",
          job.id,
        );
      } else {
        errorWithSlot("[worker] submit result error (result NOT submitted)", e);
      }
    }
    if (outcome.success && resultSubmitted) {
      logWithSlot("[worker] completed", {
        jobId: job.id,
        type: job.type,
        storeId: job.store_id,
        userId: job.user_id,
        ...jobStoreLog,
      });
    } else if (!outcome.success) {
      errorWithSlot("[worker] failed", {
        jobId: job.id,
        type: job.type,
        storeId: job.store_id,
        userId: job.user_id,
        ...jobStoreLog,
        errorMessage: outcome.errorMessage,
      });
    }
    if (measureMemory.isEnabled() && slotIndex <= 0) {
      measureMemory.sample("after_work");
      memoryDebugCycles += 1;
      if (memoryDebugCycles % 1 === 0) {
        measureMemory.logSummary();
        measureMemory.reset();
      }
    }
    return;
  }

  const batchStoreLog = await getWorkerJobStoreLogFields(
    jobs[0].store_id,
    jobs[0].user_id,
    jobs[0].type,
    jobs[0].payload,
  );
  logWithSlot("[worker] batch", {
    count: jobs.length,
    type: jobs[0].type,
    storeId: jobs[0].store_id,
    userId: jobs[0].user_id,
    ...batchStoreLog,
  });
  await runBatch(jobs, slotIndex, batchStoreLog);
  if (measureMemory.isEnabled() && slotIndex <= 0) {
    measureMemory.sample("after_work");
    memoryDebugCycles += 1;
    if (memoryDebugCycles % 1 === 0) {
      measureMemory.logSummary();
      measureMemory.reset();
    }
  }
}

const WORKER_CONCURRENCY = Math.min(
  10,
  Math.max(1, parseInt(process.env.WORKER_CONCURRENCY ?? "1", 10) || 1),
);

async function workerMain(): Promise<void> {
  const effectiveConcurrency = Math.min(
    WORKER_CONCURRENCY,
    SLOT_PLATFORM_ORDER.length,
  );
  logWithSlot("[worker] start", {
    SERVER_URL,
    WORKER_ID,
    concurrency: WORKER_CONCURRENCY,
    effectiveConcurrency,
  });
  if (WORKER_CONCURRENCY <= 1) {
    await slotLogStore.run(-1, async () => {
      for (;;) await loop();
    });
    return;
  }
  await Promise.all(
    Array.from({ length: effectiveConcurrency }, (_, i) =>
      slotLogStore.run(i, async () => {
        const slotPlatform = SLOT_PLATFORM_ORDER[i] ?? null;
        logWithSlot("[worker] slot assigned", slotPlatform ?? "all");
        for (;;) await loop(i, slotPlatform);
      }),
    ),
  );
}

function onExit(): void {
  if (measureMemory.isEnabled()) {
    measureMemory.logSummary("[worker-memory] exit summary");
  }
}

process.on("SIGINT", onExit);
process.on("SIGTERM", onExit);

workerMain().catch((e) => {
  errorWithSlot(e);
  process.exit(1);
});
