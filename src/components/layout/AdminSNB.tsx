"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navItemVariants } from "@/components/ui/nav-item";
import { Icon24 } from "@/components/ui/Icon24";
import { cn } from "@/lib/utils/cn";
import { useSignOut } from "@/lib/hooks/use-sign-out";
import peopleIcon from "@/assets/icons/24px/people.webp";
import storeIcon from "@/assets/icons/24px/store.webp";
import cardIcon from "@/assets/icons/24px/card.webp";
import sellerIcon from "@/assets/icons/24px/seller.webp";
import moneyIcon from "@/assets/icons/24px/money.webp";

export function AdminSNB() {
  const pathname = usePathname();
  const { signOut } = useSignOut();

  const isAdminCustomersActive = pathname.startsWith("/manage/admin/customers");
  const isAdminStoresActive = pathname.startsWith("/manage/admin/stores");
  const isAdminPaymentsActive = pathname.startsWith("/manage/admin/payments");
  const isAdminSellersActive = pathname.startsWith("/manage/admin/sellers");
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
      <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>img]:h-6 [&>img]:w-6 [&>svg]:h-6 [&>svg]:w-6">
        {icon}
      </span>
      <span>{children}</span>
    </Link>
  );
}

function PeopleIcon() {
  return <Icon24 src={peopleIcon} alt="" />;
}

function StoreIcon() {
  return <Icon24 src={storeIcon} alt="" />;
}

function PaymentIcon() {
  return <Icon24 src={cardIcon} alt="" />;
}

function SellerIcon() {
  return <Icon24 src={sellerIcon} alt="" />;
}

function MoneyIcon() {
  return <Icon24 src={moneyIcon} alt="" />;
}
