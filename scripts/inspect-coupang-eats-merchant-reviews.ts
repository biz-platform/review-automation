import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_SEC_CH_UA_CHROME_146,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";

const REVIEWS_URL = "https://store.coupangeats.com/merchant/management/reviews";
const REPLY_URL_RE =
  /\/api\/v1\/merchant\/reviews\/reply(\/modify|\/delete)?(?:\?|$)/;
const SEARCH_URL_RE = /\/api\/v1\/merchant\/reviews\/search(?:\?|$)/;

type InspectOptions = {
  outDir: string;
  headless: boolean;
  timeoutMs: number;
  attemptAutoLogin: boolean;
  waitForManualMs: number;
  clickScenario: boolean;
  loginRetryCount: number;
  loginRetryDelayMs: number;
  id?: string;
  pw?: string;
};

function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function safeWriteJson(path: string, data: unknown) {
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

function redactReplyBody(raw: string | null): unknown {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return "";
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    if (typeof parsed.comment === "string") {
      parsed.comment = `<redacted:${parsed.comment.length}>`;
    }
    return parsed;
  } catch {
    // JSON이 아니면 길이만 남긴다.
    return `<raw:${trimmed.length}>`;
  }
}

async function closeCoupangOverlays(page: import("playwright").Page) {
  // 여러 형태의 모달/패널이 떠서 리뷰 화면이 가려지는 케이스가 많아서,
  // "가능한 것들"을 짧게 여러 번 시도한다(실패해도 무시).
  const tries: Array<() => Promise<void>> = [
    async () => {
      const panelClose = page.locator(".panel__close-button").first();
      if (await panelClose.isVisible().catch(() => false)) {
        await panelClose.click({ force: true }).catch(() => null);
      }
    },
    async () => {
      const legacyClose = page.locator("button.close-btn, .close-btn").first();
      if (await legacyClose.isVisible().catch(() => false))
        await legacyClose.click({ force: true }).catch(() => null);
    },
    async () => {
      const byText = page
        .locator('button:has-text("닫기"), button:has-text("Close")')
        .first();
      if (await byText.isVisible().catch(() => false))
        await byText.click({ force: true }).catch(() => null);
    },
    async () => {
      // 일반적인 X 아이콘/aria-label close
      const iconClose = page
        .locator(
          'button[aria-label*="close" i], button[aria-label*="닫" i], button:has(svg):not([disabled])',
        )
        .first();
      if (await iconClose.isVisible().catch(() => false)) {
        await iconClose.click({ force: true }).catch(() => null);
      }
    },
    async () => {
      // 백드롭 클릭으로 닫히는 모달
      const backdrop = page
        .locator(
          ".MuiBackdrop-root, .modal-backdrop, .overlay-bg, .overlay.overlay-bg",
        )
        .first();
      if (await backdrop.isVisible().catch(() => false)) {
        await backdrop.click({ force: true }).catch(() => null);
      }
    },
    async () => {
      await page.keyboard.press("Escape").catch(() => null);
    },
    async () => {
      // 마지막 폴백: 모달이 떠 있으면 우상단 좌표 클릭(닫기 X가 거기 있는 경우가 많음)
      const modal = page.locator(".dialog-modal-wrapper, [role='dialog']").first();
      if (await modal.isVisible().catch(() => false)) {
        const box = await modal.boundingBox().catch(() => null);
        if (box) {
          const x = box.x + box.width - 18;
          const y = box.y + 18;
          await page.mouse.click(x, y, { button: "left" }).catch(() => null);
        }
      }
    },
  ];

  for (let round = 0; round < 4; round++) {
    for (const t of tries) {
      await t().catch(() => null);
      await page.waitForTimeout(200);
    }
    const modalVisible = await page
      .locator(".dialog-modal-wrapper, [role='dialog'], [role='alertdialog']")
      .first()
      .isVisible()
      .catch(() => false);
    const bodyHasOpenModal = await page
      .locator("body.is-open-modal")
      .first()
      .isVisible()
      .catch(() => false);
    if (!modalVisible && !bodyHasOpenModal) break;
  }
}

