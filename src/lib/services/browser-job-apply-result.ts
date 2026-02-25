import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { encryptCookieJson } from "@/lib/utils/cookie-encrypt";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import type { BrowserJobRow, BrowserJobType } from "./browser-job-service";

let _supabase: ReturnType<typeof createServiceRoleClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createServiceRoleClient();
  return _supabase;
}

/** "[음식배달] 평화족발 / 족발·보쌈 14680344" → "족발·보쌈" (링크 결과 폴백용) */
function parseCategoryFromDisplayLabel(text: string): string | null {
  const afterSlash = text.split(" / ")[1];
  if (!afterSlash) return null;
  const category = afterSlash.replace(/\s+\d+$/, "").trim();
  return category || null;
}

/** link 결과: store_platform_sessions upsert (service role) */
async function applyLinkResult(
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
  storeId: string,
  result: {
    cookies: CookieItem[];
    external_shop_id?: string | null;
    shop_owner_number?: string | null;
    shop_category?: string | null;
    /** @deprecated 워커가 아직 shop_category 미전송 시 폴백으로 파싱 */
    shop_display_label?: string | null;
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
  let shopCategory = result.shop_category;
  if (shopCategory == null && result.shop_display_label != null && typeof result.shop_display_label === "string") {
    shopCategory = parseCategoryFromDisplayLabel(result.shop_display_label) ?? undefined;
  }
  if (shopCategory != null) row.shop_category = shopCategory;

  const { error } = await getSupabase()
    .from("store_platform_sessions")
    .upsert(row, { onConflict: "store_id,platform" });
  if (error) throw error;
}

/** 플랫폼 답글 추출: 땡겨요 rply_cont | 요기요 reply.comment | 배민 등 comments[0].contents, 없으면 null */
function getPlatformReplyContent(it: Record<string, unknown>): string | null {
  const rplyCont = it.rply_cont;
  if (typeof rplyCont === "string" && rplyCont.trim()) return rplyCont.trim();
  const reply = it.reply;
  if (reply && typeof reply === "object" && !Array.isArray(reply)) {
    const rc = (reply as Record<string, unknown>).comment;
    if (typeof rc === "string" && rc.trim()) return rc.trim();
  }
  const comments = it.comments ?? it.replyList ?? it.replies;
  if (!Array.isArray(comments) || comments.length === 0) return null;
  const first = comments[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") return null;
  const text = (first.contents ?? first.content ?? first.comment ?? first.body) as string | undefined;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

/** 문자열이면 trim 후 반환, 비어 있거나 문자열이 아니면 null (빈 문자열 fallback 방지용) */
function trimStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/** 리뷰 주문 메뉴명 배열: 배민 menus[].name, 땡겨요 menu_nm, 요기요 menu_summary(쉼표 구분, "메뉴/수량" → 메뉴만), 그 외 빈 배열 */
function normalizeReviewMenus(
  v: unknown,
  menuNm?: string | null,
  menuSummary?: string | null,
): string[] {
  if (Array.isArray(v) && v.length > 0) {
    const fromArray = v
      .map((el) => {
        if (el != null && typeof el === "object" && "name" in el && typeof (el as { name: unknown }).name === "string")
          return (el as { name: string }).name;
        return null;
      })
      .filter((name): name is string => name != null && name.trim() !== "");
    if (fromArray.length > 0) return fromArray;
  }
  if (typeof menuNm === "string" && menuNm.trim()) return [menuNm.trim()];
  if (typeof menuSummary === "string" && menuSummary.trim()) {
    const fromSummary = menuSummary
      .split(",")
      .map((s) => s.replace(/\s*\/\d+(\([^)]*\))?\s*$/, "").trim())
      .filter((s) => s.length > 0);
    if (fromSummary.length > 0) return fromSummary;
  }
  return [];
}

/** 땡겨요 이미지 경로 prefix (file_no_1~3가 / 로 시작할 때 붙임) */
const DDANGYO_IMAGE_BASE = "https://dwdwaxgahvp6i.cloudfront.net";

/** 리뷰 이미지 배열 정규화: 배민 images[] → [{ imageUrl }], 땡겨요 file_no_1~3 경로 → full URL, 그 외 빈 배열 */
function normalizeReviewImages(
  v: unknown,
  ddangyoFileNos?: { file_no_1?: string; file_no_2?: string; file_no_3?: string } | null,
): { imageUrl: string }[] {
  if (Array.isArray(v) && v.length > 0) {
    const out: { imageUrl: string }[] = [];
    for (const el of v) {
      if (el && typeof el === "object") {
        const rec = el as Record<string, unknown>;
        const url =
          (typeof rec.imageUrl === "string" && rec.imageUrl.trim() ? rec.imageUrl : null) ??
          (typeof rec.full === "string" && rec.full.trim() ? rec.full : null) ??
          (typeof rec.thumb === "string" && rec.thumb.trim() ? rec.thumb : null);
        if (url) out.push({ imageUrl: url.trim() });
      }
    }
    if (out.length > 0) return out;
  }
  if (ddangyoFileNos) {
    const urls: string[] = [];
    for (const key of ["file_no_1", "file_no_2", "file_no_3"] as const) {
      const val = ddangyoFileNos[key];
      if (typeof val === "string" && val.trim() && val.startsWith("/")) {
        urls.push(`${DDANGYO_IMAGE_BASE}${val}`);
      }
    }
    return urls.map((imageUrl) => ({ imageUrl }));
  }
  return [];
}

/**
 * sync 결과: 해당 매장·플랫폼 리뷰를 API 결과로 전체 교체 (upsert 후 API에 없는 리뷰 삭제).
 *
 * 플랫폼별 raw 필드 (배민 vs 땡겨요 등 구조 상이):
 * - ID: 배민 id | 땡겨요 rview_atcl_no | 요기요 id
 * - 내용: 배민 contents | 땡겨요 rview_cont | 요기요 comment
 * - 작성자: 배민 memberNickname | 땡겨요 psnl_mbr_nknm | 요기요 nickname
 * - 작성일: 배민 createdAt | 땡겨요 reg_dttm | 요기요 created_at
 * - 메뉴: 배민 menus[].name | 땡겨요 menu_nm | 요기요 menu_summary(쉼표 구분 파싱)
 * - 이미지: 배민 images[].imageUrl | 땡겨요 file_no_1~3 | 요기요 review_images[].full/thumb
 * - 답글: 배민 comments[0] | 땡겨요 rply_cont | 요기요 reply.comment
 */
const DEBUG_DDANGYO_APPLY =
  process.env.DEBUG_DDANGYO_APPLY === "1" ||
  process.env.DEBUG_DDANGYO_SYNC === "1";

async function applySyncResult(
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
  storeId: string,
  list: unknown[]
): Promise<number> {
  const supabase = getSupabase();

  if (platform === "ddangyo" && list.length > 0 && DEBUG_DDANGYO_APPLY) {
    const first = list[0] as Record<string, unknown>;
    console.log("[applySyncResult:ddangyo] list.length", list.length);
    console.log("[applySyncResult:ddangyo] first item keys", Object.keys(first ?? {}));
    console.log("[applySyncResult:ddangyo] first.menu_nm", first?.menu_nm, "type", typeof first?.menu_nm);
  }

  const rows = list.map((item: unknown, index: number) => {
    const it = item as Record<string, unknown>;
    const external_id =
      String(it.id ?? it.orderReviewId ?? it.rview_atcl_no ?? "").trim() || null;
    const rating =
      it.rating != null ? Math.round(Number(it.rating)) : null;
    const content = (it.contents ?? it.comment ?? it.rview_cont ?? null) as string | null;
    const author_name = (platform === "ddangyo"
      ? (trimStr(it.psnl_mbr_nknm) || trimStr(it.psnl_msk_nm) || trimStr(it.memberNickname) || trimStr(it.customerName) || trimStr(it.nickname) || null)
      : (it.memberNickname ?? it.customerName ?? it.nickname ?? it.psnl_msk_nm ?? null)) as string | null;
    const written_at = (it.createdAt ?? it.created_at ?? it.reg_dttm ?? null) as string | null;
    const images =
      platform === "ddangyo"
        ? normalizeReviewImages(it.images, {
            file_no_1: it.file_no_1 as string | undefined,
            file_no_2: it.file_no_2 as string | undefined,
            file_no_3: it.file_no_3 as string | undefined,
          })
        : normalizeReviewImages(platform === "yogiyo" ? it.review_images : it.images);
    const menus =
      platform === "ddangyo"
        ? (typeof it.menu_nm === "string" && it.menu_nm.trim()
            ? [it.menu_nm.trim()]
            : [])
        : normalizeReviewMenus(
            it.menus,
            it.menu_nm as string | undefined,
            platform === "yogiyo" ? (it.menu_summary as string | undefined) : undefined,
          );

    if (platform === "ddangyo" && DEBUG_DDANGYO_APPLY && index < 2) {
      console.log("[applySyncResult:ddangyo] item", index, "menu_nm", it.menu_nm, "menus", menus);
    }

    const platform_reply_content = getPlatformReplyContent(it);
    return {
      store_id: storeId,
      platform,
      external_id: external_id ?? `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      rating,
      content,
      author_name,
      written_at,
      images,
      menus: menus.length > 0 ? menus : [],
      platform_reply_content: platform_reply_content ?? null,
    };
  });

  if (rows.length > 0) {
    if (platform === "ddangyo" && DEBUG_DDANGYO_APPLY) {
      console.log("[applySyncResult:ddangyo] rows[0].menus", rows[0]?.menus);
      console.log("[applySyncResult:ddangyo] rows with non-empty menus", rows.filter((r) => (r.menus?.length ?? 0) > 0).length);
    }
    const { error: upsertError } = await supabase.from("reviews").upsert(rows, {
      onConflict: "store_id,platform,external_id",
    });
    if (upsertError) throw upsertError;

    const externalIds = rows.map((r) => r.external_id);
    const inList = `(${externalIds.map((id) => `"${String(id).replace(/"/g, '""')}"`).join(",")})`;
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("store_id", storeId)
      .eq("platform", platform)
      .not("external_id", "in", inList);
    if (deleteError) throw deleteError;
  } else {
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("store_id", storeId)
      .eq("platform", platform);
    if (deleteError) throw deleteError;
  }

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
      const raw = result.reviews ?? result.list;
      const items: unknown[] = Array.isArray(raw)
        ? raw
        : (raw != null && typeof raw === "object" && Array.isArray((raw as { reviews?: unknown[] }).reviews))
          ? (raw as { reviews: unknown[] }).reviews
          : [];
      await applySyncResult("baemin", storeId, items);
      const shopCategory = result.shop_category;
      if (shopCategory != null && typeof shopCategory === "string") {
        const { error } = await getSupabase()
          .from("store_platform_sessions")
          .update({
            shop_category: shopCategory,
            updated_at: new Date().toISOString(),
          })
          .eq("store_id", storeId)
          .eq("platform", "baemin");
        if (error) console.error("[applyBrowserJobResult] baemin_sync shop_category update failed", error.message);
      }
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
