import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  getPlatformCookies,
  getExternalShopId,
  getPlatformSessionMeta,
  savePlatformSession,
} from "@/lib/services/platform-session-service";

const PLATFORM = "ddangyo" as const;

/** 땡겨요 연동 세션(쿠키)·가게 ID(patsto_no) 저장 */
export async function saveDdangyoSession(
  storeId: string,
  userId: string,
  cookies: CookieItem[],
  options?: { externalShopId?: string | null },
) {
  return savePlatformSession(storeId, PLATFORM, userId, cookies, {
    external_shop_id: options?.externalShopId,
  });
}

/** 저장된 세션 메타만 조회 */
export async function getDdangyoSessionMeta(storeId: string, userId: string) {
  return getPlatformSessionMeta(storeId, PLATFORM, userId);
}

const DEBUG = process.env.DEBUG_DDANGYO === "1";

/** 저장된 땡겨요 가게 번호(patsto_no) 조회 */
export async function getDdangyoPatstoNo(
  storeId: string,
  userId: string,
): Promise<string | null> {
  const v = await getExternalShopId(storeId, PLATFORM, userId);
  if (DEBUG) console.log("[ddangyo-session] getDdangyoPatstoNo", { storeId: storeId.slice(0, 8), result: v ?? "(null)" });
  return v;
}

/** 저장된 쿠키 배열 */
export async function getDdangyoCookies(
  storeId: string,
  userId: string,
): Promise<CookieItem[] | null> {
  return getPlatformCookies(storeId, PLATFORM, userId);
}

/** Cookie 헤더 문자열 (API 호출용) */
export async function getDdangyoCookieHeader(
  storeId: string,
  userId: string,
): Promise<string | null> {
  const cookies = await getDdangyoCookies(storeId, userId);
  if (DEBUG) console.log("[ddangyo-session] getDdangyoCookieHeader", { storeId: storeId.slice(0, 8), cookieCount: cookies?.length ?? 0 });
  if (!cookies?.length) return null;
  return cookies
    .map((c) => `${c.name}=${encodeURIComponent(c.value)}`)
    .join("; ");
}
