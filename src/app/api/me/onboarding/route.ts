import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { StoreService } from "@/lib/services/store-service";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import {
  computeMemberFreeAccessEndsAt,
  memberHasManageServiceAccess,
} from "@/lib/billing/member-subscription-access";
import { buildMemberSubscriptionUsagePayload } from "@/lib/billing/member-usage-overview";
import type { MeSubscriptionUsageData } from "@/lib/api/me-api";

const storeService = new StoreService();

type OnboardingProfileRow = {
  is_admin?: boolean | null;
  role?: string | null;
  created_at?: string | null;
  paid_at?: string | null;
  paid_until?: string | null;
  cancel_at_period_end?: boolean | null;
};

export type OnboardingResult = {
  hasStores: boolean;
  /** 연동된 매장 1개 이상 여부. 0개면 신규 유저 취급하여 리뷰 관리·구매 및 청구 접근 차단 */
  hasLinkedStores: boolean;
  aiSettingsCompleted: boolean;
  /** 어드민은 구독 가드 제외 */
  isAdmin: boolean;
  role: "member" | "center_manager" | "planner";
  subscription: {
    /** 일반 회원만: 유료·무료기간 만료 시 true → 결제 안내 페이지로 유도 */
    paymentRequired: boolean;
    /** 일반 회원 무료(프로모+가입 1개월) 종료 시각 ISO */
    freeAccessEndsAt: string;
    /** 이용 현황 카드용 (A-1 ~ A-6) */
    usage: MeSubscriptionUsageData;
  };
};

/** GET: 매장 연동 여부 및 AI 댓글 설정 완료 여부. 온보딩/가드용 */
async function getHandler(request: NextRequest) {
  const { user, supabase: authSupabase } = await getUser(request);

  const profileQuery = await authSupabase
    .from("users")
    .select(
      "is_admin, role, created_at, paid_at, paid_until, cancel_at_period_end",
    )
    .eq("id", user.id)
    .maybeSingle();

  let profile = profileQuery.data as OnboardingProfileRow | null;
  let profileError = profileQuery.error;

  /** 로컬/스테이징에 `075_users_cancel_at_period_end` 미적용 시 컬럼 없음 → 폴백 */
  const missingCancelColumn =
    profileError != null &&
    typeof profileError === "object" &&
    "code" in profileError &&
    (profileError as { code?: string }).code === "42703" &&
    String((profileError as { message?: string }).message).includes(
      "cancel_at_period_end",
    );

  let cancelAtPeriodEnd = false;
  if (missingCancelColumn) {
    const retry = await authSupabase
      .from("users")
      .select("is_admin, role, created_at, paid_at, paid_until")
      .eq("id", user.id)
      .maybeSingle();
    if (retry.error) throw retry.error;
    profile = retry.data as OnboardingProfileRow | null;
    profileError = null;
    cancelAtPeriodEnd = false;
  } else if (profileError) {
    throw profileError;
  } else {
    cancelAtPeriodEnd = profile?.cancel_at_period_end === true;
  }

  const isAdmin = profile?.is_admin === true;
  const role =
    profile?.role === "center_manager" || profile?.role === "planner"
      ? profile.role
      : "member";
  const createdAt = profile?.created_at
    ? new Date(profile.created_at as string)
    : new Date(0);
  const paidUntil =
    profile?.paid_until != null && String(profile.paid_until).trim() !== ""
      ? new Date(profile.paid_until as string)
      : null;
  const paidAt =
    profile?.paid_at != null && String(profile.paid_at).trim() !== ""
      ? new Date(profile.paid_at as string)
      : null;
  const freeAccessEndsAt = computeMemberFreeAccessEndsAt(createdAt);
  const usage = buildMemberSubscriptionUsagePayload({
    role,
    isAdmin,
    createdAt,
    paidAt,
    paidUntil,
    cancelAtPeriodEnd,
  });
  const paymentRequired =
    !isAdmin &&
    role === "member" &&
    !memberHasManageServiceAccess({
      role: "member",
      createdAt,
      paidUntil,
    });

  const stores = await storeService.findAll(user.id);
  const hasStores = stores.length > 0;

  if (!hasStores) {
    return NextResponse.json({
      result: {
        hasStores: false,
        hasLinkedStores: false,
        aiSettingsCompleted: true,
        isAdmin,
        role,
        subscription: {
          paymentRequired,
          freeAccessEndsAt: freeAccessEndsAt.toISOString(),
          usage,
        },
      } satisfies OnboardingResult,
    });
  }

  const storeIds = stores.map((s) => s.id);
  const supabase = await createServerSupabaseClient();

  const { data: sessionRows, error: sessionError } = await supabase
    .from("store_platform_sessions")
    .select("store_id")
    .in("store_id", storeIds)
    .limit(1);
  if (sessionError) throw sessionError;
  const hasLinkedStores = (sessionRows?.length ?? 0) > 0;

  const { data, error } = await supabase
    .from("tone_settings")
    .select("store_id")
    .in("store_id", storeIds)
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  const aiSettingsCompleted = data != null;

  return NextResponse.json({
    result: {
      hasStores: true,
      hasLinkedStores,
      aiSettingsCompleted,
      isAdmin,
      role,
      subscription: {
        paymentRequired,
        freeAccessEndsAt: freeAccessEndsAt.toISOString(),
        usage,
      },
    } satisfies OnboardingResult,
  });
}

export const GET = withRouteHandler(getHandler);
