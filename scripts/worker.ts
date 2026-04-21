import { AsyncLocalStorage } from "node:async_hooks";
import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";

import {
  getWorkerJobStoreLogFields,
  type WorkerJobStoreLogFields,
} from "@/lib/services/worker-job-store-log";
import {
  loginBaeminAndGetCookies,
  omitBaeminSessionAllShopNosHint,
  type LoginBaeminOptions,
} from "@/lib/services/baemin/baemin-login-service";
import { fetchBaeminReviewViaBrowser } from "@/lib/services/baemin/baemin-browser-review-service";
import { normalizeBaeminShopCategoryLabel } from "@/lib/services/baemin/baemin-shop-option-label";
import { mergeBaeminLinkOptionsWithV4OrdersSmoke } from "@/lib/services/baemin/baemin-orders-fetch";
import {
  getBaeminWorkerLoginHints,
  getStoredCredentials,
} from "@/lib/services/platform-session-service";
import { decryptCookieJson } from "@/lib/utils/cookie-encrypt";
import { getCredentialsFromLinkJobPayload } from "@/lib/utils/link-job-payload-credentials";
import { resolveBaeminShopNoForReplyJob } from "@/lib/services/baemin/resolve-baemin-shop-no-for-reply-job";
import { resolveCoupangEatsShopNoForReplyJob } from "@/lib/services/coupang-eats/resolve-coupang-eats-shop-for-reply-job";
import {
  registerBaeminReplyViaBrowser,
  modifyBaeminReplyViaBrowser,
  deleteBaeminReplyViaBrowser,
  createBaeminRegisterReplySession,
  doOneBaeminRegisterReply,
  isBaeminReplyDomExtractCorrupted,
} from "@/lib/services/baemin/baemin-register-reply-service";
import {
  registerYogiyoReplyViaApi,
  getYogiyoReplyIdFromList,
  modifyYogiyoReplyViaApi,
  deleteYogiyoReplyViaApi,
} from "@/lib/services/yogiyo/yogiyo-reply-api";
import {
  registerDdangyoReplyViaApi,
  getDdangyoRplyInfoFromList,
  modifyDdangyoReplyViaApi,
  deleteDdangyoReplyViaApi,
} from "@/lib/services/ddangyo/ddangyo-reply-api";
import {
  registerCoupangEatsReplyViaBrowser,
  modifyCoupangEatsReplyViaBrowser,
  deleteCoupangEatsReplyViaBrowser,
  createCoupangEatsRegisterReplySession,
  doOneCoupangEatsRegisterReply,
  shouldCoupangEatsRegisterReplySkipRelogin,
} from "@/lib/services/coupang-eats/coupang-eats-register-reply-service";
import { loginCoupangEatsAndGetCookies } from "@/lib/services/coupang-eats/coupang-eats-login-service";
import {
  saveCoupangEatsSession,
  getCoupangEatsCookies,
  getCoupangEatsStoreId,
} from "@/lib/services/coupang-eats/coupang-eats-session-service";
import { fetchAllCoupangEatsReviews } from "@/lib/services/coupang-eats/coupang-eats-review-service";
import { loginYogiyoAndGetCookies } from "@/lib/services/yogiyo/yogiyo-login-service";
import { getYogiyoVendorId } from "@/lib/services/yogiyo/yogiyo-session-service";
import { resolveYogiyoVendorIdForReplyJob } from "@/lib/services/yogiyo/resolve-yogiyo-vendor-for-reply-job";
import {
  fetchAllYogiyoReviews,
  fetchYogiyoStoreName,
} from "@/lib/services/yogiyo/yogiyo-review-service";
import { loginDdangyoAndGetCookies } from "@/lib/services/ddangyo/ddangyo-login-service";
import { getDdangyoPatstoNo } from "@/lib/services/ddangyo/ddangyo-session-service";
import { resolveDdangyoPatstoForReplyJob } from "@/lib/services/ddangyo/resolve-ddangyo-patsto-for-reply-job";
import {
  fetchAllDdangyoReviews,
  fetchDdangyoStoreName,
  upsertDdangyoStorePlatformShopsFromContract,
} from "@/lib/services/ddangyo/ddangyo-review-service";
import { runAutoRegisterPostSyncPipeline } from "@/lib/services/auto-register-post-sync-service";

/**
 * 로컬 워커: 서버에서 pending 작업을 가져와 Playwright로 실행 후 결과 제출.
 * 개발/프로덕션 동일하게 사용. 24시간 상시 실행 권장 (systemd, PM2 등).
 *
 * env: .env.local 또는 SERVER_URL, WORKER_SECRET, WORKER_ID(선택), NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * 선택: WORKER_JOB_FAMILY=orders | reviews (DB 마이그레이션 066 이후). 리뷰/주문 프로세스를 나눌 때
 *       WORKER_LOCK_FILE·WORKER_ID 를 프로세스마다 다르게 할 것(기본 락은 단일 인스턴스용).
 * 주문 동기화 상세 로그: WORKER_VERBOSE=1 또는 ORDERS_SYNC_VERBOSE=1 (요기요·땡겨요 페이지/매장 진행, 배민은 기존 v4 로그에 추가 안내).
 * run: npm run worker  또는  npx tsx scripts/worker.ts  (node로 직접 실행 시 모듈 해석 실패)
 *
 * PM2·쉘에서 이미 넣은 WORKER_JOB_FAMILY / WORKER_ID / WORKER_LOCK_FILE 은 dotenv 이후에도 유지한다.
 * (.env.local 이 동일 키를 두면 PM2 쪽이 우선 — 리뷰/주문 분리 시 ecosystem env 가 덮이지 않게)
 */
const WORKER_ENV_PRESERVE_KEYS = [
  "WORKER_JOB_FAMILY",
  "WORKER_ID",
  "WORKER_LOCK_FILE",
] as const;
function readWorkerEnvSnapshot(): Partial<
  Record<(typeof WORKER_ENV_PRESERVE_KEYS)[number], string>
> {
  const out: Partial<
    Record<(typeof WORKER_ENV_PRESERVE_KEYS)[number], string>
  > = {};
  for (const k of WORKER_ENV_PRESERVE_KEYS) {
    const v = process.env[k];
    if (v !== undefined && v !== "") out[k] = v;
  }
  return out;
}
function applyWorkerEnvSnapshot(
  snap: Partial<Record<(typeof WORKER_ENV_PRESERVE_KEYS)[number], string>>,
): void {
  for (const [k, v] of Object.entries(snap)) {
    if (v !== undefined) process.env[k] = v;
  }
}

const workerEnvBeforeDotenv = readWorkerEnvSnapshot();
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  // dotenv 없으면 env는 이미 설정된 값 사용
}
applyWorkerEnvSnapshot(workerEnvBeforeDotenv);
process.env.WORKER_MODE = "1";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:3000";
const WORKER_SECRET = process.env.WORKER_SECRET ?? "";
const WORKER_ID = process.env.WORKER_ID ?? "local-1";
/** 기본 폴링 간격(ms). 잡이 있을 때·idle streak 0일 때 사용 */
const POLL_INTERVAL_MS = Math.max(
  1_000,
  Number.parseInt(process.env.WORKER_POLL_INTERVAL_MS ?? "10000", 10) || 10_000,
);
/** 연속 idle 시 백오프 상한(ms). WORKER_POLL_IDLE_MAX_MS */
const POLL_INTERVAL_IDLE_MAX_MS = Math.max(
  POLL_INTERVAL_MS,
  Number.parseInt(process.env.WORKER_POLL_IDLE_MAX_MS ?? "60000", 10) || 60_000,
);

/** 슬롯별 연속 idle(잡 없음) 횟수 — 잡 획득 시 리셋 */
const adaptiveIdleStreakBySlot = new Map<number, number>();

function resetAdaptiveIdleStreak(slotKey: number): void {
  adaptiveIdleStreakBySlot.delete(slotKey);
}

