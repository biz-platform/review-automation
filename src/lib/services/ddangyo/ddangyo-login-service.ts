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

const BOSS_INFO_URL = "https://boss.ddangyo.com/o2o/shop/cm/requestBossInfo";
const SHOP_INFO_URL = "https://boss.ddangyo.com/o2o/shop/sh/requestQryShopInfo";

/** 쿠팡이츠·기타 연동과 동일한 사용자-facing 메시지 */
const CREDENTIAL_MISMATCH_MESSAGE = "아이디 혹은 비밀번호가 일치하지 않습니다.";

/** 로그인 실패 시 본문/팝업에 자주 나오는 패턴 (사이트 문구 변경 시 보강) */
const DDANGYO_LOGIN_FAIL_BODY_REGEX =
  /일치하지\s*않|로그인\s*실패|아이디\s*(또는|혹은)\s*비밀번호|비밀번호\s*확인|잘못된\s*(아이디|비밀번호)|인증에\s*실패/i;

/**
 * 로그인 제출 후 실패 여부 판별 → 실패 시 통일된 Error throw.
 * 기존 `url.includes("login") && !boss...` 조건은 boss.ddangyo.com 에서 거의 동작하지 않아 제거함.
 */
async function assertDdangyoLoginNotFailed(
  page: import("playwright").Page,
): Promise<void> {
  const bodyText = await page
    .evaluate(() => (document.body?.innerText ?? "").slice(0, 12_000))
    .catch(() => "");

  if (DDANGYO_LOGIN_FAIL_BODY_REGEX.test(bodyText)) {
    throw new Error(CREDENTIAL_MISMATCH_MESSAGE);
  }

  const errFromUi = await page
    .locator('.w2err, [role="alert"], .w2popup .w2textbox')
    .first()
    .textContent()
    .catch(() => null);
  const ui = errFromUi?.trim() ?? "";
  if (ui && DDANGYO_LOGIN_FAIL_BODY_REGEX.test(ui)) {
    throw new Error(CREDENTIAL_MISMATCH_MESSAGE);
  }

  const idVisible = await page
    .locator("#mf_ibx_mbrId")
    .isVisible()
    .catch(() => false);
  if (!idVisible) return;

  const sideMenu = await page
    .locator("#mf_wfm_side_gen_menuParent_1_gen_menuSub_0_btn_child")
    .first()
    .isVisible()
    .catch(() => false);
  if (sideMenu) return;

  throw new Error(CREDENTIAL_MISMATCH_MESSAGE);
}

/** 3개월 주기 비밀번호 변경 안내 팝업 — "90일 후에 변경하기"로 닫고 연동 플로우 계속 */
async function dismissDdangyoPasswordRemindModalIfPresent(
  page: import("playwright").Page,
): Promise<void> {
  const deadline = Date.now() + 3_000;
  const byId = page.locator("#mf_SMWCO010200P01_wframe_btn_pwdChgDt").first();
  const byRole = page.getByRole("button", { name: "90일 후에 변경하기" });

  while (Date.now() < deadline) {
    if (await byId.isVisible().catch(() => false)) {
      console.log("[ddangyo-login] 비밀번호 변경 안내 모달 → 90일 후에 변경하기 클릭");
      await byId.click();
      await page
        .locator("#mf_SMWCO010200P01_body")
        .waitFor({ state: "hidden", timeout: 12_000 })
        .catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(400);
      return;
    }
    if (await byRole.isVisible().catch(() => false)) {
      console.log("[ddangyo-login] 비밀번호 변경 안내 모달 → 90일 후에 변경하기 클릭 (role)");
      await byRole.click();
      await page
        .locator("#mf_SMWCO010200P01_body")
        .waitFor({ state: "hidden", timeout: 12_000 })
        .catch(() => {});
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(400);
      return;
    }
    await page.waitForTimeout(280);
  }
}

export type DdangyoPatstoFromLink = {
  patsto_no: string;
  patsto_nm: string;
};

