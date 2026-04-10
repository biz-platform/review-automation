import { addMonths } from "date-fns";
import { getMemberPromoBoundsMs } from "@/lib/billing/member-promo-bounds";

/** 일반 회원: 전체 프로모 + (기준일 이후 가입 시) 가입일 기준 1개월 중 실질 무료 종료 시각 */
export function computeMemberFreeAccessEndsAt(createdAt: Date): Date {
  const { trialEligibleSinceMs, freePromoEndExclusiveMs } = getMemberPromoBoundsMs();
  const signupMs = createdAt.getTime();
  const extendedTrialEndMs =
    signupMs >= trialEligibleSinceMs
      ? addMonths(createdAt, 1).getTime()
      : Number.NEGATIVE_INFINITY;
  const endMs = Math.max(freePromoEndExclusiveMs, extendedTrialEndMs);
  return new Date(endMs);
}

export type MemberSubscriptionAccessParams = {
  role: "member" | "center_manager" | "planner" | string;
  createdAt: Date;
  paidUntil: Date | null;
  now?: Date;
};

/**
 * /manage 서비스 이용 허용 여부(일반 회원: 유료 구독 또는 무료·체험 기간).
 * 센터장·플래너·어드민은 호출부에서 별도 처리.
 */
export function memberHasManageServiceAccess(
  params: MemberSubscriptionAccessParams,
): boolean {
  const now = params.now ?? new Date();
  if (params.role === "center_manager") return true;
  if (params.role === "planner") {
    return params.paidUntil != null && params.paidUntil.getTime() >= now.getTime();
  }
  if (params.role !== "member") return true;
  if (params.paidUntil != null && params.paidUntil.getTime() >= now.getTime()) {
    return true;
  }
  const freeEnds = computeMemberFreeAccessEndsAt(params.createdAt);
  return now.getTime() < freeEnds.getTime();
}
