import { NextRequest, NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import { AppForbiddenError } from "@/lib/errors/app-error";
import type {
  AdminRealtimeJobListData,
  AdminRealtimeJobRow,
} from "@/entities/admin/types";

const PLATFORM_LABEL: Record<string, string> = {
  baemin: "배민",
  coupang_eats: "쿠팡이츠",
  yogiyo: "요기요",
  ddangyo: "땡겨요",
};

function typeToPlatformKey(type: string): string | null {
  if (type.startsWith("baemin_")) return "baemin";
  if (type.startsWith("coupang_eats_")) return "coupang_eats";
  if (type.startsWith("yogiyo_")) return "yogiyo";
  if (type.startsWith("ddangyo_")) return "ddangyo";
  return null;
}

function clampPercent(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  if (v < 0) return 0;
  if (v > 100) return 100;
  return Math.floor(v);
}

function toMinutes(v: unknown): number | null {
  if (typeof v !== "number" || !Number.isFinite(v) || v < 0) return null;
  return Math.ceil(v / 60_000);
}

async function getHandler(
  request: NextRequest,
): Promise<NextResponse<AppRouteHandlerResponse<AdminRealtimeJobListData>>> {
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

  const limit = Math.min(
    Math.max(Number(request.nextUrl.searchParams.get("limit")) || 100, 1),
    300,
  );

  const { data: jobs, error } = await supabase
    .from("browser_jobs")
    .select(
      "id, type, status, store_id, user_id, result_summary, created_at, updated_at",
    )
    .in("status", ["pending", "processing"])
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) throw error;

  const storeIds = [
    ...new Set(
      (jobs ?? [])
        .map((j) => (typeof j.store_id === "string" ? j.store_id : null))
        .filter((v): v is string => v != null),
    ),
  ];
  const userIds = [
    ...new Set(
      (jobs ?? [])
        .map((j) => (typeof j.user_id === "string" ? j.user_id : null))
        .filter((v): v is string => v != null),
    ),
  ];

  const storeNameById = new Map<string, string | null>();
  if (storeIds.length > 0) {
    const { data: storeRows } = await supabase
      .from("stores")
      .select("id, name")
      .in("id", storeIds);
    for (const row of storeRows ?? []) {
      storeNameById.set(
        row.id as string,
        typeof row.name === "string" && row.name.trim() ? row.name.trim() : null,
      );
    }
  }

  const emailByUserId = new Map<string, string | null>();
  if (userIds.length > 0) {
    const { data: userRows } = await supabase
      .from("users")
      .select("id, email")
      .in("id", userIds);
    for (const row of userRows ?? []) {
      emailByUserId.set(
        row.id as string,
        typeof row.email === "string" && row.email.trim()
          ? row.email.trim()
          : null,
      );
    }
  }

  const list: AdminRealtimeJobRow[] = (jobs ?? []).map((j) => {
    const type = String(j.type ?? "");
    const platform = typeToPlatformKey(type);
    const summary =
      j.result_summary && typeof j.result_summary === "object"
        ? (j.result_summary as Record<string, unknown>)
        : null;
    const progress =
      summary?.progress &&
      typeof summary.progress === "object" &&
      !Array.isArray(summary.progress)
        ? (summary.progress as Record<string, unknown>)
        : null;

    const progressPercent = clampPercent(progress?.percent);
    const remainingMinutes = toMinutes(progress?.estimated_remaining_ms);
    const elapsedMinutes = toMinutes(progress?.elapsed_ms);

    return {
      id: String(j.id),
      type,
      status: j.status as AdminRealtimeJobRow["status"],
      platform,
      platformLabel: platform ? (PLATFORM_LABEL[platform] ?? platform) : null,
      storeId: typeof j.store_id === "string" ? j.store_id : null,
      storeName:
        typeof j.store_id === "string" ? (storeNameById.get(j.store_id) ?? null) : null,
      userEmail:
        typeof j.user_id === "string" ? (emailByUserId.get(j.user_id) ?? null) : null,
      phase: typeof summary?.phase === "string" ? summary.phase : null,
      progressPercent,
      remainingMinutes,
      elapsedMinutes,
      createdAt: String(j.created_at),
      updatedAt: String(j.updated_at),
    };
  });

  return NextResponse.json({ result: { list, count: list.length } });
}

export const GET = withRouteHandler(getHandler);
