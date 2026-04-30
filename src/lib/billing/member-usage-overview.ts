import { differenceInCalendarDays, subMonths } from "date-fns";
import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";
import {
  computeMemberFreeAccessEndsAt,
  memberHasManageServiceAccess,
} from "@/lib/billing/member-subscription-access";

const DEFAULT_PLAN_NAME = "프리미엄 요금제";
const PREMIUM_MONTHLY_WON = 22_000;
const PRO_MONTHLY_WON = 11_000;

export type MemberSubscriptionUsageKind =
  | "member_free_trial"
  | "member_paid"
  | "member_payment_required"
  | "planner_paid"
  | "planner_unpaid"
  | "center_exempt"
  | "admin_exempt";

export type MemberSubscriptionUsagePayload = {
  kind: MemberSubscriptionUsageKind;
  planName: string;
  /** A-1 한 줄 */
  badgeLine: string;
  /** A-1 스타일 분기 */
  badgeVariant: "trial" | "active" | "inactive" | "cancel_pending";
  /** A-3 */
  usagePeriodDots: string | null;
  /** A-4 */
  currentFeeLine: string;
  /** A-5 */
  nextBillingDots: string | null;
  /** 다음 결제·자동 해지일 (KST 달력). 해지 신청 화면 포맷용 */
  autoCancelKstYmd: string | null;
  /** A-6b: true면 '해지 취소하기' + 해지예정 화면으로 연결 (DB 연동 전엔 항상 false) */
  cancelAtPeriodEnd: boolean;
  /** 무료 배지용 N일 (무료 구간일 때만) */
  freeTrialDaysRemaining: number | null;
};

function monthlyWonLineFromPlanLabel(planLabel: string): string {
  if (planLabel.includes("프로")) {
    return `${PRO_MONTHLY_WON.toLocaleString("ko-KR")}원 / 월`;
  }
  return `${PREMIUM_MONTHLY_WON.toLocaleString("ko-KR")}원 / 월`;
}

function ymdToDots(ymd: string): string {
  return ymd.replaceAll("-", ".");
}

/** 디자인 스펙: `2026. 03. 02` (점 뒤 공백) */
function kstYmdToDisplayDots(ymd: string): string {
  const [y, m, d] = ymd.split("-");
  if (!y || !m || !d) return ymdToDots(ymd);
  return `${y}. ${m}. ${d}`;
}

/** `freeAccessEndsAt` 직전 시각이 속한 KST 날짜 = 무료 마지막 당일 */
function lastInclusiveKstDayBeforeInstant(t: Date): string {
  return formatKstYmd(new Date(t.getTime() - 1));
}

function inclusiveCalendarDaysLeft(
  now: Date,
  lastInclusiveEndKstYmd: string,
): number {
  const todayKst = formatKstYmd(now);
  const start = kstYmdBoundsUtc(todayKst, false);
  const end = kstYmdBoundsUtc(lastInclusiveEndKstYmd, true);
  return Math.max(0, differenceInCalendarDays(end, start) + 1);
}

function paidUsageWindowKst(paidUntil: Date, paidAt: Date | null): {
  startYmd: string;
  endYmd: string;
} {
  const endYmd = lastInclusiveKstDayBeforeInstant(paidUntil);
  if (paidAt != null) {
    const startFromPaid = formatKstYmd(paidAt);
    return { startYmd: startFromPaid, endYmd };
  }
  const endBase = kstYmdBoundsUtc(endYmd, false);
  const startYmd = formatKstYmd(subMonths(endBase, 1));
  return { startYmd, endYmd };
}

