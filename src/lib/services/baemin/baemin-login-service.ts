import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";

const DEBUG = process.env.DEBUG_BAEMIN_LINK === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[baemin-login]", ...args) : undefined;

const SELF_URL = "https://self.baemin.com";
const BIZ_MEMBER_LOGIN_URL = "https://biz-member.baemin.com/login";
const SELF_API_PROFILE = "https://self-api.baemin.com/v1/session/profile";
const SELF_API_SHOPS_SEARCH =
  "https://self-api.baemin.com/v4/store/shops/search?shopOwnerNo={shopOwnerNo}&lastOffsetId=&pageSize=50&desc=true";
const LOGIN_TIMEOUT_MS = 60_000;

export type LoginResult = {
  cookies: CookieItem[];
  baeminShopId: string | null;
  shopOwnerNumber: string | null;
};

/**
 * Playwright로 biz-member 로그인 → self.baemin.com 이동 → 쿠키·프로필(shopOwnerNumber)·가게 검색 API(shopNo) 추출.
 */
export async function loginBaeminAndGetCookies(
  username: string,
  password: string,
): Promise<LoginResult> {
  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 설치되지 않았습니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  logMemory("[baemin] before launch");
  const browser = await playwright.chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  logMemory("[baemin] after launch");
  logBrowserMemory(browser as unknown, "[baemin] browser");

  try {
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 720 },
    });
    const page = await context.newPage();

    // 미로그인 시 biz-member 로그인 페이지에서 시작
    await page.goto(BIZ_MEMBER_LOGIN_URL, {
      waitUntil: "domcontentloaded",
      timeout: LOGIN_TIMEOUT_MS,
    });
    // SPA 로그인 폼 렌더 대기 (input[name="id"] 또는 input[data-testid="id"])
    await page
      .locator('input[name="id"], input[data-testid="id"]')
      .first()
      .waitFor({ state: "visible", timeout: 15_000 })
      .catch(() => {});

    const usernameFilled = await fillUsername(page, username);
    const passwordFilled = await fillPassword(page, password);
    if (!usernameFilled || !passwordFilled) {
      throw new Error(
        "로그인 입력란을 찾을 수 없습니다. 배민 로그인 페이지 구조가 변경되었을 수 있습니다.",
      );
    }
    await submitLogin(page);

    // 로그인 후 self.baemin.com으로 이동할 때까지 대기
    let reachedSelf = await page
      .waitForURL((u) => u.origin === SELF_URL, { timeout: 25_000 })
      .then(() => true)
      .catch(() => false);
    if (!reachedSelf) {
      log("1.0 로그인 후 self로 리다이렉트 안 됨. 셀프서비스 링크 클릭 시도. 현재:", page.url());
      const clicked = await tryClickLinkToSelf(page);
      if (clicked) {
        reachedSelf = await page
          .waitForURL((u) => u.origin === SELF_URL, { timeout: 10_000 })
          .then(() => true)
          .catch(() => false);
        if (reachedSelf) log("1.0 셀프서비스 링크 클릭 후 self 도착");
      }
    }
    if (!reachedSelf) {
      log("1.0 fallback: goto(self) 시도");
      await page.goto(SELF_URL, { waitUntil: "domcontentloaded", timeout: 15_000 }).catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      reachedSelf = new URL(page.url()).origin === SELF_URL;
    }

    const finalUrl = page.url();
    if (finalUrl.includes("login") || finalUrl.includes("signin")) {
      throw new Error(
        "로그인에 실패했습니다. 아이디·비밀번호를 확인해 주세요.",
      );
    }

    await page.waitForLoadState("networkidle").catch(() => {});
    await dismissBaeminTodayPopup(page);

    // self 도착 후 쿠키 수집 (self 세션 포함)
    const cookies = await context.cookies();
    const items: CookieItem[] = cookies.map((c) => ({
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path || "/",
    }));
    log(
      "1. 로그인·self 이동 후 쿠키 수:",
      items.length,
      "개, 쿠키 이름:",
      items.map((c) => c.name).join(", "),
    );

    const currentOrigin = new URL(page.url()).origin;
    if (currentOrigin !== SELF_URL) {
      log("1.5 최종 출처가 self가 아님. 프로필 API 실패 예상:", currentOrigin);
    }

    // 페이지 컨텍스트에서 fetch(credentials: 'include')로 호출해야 쿠키가 self-api.baemin.com에 전달됨
    const shopOwnerNumber = await fetchProfileShopOwnerNumber(page);
    log("2. 프로필 API 결과: shopOwnerNumber =", shopOwnerNumber ?? "(null)");

    const baeminShopId =
      shopOwnerNumber != null
        ? await fetchShopNoFromSearch(page, shopOwnerNumber)
        : null;
    log(
      "3. 가게 검색 API 결과: baeminShopId(external_shop_id) =",
      baeminShopId ?? "(null)",
    );

    log("4. 최종 수집:", {
      shopOwnerNumber,
      baeminShopId,
      cookiesCount: items.length,
    });
    return { cookies: items, baeminShopId, shopOwnerNumber };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[baemin]");
  }
}

