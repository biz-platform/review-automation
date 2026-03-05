/**
 * 배민 셀프 페이지에서 backdrop/다이얼로그가 버튼 클릭을 가로막을 때 닫기.
 * data-testid="backdrop" 또는 [role="dialog"] → Escape 또는 백드롭 클릭.
 */
export async function dismissBaeminBackdropIfPresent(
  page: import("playwright").Page,
): Promise<void> {
  try {
    const backdrop = page.locator('[data-testid="backdrop"]').first();
    if ((await backdrop.count()) === 0) return;
    if (!(await backdrop.isVisible().catch(() => false))) return;
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    if (await backdrop.isVisible().catch(() => false)) {
      await backdrop.click({ position: { x: 5, y: 5 }, force: true }).catch(() => null);
      await page.waitForTimeout(300);
    }
  } catch {
    // ignore
  }
}

/**
 * 배민 self/biz 페이지에서 [role="dialog"] 팝업이 있으면 "오늘 하루 보지 않기" 클릭.
 * 모든 배민 페이지 로드 후 호출해 두면 팝업을 닫아 둘 수 있음.
 */
export async function dismissBaeminTodayPopup(
  page: import("playwright").Page,
): Promise<boolean> {
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
