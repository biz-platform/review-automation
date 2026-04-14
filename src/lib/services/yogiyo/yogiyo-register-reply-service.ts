/**
 * 요기요 사장님 댓글 등록 (브라우저 자동화 또는 API).
 * 수정/삭제: ceo.yogiyo.co.kr/reviews 페이지에서 타겟 리뷰 찾아 수정·삭제 실행.
 */
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_PAGE_LISTEN_TIMEOUT_MS,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { getDefaultReviewDateRange, toYYYYMMDD } from "@/lib/utils/review-date-range";
import * as YogiyoSession from "./yogiyo-session-service";

const REVIEWS_URL = "https://ceo.yogiyo.co.kr/reviews";
const API_ORIGIN = "https://ceo-api.yogiyo.co.kr";
const LOG = "[yogiyo-reply]";
const DEBUG = process.env.DEBUG_YOGIYO_REPLY === "1";
const MAX_SCROLL_ATTEMPTS = 15;
const SCROLL_PAUSE_MS = 800;

function toPlaywrightCookies(
  cookies: CookieItem[],
): Array<{ name: string; value: string; domain: string; path: string }> {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain ?? "ceo.yogiyo.co.kr",
    path: c.path ?? "/",
  }));
}

/** written_at (YYYY-MM-DD) → 요기요 화면 형식 YYYY.MM.DD */
function toYogiyoDateStr(writtenAt: string | null | undefined): string {
  if (!writtenAt) return "";
  const s = writtenAt.slice(0, 10);
  return s.replace(/-/g, ".");
}

export type RegisterYogiyoReplyParams = {
  reviewExternalId: string;
  content: string;
};

export async function registerYogiyoReplyViaBrowser(
  _storeId: string,
  _userId: string,
  _params: RegisterYogiyoReplyParams,
): Promise<void> {
  throw new Error(
    "요기요 사장님 댓글 등록은 현재 준비 중입니다. 요기요 CEO 앱 또는 웹에서 직접 등록해 주세요.",
  );
}

/** sync(fetchAllYogiyoReviews)와 동일한 180일 구간. API 요청 시 이 파라미터로 덮어씌움. */
function getReviewsQueryParams(): URLSearchParams {
  const { since, to } = getDefaultReviewDateRange();
  return new URLSearchParams({
    create_from: toYYYYMMDD(since),
    create_to: toYYYYMMDD(to),
    no_reply_only: "false",
    page_size: "50",
    page: "0",
  });
}

/** 리뷰 목록 페이지 로드 후 날짜·external_id로 타겟 리뷰 카드(답글 영역 포함) 찾기. 스크롤로 더 불러오며 탐색. */
async function navigateAndFindReplyCard(
  page: import("playwright").Page,
  reviewExternalId: string,
  written_at: string | null | undefined,
  buttonPattern: RegExp,
): Promise<import("playwright").Locator> {
  const params180 = getReviewsQueryParams();
  await page.route(
    (url) => {
      const s = typeof url === "string" ? url : url.toString();
      return s.startsWith(API_ORIGIN) && s.includes("reviews") && s.includes("/v2/");
    },
    async (route) => {
      const req = route.request();
      if (req.method() !== "GET") {
        await route.continue();
        return;
      }
      const u = new URL(req.url());
      u.searchParams.set("create_from", params180.get("create_from")!);
      u.searchParams.set("create_to", params180.get("create_to")!);
      u.searchParams.set("no_reply_only", params180.get("no_reply_only")!);
      u.searchParams.set("page_size", params180.get("page_size")!);
      if (DEBUG) console.log(LOG, "route: rewrite reviews API to 180d", u.toString());
      await route.continue({ url: u.toString() });
    },
  );

  await page.goto(REVIEWS_URL, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_PAGE_LISTEN_TIMEOUT_MS,
  });
  await page.waitForLoadState("networkidle").catch(() => null);
  await page.waitForTimeout(2_000);

  await page
    .locator('[class*="ReviewItem__Container"]')
    .first()
    .waitFor({ state: "visible", timeout: 12_000 })
    .catch(() => null);
  await page.waitForTimeout(1_000);

  const dateStr = toYogiyoDateStr(written_at);
  if (DEBUG) console.log(LOG, "search", { dateStr, reviewExternalId });

  const listContainer = page.locator('[class*="ReviewList"]').first();
  const scrollContainer =
    (await listContainer.count()) > 0
      ? listContainer
      : page.locator("main").first();

  for (let round = 0; round < MAX_SCROLL_ATTEMPTS; round++) {
    const items = page.locator('[class*="ReviewItem__Container"]');
    const count = await items.count();
    console.log(LOG, "round", round + 1, "items", count, "lookingFor", { dateStr, reviewExternalId });
    if (DEBUG) console.log(LOG, "currentUrl", page.url());

    for (let i = 0; i < count; i++) {
      const card = items.nth(i);
      const text = await card.innerText().catch(() => "");
      const hasDate =
        !!dateStr &&
        (text.includes(dateStr) || text.includes(dateStr.replace(/\./g, ". ")));
      const hasId = !!reviewExternalId && text.includes(reviewExternalId);
      const hasButton =
        (await card
          .locator("button")
          .filter({ hasText: buttonPattern })
          .count()) > 0;
      if (DEBUG || hasDate || hasId) {
        console.log(LOG, "card", i, { hasDate, hasId, hasButton, snippet: text.slice(0, 120) });
      }
      if (!hasDate && !hasId) continue;
      if (hasButton) return card;
      if (DEBUG) console.log(LOG, "card", i, "matched date/id but no button");
    }

    const beforeScroll = await items.count();
    await scrollContainer
      .evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      })
      .catch(() => null);
    await page.evaluate(() => window.scrollBy(0, 400)).catch(() => null);
    await page.waitForTimeout(SCROLL_PAUSE_MS);
    const afterScroll = await page
      .locator('[class*="ReviewItem__Container"]')
      .count();
    if (afterScroll <= beforeScroll) break;
  }

  const finalItems = page.locator('[class*="ReviewItem__Container"]');
  const finalCount = await finalItems.count();
  const dump: { index: number; text: string; hasDate: boolean; hasId: boolean; hasButton: boolean }[] = [];
  for (let i = 0; i < Math.min(finalCount, 15); i++) {
    const card = finalItems.nth(i);
    const text = await card.innerText().catch(() => "");
    const hasDate =
      !!dateStr &&
      (text.includes(dateStr) || text.includes(dateStr.replace(/\./g, ". ")));
    const hasId = !!reviewExternalId && text.includes(reviewExternalId);
    const hasButton =
      (await card
        .locator("button")
        .filter({ hasText: buttonPattern })
        .count()) > 0;
    dump.push({ index: i, text: text.slice(0, 200), hasDate, hasId, hasButton });
  }
  const pageUrl = page.url();
  const bodySnippet = await page.locator("body").innerText().then((t) => t.slice(0, 500)).catch(() => "");
  console.error(LOG, "[FAIL] 리뷰 미발견. url:", pageUrl);
  console.error(LOG, "[FAIL] 검색조건:", { dateStr, reviewExternalId });
  console.error(LOG, "[FAIL] 카드 수:", finalCount);
  console.error(LOG, "[FAIL] 카드별 dump:", JSON.stringify(dump, null, 2));
  console.error(LOG, "[FAIL] body 앞 500자:", bodySnippet);

  throw new Error(
    `리뷰를 찾지 못했습니다. (날짜: ${dateStr || "-"}, id: ${reviewExternalId}). 카드 ${finalCount}개 확인. 로그 참고.`,
  );
}

