"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { useAiSettingsRequired } from "@/app/(protected)/AiSettingsRequiredContext";
import { useStoreLinkRequired } from "@/app/(protected)/StoreLinkRequiredContext";
import type { AuthSessionUser } from "@/lib/hooks/use-auth-session";
import { ComingSoonModal } from "@/components/ui/coming-soon-modal";
import { NOTION_USER_GUIDE_URL, NOTION_NOTICE_URL } from "@/const/links";
import { Icon24 } from "@/components/ui/Icon24";
import { UserProfileRasterIcon } from "@/components/ui/UserProfileRasterIcon";
import closeIcon from "@/assets/icons/28px/close.webp";
import storeIcon from "@/assets/icons/24px/store.webp";
import chatIcon from "@/assets/icons/24px/chat.webp";
import robotIcon from "@/assets/icons/24px/robot.webp";
import graphIcon from "@/assets/icons/24px/graph.webp";
import cardIcon from "@/assets/icons/24px/card.webp";
import sellerIcon from "@/assets/icons/24px/seller.webp";
import linkIcon from "@/assets/icons/24px/link.webp";
import peopleIcon from "@/assets/icons/24px/people.webp";
import moneyIcon from "@/assets/icons/24px/money.webp";
import faceIcon from "@/assets/icons/24px/face.webp";

interface ManageMobileMenuProps {
  user: AuthSessionUser;
  onClose: () => void;
}

/**
 * /manage 경로 모바일 전용 메뉴. Figma 316-14460(일반) / 316-16202(센터장) / 320-16314(셀러)
 */
