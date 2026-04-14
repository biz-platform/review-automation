/**
 * 배민 셀프 리뷰 페이지에서 목표 리뷰의 "사장님 댓글 등록하기" 버튼 클릭 → 입력창 활성화 → 내용 입력 → "등록" 클릭.
 */
import * as BaeminSession from "@/lib/services/baemin/baemin-session-service";
import {
  PLAYWRIGHT_AUTOMATION_USER_AGENT,
  PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
  PLAYWRIGHT_DEFAULT_VIEWPORT,
  PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS,
} from "@/lib/config/playwright-defaults";
import { isPlaywrightHeadlessDefault } from "@/lib/config/server-env-readers";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  logMemory,
  logBrowserMemory,
  closeBrowserWithMemoryLog,
} from "@/lib/utils/browser-memory-logger";
import {
  dismissBaeminTodayPopup,
  dismissBaeminBackdropIfPresent,
} from "@/lib/services/baemin/baemin-dismiss-popup";
import { baeminUiReviewNumberFromStoredExternalId } from "@/lib/utils/baemin-external-id";
import { toYYYYMMDD } from "@/lib/utils/review-date-range";
import {
  BAEMIN_HIDDEN_REVIEW_REPLY_BLOCKED_MESSAGE,
  baeminReviewRowLooksMaskedReplyBlocked,
} from "@/lib/services/baemin/baemin-review-sync-exclude";

const SELF_URL = "https://self.baemin.com";
const FIND_REVIEW_SCROLL_MS = 100;
/** 리뷰 카드 lazy-load 시 main 스크롤 한 번에 이동(px). */
const FIND_REVIEW_SCROLL_STEP_PX = 900;
const MAX_SCROLL_ATTEMPTS = 80;

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

const LOG = "[baemin-register-reply]";

export type RegisterBaeminReplyParams = {
  reviewExternalId: string;
  content: string;
  /** 리뷰 작성일(ISO). 있으면 해당 일자~오늘 기간으로 목록 요청해 목표 리뷰가 포함되도록 함 */
  written_at?: string | null;
};

