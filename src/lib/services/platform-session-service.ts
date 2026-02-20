import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { StoreService } from "@/lib/services/store-service";
import {
  encryptCookieJson,
  decryptCookieJson,
} from "@/lib/utils/cookie-encrypt";
import type {
  CookieItem,
  PlatformSessionMeta,
  PlatformSessionSaveOptions,
  PlatformCode,
} from "@/lib/types/dto/platform-dto";

const storeService = new StoreService();

/**
 * 플랫폼별 로그인 세션(쿠키)·가게/사장님 식별자 저장.
 * 배민/요기요/땡겨요/쿠팡이츠 등 공통 — platform 컬럼으로 구분.
 */
export async function savePlatformSession(
  storeId: string,
  platform: PlatformCode,
  userId: string,
  cookies: CookieItem[],
  options?: PlatformSessionSaveOptions,
): Promise<PlatformSessionMeta> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const json = JSON.stringify(cookies);
  const encrypted = encryptCookieJson(json);
  const row: Record<string, unknown> = {
    store_id: storeId,
    platform,
    cookies_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  };
  if (options?.external_shop_id != null)
    row.external_shop_id = options.external_shop_id;
  if (options?.shop_owner_number != null)
    row.shop_owner_number = options.shop_owner_number;
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .upsert(row, { onConflict: "store_id,platform" })
    .select()
    .single();

  if (error) throw error;
  if (data == null) {
    throw new Error(
      "store_platform_sessions upsert returned no row (RLS or select 권한 확인)"
    );
  }
  return rowToMeta(data);
}

/** 저장된 세션 메타만 조회 (쿠키 값 제외) */
export async function getPlatformSessionMeta(
  storeId: string,
  platform: PlatformCode,
  userId: string,
): Promise<PlatformSessionMeta | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select(
      "store_id, platform, external_shop_id, shop_owner_number, expires_at, updated_at, cookies_encrypted",
    )
    .eq("store_id", storeId)
    .eq("platform", platform)
    .maybeSingle();

  if (error || !data) return null;
  return {
    ...rowToMeta(data),
    has_session: !!data.cookies_encrypted,
  };
}

/** 저장된 플랫폼 가게 고유번호 조회 (리뷰 API 등에서 사용) */
export async function getExternalShopId(
  storeId: string,
  platform: PlatformCode,
  userId: string,
): Promise<string | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select("external_shop_id")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .maybeSingle();

  if (error || !data?.external_shop_id) return null;
  return data.external_shop_id as string;
}

/** 저장된 쿠키 배열 (Playwright/브라우저 컨텍스트 주입용) */
export async function getPlatformCookies(
  storeId: string,
  platform: PlatformCode,
  userId: string,
): Promise<CookieItem[] | null> {
  await storeService.findById(storeId, userId);
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("store_platform_sessions")
    .select("cookies_encrypted")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .maybeSingle();

  if (error || !data?.cookies_encrypted) return null;
  return JSON.parse(decryptCookieJson(data.cookies_encrypted)) as CookieItem[];
}

function rowToMeta(row: Record<string, unknown>): PlatformSessionMeta {
  return {
    store_id: row.store_id as string,
    platform: (row.platform as string) ?? "baemin",
    external_shop_id:
      row.external_shop_id != null ? (row.external_shop_id as string) : null,
    shop_owner_number:
      row.shop_owner_number != null ? (row.shop_owner_number as string) : null,
    expires_at: row.expires_at != null ? (row.expires_at as string) : null,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
    has_session: true,
  };
}
