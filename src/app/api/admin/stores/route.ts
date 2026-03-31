import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";
import type { AdminStoreListData, AdminStoreSummaryRow } from "@/entities/admin/types";
import { getAdminWorkStatusErrorWindowStartIso } from "@/lib/config/admin-work-status-error-window";

const PLATFORMS = ["baemin", "coupang_eats", "yogiyo", "ddangyo"] as const;

/** GET: 어드민 고객별 매장 목록 (요약) */
async function getHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<AdminStoreListData>>> {
  const { user } = await getUser(request);
  const supabase = createServiceRoleClient();

  const { data: me } = await supabase
    .from("users")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle();

  if (!me?.is_admin) {
    throw new AppForbiddenError({
      code: "ADMIN_REQUIRED",
      message: "관리자 권한이 필요합니다.",
    });
  }

  const { searchParams } = request.nextUrl;
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);
  const keyword = (searchParams.get("keyword") ?? "").trim();
  const errorsOnly = searchParams.get("errorsOnly") === "true";
  const dateFrom = searchParams.get("dateFrom") ?? ""; // YYYY-MM-DD
  const dateTo = searchParams.get("dateTo") ?? "";
  const registrationMethod = (searchParams.get("registrationMethod") ?? "all") as "all" | "direct" | "auto";

  // 1) 매장이 있는 user_id 목록 (키워드: 이메일 또는 매장 이름)
  let usersWithStoresQuery = supabase
    .from("stores")
    .select("user_id");

  if (keyword) {
    const { data: userIdsByEmail } = await supabase
      .from("users")
      .select("id")
      .ilike("email", `%${keyword}%`);
    const idsFromEmail = (userIdsByEmail ?? []).map((r) => r.id as string);
    const { data: storesByName } = await supabase
      .from("stores")
      .select("user_id")
      .ilike("name", `%${keyword}%`);
    const idsFromStore = (storesByName ?? []).map((r) => r.user_id as string);
    const allIds = [...new Set([...idsFromEmail, ...idsFromStore])];
    if (allIds.length === 0) {
      return NextResponse.json({
        result: { list: [], count: 0, totalErrorCount: 0 },
      });
    }
    usersWithStoresQuery = usersWithStoresQuery.in("user_id", allIds);
  }

  const { data: storesRows } = await usersWithStoresQuery;
  let candidateUserIds = [...new Set((storesRows ?? []).map((r) => r.user_id as string))];

  // 2) 기간 필터: 리뷰 날짜(reviews.written_at) — 해당 기간 내 리뷰가 있는 store 소유 user만
  if (dateFrom || dateTo) {
    const storeIdsForCandidates = await (async () => {
      const { data: storesForCandidates } = await supabase
        .from("stores")
        .select("id, user_id")
        .in("user_id", candidateUserIds);
      return (storesForCandidates ?? []).map((s) => s.id as string);
    })();
    if (storeIdsForCandidates.length === 0) {
      candidateUserIds = [];
    } else {
      let reviewQuery = supabase
        .from("reviews")
        .select("store_id")
        .in("store_id", storeIdsForCandidates)
        .not("written_at", "is", null);
      if (dateFrom) {
        reviewQuery = reviewQuery.gte("written_at", `${dateFrom}T00:00:00.000Z`);
      }
      if (dateTo) {
        reviewQuery = reviewQuery.lte("written_at", `${dateTo}T23:59:59.999Z`);
      }
      const { data: reviewsInRange } = await reviewQuery;
      const storeIdsInRange = new Set(
        (reviewsInRange ?? []).map((r) => r.store_id as string),
      );
      const { data: storesWithReviews } = await supabase
        .from("stores")
        .select("user_id")
        .in("id", [...storeIdsInRange]);
      const userIdsInRange = new Set(
        (storesWithReviews ?? []).map((r) => r.user_id as string),
      );
      candidateUserIds = candidateUserIds.filter((id) => userIdsInRange.has(id));
    }
  }

  // 3) 등록방법 필터: tone_settings 기준 수동/자동
  if (candidateUserIds.length > 0 && registrationMethod !== "all") {
    const { data: storesForCandidates } = await supabase
      .from("stores")
      .select("id, user_id")
      .in("user_id", candidateUserIds);
    const storeIdsForTone = (storesForCandidates ?? []).map((s) => s.id as string);
    const storeToUserId = new Map<string, string>();
    for (const s of storesForCandidates ?? []) {
      storeToUserId.set(s.id as string, s.user_id as string);
    }
    const storesByUserIdFilter = new Map<string, { id: string }[]>();
    for (const s of storesForCandidates ?? []) {
      const uid = s.user_id as string;
      if (!storesByUserIdFilter.has(uid)) storesByUserIdFilter.set(uid, []);
      storesByUserIdFilter.get(uid)!.push({ id: s.id as string });
    }
    const { data: toneRows } = await supabase
      .from("tone_settings")
      .select("store_id, comment_register_mode, auto_register_scheduled_hour")
      .in("store_id", storeIdsForTone);
    const storeIdToTone = new Map<string, { mode: string; hour: number | null }>();
    for (const t of toneRows ?? []) {
      storeIdToTone.set(t.store_id as string, {
        mode: (t.comment_register_mode as string) ?? "direct",
        hour: t.auto_register_scheduled_hour as number | null,
      });
    }
    const isAutoByUserId = new Set<string>();
    for (const uid of candidateUserIds) {
      const userStores = storesByUserIdFilter.get(uid) ?? [];
      const firstStoreId = userStores[0]?.id;
      const tone = firstStoreId ? storeIdToTone.get(firstStoreId) : null;
      const isAuto = Boolean(tone?.mode === "auto" && tone?.hour != null);
      if (isAuto) isAutoByUserId.add(uid);
    }
    if (registrationMethod === "direct") {
      candidateUserIds = candidateUserIds.filter((id) => !isAutoByUserId.has(id));
    } else {
      candidateUserIds = candidateUserIds.filter((id) => isAutoByUserId.has(id));
    }
  }

  const distinctUserIds = candidateUserIds;
  const totalCount = distinctUserIds.length;

  const paginatedUserIds = distinctUserIds.slice(offset, offset + limit);
  if (paginatedUserIds.length === 0) {
    return NextResponse.json({
      result: { list: [], count: totalCount, totalErrorCount: 0 },
    });
  }

  // 2) 사용자 이메일
  const { data: userRows } = await supabase
    .from("users")
    .select("id, email")
    .in("id", paginatedUserIds);
  const emailByUserId = new Map<string, string | null>();
  for (const r of userRows ?? []) {
    emailByUserId.set(r.id as string, (r.email as string) ?? null);
  }

  // 3) 해당 유저들의 stores
  const { data: stores } = await supabase
    .from("stores")
    .select("id, user_id, name")
    .in("user_id", paginatedUserIds);
  const storeIds = (stores ?? []).map((s) => s.id as string);
  const storesByUserId = new Map<string, { id: string; name: string }[]>();
  const storeDisplayNameByStoreId = new Map<string, string>();
  for (const s of stores ?? []) {
    const uid = s.user_id as string;
    if (!storesByUserId.has(uid)) storesByUserId.set(uid, []);
    storesByUserId.get(uid)!.push({ id: s.id as string, name: (s.name as string) ?? "" });
    storeDisplayNameByStoreId.set(s.id as string, (s.name as string) ?? "");
  }

  // 4) tone_settings (첫 매장 기준 등록방법)
  const registerMethodByUserId = new Map<string, string>();
  if (storeIds.length > 0) {
    const { data: toneRows } = await supabase
      .from("tone_settings")
      .select("store_id, comment_register_mode, auto_register_scheduled_hour")
      .in("store_id", storeIds);
    const storeIdToTone = new Map<string, { mode: string; hour: number | null }>();
    for (const t of toneRows ?? []) {
      storeIdToTone.set(t.store_id as string, {
        mode: (t.comment_register_mode as string) ?? "direct",
        hour: t.auto_register_scheduled_hour as number | null,
      });
    }
    for (const uid of paginatedUserIds) {
      const userStores = storesByUserId.get(uid) ?? [];
      const firstStoreId = userStores[0]?.id;
      const tone = firstStoreId ? storeIdToTone.get(firstStoreId) : null;
      if (tone?.mode === "auto" && tone.hour != null) {
        registerMethodByUserId.set(uid, `자동 | ${tone.hour}시`);
      } else {
        registerMethodByUserId.set(uid, "수동");
      }
    }
  }
  for (const uid of paginatedUserIds) {
    if (!registerMethodByUserId.has(uid)) registerMethodByUserId.set(uid, "수동");
  }

  // 5) 플랫폼별 세션 수 (store_platform_sessions) + 최초 연동 시각·상호
  const { data: sessions } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform, store_name, created_at")
    .in("store_id", storeIds);
  const platformCountByUserId = new Map<string, { baemin: number; coupang: number; yogiyo: number; ddangyo: number }>();
  for (const uid of paginatedUserIds) {
    platformCountByUserId.set(uid, { baemin: 0, coupang: 0, yogiyo: 0, ddangyo: 0 });
  }
  const storeToUserId = new Map<string, string>();
  for (const s of stores ?? []) {
    storeToUserId.set(s.id as string, s.user_id as string);
  }
  for (const row of sessions ?? []) {
    const uid = storeToUserId.get(row.store_id as string);
    if (!uid) continue;
    const p = (row.platform as string)?.toLowerCase();
    const cur = platformCountByUserId.get(uid)!;
    if (p === "baemin") cur.baemin++;
    else if (p === "coupang_eats") cur.coupang++;
    else if (p === "yogiyo") cur.yogiyo++;
    else if (p === "ddangyo") cur.ddangyo++;
  }

  // 6) 등록한 댓글 수 (reviews.platform_reply_content not null)
  const { data: reviewCountRows } = await supabase
    .from("reviews")
    .select("store_id")
    .not("platform_reply_content", "is", null)
    .in("store_id", storeIds);
  const registeredCountByStoreId = new Map<string, number>();
  for (const r of reviewCountRows ?? []) {
    const sid = r.store_id as string;
    registeredCountByStoreId.set(sid, (registeredCountByStoreId.get(sid) ?? 0) + 1);
  }
  const registeredReplyByUserId = new Map<string, number>();
  for (const uid of paginatedUserIds) {
    const userStores = storesByUserId.get(uid) ?? [];
    let sum = 0;
    for (const st of userStores) {
      sum += registeredCountByStoreId.get(st.id) ?? 0;
    }
    registeredReplyByUserId.set(uid, sum);
  }

  // 7) 최근 24시간 failed job 수 (작업 상태 오류 표시)
  const failedSince = getAdminWorkStatusErrorWindowStartIso();
  const { data: failedJobs } = await supabase
    .from("browser_jobs")
    .select("store_id")
    .eq("status", "failed")
    .gte("created_at", failedSince)
    .in("store_id", storeIds);
  const errorCountByUserId = new Map<string, number>();
  for (const uid of paginatedUserIds) {
    errorCountByUserId.set(uid, 0);
  }
  for (const j of failedJobs ?? []) {
    const uid = storeToUserId.get(j.store_id as string);
    if (uid) errorCountByUserId.set(uid, (errorCountByUserId.get(uid) ?? 0) + 1);
  }

  const totalErrorCount = Array.from(errorCountByUserId.values()).reduce((a, b) => a + b, 0);

  const previewStoreNameForUser = (uid: string): string | null => {
    const userSessions = (sessions ?? []).filter(
      (row) => storeToUserId.get(row.store_id as string) === uid,
    );
    if (userSessions.length === 0) {
      const userStores = storesByUserId.get(uid) ?? [];
      const withName = userStores.find((s) => (s.name ?? "").trim().length > 0);
      return withName?.name.trim() ?? null;
    }
    userSessions.sort((a, b) => {
      const ta = new Date(String(a.created_at)).getTime();
      const tb = new Date(String(b.created_at)).getTime();
      if (ta !== tb) return ta - tb;
      return String(a.store_id).localeCompare(String(b.store_id));
    });
    const first = userSessions[0];
    const sid = first.store_id as string;
    const fromSession = (first.store_name as string | null)?.trim() ?? "";
    if (fromSession.length > 0) return fromSession;
    const fromStore = (storeDisplayNameByStoreId.get(sid) ?? "").trim();
    return fromStore.length > 0 ? fromStore : null;
  };

  const list: AdminStoreSummaryRow[] = [];
  for (const uid of paginatedUserIds) {
    const errorCount = errorCountByUserId.get(uid) ?? 0;
    if (errorsOnly && errorCount === 0) continue;

    const pc = platformCountByUserId.get(uid)!;
    list.push({
      userId: uid,
      previewStoreName: previewStoreNameForUser(uid),
      email: emailByUserId.get(uid) ?? null,
      registerMethod: registerMethodByUserId.get(uid) ?? "수동",
      registeredReplyCount: registeredReplyByUserId.get(uid) ?? 0,
      baeminCount: pc.baemin,
      coupangCount: pc.coupang,
      yogiyoCount: pc.yogiyo,
      ddangyoCount: pc.ddangyo,
      hasError: errorCount > 0,
      errorCount,
    });
  }

  // errorsOnly 시 list 길이가 줄어들 수 있음. count는 필터 전 total.
  return NextResponse.json({
    result: {
      list,
      count: totalCount,
      totalErrorCount,
    },
  });
}

export const GET = withRouteHandler(getHandler);
