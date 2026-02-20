import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { encryptCookieJson } from "@/lib/utils/cookie-encrypt";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import type { BrowserJobRow, BrowserJobType } from "./browser-job-service";

let _supabase: ReturnType<typeof createServiceRoleClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createServiceRoleClient();
  return _supabase;
}

/** link 결과: store_platform_sessions upsert (service role) */
async function applyLinkResult(
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
  storeId: string,
  result: {
    cookies: CookieItem[];
    external_shop_id?: string | null;
    shop_owner_number?: string | null;
  }
): Promise<void> {
  const encrypted = encryptCookieJson(JSON.stringify(result.cookies));
  const row: Record<string, unknown> = {
    store_id: storeId,
    platform,
    cookies_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  };
  if (result.external_shop_id != null) row.external_shop_id = result.external_shop_id;
  if (result.shop_owner_number != null) row.shop_owner_number = result.shop_owner_number;

  const { error } = await getSupabase()
    .from("store_platform_sessions")
    .upsert(row, { onConflict: "store_id,platform" });
  if (error) throw error;
}

/** 리뷰 이미지 배열 정규화: 배민 images[] → [{ imageUrl }], 그 외 빈 배열 */
function normalizeReviewImages(v: unknown): { imageUrl: string }[] {
  if (!Array.isArray(v) || v.length === 0) return [];
  const out: { imageUrl: string }[] = [];
  for (const el of v) {
    if (el && typeof el === "object" && "imageUrl" in el && typeof (el as { imageUrl: unknown }).imageUrl === "string") {
      out.push({ imageUrl: (el as { imageUrl: string }).imageUrl });
    }
  }
  return out;
}

/** sync 결과: reviews upsert (service role). 플랫폼별 행 변환 */
async function applySyncResult(
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
  storeId: string,
  list: unknown[]
): Promise<number> {
  if (list.length === 0) return 0;

  const rows = list.map((item: unknown) => {
    const it = item as Record<string, unknown>;
    const external_id =
      String(it.id ?? it.orderReviewId ?? it.rview_atcl_no ?? "").trim() || null;
    const rating =
      it.rating != null ? Math.round(Number(it.rating)) : null;
    const content = (it.contents ?? it.comment ?? it.rview_cont ?? null) as string | null;
    const author_name = (it.memberNickname ?? it.customerName ?? it.nickname ?? it.psnl_msk_nm ?? null) as string | null;
    const written_at = (it.createdAt ?? it.created_at ?? it.reg_dttm ?? null) as string | null;
    const images = normalizeReviewImages(it.images);
    return {
      store_id: storeId,
      platform,
      external_id: external_id ?? `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      rating,
      content,
      author_name,
      written_at,
      images,
    };
  });

  const { error } = await getSupabase().from("reviews").upsert(rows, {
    onConflict: "store_id,platform,external_id",
  });
  if (error) throw error;
  return rows.length;
}

/** 워커가 제출한 성공 결과를 DB에 반영 (세션 저장 또는 리뷰 upsert) */
export async function applyBrowserJobResult(
  job: BrowserJobRow,
  result: Record<string, unknown>
): Promise<void> {
  const { type, store_id: storeId } = job;

  switch (type) {
    case "baemin_link":
      await applyLinkResult("baemin", storeId, result as Parameters<typeof applyLinkResult>[2]);
      break;
    case "coupang_eats_link":
      await applyLinkResult("coupang_eats", storeId, result as Parameters<typeof applyLinkResult>[2]);
      break;
    case "yogiyo_link":
      await applyLinkResult("yogiyo", storeId, result as Parameters<typeof applyLinkResult>[2]);
      break;
    case "ddangyo_link":
      await applyLinkResult("ddangyo", storeId, result as Parameters<typeof applyLinkResult>[2]);
      break;
    case "baemin_sync": {
      const list = (result.reviews ?? result.list ?? []) as unknown[];
      const items = Array.isArray(list) ? list : (list && (list as { reviews?: unknown[] }).reviews) ?? [];
      await applySyncResult("baemin", storeId, items);
      break;
    }
    case "coupang_eats_sync": {
      const list = (result.list ?? result.data ?? []) as unknown[];
      await applySyncResult("coupang_eats", storeId, Array.isArray(list) ? list : []);
      break;
    }
    case "yogiyo_sync": {
      const list = (result.list ?? []) as unknown[];
      await applySyncResult("yogiyo", storeId, Array.isArray(list) ? list : []);
      break;
    }
    case "ddangyo_sync": {
      const list = (result.list ?? []) as unknown[];
      await applySyncResult("ddangyo", storeId, Array.isArray(list) ? list : []);
      break;
    }
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}
