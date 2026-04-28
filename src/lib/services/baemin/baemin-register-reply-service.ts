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
import { sanitizeBaeminReplyProhibitedTerms } from "@/lib/utils/baemin/sanitize-baemin-reply-prohibited";

const SELF_URL = "https://self.baemin.com";
/** 목록 1차: 전체 탭 — 답 등록 직후·재시도 시 미답변 탭에서만 빠지는 케이스를 한 번에 커버(불필요한 이중 goto 감소) */
const BAEMIN_REVIEWS_REGISTER_TAB_PRIMARY = "all";
/** 1차에서 못 찾을 때만 미답변 탭(행 수 적을 때 스크롤 부담 완화) */
const BAEMIN_REVIEWS_REGISTER_TAB_FALLBACK = "noComment";
const FIND_REVIEW_SCROLL_MS = 100;
/** 리뷰 카드 lazy-load 시 main 스크롤 한 번에 이동(px). */
const FIND_REVIEW_SCROLL_STEP_PX = 900;
const MAX_SCROLL_ATTEMPTS = 80;
/** domcontentloaded 직후 리뷰 카드가 아직 없을 때 대비 */
const BAEMIN_REVIEW_LIST_ATTACHED_MS = 15_000;

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
const DEBUG_DIR = "tmp/baemin-reply-debug";

async function captureBaeminReplyDebugArtifacts(params: {
  page: import("playwright").Page;
  reviewExternalId: string;
  stage: "verify_failed" | "no_register_button";
}): Promise<{ screenshotPath?: string; bodySnippet?: string }> {
  const { page, reviewExternalId, stage } = params;
  const out: { screenshotPath?: string; bodySnippet?: string } = {};

  try {
    const text = await page.locator("body").innerText().catch(() => "");
    const normalized = (text ?? "").replace(/\s+/g, " ").trim();
    if (normalized) out.bodySnippet = normalized.slice(0, 420);
  } catch {
    // ignore
  }

  try {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const cwd = process.cwd();
    const dir = path.join(cwd, DEBUG_DIR);
    await fs.mkdir(dir, { recursive: true });
    const safeId = reviewExternalId.replace(/[^0-9a-zA-Z:_-]/g, "_");
    const filename = `baemin-${stage}-${safeId}-${Date.now()}.png`;
    const filePath = path.join(dir, filename);
    await page.screenshot({ path: filePath, fullPage: true }).catch(() => null);
    out.screenshotPath = filePath;
  } catch {
    // ignore
  }

  return out;
}

