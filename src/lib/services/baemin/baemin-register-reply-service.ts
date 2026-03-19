/**
 * 배민 셀프 리뷰 페이지에서 목표 리뷰의 "사장님 댓글 등록하기" 버튼 클릭 → 입력창 활성화 → 내용 입력 → "등록" 클릭.
 */
import * as BaeminSession from "@/lib/services/baemin/baemin-session-service";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import {
  dismissBaeminTodayPopup,
  dismissBaeminBackdropIfPresent,
} from "@/lib/services/baemin/baemin-dismiss-popup";
import { toYYYYMMDD } from "@/lib/utils/review-date-range";

const SELF_URL = "https://self.baemin.com";
const BROWSER_TIMEOUT_MS = 45_000;
const FIND_REVIEW_SCROLL_MS = 800;
const MAX_SCROLL_ATTEMPTS = 20;

function toPlaywrightCookies(
  cookies: CookieItem[],
  origin: string,
): Array<{ name: string; value: string; domain: string; path: string }> {
  const url = new URL(origin);
  const domain =
    url.hostname === "self.baemin.com" ? ".baemin.com" : url.hostname;
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain ?? domain,
    path: c.path ?? "/",
  }));
}

const LOG = "[baemin-register-reply]";

export type RegisterBaeminReplyParams = {
  reviewExternalId: string;
  content: string;
  /** 리뷰 작성일(ISO). 있으면 해당 일자~오늘 기간으로 목록 요청해 목표 리뷰가 포함되도록 함 */
  written_at?: string | null;
};

export type RegisterBaeminReplyOptions = {
  /** baemin_sync처럼 재로그인한 쿠키·shopNo 사용 시 (세션 만료 방지) */
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

/** 워커 배치용: page·shopNo·params만 받아 댓글 1건 등록. (같은 page에서 N건 순차 호출 가능) */
export async function doOneBaeminRegisterReply(
  page: import("playwright").Page,
  shopNo: string,
  params: RegisterBaeminReplyParams,
): Promise<void> {
  const { reviewExternalId, content, written_at } = params;
  const toDate = new Date();
  const fromDate = written_at
    ? new Date(written_at.slice(0, 10))
    : new Date(toDate);
  if (!written_at) {
    fromDate.setDate(fromDate.getDate() - 180);
  }
  const fromStr = toYYYYMMDD(fromDate);
  const toStr = toYYYYMMDD(toDate);
  const search = new URLSearchParams({
    from: fromStr,
    to: toStr,
    offset: "0",
    limit: "20",
  }).toString();
  const fullUrl = `${SELF_URL}/shops/${shopNo}/reviews?${search}`;
  console.log(LOG, "params", {
    reviewExternalId,
    written_at: written_at ?? null,
    from: fromStr,
    to: toStr,
    fullUrl,
  });

  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: BROWSER_TIMEOUT_MS,
  });
  await dismissBaeminTodayPopup(page);
  await page
    .waitForSelector("select option", { state: "attached", timeout: 8_000 })
    .catch(() => null);

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  const reviewCard = page.locator('[class*="ReviewItem"]').filter({
    has: page.getByText(reviewExternalId, { exact: false }),
  });

  let cardVisible = await reviewCard
    .first()
    .isVisible()
    .catch(() => false);
  if (!cardVisible) {
    const scrollStepPx = 600;
    for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
      await page.evaluate((step) => {
        const main = document.querySelector("main");
        if (main && main.scrollHeight > main.clientHeight) {
          main.scrollTop += step;
          return;
        }
        window.scrollBy(0, step);
      }, scrollStepPx);
      await page.waitForTimeout(FIND_REVIEW_SCROLL_MS);
      cardVisible = await reviewCard
        .first()
        .isVisible()
        .catch(() => false);
      if (cardVisible) break;
    }
  }

  if (!cardVisible) {
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})를 페이지에서 찾지 못했습니다. 기간/필터를 바꾸거나 나중에 다시 시도해 주세요.`,
    );
  }

  const card = reviewCard.first();
  await card.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(400);

  const registerBtnText = /사장님\s*댓글\s*등록하기/;
  let row = card.locator("..");
  let registerBtn = row
    .locator("button")
    .filter({ hasText: registerBtnText })
    .first();
  for (let up = 0; up < 10; up++) {
    const hasBtn =
      (await row
        .locator("button")
        .filter({ hasText: registerBtnText })
        .count()) > 0;
    if (hasBtn) {
      registerBtn = row
        .locator("button")
        .filter({ hasText: registerBtnText })
        .first();
      break;
    }
    row = row.locator("..");
  }

  const registerBtnVisible = await registerBtn.isVisible().catch(() => false);
  if (!registerBtnVisible) {
    let rowModify = card.locator("..");
    let hasModifyBtn = false;
    for (let up = 0; up < 10; up++) {
      if (
        (await rowModify
          .locator("button")
          .filter({ hasText: /수정/ })
          .count()) > 0
      ) {
        hasModifyBtn = true;
        break;
      }
      rowModify = rowModify.locator("..");
    }
    if (hasModifyBtn) {
      console.log(LOG, "리뷰에 이미 답글이 등록됨(수정 버튼 있음). 등록 생략.");
      return;
    }
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})에서 '사장님 댓글 등록하기' 버튼을 찾지 못했습니다. 이미 답글이 등록되었거나 UI가 변경되었을 수 있습니다.`,
    );
  }

  const clickRegisterBtn = async (): Promise<void> => {
    await dismissBaeminBackdropIfPresent(page);
    await page.waitForTimeout(400);
    await registerBtn.click({ timeout: 10_000 });
  };

  try {
    await clickRegisterBtn();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("intercepts pointer events") || msg.includes("backdrop")) {
      await dismissBaeminBackdropIfPresent(page);
      await page.waitForTimeout(600);
      await registerBtn.click({ timeout: 10_000 });
    } else {
      throw e;
    }
  }

  const textarea = page.locator("textarea").first();
  await textarea.waitFor({ state: "visible", timeout: 8_000 });
  await textarea.fill(content);

  const submitBtn = page.getByRole("button", { name: "등록" }).first();
  await submitBtn.click({ timeout: 5_000 });
  await page.waitForTimeout(2_000);
}