/** 연속 idle 1회분 대기(ms). base·2base·4base… 상한까지 */
function nextIdlePollSleepMs(slotKey: number): number {
  const streak = adaptiveIdleStreakBySlot.get(slotKey) ?? 0;
  const sleepMs = Math.min(
    POLL_INTERVAL_MS * 2 ** streak,
    POLL_INTERVAL_IDLE_MAX_MS,
  );
  adaptiveIdleStreakBySlot.set(slotKey, streak + 1);
  return sleepMs;
}
const WORKER_VERBOSE =
  process.env.WORKER_VERBOSE === "1" ||
  process.env.WORKER_VERBOSE?.toLowerCase() === "true";
const WORKER_LOCK_FILE =
  process.env.WORKER_LOCK_FILE ?? ".worker-single-instance.lock";
const WORKER_LOCK_TAKEOVER =
  process.env.WORKER_LOCK_TAKEOVER !== "0" &&
  process.env.WORKER_LOCK_TAKEOVER?.toLowerCase() !== "false";

/** 비우면 선점 필터 없음(기존 동작). `orders` | `reviews` 는 DB 마이그레이션 066 이후. 프로세스 두 개로 나눌 때는 `WORKER_LOCK_FILE`·`WORKER_ID` 도 각각 다르게 설정할 것. */
const WORKER_JOB_FAMILY_RAW = (process.env.WORKER_JOB_FAMILY ?? "").trim().toLowerCase();
const WORKER_JOB_FAMILY: "orders" | "reviews" | null =
  WORKER_JOB_FAMILY_RAW === ""
    ? null
    : WORKER_JOB_FAMILY_RAW === "orders" || WORKER_JOB_FAMILY_RAW === "reviews"
      ? WORKER_JOB_FAMILY_RAW
      : (() => {
          throw new Error(
            `WORKER_JOB_FAMILY must be unset, "orders", or "reviews"; got "${process.env.WORKER_JOB_FAMILY}"`,
          );
        })();

if (process.env.PM2_HOME && WORKER_JOB_FAMILY == null) {
  console.warn(
    "[worker] PM2인데 WORKER_JOB_FAMILY 비어 있음 → 모든 잡 타입 선점(단일 모드). 리뷰/주문 분리는 ecosystem env + `pm2 delete … && pm2 start …` 또는 `pm2 restart … --update-env`로 반영.",
  );
}

const execFileAsync = promisify(execFile);

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

const ESBUILD_SERVICE_DOWN_MESSAGE = "The service is no longer running";
const FATAL_EXIT_CODE = 86;

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

function isEsbuildServiceDownError(e: unknown): boolean {
  const msg =
    e instanceof Error ? e.message : typeof e === "string" ? e : String(e);
  if (msg.includes(ESBUILD_SERVICE_DOWN_MESSAGE)) return true;
  if (!(e instanceof Error)) return false;
  const stack = e.stack ?? "";
  return e.name === "TransformError" && stack.includes("esbuild\\lib\\main.js");
}

class FatalWorkerRuntimeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FatalWorkerRuntimeError";
  }
}

const HAS_SUPERVISOR =
  process.env.pm_id != null ||
  process.env.PM2_HOME != null ||
  process.env.INVOCATION_ID != null ||
  process.env.SYSTEMD_EXEC_PID != null;
