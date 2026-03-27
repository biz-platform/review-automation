import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import { dismissBaeminTodayPopup } from "@/lib/services/baemin/baemin-dismiss-popup";
import { parseCategoryFromBaeminShopOptionText } from "@/lib/services/baemin/baemin-shop-option-label";

const DEBUG = process.env.DEBUG_BAEMIN_LINK === "1";
const log = (...args: unknown[]) =>
  DEBUG ? console.log("[baemin-login]", ...args) : undefined;

const SELF_URL = "https://self.baemin.com";
const BIZ_MEMBER_LOGIN_URL = "https://biz-member.baemin.com/login";
const SELF_API_PROFILE = "https://self-api.baemin.com/v1/session/profile";
const SELF_API_SHOPS_SEARCH =
  "https://self-api.baemin.com/v4/store/shops/search?shopOwnerNo={shopOwnerNo}&lastOffsetId=&pageSize=50&desc=true";
const SELF_API_SHOP_DETAIL = "https://self-api.baemin.com/v4/store/shops/{shopId}";
const LOGIN_TIMEOUT_MS = 60_000;

export type LoginResult = {
  cookies: CookieItem[];
  baeminShopId: string | null;
  shopOwnerNumber: string | null;
  /** 같은 브라우저 컨텍스트에서 shops/search 페이지네이션 (Node fetch는 403 대응 불가) */
  allShopNos: string[];
  /** shops/search + 상세 API 보강 메타 */
  allShops?: Array<{
    shopNo: string;
    shopName?: string | null;
    shopCategory?: string | null;
  }>;
  shop_category?: string | null;
  /** 사업자 등록번호 (self-api /v4/store/shop-owners 응답의 businessNo) */
  businessNo?: string | null;
  /** 가게명 (self-api /v4/store/shops/{id} 응답의 name) */
  store_name?: string | null;
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

  const headless = process.env.DEBUG_BROWSER_HEADED !== "1";
  logMemory("[baemin] before launch");
  const browser = await playwright.chromium.launch({
    headless,
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
    await waitAndClickRecaptcha(page);
    await submitLogin(page);

    // 로그인 후 self.baemin.com으로 이동할 때까지 대기
    let reachedSelf = await page
      .waitForURL((u) => u.origin === SELF_URL, { timeout: 5_000 })
      .then(() => true)
      .catch(() => false);
    if (!reachedSelf) {
      log(
        "1.0 로그인 후 self로 리다이렉트 안 됨. 셀프서비스 링크 클릭 시도. 현재:",
        page.url(),
      );
      const clicked = await tryClickLinkToSelf(page);
      if (clicked) {
        reachedSelf = await page
          .waitForURL((u) => u.origin === SELF_URL, { timeout: 5_000 })
          .then(() => true)
          .catch(() => false);
        if (reachedSelf) log("1.0 셀프서비스 링크 클릭 후 self 도착");
      }
    }
    if (!reachedSelf) {
      log("1.0 fallback: goto(self) 시도");
      await page
        .goto(SELF_URL, { waitUntil: "domcontentloaded", timeout: 5_000 })
        .catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      reachedSelf = new URL(page.url()).origin === SELF_URL;
    }

    const finalUrl = page.url();
    if (finalUrl.includes("login") || finalUrl.includes("signin")) {
      throw new Error(
        "매장 연동에 실패했습니다.\n아이디·비밀번호를 확인해 주세요.",
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

    let allShops: Array<{ shopNo: string; shopName?: string | null }> = [];
    if (shopOwnerNumber != null) {
      allShops = await fetchAllShopsFromSearchPaginated(page, shopOwnerNumber);
      if (allShops.length === 0) {
        const one = await fetchShopNoFromSearch(page, shopOwnerNumber);
        if (one != null) allShops = [{ shopNo: one }];
      }
    }
    if (allShops.length > 0) {
      await enrichBaeminShopsFromDetailApi(page, allShops);
    }
    const allShopNos = allShops.map((s) => s.shopNo);
    const baeminShopId = allShopNos[0] ?? null;
    log(
      "3. 가게 검색 API 결과: allShopNos.length =",
      allShopNos.length,
      "baeminShopId(external_shop_id) =",
      baeminShopId ?? "(null)",
    );

    const shop_category =
      baeminShopId != null
        ? await fetchShopCategoryFromReviewsPage(page, baeminShopId)
        : null;
    log("3.5 리뷰 페이지 매장 카테고리:", shop_category ?? "(null)");

    const businessNo = await fetchBusinessNoFromOwnerPage(page);
    log("3.6 사업자등록번호(businessNo):", businessNo ?? "(null)");

    let store_name = allShops[0]?.shopName?.trim() ?? null;
    if (!store_name && baeminShopId != null) {
      const d = await fetchBaeminShopDetailFromApi(page, baeminShopId);
      store_name = d.name;
    }
    log("3.7 가게명(store_name):", store_name ?? "(null)");

    log("4. 최종 수집:", {
      shopOwnerNumber,
      baeminShopId,
      allShopNosCount: allShopNos.length,
      shop_category,
      businessNo,
      store_name,
      cookiesCount: items.length,
    });
    return {
      cookies: items,
      baeminShopId,
      shopOwnerNumber,
      allShopNos,
      allShops,
      shop_category,
      businessNo: businessNo ?? undefined,
      store_name: store_name ?? undefined,
    };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[baemin]");
  }
}

/** 리뷰 페이지(/shops/{shopNo}/reviews) 로드 후 매장 select에서 해당 shopNo option의 카테고리 추출 */
async function fetchShopCategoryFromReviewsPage(
  page: import("playwright").Page,
  shopNo: string,
): Promise<string | null> {
  try {
    await page.goto(`${SELF_URL}/shops/${shopNo}/reviews`, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await dismissBaeminTodayPopup(page);
    await page.waitForLoadState("networkidle").catch(() => {});

    const label = await page
      .locator(`select option[value="${shopNo}"]`)
      .first()
      .textContent({ timeout: 5_000 })
      .catch(() => null);
    return label != null ? parseCategoryFromBaeminShopOptionText(label.trim()) : null;
  } catch {
    return null;
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

const RECAPTCHA_WAIT_MS = 30_000;

/**
 * reCAPTCHA가 있으면 체크박스 클릭 후 검증 완료까지 대기.
 * 없으면 무시. 이미 체크되어 있으면 스킵.
 */
async function waitAndClickRecaptcha(
  page: import("playwright").Page,
): Promise<void> {
  const recaptchaFrame = page.locator(
    'iframe[title="reCAPTCHA"], iframe[src*="google.com/recaptcha/api2/anchor"]',
  );
  const count = await recaptchaFrame.count();
  if (count === 0) {
    log("reCAPTCHA iframe 없음, 스킵");
    return;
  }

  const frame = page.frameLocator(
    'iframe[title="reCAPTCHA"], iframe[src*="google.com/recaptcha/api2/anchor"]',
  ).first();
  const checkbox = frame.locator("#recaptcha-anchor").first();

  try {
    await checkbox.waitFor({ state: "visible", timeout: 10_000 });
    const isChecked = await checkbox.getAttribute("aria-checked");
    if (isChecked === "true") {
      log("reCAPTCHA 이미 체크됨");
      return;
    }
    await checkbox.click();
    log("reCAPTCHA 체크박스 클릭함, 검증 대기 중…");
    await page.waitForTimeout(2_000);
    await checkbox.waitFor({ state: "visible", timeout: RECAPTCHA_WAIT_MS });
    const checkedAfter = await checkbox.getAttribute("aria-checked");
    if (checkedAfter !== "true") {
      await page.waitForTimeout(5_000);
      const recheck = await checkbox.getAttribute("aria-checked");
      if (recheck !== "true") {
        log("reCAPTCHA 검증 미완료(이미지 선택 등 필요할 수 있음). 로그인 시도 진행.");
      }
    } else {
      log("reCAPTCHA 검증 완료");
    }
  } catch (e) {
    log("reCAPTCHA 처리 중 예외(무시하고 로그인 시도):", e);
  }
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

/**
 * self-api shops/search 전체 페이지 — 반드시 page.evaluate(fetch + credentials) 사용.
 * 서버(Node)에서 Cookie 헤더만 넣어 호출하면 403(차단 HTML)이 자주 난다.
 */
async function fetchAllShopsFromSearchPaginated(
  page: import("playwright").Page,
  shopOwnerNo: string,
): Promise<Array<{ shopNo: string; shopName?: string | null }>> {
  try {
    const headers = { ...SELF_API_HEADERS } as Record<string, string>;
    const out = await page.evaluate(
      async ({
        owner,
        h,
      }: {
        owner: string;
        h: Record<string, string>;
      }) => {
        const ordered: Array<{ shopNo: string; shopName?: string | null }> = [];
        const seen = new Set<string>();
        let lastOffsetId = "";
        for (let guard = 0; guard < 100; guard++) {
          const qs = new URLSearchParams({
            shopOwnerNo: owner,
            lastOffsetId,
            pageSize: "50",
            desc: "true",
          });
          const url = `https://self-api.baemin.com/v4/store/shops/search?${qs.toString()}`;
          const res = await fetch(url, {
            credentials: "include",
            headers: { ...h },
          });
          if (!res.ok) {
            return {
              ok: false as const,
              status: res.status,
              ordered,
              snippet: (await res.text().catch(() => "")).slice(0, 300),
            };
          }
          const body = await res.json().catch(() => null);
          const contents = Array.isArray(body?.contents)
            ? body.contents
            : Array.isArray(body?.content)
              ? body.content
              : [];
          if (contents.length === 0) break;
          for (const row of contents) {
            const no = (row as { shopNo?: unknown })?.shopNo;
            if (no == null) continue;
            const s = String(no).trim();
            if (!s || seen.has(s)) continue;
            seen.add(s);
            const n = (row as { name?: unknown; shopName?: unknown })?.name;
            const n2 = (row as { name?: unknown; shopName?: unknown })?.shopName;
            const shopName =
              typeof n === "string" && n.trim()
                ? n.trim()
                : typeof n2 === "string" && n2.trim()
                  ? n2.trim()
                  : null;
            ordered.push({ shopNo: s, shopName });
          }
          if (contents.length < 50) break;
          const lastNo = (contents[contents.length - 1] as { shopNo?: unknown })
            ?.shopNo;
          const nextCursor = lastNo != null ? String(lastNo).trim() : "";
          if (!nextCursor || nextCursor === lastOffsetId) break;
          lastOffsetId = nextCursor;
        }
        return { ok: true as const, status: 200, ordered, snippet: "" };
      },
      { owner: shopOwnerNo, h: headers },
    );
    if (!out.ok && DEBUG) {
      log(
        "  [가게 목록 페이지네이션] 실패 status =",
        out.status,
        out.snippet?.slice(0, 120),
      );
    }
    return out.ok ? out.ordered : [];
  } catch (e) {
    console.error("[baemin-login] fetchAllShopsFromSearchPaginated 예외:", e);
    return [];
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

function categoryFromBaeminShopDetailJson(data: unknown): string | null {
  if (data == null || typeof data !== "object") return null;
  const o = data as Record<string, unknown>;
  for (const k of [
    "shopFoodCategoryName",
    "foodCategoryName",
    "representFoodCategoryName",
    "categoryName",
    "mainCategoryName",
  ]) {
    const v = o[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const nested = o.shopFoodCategory;
  if (nested != null && typeof nested === "object") {
    const name = (nested as { name?: unknown }).name;
    if (typeof name === "string" && name.trim()) return name.trim();
  }
  return null;
}

/** shops/search 이후 매장별 상세 API로 가게명·음식카테고리 보강 */
async function enrichBaeminShopsFromDetailApi(
  page: import("playwright").Page,
  shops: Array<{
    shopNo: string;
    shopName?: string | null;
    shopCategory?: string | null;
  }>,
): Promise<void> {
  for (const shop of shops) {
    const no = shop.shopNo?.trim();
    if (!no) continue;
    const d = await fetchBaeminShopDetailFromApi(page, no);
    if (d.name) shop.shopName = d.name;
    if (d.category) shop.shopCategory = d.category;
  }
}

/** GET /v4/store/shops/{shopId} */
async function fetchBaeminShopDetailFromApi(
  page: import("playwright").Page,
  shopId: string,
): Promise<{ name: string | null; category: string | null }> {
  try {
    const url = SELF_API_SHOP_DETAIL.replace("{shopId}", encodeURIComponent(shopId));
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
          const data = await res.json().catch(() => null);
          const name =
            data != null && typeof data.name === "string" && data.name.trim()
              ? data.name.trim()
              : null;
          return {
            ok: res.ok,
            status: res.status,
            name,
            data,
          };
        } catch (e) {
          return {
            ok: false,
            status: 0,
            name: null,
            data: null,
            err: String(e),
          };
        }
      },
      { apiUrl: url, headers: { ...SELF_API_HEADERS } },
    );
    if (DEBUG && !out.ok) {
      log("  [가게 상세 API 실패] status =", out.status);
    }
    if (!out.ok) {
      return { name: null, category: null };
    }
    const category = categoryFromBaeminShopDetailJson(
      (out as { data?: unknown }).data,
    );
    return {
      name: (out as { name?: string | null }).name ?? null,
      category,
    };
  } catch (e) {
    console.error("[baemin-login] fetchBaeminShopDetailFromApi 예외:", e);
    return { name: null, category: null };
  }
}

const SELF_MYPAGE_OWNER = `${SELF_URL}/mypage/owner`;

/** /mypage/owner 이동 시 발생하는 GET /v4/store/shop-owners/{id} 응답에서 businessNo 추출 */
async function fetchBusinessNoFromOwnerPage(
  page: import("playwright").Page,
): Promise<string | null> {
  try {
    const [response] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.url().includes("self-api.baemin.com") &&
          res.url().includes("/v4/store/shop-owners/") &&
          res.request().method() === "GET",
        { timeout: 15_000 },
      ),
      page.goto(SELF_MYPAGE_OWNER, {
        waitUntil: "domcontentloaded",
        timeout: 15_000,
      }),
    ]);
    const json = (await response.json()) as { businessNo?: string } | null;
    const businessNo =
      json != null && typeof json.businessNo === "string" && json.businessNo.trim()
        ? json.businessNo.trim()
        : null;
    return businessNo;
  } catch (e) {
    log("  [사업자번호 API] 실패:", e);
    return null;
  }
}
