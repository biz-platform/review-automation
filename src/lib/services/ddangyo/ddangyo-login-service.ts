import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";

const DEBUG =
  process.env.DEBUG_DDANGYO === "1" || process.env.DEBUG_DDANGYO_LINK === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[ddangyo-login]", ...args) : undefined;

const LOGIN_URL = "https://boss.ddangyo.com/";
const ORIGIN = "https://boss.ddangyo.com";
const REVIEW_PAGE_URL = "https://boss.ddangyo.com/#SH0201";
const LOGIN_TIMEOUT_MS = 60_000;
const REVIEW_LIST_API = "requestQueryReviewList";

export type DdangyoLoginResult = {
  cookies: CookieItem[];
  external_shop_id: string | null;
};

/**
 * Playwright로 땡겨요 사장님라운지 로그인 → 리뷰관리 클릭 → requestQueryReviewList 요청에서 patsto_no 추출·쿠키 수집.
 */
export async function loginDdangyoAndGetCookies(
  username: string,
  password: string,
): Promise<DdangyoLoginResult> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  logMemory("[ddangyo] before launch");
  const browser = await playwright.chromium.launch({
    headless: !DEBUG,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  logMemory("[ddangyo] after launch");
  logBrowserMemory(browser as unknown, "[ddangyo] browser");

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    let capturedPatstoNo: string | null = null;
    page.on("request", (req) => {
      if (
        req.url().includes(REVIEW_LIST_API) &&
        req.method() === "POST" &&
        req.postData()
      ) {
        try {
          const body = JSON.parse(req.postData()!);
          const no = body?.dma_reqParam?.patsto_no;
          if (no && String(no).trim()) {
            capturedPatstoNo = String(no).trim();
            log(
              "request listener: captured patsto_no",
              capturedPatstoNo,
              "url",
              req.url(),
            );
          }
        } catch {
          // ignore
        }
      }
    });

    console.log("[ddangyo-login] 1. goto", LOGIN_URL);
    await page.goto(LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: LOGIN_TIMEOUT_MS,
    });

    console.log("[ddangyo-login] 2. wait login form");
    await page
      .locator("#mf_ibx_mbrId")
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    console.log("[ddangyo-login] 3. fill & submit");
    await page.locator("#mf_ibx_mbrId").fill(username);
    await page.locator("#mf_sct_pwd").fill(password);

    await page.keyboard.press("Enter");
    await page
      .waitForURL((u) => !u.pathname.includes("login") || u.pathname === "/", {
        timeout: 25_000,
      })
      .catch(() => {});
    await page.waitForLoadState("networkidle").catch(() => {});

    const url = page.url();
    console.log("[ddangyo-login] 4. after login url", url);
    if (url.includes("login") && !url.includes("boss.ddangyo.com/")) {
      const errText = await page
        .locator('.error, [role="alert"], .w2err')
        .first()
        .textContent()
        .catch(() => null);
      throw new Error(
        errText?.trim() ||
          "로그인에 실패했습니다. 아이디·비밀번호를 확인해 주세요.",
      );
    }

    console.log("[ddangyo-login] 5. goto review page", REVIEW_PAGE_URL);
    await page.goto(REVIEW_PAGE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});

    // 리뷰 페이지(#SH0201)에서 requestQueryReviewList 요청 대기 또는 리뷰 메뉴 클릭으로 patsto_no 수집
    console.log("[ddangyo-login] 6. wait review menu");
    const reviewMenu = page.locator(
      "#mf_wfm_side_gen_menuParent_1_gen_menuSub_0_btn_child, li#mf_wfm_side_gen_menuParent_1_gen_menuSub_0_grp_child a",
    );
    await reviewMenu
      .first()
      .waitFor({ state: "visible", timeout: 10_000 })
      .catch(() => {});

    console.log("[ddangyo-login] 7. waitForRequest LIST + click review menu");
    const requestPromise = page.waitForRequest(
      (req) =>
        req.url().includes(REVIEW_LIST_API) &&
        req.method() === "POST" &&
        !!req.postData(),
      { timeout: 15_000 },
    );
    await reviewMenu.first().click();
    try {
      const req = await requestPromise;
      console.log(
        "[ddangyo-login] 8. request captured",
        req.url(),
        "postData length",
        req.postData()?.length,
      );
      const raw = req.postData();
      if (raw) {
        const body = JSON.parse(raw) as {
          dma_reqParam?: { patsto_no?: string };
        };
        const no = body?.dma_reqParam?.patsto_no;
        if (no && String(no).trim()) capturedPatstoNo = String(no).trim();
        log("8. patsto_no from waitForRequest", capturedPatstoNo);
      }
    } catch (err) {
      console.log("[ddangyo-login] 8. waitForRequest failed (timeout?)", err);
      // timeout or no request; capturedPatstoNo may still be set by listener
    }

    await page.waitForLoadState("networkidle").catch(() => {});

    console.log("[ddangyo-login] 9. final patsto_no", capturedPatstoNo);

    const cookies = await context.cookies();
    const items: CookieItem[] = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
    }));
    console.log("[ddangyo-login] 10. cookies count", items.length);

    if (DEBUG) {
      console.log("[ddangyo-login] DEBUG: 브라우저 3초 후 종료 (리뷰 페이지 확인용)");
      await new Promise((r) => setTimeout(r, 3000));
    }

    return {
      cookies: items,
      external_shop_id: capturedPatstoNo,
    };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[ddangyo]");
  }
}