export function ManageMobileMenu({ user, onClose }: ManageMobileMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: profile } = useAccountProfile();

  /** 프로그램 방식 이동 후 메뉴 닫기 (포털 언마운트 전에 이동 트리거) */
  const handleNav = useCallback(
    (href: string) => {
      router.push(href);
      onClose();
    },
    [router, onClose],
  );
  const [comingSoonOpen, setComingSoonOpen] = useState(false);
  /** 공지/가이드/고객센터: 공지·가이드 Notion 링크, 고객센터는 준비 중 모달 */
  const handleTopNav = useCallback(
    (href: string) => {
      if (href === "/notice") {
        window.open(NOTION_NOTICE_URL, "_blank", "noopener,noreferrer");
      } else if (href === "/guide") {
        window.open(NOTION_USER_GUIDE_URL, "_blank", "noopener,noreferrer");
      } else if (href === "/support") {
        setComingSoonOpen(true);
      } else {
        handleNav(href);
      }
    },
    [handleNav],
  );
  const { signOut } = useSignOut();
  const { data: onboarding } = useOnboarding();
  const storeLinkCtx = useStoreLinkRequired();
  const aiCtx = useAiSettingsRequired();

  const email = profile?.email ?? user.email ?? "";

  /** 역할 배지: 센터장 / 플래너 / member. 셀러는 별도 배지로 우측에 표시 */
  const roleBadgeLabel =
    profile?.role === "center_manager"
      ? "센터장"
      : profile?.role === "planner"
        ? "플래너"
        : "member";
  const isSeller = profile?.is_seller ?? false;
  const isAdmin = profile?.is_admin ?? false;
  const isAdminRoute = pathname.startsWith("/manage/admin");

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
  const isAdminCustomersActive = pathname.startsWith("/manage/admin/customers");
  const isAdminStoresActive = pathname.startsWith("/manage/admin/stores");
  const isAdminPaymentsActive = pathname.startsWith("/manage/admin/payments");
  if (isAdminRoute && isAdmin) {
    return (
      <div className="flex min-h-full flex-col bg-white lg:hidden p-4">
        <div className="flex shrink-0 justify-end">
          <button
            type="button"
            className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-03 hover:bg-gray-08 hover:text-gray-01"
            aria-label="메뉴 닫기"
            onClick={onClose}
          >
            <CloseIcon />
          </button>
        </div>

        <div className="flex shrink-0 items-center gap-[14px] pb-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-08 text-gray-04">
            <UserProfileRasterIcon isAdmin={isAdmin} />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {profile?.role === "center_manager" && (
                <span className="inline-flex w-fit items-center justify-center rounded-lg border border-main-01 bg-main-05 px-2.5 py-0.5 text-[10px] font-medium leading-[1.6] text-main-01">
                  센터장
                </span>
              )}
              {profile?.role === "planner" && (
                <span className="inline-flex w-fit items-center justify-center rounded-lg border border-main-01 bg-main-05 px-2.5 py-0.5 text-[10px] font-medium leading-[1.6] text-main-01">
                  플래너
                </span>
              )}
              {isAdmin && (
                <span className="inline-flex w-fit items-center justify-center rounded-lg border border-gray-01 bg-gray-01 px-2.5 py-0.5 text-[10px] font-medium leading-[1.6] text-white">
                  관리자
                </span>
              )}
              {isSeller && (
                <span className="inline-flex w-fit items-center justify-center rounded-lg border border-orange-400 bg-orange-100 px-2.5 py-0.5 text-[10px] font-medium leading-[1.6] text-orange-400">
                  셀러
                </span>
              )}
            </div>
            <span className="truncate typo-body-02-bold text-gray-01">
              {email || "이메일 없음"}
            </span>
          </div>
        </div>

        <nav
          className="flex flex-1 flex-col overflow-y-auto px-0 py-2"
          aria-label="관리 메뉴"
        >
          <div className="flex flex-col gap-4">
            <div>
              <SectionLabel>올리뷰 서비스 고객</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <MobileNavLink
                  href="/manage/admin/customers"
                  isActive={isAdminCustomersActive}
                  icon={<PeopleIcon />}
                  onNavigate={handleNav}
                >
                  고객 관리
                </MobileNavLink>
                <MobileNavLink
                  href="/manage/admin/stores"
                  isActive={isAdminStoresActive}
                  icon={<StoreIcon />}
                  onNavigate={handleNav}
                >
                  매장 관리
                </MobileNavLink>
                <MobileNavLink
                  href="/manage/admin/payments"
                  isActive={isAdminPaymentsActive}
                  icon={<PaymentIcon />}
                  onNavigate={handleNav}
                >
                  결제 조회
                </MobileNavLink>
              </div>
            </div>

            <div>
              <SectionLabel>올리뷰 서비스 셀러</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <MobileNavLink
                  href="/manage/sellers/link"
                  isActive={pathname.startsWith("/manage/sellers/link")}
                  icon={<LinkIcon />}
                  onNavigate={handleNav}
                >
                  셀러 관리
                </MobileNavLink>
                <MobileNavLink
                  href="/manage/admin/settlements"
                  isActive={pathname.startsWith("/manage/admin/settlements")}
                  icon={<MoneyIcon />}
                  onNavigate={handleNav}
                >
                  정산 관리
                </MobileNavLink>
              </div>
            </div>
          </div>
        </nav>

        <div className="flex shrink-0 justify-end px-4 py-25 pr-2.5">
          <button
            type="button"
            className="typo-body-02-bold text-gray-05 hover:text-gray-01 py-3 pr-4.5"
            onClick={() => {
              onClose();
              signOut();
            }}
          >
            로그아웃
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-full flex-col bg-white lg:hidden p-4">
      {/* 헤더: 닫기 버튼 우측 */}
      <div className="flex shrink-0 justify-end">
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-03 hover:bg-gray-08 hover:text-gray-01"
          aria-label="메뉴 닫기"
          onClick={onClose}
        >
          <CloseIcon />
        </button>
      </div>

      {/* 프로필: 아이콘 40px + (배지 위 · 이메일 아래) — Figma 316-14688 */}
      <div className="flex shrink-0 items-center gap-[14px] pb-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-08 text-gray-04">
          <UserProfileRasterIcon isAdmin={isAdmin} />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="inline-flex w-fit items-center justify-center rounded-lg border border-main-01 bg-main-05 px-2.5 py-0.5 text-[10px] font-medium leading-[1.6] text-main-01">
              {roleBadgeLabel}
            </span>
            {isSeller && (
              <span className="inline-flex w-fit items-center justify-center rounded-lg border border-orange-400 bg-orange-100 px-2.5 py-0.5 text-[10px] font-medium leading-[1.6] text-orange-400">
                셀러
              </span>
            )}
          </div>
          <span className="truncate typo-body-02-bold text-gray-01">
            {email || "이메일 없음"}
          </span>
        </div>
      </div>

      {/* 공지사항 | 사용 가이드 | 고객센터 */}
      <div className="flex shrink-0 items-center gap-4 py-3 pb-8">
        <NavLink
          href="/notice"
          onNavigate={handleTopNav}
          className="typo-body-02-bold text-gray-03 hover:text-gray-01"
        >
          공지사항
        </NavLink>
        <span className="h-[18px] w-px shrink-0 bg-gray-07" aria-hidden />
        <NavLink
          href="/guide"
          onNavigate={handleTopNav}
          className="typo-body-02-bold text-gray-03 hover:text-gray-01"
        >
          사용 가이드
        </NavLink>
        <span className="h-[18px] w-px shrink-0 bg-gray-07" aria-hidden />
        <NavLink
          href="/support"
          onNavigate={handleTopNav}
          className="typo-body-02-bold text-gray-03 hover:text-gray-01"
        >
          고객센터
        </NavLink>
      </div>
      <ComingSoonModal
        open={comingSoonOpen}
        onOpenChange={(open) => !open && setComingSoonOpen(false)}
      />

      {/* 네비게이션 섹션: 상위 카테고리 아래 2열 탭 메뉴 */}
      <nav
        className="flex flex-1 flex-col overflow-y-auto px-0 py-2"
        aria-label="관리 메뉴"
      >
        {/* 리뷰 관리 */}
        <div className="flex flex-col gap-4">
          <div>
            <SectionLabel>리뷰 관리</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <MobileGuardedLink
                href="/manage/reviews"
                isActive={isReviewManageActive}
                icon={<CommentIcon />}
                restricted
                onboarding={onboarding}
                storeLinkCtx={storeLinkCtx}
                aiCtx={aiCtx}
                onClose={onClose}
                onNavigate={handleNav}
              >
                댓글 관리
              </MobileGuardedLink>
              <MobileGuardedLink
                href="/manage/reviews/settings"
                isActive={isReviewSettingsActive}
                icon={<AiSettingsIcon />}
                restricted
                onboarding={onboarding}
                storeLinkCtx={storeLinkCtx}
                aiCtx={aiCtx}
                onClose={onClose}
                onNavigate={handleNav}
              >
                AI 댓글 설정
              </MobileGuardedLink>
            </div>
          </div>

          {/* 내 정보 관리 */}
          <div>
            <SectionLabel>내 정보 관리</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              <MobileNavLink
                href="/manage/stores"
                isActive={isStoresActive}
                icon={<StoreIcon />}
                onNavigate={handleNav}
              >
                매장 관리
              </MobileNavLink>
              <MobileNavLink
                href="/manage/mypage"
                isActive={isAccountActive}
                icon={<AccountIcon isAdmin={isAdmin} />}
                onNavigate={handleNav}
              >
                계정 관리
              </MobileNavLink>
            </div>
          </div>

          {/* 구매 및 청구 (셀러가 아닐 때만) */}
          {!isSeller && (
            <div>
              <SectionLabel>구매 및 청구</SectionLabel>
              <div className="grid grid-cols-2 gap-2">
                <MobileGuardedLink
                  href="/manage/billing/usage"
                  isActive={isBillingUsageActive}
                  icon={<UsageIcon />}
                  restricted
                  onboarding={onboarding}
                  storeLinkCtx={storeLinkCtx}
                  aiCtx={aiCtx}
                  onClose={onClose}
                  onNavigate={handleNav}
                >
                  이용 현황
                </MobileGuardedLink>
                <MobileGuardedLink
                  href="/manage/billing/payment"
                  isActive={isBillingPaymentActive}
                  icon={<PaymentIcon />}
                  restricted
                  onboarding={onboarding}
                  storeLinkCtx={storeLinkCtx}
                  aiCtx={aiCtx}
                  onClose={onClose}
                  onNavigate={handleNav}
                >
                  결제 관리
                </MobileGuardedLink>
              </div>
            </div>
          )}

          {/* 셀러 관리 */}
          <div>
            <SectionLabel>셀러 관리</SectionLabel>
            <div className="grid grid-cols-2 gap-2">
              {isSeller ? (
                <>
                  <MobileNavLink
                    href="/manage/sellers/link"
                    isActive={isSellerLinkActive}
                    icon={<LinkIcon />}
                    onNavigate={handleNav}
                  >
                    영업 링크
                  </MobileNavLink>
                  <MobileNavLink
                    href="/manage/sellers/customers"
                    isActive={isSellerCustomersActive}
                    icon={<PeopleIcon />}
                    onNavigate={handleNav}
                  >
                    고객 관리
                  </MobileNavLink>
                  <MobileNavLink
                    href="/manage/sellers/settlement"
                    isActive={isSellerSettlementActive}
                    icon={<MoneyIcon />}
                    onNavigate={handleNav}
                  >
                    정산 관리
                  </MobileNavLink>
                </>
              ) : (
                <MobileNavLink
                  href="/manage/sellers/apply"
                  isActive={isSellerApplyActive}
                  icon={<SellerApplyIcon />}
                  onNavigate={handleNav}
                >
                  셀러 등록 신청
                </MobileNavLink>
              )}
            </div>
          </div>

          {isAdmin && (
            <div className="mt-2">
              <button
                type="button"
                className="flex w-full items-center justify-center rounded-xl border border-gray-07 bg-gray-08 px-4 py-3 typo-body-02-bold text-gray-01 hover:bg-gray-07"
                onClick={() => handleNav("/manage/admin/customers")}
              >
                어드민 페이지
              </button>
            </div>
          )}
        </div>
      </nav>

      {/* 로그아웃 */}
      <div className="flex shrink-0 justify-end px-4 py-25 pr-2.5">
        <button
          type="button"
          className="typo-body-02-bold text-gray-05 hover:text-gray-01 py-3 pr-4.5"
          onClick={() => {
            onClose();
            signOut();
          }}
        >
          로그아웃
        </button>
      </div>
    </div>
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
  onNavigate,
  className,
  children,
}: {
  href: string;
  onNavigate: (href: string) => void;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
    >
      {children}
    </a>
  );
}

