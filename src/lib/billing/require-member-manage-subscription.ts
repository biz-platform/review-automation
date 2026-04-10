import type { SupabaseClient } from "@supabase/supabase-js";
import { AppForbiddenError } from "@/lib/errors/app-error";
import { memberHasManageServiceAccess } from "@/lib/billing/member-subscription-access";

/**
 * 일반 회원·플래너 등: 유료 구독 또는 무료·체험 기간이 아니면 403.
 * `users.is_admin` 이면 통과.
 */
export async function requireMemberManageSubscriptionAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<void> {
  const { data, error } = await supabase
    .from("users")
    .select("role, paid_until, created_at, is_admin")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new AppForbiddenError({
      code: "PROFILE_NOT_FOUND",
      message: "사용자 정보를 찾을 수 없습니다.",
    });
  }

  if (data.is_admin === true) return;

  const role = data.role as string;
  const createdAt = new Date(String(data.created_at));
  const paidUntil =
    data.paid_until != null && String(data.paid_until).trim() !== ""
      ? new Date(String(data.paid_until))
      : null;

  if (
    memberHasManageServiceAccess({
      role,
      createdAt,
      paidUntil,
    })
  ) {
    return;
  }

  throw new AppForbiddenError({
    code: "SUBSCRIPTION_REQUIRED",
    message: "이용 가능 기간이 만료되었습니다. 결제 안내를 확인해 주세요.",
    detail: "유료 구독 또는 무료·체험 기간이 필요합니다.",
  });
}
