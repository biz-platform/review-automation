import type { CookieItem } from "@/lib/types/dto/platform-dto";
import {
  getPlatformCookies,
  getExternalShopId,
  getPlatformSessionMeta,
  savePlatformSession,
  getStoredCredentials,
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

/** 저장된 땡겨요 로그인 ID (requestUpdateReview/requestDeleteReview 의 fin_chg_id). credentials_encrypted의 username 사용 */
export async function getDdangyoFinChgId(
  storeId: string,
  userId: string,
): Promise<string | null> {
  const creds = await getStoredCredentials(storeId, "ddangyo");
  const id = creds?.username?.trim();
  return id || null;
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

/** 쿠키/세션 만료 시 저장된 ID·PW로 재로그인 후 세션 갱신. credentials 없으면 throw */
export async function refreshDdangyoSession(
  storeId: string,
  userId: string,
): Promise<void> {
  const creds = await getStoredCredentials(storeId, "ddangyo");
  if (!creds) {
    throw new Error(
      "땡겨요 세션이 만료되었습니다. 매장 연동(땡겨요 연동)을 한 번 더 진행해 주시면, 이후부터는 만료 시 자동 재로그인됩니다.",
    );
  }
  const { loginDdangyoAndGetCookies } = await import("./ddangyo-login-service");
  const { cookies, external_shop_id } = await loginDdangyoAndGetCookies(
    creds.username,
    creds.password,
  );
  await saveDdangyoSession(storeId, userId, cookies, {
    externalShopId: external_shop_id ?? undefined,
  });
}