function MobileNavLink({
  href,
  isActive,
  icon,
  children,
  onNavigate,
}: {
  href: string;
  isActive: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate: (href: string) => void;
}) {
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      className={cn(
        "flex w-full items-center gap-3 py-3",
        navItemVariants({
          structure: "icon_parent",
          state: isActive ? "selected" : "default",
        }),
      )}
    >
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>img]:h-6 [&>img]:w-6 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      <span>{children}</span>
    </a>
  );
}

function MobileGuardedLink({
  href,
  isActive,
  icon,
  children,
  restricted,
  onboarding,
  storeLinkCtx,
  aiCtx,
  onClose,
  onNavigate,
}: {
  href: string;
  isActive: boolean;
  icon: React.ReactNode;
  children: React.ReactNode;
  restricted?: boolean;
  onboarding:
    | { hasLinkedStores?: boolean; aiSettingsCompleted?: boolean }
    | undefined;
  storeLinkCtx: ReturnType<typeof useStoreLinkRequired>;
  aiCtx: ReturnType<typeof useAiSettingsRequired>;
  onClose: () => void;
  onNavigate: (href: string) => void;
}) {
  const needsStoreLink =
    restricted && Boolean(onboarding && !onboarding.hasLinkedStores);
  const needsAiSettings =
    restricted &&
    Boolean(onboarding?.hasLinkedStores && !onboarding?.aiSettingsCompleted);
  const shouldBlock = needsStoreLink || needsAiSettings;

  const className = cn(
    "flex w-full items-center gap-3 py-3",
    navItemVariants({
      structure: "icon_parent",
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
    return (
      <button
        type="button"
        className={cn(className, "w-full text-left")}
        onClick={() => {
          onClose();
          if (needsStoreLink) storeLinkCtx?.openModal();
          else aiCtx?.openModal();
        }}
      >
        {content}
      </button>
    );
  }
  return (
    <a
      href={href}
      onClick={(e) => {
        e.preventDefault();
        onNavigate(href);
      }}
      className={className}
    >
      {content}
    </a>
  );
}

function CloseIcon() {
  return <Icon24 src={closeIcon} alt="" pixelSize={28} />;
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
function SellerApplyIcon() {
  return <Icon24 src={sellerIcon} alt="" />;
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
