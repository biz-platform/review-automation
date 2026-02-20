import { execSync } from "child_process";

/** 개발 환경에서 기본 ON. 끄려면 LOG_BROWSER_MEMORY=0, 프로덕션에서 보려면 LOG_BROWSER_MEMORY=1 */
const ENABLED =
  process.env.LOG_BROWSER_MEMORY === "1" ||
  (process.env.NODE_ENV === "development" &&
    process.env.LOG_BROWSER_MEMORY !== "0");

function toMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

/** Node 프로세스 메모리 사용량 로그 (개발 시 LOG_BROWSER_MEMORY=1) */
export function logMemory(label: string): void {
  if (!ENABLED) return;
  const u = process.memoryUsage();
  console.log(
    "[browser-memory]",
    label,
    "| RSS:",
    toMB(u.rss),
    "| Heap:",
    toMB(u.heapUsed),
    "| External:",
    toMB(u.external),
  );
}

/** 브라우저(Chromium) 프로세스 메모리 조회 - PID 기준 (Windows/Linux) */
export function getBrowserProcessMemoryMB(pid: number | undefined): number | null {
  if (pid == null || !ENABLED) return null;
  try {
    const platform = process.platform;
    if (platform === "win32") {
      const out = execSync(
        `wmic process where processid=${pid} get WorkingSetSize /format:value`,
        { encoding: "utf8", maxBuffer: 1024 * 1024 },
      );
      const m = out.match(/WorkingSetSize=(\d+)/);
      if (m) return Number(m[1]) / 1024 / 1024;
    } else if (platform === "linux" || platform === "darwin") {
      const out = execSync(`ps -o rss= -p ${pid}`, {
        encoding: "utf8",
        maxBuffer: 8192,
      });
      const kb = parseInt(out.trim(), 10);
      if (!Number.isNaN(kb)) return kb / 1024; // RSS is in KB -> MB
    }
  } catch {
    // wmic/ps 실패 시 무시
  }
  return null;
}

/** 브라우저 실행 직후 메모리 로그 (Node + 브라우저 프로세스). Playwright Browser.process()?.pid 사용 */
export function logBrowserMemory(browser: unknown, label: string): void {
  if (!ENABLED) return;
  logMemory(label + " (Node)");
  try {
    const b = browser as { process?: () => { pid?: number } };
    const pid = b.process?.()?.pid;
    if (pid != null) {
      const mb = getBrowserProcessMemoryMB(pid);
      if (mb != null) {
        console.log("[browser-memory]", label, "| Browser PID:", pid, "| ~", mb.toFixed(2), "MB");
      } else {
        console.log("[browser-memory]", label, "| Browser PID:", pid);
      }
    }
  } catch {
    // ignore
  }
}

/** browser.close() 전후 메모리 로그 후 close 수행 (finally 블록에서 사용) */
export async function closeBrowserWithMemoryLog(
  browser: { close(): Promise<void> },
  label: string,
): Promise<void> {
  if (ENABLED) logMemory(label + " before close");
  await browser.close();
  if (ENABLED) logMemory(label + " after close");
}
