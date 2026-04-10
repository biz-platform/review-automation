import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { composeBaeminStoredExternalId } from "@/lib/utils/baemin-external-id";
import {
  encryptCookieJson,
  decryptCookieJson,
} from "@/lib/utils/cookie-encrypt";
import { normalizeBusinessRegistration } from "@/lib/utils/format-business-registration";
import { isReplyWriteExpired } from "@/entities/review/lib/review-utils";
import type { CookieItem } from "@/lib/types/dto/platform-dto";
import { upsertStorePlatformShops } from "@/lib/services/platform-shop-service";
import { getReviewSyncWindowDateRangeFormatted } from "@/lib/utils/review-date-range";
import {
  createBrowserJobWithServiceRole,
  type BrowserJobRow,
} from "./browser-job-service";
import { filterBaeminReviewsForSync } from "@/lib/services/baemin/baemin-review-sync-exclude";
import { parseCategoryFromBaeminShopOptionText } from "@/lib/services/baemin/baemin-shop-option-label";

let _supabase: ReturnType<typeof createServiceRoleClient> | null = null;
function getSupabase() {
  if (!_supabase) _supabase = createServiceRoleClient();
  return _supabase;
}

async function hasAnyReviewsForStorePlatform(
  storeId: string,
  platform: "baemin" | "yogiyo" | "ddangyo" | "coupang_eats",
): Promise<boolean> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("reviews")
    .select("id")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .limit(1);
  if (error) throw error;
  return (data?.length ?? 0) > 0;
}

/**
 * 첫 매장 연동 1회만: 180일 풀 백필 job.
 * 재연동(세션 갱신) 등 이후 post_link sync는 30일(ongoing)만.
 * 실패해도 링크 적용은 유지.
 */
async function enqueuePostLinkInitialReviewSync(
  storeId: string,
  userId: string,
  platform: "baemin" | "yogiyo" | "ddangyo" | "coupang_eats",
): Promise<void> {
  try {
    const hasExisting = await hasAnyReviewsForStorePlatform(storeId, platform);
    const syncWindow = hasExisting ? ("ongoing" as const) : ("initial" as const);
    const range = getReviewSyncWindowDateRangeFormatted(syncWindow);
    if (platform === "baemin") {
      await createBrowserJobWithServiceRole("baemin_sync", storeId, userId, {
        ...range,
        offset: "0",
        limit: "10",
        fetchAll: true,
        syncWindow,
        trigger: "post_link",
      });
      return;
    }
    const jobType =
      platform === "coupang_eats"
        ? "coupang_eats_sync"
        : platform === "yogiyo"
          ? "yogiyo_sync"
          : "ddangyo_sync";
    await createBrowserJobWithServiceRole(jobType, storeId, userId, {
      syncWindow,
      trigger: "post_link",
    });
  } catch (e) {
    console.error(
      "[enqueuePostLinkInitialReviewSync] failed",
      { storeId, platform },
      e,
    );
  }
}

/** link 결과: store_platform_sessions upsert (service role). credentials 있으면 함께 저장해 sync 시 재로그인에 사용 */
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
    /** 플랫폼에서 보이는 매장명 (연동 시 저장, 플랫폼마다 다를 수 있음) */
    store_name?: string | null;
    /** 땡겨요: requestUpdateReview/requestDeleteReview 의 fin_chg_id(로그인 유저 ID) */
    external_user_id?: string | null;
    /** 배민 등: 사업자 등록번호 (self-api shop-owners API businessNo) */
    business_registration_number?: string | null;
  },
  credentials?: { username: string; password: string },
): Promise<void> {
  const encrypted = encryptCookieJson(JSON.stringify(result.cookies));
  const row: Record<string, unknown> = {
    store_id: storeId,
    platform,
    cookies_encrypted: encrypted,
    updated_at: new Date().toISOString(),
  };
  if (result.external_shop_id != null)
    row.external_shop_id = result.external_shop_id;
  if (result.shop_owner_number != null)
    row.shop_owner_number = result.shop_owner_number;
  let shopCategory = result.shop_category;
  if (
    shopCategory == null &&
    result.shop_display_label != null &&
    typeof result.shop_display_label === "string"
  ) {
    shopCategory =
      parseCategoryFromBaeminShopOptionText(result.shop_display_label.trim()) ??
      undefined;
  }
  if (shopCategory != null) row.shop_category = shopCategory;
  if (credentials?.username?.trim() && credentials?.password) {
    row.credentials_encrypted = encryptCookieJson(
      JSON.stringify({
        username: credentials.username.trim(),
        password: credentials.password,
      }),
    );
  }
  if (
    result.external_user_id != null &&
    String(result.external_user_id).trim() !== ""
  ) {
    row.external_user_id = String(result.external_user_id).trim();
  }
  if (
    result.business_registration_number != null &&
    String(result.business_registration_number).trim() !== ""
  ) {
    const digits = normalizeBusinessRegistration(
      result.business_registration_number,
    );
    if (digits.length > 0) row.business_registration_number = digits;
  }
  if (result.store_name != null && String(result.store_name).trim() !== "") {
    row.store_name = String(result.store_name).trim();
  }

  if (
    result.external_shop_id != null &&
    String(result.external_shop_id).trim() !== ""
  ) {
    const extIdStr = String(result.external_shop_id).trim();
    const { data: rows } = await getSupabase()
      .from("store_platform_sessions")
      .select("store_id")
      .eq("platform", platform)
      .eq("external_shop_id", extIdStr)
      .limit(1);
    if (rows && rows.length > 0 && rows[0].store_id !== storeId) {
      throw new Error("이미 다른 계정에 연동된 매장입니다.");
    }
  }

  const { error } = await getSupabase()
    .from("store_platform_sessions")
    .upsert(row, { onConflict: "store_id,platform" });
  if (error) throw error;
}