/** biz-member 페이지에서 self.baemin.com으로 가는 링크를 찾아 클릭. 성공 시 true */
async function tryClickLinkToSelf(
  page: import("playwright").Page,
): Promise<boolean> {
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  const selectors = [
    'a[href*="self.baemin.com"]',
    'a[href^="https://self.baemin.com"]',
    'button:has-text("셀프서비스")',
    'a:has-text("셀프서비스")',
    'a:has-text("사장님")',
    '[data-link*="self.baemin"]',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      try {
        await el.click({ timeout: 5_000 });
        return true;
      } catch {
        continue;
      }
    }
  }
  return false;
}

async function hasLoginForm(page: import("playwright").Page): Promise<boolean> {
  const sel = 'input[type="password"]';
  return (await page.locator(sel).count()) > 0;
}

async function fillUsername(
  page: import("playwright").Page,
  username: string,
): Promise<boolean> {
  const selectors = [
    'input[data-testid="id"]',
    'input[name="id"]',
    'input[name="username"]',
    'input[name="userId"]',
    'input[type="text"]',
    'input[autocomplete="username"]',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      await el.fill(username);
      return true;
    }
  }
  return false;
}

async function fillPassword(
  page: import("playwright").Page,
  password: string,
): Promise<boolean> {
  const selectors = [
    'input[data-testid="password"]',
    'input[name="password"]',
    'input[type="password"]',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      await el.fill(password);
      return true;
    }
  }
  return false;
}

async function submitLogin(page: import("playwright").Page): Promise<void> {
  const selectors = [
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("로그인")',
    'a:has-text("로그인")',
    'button:has-text("로그인하기")',
  ];
  for (const sel of selectors) {
    const el = page.locator(sel).first();
    if ((await el.count()) > 0) {
      await el.click();
      return;
    }
  }
  await page.keyboard.press("Enter");
}

/** self-api 요청 시 브라우저와 동일한 헤더 (서버 검증용) */
const SELF_API_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "service-channel": "SELF_SERVICE_PC",
  "x-pathname-trace-key": "/info",
  "x-web-version": "v20260211140433",
} as const;

/** 로그인된 페이지에서 fetch(credentials: 'include')로 프로필 API 호출 → shopOwnerNumber (쿠키 전달 보장) */
async function fetchProfileShopOwnerNumber(
  page: import("playwright").Page,
): Promise<string | null> {
  try {
    const out = await page.evaluate(
      async ({
        url,
        headers,
      }: {
        url: string;
        headers: Record<string, string>;
      }) => {
        try {
          const res = await fetch(url, {
            credentials: "include",
            headers: { ...headers },
          });
          const data = await res.json().catch(() => null);
          const shopOwnerNumber =
            data != null && typeof data.shopOwnerNumber !== "undefined"
              ? String(data.shopOwnerNumber)
              : null;
          return {
            ok: res.ok,
            status: res.status,
            shopOwnerNumber,
            rawKeys: data && typeof data === "object" ? Object.keys(data) : [],
          };
        } catch (e) {
          return {
            ok: false,
            status: 0,
            shopOwnerNumber: null,
            rawKeys: [],
            err: String(e),
          };
        }
      },
      { url: SELF_API_PROFILE, headers: { ...SELF_API_HEADERS } },
    );
    if (DEBUG && !out.ok) {
      log(
        "  [프로필 API 실패] status =",
        out.status,
        "response keys =",
        (out as { rawKeys?: string[] }).rawKeys,
        (out as { err?: string }).err ?? "",
      );
    }
    return out.ok ? out.shopOwnerNumber : null;
  } catch (e) {
    console.error("[baemin-login] fetchProfileShopOwnerNumber 예외:", e);
    return null;
  }
}

/** 로그인된 페이지에서 fetch(credentials: 'include')로 가게 검색 API 호출 → contents[0].shopNo */
async function fetchShopNoFromSearch(
  page: import("playwright").Page,
  shopOwnerNo: string,
): Promise<string | null> {
  try {
    const url = SELF_API_SHOPS_SEARCH.replace(
      "{shopOwnerNo}",
      encodeURIComponent(shopOwnerNo),
    );
    const out = await page.evaluate(
      async ({
        apiUrl,
        headers,
      }: {
        apiUrl: string;
        headers: Record<string, string>;
      }) => {
        try {
          const res = await fetch(apiUrl, {
            credentials: "include",
            headers: { ...headers },
          });
          const body = await res.json().catch(() => null);
          const contents = body?.contents ?? body?.content;
          const first = Array.isArray(contents) ? contents[0] : null;
          const shopNo = first?.shopNo != null ? Number(first.shopNo) : null;
          return {
            ok: res.ok,
            status: res.status,
            shopNo,
            contentsLength: Array.isArray(contents) ? contents.length : 0,
          };
        } catch (e) {
          return {
            ok: false,
            status: 0,
            shopNo: null,
            contentsLength: 0,
            err: String(e),
          };
        }
      },
      { apiUrl: url, headers: { ...SELF_API_HEADERS } },
    );
    if (DEBUG) {
      if (!out.ok) log("  [가게 검색 API 실패] status =", out.status);
      else
        log(
          "  [가게 검색 API] contents 개수 =",
          out.contentsLength,
          "shopNo =",
          out.shopNo,
        );
    }
    return out.shopNo != null ? String(out.shopNo) : null;
  } catch (e) {
    console.error("[baemin-login] fetchShopNoFromSearch 예외:", e);
    return null;
  }
}
