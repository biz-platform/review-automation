import { createServiceRoleClient } from "@/lib/db/supabase-server";

export type StaleBillingPendingRow = {
  userId: string;
  pendingPlanKey: string;
  effectiveAtIso: string;
};

function isPgUndefinedColumn(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "42703"
  );
}

/**
 * `billing_pending_plan_effective_at` 가 지났는데 예약 행이 그대로 남은 계정(다운그레이드 미적용 후보).
 * PG·배치가 없을 때 관측용 — 자동으로 플랜을 바꾸지 않는다.
 */
export async function listStaleBillingPendingDowngrades(params: {
  now?: Date;
  /** 응답에 담을 샘플 상한 */
  sampleLimit?: number;
}): Promise<{ totalStale: number; sample: StaleBillingPendingRow[] }> {
  const now = params.now ?? new Date();
  const sampleLimit = Math.min(Math.max(params.sampleLimit ?? 40, 1), 200);
  const admin = createServiceRoleClient();
  const { data, error } = await admin
    .from("users")
    .select("id, billing_pending_plan_key, billing_pending_plan_effective_at")
    .not("billing_pending_plan_key", "is", null);

  if (error) {
    if (isPgUndefinedColumn(error)) {
      return { totalStale: 0, sample: [] };
    }
    throw error;
  }

  const rows = (data ?? []) as {
    id: string;
    billing_pending_plan_key?: string | null;
    billing_pending_plan_effective_at?: string | null;
  }[];

  const stale = rows.filter((r) => {
    const at = r.billing_pending_plan_effective_at;
    if (at == null || String(at).trim() === "") return false;
    return new Date(String(at)).getTime() < now.getTime();
  });

  const mapped: StaleBillingPendingRow[] = stale.map((r) => ({
    userId: r.id,
    pendingPlanKey: String(r.billing_pending_plan_key ?? ""),
    effectiveAtIso: String(r.billing_pending_plan_effective_at ?? ""),
  }));

  return {
    totalStale: mapped.length,
    sample: mapped.slice(0, sampleLimit),
  };
}
