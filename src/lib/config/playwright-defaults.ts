import type { ViewportSize } from "playwright";

/** 브라우저 컨텍스트 공통 뷰포트 (self·셀러웹 자동화 전반) */
export const PLAYWRIGHT_DEFAULT_VIEWPORT: ViewportSize = {
  width: 1280,
  height: 720,
};

/**
 * Windows + Chrome 계열 자동화 공통 UA.
 * (플랫폼별로 예전에 버전만 달랐던 문자열을 하나로 맞춤)
 */
export const PLAYWRIGHT_AUTOMATION_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36" as const;

/** `sec-ch-ua` — UA의 Chrome 메이저와 맞출 것 */
export const PLAYWRIGHT_SEC_CH_UA_CHROME_146 =
  '"Chromium";v="146", "Not-A.Brand";v="24", "Google Chrome";v="146"' as const;

/** 서버·Docker 등에서 Chromium 실행 시 흔히 필요한 플래그 */
export const PLAYWRIGHT_CHROMIUM_LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-setuid-sandbox",
] as const;

/** 로그인·초기 큰 페이지 `goto` */
export const PLAYWRIGHT_GOTO_LOGIN_TIMEOUT_MS = 60_000;

/** 리뷰·주문 등 일반 `goto` */
export const PLAYWRIGHT_GOTO_PAGE_TIMEOUT_MS = 45_000;

/** 메타만 보는 짧은 이동 */
export const PLAYWRIGHT_GOTO_SHORT_TIMEOUT_MS = 35_000;

/** 일부 플랫폼 전용 여유 타임아웃 */
export const PLAYWRIGHT_GOTO_EXTENDED_TIMEOUT_MS = 50_000;

/** 응답 캡처·짧은 대기 */
export const PLAYWRIGHT_CAPTURE_RESPONSE_TIMEOUT_MS = 15_000;

/** 페이지 리스너·스크롤 캡처 등 */
export const PLAYWRIGHT_PAGE_LISTEN_TIMEOUT_MS = 20_000;

/** domcontentloaded 위주 짧은 진입 (쿠팡 주문 페이지 등) */
export const PLAYWRIGHT_GOTO_DOMCONTENTLOADED_TIMEOUT_MS = 30_000;
