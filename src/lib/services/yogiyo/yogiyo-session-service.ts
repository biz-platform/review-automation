import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  getPlatformCookies,
  getExternalShopId,
  getPlatformSessionMeta,
  savePlatformSession,
} from "@/lib/services/platform-session-service";

const PLATFORM = "yogiyo" as const;
const BEARER_COOKIE_NAME = "yogiyo_bearer_token";

/** 요기요 연동 세션(쿠키·Bearer 토큰)·가게 ID(vendor id) 저장 */
export async function saveYogiyoSession(
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
export async function getYogiyoSessionMeta(storeId: string, userId: string) {
  return getPlatformSessionMeta(storeId, PLATFORM, userId);
}

/** 저장된 요기요 가게 번호(vendor id) 조회 */
export async function getYogiyoVendorId(
  storeId: string,
  userId: string
): Promise<string | null> {
  return getExternalShopId(storeId, PLATFORM, userId);
}

/** 저장된 쿠키 배열 */
export async function getYogiyoCookies(
  storeId: string,
  userId: string
): Promise<CookieItem[] | null> {
  return getPlatformCookies(storeId, PLATFORM, userId);
}

/** 저장된 Bearer 토큰 (ceo-api 호출용) */
export async function getYogiyoBearerToken(
  storeId: string,
  userId: string
): Promise<string | null> {
  const cookies = await getYogiyoCookies(storeId, userId);
  if (!cookies?.length) return null;
  const item = cookies.find((c) => c.name === BEARER_COOKIE_NAME);
  return item?.value ?? null;
}
