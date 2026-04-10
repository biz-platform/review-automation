import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/utils/auth/get-user";
import { withRouteHandler } from "@/lib/utils/with-route-handler";
import { StoreService } from "@/lib/services/store-service";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import {
  computeMemberFreeAccessEndsAt,
  memberHasManageServiceAccess,
} from "@/lib/billing/member-subscription-access";

const storeService = new StoreService();

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
  };
};

/** GET: 매장 연동 여부 및 AI 댓글 설정 완료 여부. 온보딩/가드용 */
async function getHandler(request: NextRequest) {
  const { user, supabase: authSupabase } = await getUser(request);

  const { data: profile, error: profileError } = await authSupabase
    .from("users")
    .select("is_admin, role, created_at, paid_until")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) throw profileError;

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

  const freeAccessEndsAt = computeMemberFreeAccessEndsAt(createdAt);
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
      },
    } satisfies OnboardingResult,
  });
}

export const GET = withRouteHandler(getHandler);
