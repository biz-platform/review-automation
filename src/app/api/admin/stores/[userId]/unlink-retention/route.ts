import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type {
  AdminUnlinkRetentionListData,
  AdminUnlinkRetentionRow,
} from "@/entities/admin/types";
import { AppForbiddenError, AppNotFoundError } from "@/lib/errors/app-error";

/** GET: 고객(userId) 소유 매장의 연동 해제 리뷰 스냅샷 (어드민 전용) */
async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<AdminUnlinkRetentionListData>>> {
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

  const resolved = await (context?.params ?? Promise.resolve({}));
  const targetUserId = (resolved as { userId?: string }).userId;
  if (!targetUserId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("id")
    .eq("id", targetUserId)
    .maybeSingle();
  if (!userRow) {
    throw new AppNotFoundError({
      code: "USER_NOT_FOUND",
      message: "해당 고객을 찾을 수 없습니다.",
    });
  }

  const { data: stores } = await supabase
    .from("stores")
    .select("id, name")
    .eq("user_id", targetUserId);

  const storeIds = (stores ?? []).map((s) => s.id as string);
  const nameByStoreId = new Map(
    (stores ?? []).map((s) => [s.id as string, (s.name as string) ?? null]),
  );

  if (storeIds.length === 0) {
    return NextResponse.json({
      result: { list: [], count: 0 },
    });
  }

  const { searchParams } = request.nextUrl;
  const storeIdFilter = searchParams.get("storeId") ?? undefined;
  const platform = searchParams.get("platform") ?? undefined;
  const includeExpired =
    searchParams.get("includeExpired") === "true" ||
    searchParams.get("includeExpired") === "1";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 200);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  let effectiveStoreIds = storeIds;
  if (storeIdFilter) {
    if (!storeIds.includes(storeIdFilter)) {
      return NextResponse.json({
        result: { list: [], count: 0 },
      });
    }
    effectiveStoreIds = [storeIdFilter];
  }

  let q = supabase
    .from("reviews_unlink_retention")
    .select("*", { count: "exact" })
    .in("store_id", effectiveStoreIds)
    .order("unlinked_at", { ascending: false });

  if (!includeExpired) {
    q = q.gt("retain_until", new Date().toISOString());
  }
  if (platform) {
    q = q.eq("platform", platform);
  }

  q = q.range(offset, offset + limit - 1);

  const { data: rows, error, count } = await q;
  if (error) throw error;

  const list: AdminUnlinkRetentionRow[] = (rows ?? []).map((r) => {
    const row = r as Record<string, unknown>;
    const sk = row.source_kind;
    const sourceKind = sk === "archive" ? "archive" : "active";
    const sid = row.store_id as string;
    return {
      id: row.id as string,
      sourceReviewId: String(row.source_review_id),
      sourceKind,
      storeId: sid,
      storeName: nameByStoreId.get(sid) ?? null,
      platform: String(row.platform),
      externalId: (row.external_id as string) ?? null,
      rating: (row.rating as number) ?? null,
      content: (row.content as string) ?? null,
      authorName: (row.author_name as string) ?? null,
      writtenAt: row.written_at != null ? (row.written_at as string) : null,
      platformReplyContent: (row.platform_reply_content as string) ?? null,
      platformReplyId: (row.platform_reply_id as string) ?? null,
      unlinkedAt: String(row.unlinked_at ?? ""),
      retainUntil: String(row.retain_until ?? ""),
      replyDraftSnapshot: row.reply_draft_snapshot ?? null,
      archivedAt: row.archived_at != null ? (row.archived_at as string) : null,
    };
  });

  return NextResponse.json({
    result: { list, count: count ?? list.length },
  });
}

export const GET = withRouteHandler(getHandler);
