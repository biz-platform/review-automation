import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { getDefaultReviewDateRange, toYYYYMMDD } from "@/lib/utils/review-date-range";
import * as CoupangEatsSession from "./coupang-eats-session-service";

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

export type CoupangEatsReviewItem = {
  orderReviewId: number;
  storeId?: number;
  comment: string;
  rating: number;
  customerName: string;
  createdAt: string;
  [key: string]: unknown;
};

export type CoupangEatsReviewSearchResponse = {
  data?: {
    content?: CoupangEatsReviewItem[];
    total?: number;
    pageNumber?: number;
    pageSize?: number;
  };
  error?: unknown;
  code?: string;
};

/**
 * 저장된 쿠키로 Playwright 브라우저에서 리뷰 API 페이지네이션 호출 후 전체 수집.
 */
export async function fetchAllCoupangEatsReviews(
  storeId: string,
  userId: string,
): Promise<{ list: CoupangEatsReviewItem[]; total: number }> {
  const externalStoreId = await CoupangEatsSession.getCoupangEatsStoreId(
    storeId,
    userId,
  );
  if (!externalStoreId) {
    throw new Error(
      "쿠팡이츠 연동 정보(storeId)가 없습니다. 먼저 연동을 진행해 주세요.",
    );
  }

  const cookies = await CoupangEatsSession.getCoupangEatsCookies(
    storeId,
    userId,
  );
  if (!cookies?.length) {
    throw new Error(
      "저장된 쿠팡이츠 세션이 없습니다. 먼저 연동(로그인)을 진행해 주세요.",
    );
  }

  const { since, to } = getDefaultReviewDateRange();
  const startDateTime = toYYYYMMDD(since);
  const exclusiveEndDateTime = toYYYYMMDD(
    new Date(to.getTime() + 86400000)
  );

  const list = await fetchReviewsWithPlaywright(
    externalStoreId,
    cookies,
    startDateTime,
    exclusiveEndDateTime,
  );
  const total = list.length;

  return { list, total };
}

/** 리뷰 페이지 모달(프로모션/공지/와우 매장 등) 닫기 */
async function closeReviewsPageModal(
  page: import("playwright").Page,
): Promise<void> {
  const tryClose = async (selector: string, timeout = 3_000) => {
    const el = page.locator(selector).first();
    if (await el.isVisible().catch(() => false)) {
      await el.click({ timeout });
      await page.waitForTimeout(500);
      return true;
    }
    return false;
  };

  try {
    // 1) dialog-modal-wrapper(와우 매장 등) — 닫기/확인 버튼 또는 X
    const dialog = page.locator(".dialog-modal-wrapper").first();
    if (await dialog.isVisible().catch(() => false)) {
      const closed =
        (await tryClose('.dialog-modal-wrapper button:has-text("닫기")')) ||
        (await tryClose('.dialog-modal-wrapper button:has-text("확인")')) ||
        (await tryClose('.dialog-modal-wrapper button[aria-label*="닫기"]')) ||
        (await tryClose('.dialog-modal-wrapper [class*="close"]')) ||
        (await tryClose('button[data-testid="Dialog__CloseButton"]'));
      if (!closed) {
        await page.keyboard.press("Escape");
        await page.waitForTimeout(300);
        if (await dialog.isVisible().catch(() => false)) {
          await dialog.locator("> div").first().click({ position: { x: 5, y: 5 }, timeout: 2_000 }).catch(() => {});
        }
      }
      await page.locator(".dialog-modal-wrapper").first().waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
    }

    // 2) 일주일간 보지 않기
    if (await tryClose('div:has-text("일주일간 보지 않기")')) return;

    // 3) 공통 Dialog 닫기 버튼
    await tryClose('button[data-testid="Dialog__CloseButton"]');
  } catch {
    // 모달 없거나 이미 닫힘
  }
}

/**
 * API 직접 호출 시 403이 나므로, 리뷰 페이지에서 사용자처럼
 * "날짜 6개월 → 조회 → 다음 페이지" 클릭 후, 페이지가 보내는 API 응답을 가로채서 수집.
 */
async function fetchReviewsWithPlaywright(
  _externalStoreId: string,
  cookies: CookieItem[],
  _startDateTime: string,
  _exclusiveEndDateTime: string,
): Promise<CoupangEatsReviewItem[]> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const baseOptions: import("playwright").LaunchOptions = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
    ignoreDefaultArgs: ["--enable-automation"],
  };
  logMemory("[coupang-eats] before launch");
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.launch({
      ...baseOptions,
      channel: "chrome",
    });
  } catch {
    browser = await playwright.chromium.launch(baseOptions);
  }
  logMemory("[coupang-eats] after launch");
  logBrowserMemory(browser as unknown, "[coupang-eats] browser");

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
    if (playCookies.length > 0) {
      await context.addCookies(playCookies);
    }

    const page = await context.newPage();
    const collected: CoupangEatsReviewItem[] = [];

    page.on("response", async (response) => {
      const u = response.url();
      if (!u.includes("/api/v1/merchant/reviews/search") || !response.ok())
        return;
      try {
        const body = (await response.json()) as
          | CoupangEatsReviewSearchResponse
          | undefined;
        const content = Array.isArray(body?.data?.content)
          ? body.data.content
          : [];
        for (const item of content) {
          collected.push(item);
        }
      } catch {
        // ignore parse error
      }
    });

    await page.goto(REVIEWS_PAGE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 25_000,
    });
    await page.waitForTimeout(3_000);

    // 리뷰 페이지 모달(프로모션/공지) 닫기 — 모달이 뜰 때까지 기다린 뒤 닫음
    await closeReviewsPageModal(page);
    await page.waitForTimeout(2_000);

    // 날짜 필터 열기 → 6개월 선택
    const dateTrigger = page.locator('div[class*="eylfi1j5"]').first();
    await dateTrigger
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});
    await dateTrigger.click().catch(() => {});
    await page.waitForTimeout(800);

    const sixMonths = page
      .locator('label:has-text("6개월"), input[name="quick"][value="4"]')
      .first();
    await sixMonths.click().catch(() => {});
    await page.waitForTimeout(500);

    // 6개월 조회 클릭 후 나오는 응답만 쓰기 위해 기존 수집 비움
    collected.length = 0;
    await closeReviewsPageModal(page);
    await page.waitForTimeout(500);
    const searchBtn = page.getByRole("button", { name: "조회" });
    await searchBtn
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => {});
    const responsePromise = page
      .waitForResponse(
        (r) => r.url().includes("/api/v1/merchant/reviews/search") && r.ok(),
        { timeout: 15_000 },
      )
      .catch(() => null);
    await searchBtn.click();
    await responsePromise;
    await page.waitForTimeout(2_000);

    // 다음 페이지 버튼으로 페이지네이션 (next가 hide-btn이 될 때까지)
    let nextBtn = page.locator("button.pagination-btn.next-btn:not(.hide-btn)");
    while (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click().catch(() => {});
      await page.waitForTimeout(2_000);
      nextBtn = page.locator("button.pagination-btn.next-btn:not(.hide-btn)");
    }

    await page.waitForTimeout(1_000);

    // orderReviewId 기준 중복 제거 (같은 응답이 두 번 잡힐 수 있음)
    const seen = new Set<number>();
    const deduped = collected.filter((r) => {
      if (seen.has(r.orderReviewId)) return false;
      seen.add(r.orderReviewId);
      return true;
    });

    return deduped;
  } finally {
    await closeBrowserWithMemoryLog(browser, "[coupang-eats]");
  }
}