export type ModifyYogiyoReplyParams = {
  reviewExternalId: string;
  content: string;
  written_at?: string | null;
};

export type YogiyoReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; external_shop_id?: string | null };
};

/**
 * 요기요 리뷰 페이지에서 해당 리뷰의 "수정" 클릭 → textarea에 내용 입력 → "등록" 클릭.
 */
export async function modifyYogiyoReplyViaBrowser(
  storeId: string,
  userId: string,
  params: ModifyYogiyoReplyParams,
  options?: YogiyoReplyOptions,
): Promise<void> {
  const { reviewExternalId, content, written_at } = params;

  let cookies: CookieItem[];
  if (options?.sessionOverride?.cookies?.length) {
    cookies = options.sessionOverride.cookies;
  } else {
    const stored = await YogiyoSession.getYogiyoCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "요기요 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
  }

  const playwright = await import("playwright");
  logMemory(`${LOG} modify before launch`);
  const browser = await playwright.chromium.launch({
    headless: isPlaywrightHeadlessDefault(),
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory(`${LOG} modify after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });
    await context.addCookies(toPlaywrightCookies(cookies));
    const page = await context.newPage();

    const card = await navigateAndFindReplyCard(
      page,
      reviewExternalId,
      written_at,
      /수정/,
    );
    await card.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);

    const modifyBtn = card
      .locator("button")
      .filter({ hasText: /수정/ })
      .first();
    await modifyBtn.click({ timeout: 10_000 });

    const textarea = card.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 8_000 });
    await textarea.fill(content.slice(0, 1000));

    const submitBtn = card.getByRole("button", { name: "등록" }).first();
    await submitBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}

export type DeleteYogiyoReplyParams = {
  reviewExternalId: string;
  written_at?: string | null;
};

/**
 * 요기요 리뷰 페이지에서 해당 리뷰의 "삭제" 클릭 → 모달 "삭제하시겠어요?" → "확인" 클릭.
 */
export async function deleteYogiyoReplyViaBrowser(
  storeId: string,
  userId: string,
  params: DeleteYogiyoReplyParams,
  options?: YogiyoReplyOptions,
): Promise<void> {
  const { reviewExternalId, written_at } = params;

  let cookies: CookieItem[];
  if (options?.sessionOverride?.cookies?.length) {
    cookies = options.sessionOverride.cookies;
  } else {
    const stored = await YogiyoSession.getYogiyoCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "요기요 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
  }

  const playwright = await import("playwright");
  logMemory(`${LOG} delete before launch`);
  const browser = await playwright.chromium.launch({
    headless: isPlaywrightHeadlessDefault(),
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory(`${LOG} delete after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });
    await context.addCookies(toPlaywrightCookies(cookies));
    const page = await context.newPage();

    const card = await navigateAndFindReplyCard(
      page,
      reviewExternalId,
      written_at,
      /삭제/,
    );
    await card.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);

    const deleteBtn = card
      .locator("button")
      .filter({ hasText: /삭제/ })
      .first();
    await deleteBtn.click({ timeout: 10_000 });

    const modal = page.getByText("삭제하시겠어요?", { exact: false }).first();
    await modal.waitFor({ state: "visible", timeout: 8_000 });
    const confirmBtn = page.getByRole("button", { name: "확인" }).first();
    await confirmBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}
