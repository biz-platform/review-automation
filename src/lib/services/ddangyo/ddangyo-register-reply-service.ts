/**
 * 땡겨요 사장님 댓글 등록 — 브라우저 자동화.
 * 리뷰 페이지(#SH0201) 로드 → 목표 리뷰(rview_atcl_no) 행 찾기 → 답글 등록 버튼 클릭 → 입력 후 제출.
 */
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_GOTO_EXTENDED_TIMEOUT_MS,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import * as DdangyoSession from "./ddangyo-session-service";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";

const ORIGIN = "https://boss.ddangyo.com";
const REVIEW_PAGE_URL = "https://boss.ddangyo.com/#SH0201";
const REVIEW_LIST_API = "requestQueryReviewList";
const LOG = "[ddangyo-register-reply]";

export type RegisterDdangyoReplyParams = {
  reviewExternalId: string;
  content: string;
  written_at?: string | null;
};

export type RegisterDdangyoReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; patstoNo: string };
};

function toPlaywrightCookies(
  cookies: CookieItem[],
): Array<{ name: string; value: string; domain: string; path: string }> {
  return cookies.map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain ?? "boss.ddangyo.com",
    path: c.path ?? "/",
  }));
}

export async function registerDdangyoReplyViaBrowser(
  storeId: string,
  userId: string,
  params: RegisterDdangyoReplyParams,
  options?: RegisterDdangyoReplyOptions,
): Promise<void> {
  const { reviewExternalId, content } = params;

  let cookies: CookieItem[];
  let patstoNo: string;
  if (options?.sessionOverride) {
    cookies = options.sessionOverride.cookies;
    patstoNo = options.sessionOverride.patstoNo;
  } else {
    const stored = await DdangyoSession.getDdangyoCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "땡겨요 세션이 없습니다. 먼저 매장 연동(땡겨요 연동)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const no = await DdangyoSession.getDdangyoPatstoNo(storeId, userId);
    if (!no) {
      throw new Error(
        "땡겨요 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    patstoNo = no;
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
    headless: isPlaywrightHeadlessDefault(),
    args: [...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS],
  });
  logMemory(`${LOG} after launch`);
  logBrowserMemory(browser as unknown, LOG);

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });
    await context.addCookies(toPlaywrightCookies(cookies));
    const page = await context.newPage();

    console.log(LOG, "goto review page", REVIEW_PAGE_URL);
    await page.goto(REVIEW_PAGE_URL, {
      waitUntil: "domcontentloaded",
      timeout: PLAYWRIGHT_GOTO_EXTENDED_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle").catch(() => null);

    // 리뷰 메뉴 클릭으로 목록 로드 (연동 시와 동일)
    const reviewMenu = page.locator(
      "#mf_wfm_side_gen_menuParent_1_gen_menuSub_0_btn_child, li#mf_wfm_side_gen_menuParent_1_gen_menuSub_0_grp_child a",
    );
    await reviewMenu.first().waitFor({ state: "visible", timeout: 12_000 }).catch(() => null);
    await reviewMenu.first().click().catch(() => null);
    await page.waitForLoadState("networkidle").catch(() => null);

    // 목표 리뷰 번호(rview_atcl_no)가 보일 때까지 대기
    await page.waitForSelector(`text=${reviewExternalId}`, { timeout: 15_000 }).catch(() => null);
    await page.waitForTimeout(800);

    // 리뷰 행: 리뷰 번호를 포함한 요소에서 상위로 올라가며 "답글" 버튼이 있는 블록 찾기
    const cellWithId = page.getByText(reviewExternalId, { exact: false }).first();
    await cellWithId.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(400);

    let replyBtn = page.locator("button, a, input[type='button']").filter({ hasText: /답글|댓글\s*등록/ }).first();
    let row = cellWithId.locator("..");
    for (let up = 0; up < 12; up++) {
      const btn = row.locator("button, a, input[type='button']").filter({ hasText: /답글|댓글\s*등록/ }).first();
      if ((await btn.count()) > 0 && (await btn.isVisible().catch(() => false))) {
        replyBtn = btn;
        break;
      }
      row = row.locator("..");
    }
    await replyBtn.click({ timeout: 10_000, force: true });

    await page.waitForTimeout(600);
    const textarea = page.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 8_000 });
    await textarea.fill(content);

    const submitBtn = page.getByRole("button", { name: /등록|확인|저장|제출/ }).first();
    await submitBtn.click({ timeout: 8_000, force: true });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}