export type RegisterBaeminReplyOptions = {
  /** baemin_sync처럼 재로그인한 쿠키·shopNo 사용 시 (세션 만료 방지) */
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

export type DoOneBaeminRegisterReplyResult =
  | { outcome: "registered" }
  | { outcome: "already_registered"; existingReplyContent?: string };

function normalizeReplyTextForStorage(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

async function tryExtractExistingReplyContentFromRow(
  row: import("playwright").Locator,
): Promise<string | null> {
  const candidates: string[] = [];

  const bossReplyLabel = row.getByText(/사장님\s*댓글/, { exact: false }).first();
  const hasLabel = await bossReplyLabel.isVisible().catch(() => false);
  if (hasLabel) {
    const container = bossReplyLabel.locator(
      "xpath=ancestor::*[self::div or self::li][1]",
    );
    const t = await container.innerText().catch(() => "");
    if (t) candidates.push(t);
  }

  const rowText = await row.innerText().catch(() => "");
  if (rowText) candidates.push(rowText);

  for (const raw of candidates) {
    const text = raw.replace(/\s+\n/g, "\n").trim();
    if (!text) continue;

    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .filter(
        (l) =>
          !/^(수정|삭제|등록|취소|원문보기)$/.test(l) &&
          !/사장님\s*댓글\s*(등록하기|추가하기)?/.test(l) &&
          !/리뷰번호/.test(l),
      );

    const joined = normalizeReplyTextForStorage(lines.join("\n"));
    if (joined.length >= 5) return joined;
  }
  return null;
}

async function findActionableReviewRow(
  card: import("playwright").Locator,
  buttonPattern: RegExp,
): Promise<import("playwright").Locator | null> {
  let row = card;
  for (let up = 0; up < 30; up++) {
    const hasBtn =
      (await row.locator("button").filter({ hasText: buttonPattern }).count()) >
      0;
    if (hasBtn) return row;
    row = row.locator("..");
  }
  return null;
}

function escapeXpathText(s: string): string {
  if (!s.includes("'")) return `'${s}'`;
  return `concat('${s.split("'").join(`', "'", '`)}')`;
}

/** 숨김·의심 리뷰 카드에서 본문 영역 열기 */
async function tryExpandBaeminMaskedReviewRow(
  page: import("playwright").Page,
  row: import("playwright").Locator,
): Promise<void> {
  const expandBtn = row.getByRole("button", { name: /원문보기/ }).first();
  const visible = await expandBtn.isVisible().catch(() => false);
  if (!visible) return;
  await expandBtn.click({ timeout: 8_000 }).catch(() => null);
  await page.waitForTimeout(900);
}

/** 워커 배치용: page·shopNo·params만 받아 댓글 1건 등록. (같은 page에서 N건 순차 호출 가능) */
export async function doOneBaeminRegisterReply(
  page: import("playwright").Page,
  shopNo: string,
  params: RegisterBaeminReplyParams,
): Promise<DoOneBaeminRegisterReplyResult> {
  const reviewExternalId = baeminUiReviewNumberFromStoredExternalId(
    params.reviewExternalId,
  );
  const { content, written_at } = params;
  const toDate = new Date();
  const fromDate = written_at
    ? new Date(written_at.slice(0, 10))
    : new Date(toDate);
  if (!written_at) {
    fromDate.setDate(fromDate.getDate() - 180);
  }
  const fromStr = toYYYYMMDD(fromDate);
  const toStr = toYYYYMMDD(toDate);
  const search = new URLSearchParams({
    from: fromStr,
    to: toStr,
    offset: "0",
    limit: "20",
  }).toString();
  const fullUrl = `${SELF_URL}/shops/${shopNo}/reviews?${search}`;
  console.log(LOG, "params", {
    reviewExternalId,
    written_at: written_at ?? null,
    from: fromStr,
    to: toStr,
    fullUrl,
  });

  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS,
  });
  await dismissBaeminTodayPopup(page);
  await page
    .waitForSelector("select option", { state: "attached", timeout: 8_000 })
    .catch(() => null);

  const bodyText = await page
    .locator("body")
    .innerText()
    .catch(() => "");
  // 중요: broad filter(hasText)로 잡으면 상위 래퍼가 매칭되어 다른 리뷰 상태를 읽을 수 있다.
  // "리뷰번호 {id}"를 포함하는 ReviewItem 중 "가장 안쪽(innermost)" 카드만 타깃으로 고정.
  const reviewCard = page.locator(
    `xpath=(//*[contains(@class,'ReviewItem') and contains(normalize-space(.), '리뷰번호 ${reviewExternalId}') and not(descendant::*[contains(@class,'ReviewItem') and contains(normalize-space(.), '리뷰번호 ${reviewExternalId}')])])[1]`,
  );
  const virtualRowScope = page.locator(
    `xpath=(//div[@data-index and contains(normalize-space(.), ${escapeXpathText(`리뷰번호 ${reviewExternalId}`)}) and .//button[contains(normalize-space(.), '사장님 댓글 등록하기') or contains(normalize-space(.), '사장님 댓글 추가하기') or contains(normalize-space(.), '수정') or contains(normalize-space(.), '삭제')]])[1]`,
  );
  const actionableScope = page.locator(
    `xpath=(//*[contains(normalize-space(.), ${escapeXpathText(`리뷰번호 ${reviewExternalId}`)}) and .//button[contains(normalize-space(.), '사장님 댓글 등록하기') or contains(normalize-space(.), '사장님 댓글 추가하기') or contains(normalize-space(.), '수정') or contains(normalize-space(.), '삭제')]])[1]`,
  );

  const virtualRowFromCard = reviewCard
    .first()
    .locator("xpath=ancestor::div[@data-index][1]");
  const candidateScopes = [
    virtualRowScope,
    virtualRowFromCard,
    actionableScope,
    reviewCard,
  ];
  let rowCandidate: import("playwright").Locator | null = null;
  for (const scope of candidateScopes) {
    const visible = await scope
      .first()
      .isVisible()
      .catch(() => false);
    if (visible) {
      rowCandidate = scope.first();
      break;
    }
  }

  let cardVisible = rowCandidate != null;
  if (!cardVisible) {
    cardVisible = await actionableScope
      .first()
      .isVisible()
      .catch(
        async () =>
          await reviewCard
            .first()
            .isVisible()
            .catch(() => false),
      );
  }
  if (!cardVisible) {
    cardVisible = await reviewCard
      .first()
      .isVisible()
      .catch(() => false);
  }
  if (!cardVisible) {
    for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
      await page.evaluate((step) => {
        const main = document.querySelector("main");
        if (main && main.scrollHeight > main.clientHeight) {
          main.scrollTop += step;
          return;
        }
        window.scrollBy(0, step);
      }, FIND_REVIEW_SCROLL_STEP_PX);
      await page.waitForTimeout(FIND_REVIEW_SCROLL_MS);
      rowCandidate = null;
      for (const scope of candidateScopes) {
        const visible = await scope
          .first()
          .isVisible()
          .catch(() => false);
        if (visible) {
          rowCandidate = scope.first();
          break;
        }
      }
      cardVisible = rowCandidate != null;
      if (cardVisible) break;
    }
  }

  if (!cardVisible) {
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})를 페이지에서 찾지 못했습니다. 기간/필터를 바꾸거나 나중에 다시 시도해 주세요.`,
    );
  }

  const card = reviewCard.first();
  const row =
    rowCandidate ??
    (await findActionableReviewRow(
      card,
      /사장님\s*댓글\s*등록하기|사장님\s*댓글\s*추가하기|수정|삭제/,
    )) ??
    card;

  const cardTextPreview = await row
    .innerText()
    .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 220))
    .catch(() => "(unreadable)");
  console.log(LOG, "target card", {
    reviewExternalId,
    cardTextPreview,
  });
  await tryExpandBaeminMaskedReviewRow(page, row);
  await row.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(400);

  const registerBtnText = /사장님\s*댓글\s*등록하기/;
  const registerBtn = row
    .locator("button")
    .filter({ hasText: registerBtnText })
    .first();

  const registerBtnVisible = await registerBtn.isVisible().catch(() => false);
  if (!registerBtnVisible) {
    const hasModifyBtn =
      (await row.locator("button").filter({ hasText: /수정/ }).count()) > 0;
    if (hasModifyBtn) {
      const existing = await tryExtractExistingReplyContentFromRow(row);
      console.log(LOG, "리뷰에 이미 답글이 등록됨(수정 버튼 있음). 등록 생략.", {
        extracted: existing ? existing.slice(0, 40) : null,
      });
      return existing
        ? { outcome: "already_registered", existingReplyContent: existing }
        : { outcome: "already_registered" };
    }
    const rowText = await row
      .innerText()
      .then((t) => t.replace(/\s+/g, " ").trim())
      .catch(() => "");
    if (baeminReviewRowLooksMaskedReplyBlocked(rowText)) {
      throw new Error(BAEMIN_HIDDEN_REVIEW_REPLY_BLOCKED_MESSAGE);
    }
    const existing = await tryExtractExistingReplyContentFromRow(row);
    if (existing) {
      console.log(LOG, "등록 버튼 없음 + 기존 답글 추정. 등록 대신 DB 반영 대상으로 처리.", {
        extracted: existing.slice(0, 40),
      });
      return { outcome: "already_registered", existingReplyContent: existing };
    }
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})에서 '사장님 댓글 등록하기' 버튼을 찾지 못했습니다. 이미 답글이 등록되었거나 UI가 변경되었을 수 있습니다.`,
    );
  }

  const clearOverlaysBeforeRegisterClick = async (): Promise<void> => {
    await dismissBaeminTodayPopup(page).catch(() => null);
    await dismissBaeminBackdropIfPresent(page);
    await row.scrollIntoViewIfNeeded().catch(() => null);
    await registerBtn.scrollIntoViewIfNeeded().catch(() => null);
    await page.waitForTimeout(350);
  };

  const clickRegisterWithRetries = async (): Promise<void> => {
    const tryNormalClick = async (): Promise<void> => {
      await clearOverlaysBeforeRegisterClick();
      await registerBtn.click({ timeout: 15_000 });
    };

    try {
      await tryNormalClick();
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const overlayLike =
        /intercepts pointer events|backdrop|intercepts|pointer events/i.test(msg);
      if (!overlayLike) throw e;
    }

    try {
      await clearOverlaysBeforeRegisterClick();
      await page.waitForTimeout(500);
      await registerBtn.click({ timeout: 15_000 });
    } catch {
      await clearOverlaysBeforeRegisterClick();
      await page.waitForTimeout(300);
      await registerBtn.click({ timeout: 12_000, force: true });
    }
  };

  await clickRegisterWithRetries();

  // textarea는 리뷰 카드 내부 우선으로 찾고, 없으면 전역 visible textarea로 폴백.
  const textareaInRow = row.locator("textarea:visible").first();
  const textarea =
    (await textareaInRow.count()) > 0
      ? textareaInRow
      : page.locator("textarea:visible").first();
  await textarea.waitFor({ state: "visible", timeout: 8_000 });
  await textarea.fill(content);

  const submitBtnInSameContainer = textarea
    .locator(
      "xpath=ancestor::*[.//button[contains(normalize-space(.), '등록')] and .//button[contains(normalize-space(.), '취소')]][1]",
    )
    .locator("button")
    .filter({ hasText: /^등록$/ })
    .first();
  const submitBtn = (await submitBtnInSameContainer.count())
    ? submitBtnInSameContainer
    : page
        .locator("button:visible")
        .filter({ hasText: /^등록$/ })
        .first();
  await submitBtn.click({ timeout: 5_000 });

  // 기존엔 클릭 후 대기만 해서 "거짓 성공"이 발생했다.
  // 등록 성공이면 같은 리뷰 행에 "수정/삭제" 또는 "사장님 댓글 추가하기"가 나타나고,
  // 실패면 여전히 "사장님 댓글 등록하기"가 남거나 에러 토스트/문구가 노출된다.
  const rowAfter = row;
  let verified = false;
  const deadline = Date.now() + 12_000;
  while (Date.now() < deadline) {
    await page.waitForTimeout(400);
    const hasModify =
      (await rowAfter.locator("button").filter({ hasText: /수정/ }).count()) >
      0;
    const hasDelete =
      (await rowAfter.locator("button").filter({ hasText: /삭제/ }).count()) >
      0;
    const hasAddMore =
      (await rowAfter
        .locator("button")
        .filter({ hasText: /사장님\s*댓글\s*추가하기/ })
        .count()) > 0;
    if (hasModify || hasDelete || hasAddMore) {
      verified = true;
      break;
    }
  }

  if (!verified) {
    const stillRegisterVisible = await rowAfter
      .locator("button")
      .filter({ hasText: /사장님\s*댓글\s*등록하기/ })
      .first()
      .isVisible()
      .catch(() => false);

    const bodyText = await page
      .locator("body")
      .innerText()
      .catch(() => "");
    const hasKnownFailure =
      /실패|오류|다시\s*시도|일시적|권한|제한|숨김|허위\s*리뷰|허위리뷰|의심/.test(
        bodyText,
      );

    if (stillRegisterVisible || hasKnownFailure) {
      const hasModifyNow =
        (await rowAfter.locator("button").filter({ hasText: /수정/ }).count()) >
        0;
      const hasDeleteNow =
        (await rowAfter.locator("button").filter({ hasText: /삭제/ }).count()) >
        0;
      const hasAddNow =
        (await rowAfter
          .locator("button")
          .filter({ hasText: /사장님\s*댓글\s*추가하기/ })
          .count()) > 0;
      throw new Error(
        `배민 답글 등록 확인 실패: reviewExternalId=${reviewExternalId}, registerVisible=${stillRegisterVisible}, modify=${hasModifyNow}, delete=${hasDeleteNow}, add=${hasAddNow}, knownFailure=${hasKnownFailure}`,
      );
    }
  }

  return { outcome: "registered" };
}

