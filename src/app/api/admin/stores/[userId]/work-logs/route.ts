import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import {
  withRouteHandler,
  type RouteContext,
} from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError, AppNotFoundError } from "@/lib/errors/app-error";
import type {
  AdminWorkLogListData,
  AdminWorkLogRow,
} from "@/entities/admin/types";

const CATEGORY_MAP: Record<string, { category: AdminWorkLogRow["category"]; label: string }> = {
  sync: { category: "sync", label: "동기화" },
  register_reply: { category: "register_reply", label: "답글 등록" },
  link: { category: "link", label: "연동" },
  modify_delete: { category: "modify_delete", label: "수정·삭제" },
  other: { category: "other", label: "기타" },
};

function typeToCategory(type: string): { category: AdminWorkLogRow["category"]; label: string } {
  if (type.endsWith("_sync")) return CATEGORY_MAP.sync;
  if (type.endsWith("_register_reply")) return CATEGORY_MAP.register_reply;
  if (type.endsWith("_link")) return CATEGORY_MAP.link;
  if (type.endsWith("_modify_reply") || type.endsWith("_delete_reply"))
    return CATEGORY_MAP.modify_delete;
  if (type === "internal_auto_register_draft")
    return { ...CATEGORY_MAP.other, label: "자동 답글 초안" };
  return CATEGORY_MAP.other;
}

/** 답글 등록: payload.trigger === "cron" → 자동, 그 외 → 수동 */
function getRegisterReplyLabel(payload: unknown): string {
  const trigger =
    payload && typeof payload === "object" && "trigger" in payload
      ? (payload as { trigger?: string }).trigger
      : undefined;
  return trigger === "cron" ? "답글 등록 (자동)" : "답글 등록 (수동)";
}

function buildMessage(
  type: string,
  status: string,
  errorMessage: string | null,
  result: unknown,
): string {
  if (status === "failed") {
    if (errorMessage?.trim()) return errorMessage;
    if (type.endsWith("_register_reply")) return "답글 등록에 실패했어요. 로그인 상태를 확인해주세요.";
    if (type.endsWith("_sync")) return "리뷰 동기화에 실패했어요.";
    if (type.endsWith("_link")) return "연동에 실패했어요.";
    return "작업에 실패했어요.";
  }
  if (status === "completed") {
    if (result && typeof result === "object" && "message" in result && typeof (result as { message: unknown }).message === "string")
      return (result as { message: string }).message;
    if (type.endsWith("_sync")) return "리뷰를 불러왔어요.";
    if (type.endsWith("_register_reply")) return "답글 등록을 완료했어요.";
    if (type.endsWith("_link")) return "연동을 완료했어요.";
    return "작업을 완료했어요.";
  }
  return status === "processing" ? "처리 중…" : "대기 중";
}

/** GET: 어드민 매장 상세 - 작업 로그 목록 (browser_jobs 기반) */
async function getHandler(
  request: NextRequest,
  context?: RouteContext,
): Promise<NextResponse<AppRouteHandlerResponse<AdminWorkLogListData>>> {
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
  const userId = (resolved as { userId?: string }).userId;
  if (!userId) {
    throw new AppNotFoundError({
      code: "NOT_FOUND",
      message: "고객을 찾을 수 없습니다.",
    });
  }

  const { searchParams } = request.nextUrl;
  const storeId = searchParams.get("storeId") ?? undefined;
  const platform = searchParams.get("platform") ?? undefined;
  const dateFrom = searchParams.get("dateFrom") ?? undefined;
  const dateTo = searchParams.get("dateTo") ?? undefined;
  const category = searchParams.get("category") ?? undefined;
  const statusFilter = (searchParams.get("status") ?? "all") as "all" | "completed" | "failed";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 20, 1), 100);
  const offset = Math.max(Number(searchParams.get("offset")) || 0, 0);

  const { data: stores } = await supabase
    .from("stores")
    .select("id")
    .eq("user_id", userId);
  const storeIds = (stores ?? []).map((s) => s.id as string);
  if (storeIds.length === 0) {
    return NextResponse.json({
      result: { list: [], count: 0 },
    });
  }

  let query = supabase
    .from("browser_jobs")
    .select("id, type, store_id, user_id, status, error_message, result, payload, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (storeId && storeIds.includes(storeId)) {
    query = query.eq("store_id", storeId);
  } else {
    query = query.or(`store_id.in.(${storeIds.join(",")}),store_id.is.null`);
  }

  if (dateFrom) {
    query = query.gte("created_at", `${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo) {
    query = query.lte("created_at", `${dateTo}T23:59:59.999Z`);
  }

  const { data: jobs, error } = await query;
  if (error) {
    console.error("admin work-logs query error", error);
    return NextResponse.json({
      result: { list: [], count: 0 },
    });
  }

  const rows: AdminWorkLogRow[] = (jobs ?? []).map((j) => {
    const type = (j.type as string) ?? "";
    const { category: cat, label: baseLabel } = typeToCategory(type);
    const categoryLabel =
      cat === "register_reply" ? getRegisterReplyLabel(j.payload) : baseLabel;
    const status = (j.status as AdminWorkLogRow["status"]) ?? "pending";
    const message = buildMessage(
      type,
      status,
      (j.error_message as string) ?? null,
      j.result,
    );
    return {
      id: j.id as string,
      type,
      category: cat,
      categoryLabel,
      status,
      message,
      storeId: (j.store_id as string) ?? null,
      platform: (j.payload && typeof j.payload === "object" && "platform" in j.payload && typeof (j.payload as { platform: unknown }).platform === "string")
        ? (j.payload as { platform: string }).platform
        : null,
      createdAt: (j.created_at as string) ?? new Date().toISOString(),
    };
  });

  let filtered = rows;
  if (platform) {
    const p = platform.toLowerCase();
    filtered = filtered.filter(
      (r) =>
        (r.platform && r.platform.toLowerCase() === p) ||
        (r.type && r.type.toLowerCase().startsWith(`${p}_`)),
    );
  }
  if (category) {
    filtered = filtered.filter((r) => r.category === category);
  }
  if (statusFilter === "completed") {
    filtered = filtered.filter((r) => r.status === "completed");
  } else if (statusFilter === "failed") {
    filtered = filtered.filter((r) => r.status === "failed");
  }

  const count = filtered.length;
  const list = filtered.slice(offset, offset + limit);

  return NextResponse.json({
    result: { list, count },
  });
}

export const GET = withRouteHandler(getHandler);