export type DdangyoLoginResult = {
  cookies: CookieItem[];
  external_shop_id: string | null;
  /** 로그인 유저 ID (requestUpdateReview/requestDeleteReview 의 fin_chg_id). 페이지에서 수집 가능하면 채움 */
  external_user_id?: string | null;
  /** 사업자 등록번호 (requestBossInfo dma_result.biz_reg_no) */
  business_registration_number?: string | null;
  /** 업종 (requestQryShopInfo dlt_shopInfo[0].patsto_cat_cd) */
  shop_category?: string | null;
  /** requestQryShopInfo `dlt_patstoMbrId` 기준 매장 목록(중복 제거) */
  patstos?: DdangyoPatstoFromLink[];
};

export type DdangyoLoginBeforeCloseContext = {
  page: import("playwright").Page;
  business_registration_number: string | null;
  rpsnt_patsto_no: string | null;
  external_user_id: string | null;
  patstos: DdangyoPatstoFromLink[] | undefined;
};

export type DdangyoLoginOptions = {
  /** 브라우저 종료 직전 (예: #SH0402 주문내역 API 테스트) */
  beforeClose?: (ctx: DdangyoLoginBeforeCloseContext) => Promise<void>;
};

/**
 * Playwright로 땡겨요 사장님라운지 로그인 → 리뷰관리 클릭 → requestQueryReviewList 요청에서 patsto_no 추출·쿠키 수집.
 */
