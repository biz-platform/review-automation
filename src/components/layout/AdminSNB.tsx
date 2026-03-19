"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { cn } from "@/lib/utils/cn";
import { useSignOut } from "@/lib/hooks/use-sign-out";

export function AdminSNB() {
  const pathname = usePathname();
  const { signOut } = useSignOut();

  const isAdminCustomersActive = pathname.startsWith("/manage/admin/customers");
  const isAdminStoresActive = pathname.startsWith("/manage/admin/stores");
  const isAdminPaymentsActive = pathname.startsWith("/manage/admin/payments");
  const isAdminSellersActive = pathname.startsWith("/manage/sellers/link");
  const isAdminSettlementActive = pathname.startsWith(
    "/manage/admin/settlements",
  );

  return (
    <aside className="sticky top-20 hidden h-screen w-lnb shrink-0 self-start overflow-y-auto border-r border-border bg-gray-08 lg:block">
      <nav className="flex h-full flex-col gap-1 py-4">
        <SectionLabel>올리뷰 서비스 고객</SectionLabel>
        <NavLink
          href="/manage/admin/customers"
          isActive={isAdminCustomersActive}
          icon={<PeopleIcon />}
        >
          고객 관리
        </NavLink>
        <NavLink
          href="/manage/admin/stores"
          isActive={isAdminStoresActive}
          icon={<StoreIcon />}
        >
          매장 관리
        </NavLink>
        <NavLink
          href="/manage/admin/payments"
          isActive={isAdminPaymentsActive}
          icon={<PaymentIcon />}
        >
          결제 조회
        </NavLink>

        <SectionLabel>올리뷰 서비스 셀러</SectionLabel>
        <NavLink
          href="/manage/admin/sellers"
          isActive={isAdminSellersActive}
          icon={<SellerIcon />}
        >
          셀러 관리
        </NavLink>
        <NavLink
          href="/manage/admin/settlements"
          isActive={isAdminSettlementActive}
          icon={<MoneyIcon />}
        >
          정산 관리
        </NavLink>

        <div className="mt-auto px-2 pb-4 pt-6">
          <button
            type="button"
            className="mt-2 w-full rounded-lg px-4 py-3 text-left text-gray-05 hover:bg-gray-07 hover:text-gray-01"
            onClick={() => void signOut()}
          >
            로그아웃
          </button>
        </div>
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

function SellerIcon() {
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
      <path d="M4 7h16M7 7v10M17 7v10M4 17h16" />
      <path d="M9 17v-4h6v4" />
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