const FATAL_RESTART_BASE_DELAY_MS = 3_000;
const FATAL_RESTART_MAX_DELAY_MS = 60_000;
const FATAL_RESTART_MAX_ATTEMPTS_WITHOUT_SUPERVISOR =
  Number.parseInt(process.env.WORKER_FATAL_RESTART_MAX_ATTEMPTS ?? "0", 10) ||
  0; // 0이면 무제한

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function throwIfFatalRuntimeError(e: unknown, context: string): void {
  if (!isEsbuildServiceDownError(e)) return;
  errorWithSlot("[worker][fatal][esbuild-service-down]", {
    context,
    error: toErrorDebugInfo(e),
    action: "self-exit for PM2/systemd restart",
  });
  throw new FatalWorkerRuntimeError(
    "esbuild service is down; worker will exit for supervisor restart",
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
  if (isEsbuildServiceDownError(outcome.errorMessage ?? "")) {
    throw new FatalWorkerRuntimeError(
      "esbuild service is down; worker will exit for supervisor restart",
    );
  }
  if (outcome.success || !isBrowserClosedError(outcome.errorMessage ?? "")) {
    return outcome;
  }
  const storeLog = await getWorkerJobStoreLogFields(
    storeId,
    userId,
    type,
    payload,
  );
  errorWithSlot("[worker][browser-closed][first-attempt]", {
    jobId,
    type,
    storeId,
    userId,
    ...storeLog,
    errorMessage: outcome.errorMessage,
  });
  const retry = await runJob(type, storeId, userId, payload, jobId);
  if (isEsbuildServiceDownError(retry.errorMessage ?? "")) {
    throw new FatalWorkerRuntimeError(
      "esbuild service is down; worker will exit for supervisor restart",
    );
  }
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

/** TypeError(fetch failed) → cause(Undici) 등 중첩된 code 수집 */
function getNestedErrorCodes(e: unknown): string[] {
  const codes: string[] = [];
  let cur: unknown = e;
  for (let depth = 0; depth < 8 && cur != null; depth++) {
    if (typeof cur === "object" && cur !== null && "code" in cur) {
      const c = (cur as { code?: unknown }).code;
      if (typeof c === "string") codes.push(c);
    }
    const next =
      cur instanceof Error && cur.cause != null ? cur.cause : undefined;
    if (next === undefined) break;
    cur = next;
  }
  return codes;
}

const RETRIABLE_NETWORK_ERROR_CODES = new Set([
  "ECONNRESET",
  "ECONNREFUSED",
  "ETIMEDOUT",
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
]);

function isRetriableNetworkError(e: unknown): boolean {
  return getNestedErrorCodes(e).some((c) =>
    RETRIABLE_NETWORK_ERROR_CODES.has(c),
  );
}

/** 배치 선점: 같은 (store_id, type, user_id) job 배열 반환. 0건이면 [].
 * `platform`은 API 쿼리로 전달 — `internal`이면 internal_auto_register_draft / auto_register_post_sync만 선점.
 * `WORKER_JOB_FAMILY` 가 있으면 `jobFamily` 쿼리로 주문/리뷰 선점 분리. */
async function claimJobBatch(
  workerIdOverride?: string,
  platform?: string | null,
): Promise<JobClaim[]> {
  const workerId = workerIdOverride ?? WORKER_ID;
  const platformQuery = platform
    ? `&platform=${encodeURIComponent(platform)}`
    : "";
  const jobFamilyQuery =
    WORKER_JOB_FAMILY != null
      ? `&jobFamily=${encodeURIComponent(WORKER_JOB_FAMILY)}`
      : "";
  const res = await fetch(
    `${SERVER_URL}/api/worker/jobs/batch?workerId=${encodeURIComponent(workerId)}&limit=${BATCH_LIMIT}${platformQuery}${jobFamilyQuery}`,
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

async function submitProgress(
  jobId: string,
  resultSummary: Record<string, unknown>,
): Promise<void> {
  const url = `${SERVER_URL}/api/worker/jobs/${jobId}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ result_summary: resultSummary }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`submit progress ${res.status}: ${text}`);
  }
}

async function submitProgressSafe(
  jobId: string,
  resultSummary: Record<string, unknown>,
): Promise<void> {
  try {
    await submitProgress(jobId, resultSummary);
  } catch (e) {
    warnWithSlot("[worker] submit progress error", { jobId, error: String(e) });
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

/** DB 힌트로 배민 재로그인 시 profile / shops.search 호출 생략 */
async function baeminLoginOptionsForWorkerStore(
  storeId: string | null | undefined,
): Promise<LoginBaeminOptions> {
  if (!storeId) return {};
  const hints = await getBaeminWorkerLoginHints(storeId);
  if (!hints) return {};
  const { shop_owner_number, external_shop_id, all_shop_external_ids } = hints;
  if (
    !shop_owner_number?.trim() &&
    !external_shop_id?.trim() &&
    all_shop_external_ids.length === 0
  ) {
    return {};
  }
  return {
    sessionHints: {
      shopOwnerNumber: shop_owner_number?.trim() || undefined,
      externalShopId: external_shop_id?.trim() || undefined,
      allShopNos:
        all_shop_external_ids.length > 0 ? all_shop_external_ids : undefined,
    },
  };
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
        const enc = payload.credentials_encrypted;
        let creds = getCredentialsFromLinkJobPayload(payload);
        const credsFromJobPayload = creds != null;
        if (!creds && sid) {
          creds = await getStoredCredentials(sid, "baemin");
        }
        if (!creds) {
          const isFirstLinkAttempt =
            sid == null ||
            (typeof enc === "string" && String(enc).trim() !== "");
          return {
            success: false,
            errorMessage: isFirstLinkAttempt
              ? "아이디·비밀번호를 확인해 주세요."
              : "저장된 연동 정보가 없습니다. 다시 연동을 요청해 주세요.",
          };
        }
        try {
          const {
            cookies,
            baeminShopId,
            shopOwnerNumber,
            allShops,
            shop_category,
            businessNo,
            store_name,
          } = await loginBaeminAndGetCookies(
            creds.username,
            creds.password,
            mergeBaeminLinkOptionsWithV4OrdersSmoke(
              await baeminLoginOptionsForWorkerStore(sid),
            ),
          );
          return {
            success: true,
            result: {
              cookies,
              external_shop_id: baeminShopId,
              shop_owner_number: shopOwnerNumber,
              shops: allShops ?? [],
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
              credsFromJobPayload || sid == null
                ? "아이디·비밀번호를 확인해 주세요."
                : isIdPwError
                  ? "저장된 연동 정보가 없습니다. 다시 연동을 요청해 주세요."
                  : msg,
          };
        }
      }
      case "baemin_orders_sync": {
        const ordersWindow: "initial" | "previous_kst_day" =
          payload.ordersWindow === "previous_kst_day"
            ? "previous_kst_day"
            : "initial";
        const { runBaeminOrdersSyncJob } = await import(
          "@/lib/services/baemin/baemin-orders-sync-run"
        );
        const out = await runBaeminOrdersSyncJob({
          storeId: sid!,
          ordersWindow,
        });
        logWithSlot("[worker] baemin_orders_sync done", {
          jobId,
          ordersWindow,
          range: out.range,
          platform_orders_upserted: out.platform_orders_upserted,
          fetchedCount: out.fetchedCount,
          warnings_count: out.warnings.length,
        });
        return {
          success: true,
          result: out as unknown as Record<string, unknown>,
        };
      }
      case "baemin_sync": {
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const manualBaeminSync = String(payload.trigger ?? "") === "manual";
        let baeminLoginOpts = await baeminLoginOptionsForWorkerStore(sid!);
        if (manualBaeminSync) {
          baeminLoginOpts = omitBaeminSessionAllShopNosHint(baeminLoginOpts);
        }
        const { cookies, baeminShopId, allShopNos, allShops, store_name } =
          await loginBaeminAndGetCookies(
            creds.username,
            creds.password,
            baeminLoginOpts,
          );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }

        const shopNos =
          allShopNos.length > 0 ? [...allShopNos] : [baeminShopId];

        const mergedReviews: unknown[] = [];
        let shopCategoryOut: string | undefined;
        const metaByShop = new Map<
          string,
          { shop_name?: string; shop_category?: string }
        >();

        for (const shopNo of shopNos) {
          if (await isJobCancelled(jobId)) {
            return {
              success: false,
              errorMessage: "사용자에 의해 취소됨",
            };
          }
          const { list, shop_category, shop_name } =
            await fetchBaeminReviewViaBrowser(
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
                sessionOverride: { cookies, shopNo },
              },
            );
          const fromLoginShop = allShops?.find((s) => s.shopNo === shopNo);
          const categoryFromLogin =
            fromLoginShop?.shopCategory != null &&
            String(fromLoginShop.shopCategory).trim() !== ""
              ? normalizeBaeminShopCategoryLabel(
                  String(fromLoginShop.shopCategory),
                )
              : undefined;
          const rawBrowserCategory =
            typeof shop_category === "string" && shop_category.trim() !== ""
              ? shop_category.trim()
              : undefined;
          /** 리뷰 페이지 option 파싱값을 한 번 더 정규화(컴팩트·레거시 혼합 문자열 방지) */
          const normalizedBrowserCategory = rawBrowserCategory
            ? normalizeBaeminShopCategoryLabel(rawBrowserCategory)
            : undefined;
          const effectiveCategory =
            normalizedBrowserCategory ?? categoryFromLogin;

          const nameFromLogin =
            fromLoginShop?.shopName != null &&
            String(fromLoginShop.shopName).trim() !== ""
              ? String(fromLoginShop.shopName).trim()
              : undefined;
          const effectiveShopName =
            typeof shop_name === "string" && shop_name.trim() !== ""
              ? shop_name.trim()
              : nameFromLogin;

          const cur = metaByShop.get(shopNo) ?? {};
          if (effectiveCategory) {
            cur.shop_category = effectiveCategory;
          }
          if (effectiveShopName) {
            cur.shop_name = effectiveShopName;
          }
          metaByShop.set(shopNo, cur);
          if (
            effectiveCategory &&
            (shopNo === baeminShopId || shopCategoryOut == null)
          ) {
            shopCategoryOut = effectiveCategory;
          }
          for (const r of list?.reviews ?? []) {
            const base =
              typeof r === "object" && r !== null
                ? { ...(r as Record<string, unknown>) }
                : { value: r as unknown };
            (base as Record<string, unknown>).platform_shop_external_id =
              shopNo;
            mergedReviews.push(base);
          }
        }

        const shopsPayload = shopNos.map((shopNo) => {
          const fromLogin = allShops?.find((s) => s.shopNo === shopNo);
          const m = metaByShop.get(shopNo);
          const categoryFromLoginRaw =
            fromLogin?.shopCategory != null &&
            String(fromLogin.shopCategory).trim() !== ""
              ? String(fromLogin.shopCategory).trim()
              : undefined;
          const categoryFromLogin = categoryFromLoginRaw
            ? normalizeBaeminShopCategoryLabel(categoryFromLoginRaw)
            : undefined;
          const shopCategoryPayload =
            m?.shop_category ?? categoryFromLogin ?? undefined;
          return {
            shopNo,
            shopName: m?.shop_name ?? fromLogin?.shopName ?? undefined,
            shop_category: shopCategoryPayload
              ? normalizeBaeminShopCategoryLabel(shopCategoryPayload)
              : undefined,
          };
        });

        return {
          success: true,
          result: {
            list: { reviews: mergedReviews },
            reviews: mergedReviews,
            shops: shopsPayload,
            external_shop_id: baeminShopId,
            shop_category: shopCategoryOut,
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
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
          creds.username,
          creds.password,
          await baeminLoginOptionsForWorkerStore(sid!),
        );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const shopNo = await resolveBaeminShopNoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          baeminShopId,
        );
        if (!shopNo) {
          return {
            success: false,
            errorMessage: "배민 가게 번호(shopNo)를 확인할 수 없습니다.",
          };
        }
        const shouldSkipRetry = (msg: string): boolean => {
          // 숨김/차단/정책류는 재시도 의미 없음
          if (
            /파트너님에게만\s*보이는|허위\s*리뷰|허위리뷰|의심|숨김|권한|제한/i.test(
              msg,
            )
          )
            return true;
          // 등록 버튼 자체가 없으면 UI/상태 문제라 재시도로 해결될 확률 낮음
          if (/등록하기'\s*버튼을\s*찾지\s*못했습니다/i.test(msg)) return true;
          return false;
        };

        const runRegisterOnce = async (): Promise<void> => {
          await registerBaeminReplyViaBrowser(
            sid!,
            userId,
            {
              reviewExternalId: externalId,
              content,
              written_at: writtenAt ?? null,
            },
            { sessionOverride: { cookies, shopNo } },
          );
        };

        try {
          await runRegisterOnce();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (shouldSkipRetry(msg)) throw e;

          // 1회만 재시도 (UI/네트워크 흔들림 완화)
          await new Promise((r) => setTimeout(r, 12_000));
          await runRegisterOnce();
        }
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
        const yoFb = await getYogiyoVendorId(sid!, userId);
        const yoVendor = await resolveYogiyoVendorIdForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          yoFb,
        );
        if (!yoVendor) {
          return {
            success: false,
            errorMessage:
              "요기요 매장 ID(vendor)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
        const { replyId } = await registerYogiyoReplyViaApi(sid!, userId, {
          reviewId: externalId,
          content,
          vendorId: yoVendor,
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
        const dangFb = await getDdangyoPatstoNo(sid!, userId);
        const dangPatsto = await resolveDdangyoPatstoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          dangFb,
        );
        if (!dangPatsto) {
          return {
            success: false,
            errorMessage:
              "땡겨요 매장 번호(patsto_no)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
        await registerDdangyoReplyViaApi(sid!, userId, {
          rviewAtclNo: externalId,
          content,
          patstoNo: dangPatsto,
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
        const fallbackShopId = await getCoupangEatsStoreId(sid!, userId);
        const targetShopId = await resolveCoupangEatsShopNoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          fallbackShopId,
        );
        if (!targetShopId) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 매장 ID(리뷰 소속 매장)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
        // sync와 동일하게 저장 세션 우선 시도 (로그인 차단 빈도 완화)
        try {
          const storedTry = await registerCoupangEatsReplyViaBrowser(
            sid!,
            userId,
            {
              reviewExternalId: externalId,
              content,
              written_at: writtenAt ?? null,
            },
            {
              sessionOverride: { external_shop_id: targetShopId },
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
          if (shouldCoupangEatsRegisterReplySkipRelogin(storedErr)) {
            return {
              success: false,
              errorMessage:
                storedErr instanceof Error
                  ? storedErr.message
                  : String(storedErr),
            };
          }
          warnWithSlot(
            "[worker] coupang_eats_register_reply stored session failed, re-login",
            { jobId, error: toErrorDebugInfo(storedErr) },
          );
        }
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: external_shop_id ?? undefined,
        });
        const registerResult = await registerCoupangEatsReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            content,
            written_at: writtenAt ?? null,
          },
          {
            sessionOverride: {
              cookies,
              external_shop_id: targetShopId,
            },
          },
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
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: external_shop_id ?? undefined,
        });
        const fallbackShopId = external_shop_id ?? null;
        const targetShopId = await resolveCoupangEatsShopNoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          fallbackShopId,
        );
        if (!targetShopId) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 매장 ID(리뷰 소속 매장)를 확인할 수 없습니다.",
          };
        }
        await modifyCoupangEatsReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            content,
            orderReviewReplyId,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, external_shop_id: targetShopId } },
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
        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { cookies, external_shop_id } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: external_shop_id ?? undefined,
        });
        const fallbackShopId = external_shop_id ?? null;
        const targetShopId = await resolveCoupangEatsShopNoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          fallbackShopId,
        );
        if (!targetShopId) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 매장 ID(리뷰 소속 매장)를 확인할 수 없습니다.",
          };
        }
        await deleteCoupangEatsReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            orderReviewReplyId:
              Number(orderReviewReplyId) || String(orderReviewReplyId),
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, external_shop_id: targetShopId } },
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
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
          creds.username,
          creds.password,
          await baeminLoginOptionsForWorkerStore(sid!),
        );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const shopNo = await resolveBaeminShopNoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          baeminShopId,
        );
        if (!shopNo) {
          return {
            success: false,
            errorMessage: "배민 가게 번호(shopNo)를 확인할 수 없습니다.",
          };
        }
        await modifyBaeminReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            content,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, shopNo } },
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
        const creds = await getStoredCredentials(sid!, "baemin");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "배민 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        const { cookies, baeminShopId } = await loginBaeminAndGetCookies(
          creds.username,
          creds.password,
          await baeminLoginOptionsForWorkerStore(sid!),
        );
        if (!baeminShopId) {
          return {
            success: false,
            errorMessage: "배민 가게 정보를 가져오지 못했습니다.",
          };
        }
        const shopNo = await resolveBaeminShopNoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          baeminShopId,
        );
        if (!shopNo) {
          return {
            success: false,
            errorMessage: "배민 가게 번호(shopNo)를 확인할 수 없습니다.",
          };
        }
        await deleteBaeminReplyViaBrowser(
          sid!,
          userId,
          {
            reviewExternalId: externalId,
            written_at: writtenAt ?? null,
          },
          { sessionOverride: { cookies, shopNo } },
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
        const yoFbMod = await getYogiyoVendorId(sid!, userId);
        const yoVendorMod = await resolveYogiyoVendorIdForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          yoFbMod,
        );
        if (!yoVendorMod) {
          return {
            success: false,
            errorMessage:
              "요기요 매장 ID(vendor)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
        let replyIdRaw =
          payload.order_review_reply_id ?? payload.orderReviewReplyId;
        if (replyIdRaw == null || String(replyIdRaw).trim() === "") {
          const fromList = await getYogiyoReplyIdFromList(
            sid!,
            userId,
            externalId,
            { vendorId: yoVendorMod },
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
        await modifyYogiyoReplyViaApi(sid!, userId, {
          reviewId: externalId,
          replyId,
          content,
          vendorId: yoVendorMod,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "yogiyo_delete_reply": {
        const externalId = String(payload.external_id ?? "");
        const reviewId = payload.reviewId as string | undefined;
        const yoFbDel = await getYogiyoVendorId(sid!, userId);
        const yoVendorDel = await resolveYogiyoVendorIdForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          yoFbDel,
        );
        if (!yoVendorDel) {
          return {
            success: false,
            errorMessage:
              "요기요 매장 ID(vendor)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
        let replyIdRaw =
          payload.order_review_reply_id ?? payload.orderReviewReplyId;
        if (replyIdRaw == null || String(replyIdRaw).trim() === "") {
          const fromList = await getYogiyoReplyIdFromList(
            sid!,
            userId,
            externalId,
            { vendorId: yoVendorDel },
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
        await deleteYogiyoReplyViaApi(sid!, userId, {
          reviewId: externalId,
          replyId,
          vendorId: yoVendorDel,
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
        const dangFbMod = await getDdangyoPatstoNo(sid!, userId);
        const dangPatstoMod = await resolveDdangyoPatstoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          dangFbMod,
        );
        if (!dangPatstoMod) {
          return {
            success: false,
            errorMessage:
              "땡겨요 매장 번호(patsto_no)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
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
          const info = await getDdangyoRplyInfoFromList(
            sid!,
            userId,
            externalId,
            { patstoNo: dangPatstoMod },
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
        await modifyDdangyoReplyViaApi(sid!, userId, {
          rviewAtclNo: externalId,
          rplyNo,
          content,
          patstoNo: dangPatstoMod,
        });
        return {
          success: true,
          result: { reviewId: reviewId ?? null, content },
        };
      }
      case "ddangyo_delete_reply": {
        const externalId = String(payload.external_id ?? "");
        const reviewId = payload.reviewId as string | undefined;
        const dangFbDel = await getDdangyoPatstoNo(sid!, userId);
        const dangPatstoDel = await resolveDdangyoPatstoForReplyJob(
          sid!,
          payload as Record<string, unknown>,
          dangFbDel,
        );
        if (!dangPatstoDel) {
          return {
            success: false,
            errorMessage:
              "땡겨요 매장 번호(patsto_no)를 확인할 수 없습니다. 리뷰 동기화 후 다시 시도해 주세요.",
          };
        }
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
          const info = await getDdangyoRplyInfoFromList(
            sid!,
            userId,
            externalId,
            { patstoNo: dangPatstoDel },
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
        await deleteDdangyoReplyViaApi(sid!, userId, {
          rviewAtclNo: externalId,
          rplyNo,
          patstoNo: dangPatstoDel,
        });
        return { success: true, result: { reviewId: reviewId ?? null } };
      }
      case "coupang_eats_link": {
        const linkCreds = getCredentialsFromLinkJobPayload(payload);
        if (!linkCreds) {
          return {
            success: false,
            errorMessage: "아이디·비밀번호를 확인해 주세요.",
          };
        }
        const {
          cookies,
          external_shop_id,
          business_registration_number,
          shop_category,
          store_name,
          shops,
        } = await loginCoupangEatsAndGetCookies(
          linkCreds.username,
          linkCreds.password,
        );
        return {
          success: true,
          result: {
            cookies,
            external_shop_id: external_shop_id ?? undefined,
            business_registration_number: business_registration_number ?? null,
            shop_category: shop_category ?? null,
            store_name: store_name ?? null,
            shops: Array.isArray(shops) ? shops : [],
          },
        };
      }
      case "coupang_eats_sync": {
        const syncWindow =
          payload.syncWindow === "initial"
            ? ("initial" as const)
            : ("ongoing" as const);
        const DEBUG_CE = process.env.DEBUG_COUPANG_EATS_SYNC === "1";

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
            logWithSlot(
              "[worker] coupang_eats_sync fetch start (stored session)",
              {
                storeId: sid,
                externalShopId: external_shop_id,
              },
            );
            const { list, store_name, shop_sync_summaries } =
              await fetchAllCoupangEatsReviews(sid!, userId, {
                sessionOverride: { cookies: storedCookies, external_shop_id },
                syncWindow,
                onProgress: async (progress) => {
                  await submitProgress(jobId, {
                    phase: "collecting_reviews",
                    platform: "coupang_eats",
                    progress,
                  });
                },
              });
            logWithSlot(
              "[worker] coupang_eats_sync fetch done (stored session)",
              {
                listLength: list.length,
                store_name: store_name ?? null,
                shop_sync_summaries: shop_sync_summaries ?? null,
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
                shop_sync_summaries: shop_sync_summaries ?? null,
              });
            return {
              success: true,
              result: { list, store_name, shop_sync_summaries },
            };
          } catch (e) {
            warnWithSlot(
              "[worker] coupang_eats_sync stored session failed, re-login",
              String(e),
            );
          }
        }

        const creds = await getStoredCredentials(sid!, "coupang_eats");
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "쿠팡이츠 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
          };
        }
        if (DEBUG_CE) logWithSlot("[worker] coupang_eats_sync re-login path");
        const { cookies, external_shop_id: newExternalId } =
          await loginCoupangEatsAndGetCookies(creds.username, creds.password);
        await saveCoupangEatsSession(sid!, userId, cookies, {
          externalShopId: newExternalId ?? undefined,
        });
        logWithSlot(
          "[worker] coupang_eats_sync fetch start (re-login session)",
          {
            storeId: sid,
            externalShopId: newExternalId ?? null,
          },
        );
        const { list, store_name, shop_sync_summaries } =
          await fetchAllCoupangEatsReviews(sid!, userId, {
            sessionOverride: { cookies, external_shop_id: newExternalId },
            syncWindow,
            onProgress: async (progress) => {
              await submitProgress(jobId, {
                phase: "collecting_reviews",
                platform: "coupang_eats",
                progress,
              });
            },
          });
        logWithSlot(
          "[worker] coupang_eats_sync fetch done (re-login session)",
          {
            listLength: list.length,
            store_name: store_name ?? null,
            shop_sync_summaries: shop_sync_summaries ?? null,
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
            shop_sync_summaries: shop_sync_summaries ?? null,
          });
        return {
          success: true,
          result: { list, store_name, shop_sync_summaries },
        };
      }
      case "yogiyo_link": {
        const linkCreds = getCredentialsFromLinkJobPayload(payload);
        if (!linkCreds) {
          return {
            success: false,
            errorMessage: "아이디·비밀번호를 확인해 주세요.",
          };
        }
        const {
          cookies,
          external_shop_id,
          business_registration_number,
          shop_category,
          vendors,
        } = await loginYogiyoAndGetCookies(
          linkCreds.username,
          linkCreds.password,
        );
        logWithSlot("[worker] yogiyo_link session (계약 매장 목록)", {
          jobId,
          primary_external_shop_id: external_shop_id ?? null,
          contracted_vendor_count: vendors?.length ?? 0,
          vendors: vendors?.map((v) => ({ id: v.id, name: v.name })) ?? [],
          business_registration_number: business_registration_number ?? null,
          shop_category: shop_category ?? null,
        });
        return {
          success: true,
          result: {
            cookies,
            external_shop_id,
            business_registration_number,
            shop_category,
            ...(vendors != null && vendors.length > 0 ? { vendors } : {}),
          },
        };
      }
      case "yogiyo_orders_sync": {
        const ordersWindow: "initial" | "previous_kst_day" =
          payload.ordersWindow === "previous_kst_day"
            ? "previous_kst_day"
            : "initial";
        const { runYogiyoOrdersSyncJob } = await import(
          "@/lib/services/yogiyo/yogiyo-orders-sync-run"
        );
        const out = await runYogiyoOrdersSyncJob({
          storeId: sid!,
          userId,
          ordersWindow,
        });
        logWithSlot("[worker] yogiyo_orders_sync done", {
          jobId,
          ordersWindow,
          range: out.range,
          restaurant_ids: out.restaurant_ids,
          platform_orders_upserted: out.platform_orders_upserted,
          total_order_rows: out.total_order_rows,
          warnings_count: out.warnings.length,
        });
        return {
          success: true,
          result: out as unknown as Record<string, unknown>,
        };
      }
      case "ddangyo_orders_sync": {
        const ordersWindow: "initial" | "previous_kst_day" =
          payload.ordersWindow === "previous_kst_day"
            ? "previous_kst_day"
            : "initial";
        const { runDdangyoOrdersSyncJob } = await import(
          "@/lib/services/ddangyo/ddangyo-orders-sync-run"
        );
        const out = await runDdangyoOrdersSyncJob({
          storeId: sid!,
          userId,
          ordersWindow,
        });
        logWithSlot("[worker] ddangyo_orders_sync done", {
          jobId,
          ordersWindow,
          settle_range: out.settle_range,
          platform_orders_upserted: out.platform_orders_upserted,
          total_rows: out.total_rows,
          warnings_count: out.warnings.length,
        });
        return {
          success: true,
          result: out as unknown as Record<string, unknown>,
        };
      }
      case "coupang_eats_orders_sync": {
        const ordersWindow: "initial" | "previous_kst_day" =
          payload.ordersWindow === "previous_kst_day"
            ? "previous_kst_day"
            : "initial";
        const { runCoupangEatsOrdersSyncJob } = await import(
          "@/lib/services/coupang-eats/coupang-eats-orders-sync-run"
        );
        const out = await runCoupangEatsOrdersSyncJob({
          storeId: sid!,
          userId,
          ordersWindow,
        });
        logWithSlot("[worker] coupang_eats_orders_sync done", {
          jobId,
          ordersWindow,
          range: out.range,
          coupang_store_ids: out.coupang_store_ids,
          platform_orders_upserted: out.platform_orders_upserted,
          total_order_rows: out.total_order_rows,
          warnings_count: out.warnings.length,
        });
        return {
          success: true,
          result: out as unknown as Record<string, unknown>,
        };
      }
      case "yogiyo_sync": {
        const syncWindow =
          payload.syncWindow === "initial"
            ? ("initial" as const)
            : ("ongoing" as const);
        const { list, total } = await fetchAllYogiyoReviews(sid!, userId, {
          syncWindow,
        });
        const store_name =
          (await fetchYogiyoStoreName(sid!, userId)) ?? undefined;
        const byVendor = new Map<number, number>();
        for (const it of list) {
          const vid = (it as { _vendor_id?: number })._vendor_id;
          if (typeof vid === "number" && Number.isFinite(vid)) {
            byVendor.set(vid, (byVendor.get(vid) ?? 0) + 1);
          }
        }
        const vendors_sync_summary = [...byVendor.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([vendor_id, review_count]) => ({ vendor_id, review_count }));
        logWithSlot("[worker] yogiyo_sync fetched (벤더별 건수)", {
          jobId,
          synced_review_count: list.length,
          api_total_hint: total,
          vendor_count: vendors_sync_summary.length,
          vendors_sync_summary,
        });
        return {
          success: true,
          result: {
            list,
            store_name,
            synced_review_count: list.length,
            api_total_hint: total,
            vendors_sync_summary,
          },
        };
      }
      case "ddangyo_link": {
        const linkCreds = getCredentialsFromLinkJobPayload(payload);
        if (!linkCreds) {
          return {
            success: false,
            errorMessage: "아이디·비밀번호를 확인해 주세요.",
          };
        }
        const linkResult = await loginDdangyoAndGetCookies(
          linkCreds.username,
          linkCreds.password,
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
            ...(linkResult.patstos != null && linkResult.patstos.length > 0
              ? { patstos: linkResult.patstos }
              : {}),
          },
        };
      }
      case "ddangyo_sync": {
        const syncWindow =
          payload.syncWindow === "initial"
            ? ("initial" as const)
            : ("ongoing" as const);
        const { list, total, contractedPatstos } = await fetchAllDdangyoReviews(
          sid!,
          userId,
          { syncWindow },
        );
        try {
          await upsertDdangyoStorePlatformShopsFromContract(
            sid!,
            userId,
            contractedPatstos,
          );
          logWithSlot("[worker] ddangyo_sync store_platform_shops upserted", {
            jobId,
            patsto_count: contractedPatstos.length,
          });
        } catch (shopsErr) {
          logWithSlot(
            "[worker] ddangyo_sync store_platform_shops upsert failed (리뷰 목록은 반영됨)",
            {
              jobId,
              error:
                shopsErr instanceof Error ? shopsErr.message : String(shopsErr),
            },
          );
        }
        const store_name =
          (await fetchDdangyoStoreName(sid!, userId)) ?? undefined;
        const byPatsto = new Map<string, number>();
        for (const it of list) {
          const pid = (it as { _patsto_no?: string })._patsto_no;
          if (typeof pid === "string" && pid.trim()) {
            const k = pid.trim();
            byPatsto.set(k, (byPatsto.get(k) ?? 0) + 1);
          }
        }
        const patstos_sync_summary = [...byPatsto.entries()]
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([patsto_no, review_count]) => ({ patsto_no, review_count }));
        logWithSlot("[worker] ddangyo_sync fetched (매장별 건수)", {
          jobId,
          synced_review_count: list.length,
          api_total_hint: total,
          patsto_count: patstos_sync_summary.length,
          patstos_sync_summary,
        });
        return {
          success: true,
          result: {
            list,
            store_name,
            synced_review_count: list.length,
            api_total_hint: total,
            patstos_sync_summary,
          },
        };
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
            errorMessage:
              "payload.platform must be baemin|yogiyo|ddangyo|coupang_eats",
          };
        }
        logWithSlot(
          "[worker][auto_register_post_sync] 시작 (초안 생성·DB 저장 후 register job 생성, 수 분 걸릴 수 있음)",
          {
            jobId,
            platform,
            storeId: sid,
          },
        );
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
    throwIfFatalRuntimeError(e, "runJob");
    const debug = toErrorDebugInfo(e);
    const storeLogEx = await getWorkerJobStoreLogFields(
      sid,
      userId,
      type,
      payload,
    );
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
  const totalJobs = jobs.length;
  let completedJobs = 0;
  const batchStoreLog =
    storeLogFields ??
    (storeId != null
      ? await getWorkerJobStoreLogFields(storeId, userId, type, jobs[0].payload)
      : null);
  const batchLogExtras = batchStoreLog ?? {};
  if (storeId == null) {
    for (let i = 0; i < jobs.length; i++) {
      const job = jobs[i];
      await submitProgressSafe(job.id, {
        phase: "batch_processing",
        progress: {
          current_step: i + 1,
          total_steps: totalJobs,
          completed_steps: completedJobs,
          percent: Math.floor((completedJobs / totalJobs) * 100),
        },
      });
      const outcome = await runJobWithBrowserClosedRetry(
        job.type,
        job.store_id,
        job.user_id,
        job.payload,
        job.id,
      );
      completedJobs += 1;
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
    await submitProgressSafe(jobId, {
      phase: "batch_processing",
      progress: {
        current_step: completedJobs + 1,
        total_steps: totalJobs,
        completed_steps: completedJobs,
        percent: Math.floor((completedJobs / totalJobs) * 100),
      },
    });
    try {
      await submitResult(jobId, success, result, errorMessage);
      completedJobs += 1;
    } catch (e) {
      errorWithSlot("[worker] submit result error", jobId, e);
    }
  };

  if (type === "baemin_register_reply") {
    const creds = await getStoredCredentials(storeId, "baemin");
    if (!creds) {
      for (const job of jobs) {
        await submitOne(job.id, false, undefined, "배민 연동 정보가 없습니다.");
      }
      return;
    }
    let loginResult: Awaited<ReturnType<typeof loginBaeminAndGetCookies>>;
    try {
      loginResult = await loginBaeminAndGetCookies(
        creds.username,
        creds.password,
        await baeminLoginOptionsForWorkerStore(storeId),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errorWithSlot("[worker][batch][baemin_register_reply][login-failed]", {
        storeId,
        userId,
        ...batchLogExtras,
        error: toErrorDebugInfo(e),
      });
      for (const job of jobs) {
        await submitOne(job.id, false, undefined, msg);
      }
      return;
    }
    const { cookies, baeminShopId } = loginResult;
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
    const session = await createBaeminRegisterReplySession(storeId, userId, {
      cookies,
      shopNo: baeminShopId,
    });
    try {
      for (const job of jobs) {
        if (await isJobCancelled(job.id)) continue;
        const payload = job.payload;
        try {
          const shopNo = await resolveBaeminShopNoForReplyJob(
            storeId,
            payload as Record<string, unknown>,
            baeminShopId,
          );
          if (!shopNo) {
            await submitOne(
              job.id,
              false,
              undefined,
              "배민 가게 번호(shopNo)를 확인할 수 없습니다.",
            );
            continue;
          }
          const action = await doOneBaeminRegisterReply(session.page, shopNo, {
            reviewExternalId: String(payload.external_id ?? ""),
            content: String(payload.content ?? ""),
            written_at: (payload.written_at as string | undefined) ?? null,
          });
          const reviewId = payload.reviewId ?? payload.review_id ?? null;
          const fallbackContent = String(payload.content ?? "");
          const extracted =
            action.outcome === "already_registered" &&
            action.existingReplyContent != null &&
            action.existingReplyContent.trim() !== ""
              ? action.existingReplyContent.trim()
              : "";
          const useExtracted =
            action.outcome === "already_registered" &&
            extracted !== "" &&
            !isBaeminReplyDomExtractCorrupted(extracted);
          // DOM 추출이 리뷰 카드 덤프면 DB에 넣지 않음(다음 sync·수동으로 정합). AI 초안으로 덮어쓰면 더 거짓됨.
          const skipDbReply =
            action.outcome === "already_registered" &&
            extracted !== "" &&
            isBaeminReplyDomExtractCorrupted(extracted);
          const contentToStore = useExtracted
            ? extracted
            : skipDbReply
              ? undefined
              : fallbackContent;
          await submitOne(job.id, true, {
            reviewId,
            content: contentToStore,
            ...(skipDbReply ? { skipPlatformReplyContentUpdate: true } : {}),
          });
        } catch (e) {
          throwIfFatalRuntimeError(e, "runBatch:baemin_register_reply:doOne");

          const shouldRetryWithFallbackShopNo = (err: unknown): boolean => {
            if (baeminShopId == null) return false;
            const msg = err instanceof Error ? err.message : String(err);
            return (
              /intercepts pointer events|backdrop|pointer events/i.test(msg) ||
              /locator\.waitFor: Timeout .*textarea/i.test(msg) ||
              /waiting for locator\('textarea:visible'\)/i.test(msg)
            );
          };

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
          if (!isBrowserClosedError(e) && shouldRetryWithFallbackShopNo(e)) {
            try {
              await doOneBaeminRegisterReply(session.page, baeminShopId, {
                reviewExternalId: String(payload.external_id ?? ""),
                content: String(payload.content ?? ""),
                written_at: (payload.written_at as string | undefined) ?? null,
              });
              await submitOne(job.id, true, {
                reviewId: payload.reviewId ?? payload.review_id ?? null,
                content: String(payload.content ?? ""),
              });
              continue;
            } catch (e2) {
              throwIfFatalRuntimeError(
                e2,
                "runBatch:baemin_register_reply:retry_with_fallback_shopNo",
              );
              errorWithSlot(
                "[worker][batch][baemin_register_reply][fallback-shopNo-retry-failed]",
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
                e2 instanceof Error ? e2.message : String(e2),
              );
              continue;
            }
          }

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
                const shopNoRetry = await resolveBaeminShopNoForReplyJob(
                  storeId,
                  payload as Record<string, unknown>,
                  baeminShopId,
                );
                if (!shopNoRetry) throw new Error("shopNo 없음");
                await doOneBaeminRegisterReply(session2.page, shopNoRetry, {
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
              throwIfFatalRuntimeError(
                e2,
                "runBatch:baemin_register_reply:retry",
              );
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
    const creds = await getStoredCredentials(storeId, "coupang_eats");
    let session: Awaited<
      ReturnType<typeof createCoupangEatsRegisterReplySession>
    > | null = null;
    try {
      // sync와 동일: 저장 세션으로 먼저 시도
      session = await createCoupangEatsRegisterReplySession(storeId, userId);
    } catch (storedErr) {
      warnWithSlot(
        "[worker] coupang_eats_register_reply batch stored session failed, re-login",
        {
          storeId,
          userId,
          ...batchLogExtras,
          error: toErrorDebugInfo(storedErr),
        },
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
          const targetShopId = await resolveCoupangEatsShopNoForReplyJob(
            storeId,
            payload as Record<string, unknown>,
            session.externalStoreId,
          );
          if (!targetShopId) {
            await submitOne(
              job.id,
              false,
              undefined,
              "쿠팡이츠 매장 ID(리뷰 소속 매장)를 확인할 수 없습니다.",
            );
            continue;
          }
          const oneResult = await doOneCoupangEatsRegisterReply(
            session.page,
            targetShopId,
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
          throwIfFatalRuntimeError(
            e,
            "runBatch:coupang_eats_register_reply:doOne",
          );
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
              const targetShopRetry = await resolveCoupangEatsShopNoForReplyJob(
                storeId,
                payload as Record<string, unknown>,
                external_shop_id2 ?? null,
              );
              if (!targetShopRetry) {
                await submitOne(
                  job.id,
                  false,
                  undefined,
                  "쿠팡이츠 매장 ID(리뷰 소속 매장)를 확인할 수 없습니다.",
                );
              } else {
                const session2 = await createCoupangEatsRegisterReplySession(
                  storeId,
                  userId,
                  {
                    cookies: cookies2,
                    external_shop_id: targetShopRetry,
                  },
                );
                try {
                  const oneResult = await doOneCoupangEatsRegisterReply(
                    session2.page,
                    targetShopRetry,
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
              }
            } catch (e2) {
              throwIfFatalRuntimeError(
                e2,
                "runBatch:coupang_eats_register_reply:retry",
              );
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
  const slotKey = slotIndex >= 0 ? slotIndex : -1;

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
            "[worker] claim failed (네트워크·연결 타임아웃 등),",
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
            "[worker] server unreachable after retries; 다음 대기는 적응형 idle 간격 사용",
          );
        }
      } else {
        if (logSlotOnly) errorWithSlot("[worker] claim batch error", e);
      }
      if (attempt === maxClaimRetries) jobs = [];
    }
  }

  if (jobs.length === 0) {
    const streakBefore = adaptiveIdleStreakBySlot.get(slotKey) ?? 0;
    const idleSleepMs = nextIdlePollSleepMs(slotKey);
    if (WORKER_VERBOSE) {
      logWithSlot("[worker] idle(no jobs)", {
        workerIdForClaim,
        slotPlatform: slotPlatform ?? "all",
        idleSleepMs,
        idleStreakUsed: streakBefore,
        pollBaseMs: POLL_INTERVAL_MS,
        pollIdleMaxMs: POLL_INTERVAL_IDLE_MAX_MS,
      });
    }
    await sleep(idleSleepMs);
    return;
  }

  resetAdaptiveIdleStreak(slotKey);

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
    const startedAt = Date.now();
    await submitProgressSafe(job.id, {
      phase: "processing",
      progress: {
        current_step: 1,
        total_steps: 1,
        completed_steps: 0,
        percent: 0,
        elapsed_ms: 0,
      },
    });
    const outcome = await runJobWithRetries(
      job.type,
      job.store_id,
      job.user_id,
      job.payload,
      job.id,
    );
    await submitProgressSafe(job.id, {
      phase: "finalizing",
      progress: {
        current_step: 1,
        total_steps: 1,
        completed_steps: 1,
        percent: 100,
        elapsed_ms: Date.now() - startedAt,
        success: outcome.success,
      },
    });
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
      const res = outcome.result as
        | {
            shops?: unknown[];
            vendors?: { id?: unknown; name?: unknown }[];
            reviews?: unknown[];
            list?: { reviews?: unknown[] };
            external_shop_id?: unknown;
            store_name?: unknown;
            business_registration_number?: unknown;
            shop_category?: unknown;
          }
        | undefined;
      const baeminSyncExtra =
        job.type === "baemin_sync" && res != null
          ? {
              baeminShopCount: Array.isArray(res.shops)
                ? res.shops.length
                : undefined,
              syncedReviewCount: Array.isArray(res.reviews)
                ? res.reviews.length
                : Array.isArray(res.list?.reviews)
                  ? res.list.reviews.length
                  : undefined,
            }
          : {};
      const yogiyoSyncExtra =
        job.type === "yogiyo_sync" && res != null
          ? (() => {
              const r = res as {
                list?: unknown[];
                synced_review_count?: number;
                api_total_hint?: number;
                vendors_sync_summary?: {
                  vendor_id: number;
                  review_count: number;
                }[];
              };
              const n =
                typeof r.synced_review_count === "number"
                  ? r.synced_review_count
                  : Array.isArray(r.list)
                    ? r.list.length
                    : undefined;
              const vendors = Array.isArray(r.vendors_sync_summary)
                ? r.vendors_sync_summary
                : [];
              return {
                syncedReviewCount: n,
                yogiyoSyncVendorCount:
                  vendors.length > 0 ? vendors.length : undefined,
                yogiyoVendorsSyncSummary:
                  vendors.length > 0 ? vendors : undefined,
                yogiyoApiTotalHint:
                  typeof r.api_total_hint === "number"
                    ? r.api_total_hint
                    : undefined,
              };
            })()
          : {};
      const yogiyoVendorsNormalized =
        res != null && Array.isArray(res.vendors)
          ? res.vendors.map((v) => ({
              id: String(v?.id ?? ""),
              name:
                typeof v?.name === "string" && v.name.trim()
                  ? v.name.trim()
                  : null,
            }))
          : null;
      const externalIdTrimmed =
        res != null &&
        typeof res.external_shop_id === "string" &&
        res.external_shop_id.trim() !== ""
          ? res.external_shop_id.trim()
          : "";
      const yogiyoPrimaryNameFromVendors =
        job.type === "yogiyo_link" &&
        yogiyoVendorsNormalized &&
        externalIdTrimmed
          ? (yogiyoVendorsNormalized.find((v) => v.id === externalIdTrimmed)
              ?.name ?? undefined)
          : undefined;
      const storeNameFromResult =
        res != null &&
        typeof res.store_name === "string" &&
        res.store_name.trim() !== ""
          ? res.store_name.trim()
          : undefined;
      const resultMeta =
        res != null
          ? {
              externalShopIdFromResult: externalIdTrimmed || undefined,
              platformStoreNameFromResult:
                storeNameFromResult ??
                yogiyoPrimaryNameFromVendors ??
                undefined,
              businessRegistrationFromResult:
                typeof res.business_registration_number === "string" &&
                res.business_registration_number.trim() !== ""
                  ? res.business_registration_number.trim()
                  : undefined,
              shopCategoryFromResult:
                typeof res.shop_category === "string" &&
                res.shop_category.trim() !== ""
                  ? res.shop_category.trim()
                  : undefined,
              platformShopCountFromResult: Array.isArray(res.shops)
                ? res.shops.length
                : yogiyoVendorsNormalized
                  ? yogiyoVendorsNormalized.length
                  : undefined,
              ...(job.type === "yogiyo_link" && yogiyoVendorsNormalized
                ? { yogiyoContractedVendorsFromResult: yogiyoVendorsNormalized }
                : {}),
            }
          : {};
      logWithSlot("[worker] completed", {
        jobId: job.id,
        type: job.type,
        storeId: job.store_id,
        userId: job.user_id,
        ...jobStoreLog,
        ...baeminSyncExtra,
        ...yogiyoSyncExtra,
        ...resultMeta,
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
    jobFamily: WORKER_JOB_FAMILY ?? "all",
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

type WorkerLockPayload = {
  pid: number;
  parentPid: number;
  workerId: string;
  startedAt: string;
};

async function isProcessAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function killWorkerProcessTree(pid: number): Promise<void> {
  if (process.platform === "win32") {
    await execFileAsync("taskkill", ["/PID", String(pid), "/T", "/F"]);
    return;
  }
  process.kill(pid, "SIGTERM");
}

async function acquireWorkerLock(): Promise<{ release: () => Promise<void> }> {
  const lockPath = path.resolve(process.cwd(), WORKER_LOCK_FILE);
  const payload: WorkerLockPayload = {
    pid: process.pid,
    parentPid: process.ppid,
    workerId: WORKER_ID,
    startedAt: new Date().toISOString(),
  };

  const tryCreate = async (): Promise<boolean> => {
    try {
      const handle = await fs.open(lockPath, "wx");
      try {
        await handle.writeFile(JSON.stringify(payload, null, 2), "utf8");
      } finally {
        await handle.close();
      }
      return true;
    } catch (e) {
      const code =
        e instanceof Error && "code" in e
          ? (e as Error & { code?: string }).code
          : undefined;
      if (code === "EEXIST") return false;
      throw e;
    }
  };

  if (!(await tryCreate())) {
    let lockInfo: WorkerLockPayload | null = null;
    try {
      const raw = await fs.readFile(lockPath, "utf8");
      lockInfo = JSON.parse(raw) as WorkerLockPayload;
    } catch {
      lockInfo = null;
    }

    const existingPid =
      lockInfo != null && Number.isInteger(lockInfo.pid) && lockInfo.pid > 0
        ? lockInfo.pid
        : null;
    if (existingPid != null && (await isProcessAlive(existingPid))) {
      if (!WORKER_LOCK_TAKEOVER) {
        throw new Error(
          `이미 실행 중인 worker가 있습니다. lockFile=${lockPath}, pid=${existingPid}, parentPid=${lockInfo?.parentPid ?? "unknown"}, workerId=${lockInfo?.workerId ?? "unknown"}, startedAt=${lockInfo?.startedAt ?? "unknown"}`,
        );
      }
      warnWithSlot("[worker] existing worker detected, trying takeover", {
        lockFile: lockPath,
        pid: existingPid,
        parentPid: lockInfo?.parentPid ?? "unknown",
        workerId: lockInfo?.workerId ?? "unknown",
        startedAt: lockInfo?.startedAt ?? "unknown",
      });
      try {
        await killWorkerProcessTree(existingPid);
      } catch (e) {
        throw new Error(
          `기존 worker 종료 실패. lockFile=${lockPath}, pid=${existingPid}, parentPid=${lockInfo?.parentPid ?? "unknown"}, workerId=${lockInfo?.workerId ?? "unknown"}, startedAt=${lockInfo?.startedAt ?? "unknown"}, cause=${e instanceof Error ? e.message : String(e)}`,
        );
      }
      for (let i = 0; i < 20; i++) {
        if (!(await isProcessAlive(existingPid))) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      if (await isProcessAlive(existingPid)) {
        throw new Error(
          `기존 worker가 종료되지 않았습니다. lockFile=${lockPath}, pid=${existingPid}, parentPid=${lockInfo?.parentPid ?? "unknown"}, workerId=${lockInfo?.workerId ?? "unknown"}, startedAt=${lockInfo?.startedAt ?? "unknown"}`,
        );
      }
    }

    // stale lock 정리 후 1회 재시도
    await fs.unlink(lockPath).catch(() => {});
    if (!(await tryCreate())) {
      throw new Error("worker lock 획득에 실패했습니다.");
    }
  }

  let released = false;
  return {
    release: async () => {
      if (released) return;
      released = true;
      await fs.unlink(lockPath).catch(() => {});
    },
  };
}

void (async () => {
  let lockRelease: (() => Promise<void>) | null = null;
  try {
    const lock = await acquireWorkerLock();
    lockRelease = lock.release;
  } catch (e) {
    errorWithSlot("[worker] single-instance lock failed", e);
    process.exit(1);
    return;
  }

  process.on("SIGINT", onExit);
  process.on("SIGTERM", onExit);
  process.on("exit", () => {
    if (measureMemory.isEnabled()) {
      measureMemory.logSummary("[worker-memory] exit summary");
    }
  });

  try {
    let restartAttempt = 0;
    for (;;) {
      try {
        await workerMain();
        return;
      } catch (e) {
        errorWithSlot(e);
        if (!(e instanceof FatalWorkerRuntimeError)) {
          process.exit(1);
          return;
        }
        if (HAS_SUPERVISOR) {
          process.exit(FATAL_EXIT_CODE);
          return;
        }

        restartAttempt += 1;
        if (
          FATAL_RESTART_MAX_ATTEMPTS_WITHOUT_SUPERVISOR > 0 &&
          restartAttempt > FATAL_RESTART_MAX_ATTEMPTS_WITHOUT_SUPERVISOR
        ) {
          errorWithSlot("[worker] fatal restart attempts exceeded", {
            restartAttempt,
            maxAttempts: FATAL_RESTART_MAX_ATTEMPTS_WITHOUT_SUPERVISOR,
          });
          process.exit(FATAL_EXIT_CODE);
          return;
        }

        const delayMs = Math.min(
          FATAL_RESTART_BASE_DELAY_MS * Math.max(1, 2 ** (restartAttempt - 1)),
          FATAL_RESTART_MAX_DELAY_MS,
        );
        warnWithSlot("[worker] fatal runtime recovered by self-restart", {
          restartAttempt,
          delayMs,
          hasSupervisor: HAS_SUPERVISOR,
        });
        await sleep(delayMs);
      }
    }
  } finally {
    await lockRelease?.();
  }
})();
