/**
 * 이미 떠 있는 Chrome(배민 self)에 CDP로 붙어 리뷰 목록 DOM 요약을 덤프한다.
 *
 * 1) 크롬을 원격 디버깅으로 실행 (PowerShell — & 필수, %TEMP% 대신 $env:TEMP):
 *    & "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222 --user-data-dir="$env:TEMP\chrome-baemin-debug"
 *    (cmd.exe) "...\chrome.exe" --remote-debugging-port=9222 --user-data-dir="%TEMP%\chrome-baemin-debug"
 * 2) 반드시 self.baemin.com/shops/.../reviews (또는 self.baemin) 탭을 연 뒤 실행한다. chrome://intro 만 있으면 실패한다.
 * 3) 프로젝트 루트에서:
 *    pnpm exec tsx scripts/debug-baemin-self-dom-cdp.ts
 *
 * 포트/URL 바꾸기: PLAYWRIGHT_CDP_URL=http://127.0.0.1:9333
 */
try {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  /* optional */
}

const CDP = process.env.PLAYWRIGHT_CDP_URL ?? "http://127.0.0.1:9222";

type BtnSnap = {
  tag: string;
  role: string | null;
  type: string | null;
  class: string;
  inner: string;
  aria: string | null;
};

type CardSnap = {
  tag: string;
  class: string;
  dataIndex: string | null;
  textHead: string;
  buttons: BtnSnap[];
  registerLike: BtnSnap[];
};

function isChromeInternalUrl(u: string): boolean {
  return (
    u.startsWith("chrome://") ||
    u.startsWith("chrome-untrusted://") ||
    u.startsWith("about:") ||
    u.startsWith("edge://")
  );
}

function pickBaeminPage(
  contexts: import("playwright").BrowserContext[],
): import("playwright").Page | null {
  const pages: import("playwright").Page[] = [];
  for (const ctx of contexts) pages.push(...ctx.pages());

  const reviews = pages.filter(
    (p) =>
      !isChromeInternalUrl(p.url()) &&
      p.url().includes("self.baemin.com") &&
      p.url().includes("/reviews"),
  );
  if (reviews.length) return reviews[0] ?? null;

  const self = pages.filter(
    (p) =>
      !isChromeInternalUrl(p.url()) && p.url().includes("self.baemin.com"),
  );
  if (self.length) return self[0] ?? null;

  return null;
}

function logOpenTabs(contexts: import("playwright").BrowserContext[]): void {
  console.error("[debug-baemin-self-dom] 현재 열린 탭:");
  for (const ctx of contexts) {
    for (const p of ctx.pages()) {
      console.error("  -", p.url());
    }
  }
}

/**
 * page.evaluate 안에 TS 문법을 넣으면 tsx가 __name 등을 주입해 브라우저에서 ReferenceError 난다.
 * 브라우저에서 돌릴 본문만 raw 문자열로 전달한다.
 */
const COLLECT_BAEMIN_SELF_DOM_SNAPSHOT = new Function(`
  var norm = function (s) { return String(s).replace(/\\s+/g, " ").trim(); };
  var btnSnap = function (el) {
    return {
      tag: el.tagName,
      role: el.getAttribute("role"),
      type: el.getAttribute("type"),
      class: (el.getAttribute("class") || "").slice(0, 200).trim(),
      inner: norm(el.textContent || "").slice(0, 100),
      aria: el.getAttribute("aria-label"),
    };
  };
  var registerRe = /사장님\\s*댓글\\s*등록하기/;
  var cards = Array.prototype.slice.call(
    document.querySelectorAll("[class*='ReviewItem']"),
    0,
    3,
  );
  var cardSnaps = cards.map(function (root) {
    var controls = Array.prototype.slice.call(
      root.querySelectorAll("button, [role='button'], a"),
    );
    var buttons = controls.map(btnSnap);
    var registerLike = buttons.filter(function (b) {
      return registerRe.test(b.inner);
    });
    return {
      tag: root.tagName,
      class: (root.getAttribute("class") || "").slice(0, 240).trim(),
      dataIndex: root.getAttribute("data-index"),
      textHead: norm(root.textContent || "").slice(0, 160),
      buttons: buttons,
      registerLike: registerLike,
    };
  });
  var dataIndexRows = Array.prototype.slice.call(
    document.querySelectorAll("div[data-index]"),
    0,
    4,
  );
  var rowSnaps = dataIndexRows.map(function (div) {
    var btns = Array.prototype.slice.call(
      div.querySelectorAll("button, [role='button'], a"),
    ).map(btnSnap);
    return {
      dataIndex: div.getAttribute("data-index"),
      class: (div.getAttribute("class") || "").slice(0, 200).trim(),
      childElementCount: div.childElementCount,
      textHead: norm(div.textContent || "").slice(0, 140),
      buttonCount: btns.length,
      buttonsSample: btns.slice(0, 8),
    };
  });
  return { cardSnaps: cardSnaps, rowSnaps: rowSnaps };
`) as () => {
  cardSnaps: CardSnap[];
  rowSnaps: Array<{
    dataIndex: string | null;
    class: string;
    childElementCount: number;
    textHead: string;
    buttonCount: number;
    buttonsSample: BtnSnap[];
  }>;
};

async function main() {
  const playwright = await import("playwright");
  let browser: import("playwright").Browser;
  try {
    browser = await playwright.chromium.connectOverCDP(CDP);
  } catch (e) {
    console.error(
      `[debug-baemin-self-dom] CDP 연결 실패: ${CDP}\n` +
        "Chrome을 다음처럼 띄웠는지 확인:\n" +
        '  chrome.exe --remote-debugging-port=9222 --user-data-dir="..."\n' +
        `원인: ${e instanceof Error ? e.message : String(e)}`,
    );
    process.exitCode = 1;
    return;
  }

  try {
    const contexts = browser.contexts();
    const page = pickBaeminPage(contexts);
    if (!page) {
      console.error(
        "[debug-baemin-self-dom] self.baemin.com 탭을 찾지 못했습니다. 리뷰 URL을 연 뒤 다시 실행하세요.",
      );
      logOpenTabs(contexts);
      process.exitCode = 1;
      return;
    }

    console.log("[debug-baemin-self-dom] page:", page.url());

    const snapshot = await page.evaluate(COLLECT_BAEMIN_SELF_DOM_SNAPSHOT);

    console.log("\n--- ReviewItem 상위 3개 (버튼 텍스트·role) ---\n");
    console.log(JSON.stringify(snapshot.cardSnaps, null, 2));

    console.log("\n--- div[data-index] 상위 4개 (가상 리스트 행 추정) ---\n");
    console.log(JSON.stringify(snapshot.rowSnaps, null, 2));
  } finally {
    await browser.close();
  }
}

void main();