async function runClickScenario(page: import("playwright").Page) {
  // 안전 기본값: 등록 버튼을 "열기"까지만 시도하고, 서버에 댓글 등록 POST는 하지 않는다.
  // 목적은 DOM 구조/버튼 존재 여부 및 reply* 요청이 "어떤 형태로" 나가는지 캡처하는 것.
  await closeCoupangOverlays(page);

  const searchBtn = page.getByRole("button", { name: "조회" }).first();
  if (await searchBtn.isVisible().catch(() => false)) {
    await searchBtn.click({ timeout: 10_000, force: true }).catch(() => null);
    await page.waitForTimeout(1200);
  }

  // "사장님 댓글 등록하기" 같은 CTA가 있는 첫 버튼/링크를 클릭해 textarea를 띄워본다.
  const registerCta = page
    .locator('button, a, [role="button"]')
    .filter({ hasText: /사장님\s*댓글\s*등록하기|사장님\s*댓글\s*등록|댓글\s*등록하기/ })
    .first();

  if (await registerCta.isVisible().catch(() => false)) {
    await registerCta.scrollIntoViewIfNeeded().catch(() => null);
    await registerCta.click({ timeout: 10_000, force: true }).catch(() => null);
    await page.waitForTimeout(800);
    await closeCoupangOverlays(page);
  }
}

