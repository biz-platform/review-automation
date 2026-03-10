"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { cn } from "@/lib/utils/cn";

/**
 * 데스크톱 전용 SNB. Figma 300-3668
 * - 리뷰 관리: 댓글 관리, AI 댓글 설정
 * - 내 정보 관리: 매장 관리, 계정 관리
 * - 구매 및 청구: 이용 현황, 결제 관리
 * - 셀러 관리: 셀러 등록 신청
 */
export function SNB() {
  const pathname = usePathname();

  const isReviewManageActive = pathname.startsWith("/manage/reviews/manage");
  const isReviewSettingsActive = pathname.startsWith("/manage/reviews/settings");
  const isStoresActive = pathname.startsWith("/manage/stores");
  const isAccountActive = pathname.startsWith("/manage/mypage");
  const isBillingUsageActive = pathname.startsWith("/manage/billing/usage");
  const isBillingPaymentActive = pathname.startsWith("/manage/billing/payment");
  const isSellerApplyActive = pathname.startsWith("/manage/sellers/apply");

  return (
    <aside className="hidden w-lnb shrink-0 border-r border-border bg-white md:block">
      <nav className="flex flex-col gap-1 py-4">
        {/* 리뷰 관리 */}
        <SectionLabel>리뷰 관리</SectionLabel>
        <NavLink
          href="/manage/reviews/manage"
          isActive={isReviewManageActive}
          icon={<CommentIcon />}
        >
          댓글 관리
        </NavLink>
        <NavLink
          href="/manage/reviews/settings"
          isActive={isReviewSettingsActive}
          icon={<AiSettingsIcon />}
        >
          AI 댓글 설정
        </NavLink>

        {/* 내 정보 관리 */}
        <SectionLabel>내 정보 관리</SectionLabel>
        <NavLink
          href="/manage/stores"
          isActive={isStoresActive}
          icon={<StoreIcon />}
        >
          매장 관리
        </NavLink>
        <NavLink
          href="/manage/mypage"
          isActive={isAccountActive}
          icon={<AccountIcon />}
        >
          계정 관리
        </NavLink>

        {/* 구매 및 청구 */}
        <SectionLabel>구매 및 청구</SectionLabel>
        <NavLink
          href="/manage/billing/usage"
          isActive={isBillingUsageActive}
          icon={<UsageIcon />}
        >
          이용 현황
        </NavLink>
        <NavLink
          href="/manage/billing/payment"
          isActive={isBillingPaymentActive}
          icon={<PaymentIcon />}
        >
          결제 관리
        </NavLink>

        {/* 셀러 관리 */}
        <SectionLabel>셀러 관리</SectionLabel>
        <NavLink
          href="/manage/sellers/apply"
          isActive={isSellerApplyActive}
          icon={<SellerApplyIcon />}
        >
          셀러 등록 신청
        </NavLink>
      </nav>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(
        navItemVariants({ structure: "text", state: "default" }),
      )}
    >
      {children}
    </div>
  );
}

function NavLink({
  href,
  isActive,
  icon,
  children,
}: {
  href: string;
  isActive: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "cursor-pointer",
        navItemVariants({
          structure: "icon_child",
          state: isActive ? "selected" : "default",
        }),
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}

function StoreIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function AccountIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function AiSettingsIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function UsageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}

function PaymentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
      <line x1="1" y1="10" x2="23" y2="10" />
    </svg>
  );
}

function SellerApplyIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}
