/**
 * 워커 실제 작업 시 메모리 측정용 디버깅 유틸.
 * 사용: MEASURE_MEMORY=1 pnpm worker
 *
 * - sample() 호출 시점마다 process.memoryUsage() 기록
 * - logSummary() 로 지금까지 min/max/avg RSS·Heap 출력
 * - reset() 으로 통계 초기화
 */

const ENABLED = process.env.MEASURE_MEMORY === "1";

type Snapshot = {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external: number;
  timestamp: number;
};

const samples: Snapshot[] = [];
const MAX_SAMPLES = 10_000;

function toMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

/** 현재 프로세스 메모리 스냅샷 기록 (MEASURE_MEMORY=1 일 때만) */
export function sample(label?: string): void {
  if (!ENABLED) return;
  const u = process.memoryUsage();
  const s: Snapshot = {
    rss: u.rss,
    heapUsed: u.heapUsed,
    heapTotal: u.heapTotal,
    external: u.external,
    timestamp: Date.now(),
  };
  samples.push(s);
  if (samples.length > MAX_SAMPLES) samples.shift();
  if (label) {
    console.log(
      "[worker-memory]",
      label,
      "| RSS:",
      toMB(u.rss),
      "| Heap:",
      toMB(u.heapUsed),
      "| External:",
      toMB(u.external),
    );
  }
}

export type MemorySummary = {
  count: number;
  rssMinMB: number;
  rssMaxMB: number;
  rssAvgMB: number;
  heapUsedMinMB: number;
  heapUsedMaxMB: number;
  heapUsedAvgMB: number;
  lastRssMB: number;
  lastHeapMB: number;
};

/** 지금까지 수집한 샘플 기준 min/max/avg 반환 */
export function getSummary(): MemorySummary | null {
  if (!ENABLED || samples.length === 0) return null;
  const rssList = samples.map((s) => s.rss);
  const heapList = samples.map((s) => s.heapUsed);
  const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);
  return {
    count: samples.length,
    rssMinMB: Math.min(...rssList) / 1024 / 1024,
    rssMaxMB: Math.max(...rssList) / 1024 / 1024,
    rssAvgMB: sum(rssList) / rssList.length / 1024 / 1024,
    heapUsedMinMB: Math.min(...heapList) / 1024 / 1024,
    heapUsedMaxMB: Math.max(...heapList) / 1024 / 1024,
    heapUsedAvgMB: sum(heapList) / heapList.length / 1024 / 1024,
    lastRssMB: rssList[rssList.length - 1]! / 1024 / 1024,
    lastHeapMB: heapList[heapList.length - 1]! / 1024 / 1024,
  };
}

/** 요약 로그 한 줄 출력 */
export function logSummary(prefix = "[worker-memory] summary"): void {
  const s = getSummary();
  if (!s) return;
  console.log(
    prefix,
    "| samples:",
    s.count,
    "| RSS: min",
    s.rssMinMB.toFixed(1),
    "max",
    s.rssMaxMB.toFixed(1),
    "avg",
    s.rssAvgMB.toFixed(1),
    "last",
    s.lastRssMB.toFixed(1),
    "MB",
    "| Heap: max",
    s.heapUsedMaxMB.toFixed(1),
    "MB",
  );
}

/** 수집된 샘플 초기화 */
export function reset(): void {
  samples.length = 0;
}

export function isEnabled(): boolean {
  return ENABLED;
}
