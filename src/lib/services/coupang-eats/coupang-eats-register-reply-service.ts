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
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import * as CoupangEatsSession from "./coupang-eats-session-service";
import { closeReviewsPageModal } from "./coupang-eats-review-service";
import { COUPANG_EATS_REPLY_REGISTER_RESTRICTED_USER_MESSAGE } from "./coupang-eats-reply-user-messages";

const REVIEWS_PAGE_URL =
  "https://store.coupangeats.com/merchant/management/reviews";
const REFERER = "https://store.coupangeats.com/merchant/management/reviews";
const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36";
const BROWSER_HEADERS = {
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "sec-ch-ua":
    '"Not:A-Brand";v="99", "Google Chrome";v="145", "Chromium";v="145"',
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

/**
 * 일부 매장/뷰포트에서 리뷰 행 `<tr>` 안에 등록 CTA가 DOM에 없음(스크린샷엔 보일 수 있음).
 * 브라우저 컨텍스트 쿠키로 merchant API 직접 호출 — UI와 동일 엔드포인트.
 */
async function submitCoupangEatsReplyViaMerchantApi(
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
    error?: string | null;
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
    throw new Error(
      `HTTP ${status}. ${json.error ?? res.statusText()}`.trim(),
    );
  }
  if (json.code !== "SUCCESS") {
    throw new Error(
      `code=${json.code ?? "unknown"}. ${json.error ?? ""}`.trim(),
    );
  }
  const orderReviewReplyId = json.data?.orderReviewReplyId;
  return orderReviewReplyId != null ? { orderReviewReplyId } : {};
}

export type RegisterCoupangEatsReplyParams = {
  reviewExternalId: string;
  content: string;
  /** 리뷰 작성일(YYYY-MM-DD). 목록에서 해당 일자 포함해 찾을 때 사용 */
  written_at?: string | null;
};

export type RegisterCoupangEatsReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; external_shop_id?: string | null };
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

  await page.goto(REVIEWS_PAGE_URL, {
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

  const targetIdNum = Number(reviewExternalId);
  const targetIdStr = String(reviewExternalId);
  const searchUrl = "/api/v1/merchant/reviews/search";
  let rowIndexFromApi = -1;
  let matchedPageIndex = -1;
  let matchedSearchContentIds: number[] = [];

  for (let pageIndex = 0; pageIndex < MAX_PAGE_ATTEMPTS; pageIndex++) {
    const responsePromise = page.waitForResponse(
      (r) => r.url().includes(searchUrl) && r.ok(),
      { timeout: 15_000 },
    );
    if (pageIndex === 0) {
      await searchBtn.click({ force: true });
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
      await nextBtn.click().catch(() => {});
    }
    const response = await responsePromise;
    await stabilizeReviewTableAfterSearch(page);
    let content: { orderReviewId?: number }[] = [];
    try {
      const body = (await response.json()) as {
        data?: { content?: { orderReviewId?: number }[] };
      };
      content = Array.isArray(body?.data?.content) ? body.data.content : [];
    } catch {
      // ignore
    }
    if (DEBUG)
      debugLog("reviews/search captured", {
        pageIndex,
        length: content.length,
        ids: content.map((c) => c.orderReviewId).slice(0, 10),
      });
    const idx = content.findIndex(
      (c) =>
        c.orderReviewId === targetIdNum ||
        String(c.orderReviewId) === targetIdStr,
    );
    if (idx >= 0) {
      rowIndexFromApi = idx;
      matchedPageIndex = pageIndex;
      matchedSearchContentIds = content
        .map((c) => c.orderReviewId)
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
  const toFill = params.content.slice(0, 300);
  await textarea.fill(toFill);
  await page.waitForTimeout(400);

  const replyResponsePromise = page.waitForResponse(
    (res) => res.url() === MERCHANT_REPLY_POST_URL && res.request().method() === "POST",
    { timeout: 15_000 },
  );

  const replyForm = page
    .locator("form")
    .filter({ has: page.locator('textarea[name="review"]') })
    .first();
  const submitBtn = replyForm.getByRole("button", { name: "등록" }).first();
  await submitBtn.click({ timeout: 5_000 });

  const response = await replyResponsePromise;
  const status = response.status();
  let body: {
    code?: string;
    error?: string | null;
    data?: { orderReviewReplyId?: number };
  } = {};
  try {
    body = (await response.json()) as typeof body;
  } catch {
    // ignore
  }
  if (status < 200 || status >= 300) {
    throw new Error(
      `쿠팡이츠 댓글 등록 API 실패: HTTP ${status}. ${body.error ?? ""}`.trim(),
    );
  }
  if (body.code !== "SUCCESS") {
    throw new Error(
      `쿠팡이츠 댓글 등록 API 실패: code=${body.code ?? "unknown"}. ${body.error ?? ""}`.trim(),
    );
  }
  const orderReviewReplyId = body.data?.orderReviewReplyId;
  await page.waitForTimeout(1_000);
  return orderReviewReplyId != null ? { orderReviewReplyId } : {};
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
  sessionOverride?: { cookies: CookieItem[]; external_shop_id?: string | null },
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
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  logMemory(`${LOG} after launch`);
  logBrowserMemory(browser as unknown, LOG);

  const context = await browser.newContext({
    userAgent: BROWSER_USER_AGENT,
    viewport: { width: 1280, height: 720 },
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
): Promise<void> {
  await page.goto(REVIEWS_PAGE_URL, {
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

  const responsePromise = page.waitForResponse(
    (r) => r.url().includes("/api/v1/merchant/reviews/search") && r.ok(),
    { timeout: 15_000 },
  );
  await searchBtn.click({ force: true });
  await responsePromise;
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
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  logMemory(`${LOG} modify after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: BROWSER_USER_AGENT,
      viewport: { width: 1280, height: 720 },
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
    await navigateToReviewsList(page);

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
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-blink-features=AutomationControlled",
      ],
    });
  }
  logMemory(`${LOG} delete after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: BROWSER_USER_AGENT,
      viewport: { width: 1280, height: 720 },
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
    await navigateToReviewsList(page);

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