export type BaeminRegisterReplySession = {
  page: import("playwright").Page;
  context: import("playwright").BrowserContext;
  browser: import("playwright").Browser;
  shopNo: string;
  close: () => Promise<void>;
};

/** 워커 배치용: 브라우저 launch + context + cookies + newPage 까지 수행. close() 시 브라우저 종료. */
export async function createBaeminRegisterReplySession(
  storeId: string,
  userId: string,
  sessionOverride?: { cookies: CookieItem[]; shopNo: string },
): Promise<BaeminRegisterReplySession> {
  let cookies: CookieItem[];
  let shopNo: string;
  if (sessionOverride) {
    cookies = sessionOverride.cookies;
    shopNo = sessionOverride.shopNo;
  } else {
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const id = await BaeminSession.getBaeminShopId(storeId, userId);
    if (!id) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    shopNo = id;
  }
  if (!cookies.length) {
    throw new Error(
      "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
    );
  }

  const playwright = await import("playwright").catch(() => {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  });

  const headless = isPlaywrightHeadlessDefault();
  logMemory(`${LOG} before launch`);
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
  });
  logMemory(`${LOG} after launch`);
  logBrowserMemory(browser as unknown, LOG);

  const context = await browser.newContext({
    userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
    viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
  });
  await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
  const page = await context.newPage();

  return {
    page,
    context,
    browser,
    shopNo,
    close: () => closeBrowserWithMemoryLog(browser, LOG),
  };
}

