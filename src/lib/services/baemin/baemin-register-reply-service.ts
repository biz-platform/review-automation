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
import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";
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
  if (!cookies.length) {
    throw new Error(
      "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
    );
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  logMemory(`${LOG} before launch`);
  const browser = await playwright.chromium.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory(`${LOG} after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });

    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));

    const page = await context.newPage();
    const reviewsPath = `/shops/${shopNo}/reviews`;
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
    const fullUrl = `${SELF_URL}${reviewsPath}?${search}`;
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

    const currentUrl = page.url();
    console.log(LOG, "after load", { currentUrl });

    const bodyText = await page.locator("body").innerText().catch(() => "");
    const bodyContainsId = bodyText.includes(reviewExternalId);
    console.log(LOG, "body contains reviewExternalId", bodyContainsId, "body length", bodyText.length);

    const reviewItemAll = page.locator('[class*="ReviewItem"]');
    const reviewItemCount = await reviewItemAll.count();
    console.log(LOG, "[class*=\"ReviewItem\"] count", reviewItemCount);

    if (reviewItemCount > 0) {
      const firstSnippet = await reviewItemAll.first().innerText().then((t) => t.slice(0, 200)).catch(() => "");
      console.log(LOG, "first ReviewItem text snippet", firstSnippet);
    }

    const reviewCard = page.locator('[class*="ReviewItem"]').filter({
      has: page.getByText(reviewExternalId, { exact: false }),
    });
    const reviewCardCount = await reviewCard.count();
    console.log(LOG, "reviewCard (ReviewItem + has text) count", reviewCardCount);

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
        const afterScrollCount = await page.locator('[class*="ReviewItem"]').count();
        cardVisible = await reviewCard
          .first()
          .isVisible()
          .catch(() => false);
        console.log(LOG, "scroll round", i + 1, "ReviewItem count", afterScrollCount, "cardVisible", cardVisible);
        if (cardVisible) break;
      }
    }

    if (!cardVisible) {
      const finalBodySnippet = bodyText.slice(0, 1500);
      console.log(LOG, "FAIL: body text snippet (first 1500)", finalBodySnippet);
      throw new Error(
        `리뷰(리뷰번호 ${reviewExternalId})를 페이지에서 찾지 못했습니다. 기간/필터를 바꾸거나 나중에 다시 시도해 주세요.`,
      );
    }

    // 목표 리뷰 카드(해당 리뷰번호만 포함한 ReviewItem) 기준으로 같은 행의 버튼만 찾기.
    // 상위 div에서 first() 쓰면 리스트 전체가 잡혀 첫 번째 리뷰(노을 등) 버튼을 누를 수 있으므로, 카드에서 위로 올라가며 버튼이 있는 행만 사용.
    const card = reviewCard.first();
    await card.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);

    const registerBtnText = /사장님\s*댓글\s*등록하기/;
    let row = card.locator("..");
    let registerBtn = row.locator("button").filter({ hasText: registerBtnText }).first();
    for (let up = 0; up < 10; up++) {
      const hasBtn = (await row.locator("button").filter({ hasText: registerBtnText }).count()) > 0;
      if (hasBtn) {
        registerBtn = row.locator("button").filter({ hasText: registerBtnText }).first();
        break;
      }
      row = row.locator("..");
    }

    const registerBtnVisible = await registerBtn.isVisible().catch(() => false);
    if (!registerBtnVisible) {
      let rowModify = card.locator("..");
      let hasModifyBtn = false;
      for (let up = 0; up < 10; up++) {
        if ((await rowModify.locator("button").filter({ hasText: /수정/ }).count()) > 0) {
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
    await registerBtn.click({ timeout: 10_000 });

    // 2) textarea 노출 대기 후 내용 입력
    const textarea = page.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 8_000 });
    await textarea.fill(content);

    // 3) "등록" 버튼 클릭 (댓글 에디터 영역의 등록 버튼)
    const submitBtn = page.getByRole("button", { name: "등록" }).first();
    await submitBtn.click({ timeout: 5_000 });

    // 등록 완료 대기 (폼이 사라지거나 화면이 바뀔 때까지)
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}
