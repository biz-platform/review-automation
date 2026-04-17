"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 767px)";

function subscribe(onStoreChange: () => void): () => void {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", onStoreChange);
  return () => mq.removeEventListener("change", onStoreChange);
}

function getSnapshot(): boolean {
  return window.matchMedia(QUERY).matches;
}

function getServerSnapshot(): boolean {
  return false;
}

/** `md` 미만(모바일·좁은 태블릿)에서 차트 축 연도 생략 등에 사용 */
export function useMobileChartAxisOmitYear(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
