"use client";

import { useState, useEffect } from "react";

/**
 * 터치 기기(hover 불가) 여부.
 * @see https://developer.mozilla.org/en-US/docs/Web/CSS/@media/hover
 * 모바일에서는 툴팁 대신 버튼 라벨에 안내를 넣을 때 사용.
 */
export function useHasHover(): boolean {
  const [hasHover, setHasHover] = useState(true);

  useEffect(() => {
    const mq = window.matchMedia("(hover: hover)");
    setHasHover(mq.matches);
    const handler = () => setHasHover(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return hasHover;
}
