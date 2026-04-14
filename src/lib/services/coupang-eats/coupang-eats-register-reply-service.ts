/**
 * 쿠팡이츠 리뷰 페이지에서 타겟 리뷰의 "사장님 댓글 등록하기" 클릭 → textarea 입력 → "등록" 클릭.
 * 조회 과정은 sync와 동일(6개월 선택 후 조회). 첫 페이지만이 아니라 "다음" 버튼으로 계속 이동하며
 * 타겟 orderReviewId가 나올 때까지 실시간으로 찾은 뒤 해당 행에 댓글 등록.
 *
 * 디버그: DEBUG_COUPANG_EATS_REGISTER_REPLY=1 pnpm worker → 대상 행 선택/버튼 클릭/입력 내용 로그 출력.
 * 상세 DOM/API 불일치: DEBUG_COUPANG_EATS_REGISTER_REPLY_VERBOSE=1 (행별 버튼·텍스트 덤프 강화)
 * 실패 시 스크린샷: DEBUG_COUPANG_EATS_REGISTER_REPLY_SCREENSHOT=1 → OS tmp 폴더에 fullPage PNG
 */
import { join } from "node:path";
import { tmpdir } from "node:os";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_SEC_CH_UA_CHROME_146,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import * as CoupangEatsSession from "./coupang-eats-session-service";
import { closeReviewsPageModal } from "./coupang-eats-review-service";
import { isReplyWriteExpired } from "@/entities/review/lib/review-utils";
import {
  COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE,
  COUPANG_EATS_REPLY_REGISTER_RESTRICTED_USER_MESSAGE,
} from "./coupang-eats-reply-user-messages";

const REVIEWS_PAGE_URL =
  "https://store.coupangeats.com/merchant/management/reviews";
const REFERER = "https://store.coupangeats.com/merchant/management/reviews";

