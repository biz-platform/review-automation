"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { Icon24 } from "@/components/ui/Icon24";
import { cn } from "@/lib/utils/cn";
import storeIcon from "@/assets/icons/24px/store.webp";
import chatIcon from "@/assets/icons/24px/chat.webp";
import robotIcon from "@/assets/icons/24px/robot.webp";
import graphIcon from "@/assets/icons/24px/graph.webp";
import cardIcon from "@/assets/icons/24px/card.webp";
import linkIcon from "@/assets/icons/24px/link.webp";
import peopleIcon from "@/assets/icons/24px/people.webp";
import moneyIcon from "@/assets/icons/24px/money.webp";
import sellerIcon from "@/assets/icons/24px/seller.webp";
import faceIcon from "@/assets/icons/24px/face.webp";
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
  const isAdmin = profile?.is_admin ?? false;

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
  const isDashboardActive = pathname.startsWith("/manage/dashboard");
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
        <NavLink
          href="/manage/dashboard/summary"
          isActive={isDashboardActive}
          icon={<UsageIcon />}
        >
          매장 대시보드
        </NavLink>

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
          icon={<AccountIcon isAdmin={isAdmin} />}
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>img]:h-6 [&>img]:w-6 [&>svg]:h-6 [&>svg]:w-6">
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>img]:h-6 [&>img]:w-6 [&>svg]:h-6 [&>svg]:w-6">
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
  return <Icon24 src={storeIcon} alt="" />;
}

function AccountIcon({ isAdmin }: { isAdmin: boolean }) {
  return <Icon24 src={faceIcon} alt="" />;
}

function CommentIcon() {
  return <Icon24 src={chatIcon} alt="" />;
}

function AiSettingsIcon() {
  return <Icon24 src={robotIcon} alt="" />;
}

function UsageIcon() {
  return <Icon24 src={graphIcon} alt="" />;
}

function PaymentIcon() {
  return <Icon24 src={cardIcon} alt="" />;
}

function LinkIcon() {
  return <Icon24 src={linkIcon} alt="" />;
}

function PeopleIcon() {
  return <Icon24 src={peopleIcon} alt="" />;
}

function MoneyIcon() {
  return <Icon24 src={moneyIcon} alt="" />;
}

function SellerApplyIcon() {
  return <Icon24 src={sellerIcon} alt="" />;
}
