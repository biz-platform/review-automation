"use client";

import { Icon24 } from "@/components/ui/Icon24";
import eyesIcon from "@/assets/icons/28px/eyes.webp";
import receiptIcon from "@/assets/icons/28px/receipt.webp";
import starIcon from "@/assets/icons/28px/star1.webp";
import foodIcon from "@/assets/icons/28px/food1.webp";

const WRAP = "flex h-8 w-8 items-center justify-center";

export function DashboardShellTabIcon({ href }: { href: string }) {
  if (href.endsWith("/summary")) {
    return (
      <span className={WRAP} aria-hidden>
        <Icon24 src={eyesIcon} alt="" pixelSize={28} />
      </span>
    );
  }
  if (href.endsWith("/sales")) {
    return (
      <span className={WRAP} aria-hidden>
        <Icon24 src={receiptIcon} alt="" pixelSize={28} />
      </span>
    );
  }
  if (href.endsWith("/reviews")) {
    return (
      <span className={WRAP} aria-hidden>
        <Icon24 src={starIcon} alt="" pixelSize={28} />
      </span>
    );
  }
  return (
    <span className={WRAP} aria-hidden>
      <Icon24 src={foodIcon} alt="" pixelSize={28} />
    </span>
  );
}