async function main() {
  const outDir =
    process.env.OUT_DIR?.trim() ||
    join(cwd(), "scripts", "output", `coupang-eats-portal-inspect-${nowStamp()}`);
  const timeoutMs = Number(process.env.TIMEOUT_MS ?? "60000");
  const attemptAutoLogin = process.env.AUTO_LOGIN !== "0";
  const waitForManualMs = Number(process.env.WAIT_FOR_MANUAL_MS ?? "20000");
  const clickScenario = process.env.CLICK_SCENARIO === "1";
  const loginRetryCount = Number(process.env.LOGIN_RETRY_COUNT ?? "25");
  const loginRetryDelayMs = Number(process.env.LOGIN_RETRY_DELAY_MS ?? "900");
  const id = process.env.COUPANG_EATS_ID?.trim();
  const pw = process.env.COUPANG_EATS_PW?.trim();

  const options: InspectOptions = {
    outDir,
    headless: process.env.HEADLESS
      ? process.env.HEADLESS === "1"
      : isPlaywrightHeadlessDefault(),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : 60000,
    attemptAutoLogin,
    waitForManualMs:
      Number.isFinite(waitForManualMs) && waitForManualMs >= 0
        ? waitForManualMs
        : 20000,
    clickScenario,
    loginRetryCount:
      Number.isFinite(loginRetryCount) && loginRetryCount > 0
        ? Math.floor(loginRetryCount)
        : 25,
    loginRetryDelayMs:
      Number.isFinite(loginRetryDelayMs) && loginRetryDelayMs >= 0
        ? Math.floor(loginRetryDelayMs)
        : 900,
    id: id || undefined,
    pw: pw || undefined,
  };

  await mkdir(options.outDir, { recursive: true });
  // 실행 즉시 “폴더가 살아있음” 표식 생성 (스크립트가 끝나기 전에도 보이게)
  await safeWriteJson(join(options.outDir, "run.json"), {
    startedAt: new Date().toISOString(),
    pid: process.pid,
  });

  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: options.headless,
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
    channel: "chrome",
  });

  const context = await browser.newContext({
    userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
    viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    extraHTTPHeaders: {
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      "sec-ch-ua": PLAYWRIGHT_SEC_CH_UA_CHROME_146,
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
    },
    recordHar: { path: join(options.outDir, "network.har"), content: "embed" },
  });

  const page = await context.newPage();
  const requests: Array<{
    ts: string;
    method: string;
    url: string;
    status?: number;
    kind: "merchant_reviews" | "reply";
    postData?: unknown;
  }> = [];

  let recentLogin403Count = 0;
  page.on("response", (res) => {
    const url = res.url();
    if (!url.includes("store.coupangeats.com")) return;
    if (!url.includes("/merchant")) return;
    // 쿠팡이츠 포털이 로그인 자동화를 막기 위해 403을 뿌리는 케이스가 있어, 재시도 힌트로만 사용.
    if (res.status() === 403) recentLogin403Count += 1;
  });

  page.on("requestfinished", async (req) => {
    const url = req.url();
    if (!url.includes("store.coupangeats.com")) return;
    const res = await req.response().catch(() => null);
    const isMerchantReviews = /\/api\/v1\/merchant\/reviews\//.test(url);
    const isReply = REPLY_URL_RE.test(url);
    if (!isMerchantReviews && !isReply) return;
    const method = req.method();
    const postData =
      method === "POST" || method === "PUT" || method === "PATCH"
        ? redactReplyBody(req.postData())
        : null;
    requests.push({
      ts: new Date().toISOString(),
      method,
      url,
      status: res?.status(),
      kind: isReply ? "reply" : "merchant_reviews",
      ...(postData != null ? { postData } : {}),
    });
  });

  // 실행 중에도 요청 덤프가 계속 디스크에 flush 되도록(사용자 체감: “새 파일이 안 생김” 방지)
  const flushRequests = async () => {
    await safeWriteJson(join(options.outDir, "merchant-reviews-requests.json"), {
      requests,
    });
  };
  const flushTimer = setInterval(() => {
    flushRequests().catch(() => null);
  }, 1500);

  try {
  await page.goto(REVIEWS_URL, {
    waitUntil: "domcontentloaded",
    timeout: options.timeoutMs,
  });

  const autoLoginTried =
    options.attemptAutoLogin && options.id != null && options.pw != null;
  const loginId = options.id;
  const loginPw = options.pw;

  if (autoLoginTried && loginId != null && loginPw != null) {
    try {
      // 매우 보수적인 휴리스틱: 로그인 폼이 보이면 채우고 제출 시도
      const idInput = page
        .locator(
          'input[type="text"], input[type="email"], input[autocomplete="username"]',
        )
        .first();
      const pwInput = page
        .locator('input[type="password"], input[autocomplete="current-password"]')
        .first();

      const idVisible = await idInput.isVisible().catch(() => false);
      const pwVisible = await pwInput.isVisible().catch(() => false);
      if (idVisible && pwVisible) {
        await idInput.fill(loginId);
        await pwInput.fill(loginPw);

        const submit = page
          .locator(
            'button[type="submit"], input[type="submit"], button:has-text("로그인"), button:has-text("Login")',
          )
          .first();
        const canClick = await submit.isVisible().catch(() => false);

        // 403이어도 계속 눌러서 통과되는 구조면, 짧게 여러 번 재시도한다.
        for (let attempt = 0; attempt < options.loginRetryCount; attempt++) {
          const beforeUrl = page.url();
          const before403 = recentLogin403Count;

          if (canClick) {
            await Promise.allSettled([
              page
                .waitForNavigation({
                  waitUntil: "domcontentloaded",
                  timeout: Math.min(20_000, options.timeoutMs),
                })
                .catch(() => null),
              submit.click({ timeout: 10_000, force: true }).catch(() => null),
            ]);
          } else {
            await pwInput.press("Enter").catch(() => null);
            await page
              .waitForNavigation({
                waitUntil: "domcontentloaded",
                timeout: Math.min(20_000, options.timeoutMs),
              })
              .catch(() => null);
          }

          await page.waitForTimeout(options.loginRetryDelayMs);
          const afterUrl = page.url();
          if (!afterUrl.includes("/merchant/login")) break;

          // URL이 그대로고 403이 늘었으면 “차단 응답”으로 보고 계속 시도.
          const after403 = recentLogin403Count;
          if (afterUrl === beforeUrl && after403 === before403) {
            // UI가 막혔거나 버튼 비활성 등: overlay를 한 번 닫고 재시도
            await closeCoupangOverlays(page);
          }
        }
      }
    } catch {
      // ignore: 자동로그인 실패해도 계속 진행(수동 로그인 유도)
    }
  }

  // 여기서부터는 “네가 실제로 로그인/이동”했는지만 기다린다.
  // 이미 reviews URL로 접근했지만, 로그인 페이지로 리다이렉트되거나 로딩이 길어질 수 있어
  // timeout 내에 reviews로 복귀하는지만 체크하고, 아니면 현재 상태 그대로 캡처한다.
  const start = Date.now();
  for (;;) {
    const url = page.url();
    if (url.includes("/merchant/management/reviews")) break;
    if (Date.now() - start >= options.timeoutMs) break;
    await page.waitForTimeout(500);
  }

  await page.waitForTimeout(1500);
  await closeCoupangOverlays(page);

  if (options.clickScenario && page.url().includes("/merchant/management/reviews")) {
    await runClickScenario(page);
  }

  // 자동 시나리오로는 못 잡는 케이스(특정 리뷰 클릭/수정/삭제 등)를 위해
  // 잠깐 대기하면서 사용자가 직접 눌러도 네트워크를 계속 수집한다.
  if (!options.headless && options.waitForManualMs > 0) {
    await page.waitForTimeout(options.waitForManualMs);
  }

  const finalUrl = page.url();
  await safeWriteJson(join(options.outDir, "meta.json"), {
    finalUrl,
    autoLoginTried,
    headless: options.headless,
    capturedRequestsCount: requests.length,
    capturedReplyRequestsCount: requests.filter((r) => r.kind === "reply").length,
    clickScenario: options.clickScenario,
    waitForManualMs: options.waitForManualMs,
    note:
      "autoLoginTried=true라도 셀렉터가 바뀌면 로그인 실패할 수 있음. 그 경우 브라우저에서 직접 로그인 후 timeout 내 reviews로 이동하면 캡처됨.",
  });
  await safeWriteJson(join(options.outDir, "merchant-reviews-requests.json"), {
    requests,
  });

  await page.screenshot({
    path: join(options.outDir, "page.png"),
    fullPage: true,
  });

  // Playwright 버전/빌드에 따라 accessibility가 없을 수 있어 가드.
  const accessibility = (page as unknown as { accessibility?: any }).accessibility;
  if (accessibility?.snapshot) {
    const a11y = await accessibility.snapshot({ interestingOnly: false });
    await safeWriteJson(join(options.outDir, "a11y-snapshot.json"), a11y);
  } else {
    await safeWriteJson(join(options.outDir, "a11y-snapshot.json"), {
      skipped: true,
      reason: "page.accessibility.snapshot not available in this runtime",
    });
  }

  const html = await page.content().catch(() => "");
  await writeFile(join(options.outDir, "page.html"), html, "utf8");

  // 코드가 기대하는 핵심 셀렉터/문구가 있는지 “존재 여부”만 기계적으로 체크
  const probe = {
    hasBlockingModal: await page
      .locator(".dialog-modal-wrapper, [role='dialog'], [role='alertdialog']")
      .first()
      .isVisible()
      .catch(() => false),
    hasBodyOpenModalClass: await page
      .locator("body.is-open-modal")
      .first()
      .isVisible()
      .catch(() => false),
    hasReviewsColumnHeader: await page
      .getByRole("columnheader", { name: "리뷰 작성일" })
      .first()
      .isVisible()
      .catch(() => false),
    hasSearchButton: await page
      .getByRole("button", { name: "조회" })
      .first()
      .isVisible()
      .catch(() => false),
    hasRegisterCta: await page
      .locator('button, a, [role="button"]')
      .filter({
        hasText:
          /사장님\s*댓글\s*등록하기|사장님\s*댓글\s*등록|댓글\s*등록하기/,
      })
      .first()
      .isVisible()
      .catch(() => false),
    hasReplyTextarea: await page
      .locator('textarea[name="review"]')
      .first()
      .isVisible()
      .catch(() => false),
    hasReplySubmitButton: await page
      .getByRole("button", { name: "등록" })
      .first()
      .isVisible()
      .catch(() => false),
  };
  await safeWriteJson(join(options.outDir, "probe.json"), probe);

  await context.close();
  await browser.close();

   
  console.log(`[inspect] saved to: ${options.outDir}`);
  } finally {
    clearInterval(flushTimer);
    // 마지막 flush (실패해도 무시)
    await safeWriteJson(join(options.outDir, "run.json"), {
      finishedAt: new Date().toISOString(),
      pid: process.pid,
      note: "If meta.json is missing, the run likely crashed before finishing.",
    }).catch(() => null);
    await flushRequests().catch(() => null);
  }
}

main().catch((e) => {
   
  console.error("[inspect] failed:", e);
  process.exitCode = 1;
});

