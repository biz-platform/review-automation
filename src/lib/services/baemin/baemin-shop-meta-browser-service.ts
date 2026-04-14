/**
 * 전체 리뷰 스크롤 없이 리뷰 페이지의 매장 select만 읽어 shop_name / shop_category 수집.
 * 동기화 테스트용(대량 리뷰 매장에서 빠르게 메타만 검증).
 */
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_GOTO_SHORT_TIMEOUT_MS,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";
import {
  parseCategoryFromBaeminShopOptionText,
  parseShopNameFromBaeminShopOptionText,
} from "@/lib/services/baemin/baemin-shop-option-label";

const SELF_URL = "https://self.baemin.com";

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

export type BaeminShopMetaRow = {
  shopNo: string;
  shop_name: string | null;
  shop_category: string | null;
  /** 파싱 실패·페이지 오류 시만 */
  error?: string;
};

/**
 * 저장된 셀프서비스 쿠키로, 매장별 리뷰 URL 1회 로드만 수행 (스크롤·fetchAll 없음).
 */
export async function fetchBaeminShopMetaBatchViaBrowser(
  cookies: CookieItem[],
  shopNos: string[],
): Promise<BaeminShopMetaRow[]> {
  const uniq = [...new Set(shopNos.map((s) => String(s).trim()).filter(Boolean))];
  if (uniq.length === 0 || cookies.length === 0) return [];

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. pnpm exec playwright install chromium",
    );
  }

  const headless = isPlaywrightHeadlessDefault();
  logMemory("[baemin-shop-meta] before launch");
  const browser = await playwright.chromium.launch({
    headless,
    args: [...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS],
  });

  const from = new Date();
  from.setDate(from.getDate() - 7);
  const fromStr = from.toISOString().slice(0, 10);
  const toStr = new Date().toISOString().slice(0, 10);
  const search = new URLSearchParams({
    from: fromStr,
    to: toStr,
    offset: "0",
    limit: "1",
  }).toString();

  const out: BaeminShopMetaRow[] = [];

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });
    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
    const page = await context.newPage();

    for (const shopNo of uniq) {
      try {
        await page.goto(
          `${SELF_URL}/shops/${encodeURIComponent(shopNo)}/reviews?${search}`,
          {
            waitUntil: "domcontentloaded",
            timeout: PLAYWRIGHT_GOTO_SHORT_TIMEOUT_MS,
          },
        );
        await dismissBaeminTodayPopup(page);
        await page
          .waitForSelector("select option", {
            state: "attached",
            timeout: 8_000,
          })
          .catch(() => null);

        const optionLabel = await page
          .locator(`select option[value="${shopNo}"]`)
          .first()
          .textContent({ timeout: 5_000 })
          .catch(() => null);
        const trimmed = optionLabel?.trim() ?? null;
        if (!trimmed) {
          out.push({
            shopNo,
            shop_name: null,
            shop_category: null,
            error: "select option 텍스트 없음",
          });
          continue;
        }
        out.push({
          shopNo,
          shop_name: parseShopNameFromBaeminShopOptionText(trimmed),
          shop_category: parseCategoryFromBaeminShopOptionText(trimmed),
        });
      } catch (e) {
        out.push({
          shopNo,
          shop_name: null,
          shop_category: null,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }
  } finally {
    await closeBrowserWithMemoryLog(browser, "[baemin-shop-meta]");
  }

  return out;
}
