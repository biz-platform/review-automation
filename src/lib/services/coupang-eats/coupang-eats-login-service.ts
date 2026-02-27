import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";

const DEBUG = process.env.DEBUG_COUPANG_EATS_LINK === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[coupang-eats-login]", ...args) : undefined;

const GOOGLE_URL = "https://www.google.com";
const STORE_HOME_URL = "https://store.coupangeats.com/";
const LOGIN_URL = "https://store.coupangeats.com/merchant/login";
const LOGIN_TIMEOUT_MS = 60_000;

export type CoupangEatsLoginResult = {
  cookies: CookieItem[];
  external_shop_id: string | null;
};

/**
 * 1) 구글 → 스토어 메인 → "스토어 로그인" 클릭으로 로그인 페이지 진입 (WAF 회피 시도)
 * 2) 아이디/비밀번호 입력 후 로그인
 * 3) 로그인 후 필요 쿠키 저장
 */
export async function loginCoupangEatsAndGetCookies(
  username: string,
  password: string,
): Promise<CoupangEatsLoginResult> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  logMemory("[coupang-eats] before launch");
  const launchOptions = {
    headless: false,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-blink-features=AutomationControlled",
      "--disable-dev-shm-usage",
    ],
  };
  let browser: Awaited<ReturnType<typeof playwright.chromium.launch>>;
  try {
    browser = await playwright.chromium.launch({
      ...launchOptions,
      channel: "chrome",
    });
    log("Using system Chrome (channel: chrome)");
  } catch {
    browser = await playwright.chromium.launch(launchOptions);
    log("Chrome not found, using bundled Chromium");
  }
  logMemory("[coupang-eats] after launch");
  logBrowserMemory(browser as unknown, "[coupang-eats] browser");

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
      ignoreHTTPSErrors: true,
      javaScriptEnabled: true,
      // 봇 탐지 완화 (쿠팡이츠가 헤드리스에서 다른 페이지를 줄 수 있음)
      bypassCSP: true,
    });
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });
    const page = await context.newPage();

    // ——— Step 1: 구글 → 스토어 메인 → "스토어 로그인" 클릭으로 로그인 페이지 진입 ———
    log("Step 1a: navigating to Google");
    await page.goto(GOOGLE_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
    log("Step 1b: navigating to store home (referrer=Google)");
    await page.goto(STORE_HOME_URL, {
      waitUntil: "load",
      timeout: LOGIN_TIMEOUT_MS,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    const afterHomeUrl = page.url();
    log("Step 1b done. url:", afterHomeUrl);

    let bodyText = await page.locator("body").innerText().catch(() => "");
    if (bodyText.includes("Access Denied") || bodyText.includes("errors.edgesuite.net")) {
      throw new Error(
        "쿠팡이츠가 자동 접속을 차단했습니다. (WAF) 브라우저에서 직접 로그인한 뒤, 개발자 도구에서 쿠키를 복사해 '쿠키 수동 등록'으로 연동해 주세요.",
      );
    }

    log("Step 1c: clicking 스토어 로그인 link");
    await page
      .locator('a[href="/merchant/login"].main__btn--login, a.main__btn.main__btn--login[href="/merchant/login"], a[href="/merchant/login"]')
      .first()
      .click({ timeout: 10_000 });
    await page.waitForURL((u) => u.pathname.includes("/merchant/login"), { timeout: 15_000 }).catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});
    const step1Url = page.url();
    log("Step 1c done. url:", step1Url);

    bodyText = await page.locator("body").innerText().catch(() => "");
    if (bodyText.includes("Access Denied") || bodyText.includes("errors.edgesuite.net")) {
      throw new Error(
        "쿠팡이츠가 자동 접속을 차단했습니다. (WAF) 브라우저에서 직접 로그인한 뒤, 개발자 도구에서 쿠키를 복사해 '쿠키 수동 등록'으로 연동해 주세요.",
      );
    }

    // 폼이 JS로 렌더되므로 로그인 래퍼·입력란 노출 대기
    try {
      await page
        .locator(".login-wrapper")
        .first()
        .waitFor({ state: "visible", timeout: 25_000 });
      await page
        .locator("#loginId")
        .waitFor({ state: "visible", timeout: 10_000 });
    } catch (e) {
      if (DEBUG) {
        const body = await page.locator("body").innerHTML().catch(() => "");
        log("Step 1 timeout. body length:", body?.length, "body snippet:", body?.slice(0, 1500));
      }
      throw e;
    }

    const loginIdVisible = await page.locator("#loginId").isVisible().catch(() => false);
    const passwordVisible = await page.locator("#password").isVisible().catch(() => false);
    log("Step 1 form check: #loginId visible:", loginIdVisible, "#password visible:", passwordVisible);
    if (!loginIdVisible || !passwordVisible) {
      const htmlSnippet = await page
        .locator(".login-wrapper")
        .first()
        .innerHTML()
        .catch(() => "");
      log("Step 1 form HTML snippet length:", htmlSnippet?.length ?? 0);
      throw new Error(
        "로그인 폼을 찾을 수 없습니다. 쿠팡이츠 로그인 페이지 구조가 변경되었을 수 있습니다.",
      );
    }

    // 로그인 페이지 JS/API 준비 대기 (토큰·쿠키 설정 후 제출해야 403 방지)
    await page.waitForLoadState("networkidle").catch(() => {});
    await new Promise((r) => setTimeout(r, 2_000));

    // ——— Step 2: 입력 및 로그인 ———
    log("Step 2: filling credentials (id length:", username.length, ")");
    await page.locator("#loginId").fill(username);
    await page.locator("#password").fill(password);
    await new Promise((r) => setTimeout(r, 500));
    log("Step 2: submitting form");

    // 로그인은 동적 경로 POST → 202 Accepted. 403이면 서버가 자동화 차단.
    const loginResponsePromise = page.waitForResponse(
      (res) => {
        const u = res.url();
        const ok = res.request().method() === "POST" && u.startsWith("https://store.coupangeats.com/") && !u.includes("/weblog/");
        if (ok && DEBUG) log("Step 2 login response:", res.status(), u.slice(0, 80));
        return ok;
      },
      { timeout: 25_000 },
    );

    await page.locator('button[type="submit"].merchant-submit-btn, button.merchant-submit-btn').click();

    const loginResponse = await loginResponsePromise;
    const status = loginResponse.status();
    log("Step 2 login API status:", status);

    if (status === 403) {
      throw new Error(
        "쿠팡이츠가 자동 로그인을 차단했습니다. (403) '쿠키 수동 등록'으로 연동해 주세요.",
      );
    }
    if (status >= 400) {
      throw new Error(`로그인 API 오류: ${status}. 아이디·비밀번호를 확인하거나 '쿠키 수동 등록'을 이용해 주세요.`);
    }

    // 202 등 성공 후 URL 변경 또는 리다이렉트 대기
    const success = await page
      .waitForURL((u) => !new URL(u).pathname.includes("login"), { timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    await page.waitForLoadState("networkidle").catch(() => {});

    const step2Url = page.url();
    log("Step 2 done. success:", success, "url:", step2Url);

    if (step2Url.includes("login")) {
      const errMsg = await page
        .locator(".form-title, h4, [class*='error']")
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        errMsg?.trim() ||
          "로그인 요청은 수락됐으나 페이지 이동이 없습니다. 잠시 후 다시 시도하거나 '쿠키 수동 등록'을 이용해 주세요.",
      );
    }

    // ——— Step 3: 쿠키 수집 ———
    log("Step 3: collecting cookies");
    const allCookies = await context.cookies();
    const relevantDomains = [".coupangeats.com", "store.coupangeats.com", ".store.coupangeats.com"];
    const filtered = allCookies.filter(
      (c) => relevantDomains.some((d) => c.domain === d || c.domain.endsWith(d)),
    );
    const items: CookieItem[] = filtered.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
    }));

    log(
      "Step 3 done. all cookies:",
      allCookies.length,
      "relevant:",
      items.length,
      "names:",
      items.map((c) => c.name).join(", "),
    );
    const keyNames = ["access-token", "account-id", "bm_s", "unify-token", "device-id"];
    for (const name of keyNames) {
      const found = items.find((c) => c.name === name);
      log("Step 3 cookie", name, ":", found ? `present (len=${found.value.length})` : "absent");
    }

    let external_shop_id: string | null = null;
    try {
      const accountIdCookie = items.find((c) => c.name === "account-id");
      if (accountIdCookie?.value) external_shop_id = accountIdCookie.value.trim();
      log("Step 3 external_shop_id from account-id:", external_shop_id ?? "(null)");
    } catch {
      // ignore
    }

    return { cookies: items, external_shop_id };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[coupang-eats]");
  }
}
