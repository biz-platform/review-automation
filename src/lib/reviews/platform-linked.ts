/** 댓글 관리·대시보드 등에서 공유: 연동 가능한 플랫폼 (store_platform_sessions 기준) */
export const PLATFORMS_LINKED = [
  "baemin",
  "coupang_eats",
  "ddangyo",
  "yogiyo",
] as const;

export type PlatformLinked = (typeof PLATFORMS_LINKED)[number];
