/** 네이버 연동은 추후 제공 예정이라 UI에서 제외 */

export const PLATFORM_LABEL: Record<string, string> = {
  baemin: "배달의민족",
  coupang_eats: "쿠팡이츠",
  yogiyo: "요기요",
  ddangyo: "땡겨요",
};

/** 리뷰 관리 페이지 탭용: 배달의민족 - 쿠팡이츠 - 땡겨요 - 요기요 */
export const PLATFORM_TABS = [
  { value: "", label: "전체 플랫폼" },
  { value: "baemin", label: "배달의민족" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "ddangyo", label: "땡겨요" },
  { value: "yogiyo", label: "요기요" },
] as const;

/** 매장 관리 페이지용: 배달의민족 - 쿠팡이츠 - 땡겨요 - 요기요 (네이버 플레이스 제외) */
export const STORE_MANAGE_PLATFORM_TABS = [
  { value: "baemin", label: "배달의민족" },
  { value: "coupang_eats", label: "쿠팡이츠" },
  { value: "ddangyo", label: "땡겨요" },
  { value: "yogiyo", label: "요기요" },
] as const;

/** 매장 관리 모바일 탭용 짧은 라벨 (Figma P-01) */
export const STORE_MANAGE_PLATFORM_TABS_MOBILE = [
  { value: "baemin", label: "배민" },
  { value: "coupang_eats", label: "쿠팡" },
  { value: "ddangyo", label: "땡겨요" },
  { value: "yogiyo", label: "요기요" },
] as const;

/** 계정 연동 페이지용 */
export const PLATFORMS = [
  { id: "baemin", label: "배달의민족", ready: true },
  { id: "coupang_eats", label: "쿠팡이츠", ready: true },
  { id: "yogiyo", label: "요기요", ready: true },
  { id: "ddangyo", label: "땡겨요", ready: true },
] as const;

/** 수정/삭제 UI 노출 대상 플랫폼 */
export const PLATFORMS_WITH_REPLY_MODIFY_DELETE = [
  "baemin",
  "coupang_eats",
  "yogiyo",
  "ddangyo",
] as const;

export type PlatformIdWithReply =
  (typeof PLATFORMS_WITH_REPLY_MODIFY_DELETE)[number];
