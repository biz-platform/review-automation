import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { StoreService } from "@/lib/services/store-service";
import { encryptCookieJson, decryptCookieJson } from "@/lib/utils/cookie-encrypt";
import type { CookieItem } from "@/lib/types/dto/baemin-session-dto";

const BAEDAL_SELF_URL = "https://self.baemin.com";
const SELF_API_BASE = "https://self-api.baemin.com";
const SELF_API_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "service-channel": "SELF_SERVICE_PC",
  "x-pathname-trace-key": "/shops/reviews",
  "x-web-version": "v20260211140433",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
  Origin: BAEDAL_SELF_URL,
  Referer: `${BAEDAL_SELF_URL}/`,
  "sec-ch-ua": '"Not(A:Brand";v="8", "Chromium";v="144", "Google Chrome";v="144"',
  "sec-ch-ua-mobile": "?0",
  "sec-ch-ua-platform": '"Windows"',
} as const;

const storeService = new StoreService();

export type BaeminSessionMeta = {
  store_id: string;
  platform: string;
  external_shop_id: string | null;
  shop_owner_number: string | null;
  expires_at: string | null;
  updated_at: string;
  has_session: boolean;
};

/** 배민 셀프서비스 로그인 세션(쿠키)·가게 고유번호·사장님 번호 저장 */
export async function saveBaeminSession(
  storeId: string,
  userId: string,
  cookies: CookieItem[],
  options?: { externalShopId?: string | null; shopOwnerNumber?: string | null }
): Promise<BaeminSessionMeta> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const json = JSON.stringify(cookies);
  const encrypted = encryptCookieJson(json);
  const row: Record<string, unknown> = {
    store_id: storeId,
    platform: "baedal",
    cookies_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  };
  if (options?.externalShopId != null) row.external_shop_id = options.externalShopId;
  if (options?.shopOwnerNumber != null) row.shop_owner_number = options.shopOwnerNumber;
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .upsert(row, { onConflict: "store_id,platform" })
    .select()
    .single();

  if (error) throw error;
  return toMeta(data);
}

/** 저장된 세션 메타만 조회 (쿠키 값 제외) */
export async function getBaeminSessionMeta(
  storeId: string,
  userId: string
): Promise<BaeminSessionMeta | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform, external_shop_id, shop_owner_number, expires_at, updated_at, cookies_encrypted")
    .eq("store_id", storeId)
    .eq("platform", "baedal")
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...toMeta(data),
    has_session: !!data.cookies_encrypted,
  };
}

/** 저장된 배민 가게 고유번호 조회 (리뷰 API 호출 시 사용) */
export async function getBaeminShopId(
  storeId: string,
  userId: string
): Promise<string | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select("external_shop_id")
    .eq("store_id", storeId)
    .eq("platform", "baedal")
    .maybeSingle();

  if (error || !data?.external_shop_id) return null;
  return data.external_shop_id as string;
}

/** 저장된 배민 사장님 번호(shopOwnerNumber) 조회 */
export async function getBaeminShopOwnerNumber(
  storeId: string,
  userId: string
): Promise<string | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select("shop_owner_number")
    .eq("store_id", storeId)
    .eq("platform", "baedal")
    .maybeSingle();

  if (error || !data?.shop_owner_number) return null;
  return data.shop_owner_number as string;
}

/** 저장된 쿠키 배열 (Playwright 등 브라우저 컨텍스트 주입용) */
export async function getBaeminCookies(
  storeId: string,
  userId: string
): Promise<CookieItem[] | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select("cookies_encrypted")
    .eq("store_id", storeId)
    .eq("platform", "baedal")
    .maybeSingle();

  if (error || !data?.cookies_encrypted) return null;
  return JSON.parse(decryptCookieJson(data.cookies_encrypted)) as CookieItem[];
}

/** 저장된 쿠키로 self.baemin.com 요청 시 사용할 Cookie 헤더 값 */
export async function getBaeminCookieHeader(
  storeId: string,
  userId: string
): Promise<string | null> {
  const cookies = await getBaeminCookies(storeId, userId);
  if (!cookies?.length) return null;
  return cookies.map((c) => `${c.name}=${encodeURIComponent(c.value)}`).join("; ");
}

/** 세션 유효 여부 확인: self.baemin.com 요청 후 로그인 페이지로 리다이렉트되지 않으면 유효 */
export async function isBaeminSessionValid(
  storeId: string,
  userId: string
): Promise<boolean> {
  const cookieHeader = await getBaeminCookieHeader(storeId, userId);
  if (!cookieHeader) return false;

  const res = await fetch(BAEDAL_SELF_URL, {
    method: "GET",
    redirect: "manual",
    headers: {
      Cookie: cookieHeader,
      Referer: `${BAEDAL_SELF_URL}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
    },
  });

  if (res.status === 302) {
    const location = res.headers.get("location") ?? "";
    return !location.includes("login") && !location.includes("signin");
  }
  return res.ok;
}

/** 저장된 쿠키로 self.baemin.com에 GET 요청 (리뷰 등 데이터 수집 시 사용) */
export async function fetchWithBaeminSession(
  storeId: string,
  userId: string,
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const cookieHeader = await getBaeminCookieHeader(storeId, userId);
  if (!cookieHeader) {
    throw new Error("배민 세션이 없습니다. 먼저 쿠키를 등록해 주세요.");
  }

  const url = path.startsWith("http") ? path : `${BAEDAL_SELF_URL}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...options,
    headers: {
      Cookie: cookieHeader,
      Referer: `${BAEDAL_SELF_URL}/`,
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
      ...options.headers,
    },
  });
}

/** 저장된 세션으로 self-api.baemin.com 리뷰 API 호출 (shops/{shopNo}/reviews, reviews/count) */
export async function fetchBaeminReviewApi(
  storeId: string,
  userId: string,
  path: "reviews/count" | "reviews",
  query: Record<string, string> = {}
): Promise<Response> {
  const shopNo = await getBaeminShopId(storeId, userId);
  if (!shopNo) {
    throw new Error("배민 가게 연동 정보가 없습니다. 먼저 매장 계정을 연동해 주세요.");
  }
  const cookieHeader = await getBaeminCookieHeader(storeId, userId);
  if (!cookieHeader) {
    throw new Error("배민 세션이 없습니다. 먼저 쿠키를 등록해 주세요.");
  }
  const qs = new URLSearchParams(query).toString();
  const url = `${SELF_API_BASE}/v1/review/shops/${shopNo}/${path}${qs ? `?${qs}` : ""}`;
  return fetch(url, {
    method: "GET",
    headers: {
      Cookie: cookieHeader,
      ...SELF_API_HEADERS,
    },
  });
}

function toMeta(row: Record<string, unknown>): BaeminSessionMeta {
  return {
    store_id: row.store_id as string,
    platform: (row.platform as string) ?? "baedal",
    external_shop_id: row.external_shop_id != null ? (row.external_shop_id as string) : null,
    shop_owner_number: row.shop_owner_number != null ? (row.shop_owner_number as string) : null,
    expires_at: row.expires_at != null ? (row.expires_at as string) : null,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    has_session: true,
  };
}
