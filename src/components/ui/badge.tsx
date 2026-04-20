"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

const badgeVariants = cva("rounded px-2 py-0.5 typo-body-03-bold", {
  variants: {
    variant: {
      default: "bg-muted text-muted-foreground",
      /** DESIGN-SYSTEM_RE Badge Color=primary (Figma 63:2442) */
      primary:
        "inline-flex w-fit max-w-full items-center justify-center rounded-full border border-main-02 bg-main-05 px-3 py-1.5 leading-none text-main-01",
      /** DESIGN-SYSTEM_RE Badge Color=orange — bg #FEEEE5, border #FF8000, text #EA5E00 */
      orange:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-[#FF8000] bg-[#FEEEE5] px-3 py-1.5 leading-none text-[#EA5E00]",
      /** 좌측 다크 패널 위 — 동일 토큰 */
      orangeOnDark:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-[#FF8000] bg-[#FEEEE5] px-3 py-1.5 leading-none text-[#EA5E00]",
      /** 해지 예정 (Figma 274:15201, 좌 다크 패널) */
      cancelPending:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-06 bg-wgray-02 px-3 py-1.5 leading-none text-gray-05",
      success:
        "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
      warning:
        "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
      expired: "bg-muted text-muted-foreground",
      /** 댓글 관리: 미답변 — secondaryDark */
      reviewUnanswered: "bg-gray-03 text-white",
      /** 댓글 관리: 답변완료 — secondaryDark + opacity 50 */
      reviewAnswered: "bg-gray-03/50 text-white",
      /** 댓글 관리: 기한 만료 — red-02 + opacity 50 */
      reviewExpired: "bg-red-02/50 text-white",
      /** 등록 방법 등: 연한 배경 + 테두리 */
      outline:
        "rounded-lg border border-gray-07 bg-gray-08/50 px-3 py-1 typo-body-03-regular text-gray-01",
      /** 결제 관리 > 이용 상태: 사용 중 */
      billingUsageActive:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-[#3B82F6] bg-[#EFF6FF] px-3 py-1.5 leading-none text-[#2563EB]",
      /** 결제 관리 > 이용 상태: 이용 중지 */
      billingUsageSuspended:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-red-01 bg-red-01/10 px-3 py-1.5 leading-none text-red-01",
      /** 결제 관리 > 이용 상태: 사용 만료 */
      billingUsageExpired:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-06 bg-gray-08 px-3 py-1.5 leading-none text-gray-04",
      /** 어드민 결제 > 결제 상태 완료 */
      adminPaymentComplete:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-[#3B82F6] bg-[#EFF6FF] px-3 py-1.5 leading-none text-[#2563EB]",
      /** 어드민 결제 > 결제 상태 오류 */
      adminPaymentError:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-red-01 bg-red-01/10 px-3 py-1.5 leading-none text-red-01",
      /** 어드민 환불: 가능·대기·요건 미달·완료·해당 없음 — 회색 톤 통일 + 테두리 */
      adminRefundEligible:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-06 bg-gray-08 px-3 py-1.5 leading-none text-gray-02",
      adminRefundPending:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-06 bg-gray-08 px-3 py-1.5 leading-none text-gray-02",
      adminRefundIneligible:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-06 bg-gray-08 px-3 py-1.5 leading-none text-gray-04",
      adminRefundCompleted:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-06 bg-gray-08 px-3 py-1.5 leading-none text-gray-03",
      adminRefundNone:
        "inline-flex min-h-7 w-fit max-w-full items-center justify-center rounded-full border border-gray-07 bg-white px-3 py-1.5 leading-none text-gray-05",
    },
  },
  defaultVariants: {
    variant: "default",
  },
});

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <span className={cn(badgeVariants({ variant, className }))} {...props} />
  );
}
