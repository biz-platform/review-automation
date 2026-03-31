"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";
import { Icon24 } from "@/components/ui/Icon24";
import { UserProfileRasterIcon } from "@/components/ui/UserProfileRasterIcon";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import searchIcon from "@/assets/icons/36px/search.webp";
import documentIcon from "@/assets/icons/24px/document.webp";
import menuIcon from "@/assets/icons/28px/menu.webp";
import receiptIcon from "@/assets/icons/28px/receipt.webp";
import starIcon from "@/assets/icons/28px/star1.webp";

const STEP_SWITCH_MS = 3_000;

export interface StoreLinkProgressModalProps {
  show: boolean;
  platformLabel?: string;
}

/** 연동 중 1/2: 검증 단계 */
function Step1Icons() {
  const { data: profile } = useAccountProfile();
  const isAdmin = profile?.is_admin ?? false;
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <UserProfileRasterIcon
          isAdmin={isAdmin}
          pixelSize={40}
          className="h-6 w-6"
        />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <Icon24
          src={searchIcon}
          alt=""
          pixelSize={36}
          className="h-6 w-6"
        />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <Icon24 src={documentIcon} alt="" className="h-6 w-6" />
      </div>
    </div>
  );
}

/** 연동 중 2/2: 매장 정보 가져오기 */
function Step2Icons() {
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <Icon24 src={menuIcon} alt="" pixelSize={28} className="h-6 w-6" />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <Icon24 src={receiptIcon} alt="" pixelSize={28} className="h-6 w-6" />
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <Icon24 src={starIcon} alt="" pixelSize={28} className="h-6 w-6" />
      </div>
    </div>
  );
}

/** 플랫폼 공통: 배민/쿠팡이츠/요기요/땡겨요 연동 진행 모달 */
const STEP_CONTENT = {
  1: {
    line1: "계정 정보를 확인하고 있어요",
    line2: "입력한 정보가 맞는지 검증 중이에요",
    Icons: Step1Icons,
  },
  2: {
    line1: "매장 정보를 가져오고 있어요",
    line2: "리뷰 연동을 위한 준비 단계예요",
    Icons: Step2Icons,
  },
} as const;

export function StoreLinkProgressModal({
  show,
  platformLabel = "배달의민족",
}: StoreLinkProgressModalProps) {
  const [step, setStep] = useState<1 | 2>(1);

  useEffect(() => {
    if (!show) {
      setStep(1);
      return;
    }
    const t = setTimeout(() => setStep(2), STEP_SWITCH_MS);
    return () => clearTimeout(t);
  }, [show]);

  if (!show) return null;

  const content = STEP_CONTENT[step];
  const Icons = content.Icons;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal
      aria-labelledby="store-link-progress-title"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-hidden
      />
      <div
        role="dialog"
        className={cn(
          "relative w-full max-w-[400px] rounded-2xl bg-white px-8 py-10 shadow-[10px_10px_15px_0px_rgba(0,0,0,0.20)] shadow-[-4px_-4px_15px_0px_rgba(0,0,0,0.15)]",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center text-center">
          <h2
            id="store-link-progress-title"
            className="typo-heading-02-bold mb-8 text-gray-01"
          >
            {platformLabel} 매장 연동 중 {step}/2
          </h2>
          <div className="mb-8">
            <Icons />
          </div>
          <p className="typo-body-02-regular text-gray-04">{content.line1}</p>
          <p className="typo-body-02-regular mt-1 text-gray-04">
            {content.line2}
          </p>
        </div>
      </div>
    </div>
  );
}
