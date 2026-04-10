/**
 * 배민 셀프 페이지에서 backdrop/다이얼로그가 버튼 클릭을 가로막을 때 닫기.
 * `data-testid="backdrop"` 다중·중첩, `[role="dialog"]` 에 대해 Escape + 백드롭 클릭을 반복한다.
 */
import type { Page } from "playwright";

const BACKDROP_SEL = '[data-testid="backdrop"]';
/** 한 번의 dismissBaeminBackdropIfPresent 호출에서 시도할 최대 라운드 */
const MAX_BACKDROP_ROUNDS = 10;

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

/**
 * 모달/배경이 남아 클릭이 막히는 경우를 줄이기 위해 여러 번 시도한다.
 * (단일 backdrop만 처리하던 기존 동작을 보강)
 */
export async function dismissBaeminBackdropIfPresent(page: Page): Promise<void> {
  try {
    for (let round = 0; round < MAX_BACKDROP_ROUNDS; round++) {
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
    const dialog = page.locator('[role="dialog"]').first();
    await dialog.waitFor({ state: "visible", timeout: 2_000 }).catch(() => null);
    if ((await dialog.count()) === 0) return false;

    const btn = dialog.getByRole("button", { name: "오늘 하루 보지 않기" });
    if ((await btn.count()) === 0) {
      const textBtn = dialog.locator('button:has-text("오늘 하루 보지 않기")').first();
      if ((await textBtn.count()) > 0) {
        await textBtn.click({ timeout: 3_000 });
        return true;
      }
      return false;
    }
    await btn.click({ timeout: 3_000 });
    return true;
  } catch {
    return false;
  }
}
