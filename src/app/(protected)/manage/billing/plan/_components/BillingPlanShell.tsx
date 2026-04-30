"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addMonths } from "date-fns";
import { cn } from "@/lib/utils/cn";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { OptionItem } from "@/components/ui/option-item";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { PageFixedBottomBar } from "@/components/layout/PageFixedBottomBar";
import { useToast } from "@/components/ui/toast";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useMeBilling } from "@/lib/hooks/use-me-billing";
import { usePostMeBillingPlanDowngrade } from "@/lib/hooks/use-post-me-billing-plan-downgrade";
import { usePostMeBillingPlanPendingCancel } from "@/lib/hooks/use-post-me-billing-plan-pending-cancel";
import { usePostMeBillingPlanUpgrade } from "@/lib/hooks/use-post-me-billing-plan-upgrade";
import { BillingLedgerMismatchBanner } from "@/app/(protected)/manage/billing/_components/BillingLedgerMismatchBanner";
import { SERVICE_TERMS_TEXT, PRIVACY_POLICY_TEXT } from "@/const/terms";
import {
  addCalendarDaysKst,
  formatKstYmd,
  kstYmdBoundsUtc,
} from "@/lib/utils/kst-date";
import type { MeBillingInvoiceData } from "@/lib/api/billing-api";
import { firstBillingDateAtKstStartAfterFreeAccessEnds } from "@/lib/billing/member-first-billing-after-free-trial";
import {
  computeProToPremiumUpgradeChargeWonFromInvoice,
  invoiceNextBillingKstYmd,
} from "@/lib/billing/member-plan-proration";

type PlanKey = "pro" | "premium";

type Plan = {
  key: PlanKey;
  title: string;
  descriptionLines: string[];
  priceWon: number;
};

const PLANS: Plan[] = [
  {
    key: "pro",
    title: "프로 요금제 / 월 11,000원",
    descriptionLines: [
      "서비스별 계정 1개 연동",
      "매장 수 무제한 등록",
      "사장님이 직접 설정하고 관리",
    ],
    priceWon: 11_000,
  },
  {
    key: "premium",
    title: "프리미엄 요금제 / 월 22,000원",
    descriptionLines: [
      "서비스별 계정 1개 연동",
      "매장 수 무제한 등록",
      "전담 매니저가 대신 설정하고 관리",
    ],
    priceWon: 22_000,
  },
];

function formatWon(amount: number): string {
  return `${amount.toLocaleString("ko-KR")}원`;
}

function formatKoreanYmd(d: Date): string {
  const ymd = formatKstYmd(d);
  const [y, m, day] = ymd.split("-");
  if (!y || !m || !day) return "";
  return `${y}년 ${m}월 ${day}일`;
}

/** member-usage-overview `lastInclusiveKstDayBeforeInstant`와 동일 */
function lastInclusiveKstYmdBeforeInstant(t: Date): string {
  return formatKstYmd(new Date(t.getTime() - 1));
}

function formatSignedWon(amountWon: number): string {
  if (Object.is(amountWon, -0)) return "0원";
  const abs = Math.abs(amountWon);
  const sign = amountWon < 0 ? "-" : "";
  return `${sign}${abs.toLocaleString("ko-KR")}원`;
}

/** **로 감싼 구간을 <strong>으로 렌더 (Signup 약관 모달과 동일 패턴) */
function TermsParagraph({ text }: { text: string }) {
  const parts = text.split(/\*\*/);
  return (
    <>
      {parts.map((part, i) =>
        i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
      )}
    </>
  );
}

function SectionCard({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        // Mobile: 섹션은 카드(outer border/rounded/bg) 스타일 미적용
        // Desktop(LG+): 카드 스타일 적용
        "lg:rounded-lg lg:border lg:border-gray-07 lg:bg-white lg:px-4 lg:py-5 lg:sm:px-6",
        className,
      )}
    >
      <h2 className="typo-heading-02-bold text-gray-01">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MoneyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <p className="typo-body-02-bold text-gray-01">{label}</p>
      <p className="typo-body-02-bold text-gray-03 tabular-nums">{value}</p>
    </div>
  );
}