/**
 * 배민 리뷰 페이지 접속 후 해당 리뷰 카드에서
 * "사장님 댓글 등록하기" 클릭 → textarea 활성화 → 내용 입력 → "등록" 클릭.
 * sessionOverride 없으면 DB 저장 쿠키 사용, 있으면 해당 쿠키·shopNo 사용(재로그인 시).
 */
export async function registerBaeminReplyViaBrowser(
  storeId: string,
  userId: string,
  params: RegisterBaeminReplyParams,
  options?: RegisterBaeminReplyOptions,
): Promise<void> {
  const session = await createBaeminRegisterReplySession(
    storeId,
    userId,
    options?.sessionOverride,
  );
  try {
    await doOneBaeminRegisterReply(session.page, session.shopNo, params);
  } finally {
    await session.close();
  }
}

// --- 수정/삭제 공통: 리뷰 페이지 로드 후 목표 리뷰 카드·버튼 행 찾기 (등록과 동일한 URL/스크롤 로직)
async function navigateToBaeminReviewsAndFindRow(
  page: import("playwright").Page,
  shopNo: string,
  reviewExternalId: string,
  written_at: string | null | undefined,
  buttonText: RegExp | string,
): Promise<{
  card: import("playwright").Locator;
  row: import("playwright").Locator;
}> {
  const uiReviewNo = baeminUiReviewNumberFromStoredExternalId(reviewExternalId);
  const toDate = new Date();
  const fromDate = written_at
    ? new Date(written_at.slice(0, 10))
    : new Date(toDate);
  if (!written_at) {
    fromDate.setDate(fromDate.getDate() - 180);
  }
  const fromStr = toYYYYMMDD(fromDate);
  const toStr = toYYYYMMDD(toDate);
  const search = new URLSearchParams({
    from: fromStr,
    to: toStr,
    offset: "0",
    limit: "20",
  }).toString();
  const fullUrl = `${SELF_URL}/shops/${shopNo}/reviews?${search}`;
  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS,
  });
  await dismissBaeminTodayPopup(page);
  await page
    .waitForSelector("select option", { state: "attached", timeout: 8_000 })
    .catch(() => null);

  const reviewCard = page.locator('[class*="ReviewItem"]').filter({
    has: page.getByText(uiReviewNo, { exact: false }),
  });
  let cardVisible = await reviewCard
    .first()
    .isVisible()
    .catch(() => false);
  if (!cardVisible) {
    for (let i = 0; i < MAX_SCROLL_ATTEMPTS; i++) {
      await page.evaluate((step) => {
        const main = document.querySelector("main");
        if (main && main.scrollHeight > main.clientHeight) {
          main.scrollTop += step;
          return;
        }
        window.scrollBy(0, step);
      }, FIND_REVIEW_SCROLL_STEP_PX);
      await page.waitForTimeout(FIND_REVIEW_SCROLL_MS);
      cardVisible = await reviewCard
        .first()
        .isVisible()
        .catch(() => false);
      if (cardVisible) break;
    }
  }
  if (!cardVisible) {
    throw new Error(
      `리뷰(리뷰번호 ${uiReviewNo})를 페이지에서 찾지 못했습니다.`,
    );
  }

  const card = reviewCard.first();
  await card.scrollIntoViewIfNeeded().catch(() => null);
  await page.waitForTimeout(400);
  await tryExpandBaeminMaskedReviewRow(page, card);

  const pattern =
    typeof buttonText === "string" ? new RegExp(buttonText) : buttonText;
  let row = card;
  let found = false;
  for (let up = 0; up < 10; up++) {
    const hasBtn =
      (await row.locator("button").filter({ hasText: pattern }).count()) > 0;
    if (hasBtn) {
      found = true;
      break;
    }
    row = row.locator("..");
  }
  if (!found) {
    const rowText = await card
      .innerText()
      .then((t) => t.replace(/\s+/g, " ").trim())
      .catch(() => "");
    if (baeminReviewRowLooksMaskedReplyBlocked(rowText)) {
      throw new Error(BAEMIN_HIDDEN_REVIEW_REPLY_BLOCKED_MESSAGE);
    }
    throw new Error(
      `삭제/수정할 답글이 있는 리뷰 행을 찾지 못했습니다. 리뷰번호: ${uiReviewNo}. ` +
        "리뷰가 이미 삭제되었거나, 해당 페이지 목록에 없을 수 있습니다. 실시간 리뷰 불러오기 후 다시 시도해 보세요.",
    );
  }
  return { card, row };
}

