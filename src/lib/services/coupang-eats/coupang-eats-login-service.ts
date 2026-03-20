import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { COUPANG_EATS_CATEGORY_ID_TO_NAME } from "./coupang-eats-category-map";

const DEBUG = process.env.DEBUG_COUPANG_EATS_LINK === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[coupang-eats-login]", ...args) : undefined;

const GOOGLE_URL = "https://www.google.com";
const STORE_HOME_URL = "https://store.coupangeats.com/";
const LOGIN_URL = "https://store.coupangeats.com/merchant/login";
const STORES_API_URL =
  "https://store.coupangeats.com/api/v1/merchant/web/stores";
const LOGIN_TIMEOUT_MS = 60_000;
const LOGIN_403_RETRY_MAX = 30;
/** 403 또는 이동 없음 시 재시도 전 대기. 연타에 가깝게 0에 가깝게 유지 */
const LOGIN_403_RETRY_WAIT_MS = 0;

export type CoupangEatsLoginResult = {
  cookies: CookieItem[];
  external_shop_id: string | null;
  /** 사업자 등록번호 (stores API data[0].bizNo) */
  business_registration_number?: string | null;
  /** 업종 (stores API data[0].categories → categoryId 매핑) */
  shop_category?: string | null;
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
    headless: true,
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

    // ——— Step 1: 로그인 페이지 진입 (직접 진입 시도 → 실패 시 구글→스토어홈→클릭) ———
    log("Step 1: navigating to login page");
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: 20_000,
    });
    await page.waitForTimeout(1_500);

    let bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    const accessDenied =
      bodyText.includes("Access Denied") ||
      bodyText.includes("errors.edgesuite.net");
    const hasLoginForm = await page
      .locator("#loginId")
      .isVisible()
      .catch(() => false);
    const loginLink = page.locator('a[href="/merchant/login"]').first();
    const hasLoginLink = await loginLink.isVisible().catch(() => false);

    if (accessDenied) {
      log(
        "Step 1: direct login blocked (WAF), using Google → store home → click",
      );
      await page.goto(GOOGLE_URL, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      });
      await page.goto(STORE_HOME_URL, {
        waitUntil: "domcontentloaded",
        timeout: 25_000,
      });
      await page.waitForTimeout(800);
      bodyText = await page
        .locator("body")
        .innerText()
        .catch(() => "");
      if (
        bodyText.includes("Access Denied") ||
        bodyText.includes("errors.edgesuite.net")
      ) {
        throw new Error(
          "쿠팡이츠가 자동 접속을 차단했습니다. 쿠팡이츠 로그인 페이지에서 직접 로그인해 주세요.",
        );
      }
      await loginLink.click({ timeout: 10_000 });
      await page
        .waitForURL((u) => u.pathname.includes("/merchant/login"), {
          timeout: 15_000,
        })
        .catch(() => {});
      await page.waitForTimeout(1_000);
    } else if (!hasLoginForm && hasLoginLink) {
      log("Step 1: on store home, clicking 스토어 로그인 link");
      await loginLink.click({ timeout: 10_000 });
      await page
        .waitForURL((u) => u.pathname.includes("/merchant/login"), {
          timeout: 15_000,
        })
        .catch(() => {});
      await page.waitForTimeout(1_000);
    }

    const step1Url = page.url();
    log("Step 1 done. url:", step1Url);

    bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    if (
      bodyText.includes("Access Denied") ||
      bodyText.includes("errors.edgesuite.net")
    ) {
      throw new Error(
        "쿠팡이츠가 자동 접속을 차단했습니다. 쿠팡이츠 로그인 페이지에서 직접 로그인해 주세요.",
      );
    }

    // 폼이 JS로 렌더되므로 로그인 래퍼·입력란 노출 대기
    try {
      await page
        .locator("#loginId")
        .waitFor({ state: "visible", timeout: 12_000 });
      await page
        .locator("#password")
        .waitFor({ state: "visible", timeout: 5_000 });
    } catch (e) {
      if (DEBUG) {
        const body = await page
          .locator("body")
          .innerHTML()
          .catch(() => "");
        log(
          "Step 1 timeout. body length:",
          body?.length,
          "body snippet:",
          body?.slice(0, 1500),
        );
      }
      throw e;
    }

    const loginIdVisible = await page
      .locator("#loginId")
      .isVisible()
      .catch(() => false);
    const passwordVisible = await page
      .locator("#password")
      .isVisible()
      .catch(() => false);
    log(
      "Step 1 form check: #loginId visible:",
      loginIdVisible,
      "#password visible:",
      passwordVisible,
    );
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

    // 로그인 페이지 JS 준비 대기 (토큰·쿠키 설정 후 제출 시 403 방지)
    await page.waitForTimeout(200);

    const submitBtn = page.locator(
      'button[type="submit"].merchant-submit-btn, button.merchant-submit-btn',
    );
    let loginResponse: Awaited<ReturnType<typeof page.waitForResponse>>;
    let lastStatus = 0;

    // 폼은 한 번만 입력, 재시도 시에는 로그인 버튼만 연타
    log("Step 2: filling credentials once (id length:", username.length, ")");
    await page.locator("#loginId").fill(username);
    await page.locator("#password").fill(password);
    await page.waitForTimeout(50);

    const LOGIN_API_PATH = "/api/v1/merchant/login";
    let step2Url = "";
    for (let attempt = 1; attempt <= LOGIN_403_RETRY_MAX; attempt++) {
      const loginResponsePromise = page.waitForResponse(
        (res) => {
          const req = res.request();
          const ok =
            req.method() === "POST" && req.url().includes(LOGIN_API_PATH);
          if (ok && DEBUG)
            log("Step 2 login response:", res.status(), req.url());
          return ok;
        },
        { timeout: 25_000 },
      );

      log(
        "Step 2: submitting form (attempt",
        attempt,
        "/",
        LOGIN_403_RETRY_MAX,
        ")",
      );
      await submitBtn.click();

      loginResponse = await loginResponsePromise;
      lastStatus = loginResponse.status();
      log("Step 2 login API status:", lastStatus);

      let bodyText: string;
      try {
        bodyText = await loginResponse.text();
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (
          msg.includes("No resource with given identifier") ||
          msg.includes("Network.getResponseBody")
        ) {
          bodyText = "";
          if (DEBUG)
            log(
              "Step 2: response body not available (redirect/CDP), relying on status and URL",
            );
        } else {
          throw e;
        }
      }
      const hasUndefinedDataErrorText = bodyText.includes(
        "Cannot read properties of undefined (reading 'data')",
      );
      if (bodyText) {
        const loginBody = (() => {
          try {
            return JSON.parse(bodyText) as {
              code?: string;
              error?: { code?: string; message?: string };
              message?: string;
            } | null;
          } catch {
            return null;
          }
        })();
        const bodyMessage =
          loginBody?.error?.message ?? loginBody?.message ?? bodyText;
        const hasUndefinedDataErrorInMessage =
          typeof bodyMessage === "string" &&
          bodyMessage.includes(
            "Cannot read properties of undefined (reading 'data')",
          );
        const shouldRetryUndefinedDataError =
          lastStatus === 403 &&
          (hasUndefinedDataErrorText || hasUndefinedDataErrorInMessage) &&
          attempt < LOGIN_403_RETRY_MAX;
        if (shouldRetryUndefinedDataError) {
          log(
            "Step 2: 403 with undefined.data error, waiting",
            LOGIN_403_RETRY_WAIT_MS,
            "ms before retry",
            attempt + 1,
            "/",
            LOGIN_403_RETRY_MAX,
          );
          await page.waitForTimeout(LOGIN_403_RETRY_WAIT_MS);
          continue;
        }
        if (lastStatus === 403 && attempt < LOGIN_403_RETRY_MAX) {
          log(
            "Step 2: 403, ignoring body and retrying",
            attempt + 1,
            "/",
            LOGIN_403_RETRY_MAX,
          );
          await page.waitForTimeout(LOGIN_403_RETRY_WAIT_MS);
          continue;
        }
        if (
          bodyText.includes("Access Denied") ||
          (loginResponse.headers()["content-type"] ?? "").includes("text/html")
        ) {
          throw new Error(
            "쿠팡이츠가 자동 로그인을 차단했습니다. 쿠팡이츠 로그인 페이지에서 직접 로그인해 주세요.",
          );
        }
        if (bodyText.includes("아이디 혹은 비밀번호가 일치하지 않습니다.")) {
          throw new Error("아이디 혹은 비밀번호가 일치하지 않습니다.");
        }
        const loginErrorCode = loginBody?.code ?? loginBody?.error?.code;
        if (loginErrorCode === "50012") {
          const msg =
            loginBody?.error?.message ??
            loginBody?.message ??
            "아이디 혹은 비밀번호가 일치하지 않습니다.";
          throw new Error(
            typeof msg === "string"
              ? msg
              : "아이디 혹은 비밀번호가 일치하지 않습니다.",
          );
        }
        if (loginErrorCode === "10009") {
          const msg =
            loginBody?.error?.message ??
            loginBody?.message ??
            "연속으로 5회 실패하였습니다. 5분 후 다시 시도해주세요. 계정 정보를 잊은 경우, 아이디 찾기/비밀번호 재설정을 진행해주세요.";
          throw new Error(
            typeof msg === "string"
              ? msg
              : "연속으로 5회 실패하였습니다. 5분 후 다시 시도해주세요. 계정 정보를 잊은 경우, 아이디 찾기/비밀번호 재설정을 진행해주세요.",
          );
        }
      }

      if (lastStatus === 403 && attempt < LOGIN_403_RETRY_MAX) {
        log(
          "Step 2: 403(no body), waiting",
          LOGIN_403_RETRY_WAIT_MS,
          "ms before retry",
          attempt + 1,
          "/",
          LOGIN_403_RETRY_MAX,
        );
        await page.waitForTimeout(LOGIN_403_RETRY_WAIT_MS);
        continue;
      }
      if (lastStatus >= 400) break;

      // 2xx: 리다이렉트 대기 후 URL 확인. 안 바뀌면 재시도
      const leftLogin = await page
        .waitForURL((u) => !new URL(u).pathname.includes("login"), {
          timeout: 3_000,
        })
        .then(() => true)
        .catch(() => false);
      await page.waitForLoadState("domcontentloaded").catch(() => {});
      await page.waitForTimeout(80);
      step2Url = page.url();
      log("Step 2 done. leftLogin:", leftLogin, "url:", step2Url);

      if (leftLogin || !step2Url.includes("login")) break;

      if (attempt < LOGIN_403_RETRY_MAX) {
        log(
          "Step 2: 응답 2xx지만 페이지 이동 없음, waiting",
          LOGIN_403_RETRY_WAIT_MS,
          "ms before retry",
          attempt + 1,
          "/",
          LOGIN_403_RETRY_MAX,
        );
        await page.waitForTimeout(LOGIN_403_RETRY_WAIT_MS);
      }
    }

    if (lastStatus === 403) {
      throw new Error(
        "쿠팡이츠가 자동 로그인을 차단했습니다. (403) " +
          `${LOGIN_403_RETRY_MAX}회 재시도 후 실패. 쿠팡이츠 로그인 페이지에서 직접 로그인해 주세요.`,
      );
    }
    if (lastStatus >= 400) {
      throw new Error(
        `로그인 API 오류: ${lastStatus}. 아이디·비밀번호를 확인하거나 쿠팡이츠 로그인 페이지에서 직접 로그인해 주세요.`,
      );
    }

    if (step2Url.includes("login")) {
      const errMsg = await page
        .locator(".form-title, h4, [class*='error']")
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        errMsg?.trim() ||
          `로그인 요청은 수락됐으나 페이지 이동이 없습니다. ${LOGIN_403_RETRY_MAX}회 재시도 후 실패. 잠시 후 다시 시도하거나 쿠팡이츠 로그인 페이지에서 직접 로그인해 주세요.`,
      );
    }

    // ——— Step 3: 쿠키 수집 ———
    log("Step 3: collecting cookies");
    const allCookies = await context.cookies();
    const relevantDomains = [
      ".coupangeats.com",
      "store.coupangeats.com",
      ".store.coupangeats.com",
    ];
    const filtered = allCookies.filter((c) =>
      relevantDomains.some((d) => c.domain === d || c.domain.endsWith(d)),
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
    const keyNames = [
      "access-token",
      "account-id",
      "bm_s",
      "unify-token",
      "device-id",
    ];
    for (const name of keyNames) {
      const found = items.find((c) => c.name === name);
      log(
        "Step 3 cookie",
        name,
        ":",
        found ? `present (len=${found.value.length})` : "absent",
      );
    }

    let external_shop_id: string | null = null;
    try {
      const accountIdCookie = items.find((c) => c.name === "account-id");
      if (accountIdCookie?.value)
        external_shop_id = accountIdCookie.value.trim();
      log(
        "Step 3 external_shop_id from account-id:",
        external_shop_id ?? "(null)",
      );
    } catch {
      // ignore
    }

    // 사업자 번호·업종: stores API (페이지 컨텍스트에서 쿠키 자동 전달)
    let business_registration_number: string | null = null;
    let shop_category: string | null = null;
    try {
      const storesJson = await page.evaluate(async (url: string) => {
        const res = await fetch(url, {
          method: "GET",
          headers: { accept: "application/json" },
          credentials: "include",
        });
        if (!res.ok) return null;
        return (await res.json()) as {
          data?: Array<{
            bizNo?: string;
            categories?: Array<{
              categoryId?: number;
              categoryType?: string;
              mainCategory?: boolean;
            }>;
          }>;
        } | null;
      }, STORES_API_URL);
      const firstStore = storesJson?.data?.[0];
      if (firstStore?.bizNo?.trim()) {
        business_registration_number = firstStore.bizNo.trim();
      }
      const categories = firstStore?.categories;
      if (Array.isArray(categories) && categories.length > 0) {
        const main =
          categories.find((c) => c.mainCategory === true) ?? categories[0];
        const categoryId = main?.categoryId;
        if (
          categoryId != null &&
          categoryId in COUPANG_EATS_CATEGORY_ID_TO_NAME
        ) {
          shop_category =
            COUPANG_EATS_CATEGORY_ID_TO_NAME[
              categoryId as keyof typeof COUPANG_EATS_CATEGORY_ID_TO_NAME
            ] ?? null;
        }
      }
      log("stores API", { business_registration_number, shop_category });
    } catch (e) {
      log("stores API failed", e);
    }

    return {
      cookies: items,
      external_shop_id,
      business_registration_number: business_registration_number ?? undefined,
      shop_category: shop_category ?? undefined,
    };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[coupang-eats]");
  }
}
