/**
 * 배민 셀프 페이지에서 backdrop/다이얼로그가 버튼 클릭을 가로막을 때 닫기.
 * `data-testid="backdrop"` 다중·중첩, `[role="dialog"]` 에 대해 Escape + 백드롭 클릭을 반복한다.
 */
import type { Page } from "playwright";

const BACKDROP_SEL = '[data-testid="backdrop"]';
/** 한 번의 dismissBaeminBackdropIfPresent 호출에서 시도할 최대 라운드 */
const MAX_BACKDROP_ROUNDS = 10;
const MAX_DIALOG_SWEEPS = 4;

async function anyVisibleBackdrop(page: Page): Promise<boolean> {
  const backdrops = page.locator(BACKDROP_SEL);
  const n = await backdrops.count();
  for (let i = 0; i < n; i++) {
    if (await backdrops.nth(i).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function anyVisibleDialog(page: Page): Promise<boolean> {
  const dlg = page.locator('[role="dialog"]');
  const n = await dlg.count();
  for (let i = 0; i < n; i++) {
    if (await dlg.nth(i).isVisible().catch(() => false)) return true;
  }
  return false;
}

async function dismissAnyVisibleDialogs(page: Page): Promise<boolean> {
  let dismissed = false;
  const visibleDialogs = page.locator('[role="dialog"]:visible');
  const n = await visibleDialogs.count().catch(() => 0);
  for (let i = 0; i < n; i++) {
    const dialog = visibleDialogs.nth(i);
    if (!(await dialog.isVisible().catch(() => false))) continue;

    const preferButtons = [
      "오늘 하루 보지 않기",
      "7일간 보지 않기",
      "닫기",
      "확인",
    ] as const;

    let clicked = false;
    for (const name of preferButtons) {
      const btn = dialog.getByRole("button", { name }).first();
      if ((await btn.count().catch(() => 0)) > 0) {
        const ok = await btn
          .click({ timeout: 2_500, force: true })
          .then(() => true)
          .catch(() => false);
        if (ok) {
          clicked = true;
          dismissed = true;
          break;
        }
      }
    }

    if (!clicked) {
      // fallback: try escape and click any close-looking button inside dialog
      await page.keyboard.press("Escape").catch(() => null);
      const anyClose = dialog
        .locator("button")
        .filter({ hasText: /닫기|확인|취소|보지\s*않기/ })
        .first();
      if ((await anyClose.count().catch(() => 0)) > 0) {
        const ok = await anyClose
          .click({ timeout: 2_500, force: true })
          .then(() => true)
          .catch(() => false);
        if (ok) dismissed = true;
      }
    }
  }
  return dismissed;
}

/**
 * 모달/배경이 남아 클릭이 막히는 경우를 줄이기 위해 여러 번 시도한다.
 * (단일 backdrop만 처리하던 기존 동작을 보강)
 */
export async function dismissBaeminBackdropIfPresent(page: Page): Promise<void> {
  try {
    for (let round = 0; round < MAX_BACKDROP_ROUNDS; round++) {
      for (let sweep = 0; sweep < MAX_DIALOG_SWEEPS; sweep++) {
        const did = await dismissAnyVisibleDialogs(page).catch(() => false);
        if (!did) break;
        await page.waitForTimeout(150);
      }

      const hasBackdrop = await anyVisibleBackdrop(page);
      const hasDialog = await anyVisibleDialog(page);
      if (!hasBackdrop && !hasDialog) break;

      await page.keyboard.press("Escape").catch(() => null);
      await page.waitForTimeout(180);

      const backdrops = page.locator(BACKDROP_SEL);
      const n = await backdrops.count();
      for (let i = 0; i < n; i++) {
        const bd = backdrops.nth(i);
        if (await bd.isVisible().catch(() => false)) {
          await bd
            .click({ position: { x: 16, y: 16 }, force: true, timeout: 2_500 })
            .catch(() => null);
        }
      }
      await page.waitForTimeout(150);

      if ((await anyVisibleBackdrop(page)) || (await anyVisibleDialog(page))) {
        await page.keyboard.press("Escape").catch(() => null);
        await page.waitForTimeout(120);
      }
    }
  } catch {
    // ignore
  }
}

/**
 * 배민 self/biz 페이지에서 [role="dialog"] 팝업이 있으면 "오늘 하루 보지 않기" 클릭.
 * 모든 배민 페이지 로드 후 호출해 두면 팝업을 닫아 둘 수 있음.
 */
export async function dismissBaeminTodayPopup(page: Page): Promise<boolean> {
  try {
    const any = await dismissAnyVisibleDialogs(page);
    return any;
  } catch {
    return false;
  }
}
