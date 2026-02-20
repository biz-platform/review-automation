import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  savePlatformSession,
  getPlatformSessionMeta,
  getExternalShopId,
  getPlatformCookies,
} from "@/lib/services/platform-session-service";

const PLATFORM = "coupang_eats" as const;

/** 쿠팡이츠 연동 세션(쿠키)·가게 ID 저장 */
export async function saveCoupangEatsSession(
  storeId: string,
  userId: string,
  cookies: CookieItem[],
  options?: { externalShopId?: string | null }
) {
  return savePlatformSession(storeId, PLATFORM, userId, cookies, {
    external_shop_id: options?.externalShopId,
  });
}

/** 저장된 세션 메타만 조회 */
export async function getCoupangEatsSessionMeta(storeId: string, userId: string) {
  return getPlatformSessionMeta(storeId, PLATFORM, userId);
}

/** 저장된 쿠팡이츠 가게 ID (storeId) 조회 */
export async function getCoupangEatsStoreId(
  storeId: string,
  userId: string
): Promise<string | null> {
  return getExternalShopId(storeId, PLATFORM, userId);
}

/** 저장된 쿠키 배열 */
export async function getCoupangEatsCookies(
  storeId: string,
  userId: string
): Promise<CookieItem[] | null> {
  return getPlatformCookies(storeId, PLATFORM, userId);
}

/** Cookie 헤더 문자열 (API 호출용) */
export async function getCoupangEatsCookieHeader(
  storeId: string,
  userId: string
): Promise<string | null> {
  const cookies = await getCoupangEatsCookies(storeId, userId);
  if (!cookies?.length) return null;
  return cookies.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
}