function parseWrittenAtToDate(written_at: string): Date | null {
  const s = String(written_at ?? "").trim();
  if (!s) return null;
  // ISO 우선
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;
  // "YYYY-MM-DD" / "YYYY.MM.DD" 형태 보정
  const m = s.match(/^(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) {
    return null;
  }
  const dt = new Date(y, mo - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function getMonthsDiffFromNow(target: Date): number {
  const now = new Date();
  const years = now.getFullYear() - target.getFullYear();
  const months = now.getMonth() - target.getMonth();
  return years * 12 + months;
}

async function selectQuickRangeByWrittenAt(
  page: import("playwright").Page,
  written_at: string | undefined,
): Promise<void> {
  const dt = written_at ? parseWrittenAtToDate(written_at) : null;
  const monthsDiff = dt ? Math.max(0, getMonthsDiffFromNow(dt)) : null;

  // 기본은 6개월(기존 동작). 다만 최근 리뷰면 더 좁혀 페이지 수를 줄인다.
  // 쿠팡 UI가 바뀌어도 텍스트 기반으로 시도하고, 실패하면 6개월로 폴백.
  const candidates: Array<{ label: string; fallbackInputValue?: string }> = [];
  if (monthsDiff != null && monthsDiff <= 1) {
    candidates.push({ label: "1개월", fallbackInputValue: "2" });
  } else if (monthsDiff != null && monthsDiff <= 3) {
    candidates.push({ label: "3개월", fallbackInputValue: "3" });
  }
  candidates.push({ label: "6개월", fallbackInputValue: "4" });

  for (const c of candidates) {
    const quick = page
      .locator(
        `label:has-text("${c.label}"), input[name="quick"][value="${c.fallbackInputValue ?? ""}"]`,
      )
      .first();
    const ok = await quick.isVisible().catch(() => false);
    if (!ok) continue;
    await quick.click().catch(() => {});
    await page.waitForTimeout(350);
    return;
  }
}

/** sync와 동일: shopId 없는 /reviews만 열면 선택 매장이 기본값으로 고정되어 UI/API가 엇갈림 */
function reviewsPageUrlForExternalStore(externalStoreId: string): string {
  const id = String(externalStoreId ?? "").trim();
  if (/^\d+$/.test(id)) return `${REVIEWS_PAGE_URL}/${id}`;
  return REVIEWS_PAGE_URL;
}

/** sync `fetchReviewsWithPlaywright` 첫 조회와 동일: 해당 매장 `storeId`의 POST/응답만 캡처 */
function matchesCoupangMerchantReviewsSearchResponse(
  response: import("playwright").Response,
  expectedStoreIdNum: number,
): boolean {
  const u = response.url();
  if (!u.includes("/api/v1/merchant/reviews/search") || !response.ok()) {
    return false;
  }
  let requestStoreId: number | null = null;
  const postData = response.request().postData();
  if (postData) {
    try {
      const parsed = JSON.parse(postData) as { storeId?: unknown };
      const n = Number(parsed.storeId);
      requestStoreId = Number.isInteger(n) ? n : null;
    } catch {
      requestStoreId = null;
    }
  }
  if (requestStoreId == null) {
    const n = Number(new URL(u).searchParams.get("storeId"));
    requestStoreId = Number.isInteger(n) ? n : null;
  }
  return requestStoreId != null && requestStoreId === expectedStoreIdNum;
}

function getOrderReviewIdFromCoupangSearchRow(row: unknown): number | undefined {
  if (row == null || typeof row !== "object") return undefined;
  const o = row as Record<string, unknown>;
  const raw = o.orderReviewId ?? o.order_review_id;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "") {
    const n = Number(raw.trim());
    if (Number.isFinite(n)) return n;
  }
  return undefined;
}

const BROWSER_HEADERS = {
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua": PLAYWRIGHT_SEC_CH_UA_CHROME_146,
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
};
const LOG = "[coupang-eats-register-reply]";
const DEBUG = process.env.DEBUG_COUPANG_EATS_REGISTER_REPLY === "1";
const DEBUG_VERBOSE =
  process.env.DEBUG_COUPANG_EATS_REGISTER_REPLY_VERBOSE === "1";
const DEBUG_SCREENSHOT =
  process.env.DEBUG_COUPANG_EATS_REGISTER_REPLY_SCREENSHOT === "1";
/** 다음 페이지 탐색 상한 (배민 sync와 동일하게 충분히 큰 값) */
const MAX_PAGE_ATTEMPTS = 100;
const REGISTER_BTN_TEXT_RE = /사장님\s*댓글\s*등록하기/;
function debugLog(...args: unknown[]) {
  if (DEBUG) console.log(LOG, ...args);
}

type CoupangRegisterReplyRowDump = {
  trIndex: number;
  firstTdEmpty: boolean;
  firstTdPreview: string;
  isOwnerRowHeuristic: boolean;
  buttonCount: number;
  buttonTexts: string[];
  hasRegisterPattern: boolean;
  hasModifyBtn: boolean;
  rowTextPreview: string;
  containsTargetIdInText: boolean;
};

/** API 인덱스 vs DOM 불일치·버튼 부재 원인 추적용 (실패 시 항상 stderr에 출력) */
async function logCoupangRegisterReplyMismatchDebug(params: {
  page: import("playwright").Page;
  reason: "customer_row_not_found" | "no_register_button";
  reviewExternalId: string;
  rowIndexFromApi: number;
  matchedPageIndex: number;
  matchedSearchContentIds: number[];
  foundTrIndex: number;
  customerIdxWhenMatched: number;
  totalTr: number;
  allDataRows: import("playwright").Locator;
}): Promise<void> {
  const {
    page,
    reason,
    reviewExternalId,
    rowIndexFromApi,
    matchedPageIndex,
    matchedSearchContentIds,
    foundTrIndex,
    customerIdxWhenMatched,
    totalTr,
    allDataRows,
  } = params;
  const targetIdStr = String(reviewExternalId);
  const maxRows = DEBUG_VERBOSE ? Math.min(totalTr, 40) : Math.min(totalTr, 25);
  const rows: CoupangRegisterReplyRowDump[] = [];
  for (let i = 0; i < maxRows; i++) {
    const tr = allDataRows.nth(i);
    const firstTdText = (
      await tr.locator("td").first().innerText().catch(() => "")
    ).trim();
    const firstTdEmpty = !firstTdText;
    const btns = tr.locator("button");
    const buttonCount = await btns.count();
    const buttonTexts: string[] = [];
    const cap = DEBUG_VERBOSE ? 25 : 12;
    for (let b = 0; b < Math.min(buttonCount, cap); b++) {
      const t = (
        await btns.nth(b).innerText().catch(() => "")
      ).replace(/\s+/g, " ");
      buttonTexts.push(t.slice(0, 120));
    }
    const rowTextRaw = (await tr.innerText().catch(() => "")).replace(
      /\s+/g,
      " ",
    );
    const rowTextPreview = rowTextRaw.slice(0, 400);
    const hasRegisterPattern = REGISTER_BTN_TEXT_RE.test(rowTextRaw);
    const hasModifyBtn = await tr
      .locator('button:has-text("수정")')
      .first()
      .isVisible()
      .catch(() => false);
    const isOwnerRowHeuristic = await isOwnerReplyRow(tr);
    rows.push({
      trIndex: i,
      firstTdEmpty,
      firstTdPreview: firstTdText.slice(0, 160),
      isOwnerRowHeuristic,
      buttonCount,
      buttonTexts,
      hasRegisterPattern,
      hasModifyBtn,
      rowTextPreview,
      containsTargetIdInText:
        targetIdStr.length > 0 && rowTextRaw.includes(targetIdStr),
    });
  }

  let customerRowIndices: number[] = [];
  let c = -1;
  for (let i = 0; i < maxRows; i++) {
    if (!rows[i].firstTdEmpty) {
      c += 1;
      customerRowIndices.push(i);
    }
  }

  const payload = {
    reason,
    reviewExternalId,
    rowIndexFromApi,
    matchedPageIndex,
    matchedSearchContentIds,
    foundTrIndex,
    customerIdxWhenMatched,
    totalTr,
    tbodyTrSampled: maxRows,
    pageUrl: page.url(),
    customerRowTrIndices: customerRowIndices,
    /** API N번째 고객 리뷰에 해당하는 tr 인덱스(없으면 -1) */
    expectedCustomerTrIndex:
      rowIndexFromApi >= 0 && rowIndexFromApi < customerRowIndices.length
        ? customerRowIndices[rowIndexFromApi]
        : -1,
    rows,
  };

  console.error(
    LOG,
    "[register-reply-mismatch-debug]",
    JSON.stringify(payload, null, 2),
  );

  if (DEBUG_SCREENSHOT) {
    const path = join(
      tmpdir(),
      `coupang-eats-register-reply-${Date.now()}-${reason}.png`,
    );
    try {
      await page.screenshot({ path, fullPage: true });
      console.error(LOG, "[register-reply-mismatch-debug] screenshot:", path);
    } catch (e) {
      console.error(LOG, "[register-reply-mismatch-debug] screenshot failed", e);
    }
  }
}

/** 리뷰 관리 목록 테이블의 `tbody tr`만 (푸터·모달 등 다른 table 과 섞이지 않게) */
function getReviewTableBodyRows(page: import("playwright").Page) {
  return page
    .getByRole("table")
    .filter({ has: page.getByRole("columnheader", { name: "리뷰 작성일" }) })
    .first()
    .locator("tbody tr");
}

/**
 * reviews/search 응답 이후 React가 테이블을 다시 그릴 때까지 대기 (페이지네이션 시 API 인덱스 vs DOM 불일치 완화).
 * 연속 두 번 같은 `tbody tr` 개수면 안정화로 간주.
 */
async function stabilizeReviewTableAfterSearch(
  page: import("playwright").Page,
): Promise<void> {
  const rows = getReviewTableBodyRows(page);
  let last = -1;
  let stable = 0;
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const n = await rows.count();
    if (n === last) stable += 1;
    else stable = 0;
    last = n;
    if (stable >= 2) {
      await page.waitForTimeout(200);
      return;
    }
  }
  await page.waitForTimeout(400);
}

/** 사장님 답글 전용 행: 첫 번째 셀 비어 있고, `수정` 또는 `사장님` 라벨 (role 이름이 아이콘과 합쳐져 getByRole이 실패할 수 있어 has-text 사용) */
async function isOwnerReplyRow(
  tr: import("playwright").Locator,
): Promise<boolean> {
  const firstTd = (
    await tr.locator("td").first().innerText().catch(() => "")
  ).trim();
  if (firstTd) return false;
  const hasModify = await tr
    .locator('button:has-text("수정")')
    .first()
    .isVisible()
    .catch(() => false);
  if (hasModify) return true;
  const ownerStrong = await tr
    .locator("strong")
    .filter({ hasText: /^사장님$/ })
    .first()
    .isVisible()
    .catch(() => false);
  return ownerStrong;
}

/**
 * 디버그 덤프 기준: API 행은 맞는데 `tr` 안에 `<button>`만 0개인 경우가 있음 → a / role=button / 마지막 셀 / 펼침 후 재탐색.
 */
async function findCoupangRegisterReplyCta(
  row: import("playwright").Locator,
  page: import("playwright").Page,
): Promise<import("playwright").Locator | null> {
  const shortLabel = /사장님\s*댓글\s*등록하기|사장님\s*댓글\s*등록|댓글\s*등록하기/;

  const tryFirstVisible = async (
    loc: import("playwright").Locator,
  ): Promise<import("playwright").Locator | null> => {
    const first = loc.first();
    if (await first.isVisible().catch(() => false)) return first;
    return null;
  };

  const strategies: Array<{
    name: string;
    build: () => import("playwright").Locator;
  }> = [
    {
      name: "row.getByRole(button) name full",
      build: () => row.getByRole("button", { name: REGISTER_BTN_TEXT_RE }),
    },
    {
      name: "row.getByRole(link) name full",
      build: () => row.getByRole("link", { name: REGISTER_BTN_TEXT_RE }),
    },
    {
      name: "row button|a|[role=button] filter full",
      build: () =>
        row
          .locator('button, a, [role="button"]')
          .filter({ hasText: REGISTER_BTN_TEXT_RE }),
    },
    {
      name: "row last td interactive filter full",
      build: () =>
        row
          .locator("td")
          .last()
          .locator('button, a, [role="button"], span[role="button"]')
          .filter({ hasText: REGISTER_BTN_TEXT_RE }),
    },
    {
      name: "row.getByRole(button) name short",
      build: () => row.getByRole("button", { name: shortLabel }),
    },
    {
      name: "row interactive filter short",
      build: () =>
        row
          .locator(
            'button, a, [role="button"], span[role="button"], div[role="button"]',
          )
          .filter({ hasText: shortLabel }),
    },
  ];

  const scan = async (): Promise<import("playwright").Locator | null> => {
    for (const s of strategies) {
      const hit = await tryFirstVisible(s.build());
      if (hit) {
        if (DEBUG) debugLog("register CTA hit", s.name);
        return hit;
      }
    }
    return null;
  };

  let found = await scan();
  if (found) return found;

  const expander = row
    .locator('button, a, [role="button"]')
    .filter({ hasText: /더보기|펼치기|자세히|내용\s*더보기|열기/ })
    .first();
  if (await expander.isVisible().catch(() => false)) {
    if (DEBUG) debugLog("register CTA: clicking row expander");
    await expander.click().catch(() => null);
    await page.waitForTimeout(700);
    found = await scan();
  }

  return found;
}

const MERCHANT_REPLY_POST_URL =
  "https://store.coupangeats.com/api/v1/merchant/reviews/reply";

/** 워커 `isBrowserClosedError`와 동일 문구(재시도·사용자 메시지 일관) */
const PLAYWRIGHT_PAGE_CLOSED_MESSAGE =
  "Target page, context or browser has been closed";

function assertCoupangReplyPageUsable(page: import("playwright").Page): void {
  if (page.isClosed()) {
    throw new Error(PLAYWRIGHT_PAGE_CLOSED_MESSAGE);
  }
}

function normalizePlaywrightClosedError(e: unknown): Error {
  if (e instanceof Error) {
    const m = e.message;
    if (
      m.includes("Target page, context or browser has been closed") ||
      m.includes("Browser has been closed")
    ) {
      return new Error(PLAYWRIGHT_PAGE_CLOSED_MESSAGE);
    }
    return e;
  }
  return new Error(String(e));
}

/** merchant JSON의 `error`가 문자열이 아닐 때(객체 등) 로그에 [object Object] 나오지 않게 */
function formatMerchantReplyApiError(err: unknown): string {
  if (err == null || err === "") return "";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** merchant API code 20051 등 — 답글 기한 만료(재로그인으로 복구 불가) */
function isCoupangMerchantReplyDeadlineFailure(message: string): boolean {
  if (/\b20051\b/.test(message)) return true;
  if (
    message.includes("댓글을 생성/수정할 수 있는 기한이 지났습니다") ||
    message.includes("기한이 지났습니다")
  ) {
    return true;
  }
  return false;
}

function isCoupangMerchantReplyRestrictedWordFailure(message: string): boolean {
  return /\b20053\b/.test(message) || message.includes("포함할 수 없습니다");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildLooseSpacingRegex(token: string): RegExp {
  const compact = token.replace(/\s+/g, "");
  const parts = [...compact].map((ch) => escapeRegExp(ch));
  // e.g. "간나" => /간\s*나/g
  return new RegExp(parts.join("\\s*"), "g");
}

function extractRestrictedWordFromMerchantError(message: string): string | null {
  const normalized = message.normalize("NFC");
  const patterns: RegExp[] = [
    // ASCII / 일반 따옴표
    /포함할 수 없습니다\s*[：:]\s*'([^']+)'/,
    // 유니코드 따옴표(‘간나’ 등)
    /포함할 수 없습니다\s*[：:]\s*[\u2018']([^\u2019']+)[\u2019']/,
    // 콜론만 다른 변형(공백 다름)
    /다음 단어를 포함할 수 없습니다\s*[：:]\s*['\u2018]([^\u2019']+)['\u2019]/,
    // 따옴표 없이 끝까지(드물게)
    /포함할 수 없습니다\s*[：:]\s*([^\s"',}\]]+)/,
  ];
  for (const re of patterns) {
    const m = normalized.match(re);
    const raw = m?.[1]?.trim().replace(/^['\u2018]+|['\u2019]+$/g, "") ?? "";
    if (raw) return raw;
  }
  return null;
}

function sanitizeCoupangEatsReplyContentForRestrictedWord(
  content: string,
  restrictedWord: string,
): string {
  const base = content.normalize("NFC");
  const compact = restrictedWord.replace(/\s+/g, "").normalize("NFC");
  if (!compact) return base;
  const maskLen = Math.min(Math.max(compact.length, 1), 6);
  const mask = "*".repeat(maskLen);
  let out = base.replace(buildLooseSpacingRegex(compact), mask);
  if (out !== base) return out;
  const lit = restrictedWord.trim().normalize("NFC");
  if (lit && base.includes(lit)) {
    out = base.split(lit).join(mask);
    if (out !== base) return out;
  }
  if (compact !== lit && base.includes(compact)) {
    out = base.replaceAll(compact, mask);
  }
  return out;
}

/**
 * 워커: 첫 시도(저장 세션) 실패 시 무조건 재로그인하지 말고,
 * 기한 만료 등 비세션 오류는 그대로 실패 반환할 때 사용.
 */
export function shouldCoupangEatsRegisterReplySkipRelogin(
  err: unknown,
): boolean {
  const m = err instanceof Error ? err.message : String(err);
  if (m === COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE) return true;
  if (isCoupangMerchantReplyDeadlineFailure(m)) return true;
  /** 금칙어(20053)는 재로그인으로 해결 안 됨 — 오해 방지 */
  if (isCoupangMerchantReplyRestrictedWordFailure(m)) return true;
  return false;
}

/**
 * 일부 매장/뷰포트에서 리뷰 행 `<tr>` 안에 등록 CTA가 DOM에 없음(스크린샷엔 보일 수 있음).
 * 브라우저 컨텍스트 쿠키로 merchant API 직접 호출 — UI와 동일 엔드포인트.
 * code=20053(금칙어)이면 마스킹 후 1회 재시도.
 */
async function submitCoupangEatsReplyViaMerchantApiOnce(
  page: import("playwright").Page,
  body: { storeId: number; orderReviewId: number; comment: string },
): Promise<{ orderReviewReplyId?: number }> {
  if (!Number.isFinite(body.storeId) || body.storeId <= 0) {
    throw new Error(`유효하지 않은 storeId: ${body.storeId}`);
  }
  if (!Number.isFinite(body.orderReviewId) || body.orderReviewId <= 0) {
    throw new Error(`유효하지 않은 orderReviewId: ${body.orderReviewId}`);
  }
  const res = await page.request.post(MERCHANT_REPLY_POST_URL, {
    data: JSON.stringify({
      storeId: body.storeId,
      orderReviewId: body.orderReviewId,
      comment: body.comment,
    }),
    headers: {
      ...BROWSER_HEADERS,
      Referer: REFERER,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
  });
  const status = res.status();
  let json: {
    code?: string;
    error?: unknown;
    data?: { orderReviewReplyId?: number };
  } = {};
  try {
    json = (await res.json()) as typeof json;
  } catch {
    const text = await res.text().catch(() => "");
    throw new Error(
      `HTTP ${status}, JSON 아님: ${text.slice(0, 240)}`,
    );
  }
  if (status < 200 || status >= 300) {
    const detail = formatMerchantReplyApiError(json.error) || res.statusText();
    throw new Error(`HTTP ${status}. ${detail}`.trim());
  }
  if (json.code !== "SUCCESS") {
    const detail = formatMerchantReplyApiError(json.error);
    throw new Error(
      `code=${json.code ?? "unknown"}. ${detail}`.trim(),
    );
  }
  const orderReviewReplyId = json.data?.orderReviewReplyId;
  return orderReviewReplyId != null ? { orderReviewReplyId } : {};
}

async function submitCoupangEatsReplyViaMerchantApi(
  page: import("playwright").Page,
  body: { storeId: number; orderReviewId: number; comment: string },
): Promise<{ orderReviewReplyId?: number }> {
  let comment = body.comment.normalize("NFC");
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      return await submitCoupangEatsReplyViaMerchantApiOnce(page, {
        ...body,
        comment,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        attempt >= 3 ||
        !isCoupangMerchantReplyRestrictedWordFailure(msg)
      ) {
        throw e;
      }
      const word = extractRestrictedWordFromMerchantError(msg);
      if (!word) throw e;
      const next = sanitizeCoupangEatsReplyContentForRestrictedWord(comment, word);
      if (next === comment) throw e;
      comment = next.normalize("NFC");
    }
  }
  throw new Error("쿠팡이츠 댓글 등록: 금칙어 마스킹 재시도 후에도 실패");
}

export type RegisterCoupangEatsReplyParams = {
  reviewExternalId: string;
  content: string;
  /** 리뷰 작성일(YYYY-MM-DD). 목록에서 해당 일자 포함해 찾을 때 사용 */
  written_at?: string | null;
};

export type RegisterCoupangEatsReplyOptions = {
  /** cookies 생략 시 저장 세션 쿠키 사용, external_shop_id만 바꿔 매장 전환 */
  sessionOverride?: { cookies?: CookieItem[]; external_shop_id?: string | null };
};

/** 워커 배치용: page·externalStoreId·params만 받아 댓글 1건 등록. (같은 page에서 N건 순차 호출 가능) */
export async function doOneCoupangEatsRegisterReply(
  page: import("playwright").Page,
  externalStoreId: string,
  params: RegisterCoupangEatsReplyParams,
): Promise<{ orderReviewReplyId?: number }> {
  const { reviewExternalId, content, written_at } = params;
  debugLog("params", {
    reviewExternalId,
    contentLength: content.length,
    written_at: written_at ?? null,
  });

  if (written_at && isReplyWriteExpired(written_at, "coupang_eats")) {
    throw new Error(COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE);
  }

  if (DEBUG) {
    page.on("request", (req) => {
      if (
        req.url().includes("/api/v1/merchant/reviews/reply") &&
        req.method() === "POST"
      ) {
        const body = req.postData();
        if (body) {
          try {
            const parsed = JSON.parse(body) as {
              storeId?: number;
              orderReviewId?: number;
              comment?: string;
            };
            debugLog("POST /reviews/reply request", {
              storeId: parsed.storeId,
              orderReviewId: parsed.orderReviewId,
              commentLength: parsed.comment?.length ?? 0,
              expectedOrderReviewId: reviewExternalId,
            });
          } catch {
            debugLog("POST /reviews/reply body (raw)", body.slice(0, 200));
          }
        }
      }
    });
  }

  await page.goto(reviewsPageUrlForExternalStore(externalStoreId), {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await page.waitForTimeout(3_000);
  await closeReviewsPageModal(page);
  await page.waitForTimeout(2_000);

  const dateTrigger = page.locator('div[class*="eylfi1j5"]').first();
  await dateTrigger
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => null);
  await dateTrigger.click().catch(() => {});
  await page.waitForTimeout(800);
  await selectQuickRangeByWrittenAt(page, written_at ?? undefined);
  await page.waitForTimeout(500);

  await closeReviewsPageModal(page);
  await page.waitForTimeout(1_000);
  await page
    .locator(".dialog-modal-wrapper")
    .waitFor({ state: "hidden", timeout: 6_000 })
    .catch(() => {});
  await page.waitForTimeout(300);

  const searchBtn = page.getByRole("button", { name: "조회" });
  await searchBtn.waitFor({ state: "visible", timeout: 10_000 });
  await closeReviewsPageModal(page);
  await page
    .locator(".dialog-modal-wrapper")
    .waitFor({ state: "hidden", timeout: 6_000 })
    .catch(() => {});
  await page.waitForTimeout(300);

  const targetIdNum = Number(reviewExternalId);
  const targetIdStr = String(reviewExternalId);
  const expectedStoreIdNum = Number(String(externalStoreId).trim());
  if (!Number.isInteger(expectedStoreIdNum) || expectedStoreIdNum <= 0) {
    throw new Error(`유효하지 않은 쿠팡이츠 매장 ID: ${externalStoreId}`);
  }
  let rowIndexFromApi = -1;
  let matchedPageIndex = -1;
  let matchedSearchContentIds: number[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGE_ATTEMPTS; pageIndex++) {
    const matchesSearch = (r: import("playwright").Response) =>
      matchesCoupangMerchantReviewsSearchResponse(r, expectedStoreIdNum);

    let response: import("playwright").Response;
    if (pageIndex === 0) {
      [response] = await Promise.all([
        page.waitForResponse(matchesSearch, { timeout: 15_000 }),
        searchBtn.click({ force: true }),
      ]);
    } else {
      const nextBtn = page.locator(
        "button.pagination-btn.next-btn:not(.hide-btn)",
      );
      const nextVisible = await nextBtn.isVisible().catch(() => false);
      if (!nextVisible) {
        throw new Error(
          `리뷰 목록에서 해당 리뷰를 찾을 수 없습니다. orderReviewId=${reviewExternalId}. (모든 페이지 탐색 완료)`,
        );
      }
      [response] = await Promise.all([
        page.waitForResponse(matchesSearch, { timeout: 15_000 }),
        nextBtn.click().catch(() => {}),
      ]);
    }
    await stabilizeReviewTableAfterSearch(page);
    let content: unknown[] = [];
    try {
      const body = (await response.json()) as {
        data?: { content?: unknown[] };
      };
      content = Array.isArray(body?.data?.content) ? body.data.content : [];
    } catch {
      // ignore
    }
    if (DEBUG)
      debugLog("reviews/search captured", {
        pageIndex,
        length: content.length,
        ids: content
          .map((c) => getOrderReviewIdFromCoupangSearchRow(c))
          .slice(0, 10),
        expectedStoreIdNum,
      });
    const idx = content.findIndex((c) => {
      const oid = getOrderReviewIdFromCoupangSearchRow(c);
      if (oid == null) return false;
      return oid === targetIdNum || String(oid) === targetIdStr;
    });
    if (idx >= 0) {
      rowIndexFromApi = idx;
      matchedPageIndex = pageIndex;
      matchedSearchContentIds = content
        .map((c) => getOrderReviewIdFromCoupangSearchRow(c))
        .filter((id): id is number => id != null && !Number.isNaN(Number(id)));
      break;
    }
  }
  if (rowIndexFromApi < 0) {
    throw new Error(
      `리뷰 목록에서 해당 리뷰를 찾을 수 없습니다. orderReviewId=${reviewExternalId}. (최대 ${MAX_PAGE_ATTEMPTS}페이지 탐색)`,
    );
  }

  await page
    .getByRole("columnheader", { name: "리뷰 작성일" })
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => null);
  await page.waitForTimeout(400);

  /** API `content` 인덱스는 '고객 리뷰'만 센다. DOM은 사장님 답글이 있으면 `<tr>`이 추가로 붙고 첫 번째 `td`가 비어 있다. */
  const allDataRows = getReviewTableBodyRows(page);
  const totalTr = await allDataRows.count();
  let row: import("playwright").Locator | undefined;
  let found = false;
  let customerIdx = -1;
  let foundTrIndex = -1;
  for (let i = 0; i < totalTr; i++) {
    const candidate = allDataRows.nth(i);
    const firstTdText = (
      await candidate
        .locator("td")
        .first()
        .innerText()
        .catch(() => "")
    ).trim();
    if (!firstTdText) continue;
    customerIdx += 1;
    if (customerIdx === rowIndexFromApi) {
      row = candidate;
      foundTrIndex = i;
      found = true;
      break;
    }
  }
  if (!found || row === undefined) {
    await logCoupangRegisterReplyMismatchDebug({
      page,
      reason: "customer_row_not_found",
      reviewExternalId,
      rowIndexFromApi,
      matchedPageIndex,
      matchedSearchContentIds,
      foundTrIndex: -1,
      customerIdxWhenMatched: customerIdx,
      totalTr,
      allDataRows,
    });
    throw new Error(
      `리뷰 행 인덱스 불일치. API에서는 ${rowIndexFromApi}번째 고객 리뷰인데, ` +
        `첫 셀이 비어 있지 않은 행(고객 리뷰 행)만 세면 일치하는 행이 없습니다. (tbody tr ${totalTr}개)`,
    );
  }
  const registerCta = await findCoupangRegisterReplyCta(row, page);
  if (!registerCta) {
    const hasModifySameRow = await row
      .locator('button:has-text("수정")')
      .first()
      .isVisible()
      .catch(() => false);
    if (hasModifySameRow) {
      debugLog("이미 답글 등록된 리뷰(수정 버튼 있음). 등록 생략.", {
        orderReviewId: reviewExternalId,
      });
      return {};
    }
    /** 이미 답변한 리뷰: 사장님 행이 고객 바로 아래가 아닐 수 있어, 다음 몇 줄까지 스캔 */
    for (
      let j = foundTrIndex + 1;
      j < totalTr && j < foundTrIndex + 5;
      j++
    ) {
      const scanTr = allDataRows.nth(j);
      const scanFirst = (
        await scanTr.locator("td").first().innerText().catch(() => "")
      ).trim();
      if (scanFirst) break;
      if (await isOwnerReplyRow(scanTr)) {
        debugLog("이미 답글 등록된 리뷰(인접 사장님 답글 행). 등록 생략.", {
          orderReviewId: reviewExternalId,
          scanTrIndex: j,
        });
        return {};
      }
    }
    await logCoupangRegisterReplyMismatchDebug({
      page,
      reason: "no_register_button",
      reviewExternalId,
      rowIndexFromApi,
      matchedPageIndex,
      matchedSearchContentIds,
      foundTrIndex,
      customerIdxWhenMatched: rowIndexFromApi,
      totalTr,
      allDataRows,
    });
    const storeIdNum = Number.parseInt(String(externalStoreId).trim(), 10);
    if (DEBUG)
      debugLog("DOM 등록 CTA 없음 → POST reviews/reply (page.request)", {
        storeId: storeIdNum,
        orderReviewId: targetIdNum,
      });
    try {
      return await submitCoupangEatsReplyViaMerchantApi(page, {
        storeId: storeIdNum,
        orderReviewId: targetIdNum,
        comment: params.content.trim(),
      });
    } catch (apiErr) {
      const apiPart =
        apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.error(LOG, "no register CTA + merchant API failed", {
        foundTrIndex,
        orderReviewId: reviewExternalId,
        apiPart,
      });
      if (isCoupangMerchantReplyDeadlineFailure(apiPart)) {
        throw new Error(COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE);
      }
      throw new Error(COUPANG_EATS_REPLY_REGISTER_RESTRICTED_USER_MESSAGE);
    }
  }
  debugLog("selected row by API order", {
    rowIndex: rowIndexFromApi,
    orderReviewId: reviewExternalId,
  });
  await row.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(400);

  await registerCta.click({ timeout: 10_000 });

  const textarea = page.locator('textarea[name="review"]').first();
  await textarea.waitFor({ state: "visible", timeout: 8_000 });
  const replyForm = page
    .locator("form")
    .filter({ has: page.locator('textarea[name="review"]') })
    .first();
  const submitBtn = replyForm.getByRole("button", { name: "등록" }).first();

  const submitOnce = async (comment: string) => {
    assertCoupangReplyPageUsable(page);
    await textarea.fill(comment);
    await page.waitForTimeout(250);
    assertCoupangReplyPageUsable(page);
    /** 응답 대기·클릭을 한 Promise로 묶어 페이지 조기 종료 시 미처리 rejection 누수 완화 */
    let response: import("playwright").Response;

    const clickAndWaitForReply = async (opts: {
      force?: boolean;
      clickTimeout: number;
    }) => {
      await closeReviewsPageModal(page);
      await page.waitForTimeout(200);
      await submitBtn.scrollIntoViewIfNeeded().catch(() => null);
      return Promise.all([
        page.waitForResponse(
          (res) =>
            res.url() === MERCHANT_REPLY_POST_URL &&
            res.request().method() === "POST",
          { timeout: 15_000 },
        ),
        submitBtn.click({
          timeout: opts.clickTimeout,
          ...(opts.force ? { force: true as const } : {}),
        }),
      ]);
    };

    try {
      [response] = await clickAndWaitForReply({ clickTimeout: 8_000 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const overlayBlocking =
        /intercepts pointer events|dialog-modal-wrapper/i.test(msg);
      if (overlayBlocking) {
        try {
          [response] = await clickAndWaitForReply({
            force: true,
            clickTimeout: 12_000,
          });
        } catch (e2) {
          throw normalizePlaywrightClosedError(e2);
        }
      } else {
        throw normalizePlaywrightClosedError(e);
      }
    }
    const status = response.status();
    let body: {
      code?: string;
      error?: unknown;
      data?: { orderReviewReplyId?: number };
    } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      // ignore
    }
    return { status, body };
  };

  const original = params.content.trim().slice(0, 300).normalize("NFC");
  const first = await submitOnce(original);
  const formatFailure = (status: number, body: { code?: string; error?: unknown }) => {
    if (status < 200 || status >= 300) {
      return `쿠팡이츠 댓글 등록 API 실패: HTTP ${status}. ${formatMerchantReplyApiError(body.error)}`.trim();
    }
    if (body.code !== "SUCCESS") {
      return `쿠팡이츠 댓글 등록 API 실패: code=${body.code ?? "unknown"}. ${formatMerchantReplyApiError(body.error)}`.trim();
    }
    return "";
  };
  let failure = formatFailure(first.status, first.body);
  if (!failure) {
    const orderReviewReplyId = first.body.data?.orderReviewReplyId;
    await page.waitForTimeout(1_000);
    return orderReviewReplyId != null ? { orderReviewReplyId } : {};
  }
  if (isCoupangMerchantReplyDeadlineFailure(failure)) {
    throw new Error(COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE);
  }

  // 금칙어(20053)면 마스킹 후 최대 3회 재시도(연쇄 금칙어·마스킹 누락 대비)
  let replyText = original;
  let lastFailure = failure;
  if (isCoupangMerchantReplyRestrictedWordFailure(lastFailure)) {
    for (let round = 0; round < 3; round++) {
      const word = extractRestrictedWordFromMerchantError(lastFailure);
      if (!word) break;
      const sanitized = sanitizeCoupangEatsReplyContentForRestrictedWord(
        replyText,
        word,
      );
      if (sanitized === replyText) break;
      replyText = sanitized;
      if (DEBUG) debugLog("restricted word masked and retry", { word, round });
      assertCoupangReplyPageUsable(page);
      const next = await submitOnce(replyText);
      lastFailure = formatFailure(next.status, next.body);
      if (!lastFailure) {
        const orderReviewReplyId = next.body.data?.orderReviewReplyId;
        await page.waitForTimeout(1_000);
        return orderReviewReplyId != null ? { orderReviewReplyId } : {};
      }
      if (isCoupangMerchantReplyDeadlineFailure(lastFailure)) {
        throw new Error(COUPANG_EATS_REPLY_DEADLINE_EXPIRED_USER_MESSAGE);
      }
      if (!isCoupangMerchantReplyRestrictedWordFailure(lastFailure)) {
        throw new Error(lastFailure);
      }
    }
    failure = lastFailure;
  }

  throw new Error(failure);
}

export type CoupangEatsRegisterReplySession = {
  page: import("playwright").Page;
  context: import("playwright").BrowserContext;
  browser: import("playwright").Browser;
  externalStoreId: string;
  close: () => Promise<void>;
};

/** 워커 배치용: 브라우저 launch + context + cookies + newPage 까지 수행. close() 시 브라우저 종료. */
export async function createCoupangEatsRegisterReplySession(
  storeId: string,
  userId: string,
  sessionOverride?: { cookies?: CookieItem[]; external_shop_id?: string | null },
): Promise<CoupangEatsRegisterReplySession> {
  let cookies: CookieItem[];
  if (sessionOverride?.cookies?.length) {
    cookies = sessionOverride.cookies;
  } else {
    const stored = await CoupangEatsSession.getCoupangEatsCookies(
      storeId,
      userId,
    );
    if (!stored?.length) {
      throw new Error(
        "쿠팡이츠 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
  }
  const externalStoreId =
    sessionOverride?.external_shop_id != null &&
    String(sessionOverride.external_shop_id).trim() !== ""
      ? String(sessionOverride.external_shop_id)
      : await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
  if (!externalStoreId) {
    throw new Error(
      "쿠팡이츠 연동 정보(storeId)가 없습니다. 먼저 연동을 진행해 주세요.",
    );
  }

  const playwright = await import("playwright");
  logMemory(`${LOG} before launch`);
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({
      headless: isPlaywrightHeadlessDefault(),
      args: [
        ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
        "--disable-blink-features=AutomationControlled",
      ],
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch({
      headless: isPlaywrightHeadlessDefault(),
      args: [
        ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  logMemory(`${LOG} after launch`);
  logBrowserMemory(browser as unknown, LOG);

  const context = await browser.newContext({
    userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
    viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    extraHTTPHeaders: { ...BROWSER_HEADERS, Referer: REFERER },
  });

  const playCookies = cookies
    .filter(
      (c) => c.name && (c.domain?.includes("coupangeats.com") || !c.domain),
    )
    .map((c) => {
      const domain = c.domain?.trim() || ".coupangeats.com";
      const path = c.path?.trim() && c.path.startsWith("/") ? c.path : "/";
      const value =
        typeof c.value === "string"
          ? c.value.replace(/[\r\n]+/g, " ")
          : String(c.value ?? "");
      return { name: c.name.trim(), value, domain, path };
    })
    .filter((c) => c.name.length > 0);
  if (playCookies.length > 0) await context.addCookies(playCookies);

  const page = await context.newPage();

  return {
    page,
    context,
    browser,
    externalStoreId,
    close: () => closeBrowserWithMemoryLog(browser, LOG),
  };
}

export async function registerCoupangEatsReplyViaBrowser(
  storeId: string,
  userId: string,
  params: RegisterCoupangEatsReplyParams,
  options?: RegisterCoupangEatsReplyOptions,
): Promise<{ orderReviewReplyId?: number }> {
  const session = await createCoupangEatsRegisterReplySession(
    storeId,
    userId,
    options?.sessionOverride,
  );
  try {
    return await doOneCoupangEatsRegisterReply(
      session.page,
      session.externalStoreId,
      params,
    );
  } finally {
    await session.close();
  }
}

// --- 수정/삭제 공통: 리뷰 목록 페이지 로드 (6개월 조회까지). 호출 전에 context에 쿠키 추가 후 page 생성. ---
async function navigateToReviewsList(
  page: import("playwright").Page,
  externalStoreId: string,
): Promise<void> {
  await page.goto(reviewsPageUrlForExternalStore(externalStoreId), {
    waitUntil: "domcontentloaded",
    timeout: 25_000,
  });
  await page.waitForTimeout(3_000);
  await closeReviewsPageModal(page);
  await page.waitForTimeout(2_000);

  const dateTrigger = page.locator('div[class*="eylfi1j5"]').first();
  await dateTrigger
    .waitFor({ state: "visible", timeout: 15_000 })
    .catch(() => null);
  await dateTrigger.click().catch(() => {});
  await page.waitForTimeout(800);
  const sixMonths = page
    .locator('label:has-text("6개월"), input[name="quick"][value="4"]')
    .first();
  await sixMonths.click().catch(() => {});
  await page.waitForTimeout(500);

  await closeReviewsPageModal(page);
  await page.waitForTimeout(1_000);
  await page
    .locator(".dialog-modal-wrapper")
    .waitFor({ state: "hidden", timeout: 6_000 })
    .catch(() => {});
  await page.waitForTimeout(300);

  const searchBtn = page.getByRole("button", { name: "조회" });
  await searchBtn.waitFor({ state: "visible", timeout: 10_000 });
  await closeReviewsPageModal(page);
  await page
    .locator(".dialog-modal-wrapper")
    .waitFor({ state: "hidden", timeout: 6_000 })
    .catch(() => {});
  await page.waitForTimeout(300);

  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/v1/merchant/reviews/search") && r.ok(),
      { timeout: 15_000 },
    ),
    searchBtn.click({ force: true }),
  ]);
  await page.waitForTimeout(2_000);
}

/** 답글이 있는 리뷰의 "답글 행"(수정/삭제 버튼 있는 tr) 인덱스 찾기. reviewRow는 해당 리뷰 tr 인덱스. */
async function findReplyRowIndex(
  page: import("playwright").Page,
  reviewExternalId: string,
  written_at?: string | null,
): Promise<number> {
  const allRows = getReviewTableBodyRows(page);
  const count = await allRows.count();
  const dateStr = written_at ? written_at.slice(0, 10) : "";
  for (let i = 0; i < count - 1; i++) {
    const reviewRow = allRows.nth(i);
    const replyRow = allRows.nth(i + 1);
    const hasModify = await replyRow
      .locator('button:has-text("수정")')
      .first()
      .isVisible()
      .catch(() => false);
    if (!hasModify) continue;
    const reviewText = await reviewRow.innerText().catch(() => "");
    if (reviewExternalId && reviewText.includes(reviewExternalId)) return i + 1;
    if (dateStr && reviewText.includes(dateStr)) return i + 1;
  }
  return -1;
}

export type ModifyCoupangEatsReplyParams = {
  reviewExternalId: string;
  content: string;
  /** 플랫폼 댓글 ID. 없으면 수정 폼 열린 뒤 폼/DOM에서 추출 시도 */
  orderReviewReplyId?: number | string | null;
  written_at?: string | null;
};

export async function modifyCoupangEatsReplyViaBrowser(
  storeId: string,
  userId: string,
  params: ModifyCoupangEatsReplyParams,
  options?: RegisterCoupangEatsReplyOptions,
): Promise<void> {
  const {
    reviewExternalId,
    content,
    orderReviewReplyId: orderReviewReplyIdParam,
    written_at,
  } = params;

  let cookies: CookieItem[];
  if (options?.sessionOverride?.cookies?.length) {
    cookies = options.sessionOverride.cookies;
  } else {
    const stored = await CoupangEatsSession.getCoupangEatsCookies(
      storeId,
      userId,
    );
    if (!stored?.length)
      throw new Error(
        "쿠팡이츠 세션이 없습니다. 먼저 매장 연동을 진행해 주세요.",
      );
    cookies = stored;
  }
  const externalStoreId =
    options?.sessionOverride?.external_shop_id != null &&
    String(options.sessionOverride.external_shop_id).trim() !== ""
      ? String(options.sessionOverride.external_shop_id)
      : await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
  if (!externalStoreId) throw new Error("쿠팡이츠 연동 정보가 없습니다.");

  const playwright = await import("playwright");
  logMemory(`${LOG} modify before launch`);
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({
      headless: isPlaywrightHeadlessDefault(),
      args: [
        ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
        "--disable-blink-features=AutomationControlled",
      ],
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch({
      headless: isPlaywrightHeadlessDefault(),
      args: [
        ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  logMemory(`${LOG} modify after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      extraHTTPHeaders: { ...BROWSER_HEADERS, Referer: REFERER },
    });
    const playCookies = cookies
      .filter(
        (c) => c.name && (c.domain?.includes("coupangeats.com") || !c.domain),
      )
      .map((c) => {
        const domain = c.domain?.trim() || ".coupangeats.com";
        const path = c.path?.trim() && c.path.startsWith("/") ? c.path : "/";
        const value =
          typeof c.value === "string"
            ? c.value.replace(/[\r\n]+/g, " ")
            : String(c.value ?? "");
        return { name: c.name.trim(), value, domain, path };
      })
      .filter((c) => c.name.length > 0);
    if (playCookies.length > 0) await context.addCookies(playCookies);
    const page = await context.newPage();
    await navigateToReviewsList(page, externalStoreId);

    const replyRowIndex = await findReplyRowIndex(
      page,
      reviewExternalId,
      written_at,
    );
    if (replyRowIndex < 0) {
      throw new Error(
        "수정할 답글이 있는 리뷰 행을 찾지 못했습니다. reviewExternalId 또는 written_at을 확인해 주세요.",
      );
    }
    const replyRow = getReviewTableBodyRows(page).nth(replyRowIndex);
    await replyRow.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);

    const modifyApiUrl =
      "https://store.coupangeats.com/api/v1/merchant/reviews/reply/modify";
    const responsePromise = page.waitForResponse(
      (res) => res.url() === modifyApiUrl && res.request().method() === "POST",
      { timeout: 15_000 },
    );

    const modifyBtn = replyRow.locator('button:has-text("수정")').first();
    await modifyBtn.click({ timeout: 10_000 });

    const textarea = page.locator('textarea[name="review"]').first();
    await textarea.waitFor({ state: "visible", timeout: 8_000 });
    const toFill = content.slice(0, 300);
    await textarea.fill(toFill);
    await page.waitForTimeout(400);

    const replyForm = page
      .locator("form")
      .filter({ has: page.locator('textarea[name="review"]') })
      .first();
    const submitBtn = replyForm.getByRole("button", { name: "수정" }).first();
    await submitBtn.click({ timeout: 5_000 });

    const response = await responsePromise;
    const status = response.status();
    let body: { code?: string; error?: string | null } = {};
    try {
      body = (await response.json()) as {
        code?: string;
        error?: string | null;
      };
    } catch {
      // ignore
    }
    if (status < 200 || status >= 300)
      throw new Error(
        `쿠팡이츠 댓글 수정 API 실패: HTTP ${status}. ${body.error ?? ""}`.trim(),
      );
    if (body.code !== "SUCCESS")
      throw new Error(
        `쿠팡이츠 댓글 수정 API 실패: code=${body.code ?? "unknown"}. ${body.error ?? ""}`.trim(),
      );
    await page.waitForTimeout(1_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}

export type DeleteCoupangEatsReplyParams = {
  reviewExternalId: string;
  /** 플랫폼 댓글 ID (삭제 API 필수) */
  orderReviewReplyId: number | string;
  written_at?: string | null;
};

export async function deleteCoupangEatsReplyViaBrowser(
  storeId: string,
  userId: string,
  params: DeleteCoupangEatsReplyParams,
  options?: RegisterCoupangEatsReplyOptions,
): Promise<void> {
  const { reviewExternalId, orderReviewReplyId, written_at } = params;

  let cookies: CookieItem[];
  if (options?.sessionOverride?.cookies?.length) {
    cookies = options.sessionOverride.cookies;
  } else {
    const stored = await CoupangEatsSession.getCoupangEatsCookies(
      storeId,
      userId,
    );
    if (!stored?.length)
      throw new Error(
        "쿠팡이츠 세션이 없습니다. 먼저 매장 연동을 진행해 주세요.",
      );
    cookies = stored;
  }
  const externalStoreId =
    options?.sessionOverride?.external_shop_id != null &&
    String(options.sessionOverride.external_shop_id).trim() !== ""
      ? String(options.sessionOverride.external_shop_id)
      : await CoupangEatsSession.getCoupangEatsStoreId(storeId, userId);
  if (!externalStoreId) throw new Error("쿠팡이츠 연동 정보가 없습니다.");

  const playwright = await import("playwright");
  logMemory(`${LOG} delete before launch`);
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({
      headless: isPlaywrightHeadlessDefault(),
      args: [
        ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
        "--disable-blink-features=AutomationControlled",
      ],
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch({
      headless: isPlaywrightHeadlessDefault(),
      args: [
        ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  logMemory(`${LOG} delete after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
      locale: "ko-KR",
      timezoneId: "Asia/Seoul",
      extraHTTPHeaders: { ...BROWSER_HEADERS, Referer: REFERER },
    });
    const playCookies = cookies
      .filter(
        (c) => c.name && (c.domain?.includes("coupangeats.com") || !c.domain),
      )
      .map((c) => {
        const domain = c.domain?.trim() || ".coupangeats.com";
        const path = c.path?.trim() && c.path.startsWith("/") ? c.path : "/";
        const value =
          typeof c.value === "string"
            ? c.value.replace(/[\r\n]+/g, " ")
            : String(c.value ?? "");
        return { name: c.name.trim(), value, domain, path };
      })
      .filter((c) => c.name.length > 0);
    if (playCookies.length > 0) await context.addCookies(playCookies);
    const page = await context.newPage();
    await navigateToReviewsList(page, externalStoreId);

    const replyRowIndex = await findReplyRowIndex(
      page,
      reviewExternalId,
      written_at,
    );
    if (replyRowIndex < 0) {
      throw new Error(
        "삭제할 답글이 있는 리뷰 행을 찾지 못했습니다. reviewExternalId 또는 written_at을 확인해 주세요.",
      );
    }
    const replyRow = getReviewTableBodyRows(page).nth(replyRowIndex);
    await replyRow.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);

    const deleteApiUrl =
      "https://store.coupangeats.com/api/v1/merchant/reviews/reply/delete";
    const responsePromise = page.waitForResponse(
      (res) => res.url() === deleteApiUrl && res.request().method() === "POST",
      { timeout: 15_000 },
    );

    await replyRow
      .locator('button:has-text("삭제")')
      .first()
      .click({ timeout: 10_000 });

    const modal = page
      .locator(".dialog-modal-wrapper")
      .filter({ hasText: "댓글을 삭제하시겠습니까?" })
      .first();
    await modal.waitFor({ state: "visible", timeout: 5_000 });
    await modal
      .getByRole("button", { name: "확인" })
      .first()
      .click({ timeout: 5_000 });

    const response = await responsePromise;
    const status = response.status();
    let body: { code?: string; error?: string | null } = {};
    try {
      body = (await response.json()) as {
        code?: string;
        error?: string | null;
      };
    } catch {
      // ignore
    }
    if (status < 200 || status >= 300)
      throw new Error(
        `쿠팡이츠 댓글 삭제 API 실패: HTTP ${status}. ${body.error ?? ""}`.trim(),
      );
    if (body.code !== "SUCCESS")
      throw new Error(
        `쿠팡이츠 댓글 삭제 API 실패: code=${body.code ?? "unknown"}. ${body.error ?? ""}`.trim(),
      );
    await page.waitForTimeout(1_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}