export type BaeminRegisterReplySession = {
  page: import("playwright").Page;
  context: import("playwright").BrowserContext;
  browser: import("playwright").Browser;
  shopNo: string;
  close: () => Promise<void>;
};

/** 워커 배치용: 브라우저 launch + context + cookies + newPage 까지 수행. close() 시 브라우저 종료. */
export async function createBaeminRegisterReplySession(
  storeId: string,
  userId: string,
  sessionOverride?: { cookies: CookieItem[]; shopNo: string },
): Promise<BaeminRegisterReplySession> {
  let cookies: CookieItem[];
  let shopNo: string;
  if (sessionOverride) {
    cookies = sessionOverride.cookies;
    shopNo = sessionOverride.shopNo;
  } else {
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const id = await BaeminSession.getBaeminShopId(storeId, userId);
    if (!id) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    shopNo = id;
  }
  if (!cookies.length) {
    throw new Error(
      "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
    );
  }

  const playwright = await import("playwright").catch(() => {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  });

  const headless = process.env.DEBUG_BROWSER_HEADED !== "1";
  logMemory(`${LOG} before launch`);
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory(`${LOG} after launch`);
  logBrowserMemory(browser as unknown, LOG);

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });
  await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
  const page = await context.newPage();

  return {
    page,
    context,
    browser,
    shopNo,
    close: () => closeBrowserWithMemoryLog(browser, LOG),
  };
}

/**
 * 배민 리뷰 페이지 접속 후 해당 리뷰 카드에서
 * "사장님 댓글 등록하기" 클릭 → textarea 활성화 → 내용 입력 → "등록" 클릭.
 * sessionOverride 없으면 DB 저장 쿠키 사용, 있으면 해당 쿠키·shopNo 사용(재로그인 시).
 */
export async function registerBaeminReplyViaBrowser(
  storeId: string,
  userId: string,
  params: RegisterBaeminReplyParams,
  options?: RegisterBaeminReplyOptions,
): Promise<void> {
  const session = await createBaeminRegisterReplySession(
    storeId,
    userId,
    options?.sessionOverride,
  );
  try {
    await doOneBaeminRegisterReply(session.page, session.shopNo, params);
  } finally {
    await session.close();
  }
}