export type ModifyBaeminReplyParams = {
  reviewExternalId: string;
  content: string;
  written_at?: string | null;
};

export type ModifyBaeminReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

/**
 * 배민 리뷰 페이지에서 해당 리뷰의 "수정" 클릭 → textarea에 새 내용 입력 → "저장" 클릭.
 */
export async function modifyBaeminReplyViaBrowser(
  storeId: string,
  userId: string,
  params: ModifyBaeminReplyParams,
  options?: ModifyBaeminReplyOptions,
): Promise<void> {
  const { reviewExternalId, content, written_at } = params;

  let cookies: CookieItem[];
  let shopNo: string;
  if (options?.sessionOverride) {
    cookies = options.sessionOverride.cookies;
    shopNo = options.sessionOverride.shopNo;
  } else {
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const id = await BaeminSession.getBaeminShopId(storeId, userId);
    if (!id) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    shopNo = id;
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const headless = isPlaywrightHeadlessDefault();
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });
    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
    const page = await context.newPage();

    const { row } = await navigateToBaeminReviewsAndFindRow(
      page,
      shopNo,
      reviewExternalId,
      written_at,
      /수정/,
    );

    await dismissBaeminBackdropIfPresent(page);
    const modifyBtn = row.locator("button").filter({ hasText: /수정/ }).first();
    await modifyBtn.click({ timeout: 10_000, force: true });

    const textarea = row.locator("textarea").first();
    await textarea.waitFor({ state: "visible", timeout: 8_000 });
    await textarea.fill(content);

    const saveBtn = row.getByRole("button", { name: "저장" }).first();
    await saveBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}

