import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";

const DEBUG = process.env.DEBUG_YOGIYO_LINK === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[yogiyo-login]", ...args) : undefined;

const LOGIN_URL = "https://ceo.yogiyo.co.kr/login/";
const REVIEWS_URL = "https://ceo.yogiyo.co.kr/reviews";
const API_ORIGIN = "https://ceo-api.yogiyo.co.kr";
const LOGIN_TIMEOUT_MS = 60_000;
const BEARER_COOKIE_NAME = "yogiyo_bearer_token";

export type YogiyoLoginResult = {
  cookies: CookieItem[];
  external_shop_id: string | null;
};

/**
 * Playwright로 요기요 사장님 사이트 로그인 → /reviews 이동 → 가게 ID 추출·Bearer 토큰 수집.
 */
export async function loginYogiyoAndGetCookies(
  username: string,
  password: string
): Promise<YogiyoLoginResult> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요."
    );
  }

  logMemory("[yogiyo] before launch");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  logMemory("[yogiyo] after launch");
  logBrowserMemory(browser as unknown, "[yogiyo] browser");

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    let capturedToken: string | null = null;
    page.on("request", (req) => {
      const u = req.url();
      if (
        u.startsWith(API_ORIGIN) &&
        u.includes("reviews") &&
        req.method() === "GET"
      ) {
        const auth = req.headers()["authorization"];
        if (auth?.startsWith("Bearer ")) {
          capturedToken = auth.slice(7);
          log("captured Bearer token");
        }
      }
    });

    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: LOGIN_TIMEOUT_MS,
    });

    await page
      .locator('input[name="username"]')
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    await page.locator('input[name="username"]').fill(username);
    await page.locator('input[name="password"]').fill(password);

    await page.keyboard.press("Enter");
    await page
      .waitForURL((u) => !u.pathname.includes("/login") || u.pathname === "/", {
        timeout: 25_000,
      })
      .catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});

    const url = page.url();
    if (url.includes("/login")) {
      const errText = await page
        .locator('.error, [role="alert"], [class*="error"]')
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        errText?.trim() || "로그인에 실패했습니다. 아이디·비밀번호를 확인해 주세요."
      );
    }

    const requestPromise = page.waitForRequest(
      (req) =>
        req.url().startsWith(API_ORIGIN) &&
        req.url().includes("reviews") &&
        req.method() === "GET",
      { timeout: 20_000 }
    );
    await page.goto(REVIEWS_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});

    try {
      const req = await requestPromise;
      const auth = req.headers()["authorization"];
      if (auth?.startsWith("Bearer ")) capturedToken = auth.slice(7);
    } catch {
      // timeout; token may already be set by listener
    }

    let vendorId: string | null = null;
    try {
      const vendorEl = page.locator(
        '[class*="StoreSelector__StoreNumber"], p:has-text("ID.")'
      ).first();
      const text = await vendorEl.textContent({ timeout: 5_000 }).catch(() => null);
      if (text) {
        const m = text.match(/ID\.\s*(\d+)/);
        if (m) vendorId = m[1];
      }
    } catch {
      // ignore
    }

    log("vendorId:", vendorId, "token:", !!capturedToken);

    const cookies = await context.cookies();
    const items: CookieItem[] = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
    }));
    if (capturedToken) {
      items.push({
        name: BEARER_COOKIE_NAME,
        value: capturedToken,
        domain: "ceo.yogiyo.co.kr",
        path: "/",
      });
    }
    log("cookies count:", items.length);

    return {
      cookies: items,
      external_shop_id: vendorId,
    };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[yogiyo]");
  }
}
