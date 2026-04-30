import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { AppRouteHandlerResponse } from "@/lib/types/api/response";
import type {
  AdminBillingPendingStaleListData,
  AdminBillingPendingStaleRow,
} from "@/entities/admin/types";
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { AppForbiddenError } from "@/lib/errors/app-error";
import { listStaleBillingPendingDowngrades } from "@/lib/billing/stale-billing-pending-downgrades";

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
});

async function getHandler(request: NextRequest) {
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
  const { limit } = querySchema.parse({
    limit: searchParams.get("limit") ?? undefined,
  });

  const now = new Date();
  const { totalStale, sample } = await listStaleBillingPendingDowngrades({
    now,
    sampleLimit: limit,
  });

  const truncated = totalStale > sample.length;
  const ids = sample.map((s) => s.userId);

  const profileById = new Map<
    string,
    { email: string | null; phone: string | null }
  >();

  if (ids.length > 0) {
    const { data: profiles, error: profErr } = await supabase
      .from("users")
      .select("id, email, phone")
      .in("id", ids);
    if (profErr) throw profErr;
    for (const p of profiles ?? []) {
      const row = p as { id: string; email?: string | null; phone?: string | null };
      profileById.set(row.id, {
        email: row.email != null ? String(row.email) : null,
        phone: row.phone != null ? String(row.phone) : null,
      });
    }
  }

  const list: AdminBillingPendingStaleRow[] = sample.map((s) => {
    const prof = profileById.get(s.userId);
    return {
      userId: s.userId,
      email: prof?.email ?? null,
      phone: prof?.phone ?? null,
      pendingPlanKey: s.pendingPlanKey,
      effectiveAtIso: s.effectiveAtIso,
    };
  });

  const result: AdminBillingPendingStaleListData = {
    checkedAt: now.toISOString(),
    totalStale,
    list,
    truncated,
  };

  return NextResponse.json<AppRouteHandlerResponse<typeof result>>({
    result,
  });
}

export const GET = withRouteHandler(getHandler);
