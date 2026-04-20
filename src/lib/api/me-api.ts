import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";

/** public.users.role — DB enum user_role */
export type MeProfileRole =
  | "member"
  | "center_manager"
  | "planner"
  | "센터장"
  | "플래너";

export type MeProfileData = {
  email: string | null;
  phone: string | null;
  /** 셀러 여부 (DB is_seller) */
  is_seller?: boolean;
  /** 어드민 여부 (DB is_admin) */
  is_admin?: boolean;
  /** 등급 (member / 센터장 / 플래너) */
  role?: MeProfileRole;
};

export type MeSubscriptionUsageData = {
  kind:
    | "member_free_trial"
    | "member_paid"
    | "member_payment_required"
    | "planner_paid"
    | "planner_unpaid"
    | "center_exempt"
    | "admin_exempt";
  planName: string;
  badgeLine: string;
  badgeVariant: "trial" | "active" | "inactive" | "cancel_pending";
  usagePeriodDots: string | null;
  currentFeeLine: string;
  nextBillingDots: string | null;
  /** 다음 결제·자동 해지일 (KST YYYY-MM-DD). 유료 구독만 */
  autoCancelKstYmd: string | null;
  cancelAtPeriodEnd: boolean;
  freeTrialDaysRemaining: number | null;
};

export type MeOnboardingData = {
  hasStores: boolean;
  /** 연동된 매장 1개 이상. 0개면 리뷰 관리·구매 및 청구 접근 차단 */
  hasLinkedStores: boolean;
  aiSettingsCompleted: boolean;
  isAdmin: boolean;
  role: "member" | "center_manager" | "planner";
  subscription: {
    paymentRequired: boolean;
    freeAccessEndsAt: string;
    usage: MeSubscriptionUsageData;
  };
};

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) throw new Error(res.statusText);
  const data = await res.json();
  return data.result as T;
}

export const getMeProfile: AsyncApiRequestFn<
  MeProfileData,
  void
> = async () => {
  return getJson<MeProfileData>(API_ENDPOINT.me);
};

export const getMeOnboarding: AsyncApiRequestFn<
  MeOnboardingData,
  void
> = async () => {
  return getJson<MeOnboardingData>(API_ENDPOINT.meOnboarding);
};

export type MeSubscriptionPeriodEndMutationData = { success: true };

export const postMeSubscriptionCancelAtPeriodEnd: AsyncApiRequestFn<
  MeSubscriptionPeriodEndMutationData,
  void
> = async () => {
  const res = await fetch(API_ENDPOINT.meSubscriptionCancelAtPeriodEnd, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  const data = (await res.json()) as {
    result: MeSubscriptionPeriodEndMutationData;
  };
  return data.result;
};

export const postMeSubscriptionResumeAtPeriodEnd: AsyncApiRequestFn<
  MeSubscriptionPeriodEndMutationData,
  void
> = async () => {
  const res = await fetch(API_ENDPOINT.meSubscriptionResumeAtPeriodEnd, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || res.statusText);
  }
  const data = (await res.json()) as {
    result: MeSubscriptionPeriodEndMutationData;
  };
  return data.result;
};
