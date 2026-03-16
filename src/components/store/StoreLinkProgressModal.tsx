"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const STEP_SWITCH_MS = 3_000;

export interface StoreLinkProgressModalProps {
  show: boolean;
  platformLabel?: string;
}

/** 연동 중 1/2: 검증 단계 아이콘 (사람+책상, 돋보기, 노트) */
function Step1Icons() {
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.75 6a3.75 3.75 0 11-7.5 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998-5.059l-1.5-1.5"
          />
        </svg>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5v-7.5H8.25v7.5z"
          />
        </svg>
      </div>
    </div>
  );
}

/** 연동 중 2/2: 매장 정보 가져오기 아이콘 (햄버거, 초밥, 케이크) */
function Step2Icons() {
  return (
    <div className="flex items-center justify-center gap-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M18 6h-1V5c0-1.1-.9-2-2-2H9c-1.1 0-2 .9-2 2v1H6c-1.1 0-2 .9-2 2v2c0 .55.22 1.05.58 1.41L7 12v8c0 .55.45 1 1 1h8c.55 0 1-.45 1-1v-8l2.42-2.59c.36-.36.58-.86.58-1.41V8c0-1.1-.9-2-2-2zm-2 0H8V5h8v1z" />
        </svg>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M18 8H6c-1.1 0-2 .9-2 2v6c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2v-6c0-1.1-.9-2-2-2zm-1 7H7v-2h10v2zm-5-5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
        </svg>
      </div>
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-08 text-gray-05">
        <svg
          className="h-6 w-6"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
        </svg>
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