// --- 수정/삭제 공통: 리뷰 페이지 로드 후 목표 리뷰 카드·버튼 행 찾기 (등록과 동일한 URL/스크롤 로직)
async function navigateToBaeminReviewsAndFindRow(
  page: import("playwright").Page,
  shopNo: string,
  reviewExternalId: string,
  written_at: string | null | undefined,
  buttonText: RegExp | string,
): Promise<{
  card: import("playwright").Locator;
  row: import("playwright").Locator;
}> {
  const toDate = new Date();
  const fromDate = written_at
    ? new Date(written_at.slice(0, 10))
    : new Date(toDate);
  if (!written_at) {
    fromDate.setDate(fromDate.getDate() - 180);
  }
  const fromStr = toYYYYMMDD(fromDate);
  const toStr = toYYYYMMDD(toDate);
  const search = new URLSearchParams({
    from: fromStr,
    to: toStr,
    offset: "0",
    limit: "20",
  }).toString();
  const fullUrl = `${SELF_URL}/shops/${shopNo}/reviews?${search}`;
  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: BROWSER_TIMEOUT_MS,
  });
  await dismissBaeminTodayPopup(page);
  await page
    .waitForSelector("select option", { state: "attached", timeout: 8_000 })
    .catch(() => null);

  const reviewCard = page.locator('[class*="ReviewItem"]').filter({
    has: page.getByText(reviewExternalId, { exact: false }),
  });
  let cardVisible = await reviewCard
    .first()
    .isVisible()
    .catch(() => false);
  if (!cardVisible) {
    const scrollStepPx = 600;
    for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
      await page.evaluate((step) => {
        const main = document.querySelector("main");
        if (main && main.scrollHeight > main.clientHeight) {
          main.scrollTop += step;
          return;
        }
        window.scrollBy(0, step);
      }, scrollStepPx);
      await page.waitForTimeout(FIND_REVIEW_SCROLL_MS);
      cardVisible = await reviewCard
        .first()
        .isVisible()
        .catch(() => false);
      if (cardVisible) break;
    }
  }
  if (!cardVisible) {
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})를 페이지에서 찾지 못했습니다.`,
    );
  }

  const card = reviewCard.first();
  await card.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(400);

  const pattern =
    typeof buttonText === "string" ? new RegExp(buttonText) : buttonText;
  let row = card.locator("..");
  let found = false;
  for (let up = 0; up < 10; up++) {
    const hasBtn =
      (await row.locator("button").filter({ hasText: pattern }).count()) > 0;
    if (hasBtn) {
      found = true;
      break;
    }
    row = row.locator("..");
  }
  if (!found) {
    throw new Error(
      `삭제/수정할 답글이 있는 리뷰 행을 찾지 못했습니다. 리뷰번호: ${reviewExternalId}. ` +
        "리뷰가 이미 삭제되었거나, 해당 페이지 목록에 없을 수 있습니다. 실시간 리뷰 불러오기 후 다시 시도해 보세요.",
    );
  }
  return { card, row };
}

export type ModifyBaeminReplyParams = {
  reviewExternalId: string;
  content: string;
  written_at?: string | null;
};

export type ModifyBaeminReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

/**
 * 배민 리뷰 페이지에서 해당 리뷰의 "수정" 클릭 → textarea에 새 내용 입력 → "저장" 클릭.
 */
export async function modifyBaeminReplyViaBrowser(
  storeId: string,
  userId: string,
  params: ModifyBaeminReplyParams,
  options?: ModifyBaeminReplyOptions,
): Promise<void> {
  const { reviewExternalId, content, written_at } = params;

  let cookies: CookieItem[];
  let shopNo: string;
  if (options?.sessionOverride) {
    cookies = options.sessionOverride.cookies;
    shopNo = options.sessionOverride.shopNo;
  } else {
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const id = await BaeminSession.getBaeminShopId(storeId, userId);
    if (!id) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    shopNo = id;
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const headless = process.env.DEBUG_BROWSER_HEADED !== "1";
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
    const page = await context.newPage();

    const { row } = await navigateToBaeminReviewsAndFindRow(
      page,
      shopNo,
      reviewExternalId,
      written_at,
      /수정/,
    );

    await dismissBaeminBackdropIfPresent(page);
    const modifyBtn = row.locator("button").filter({ hasText: /수정/ }).first();
    await modifyBtn.click({ timeout: 10_000, force: true });

    const textarea = row.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 8_000 });
    await textarea.fill(content);

    const saveBtn = row.getByRole("button", { name: "저장" }).first();
    await saveBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}

export type DeleteBaeminReplyParams = {
  reviewExternalId: string;
  written_at?: string | null;
};

export type DeleteBaeminReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

/**
 * 배민 리뷰 페이지에서 해당 리뷰의 "삭제" 클릭 → 모달 "선택하신 댓글을 삭제하시겠습니까?" → "확인" 클릭.
 */
export async function deleteBaeminReplyViaBrowser(
  storeId: string,
  userId: string,
  params: DeleteBaeminReplyParams,
  options?: DeleteBaeminReplyOptions,
): Promise<void> {
  const { reviewExternalId, written_at } = params;

  let cookies: CookieItem[];
  let shopNo: string;
  if (options?.sessionOverride) {
    cookies = options.sessionOverride.cookies;
    shopNo = options.sessionOverride.shopNo;
  } else {
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const id = await BaeminSession.getBaeminShopId(storeId, userId);
    if (!id) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    shopNo = id;
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const headless = process.env.DEBUG_BROWSER_HEADED !== "1";
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
    const page = await context.newPage();

    const { row } = await navigateToBaeminReviewsAndFindRow(
      page,
      shopNo,
      reviewExternalId,
      written_at,
      /삭제/,
    );

    await dismissBaeminBackdropIfPresent(page);
    const deleteBtn = row.locator("button").filter({ hasText: /삭제/ }).first();
    try {
      await deleteBtn.click({ timeout: 10_000, force: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Timeout") || msg.includes("exceeded")) {
        throw new Error(
          `리뷰번호: ${reviewExternalId}. ` +
            "리뷰가 이미 삭제되었거나 화면 목록에 없을 수 있습니다.",
        );
      }
      throw e;
    }

    const modal = page.getByRole("alertdialog").filter({
      has: page.getByText("선택하신 댓글을 삭제하시겠습니까?", {
        exact: false,
      }),
    });
    await modal.waitFor({ state: "visible", timeout: 8_000 });
    const confirmBtn = modal.getByRole("button", { name: "확인" }).first();
    await confirmBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}
