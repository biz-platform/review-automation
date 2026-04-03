"use client";

import { Icon24 } from "@/components/ui/Icon24";
import visibilityOnIcon from "@/assets/icons/24px/visibility-on.webp";
import receiptIcon from "@/assets/icons/24px/receipt.webp";
import starIcon from "@/assets/icons/24px/star.webp";
import storeIcon from "@/assets/icons/24px/store.webp";

const WRAP = "flex h-8 w-8 items-center justify-center";

export function StoreDashboardShellTabIcon({ href }: { href: string }) {
  if (href.endsWith("/summary")) {
    return (
      <span className={WRAP} aria-hidden>
        <Icon24 src={visibilityOnIcon} alt="" />
      </span>
    );
  }
  if (href.endsWith("/sales")) {
    return (
      <span className={WRAP} aria-hidden>
        <Icon24 src={receiptIcon} alt="" />
      </span>
    );
  }
  if (href.endsWith("/reviews")) {
    return (
      <span className={WRAP} aria-hidden>
        <Icon24 src={starIcon} alt="" />
      </span>
    );
  }
  return (
    <span className={WRAP} aria-hidden>
      <Icon24 src={storeIcon} alt="" />
    </span>
  );
}