export type DeleteBaeminReplyParams = {
  reviewExternalId: string;
  written_at?: string | null;
};

export type DeleteBaeminReplyOptions = {
  sessionOverride?: { cookies: CookieItem[]; shopNo: string };
};

/**
 * 배민 리뷰 페이지에서 해당 리뷰의 "삭제" 클릭 → 모달 "선택하신 댓글을 삭제하시겠습니까?" → "확인" 클릭.
 */
export async function deleteBaeminReplyViaBrowser(
  storeId: string,
  userId: string,
  params: DeleteBaeminReplyParams,
  options?: DeleteBaeminReplyOptions,
): Promise<void> {
  const { reviewExternalId: reviewExternalIdRaw, written_at } = params;
  const uiReviewNo =
    baeminUiReviewNumberFromStoredExternalId(reviewExternalIdRaw);

  let cookies: CookieItem[];
  let shopNo: string;
  if (options?.sessionOverride) {
    cookies = options.sessionOverride.cookies;
    shopNo = options.sessionOverride.shopNo;
  } else {
    const stored = await BaeminSession.getBaeminCookies(storeId, userId);
    if (!stored?.length) {
      throw new Error(
        "배민 세션이 없습니다. 먼저 매장 연동(로그인)을 진행해 주세요.",
      );
    }
    cookies = stored;
    const id = await BaeminSession.getBaeminShopId(storeId, userId);
    if (!id) {
      throw new Error(
        "배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.",
      );
    }
    shopNo = id;
  }

  let playwright: typeof import("playwright");
  try {
    playwright = await import("playwright");
  } catch {
    throw new Error(
      "Playwright가 필요합니다. npm install playwright 후 npx playwright install chromium 을 실행해 주세요.",
    );
  }

  const headless = isPlaywrightHeadlessDefault();
  const browser = await playwright.chromium.launch({
    headless,
    args: [
      ...PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS,
      "--disable-blink-features=AutomationControlled",
    ],
  });

  try {
    const context = await browser.newContext({
      userAgent: PLAYWRIGHT_AUTOMATION_USER_AGENT,
      viewport: PLAYWRIGHT_DEFAULT_VIEWPORT,
    });
    await context.addCookies(toPlaywrightCookies(cookies, SELF_URL));
    const page = await context.newPage();

    const { row } = await navigateToBaeminReviewsAndFindRow(
      page,
      shopNo,
      reviewExternalIdRaw,
      written_at,
      /삭제/,
    );

    await dismissBaeminBackdropIfPresent(page);
    const deleteBtn = row.locator("button").filter({ hasText: /삭제/ }).first();
    try {
      await deleteBtn.click({ timeout: 10_000, force: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("Timeout") || msg.includes("exceeded")) {
        throw new Error(
          `리뷰번호: ${uiReviewNo}. ` +
            "리뷰가 이미 삭제되었거나 화면 목록에 없을 수 있습니다.",
        );
      }
      throw e;
    }

    const modal = page.getByRole("alertdialog").filter({
      has: page.getByText("선택하신 댓글을 삭제하시겠습니까?", {
        exact: false,
      }),
    });
    await modal.waitFor({ state: "visible", timeout: 8_000 });
    const confirmBtn = modal.getByRole("button", { name: "확인" }).first();
    await confirmBtn.click({ timeout: 5_000 });
    await page.waitForTimeout(2_000);
  } finally {
    await closeBrowserWithMemoryLog(browser, LOG);
  }
}