/** 플랫폼 답글 추출(배민 제외): 땡겨요 rply_cont | 요기요 reply.comment | 그 외 comments[0]… — 배민은 getBaeminPlatformReplyContent */
function getPlatformReplyContent(it: Record<string, unknown>): string | null {
  const rplyCont = it.rply_cont;
  if (typeof rplyCont === "string" && rplyCont.trim()) return rplyCont.trim();
  const reply = it.reply;
  if (reply && typeof reply === "object" && !Array.isArray(reply)) {
    const rc = (reply as Record<string, unknown>).comment;
    if (typeof rc === "string" && rc.trim()) return rc.trim();
  }
  const direct =
    it.managerReply ??
    it.managerComment ??
    it.ownerReply ??
    it.shopComment ??
    it.sellerComment;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  const comments = it.comments ?? it.replyList ?? it.replies;
  if (!Array.isArray(comments) || comments.length === 0) return null;
  const first = comments[0] as Record<string, unknown> | undefined;
  if (!first || typeof first !== "object") return null;
  const text = (first.contents ??
    first.content ??
    first.comment ??
    first.body ??
    first.text) as string | undefined;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

function baeminCommentRawArray(it: Record<string, unknown>): unknown[] {
  const raw = it.comments ?? it.replyList ?? it.replies;
  return Array.isArray(raw) ? raw : [];
}

/** 배민 comment에 작성자/타입 구분 필드가 있는지 (typed 모드: CEO + displayStatus 규칙 적용) */
function baeminCommentHasAuthorDiscriminator(
  c: Record<string, unknown>,
): boolean {
  return (
    c.displayType != null ||
    c.display_type != null ||
    c.displayStatus != null ||
    c.display_status != null ||
    c.displayWriterType != null ||
    c.display_writer_type != null ||
    c.writerType != null ||
    c.writer_type != null ||
    c.reviewCommentType != null ||
    c.review_comment_type != null ||
    c.commenterType != null ||
    c.commenter_type != null ||
    c.isChef != null ||
    c.is_chef != null ||
    c.chef !== undefined ||
    typeof c.modifiable === "boolean"
  );
}

/** 사장님 댓글 코멘트 객체인지 (배민 self-api: displayType "CEO") */
function isShopBaeminComment(c: Record<string, unknown>): boolean {
  const toStr = (v: unknown): string =>
    v == null ? "" : String(v).trim().toUpperCase();
  if (toStr(c.displayType ?? c.display_type) === "CEO") return true;
  const tokens = [
    toStr(c.displayWriterType),
    toStr(c.display_writer_type),
    toStr(c.writerType),
    toStr(c.writer_type),
    toStr(c.reviewCommentType),
    toStr(c.review_comment_type),
    toStr(c.commenterType),
    toStr(c.commenter_type),
    toStr(c.type),
    toStr(c.commentType),
  ];
  for (const s of tokens) {
    if (!s) continue;
    if (
      s.includes("CEO") ||
      s.includes("SHOP") ||
      s.includes("OWNER") ||
      s.includes("CHEF") ||
      s.includes("STORE") ||
      s.includes("BIZ")
    ) {
      return true;
    }
  }
  const rawWriter = c.displayWriterType ?? c.writerType ?? c.writer_type ?? "";
  if (typeof rawWriter === "string" && /^(사장|점주)/.test(rawWriter.trim())) {
    return true;
  }
  if (c.isChef === true || c.is_chef === true || c.chef === true) return true;
  return false;
}

/** 플랫폼에 실제 노출 중인 사장님 답글만 (DELETE 등은 아직 코멘트 객체가 남음) */
function isBaeminCeoReplyVisible(c: Record<string, unknown>): boolean {
  const ds = c.displayStatus ?? c.display_status;
  if (ds == null || String(ds).trim() === "") return true;
  return String(ds).trim().toUpperCase() === "DISPLAY";
}

function extractBaeminCommentBody(c: Record<string, unknown>): string | null {
  const text = (c.contents ?? c.content ?? c.comment ?? c.body ?? c.text) as
    | string
    | undefined;
  return typeof text === "string" && text.trim() ? text.trim() : null;
}

/**
 * 배민: 사장님 댓글은 displayType CEO, 노출분만 displayStatus DISPLAY.
 * 삭제·숨김은 객체가 남아 있어도 미답변과 동일하게 처리. CEO+DISPLAY가 여러 개면 보통 마지막이 현재 답글.
 */
function pickBaeminShopReplyComment(
  it: Record<string, unknown>,
): Record<string, unknown> | null {
  const arr = baeminCommentRawArray(it);
  if (arr.length === 0) return null;
  const records = arr.filter(
    (x): x is Record<string, unknown> =>
      x != null && typeof x === "object" && !Array.isArray(x),
  );
  if (records.length === 0) return null;

  const anyTyped = records.some(baeminCommentHasAuthorDiscriminator);
  if (!anyTyped) {
    return records[0] ?? null;
  }
  const visibleCeo = records.filter(
    (c) =>
      isShopBaeminComment(c) &&
      isBaeminCeoReplyVisible(c) &&
      extractBaeminCommentBody(c),
  );
  if (visibleCeo.length === 0) return null;
  return visibleCeo[visibleCeo.length - 1] ?? null;
}

/** 배민 동기화 전용. 다른 플랫폼은 getPlatformReplyContent 유지 */
function getBaeminPlatformReplyContent(
  it: Record<string, unknown>,
): string | null {
  const rplyCont = it.rply_cont;
  if (typeof rplyCont === "string" && rplyCont.trim()) return rplyCont.trim();
  const reply = it.reply;
  if (reply && typeof reply === "object" && !Array.isArray(reply)) {
    const rc = (reply as Record<string, unknown>).comment;
    if (typeof rc === "string" && rc.trim()) return rc.trim();
  }
  const direct =
    it.managerReply ??
    it.managerComment ??
    it.ownerReply ??
    it.shopComment ??
    it.sellerComment;
  if (typeof direct === "string" && direct.trim()) return direct.trim();

  const picked = pickBaeminShopReplyComment(it);
  if (!picked) return null;
  return extractBaeminCommentBody(picked);
}

/**
 * 동기화 raw 항목에서 플랫폼 답글 ID (수정/삭제·정합성용). 본문과 같은 출처를 쓴다.
 * 답글 없음이면 null — upsert 시 기존 platform_reply_id를 NULL로 덮어 잘못된 ID가 남지 않게 함.
 */
function getPlatformReplyIdFromItem(
  it: Record<string, unknown>,
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
): string | null {
  switch (platform) {
    case "ddangyo": {
      const no = it.rply_no;
      return no != null && String(no).trim() !== "" ? String(no).trim() : null;
    }
    case "yogiyo": {
      const reply = it.reply;
      if (reply && typeof reply === "object" && !Array.isArray(reply)) {
        const id = (reply as Record<string, unknown>).id;
        if (id != null) return String(id);
      }
      return null;
    }
    case "coupang_eats": {
      const arr = it.replies ?? it.comments ?? it.replyList;
      if (Array.isArray(arr) && arr.length > 0) {
        const first = arr[0] as Record<string, unknown>;
        const oid = first.orderReviewReplyId ?? first.order_review_reply_id;
        if (oid != null) return String(oid);
      }
      return null;
    }
    case "baemin": {
      const picked = pickBaeminShopReplyComment(it);
      if (!picked) return null;
      const id = picked.id ?? picked.commentId ?? picked.replyId;
      return id != null ? String(id) : null;
    }
    default:
      return null;
  }
}

/** 리뷰 작성일: API가 ISO 문자열 또는 epoch(ms) 숫자로 줄 수 있음 → DB/기한 계산용 ISO */
function normalizeWrittenAt(it: Record<string, unknown>): string | null {
  const raw =
    it.createdAt ?? it.created_at ?? it.reg_dttm ?? it.createdDate ?? null;
  if (raw == null) return null;
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return new Date(raw).toISOString();
  }
  if (typeof raw === "string" && raw.trim()) {
    const s = raw.trim();
    const t = Date.parse(s);
    if (!Number.isNaN(t)) return new Date(t).toISOString();
    return s;
  }
  return null;
}

