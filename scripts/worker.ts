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

/** 배치 선점: 같은 (store_id, type, user_id) job 배열 반환. 0건이면 [] */
async function claimJobBatch(workerIdOverride?: string): Promise<JobClaim[]> {
  const workerId = workerIdOverride ?? WORKER_ID;
  const res = await fetch(
    `${SERVER_URL}/api/worker/jobs/batch?workerId=${encodeURIComponent(workerId)}&limit=${BATCH_LIMIT}`,
    { headers: authHeaders() },
  );
  if (res.status === 204 || res.status === 404) return [];
  if (!res.ok)
    throw new Error(`claim batch ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { jobs?: JobClaim[] };
  return Array.isArray(data.jobs) ? data.jobs : [];
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
  if (
    body.result &&
    typeof (body.result as { reviewId?: unknown }).reviewId === "string"
  ) {
    console.log(
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
        if (sid) {
          const { getStoredCredentials } =
            await import("../src/lib/services/platform-session-service");
          creds = await getStoredCredentials(sid, "baemin");
        } else {
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
              }
            } catch {
              // ignore
            }
          }
        }
        if (!creds) {
          return {
            success: false,
            errorMessage:
              "저장된 연동 정보가 없습니다. 다시 연동을 요청해 주세요.",
          };
        }
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
          console.log("[worker] coupang_eats_sync stored", {
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
                console.log(
                  "[worker] coupang_eats_sync store_name",
                  store_name,
                );
              else
                console.log("[worker] coupang_eats_sync store_name not found");
            }
            if (DEBUG_CE)
              console.log("[worker] coupang_eats_sync done (stored session)", {
                listLength: list.length,
              });
            return { success: true, result: { list, store_name } };
          } catch (e) {
            console.warn(
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
        if (DEBUG_CE) console.log("[worker] coupang_eats_sync re-login path");
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
            console.log("[worker] coupang_eats_sync store_name", store_name);
          else console.log("[worker] coupang_eats_sync store_name not found");
        }
        if (DEBUG_CE)
          console.log("[worker] coupang_eats_sync done (after re-login)", {
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

/** 배치 실행: 같은 (store_id, type, user_id) job들을 한 브라우저(또는 API만)에서 순차 처리. */
async function runBatch(jobs: JobClaim[]): Promise<void> {
  if (jobs.length === 0) return;
  const type = jobs[0].type;
  const storeId = jobs[0].store_id;
  const userId = jobs[0].user_id;
  if (storeId == null) {
    for (const job of jobs) {
      const outcome = await runJob(
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
    try {
      await submitResult(jobId, success, result, errorMessage);
    } catch (e) {
      console.error("[worker] submit result error", jobId, e);
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
          await submitOne(
            job.id,
            false,
            undefined,
            e instanceof Error ? e.message : String(e),
          );
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
    const {
      createCoupangEatsRegisterReplySession,
      doOneCoupangEatsRegisterReply,
    } =
      await import("../src/lib/services/coupang-eats/coupang-eats-register-reply-service");
    const session = await createCoupangEatsRegisterReplySession(
      storeId,
      userId,
      {
        cookies,
        external_shop_id: external_shop_id ?? null,
      },
    );
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
          await submitOne(
            job.id,
            false,
            undefined,
            e instanceof Error ? e.message : String(e),
          );
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
      const outcome = await runJob(
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

  for (const job of jobs) {
    const outcome = await runJob(
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

async function loop(slotIndex: number = -1): Promise<void> {
  if (!WORKER_SECRET) {
    console.error("[worker] WORKER_SECRET not set. Set env and restart.");
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    return;
  }

  const workerIdForClaim =
    slotIndex >= 0 ? `${WORKER_ID}-slot-${slotIndex}` : WORKER_ID;
  let jobs: JobClaim[] = [];
  const maxClaimRetries = 3;
  for (let attempt = 1; attempt <= maxClaimRetries; attempt++) {
    try {
      jobs = await claimJobBatch(workerIdForClaim);
      break;
    } catch (e: unknown) {
      const retriable = isRetriableNetworkError(e);
      const logSlotOnly = slotIndex <= 0; // 슬롯 0 또는 단일 워커일 때만 로그 (중복 방지)
      if (retriable && attempt < maxClaimRetries) {
        const delayMs = 1000 * attempt;
        if (logSlotOnly) {
          console.warn(
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
          console.warn(
            "[worker] server unreachable after retries, retry in",
            POLL_INTERVAL_MS / 1000,
            "s",
          );
        }
      } else {
        if (logSlotOnly) console.error("[worker] claim batch error", e);
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
        );
      } else {
        console.error("[worker] submit result error (result NOT submitted)", e);
      }
    }
    if (outcome.success && resultSubmitted) {
      console.log("[worker] completed", job.id);
    } else if (!outcome.success) {
      console.error("[worker] failed", job.id, outcome.errorMessage);
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

  console.log("[worker] batch", jobs.length, "jobs", jobs[0].type);
  await runBatch(jobs);
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
  console.log("[worker] start", {
    SERVER_URL,
    WORKER_ID,
    concurrency: WORKER_CONCURRENCY,
  });
  if (WORKER_CONCURRENCY <= 1) {
    for (;;) await loop();
    return;
  }
  await Promise.all(
    Array.from({ length: WORKER_CONCURRENCY }, (_, i) =>
      (async () => {
        for (;;) await loop(i);
      })(),
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
  console.error(e);
  process.exit(1);
});