export type RegisterBaeminReplyParams = {
  reviewExternalId: string;
  content: string;
  /** 리뷰 `author_name` — 닉네임에 금칙어가 있어도 등록 가능하도록 호칭 치환에 사용 */
  customerNickname?: string | null;
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

function alreadyRegisteredResult(
  existing: string | null,
): DoOneBaeminRegisterReplyResult {
  if (
    existing &&
    existing.trim().length >= 5 &&
    !isBaeminReplyDomExtractCorrupted(existing)
  ) {
    return { outcome: "already_registered", existingReplyContent: existing };
  }
  return { outcome: "already_registered" };
}

/** self.baemin 리뷰 목록 카드가 DOM에 붙을 때까지(첫 페인트·iframe 지연 완화) */
async function waitForBaeminSelfReviewListAttached(
  page: import("playwright").Page,
): Promise<void> {
  await page
    .locator('[class*="ReviewItem"]')
    .first()
    .waitFor({ state: "attached", timeout: BAEMIN_REVIEW_LIST_ATTACHED_MS })
    .catch(() => null);
}

/**
 * self 리뷰는 SPA라 URL의 /shops/{shopNo}/ 와 상단 매장 select가 어긋날 수 있음(직전에 보던 점포 유지).
 * 다매장 계정에서 리뷰번호·등록 버튼 탐색이 엉키는 주된 원인이라, 옵션이 있으면 value를 맞춘다.
 */
async function ensureBaeminSelfReviewShopSelected(
  page: import("playwright").Page,
  shopNo: string,
): Promise<void> {
  const select = page.locator(`select:has(option[value="${shopNo}"])`).first();
  if ((await select.count().catch(() => 0)) === 0) return;
  const cur = await select.inputValue().catch(() => "");
  if (cur === shopNo) return;
  await select.selectOption(shopNo, { timeout: 12_000 });
  await page.waitForTimeout(500);
  await waitForBaeminSelfReviewListAttached(page);
}

/** `tab` null → 쿼리 생략(셀프 기본 목록, 수정/삭제 navigate와 동일) */
async function loadBaeminRegisterReplyListPage(
  page: import("playwright").Page,
  shopNo: string,
  tab: string | null,
  fromStr: string,
  toStr: string,
  reviewExternalId: string,
): Promise<void> {
  const q = new URLSearchParams({
    from: fromStr,
    to: toStr,
    offset: "0",
    limit: "20",
  });
  if (tab != null) q.set("tab", tab);
  const fullUrl = `${SELF_URL}/shops/${shopNo}/reviews?${q.toString()}`;
  console.log(LOG, "list page", {
    reviewExternalId,
    tab: tab ?? "(omit=default)",
    from: fromStr,
    to: toStr,
    fullUrl,
  });
  await page.goto(fullUrl, {
    waitUntil: "domcontentloaded",
    timeout: PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS,
  });
  await dismissBaeminTodayPopup(page);
  await dismissBaeminBackdropIfPresent(page);
  await page
    .waitForSelector("select option", { state: "attached", timeout: 8_000 })
    .catch(() => null);
  await ensureBaeminSelfReviewShopSelected(page, shopNo);
  await waitForBaeminSelfReviewListAttached(page);
}

async function findBaeminRegisterReplyRowCandidate(
  page: import("playwright").Page,
  reviewExternalId: string,
): Promise<{
  cardVisible: boolean;
  rowCandidate: import("playwright").Locator | null;
  reviewCard: import("playwright").Locator;
}> {
  const reviewCard = page.locator(
    `xpath=(//*[contains(@class,'ReviewItem') and contains(normalize-space(.), '리뷰번호 ${reviewExternalId}') and not(descendant::*[contains(@class,'ReviewItem') and contains(normalize-space(.), '리뷰번호 ${reviewExternalId}')])])[1]`,
  );
  const virtualRowScope = page.locator(
    `xpath=(//div[@data-index and contains(normalize-space(.), ${escapeXpathText(`리뷰번호 ${reviewExternalId}`)}) and .//button[contains(normalize-space(.), '사장님 댓글 등록하기') or contains(normalize-space(.), '수정') or contains(normalize-space(.), '삭제')]])[1]`,
  );
  const actionableScope = page.locator(
    `xpath=(//*[contains(normalize-space(.), ${escapeXpathText(`리뷰번호 ${reviewExternalId}`)}) and .//button[contains(normalize-space(.), '사장님 댓글 등록하기') or contains(normalize-space(.), '수정') or contains(normalize-space(.), '삭제')]])[1]`,
  );

  const virtualRowFromCard = reviewCard
    .first()
    .locator("xpath=ancestor::div[@data-index][1]");
  const candidateScopes = [
    virtualRowFromCard,
    actionableScope,
    reviewCard,
    virtualRowScope,
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

  return { cardVisible, rowCandidate, reviewCard };
}

type BaeminRegisterReplyTabOrder = "all_first" | "no_comment_first";

/**
 * 리로드·탭 전환 뒤에도 동일 리뷰의 행 Locator를 다시 잡는다.
 * 가상 리스트에서 이전 `row` 참조가 무효화되거나 뷰포트 밖으로 나가면 검증 추출이 항상 null이 되는 문제를 막는다.
 *
 * @param tabOrder `all_first`(기본): 제출 직후 행이 미답변 탭에서 빠진 경우 1회 goto로 잡기.
 */
async function resolveBaeminRegisterReplyRowLocator(
  page: import("playwright").Page,
  shopNo: string,
  reviewExternalId: string,
  fromStr: string,
  toStr: string,
  tabOrder: BaeminRegisterReplyTabOrder = "all_first",
): Promise<import("playwright").Locator | null> {
  const [firstTab, secondTab] =
    tabOrder === "all_first"
      ? (["all", BAEMIN_REVIEWS_REGISTER_TAB_FALLBACK] as const)
      : ([BAEMIN_REVIEWS_REGISTER_TAB_FALLBACK, "all"] as const);

  await loadBaeminRegisterReplyListPage(
    page,
    shopNo,
    firstTab,
    fromStr,
    toStr,
    reviewExternalId,
  );
  let { cardVisible, rowCandidate, reviewCard } =
    await findBaeminRegisterReplyRowCandidate(page, reviewExternalId);

  if (!cardVisible) {
    await loadBaeminRegisterReplyListPage(
      page,
      shopNo,
      secondTab,
      fromStr,
      toStr,
      reviewExternalId,
    );
    ({ cardVisible, rowCandidate, reviewCard } =
      await findBaeminRegisterReplyRowCandidate(page, reviewExternalId));
  }

  if (!cardVisible) return null;

  const card = reviewCard.first();
  const actionBtnPattern = /사장님\s*댓글\s*등록하기|수정|삭제/;
  let row =
    rowCandidate ??
    (await findActionableReviewRow(card, actionBtnPattern)) ??
    card;

  const countActionButtons = async (
    loc: import("playwright").Locator,
  ): Promise<number> =>
    loc.locator("button").filter({ hasText: actionBtnPattern }).count();

  if ((await countActionButtons(row).catch(() => 0)) === 0) {
    const lifted = await findActionableReviewRow(card, actionBtnPattern);
    if (lifted && (await countActionButtons(lifted).catch(() => 0)) > 0) {
      row = lifted;
    } else {
      const dataRow = card.locator("xpath=ancestor::div[@data-index][1]");
      if ((await countActionButtons(dataRow).catch(() => 0)) > 0) {
        row = dataRow;
      }
    }
  }

  const dataRowFromCard = card.locator("xpath=ancestor::div[@data-index][1]");
  if ((await countActionButtons(dataRowFromCard).catch(() => 0)) > 0) {
    row = dataRowFromCard;
  }

  return row;
}

function normalizeReplyTextForStorage(s: string): string {
  return s
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((l) => l.trimEnd())
    .join("\n")
    .trim();
}

/**
 * 리뷰 카드 전체가 innerText로 섞였거나, UI 메타·자모 붕괴가 담긴 추출물.
 * 이런 문자열로 `reviews.platform_reply_content`를 덮어쓰지 않도록 한다.
 */
export function isBaeminReplyDomExtractCorrupted(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (t.length > 2400) return true;
  const lines = t.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 42) return true;
  if (/리뷰번호\s*[:：]?\s*\d+/i.test(t)) return true;
  if (/파트너님에게만\s*보이는/.test(t)) return true;
  if (/주문메뉴\s*[:：]/.test(t)) return true;
  if (/배달리뷰\s*[:：]/.test(t)) return true;
  if (/\d+\s*회\s*주문\s*고객/.test(t)) return true;
  if (/(?:ㄴㄷ){20,}/.test(t)) return true;
  if (/(?:알뜰|가게|한집)배달/.test(t) && t.length > 400) return true;
  if (/고객님의\s*소중한\s*리뷰/.test(t) && t.length > 120) return true;
  if (/배민\s*1\s*:\s*1\s*문의|파트너\s*센터|고객\s*센터/.test(t) && t.length > 200)
    return true;
  return false;
}

async function tryExtractExistingReplyContentFromRow(
  row: import("playwright").Locator,
): Promise<string | null> {
  const candidates: string[] = [];

  const bossReplyLabel = row.getByText(/사장님\s*댓글/, { exact: false }).first();
  const hasLabel = await bossReplyLabel.isVisible().catch(() => false);
  if (hasLabel) {
    for (let depth = 1; depth <= 4; depth++) {
      const container = bossReplyLabel.locator(
        `xpath=ancestor::*[self::div or self::li][${depth}]`,
      );
      const t = await container.innerText().catch(() => "");
      if (t) candidates.push(t);
    }
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
          !/리뷰번호/.test(l) &&
          !/^(가게배달|알뜰배달|한집배달)$/.test(l) &&
          !/^\d+\s*회\s*주문\s*고객/.test(l) &&
          !/^주문메뉴\s*[:：]/.test(l) &&
          !/^배달리뷰\s*[:：]/.test(l) &&
          !/파트너님에게만\s*보이는/.test(l) &&
          !/^운영자$/.test(l) &&
          !/^\d{4}년\s*\d{1,2}월\s*\d{1,2}일$/.test(l) &&
          !/^\d{1,2}점$/.test(l),
      );

    const joined = normalizeReplyTextForStorage(lines.join("\n"));
    if (joined.length >= 5 && !isBaeminReplyDomExtractCorrupted(joined))
      return joined;
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

/** 배민 UI: 실제 DOM이 button이 아니거나 가상 리스트로 Playwright click이 막힐 때 대비 */
const BAEMIN_REGISTER_REPLY_BTN_RE = /사장님\s*댓글\s*등록하기/;

function buildBaeminRegisterReplyButtonLocator(
  row: import("playwright").Locator,
): import("playwright").Locator {
  // getByRole(XPath 기반 row) 조합에서 click 단계가 waiting for locator로만 막히는 케이스가 있어,
  // 실제 DOM(버튼 type=button + 자식 generic 텍스트)에 맞춰 button + hasText만 쓴다.
  return row
    .locator("button, a, [role='button']")
    .filter({ hasText: BAEMIN_REGISTER_REPLY_BTN_RE })
    .first();
}

async function tryBaeminProgrammaticRegisterClick(
  page: import("playwright").Page,
  reviewUiNumber: string,
): Promise<boolean> {
  return page.evaluate((reviewUiNumber) => {
    const labelRe = /사장님\s*댓글\s*등록하기/;
    const marker = `리뷰번호 ${reviewUiNumber}`;
    const roots = document.querySelectorAll(
      '[class*="ReviewItem"], div[data-index]',
    );
    for (let i = 0; i < roots.length; i++) {
      const block = roots[i] as HTMLElement;
      const flat = (block.textContent ?? "").replace(/\s+/g, " ");
      if (!flat.includes(marker)) continue;
      const controls = block.querySelectorAll(
        "button, [role='button'], a[role='button'], a",
      );
      for (let j = 0; j < controls.length; j++) {
        const el = controls[j] as HTMLElement;
        const t = (el.textContent ?? "").replace(/\s+/g, " ").trim();
        if (!labelRe.test(t)) continue;
        el.scrollIntoView({ block: "center", inline: "nearest" });
        el.click();
        return true;
      }
    }
    return false;
  }, reviewUiNumber);
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

/**
 * 워커 배치용: page·shopNo·params만 받아 댓글 1건 등록. (같은 page에서 N건 순차 호출 가능)
 * 1차 `tab=all`(이미 답된 행·재시도 시에도 한 번에 매칭), 못 찾으면 `tab=noComment`로 한 번 더 로드한다.
 */
export async function doOneBaeminRegisterReply(
  page: import("playwright").Page,
  shopNo: string,
  params: RegisterBaeminReplyParams,
): Promise<DoOneBaeminRegisterReplyResult> {
  const reviewExternalId = baeminUiReviewNumberFromStoredExternalId(
    params.reviewExternalId,
  );
  const content = sanitizeBaeminReplyProhibitedTerms(
    params.content,
    params.customerNickname ?? null,
  );
  const { written_at } = params;
  const toDate = new Date();
  const fromDate = written_at
    ? new Date(written_at.slice(0, 10))
    : new Date(toDate);
  if (!written_at) {
    fromDate.setDate(fromDate.getDate() - 180);
  }
  const fromStr = toYYYYMMDD(fromDate);
  const toStr = toYYYYMMDD(toDate);

  console.log(LOG, "register context", {
    reviewExternalId,
    written_at: written_at ?? null,
    listTabFirst: BAEMIN_REVIEWS_REGISTER_TAB_PRIMARY,
    listTabFallback: BAEMIN_REVIEWS_REGISTER_TAB_FALLBACK,
    from: fromStr,
    to: toStr,
  });

  await loadBaeminRegisterReplyListPage(
    page,
    shopNo,
    BAEMIN_REVIEWS_REGISTER_TAB_PRIMARY,
    fromStr,
    toStr,
    reviewExternalId,
  );
  let { cardVisible, rowCandidate, reviewCard } =
    await findBaeminRegisterReplyRowCandidate(page, reviewExternalId);

  if (!cardVisible) {
    console.warn(LOG, "전체(tab=all)에서 리뷰 미발견 → 미답변(tab=noComment)로 폴백", {
      reviewExternalId,
      from: fromStr,
      to: toStr,
    });
    await loadBaeminRegisterReplyListPage(
      page,
      shopNo,
      BAEMIN_REVIEWS_REGISTER_TAB_FALLBACK,
      fromStr,
      toStr,
      reviewExternalId,
    );
    ({ cardVisible, rowCandidate, reviewCard } =
      await findBaeminRegisterReplyRowCandidate(page, reviewExternalId));
  }

  if (!cardVisible) {
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})를 전체(all)·미답변(noComment) 목록에서 모두 찾지 못했습니다. 기간(${fromStr}~${toStr})을 넓히거나 sync 후 다시 시도해 주세요.`,
    );
  }

  const card = reviewCard.first();
  const actionBtnPattern = /사장님\s*댓글\s*등록하기|수정|삭제/;
  let row =
    rowCandidate ??
    (await findActionableReviewRow(card, actionBtnPattern)) ??
    card;

  const countActionButtons = async (
    loc: import("playwright").Locator,
  ): Promise<number> =>
    loc.locator("button").filter({ hasText: actionBtnPattern }).count();

  // rowCandidate가 안쪽 ReviewItem만 가리키면 버튼이 0개인데도 ?? 체인에서 상위 탐색을 안 타는 경우가 있다.
  if ((await countActionButtons(row).catch(() => 0)) === 0) {
    const lifted = await findActionableReviewRow(card, actionBtnPattern);
    if (lifted && (await countActionButtons(lifted).catch(() => 0)) > 0) {
      row = lifted;
    } else {
      const dataRow = card.locator("xpath=ancestor::div[@data-index][1]");
      if ((await countActionButtons(dataRow).catch(() => 0)) > 0) {
        row = dataRow;
      }
    }
  }

  const dataRowFromCard = card.locator("xpath=ancestor::div[@data-index][1]");
  if ((await countActionButtons(dataRowFromCard).catch(() => 0)) > 0) {
    row = dataRowFromCard;
  }

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
  await dismissBaeminBackdropIfPresent(page);
  await page.waitForTimeout(400);

  const registerBtn = buildBaeminRegisterReplyButtonLocator(row);

  const registerBtnVisible = await registerBtn.isVisible().catch(() => false);
  if (!registerBtnVisible) {
    const hasModifyBtn =
      (await row.locator("button").filter({ hasText: /수정/ }).count()) > 0;
    if (hasModifyBtn) {
      const existing = await tryExtractExistingReplyContentFromRow(row);
      console.log(LOG, "리뷰에 이미 답글이 등록됨(수정 버튼 있음). 등록 생략.", {
        extracted: existing ? existing.slice(0, 40) : null,
      });
      return alreadyRegisteredResult(existing);
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
      return alreadyRegisteredResult(existing);
    }
    const artifacts = await captureBaeminReplyDebugArtifacts({
      page,
      reviewExternalId: params.reviewExternalId,
      stage: "no_register_button",
    });
    throw new Error(
      `리뷰(리뷰번호 ${reviewExternalId})에서 '사장님 댓글 등록하기' 버튼을 찾지 못했습니다. 이미 답글이 등록되었거나 UI가 변경되었을 수 있습니다.` +
        `${artifacts.screenshotPath ? ` screenshot=${artifacts.screenshotPath}` : ""}` +
        `${artifacts.bodySnippet ? ` body="${artifacts.bodySnippet}"` : ""}`,
    );
  }

  const clearOverlaysBeforeRegisterClick = async (): Promise<void> => {
    await page.keyboard.press("Escape").catch(() => null);
    await page.keyboard.press("Escape").catch(() => null);
    await dismissBaeminTodayPopup(page).catch(() => null);
    await dismissBaeminBackdropIfPresent(page);
    await row.scrollIntoViewIfNeeded().catch(() => null);
    await buildBaeminRegisterReplyButtonLocator(row)
      .scrollIntoViewIfNeeded()
      .catch(() => null);
    await page.waitForTimeout(350);
  };

  const clickRegisterWithRetries = async (): Promise<void> => {
    const tryOnce = async (force: boolean, timeoutMs: number): Promise<void> => {
      await clearOverlaysBeforeRegisterClick();
      const btn = buildBaeminRegisterReplyButtonLocator(row);
      await btn.waitFor({ state: "visible", timeout: 8_000 }).catch(() => null);
      await btn.click({
        timeout: timeoutMs,
        ...(force ? { force: true } : {}),
      });
    };

    let lastErr: unknown;
    try {
      await tryOnce(false, 22_000);
      return;
    } catch (eFirst) {
      lastErr = eFirst;
      const msg0 = eFirst instanceof Error ? eFirst.message : String(eFirst);
      console.warn(LOG, "사장님 댓글 등록하기 클릭 1차 실패, 정리 후 재시도", {
        reviewExternalId,
        preview: msg0.slice(0, 240),
      });
    }

    try {
      await tryOnce(false, 22_000);
      return;
    } catch (eSecond) {
      lastErr = eSecond;
      const msg1 = eSecond instanceof Error ? eSecond.message : String(eSecond);
      console.warn(LOG, "사장님 댓글 등록하기 클릭 2차 실패, force 클릭", {
        reviewExternalId,
        preview: msg1.slice(0, 240),
      });
    }

    try {
      await tryOnce(true, 18_000);
      return;
    } catch (eThird) {
      lastErr = eThird;
      const msg2 = eThird instanceof Error ? eThird.message : String(eThird);
      console.warn(LOG, "사장님 댓글 등록하기 Playwright 클릭 전부 실패, DOM 직접 클릭 시도", {
        reviewExternalId,
        preview: msg2.slice(0, 240),
      });
    }

    const ok = await tryBaeminProgrammaticRegisterClick(page, reviewExternalId);
    if (!ok) {
      throw lastErr instanceof Error
        ? lastErr
        : new Error(String(lastErr ?? "register click failed"));
    }
    await page.waitForTimeout(450);
  };

  await clickRegisterWithRetries();

  /**
   * 전역 textarea:visible 폴백은 다른 카드/모달과 붙을 수 있어 쓰지 않음.
   * 등록 버튼 조상에 붙은 입력창 → 같은 리뷰 행의 textarea 순으로만 대기.
   */
  const locateReplyTextareaAfterRegisterOpen = async (): Promise<
    import("playwright").Locator
  > => {
    const fromRegisterPanel = registerBtn
      .locator("xpath=ancestor::*[.//textarea][1]")
      .locator("textarea")
      .first();
    try {
      await fromRegisterPanel.waitFor({ state: "visible", timeout: 8_000 });
      return fromRegisterPanel;
    } catch {
      // 등록 버튼과 입력창이 DOM 상 멀리 떨어진 빌드
    }
    const inRow = row.locator("textarea").first();
    await inRow.waitFor({ state: "visible", timeout: 8_000 });
    return inRow;
  };

  const waitTextareaWithRecovery = async (): Promise<import("playwright").Locator> => {
    try {
      return await locateReplyTextareaAfterRegisterOpen();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const likelyBlocked = /Timeout|waiting for locator/i.test(msg);
      if (!likelyBlocked) throw e;

      await dismissBaeminTodayPopup(page).catch(() => null);
      await dismissBaeminBackdropIfPresent(page);
      await page.waitForTimeout(250);
      await clickRegisterWithRetries();
      return await locateReplyTextareaAfterRegisterOpen();
    }
  };

  const textarea = await waitTextareaWithRecovery();
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
  // 첫 답글 등록 성공 시 보통 같은 행에 "수정/삭제"가 생김. 「추가하기」는 추가 댓글용이라 성공 판정에 쓰지 않음.
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
    const extracted = await tryExtractExistingReplyContentFromRow(rowAfter);
    const hasExtractedReply = !!extracted;

    // 버튼이 뜨는 케이스 + 실제 답글 본문이 읽히는 케이스 둘 다 성공으로 인정.
    // UI 변경으로 버튼만 뜨거나(또는 사라지거나) 저장이 실패하는 거짓 성공을 막는다.
    if (hasModify || hasDelete || hasExtractedReply) {
      verified = true;
      break;
    }
  }

    if (!verified) {
    const stillRegisterVisible = await buildBaeminRegisterReplyButtonLocator(
      rowAfter,
    )
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
      throw new Error(
        `배민 답글 등록 확인 실패: reviewExternalId=${reviewExternalId}, registerVisible=${stillRegisterVisible}, modify=${hasModifyNow}, delete=${hasDeleteNow}, knownFailure=${hasKnownFailure}`,
      );
    }

    // “버튼도 없고 실패 문구도 안 잡히는” 애매한 케이스는 1회 리로드 후 재검증.
    await page.reload({ waitUntil: "domcontentloaded", timeout: 20_000 }).catch(
      () => null,
    );
    const refoundRow = await resolveBaeminRegisterReplyRowLocator(
      page,
      shopNo,
      reviewExternalId,
      fromStr,
      toStr,
    );
    const rowForVerify = refoundRow ?? rowAfter;
    if (!refoundRow) {
      console.warn(LOG, "리로드 후 행 재탐색 실패, 기존 row Locator로 추출 재시도", {
        reviewExternalId,
      });
    }
    await dismissBaeminTodayPopup(page).catch(() => null);
    await dismissBaeminBackdropIfPresent(page).catch(() => null);
    await page.waitForTimeout(400);
    await tryExpandBaeminMaskedReviewRow(page, rowForVerify).catch(() => null);
    await rowForVerify.scrollIntoViewIfNeeded().catch(() => null);
    const extractedAfterReload =
      await tryExtractExistingReplyContentFromRow(rowForVerify);
    if (!extractedAfterReload) {
      const artifacts = await captureBaeminReplyDebugArtifacts({
        page,
        reviewExternalId: params.reviewExternalId,
        stage: "verify_failed",
      });
      throw new Error(
        `배민 답글 등록 확인 실패(리로드 후에도 답글 추출 불가): reviewExternalId=${reviewExternalId}` +
          `${artifacts.screenshotPath ? ` screenshot=${artifacts.screenshotPath}` : ""}` +
          `${artifacts.bodySnippet ? ` body="${artifacts.bodySnippet}"` : ""}`,
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
  await ensureBaeminSelfReviewShopSelected(page, shopNo);
  await waitForBaeminSelfReviewListAttached(page);

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
  customerNickname?: string | null;
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
  const { reviewExternalId, written_at } = params;
  const content = sanitizeBaeminReplyProhibitedTerms(
    params.content,
    params.customerNickname ?? null,
  );

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

    const { row, card } = await navigateToBaeminReviewsAndFindRow(
      page,
      shopNo,
      reviewExternalId,
      written_at,
      /수정/,
    );

    await dismissBaeminTodayPopup(page).catch(() => null);
    await dismissBaeminBackdropIfPresent(page);
    await page.keyboard.press("Escape").catch(() => null);
    const modifyBtn = row
      .getByRole("button", { name: /수정/ })
      .or(row.locator("button, a, [role='button']").filter({ hasText: /수정/ }))
      .first();
    await modifyBtn.scrollIntoViewIfNeeded().catch(() => null);
    await modifyBtn.click({ timeout: 12_000, force: true });

    const textareaFromRow = row.locator("textarea").first();
    const textareaFromCard = card.locator("textarea").first();
    const textareaFromPage = page.locator("textarea:visible").first();
    let textarea = textareaFromRow;
    try {
      await textareaFromRow.waitFor({ state: "visible", timeout: 5_000 });
    } catch {
      try {
        await textareaFromCard.waitFor({ state: "visible", timeout: 5_000 });
        textarea = textareaFromCard;
      } catch {
        await textareaFromPage.waitFor({ state: "visible", timeout: 14_000 });
        textarea = textareaFromPage;
      }
    }
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