/** 문자열이면 trim 후 반환, 비어 있거나 문자열이 아니면 null (빈 문자열 fallback 방지용) */
function trimStr(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  return s.length > 0 ? s : null;
}

/** 쿠팡 등 API가 number로 주는 storeId → platform_shop_external_id용 문자열 */
function trimStrFromStringOrNumber(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) {
    const s = String(v);
    return s.length > 0 ? s : null;
  }
  return trimStr(v);
}

/** 쿠팡이츠 orderInfo[].dishName → 메뉴명 배열 (이벤트/빈 항목 제외) */
function normalizeCoupangEatsMenus(orderInfo: unknown): string[] {
  if (!Array.isArray(orderInfo) || orderInfo.length === 0) return [];
  const skipPatterns = /포토\s*리뷰\s*이벤트|이벤트\s*참여/i;
  const names = orderInfo
    .map((o) =>
      o != null && typeof o === "object" && "dishName" in o
        ? (o as { dishName?: unknown }).dishName
        : null,
    )
    .filter(
      (name): name is string =>
        typeof name === "string" &&
        name.trim() !== "" &&
        !skipPatterns.test(name.trim()),
    );
  return [...new Set(names.map((n) => n.trim()))];
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
        if (
          el != null &&
          typeof el === "object" &&
          "name" in el &&
          typeof (el as { name: unknown }).name === "string"
        )
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

/** 리뷰 이미지 배열 정규화: 배민 images[] | 쿠팡이츠 images(URL 문자열[]) | 땡겨요 file_no_1~3 | 요기요 review_images */
function normalizeReviewImages(
  v: unknown,
  ddangyoFileNos?: {
    file_no_1?: string;
    file_no_2?: string;
    file_no_3?: string;
  } | null,
): { imageUrl: string }[] {
  if (Array.isArray(v) && v.length > 0) {
    const out: { imageUrl: string }[] = [];
    for (const el of v) {
      if (typeof el === "string" && el.trim()) {
        out.push({ imageUrl: el.trim() });
        continue;
      }
      if (el && typeof el === "object") {
        const rec = el as Record<string, unknown>;
        const url =
          (typeof rec.imageUrl === "string" && rec.imageUrl.trim()
            ? rec.imageUrl
            : null) ??
          (typeof rec.full === "string" && rec.full.trim() ? rec.full : null) ??
          (typeof rec.thumb === "string" && rec.thumb.trim()
            ? rec.thumb
            : null);
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
 * - 답글: 배민 comments — displayType CEO + displayStatus DISPLAY 만(삭제된 CEO 객체는 제외; 여러 개면 마지막) | 땡겨요 rply_cont | 요기요 reply.comment | 쿠팡 replies[0].content
 * - 답글 ID: 동기화 시 platform_reply_id도 함께 갱신(없으면 NULL) — 플랫폼에서 삭제·추가된 상태와 DB 정합
 * - 쿠팡이츠: orderReviewId, comment, rating, customerName, createdAt, images(URL[]), orderInfo[].dishName
 */
const DEBUG_DDANGYO_APPLY =
  process.env.DEBUG_DDANGYO_APPLY === "1" ||
  process.env.DEBUG_DDANGYO_SYNC === "1";

/**
 * 어드민 작업 로그용 동기화 통계 (apply 직후 merged.result에 붙임 → result_summary 저장)
 * 분류는 ReplyStatusBadge와 동일: 만료(작성 기한 초과) → 기한만료, 그다음 답변 여부.
 */
export type SyncLogStats = {
  previousTotal: number;
  totalAfter: number;
  newReviewCount: number;
  /** 작성 기한 이내·미답변 (UI 미답변) */
  unansweredTotal: number;
  /** 작성 기한 경과 (UI 기한만료, 답변 유무 무관) */
  expiredTotal: number;
  /** 작성 기한 이내·답변 있음 (UI 답변완료) */
  answeredTotal: number;
  newUnansweredCount: number;
  newExpiredTotalCount: number;
  newAnsweredCount: number;
  isFirstSync: boolean;
};

/** PostgREST URL·요청 본문 한도 회피용 */
const SYNC_UPSERT_BATCH_SIZE = 120;
const SYNC_DELETE_IN_BATCH_SIZE = 80;

async function fetchAllReviewExternalIdsForStorePlatform(
  storeId: string,
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
): Promise<Set<string>> {
  const supabase = getSupabase();
  const pageSize = 1000;
  const ids = new Set<string>();
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("reviews")
      .select("external_id")
      .eq("store_id", storeId)
      .eq("platform", platform)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = data ?? [];
    for (const row of chunk) {
      const id = row.external_id as string | null;
      if (typeof id === "string" && id.trim() !== "") ids.add(id.trim());
    }
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function applySyncResult(
  platform: "baemin" | "coupang_eats" | "yogiyo" | "ddangyo",
  storeId: string,
  list: unknown[],
): Promise<SyncLogStats> {
  const supabase = getSupabase();

  const syncList =
    platform === "baemin" ? filterBaeminReviewsForSync(list) : list;

  const existingIds = await fetchAllReviewExternalIdsForStorePlatform(
    storeId,
    platform,
  );
  const previousTotal = existingIds.size;

  if (platform === "ddangyo" && syncList.length > 0 && DEBUG_DDANGYO_APPLY) {
    const first = syncList[0] as Record<string, unknown>;
    console.log("[applySyncResult:ddangyo] list.length", syncList.length);
    console.log(
      "[applySyncResult:ddangyo] first item keys",
      Object.keys(first ?? {}),
    );
    console.log(
      "[applySyncResult:ddangyo] first.menu_nm",
      first?.menu_nm,
      "type",
      typeof first?.menu_nm,
    );
  }

  const mappedRows = syncList.map((item: unknown, index: number) => {
    const it = item as Record<string, unknown>;
    const rawExternal =
      String(it.id ?? it.orderReviewId ?? it.rview_atcl_no ?? "").trim() ||
      null;
    const rating =
      platform === "ddangyo"
        ? (() => {
            const code =
              typeof it.good_eval_cd === "string" ? it.good_eval_cd.trim() : "";
            if (!code) return null;
            // ddangyo: 음식 평가는 "맛있어요" 1개만 존재. 그 외 값은 표시하지 않음.
            return code === "1" ? 5 : null;
          })()
        : it.rating != null
          ? Math.round(Number(it.rating))
          : null;
    const content = (it.contents ?? it.comment ?? it.rview_cont ?? null) as
      | string
      | null;
    const author_name = (
      platform === "ddangyo"
        ? trimStr(it.psnl_mbr_nknm) ||
          trimStr(it.psnl_msk_nm) ||
          trimStr(it.memberNickname) ||
          trimStr(it.customerName) ||
          trimStr(it.nickname) ||
          null
        : (it.memberNickname ??
          it.customerName ??
          it.nickname ??
          it.psnl_msk_nm ??
          null)
    ) as string | null;
    const written_at = normalizeWrittenAt(it);
    const images =
      platform === "ddangyo"
        ? normalizeReviewImages(it.images, {
            file_no_1: it.file_no_1 as string | undefined,
            file_no_2: it.file_no_2 as string | undefined,
            file_no_3: it.file_no_3 as string | undefined,
          })
        : normalizeReviewImages(
            platform === "yogiyo" ? it.review_images : it.images,
          );
    const menus =
      platform === "ddangyo"
        ? typeof it.menu_nm === "string" && it.menu_nm.trim()
          ? [it.menu_nm.trim()]
          : []
        : platform === "coupang_eats"
          ? normalizeCoupangEatsMenus(it.orderInfo)
          : normalizeReviewMenus(
              it.menus,
              it.menu_nm as string | undefined,
              platform === "yogiyo"
                ? (it.menu_summary as string | undefined)
                : undefined,
            );

    if (platform === "ddangyo" && DEBUG_DDANGYO_APPLY && index < 2) {
      console.log(
        "[applySyncResult:ddangyo] item",
        index,
        "menu_nm",
        it.menu_nm,
        "menus",
        menus,
      );
    }

    const platform_reply_content =
      platform === "baemin"
        ? getBaeminPlatformReplyContent(it)
        : getPlatformReplyContent(it);
    const platform_reply_id =
      platform_reply_content != null && platform_reply_content.trim() !== ""
        ? getPlatformReplyIdFromItem(it, platform)
        : null;
    const platform_shop_external_id =
      platform === "baemin"
        ? trimStr(it.platform_shop_external_id)
        : platform === "coupang_eats"
          ? (trimStrFromStringOrNumber(it.storeId) ??
            trimStrFromStringOrNumber(it.store_id) ??
            trimStr(it.platform_shop_external_id))
          : platform === "yogiyo"
            ? (trimStrFromStringOrNumber(it._vendor_id) ??
              trimStr(it.platform_shop_external_id))
            : platform === "ddangyo"
              ? (trimStrFromStringOrNumber(it._patsto_no) ??
                trimStr(it.platform_shop_external_id))
              : null;
    const external_id =
      platform === "baemin" && rawExternal
        ? composeBaeminStoredExternalId(platform_shop_external_id, rawExternal)
        : rawExternal;
    return {
      store_id: storeId,
      platform,
      external_id:
        external_id ??
        `unknown-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      rating,
      content,
      author_name,
      written_at,
      images,
      menus: menus.length > 0 ? menus : [],
      platform_reply_content: platform_reply_content ?? null,
      platform_reply_id,
      platform_shop_external_id,
    };
  });

  const byExternalId = new Map<string, (typeof mappedRows)[number]>();
  for (const row of mappedRows) {
    byExternalId.set(row.external_id, row);
  }
  const rows = [...byExternalId.values()];

  const isNewExternal = (externalId: string) => !existingIds.has(externalId);

  let unansweredTotal = 0;
  let expiredTotal = 0;
  let answeredTotal = 0;
  let newUnansweredCount = 0;
  let newExpiredTotalCount = 0;
  let newAnsweredCount = 0;
  for (const row of rows) {
    const writtenAt = (row.written_at as string | null) ?? null;
    const expired = isReplyWriteExpired(writtenAt, platform);
    if (expired) {
      expiredTotal++;
    } else if (row.platform_reply_content) {
      answeredTotal++;
    } else {
      unansweredTotal++;
    }
    if (isNewExternal(row.external_id)) {
      if (expired) newExpiredTotalCount++;
      else if (row.platform_reply_content) newAnsweredCount++;
      else newUnansweredCount++;
    }
  }

  const totalAfter = rows.length;
  const newReviewCount = rows.filter((r) =>
    isNewExternal(r.external_id),
  ).length;
  const isFirstSync = previousTotal === 0;

  if (rows.length > 0) {
    if (platform === "ddangyo" && DEBUG_DDANGYO_APPLY) {
      console.log("[applySyncResult:ddangyo] rows[0].menus", rows[0]?.menus);
      console.log(
        "[applySyncResult:ddangyo] rows with non-empty menus",
        rows.filter((r) => (r.menus?.length ?? 0) > 0).length,
      );
    }
    for (let i = 0; i < rows.length; i += SYNC_UPSERT_BATCH_SIZE) {
      const batch = rows.slice(i, i + SYNC_UPSERT_BATCH_SIZE);
      const { error: upsertError } = await supabase
        .from("reviews")
        .upsert(batch, {
          onConflict: "store_id,platform,external_id",
        });
      if (upsertError) throw upsertError;
    }

    const syncedIds = new Set(rows.map((r) => r.external_id));
    const toRemove = [...existingIds].filter((id) => !syncedIds.has(id));
    for (let i = 0; i < toRemove.length; i += SYNC_DELETE_IN_BATCH_SIZE) {
      const batch = toRemove.slice(i, i + SYNC_DELETE_IN_BATCH_SIZE);
      const { error: deleteError } = await supabase
        .from("reviews")
        .delete()
        .eq("store_id", storeId)
        .eq("platform", platform)
        .in("external_id", batch);
      if (deleteError) throw deleteError;
    }
  } else {
    const { error: deleteError } = await supabase
      .from("reviews")
      .delete()
      .eq("store_id", storeId)
      .eq("platform", platform);
    if (deleteError) throw deleteError;
  }

  return {
    previousTotal,
    totalAfter,
    newReviewCount,
    unansweredTotal,
    expiredTotal,
    answeredTotal,
    newUnansweredCount,
    newExpiredTotalCount,
    newAnsweredCount,
    isFirstSync,
  };
}

/**
 * **예약 자동 댓글(cron) 동기화가 끝났을 때만** 호출할 것.
 * 수동「실시간 리뷰 불러오기」sync payload는 `trigger: "manual"` — 여기 호출하면 안 됨.
 *
 * 워커가 `auto_register_post_sync` 1건을 실행해 (1) 미답변 AI 초안 저장 → (2) register_reply job 생성.
 * tone_settings.comment_register_mode !== 'auto'면 파이프라인 내부에서 스킵.
 * @internal 테스트용으로 export (dev API 등에서 호출)
 */
export async function createRegisterReplyJobsForUnansweredAfterSync(
  storeId: string,
  platform: "baemin" | "yogiyo" | "ddangyo" | "coupang_eats",
  userId: string,
): Promise<void> {
  try {
    await createBrowserJobWithServiceRole(
      "auto_register_post_sync",
      storeId,
      userId,
      { platform, trigger: "cron" },
    );
  } catch (e) {
    console.error(
      "[createRegisterReplyJobsForUnansweredAfterSync] auto_register_post_sync job create failed",
      { storeId, platform },
      e,
    );
  }
}

const LINK_JOB_TYPES = [
  "baemin_link",
  "coupang_eats_link",
  "yogiyo_link",
  "ddangyo_link",
] as const;

/** 워커가 제출한 성공 결과를 DB에 반영 (세션 저장 또는 리뷰 upsert) */
export async function applyBrowserJobResult(
  job: BrowserJobRow,
  result: Record<string, unknown>,
): Promise<void> {
  const { type, store_id: storeId } = job;

  if (!storeId) {
    throw new Error(
      "applyBrowserJobResult: store_id required (create store first for link job)",
    );
  }

  switch (type) {
    case "baemin_link": {
      let creds: { username: string; password: string } | undefined;
      const enc = job.payload?.credentials_encrypted;
      if (typeof enc === "string") {
        try {
          const raw = decryptCookieJson(enc);
          const parsed = JSON.parse(raw) as {
            username?: string;
            password?: string;
          };
          if (
            typeof parsed?.username === "string" &&
            typeof parsed?.password === "string"
          ) {
            creds = { username: parsed.username, password: parsed.password };
          }
        } catch {
          // ignore
        }
      }
      await applyLinkResult(
        "baemin",
        storeId,
        result as Parameters<typeof applyLinkResult>[2],
        creds,
      );
      const rawShops = (result as { shops?: unknown[] }).shops;
      const linkExternalShopId = String(
        (result as { external_shop_id?: unknown }).external_shop_id ?? "",
      ).trim();
      const shops = Array.isArray(rawShops)
        ? rawShops
            .map((row) => {
              if (row == null || typeof row !== "object") return null;
              const shopNo = String(
                (row as { shopNo?: unknown }).shopNo ?? "",
              ).trim();
              if (!shopNo) return null;
              const shopNameRaw = (row as { shopName?: unknown }).shopName;
              const shopCatRaw =
                (row as { shop_category?: unknown }).shop_category ??
                (row as { shopCategory?: unknown }).shopCategory;
              return {
                platform_shop_external_id: shopNo,
                shop_name:
                  typeof shopNameRaw === "string" && shopNameRaw.trim()
                    ? shopNameRaw.trim()
                    : null,
                shop_category:
                  typeof shopCatRaw === "string" && shopCatRaw.trim()
                    ? shopCatRaw.trim()
                    : null,
                is_primary:
                  !!linkExternalShopId && shopNo === linkExternalShopId,
              };
            })
            .filter((v): v is NonNullable<typeof v> => v != null)
        : [];
      if (shops.length > 0) {
        await upsertStorePlatformShops(getSupabase(), storeId, "baemin", shops);
      }
      await enqueuePostLinkInitialReviewSync(storeId, job.user_id, "baemin");
      break;
    }
    case "coupang_eats_link": {
      const creds =
        job.payload?.username != null && job.payload?.password != null
          ? {
              username: String(job.payload.username),
              password: String(job.payload.password),
            }
          : undefined;
      await applyLinkResult(
        "coupang_eats",
        storeId,
        result as Parameters<typeof applyLinkResult>[2],
        creds,
      );
      const rawShops = (result as { shops?: unknown[] }).shops;
      const linkExternalShopId = String(
        (result as { external_shop_id?: unknown }).external_shop_id ?? "",
      ).trim();
      const shops = Array.isArray(rawShops)
        ? rawShops
            .map((row) => {
              if (row == null || typeof row !== "object") return null;
              const shopNo = String(
                (
                  row as {
                    shopNo?: unknown;
                    platform_shop_external_id?: unknown;
                  }
                ).shopNo ??
                  (
                    row as {
                      shopNo?: unknown;
                      platform_shop_external_id?: unknown;
                    }
                  ).platform_shop_external_id ??
                  "",
              ).trim();
              if (!shopNo) return null;
              const shopNameRaw =
                (row as { shopName?: unknown; shop_name?: unknown }).shopName ??
                (row as { shopName?: unknown; shop_name?: unknown }).shop_name;
              const shopCatRaw =
                (row as { shop_category?: unknown; shopCategory?: unknown })
                  .shop_category ??
                (row as { shop_category?: unknown; shopCategory?: unknown })
                  .shopCategory;
              return {
                platform_shop_external_id: shopNo,
                shop_name:
                  typeof shopNameRaw === "string" && shopNameRaw.trim()
                    ? shopNameRaw.trim()
                    : null,
                shop_category:
                  typeof shopCatRaw === "string" && shopCatRaw.trim()
                    ? shopCatRaw.trim()
                    : null,
                is_primary:
                  !!linkExternalShopId && shopNo === linkExternalShopId,
              };
            })
            .filter((v): v is NonNullable<typeof v> => v != null)
        : [];
      if (shops.length > 0) {
        await upsertStorePlatformShops(
          getSupabase(),
          storeId,
          "coupang_eats",
          shops,
        );
      }
      await enqueuePostLinkInitialReviewSync(
        storeId,
        job.user_id,
        "coupang_eats",
      );
      break;
    }
    case "yogiyo_link": {
      const yogiyoCreds =
        job.payload?.username != null && job.payload?.password != null
          ? {
              username: String(job.payload.username),
              password: String(job.payload.password),
            }
          : undefined;
      await applyLinkResult(
        "yogiyo",
        storeId,
        result as Parameters<typeof applyLinkResult>[2],
        yogiyoCreds,
      );
      const linkResult = result as {
        external_shop_id?: unknown;
        vendors?: { id: number; name: string }[];
      };
      const vendors = linkResult.vendors;
      const extId = String(linkResult.external_shop_id ?? "").trim();
      if (Array.isArray(vendors) && vendors.length > 0) {
        await upsertStorePlatformShops(
          getSupabase(),
          storeId,
          "yogiyo",
          vendors.map((v) => ({
            platform_shop_external_id: String(v.id),
            shop_name:
              typeof v.name === "string" && v.name.trim()
                ? v.name.trim()
                : null,
            is_primary: !!extId && String(v.id) === extId,
          })),
        );
      }
      await enqueuePostLinkInitialReviewSync(storeId, job.user_id, "yogiyo");
      break;
    }
    case "ddangyo_link": {
      const ddangyoCreds =
        job.payload?.username != null && job.payload?.password != null
          ? {
              username: String(job.payload.username),
              password: String(job.payload.password),
            }
          : undefined;
      await applyLinkResult(
        "ddangyo",
        storeId,
        result as Parameters<typeof applyLinkResult>[2],
        ddangyoCreds,
      );
      const linkResult = result as {
        external_shop_id?: unknown;
        patstos?: { patsto_no: string; patsto_nm: string }[];
      };
      const patstos = linkResult.patstos;
      const extId = String(linkResult.external_shop_id ?? "").trim();
      if (Array.isArray(patstos) && patstos.length > 0) {
        await upsertStorePlatformShops(
          getSupabase(),
          storeId,
          "ddangyo",
          patstos.map((p) => ({
            platform_shop_external_id: String(p.patsto_no),
            shop_name:
              typeof p.patsto_nm === "string" && p.patsto_nm.trim()
                ? p.patsto_nm.trim()
                : null,
            is_primary: !!extId && String(p.patsto_no) === extId,
          })),
        );
      }
      await enqueuePostLinkInitialReviewSync(storeId, job.user_id, "ddangyo");
      break;
    }
    case "baemin_sync": {
      const raw = result.reviews ?? result.list;
      const items: unknown[] = Array.isArray(raw)
        ? raw
        : raw != null &&
            typeof raw === "object" &&
            Array.isArray((raw as { reviews?: unknown[] }).reviews)
          ? (raw as { reviews: unknown[] }).reviews
          : [];
      const syncStats = await applySyncResult("baemin", storeId, items);
      Object.assign(result, { sync_log_stats: syncStats });
      const rawShops = (result as { shops?: unknown[] }).shops;
      const externalShopIdForPrimary = String(
        (result as { external_shop_id?: unknown }).external_shop_id ?? "",
      ).trim();
      const shops =
        Array.isArray(rawShops) && rawShops.length > 0
          ? rawShops
              .map((row) => {
                if (row == null || typeof row !== "object") return null;
                const shopNo = String(
                  (row as { shopNo?: unknown }).shopNo ?? "",
                ).trim();
                if (!shopNo) return null;
                const shopNameRaw = (row as { shopName?: unknown }).shopName;
                const shopCatRaw =
                  (row as { shop_category?: unknown }).shop_category ??
                  (row as { shopCategory?: unknown }).shopCategory;
                return {
                  platform_shop_external_id: shopNo,
                  shop_name:
                    typeof shopNameRaw === "string" && shopNameRaw.trim()
                      ? shopNameRaw.trim()
                      : null,
                  shop_category:
                    typeof shopCatRaw === "string" && shopCatRaw.trim()
                      ? shopCatRaw.trim()
                      : null,
                  is_primary:
                    !!externalShopIdForPrimary &&
                    shopNo === externalShopIdForPrimary,
                };
              })
              .filter((v): v is NonNullable<typeof v> => v != null)
          : (() => {
              const uniq = new Set<string>();
              for (const r of items) {
                if (r == null || typeof r !== "object") continue;
                const shopNo = String(
                  (r as { platform_shop_external_id?: unknown })
                    .platform_shop_external_id ?? "",
                ).trim();
                if (shopNo) uniq.add(shopNo);
              }
              return [...uniq].map((shopNo) => ({
                platform_shop_external_id: shopNo,
                shop_name: null,
                shop_category: null,
                is_primary:
                  !!externalShopIdForPrimary &&
                  shopNo === externalShopIdForPrimary,
              }));
            })();
      if (shops.length > 0) {
        await upsertStorePlatformShops(getSupabase(), storeId, "baemin", shops);
      }
      const shopCategory = result.shop_category;
      const storeName = result.store_name;
      const updatePayload: Record<string, unknown> = {
        updated_at: new Date().toISOString(),
      };
      if (shopCategory != null && typeof shopCategory === "string") {
        updatePayload.shop_category = shopCategory;
      }
      if (
        storeName != null &&
        typeof storeName === "string" &&
        storeName.trim() !== ""
      ) {
        updatePayload.store_name = storeName.trim();
      }
      if (Object.keys(updatePayload).length > 1) {
        const { error } = await getSupabase()
          .from("store_platform_sessions")
          .update(updatePayload)
          .eq("store_id", storeId)
          .eq("platform", "baemin");
        if (error)
          console.error(
            "[applyBrowserJobResult] baemin_sync session update failed",
            error.message,
          );
      }
      /* 예약 자동 댓글: `scheduled-auto-register`만 trigger=cron */
      if (job.payload?.trigger === "cron") {
        await createRegisterReplyJobsForUnansweredAfterSync(
          storeId,
          "baemin",
          job.user_id,
        );
      }
      break;
    }
    case "coupang_eats_sync": {
      const list = (result.list ?? result.data ?? []) as unknown[];
      if (
        process.env.DEBUG_COUPANG_EATS_SYNC === "1" &&
        result.shop_sync_summaries != null
      ) {
        console.log(
          "[applyBrowserJobResult] coupang_eats_sync shop_sync_summaries",
          {
            storeId,
            shop_sync_summaries: result.shop_sync_summaries,
          },
        );
      }
      const syncStatsCe = await applySyncResult(
        "coupang_eats",
        storeId,
        Array.isArray(list) ? list : [],
      );
      Object.assign(result, { sync_log_stats: syncStatsCe });
      const storeName = result.store_name;
      if (
        storeName != null &&
        typeof storeName === "string" &&
        storeName.trim() !== ""
      ) {
        const { error } = await getSupabase()
          .from("store_platform_sessions")
          .update({
            store_name: storeName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("store_id", storeId)
          .eq("platform", "coupang_eats");
        if (error) {
          console.error(
            "[applyBrowserJobResult] coupang_eats_sync session store_name update failed",
            error.message,
          );
        } else if (process.env.DEBUG_COUPANG_EATS_STORE_NAME === "1") {
          console.log(
            "[applyBrowserJobResult] coupang_eats_sync store_name updated",
            { storeId, store_name: storeName.trim() },
          );
        }
      } else if (process.env.DEBUG_COUPANG_EATS_STORE_NAME === "1") {
        console.log(
          "[applyBrowserJobResult] coupang_eats_sync no store_name in result",
          {
            storeId,
            hasStoreName: result.store_name != null,
            type: typeof result.store_name,
          },
        );
      }
      if (job.payload?.trigger === "cron") {
        await createRegisterReplyJobsForUnansweredAfterSync(
          storeId,
          "coupang_eats",
          job.user_id,
        );
      }
      break;
    }
    case "yogiyo_sync": {
      const list = (result.list ?? []) as unknown[];
      const syncStatsYo = await applySyncResult(
        "yogiyo",
        storeId,
        Array.isArray(list) ? list : [],
      );
      Object.assign(result, { sync_log_stats: syncStatsYo });
      const storeName = result.store_name;
      if (
        storeName != null &&
        typeof storeName === "string" &&
        storeName.trim() !== ""
      ) {
        const { error } = await getSupabase()
          .from("store_platform_sessions")
          .update({
            store_name: storeName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("store_id", storeId)
          .eq("platform", "yogiyo");
        if (error)
          console.error(
            "[applyBrowserJobResult] yogiyo_sync session store_name update failed",
            error.message,
          );
      }
      if (job.payload?.trigger === "cron") {
        await createRegisterReplyJobsForUnansweredAfterSync(
          storeId,
          "yogiyo",
          job.user_id,
        );
      }
      break;
    }
    case "ddangyo_sync": {
      const list = (result.list ?? []) as unknown[];
      const syncStatsDd = await applySyncResult(
        "ddangyo",
        storeId,
        Array.isArray(list) ? list : [],
      );
      Object.assign(result, { sync_log_stats: syncStatsDd });
      const storeName = result.store_name;
      if (
        storeName != null &&
        typeof storeName === "string" &&
        storeName.trim() !== ""
      ) {
        const { error } = await getSupabase()
          .from("store_platform_sessions")
          .update({
            store_name: storeName.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq("store_id", storeId)
          .eq("platform", "ddangyo");
        if (error)
          console.error(
            "[applyBrowserJobResult] ddangyo_sync session store_name update failed",
            error.message,
          );
      }
      if (job.payload?.trigger === "cron") {
        await createRegisterReplyJobsForUnansweredAfterSync(
          storeId,
          "ddangyo",
          job.user_id,
        );
      }
      break;
    }
    case "internal_auto_register_draft":
    case "auto_register_post_sync": {
      break;
    }
    case "baemin_register_reply":
    case "yogiyo_register_reply":
    case "ddangyo_register_reply":
    case "coupang_eats_register_reply":
    case "baemin_modify_reply":
    case "yogiyo_modify_reply":
    case "ddangyo_modify_reply":
    case "coupang_eats_modify_reply": {
      const fromResult =
        result.reviewId != null && typeof result.reviewId === "string"
          ? result.reviewId
          : undefined;
      const fromPayloadCamel =
        job.payload?.reviewId != null &&
        typeof job.payload.reviewId === "string"
          ? job.payload.reviewId
          : undefined;
      const fromPayloadSnake =
        job.payload?.review_id != null &&
        typeof job.payload.review_id === "string"
          ? job.payload.review_id
          : undefined;
      const reviewId = fromResult ?? fromPayloadCamel ?? fromPayloadSnake;
      const content =
        (result.content != null && String(result.content).trim() !== ""
          ? String(result.content)
          : undefined) ??
        (job.payload?.content != null &&
        String(job.payload.content).trim() !== ""
          ? String(job.payload.content)
          : undefined);
      if (reviewId && content != null) {
        const orderReviewReplyId =
          result?.orderReviewReplyId != null
            ? String(result.orderReviewReplyId)
            : undefined;
        const updatePayload: {
          platform_reply_content: string;
          platform_reply_id?: string;
        } = { platform_reply_content: content };
        if (orderReviewReplyId !== undefined)
          updatePayload.platform_reply_id = orderReviewReplyId;
        console.log("[applyBrowserJobResult] register_reply updating review", {
          reviewId,
          contentLength: content.length,
          platform_reply_id: orderReviewReplyId ?? "(none)",
        });
        const { data, error } = await getSupabase()
          .from("reviews")
          .update(updatePayload)
          .eq("id", reviewId)
          .select("id");
        if (error) {
          console.error(
            "[applyBrowserJobResult] register_reply update review failed",
            type,
            reviewId,
            error.message,
            error.code,
          );
          throw new Error(
            `reviews.platform_reply_content 갱신 실패: ${error.message}`,
          );
        }
        if (!data?.length) {
          console.error(
            "[applyBrowserJobResult] register_reply no row updated (id 불일치?)",
            reviewId,
          );
          throw new Error(
            `reviews 갱신 실패: id=${reviewId} 에 해당하는 행이 없습니다.`,
          );
        }
        console.log(
          "[applyBrowserJobResult] register_reply updated review",
          reviewId,
        );
      } else if (!reviewId) {
        console.warn(
          "[applyBrowserJobResult] register_reply skip: reviewId missing",
          type,
          {
            resultKeys: Object.keys(result ?? {}),
            payloadKeys: Object.keys(job.payload ?? {}),
          },
        );
      } else if (!content) {
        console.warn(
          "[applyBrowserJobResult] register_reply skip: content missing",
          type,
          { reviewId },
        );
      }
      break;
    }
    case "baemin_delete_reply":
    case "yogiyo_delete_reply":
    case "ddangyo_delete_reply":
    case "coupang_eats_delete_reply": {
      const fromResult =
        result.reviewId != null && typeof result.reviewId === "string"
          ? result.reviewId
          : undefined;
      const fromPayload =
        job.payload?.reviewId != null &&
        typeof job.payload.reviewId === "string"
          ? job.payload.reviewId
          : job.payload?.review_id != null &&
              typeof job.payload.review_id === "string"
            ? job.payload.review_id
            : undefined;
      const reviewId = fromResult ?? fromPayload;
      if (reviewId) {
        const { data, error } = await getSupabase()
          .from("reviews")
          .update({ platform_reply_content: null })
          .eq("id", reviewId)
          .select("id");
        if (error)
          throw new Error(
            `reviews.platform_reply_content 삭제 반영 실패: ${error.message}`,
          );
        if (!data?.length)
          throw new Error(
            `reviews 갱신 실패: id=${reviewId} 에 해당하는 행이 없습니다.`,
          );
      }
      break;
    }
    default:
      throw new Error(`Unknown job type: ${type}`);
  }
}
