import { z } from "zod";

/** 플랫폼 코드 (store_platform_sessions.platform, reviews.platform와 동일) */
export const PLATFORM_CODES = [
  "baemin",
  "yogiyo",
  "ddangyo",
  "coupang_eats",
  "naver",
] as const;
export type PlatformCode = (typeof PLATFORM_CODES)[number];

/** 쿠키 한 건 (브라우저/Playwright에서 추출한 형식, 모든 플랫폼 공통) */
export const cookieItemSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional().default("/"),
});
export type CookieItem = z.infer<typeof cookieItemSchema>;

/** 로그인 성공 시 반환 형식 (배민/요기요/땡겨요/쿠팡이츠 등 공통) */
export type PlatformLoginResult = {
  cookies: CookieItem[];
  external_shop_id?: string | null;
  shop_owner_number?: string | null;
};

/** 세션 메타 (DB store_platform_sessions 조회 시, 쿠키 제외) */
export type PlatformSessionMeta = {
  store_id: string;
  platform: string;
  external_shop_id: string | null;
  shop_owner_number: string | null;
  expires_at: string | null;
  updated_at: string;
  has_session: boolean;
};

/** 플랫폼 세션 저장 시 옵션 */
export type PlatformSessionSaveOptions = {
  external_shop_id?: string | null;
  shop_owner_number?: string | null;
};

/** DB reviews 테이블에 넣을 한 행 (플랫폼별 수집 결과를 공통 형태로 변환한 값) */
export type NormalizedReviewRow = {
  external_id: string;
  rating: number | null;
  content: string | null;
  author_name: string | null;
  written_at: string | null;
};

/** 플랫폼 로그인 함수 시그니처 (아이디/비밀번호 → 쿠키·가게/사장 식별자) */
export type PlatformLoginFn = (
  username: string,
  password: string,
) => Promise<PlatformLoginResult>;

/** 플랫폼별 리뷰 수집 결과 (브라우저/API 등 방식 무관) */
export type PlatformReviewFetchResult = {
  list: unknown[];
  count?: number;
};

/** 플랫폼 리뷰 수집 함수 시그니처 (storeId, userId, query → 리뷰 목록) */
export type PlatformReviewFetcherFn = (
  storeId: string,
  userId: string,
  query?: Record<string, string>,
) => Promise<PlatformReviewFetchResult>;