export function buildMemberSubscriptionUsagePayload(params: {
  role: "member" | "center_manager" | "planner";
  isAdmin: boolean;
  createdAt: Date;
  paidAt: Date | null;
  paidUntil: Date | null;
  /** users.cancel_at_period_end — 해지 예정 UI (Figma 274:15201) */
  cancelAtPeriodEnd?: boolean;
  /**
   * 활성 청구 invoice의 plan_name(예: "프로 요금제", "프리미엄 요금제").
   * 없으면 UI 기본값(DEFAULT_PLAN_NAME)로 폴백.
   */
  activeInvoicePlanName?: string | null;
  /** users.billing_pending_plan_key — 다음 주기 적용 예약 */
  pendingBillingPlanKey?: "pro" | "premium" | null;
  now?: Date;
}): MemberSubscriptionUsagePayload {
  const now = params.now ?? new Date();
  const activeName = (params.activeInvoicePlanName ?? "").trim();
  const planName =
    activeName.length > 0 ? activeName : DEFAULT_PLAN_NAME;
  const cancelAtPeriodEnd = params.cancelAtPeriodEnd === true;
  const pendingKey = params.pendingBillingPlanKey ?? null;

  const exemptRows = {
    usagePeriodDots: "무기한",
    currentFeeLine: "해당 없음",
    nextBillingDots: "해당 없음",
  } as const;

  if (params.isAdmin) {
    return {
      kind: "admin_exempt",
      planName,
      badgeLine: "구독중",
      badgeVariant: "active",
      ...exemptRows,
      autoCancelKstYmd: null,
      cancelAtPeriodEnd: false,
      freeTrialDaysRemaining: null,
    };
  }

  if (params.role === "center_manager") {
    return {
      kind: "center_exempt",
      planName,
      badgeLine: "구독중",
      badgeVariant: "active",
      ...exemptRows,
      autoCancelKstYmd: null,
      cancelAtPeriodEnd: false,
      freeTrialDaysRemaining: null,
    };
  }

  if (params.role === "planner") {
    const paidUntil = params.paidUntil;
    const paidActive =
      paidUntil != null && paidUntil.getTime() >= now.getTime();
    if (!paidActive) {
      return {
        kind: "planner_unpaid",
        planName,
        badgeLine: "이용 종료",
        badgeVariant: "inactive",
        usagePeriodDots: null,
        currentFeeLine: "이용 가능한 요금제가 없습니다",
        nextBillingDots: null,
        autoCancelKstYmd: null,
        cancelAtPeriodEnd: false,
        freeTrialDaysRemaining: null,
      };
    }
    const { startYmd, endYmd } = paidUsageWindowKst(paidUntil, params.paidAt);
    const nextBilling = addCalendarDaysKst(endYmd, 1);
    return {
      kind: "planner_paid",
      planName,
      badgeLine: cancelAtPeriodEnd ? "해지 예정" : "구독중",
      badgeVariant: cancelAtPeriodEnd ? "cancel_pending" : "active",
      usagePeriodDots: `${kstYmdToDisplayDots(startYmd)} - ${kstYmdToDisplayDots(endYmd)}`,
      currentFeeLine: monthlyWonLineFromPlanLabel(planName),
      nextBillingDots: kstYmdToDisplayDots(nextBilling),
      autoCancelKstYmd: nextBilling,
      cancelAtPeriodEnd,
      freeTrialDaysRemaining: null,
    };
  }

  // member
  const paidUntil = params.paidUntil;
  const paidActive =
    paidUntil != null && paidUntil.getTime() >= now.getTime();

  if (paidActive && paidUntil != null) {
    const { startYmd, endYmd } = paidUsageWindowKst(paidUntil, params.paidAt);
    const nextBilling = addCalendarDaysKst(endYmd, 1);
    const pendingDowngradeToPro = pendingKey === "pro";
    return {
      kind: "member_paid",
      planName,
      badgeLine: cancelAtPeriodEnd
        ? "해지 예정"
        : pendingDowngradeToPro
          ? "변경 예정"
          : "구독중",
      badgeVariant: cancelAtPeriodEnd
        ? "cancel_pending"
        : pendingDowngradeToPro
          ? "cancel_pending"
          : "active",
      usagePeriodDots: `${kstYmdToDisplayDots(startYmd)} - ${kstYmdToDisplayDots(endYmd)}`,
      currentFeeLine: monthlyWonLineFromPlanLabel(planName),
      nextBillingDots: kstYmdToDisplayDots(nextBilling),
      autoCancelKstYmd: nextBilling,
      cancelAtPeriodEnd,
      freeTrialDaysRemaining: null,
    };
  }

  const freeAccessEndsAt = computeMemberFreeAccessEndsAt(params.createdAt);
  const hasFreeOrTrialAccess = memberHasManageServiceAccess({
    role: "member",
    createdAt: params.createdAt,
    paidUntil: params.paidUntil,
    now,
  });

  if (!hasFreeOrTrialAccess) {
    const startYmd = formatKstYmd(params.createdAt);
    const endYmd = lastInclusiveKstDayBeforeInstant(freeAccessEndsAt);
    return {
      kind: "member_payment_required",
      planName,
      badgeLine: "결제 등록 필요",
      badgeVariant: "inactive",
      usagePeriodDots: `${kstYmdToDisplayDots(startYmd)} - ${kstYmdToDisplayDots(endYmd)}`,
      currentFeeLine: "정기 결제 미등록",
      nextBillingDots: null,
      autoCancelKstYmd: null,
      cancelAtPeriodEnd: false,
      freeTrialDaysRemaining: null,
    };
  }

  const startYmd = formatKstYmd(params.createdAt);
  const endYmd = lastInclusiveKstDayBeforeInstant(freeAccessEndsAt);
  const nextBilling = addCalendarDaysKst(endYmd, 1);
  const daysLeft = inclusiveCalendarDaysLeft(now, endYmd);

  return {
    kind: "member_free_trial",
    planName,
    badgeLine: `무료 이용 중 | ${daysLeft}일 남음`,
    badgeVariant: "trial",
    usagePeriodDots: `${kstYmdToDisplayDots(startYmd)} - ${kstYmdToDisplayDots(endYmd)}`,
    currentFeeLine: "한 달 무료 이용 중",
    nextBillingDots: kstYmdToDisplayDots(nextBilling),
    autoCancelKstYmd: null,
    cancelAtPeriodEnd: false,
    freeTrialDaysRemaining: daysLeft,
  };
}
