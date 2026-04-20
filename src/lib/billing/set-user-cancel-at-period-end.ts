import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { AppBadRequestError } from "@/lib/errors/app-error";

/**
 * 유료 구독(member / planner)만 `cancel_at_period_end` 변경.
 * RLS로 클라이언트 UPDATE가 막혀 있어 service role로 갱신한다.
 */
export async function setUserCancelAtPeriodEnd(
  userId: string,
  value: boolean,
): Promise<void> {
  const admin = createServiceRoleClient();
  const { data: row, error } = await admin
    .from("users")
    .select("is_admin, role, paid_until, cancel_at_period_end")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) {
    throw new AppBadRequestError({
      code: "PROFILE_NOT_FOUND",
      message: "사용자 정보를 찾을 수 없습니다.",
    });
  }
  if (row.is_admin === true) {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_ACTION_NOT_APPLICABLE",
      message: "이 계정은 구독 해지 신청 대상이 아닙니다.",
    });
  }
  const role = row.role as string;
  if (role === "center_manager") {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_ACTION_NOT_APPLICABLE",
      message: "이용 중인 요금제가 없습니다.",
    });
  }
  if (role !== "member" && role !== "planner") {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_ACTION_NOT_APPLICABLE",
      message: "이용 중인 요금제가 없습니다.",
    });
  }
  const paidUntil =
    row.paid_until != null && String(row.paid_until).trim() !== ""
      ? new Date(String(row.paid_until))
      : null;
  const now = new Date();
  const paidActive =
    paidUntil != null && paidUntil.getTime() >= now.getTime();
  if (!paidActive) {
    throw new AppBadRequestError({
      code: "SUBSCRIPTION_NOT_ACTIVE",
      message: "유료 구독이 활성 상태가 아닙니다.",
      detail: "만료된 구독에서는 해지 예약을 변경할 수 없습니다.",
    });
  }

  const currentCancel =
    (row as { cancel_at_period_end?: boolean }).cancel_at_period_end === true;
  if (value === currentCancel) {
    return;
  }

  const { error: uErr } = await admin
    .from("users")
    .update({ cancel_at_period_end: value })
    .eq("id", userId);
  if (uErr) throw uErr;
}
