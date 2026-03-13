"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { cn } from "@/lib/utils/cn";
import { useOnboarding } from "@/lib/hooks/use-onboarding";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import { useAiSettingsRequired } from "@/app/(protected)/AiSettingsRequiredContext";
import { useStoreLinkRequired } from "@/app/(protected)/StoreLinkRequiredContext";
import type { AuthSessionUser } from "@/lib/hooks/use-auth-session";

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
    <div className="flex min-h-full flex-col bg-white md:hidden p-4">
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
          <ProfileIcon />
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
          onNavigate={handleNav}
          className="typo-body-02-bold text-gray-03 hover:text-gray-01"
        >
          공지사항
        </NavLink>
        <span className="h-[18px] w-px shrink-0 bg-gray-07" aria-hidden />
        <NavLink
          href="/guide"
          onNavigate={handleNav}
          className="typo-body-02-bold text-gray-03 hover:text-gray-01"
        >
          사용 가이드
        </NavLink>
        <span className="h-[18px] w-px shrink-0 bg-gray-07" aria-hidden />
        <NavLink
          href="/support"
          onNavigate={handleNav}
          className="typo-body-02-bold text-gray-03 hover:text-gray-01"
        >
          고객센터
        </NavLink>
      </div>

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
                icon={<AccountIcon />}
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>svg]:h-6 [&>svg]:w-6">
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
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-7 w-7"
      aria-hidden
    >
      <path d="M7 7l14 14M21 7L7 21" />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg
      viewBox="0 0 40 40"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-10 w-10"
      aria-hidden
    >
      <circle cx="20" cy="14" r="6" />
      <path d="M8 34c0-6.6 5.4-12 12-12s12 5.4 12 12" />
    </svg>
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
      <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
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
