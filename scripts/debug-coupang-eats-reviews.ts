/**
 * 쿠팡이츠 리뷰 수집 디버그: 로그인 → 리뷰 페이지 이동 → "조회" 클릭 시
 * /api/v1/merchant/reviews/search 요청 URL·바디와 응답 전체를 로그로 출력.
 *
 * 사용: COUPANG_DEBUG_ID=st0423 COUPANG_DEBUG_PW='st042300!' npx tsx scripts/debug-coupang-eats-reviews.ts
 * 또는 .env.local에 COUPANG_DEBUG_ID, COUPANG_DEBUG_PW 설정
 */
try {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {}

const LOGIN_URL = "https://store.coupangeats.com/merchant/login";
const REVIEWS_PAGE_URL = "https://store.coupangeats.com/merchant/management/reviews";

async function main() {
  const username = process.env.COUPANG_DEBUG_ID ?? "st0423";
  const password = process.env.COUPANG_DEBUG_PW ?? "st042300!";

  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: process.env.HEADLESS !== "0",
    channel: "chrome",
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
  });

  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    viewport: { width: 1280, height: 720 },
  });

  const page = await context.newPage();

  // ——— reviews/search 요청·응답 전부 로그 ———
  page.on("request", (req) => {
    const url = req.url();
    if (!url.includes("/api/v1/merchant/reviews/search")) return;
    const method = req.method();
    const postData = req.postData();
    console.log("\n[DEBUG] >>> reviews/search REQUEST");
    console.log("  URL:", url);
    console.log("  Method:", method);
    if (postData) {
      try {
        const parsed = JSON.parse(postData) as Record<string, unknown>;
        console.log("  Body:", JSON.stringify(parsed, null, 2));
      } catch {
        console.log("  Body (raw):", postData.slice(0, 500));
      }
    }
  });

  page.on("response", async (res) => {
    const url = res.url();
    if (!url.includes("/api/v1/merchant/reviews/search")) return;
    const status = res.status();
    console.log("\n[DEBUG] <<< reviews/search RESPONSE", status);
    try {
      const body = await res.json().catch(() => null) as Record<string, unknown> | null;
      if (body?.data && typeof body.data === "object") {
        const data = body.data as { content?: unknown[]; total?: number; pageNumber?: number; pageSize?: number };
        console.log("  data.content length:", data.content?.length ?? 0);
        console.log("  data.total:", data.total);
        console.log("  data.pageNumber:", data.pageNumber);
        console.log("  data.pageSize:", data.pageSize);
        if (Array.isArray(data.content) && data.content.length > 0) {
          console.log("  first item keys:", Object.keys(data.content[0] as object));
        }
      } else {
        console.log("  body:", JSON.stringify(body).slice(0, 800));
      }
    } catch (e) {
      console.log("  parse error:", String(e));
    }
  });

  // ——— 로그인 ———
  console.log("[DEBUG] 1. Login...");
  await page.goto(LOGIN_URL, { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForTimeout(1_500);
  await page.locator("#loginId").fill(username);
  await page.locator("#password").fill(password);
  await page.locator('button[type="submit"]').click();

  // 로그인 리다이렉트 대기 (최대 45초, 2xx 후 이동 지연 대응)
  try {
    await page.waitForURL((u) => !u.pathname.includes("/merchant/login"), { timeout: 45_000 });
  } catch {
    console.log("[DEBUG] Login redirect timeout. Current URL:", page.url());
  }
  await page.waitForTimeout(2_000);
  const afterLoginUrl = page.url();
  console.log("[DEBUG] After login URL:", afterLoginUrl);
  const stillOnLogin = afterLoginUrl.includes("/merchant/login") && !afterLoginUrl.includes("management");
  if (stillOnLogin) {
    console.log("[DEBUG] Login failed (still on login page). Aborting. Run with HEADLESS=0 to inspect.");
    await browser.close();
    process.exit(1);
  }

  // ——— 리뷰 페이지 ———
  console.log("[DEBUG] 2. Goto reviews...");
  await page.goto(REVIEWS_PAGE_URL, { waitUntil: "domcontentloaded", timeout: 25_000 });
  await page.waitForTimeout(3_000);
  console.log("[DEBUG] Reviews page URL:", page.url());

  // 모달 닫기 (X 버튼·일주일/오늘 보지 않기 우선, 여러 개 있을 수 있음)
  async function closeModals() {
    const closeSelectors = [
      ".dialog-modal-wrapper button[data-testid='Dialog__CloseButton']",
      ".dialog-modal-wrapper .dialog-modal-wrapper__body--close-button",
      'div:has-text("일주일간 보지 않기")',
      'div:has-text("오늘 하루동안 보지 않기")',
      '.dialog-modal-wrapper button:has-text("닫기")',
      '.dialog-modal-wrapper button:has-text("확인")',
      '.dialog-modal-wrapper button:has-text("알겠어요")',
    ];
    let closedAny = true;
    while (closedAny) {
      closedAny = false;
      if (!(await page.locator(".dialog-modal-wrapper").first().isVisible().catch(() => false))) break;
      for (const sel of closeSelectors) {
        const el = page.locator(sel).first();
        if (await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 5_000, force: true }).catch(() => {});
          await page.waitForTimeout(500);
          closedAny = true;
          break;
        }
      }
      if (!closedAny) await page.keyboard.press("Escape");
      await page.locator(".dialog-modal-wrapper").first().waitFor({ state: "hidden", timeout: 5_000 }).catch(() => {});
    }
  }
  await closeModals();
  await page.waitForTimeout(2_000);

  // 날짜 6개월 선택
  console.log("[DEBUG] 3. Select 6 months...");
  const dateTrigger = page.locator('div[class*="eylfi1j5"]').first();
  await dateTrigger.waitFor({ state: "visible", timeout: 15_000 }).catch(() => {});
  await dateTrigger.click().catch(() => {});
  await page.waitForTimeout(800);
  const sixMonths = page.locator('label:has-text("6개월"), input[name="quick"][value="4"]').first();
  await sixMonths.click().catch(() => {});
  await page.waitForTimeout(500);

  await closeModals();
  await page.locator(".dialog-modal-wrapper").waitFor({ state: "hidden", timeout: 6_000 }).catch(() => {});
  await page.waitForTimeout(300);

  console.log("[DEBUG] 4. Click 조회...");
  const searchBtn = page.getByRole("button", { name: "조회" });
  await searchBtn.waitFor({ state: "visible", timeout: 10_000 });
  await searchBtn.click({ force: true });

  // 응답 대기
  await page.waitForResponse(
    (r) => r.url().includes("/api/v1/merchant/reviews/search"),
    { timeout: 15_000 },
  ).catch(() => null);
  await page.waitForTimeout(3_000);

  console.log("\n[DEBUG] 5. Done. Check logs above for request/response. Browser will close in 5s...");
  await page.waitForTimeout(5_000);
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