export async function loginDdangyoAndGetCookies(
  username: string,
  password: string,
  options?: DdangyoLoginOptions,
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
    await page
      .locator("#mf_ibx_mbrId")
      .waitFor({ state: "hidden", timeout: 14_000 })
      .catch(() => {});
    await assertDdangyoLoginNotFailed(page);
    await dismissDdangyoPasswordRemindModalIfPresent(page);

    console.log("[ddangyo-login] 5. goto review page", REVIEW_PAGE_URL);
    await page.goto(REVIEW_PAGE_URL, {
      waitUntil: "domcontentloaded",
      timeout: 15_000,
    });
    await page.waitForLoadState("networkidle").catch(() => {});
    await dismissDdangyoPasswordRemindModalIfPresent(page);

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

    // fin_chg_id(로그인 유저 ID): 수정/삭제 API 필수. 페이지 전역/요소에서 수집 시도
    let external_user_id: string | null = null;
    try {
      const found = await page.evaluate(() => {
        const w = window as unknown as Record<string, unknown>;
        let v: string | null = null;
        if (typeof w.__USER_ID__ === "string") v = w.__USER_ID__;
        else if (typeof w.__LOGIN_USER_ID__ === "string")
          v = w.__LOGIN_USER_ID__;
        else if (
          w.__INITIAL_STATE__ &&
          typeof w.__INITIAL_STATE__ === "object"
        ) {
          const user = (w.__INITIAL_STATE__ as Record<string, unknown>)?.user;
          if (user != null && typeof user === "object" && "id" in user)
            v = String((user as { id: unknown }).id);
        }
        if (!v)
          v =
            (
              document.querySelector("[data-user-id]") as HTMLElement | null
            )?.getAttribute?.("data-user-id") ?? null;
        if (!v)
          v =
            (
              document.querySelector("[data-fin-chg-id]") as HTMLElement | null
            )?.getAttribute?.("data-fin-chg-id") ?? null;
        return typeof v === "string" && v.trim() ? v.trim() : null;
      });
      if (found) {
        external_user_id = found;
        log("11. captured external_user_id (fin_chg_id)", external_user_id);
      }
    } catch (e) {
      log("11. external_user_id capture failed", e);
    }

    // 사업자 번호·업종·매장 목록: requestBossInfo → requestQryShopInfo (페이지 컨텍스트에서 쿠키 자동 전달)
    let business_registration_number: string | null = null;
    let shop_category: string | null = null;
    let patstos: DdangyoPatstoFromLink[] | undefined;
    let rpsntPatstoNo = "";
    try {
      const bossInfo = await page.evaluate(
        async (url: string) => {
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json; charset=UTF-8",
              submissionid: "mf_wfm_side_sbm_commonSbmObject",
            },
            body: "{}",
            credentials: "include",
          });
          if (!res.ok) return null;
          return (await res.json()) as {
            dma_result?: {
              biz_reg_no?: string;
              rpsnt_patsto_no?: string;
              sotid?: string;
            };
          } | null;
        },
        BOSS_INFO_URL,
      );
      const dmaResult = bossInfo?.dma_result;
      if (dmaResult?.biz_reg_no?.trim()) {
        business_registration_number = dmaResult.biz_reg_no.trim();
      }
      if (dmaResult?.rpsnt_patsto_no != null) {
        rpsntPatstoNo = String(dmaResult.rpsnt_patsto_no).trim();
      }
      if (dmaResult?.rpsnt_patsto_no != null && dmaResult?.biz_reg_no != null) {
        const shopInfo = await page.evaluate(
          async (args: { url: string; patsto_no: string; biz_reg_no: string; sotid: string }) => {
            const res = await fetch(args.url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json; charset=UTF-8",
                submissionid: "mf_wfm_side_sbm_commonSbmObject",
              },
              body: JSON.stringify({
                dma_para: {
                  patsto_no: args.patsto_no,
                  biz_reg_no: args.biz_reg_no,
                  sotid: args.sotid,
                  bizr_no: "",
                  mbr_id: "",
                },
              }),
              credentials: "include",
            });
            if (!res.ok) return null;
            return (await res.json()) as {
              dlt_shopInfo?: Array<{ patsto_cat_cd?: string }>;
              dlt_patstoMbrId?: Array<{ patsto_no?: unknown; patsto_nm?: unknown }>;
            } | null;
          },
          {
            url: SHOP_INFO_URL,
            patsto_no: String(dmaResult.rpsnt_patsto_no),
            biz_reg_no: String(dmaResult.biz_reg_no),
            sotid: dmaResult.sotid ?? "0000",
          },
        );
        const first = shopInfo?.dlt_shopInfo?.[0];
        if (first?.patsto_cat_cd?.trim()) {
          shop_category = first.patsto_cat_cd.trim();
        }
        const mbrRows = shopInfo?.dlt_patstoMbrId;
        if (Array.isArray(mbrRows) && mbrRows.length > 0) {
          const seen = new Set<string>();
          patstos = [];
          for (const row of mbrRows) {
            const no = String(row?.patsto_no ?? "").trim();
            if (!no || seen.has(no)) continue;
            seen.add(no);
            patstos.push({
              patsto_no: no,
              patsto_nm:
                typeof row?.patsto_nm === "string" && row.patsto_nm.trim()
                  ? row.patsto_nm.trim()
                  : "",
            });
          }
        }
      }
      log("bossInfo/shopInfo", {
        business_registration_number,
        shop_category,
        patsto_count: patstos?.length ?? 0,
      });
    } catch (e) {
      log("requestBossInfo/requestQryShopInfo failed", e);
    }

    if (options?.beforeClose) {
      await options.beforeClose({
        page,
        business_registration_number,
        rpsnt_patsto_no: rpsntPatstoNo || null,
        external_user_id,
        patstos,
      });
    }

    if (DEBUG) {
      console.log(
        "[ddangyo-login] DEBUG: 브라우저 3초 후 종료 (리뷰 페이지 확인용)",
      );
      await new Promise((r) => setTimeout(r, 3000));
    }

    const external_shop_id =
      rpsntPatstoNo ||
      capturedPatstoNo ||
      (patstos && patstos[0] ? patstos[0].patsto_no : null);

    return {
      cookies: items,
      external_shop_id,
      external_user_id: external_user_id ?? undefined,
      business_registration_number: business_registration_number ?? undefined,
      shop_category: shop_category ?? undefined,
      ...(patstos != null && patstos.length > 0 ? { patstos } : {}),
    };
  } finally {
    await closeBrowserWithMemoryLog(browser, "[ddangyo]");
  }
}
