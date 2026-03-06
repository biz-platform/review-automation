"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils/cn";

const modalShadow =
  "shadow-[10px_10px_15px_0px_rgba(0,0,0,0.20)] shadow-[-4px_-4px_15px_0px_rgba(0,0,0,0.15)]";

export interface ModalProps {
  /** 열림 여부 */
  open: boolean;
  /** 닫기 요청 (overlay/escape 시) */
  onOpenChange: (open: false) => void;
  /** 모달 타이틀 */
  title: string;
  /** 본문. description만 쓸 경우 기본 스타일(텍스트) 적용 */
  description?: React.ReactNode;
  /** 본문 영역 전체를 커스텀할 때 (description 대신) */
  children?: React.ReactNode;
  /** 푸터 버튼 영역 (우측 정렬). Button 조합 넘기면 됨 */
  footer?: React.ReactNode;
  /** 콘텐츠 박스 크기 */
  size?: "sm" | "default";
  /** 콘텐츠 박스 추가 클래스 */
  className?: string;
}

/**
 * 모달 창
 * - 배경: bg-white, rounded-lg, shadow(디자인 스펙)
 * - 타이틀: typo-heading-01-bold text-gray-01
 * - 본문: typo-body-02-regular text-gray-03 (description 사용 시)
 * - 푸터: gap-2, items-end (버튼 배치)
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  size = "default",
  className,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div
        className="absolute inset-0 bg-black/50"
        onClick={() => onOpenChange(false)}
      />
      <div
        role="dialog"
        className={cn(
          "relative w-full max-w-[480px] rounded-lg bg-white px-10 pt-9 pb-7",
          modalShadow,
          size === "sm" && "max-w-[384px] px-8",
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col items-center justify-center gap-2.5">
          <div className="flex w-full flex-col items-end gap-7">
            <div className="flex w-full flex-col items-start gap-6">
              <h2
                id="modal-title"
                className="w-full typo-heading-01-bold text-gray-01"
              >
                {title}
              </h2>
              {children != null ? (
                <div className="w-full max-w-96">{children}</div>
              ) : description != null ? (
                <div className="w-full max-w-96 min-h-11 typo-body-02-regular text-gray-03">
                  {description}
                </div>
              ) : null}
            </div>
            {footer != null && (
              <div className="inline-flex items-start justify-start gap-2">
                {footer}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
Modal.displayName = "Modal";