function ReadonlyField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="typo-body-01-bold text-gray-01">{label}</p>
      <div className="flex h-[52px] items-center rounded-lg border border-wgray-04 bg-wgray-06 px-5 typo-body-01-regular text-gray-01">
        {value}
      </div>
    </div>
  );
}

export function BillingPlanShell() {
  const router = useRouter();
  const { addToast } = useToast();
  const { data: onboarding, isSuccess } = useOnboarding();
  const billingQ = useMeBilling();
  const upgradeM = usePostMeBillingPlanUpgrade();
  const downgradeM = usePostMeBillingPlanDowngrade();
  const pendingCancelM = usePostMeBillingPlanPendingCancel();
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("premium");
  const [submitting, setSubmitting] = useState(false);
  const [termsModal, setTermsModal] = useState<"terms" | "privacy" | null>(
    null,
  );

  const billing = billingQ.data;
  const latestActiveInvoice = useMemo((): MeBillingInvoiceData | null => {
    if (!billing) return null;
    return (
      billing.invoices.find(
        (x) => x.paymentStatus === "completed" && x.usageStatus === "active",
      ) ?? null
    );
  }, [billing]);

  const hasPendingDowngradeToPro = useMemo(() => {
    return billing?.pendingPlanKey === "pro";
  }, [billing]);

  const currentPlanKey = useMemo((): PlanKey | null => {
    if (!latestActiveInvoice?.planName) return null;
    if (latestActiveInvoice.planName.includes("프로")) return "pro";
    if (latestActiveInvoice.planName.includes("프리미엄")) return "premium";
    return null;
  }, [latestActiveInvoice]);

  const isUpgradeMode = useMemo(() => {
    if (!onboarding) return false;
    return (
      currentPlanKey === "pro" &&
      onboarding.subscription.usage.kind === "member_paid"
    );
  }, [currentPlanKey, onboarding]);

  const isDowngradeMode = useMemo(() => {
    if (!onboarding) return false;
    return (
      currentPlanKey === "premium" &&
      onboarding.subscription.usage.kind === "member_paid" &&
      !hasPendingDowngradeToPro
    );
  }, [currentPlanKey, onboarding, hasPendingDowngradeToPro]);

  const plan = useMemo(
    () => PLANS.find((p) => p.key === selectedPlan) ?? PLANS[0],
    [selectedPlan],
  );

  const { firstBillingDate, nextBillingDate } = useMemo(() => {
    const fallback = () => {
      const t = new Date();
      return { firstBillingDate: t, nextBillingDate: addMonths(t, 1) };
    };
    if (!onboarding) return fallback();
    if (onboarding.isAdmin || onboarding.role !== "member") return fallback();

    const sub = onboarding.subscription;
    const usageKind = sub.usage.kind;
    const freeEndsAt = new Date(sub.freeAccessEndsAt);
    const nowMs = Date.now();

    if (usageKind === "member_free_trial") {
      const first = firstBillingDateAtKstStartAfterFreeAccessEnds(freeEndsAt);
      return { firstBillingDate: first, nextBillingDate: addMonths(first, 1) };
    }

    if (usageKind === "member_payment_required") {
      const first = firstBillingDateAtKstStartAfterFreeAccessEnds(freeEndsAt);
      return { firstBillingDate: first, nextBillingDate: addMonths(first, 1) };
    }

    if (usageKind === "member_paid") {
      if (latestActiveInvoice) {
        const first = kstYmdBoundsUtc(
          formatKstYmd(new Date(latestActiveInvoice.paidAt)),
          false,
        );
        const nextYmd = invoiceNextBillingKstYmd(latestActiveInvoice);
        return {
          firstBillingDate: first,
          nextBillingDate: kstYmdBoundsUtc(nextYmd, false),
        };
      }

      // 인보이스 없이 users.paid_* 만 있는 경우(시드 등): 무료 종료 전이면 이용현황과 같이 첫 청구는 무료 종료 다음날
      if (nowMs < freeEndsAt.getTime()) {
        const first = firstBillingDateAtKstStartAfterFreeAccessEnds(freeEndsAt);
        return { firstBillingDate: first, nextBillingDate: addMonths(first, 1) };
      }

      if (sub.memberPaidAt != null && sub.memberPaidUntil != null) {
        const paidAtD = new Date(sub.memberPaidAt);
        const paidUntilD = new Date(sub.memberPaidUntil);
        const first = kstYmdBoundsUtc(formatKstYmd(paidAtD), false);
        const endYmd = lastInclusiveKstYmdBeforeInstant(paidUntilD);
        const nextYmd = addCalendarDaysKst(endYmd, 1);
        return {
          firstBillingDate: first,
          nextBillingDate: kstYmdBoundsUtc(nextYmd, false),
        };
      }

      return fallback();
    }

    return fallback();
  }, [onboarding, latestActiveInvoice]);

  const upgradeCalc = useMemo(() => {
    if (!isUpgradeMode || !latestActiveInvoice) return null;
    const calc =
      computeProToPremiumUpgradeChargeWonFromInvoice(latestActiveInvoice);
    return {
      remainingDays: calc.remainingDays,
      b1: calc.premiumRemainWonRounded,
      b2: calc.proRemainWonRounded,
      b3: calc.chargeWonRoundedTo100,
      nextBillingYmd: calc.nextBillingKstYmd,
    };
  }, [isUpgradeMode, latestActiveInvoice]);

  const submittingAny =
    submitting ||
    upgradeM.isPending ||
    downgradeM.isPending ||
    pendingCancelM.isPending;

  if (!isSuccess || !onboarding || !billingQ.isSuccess || !billingQ.data) {
    return (
      <div className="w-full min-w-0">
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      </div>
    );
  }

  const billingView = billingQ.data;

  // 업그레이드/다운그레이드 모드에서는 선택이 고정된다.
  const effectiveSelectedPlan: PlanKey = isUpgradeMode
    ? "premium"
    : isDowngradeMode
      ? "pro"
      : selectedPlan;

  const planCard = (
    <SectionCard title="상품 선택">
      <div className="flex flex-col gap-3">
        {hasPendingDowngradeToPro ? (
          <div className="flex flex-col gap-3 rounded-lg border border-gray-07 bg-gray-08 px-4 py-4">
            <p className="typo-body-02-regular text-gray-01">
              이미 <span className="typo-body-02-bold">프로 요금제</span>로의
              변경이 예약되어 있어요.
              {billingView.pendingPlanEffectiveAt ? (
                <>
                  {" "}
                  (적용 시각:{" "}
                  <span className="tabular-nums">
                    {formatKoreanYmd(
                      new Date(billingView.pendingPlanEffectiveAt),
                    )}
                  </span>
                  )
                </>
              ) : null}
            </p>
            <Button
              type="button"
              variant="secondaryDark"
              size="md"
              className="h-[44px] w-full rounded-lg"
              disabled={submittingAny}
              onClick={async () => {
                try {
                  setSubmitting(true);
                  await pendingCancelM.mutateAsync();
                  addToast("요금제 변경 예약을 취소했습니다.");
                } catch (e) {
                  addToast(
                    e instanceof Error ? e.message : "처리에 실패했습니다.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              예약 취소
            </Button>
          </div>
        ) : null}
        {PLANS.map((p) => {
          const checked = p.key === effectiveSelectedPlan;
          const disabled =
            hasPendingDowngradeToPro ||
            (isUpgradeMode && p.key === "pro") ||
            (isDowngradeMode && p.key === "premium"); // 현재 이용 중: 선택 불가
          return (
            <button
              key={p.key}
              type="button"
              disabled={disabled}
              onClick={() => {
                if (
                  isUpgradeMode ||
                  isDowngradeMode ||
                  hasPendingDowngradeToPro
                )
                  return;
                setSelectedPlan(p.key);
              }}
              className={cn(
                "w-full rounded-lg border px-4 py-4 text-left transition-colors",
                checked
                  ? "border-main-02 bg-main-05"
                  : "border-gray-07 bg-gray-08",
                !disabled && !checked && "hover:bg-gray-07/40",
                disabled && "cursor-not-allowed opacity-90",
              )}
            >
              <div className="flex items-start gap-2.5">
                <div className="pt-[3px]">
                  <OptionItem
                    variant={checked ? "checked" : "default"}
                    asButton={false}
                  />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <p className="typo-body-01-bold text-gray-01">{p.title}</p>
                    {isUpgradeMode && p.key === "pro" ? (
                      <span className="shrink-0 rounded-lg border border-gray-05 bg-white px-3 py-1 text-[12px] font-medium leading-4 text-gray-05">
                        현재 이용 중
                      </span>
                    ) : null}
                    {isUpgradeMode && p.key === "premium" ? (
                      <span className="shrink-0 rounded-lg border border-main-02 bg-main-05 px-3 py-1 text-[12px] font-medium leading-4 text-main-02">
                        변경 예정
                      </span>
                    ) : null}
                    {isDowngradeMode && p.key === "premium" ? (
                      <span className="shrink-0 rounded-lg border border-gray-05 bg-white px-3 py-1 text-[12px] font-medium leading-4 text-gray-05">
                        현재 이용 중
                      </span>
                    ) : null}
                    {isDowngradeMode && p.key === "pro" ? (
                      <span className="shrink-0 rounded-lg border border-main-02 bg-main-05 px-3 py-1 text-[12px] font-medium leading-4 text-main-02">
                        변경 예정
                      </span>
                    ) : null}
                  </div>
                  <p className="whitespace-pre-line typo-body-02-regular text-gray-02">
                    {p.descriptionLines.join("\n")}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </SectionCard>
  );

  const paymentAmountCard = isUpgradeMode ? (
    <SectionCard title="오늘 결제할 금액">
      <div className="rounded-lg border border-gray-07 px-4 py-4">
        <div className="flex flex-col gap-2">
          <MoneyRow
            label={`프리미엄 잔여 기간 금액 (${upgradeCalc?.remainingDays ?? 0}일)`}
            value={formatWon(upgradeCalc?.b1 ?? 0)}
          />
          <div className="flex items-center justify-between gap-4">
            <p className="typo-body-02-bold text-gray-01">
              기존 프로 결제 잔여분 차감
            </p>
            <p className="typo-body-02-bold text-main-02 tabular-nums">
              {formatSignedWon(-(upgradeCalc?.b2 ?? 0))}
            </p>
          </div>
          <div className="mt-2 border-t border-gray-07 pt-3">
            <MoneyRow
              label="오늘 추가 결제 금액"
              value={formatWon(upgradeCalc?.b3 ?? 0)}
            />
          </div>
        </div>
      </div>
    </SectionCard>
  ) : isDowngradeMode ? (
    <SectionCard title="오늘 결제할 금액">
      <div className="rounded-lg border border-gray-07 px-4 py-4">
        <div className="flex flex-col gap-2">
          <MoneyRow label="상품 금액" value="0원" />
          <div className="flex items-center justify-between gap-4">
            <p className="typo-body-02-bold text-gray-01">추가 청구</p>
            <p className="typo-body-02-bold text-gray-03">없음</p>
          </div>
          <div className="mt-2 border-t border-gray-07 pt-3">
            <MoneyRow label="오늘 결제" value="0원" />
          </div>
        </div>
      </div>
    </SectionCard>
  ) : (
    <SectionCard title="결제 금액">
      <div className="rounded-lg border border-gray-07 px-4 py-4">
        <div className="flex flex-col gap-2">
          <MoneyRow label="상품 금액" value={formatWon(plan.priceWon)} />
          <MoneyRow label="최종 결제 금액" value={formatWon(plan.priceWon)} />
        </div>
      </div>
    </SectionCard>
  );

  const paymentAgreement = (
    <p className="whitespace-pre-line text-center typo-body-03-regular text-gray-03">
      결제하기 버튼을 클릭하면 주문 내용을 확인하였으며,{"\n"}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => setTermsModal("terms")}
      >
        서비스 이용 약관
      </button>{" "}
      및{" "}
      <button
        type="button"
        className="underline underline-offset-2"
        onClick={() => setTermsModal("privacy")}
      >
        개인정보 처리 방침
      </button>
      에 동의한 것으로 간주합니다.
    </p>
  );

  const paymentActionsMobile = (
    <div className="flex w-full gap-2">
      <Button
        type="button"
        variant="secondaryDark"
        size="md"
        className="h-[52px] flex-1 rounded-lg outline-1 outline-wgray-01"
        disabled={submittingAny}
        onClick={() => setStep("select")}
      >
        이전
      </Button>
      <Button
        type="button"
        size="md"
        className="h-[52px] flex-1 rounded-lg bg-main-03 outline-1 outline-main-02"
        disabled={submittingAny || hasPendingDowngradeToPro}
        onClick={async () => {
          try {
            setSubmitting(true);
            if (isDowngradeMode) {
              await downgradeM.mutateAsync();
              addToast("프로 요금제 변경이 예약되었습니다.");
              router.push("/manage/billing/usage");
              return;
            }
            if (isUpgradeMode) {
              const charge = upgradeCalc?.b3 ?? 0;
              await upgradeM.mutateAsync({ clientExpectedChargeWon: charge });
              addToast("프리미엄 요금제로 변경되었습니다.");
              router.push("/manage/billing/usage");
              return;
            }
            router.push("/manage/billing/payment/card");
          } catch (e) {
            addToast(e instanceof Error ? e.message : "처리에 실패했습니다.");
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {isDowngradeMode ? "변경 예약하기" : "결제하기"}
      </Button>
    </div>
  );

  const paymentActionsDesktop = (
    <Button
      type="button"
      size="md"
      className="h-[52px] w-full rounded-lg bg-main-03 outline-1 outline-main-02"
      disabled={submitting}
      onClick={() => {
        // TODO: KORPAY PG사 페이지로 이동(연동 시 교체)
        setSubmitting(true);
        window.location.href = "/manage/billing/payment/card";
      }}
    >
      {isUpgradeMode
        ? "결제하고 요금제 변경하기"
        : isDowngradeMode
          ? "요금제 변경 예약하기"
          : `${formatWon(plan.priceWon)} 결제하기`}
    </Button>
  );

  const paymentFooter = (
    <div className="mt-6 border-t border-gray-07 pt-6">
      {paymentAgreement}
      <div className="mt-4 hidden lg:flex">{paymentActionsDesktop}</div>

      <Modal
        open={termsModal !== null}
        onOpenChange={() => setTermsModal(null)}
        title={
          termsModal === "terms" ? "서비스 이용 약관" : "개인정보 처리 방침"
        }
        size="default"
        className="max-w-[min(90vw,640px)] max-h-[85vh] flex flex-col"
        footer={
          <Button
            type="button"
            variant="secondaryDark"
            onClick={() => setTermsModal(null)}
          >
            닫기
          </Button>
        }
      >
        <div className="max-h-[60vh] overflow-y-auto whitespace-pre-line pr-2 typo-body-02-regular text-gray-03">
          <TermsParagraph
            text={
              termsModal === "terms"
                ? SERVICE_TERMS_TEXT
                : termsModal === "privacy"
                  ? PRIVACY_POLICY_TEXT
                  : ""
            }
          />
        </div>
      </Modal>
    </div>
  );

  const recurringCard = (
    <SectionCard
      title={isUpgradeMode || isDowngradeMode ? "변경 일정" : "정기 결제일"}
    >
      <div className="rounded-lg border border-gray-07 px-4 py-5">
        <div className="flex flex-col gap-4">
          {isUpgradeMode ? (
            <>
              <ReadonlyField
                label="기능 변경"
                value="프리미엄 요금제 즉시 활성화"
              />
              <ReadonlyField
                label="다음 결제 예정일"
                value={formatKoreanYmd(
                  upgradeCalc?.nextBillingYmd
                    ? kstYmdBoundsUtc(upgradeCalc.nextBillingYmd, false)
                    : new Date(),
                )}
              />
              <p className="whitespace-pre-line typo-body-03-regular text-blue-01">
                ※ 오늘은 잔여 {upgradeCalc?.remainingDays ?? 0}일에 대한 차액만
                청구되며, 다음 결제일부터는 프리미엄 요금 22,000원으로
                정기결제됩니다.
              </p>
            </>
          ) : isDowngradeMode && latestActiveInvoice ? (
            <>
              <ReadonlyField
                label="기능 변경"
                value={`${formatKoreanYmd(
                  kstYmdBoundsUtc(
                    invoiceNextBillingKstYmd(latestActiveInvoice),
                    false,
                  ),
                )}부터 프로 요금제 활성화`}
              />
              <ReadonlyField
                label="다음 결제 예정일"
                value={formatKoreanYmd(
                  kstYmdBoundsUtc(
                    invoiceNextBillingKstYmd(latestActiveInvoice),
                    false,
                  ),
                )}
              />
              <p className="whitespace-pre-line typo-body-03-regular text-blue-01">
                ※ 이미 결제하신 프리미엄 이용 기간은 그대로 유지됩니다.
              </p>
            </>
          ) : (
            <>
              <ReadonlyField label="구독 결제 주기" value="1개월" />
              <ReadonlyField
                label="첫 결제일"
                value={formatKoreanYmd(firstBillingDate)}
              />
              <ReadonlyField
                label="다음 결제 예정일"
                value={formatKoreanYmd(nextBillingDate)}
              />
              <p className="whitespace-pre-line typo-body-03-regular text-blue-01">
                ※ 이용기간은 결제일 기준으로 산정되며 다음 결제일 전날까지
                1개월로 봅니다.
                {"\n"}※ 다음 결제일 전까지는 추가 요금이 청구되지 않습니다.
                {"\n"}※ 원하시면 언제든지 정기결제를 해지할 수 있습니다.
              </p>
            </>
          )}
        </div>
      </div>
      {/* Desktop: 카드 섹션 안이되, 내부 박스 밖 */}
      <div className="hidden lg:block">{paymentFooter}</div>
    </SectionCard>
  );

  return (
    <div className="w-full min-w-0">
      <h1 className="mb-8 typo-heading-02-bold text-gray-01">요금제 선택</h1>

      {billingView.ledgerHealth.missingActiveInvoice ? (
        <div className="mb-6">
          <BillingLedgerMismatchBanner />
        </div>
      ) : null}

      {/* Desktop: 상품 선택(50%) + 결제 금액(50%) */}
      <div className="hidden lg:flex lg:flex-col lg:gap-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="min-w-0">{planCard}</div>
          <div className="min-w-0">
            <div className="flex flex-col gap-6">
              {paymentAmountCard}
              {recurringCard}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile: 2-step */}
      <div className="lg:hidden pb-[180px]">
        <div className={cn(step !== "select" && "hidden")}>{planCard}</div>

        <div className={cn(step !== "confirm" && "hidden")}>
          <div className="flex flex-col gap-6">
            {paymentAmountCard}
            {/* 구분선(모바일 P-02에서 10px) */}
            <div
              className="-mx-4 h-2.5 bg-gray-08 sm:mx-0 sm:rounded-lg"
              aria-hidden
            />
            {recurringCard}
          </div>
        </div>

        {step === "select" ? (
          <PageFixedBottomBar className="w-full px-4">
            <Button
              type="button"
              size="md"
              className="h-[52px] w-full rounded-lg bg-main-03 outline-1 outline-main-02"
              onClick={() => setStep("confirm")}
            >
              다음
            </Button>
          </PageFixedBottomBar>
        ) : (
          <PageFixedBottomBar className="w-full flex-col gap-4 px-4">
            {paymentAgreement}
            {paymentActionsMobile}
          </PageFixedBottomBar>
        )}
      </div>

      {/* 결제 필요 배너가 있는 기존 결제관리 페이지로 이동 링크(보조) */}
      {onboarding.subscription.paymentRequired &&
      onboarding.role === "member" ? (
        <p className="mt-6 typo-body-03-regular text-gray-04">
          이미 무료 이용이 종료되었다면{" "}
          <Link
            href="/manage/billing/payment"
            className="text-blue-01 underline underline-offset-2"
          >
            결제 관리
          </Link>
          에서 상태를 확인할 수 있어요.
        </p>
      ) : null}
    </div>
  );
}
