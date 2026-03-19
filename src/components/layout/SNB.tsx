"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { useAiSettingsRequired } from "@/app/(protected)/AiSettingsRequiredContext";
import { useStoreLinkRequired } from "@/app/(protected)/StoreLinkRequiredContext";

/**
 * 데스크톱 전용 SNB. Figma 300-3668
 * - 리뷰 관리: 댓글 관리, AI 댓글 설정
 * - 내 정보 관리: 매장 관리, 계정 관리
 * - 구매 및 청구: 이용 현황, 결제 관리
 * - 셀러 관리: 셀러 시 영업 링크/고객 관리/정산 관리, 비셀러 시 셀러 등록 신청
 */
export function SNB() {
  const pathname = usePathname();
  const { data: profile } = useAccountProfile();
  const isSeller = profile?.is_seller ?? false;

  const isReviewManageActive =
    pathname.startsWith("/manage/reviews") &&
    !pathname.startsWith("/manage/reviews/settings");
  const isReviewSettingsActive = pathname.startsWith(
    "/manage/reviews/settings",
  );
  const isStoresActive = pathname.startsWith("/manage/stores");
  const isAccountActive = pathname.startsWith("/manage/mypage");
  const isBillingUsageActive = pathname.startsWith("/manage/billing/usage");
  const isBillingPaymentActive = pathname.startsWith("/manage/billing/payment");
  const isSellerApplyActive = pathname.startsWith("/manage/sellers/apply");
  const isSellerLinkActive = pathname.startsWith("/manage/sellers/link");
  const isSellerCustomersActive = pathname.startsWith(
    "/manage/sellers/customers",
  );
  const isSellerSettlementActive = pathname.startsWith(
    "/manage/sellers/settlement",
  );
  return (
    <aside className="sticky top-20 hidden h-screen w-lnb shrink-0 self-start overflow-y-auto border-r border-border bg-gray-08 lg:block">
      <nav className="flex h-full flex-col gap-1 py-4">
        {/* 리뷰 관리 */}
        <SectionLabel>리뷰 관리</SectionLabel>
        <GuardedNavLink
          href="/manage/reviews"
          isActive={isReviewManageActive}
          icon={<CommentIcon />}
          restricted
        >
          댓글 관리
        </GuardedNavLink>
        <GuardedNavLink
          href="/manage/reviews/settings"
          isActive={isReviewSettingsActive}
          icon={<AiSettingsIcon />}
          restricted
        >
          AI 댓글 설정
        </GuardedNavLink>

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
        <GuardedNavLink
          href="/manage/billing/usage"
          isActive={isBillingUsageActive}
          icon={<UsageIcon />}
          restricted
        >
          이용 현황
        </GuardedNavLink>
        <GuardedNavLink
          href="/manage/billing/payment"
          isActive={isBillingPaymentActive}
          icon={<PaymentIcon />}
          restricted
        >
          결제 관리
        </GuardedNavLink>

        {/* 셀러 관리 */}
        <SectionLabel>셀러 관리</SectionLabel>
        {isSeller ? (
          <>
            <NavLink
              href="/manage/sellers/link"
              isActive={isSellerLinkActive}
              icon={<LinkIcon />}
            >
              영업 링크
            </NavLink>
            <NavLink
              href="/manage/sellers/customers"
              isActive={isSellerCustomersActive}
              icon={<PeopleIcon />}
            >
              고객 관리
            </NavLink>
            <NavLink
              href="/manage/sellers/settlement"
              isActive={isSellerSettlementActive}
              icon={<MoneyIcon />}
            >
              정산 관리
            </NavLink>
          </>
        ) : (
          <NavLink
            href="/manage/sellers/apply"
            isActive={isSellerApplyActive}
            icon={<SellerApplyIcon />}
          >
            셀러 등록 신청
          </NavLink>
        )}

      </nav>
    </aside>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={cn(navItemVariants({ structure: "text", state: "default" }))}
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

/** 매장 미연동 또는 AI 설정 미완료 시 클릭해도 이동하지 않고 해당 안내 모달만 띄움 */
function GuardedNavLink({
  href,
  isActive,
  icon,
  children,
  restricted,
}: {
  href: string;
  isActive: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  restricted?: boolean;
}) {
  const { data: onboarding } = useOnboarding();
  const aiCtx = useAiSettingsRequired();
  const storeLinkCtx = useStoreLinkRequired();
  const needsStoreLink =
    restricted && Boolean(onboarding && !onboarding.hasLinkedStores);
  const needsAiSettings =
    restricted &&
    Boolean(onboarding?.hasLinkedStores && !onboarding?.aiSettingsCompleted);
  const shouldBlock = needsStoreLink || needsAiSettings;
  const className = cn(
    "cursor-pointer",
    navItemVariants({
      structure: "icon_child",
      state: isActive ? "selected" : "default",
    }),
  );
  const content = (
    <>
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      <span>{children}</span>
    </>
  );
  if (shouldBlock) {
    const openModal = () => {
      if (needsStoreLink) storeLinkCtx?.openModal();
      else aiCtx?.openModal();
    };
    return (
      <button
        type="button"
        className={cn(className, "w-full text-left")}
        onClick={openModal}
      >
        {content}
      </button>
    );
  }
  return (
    <Link href={href} className={className}>
      {content}
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

function LinkIcon() {
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
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function PeopleIcon() {
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
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}


function MoneyIcon() {
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
      <line x1="12" y1="1" x2="12" y2="23" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
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
