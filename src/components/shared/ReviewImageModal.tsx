"use client";

import { useEffect, useCallback, useState } from "react";

export type ReviewImage = { imageUrl: string };

type Props = {
  images: ReviewImage[];
  initialIndex?: number;
  onClose: () => void;
};

export function ReviewImageModal({
  images,
  initialIndex = 0,
  onClose,
}: Props) {
  const [index, setIndex] = useState(() =>
    Math.min(
      Math.max(0, initialIndex),
      images.length > 0 ? images.length - 1 : 0
    )
  );
  useEffect(() => {
    const next = Math.min(
      Math.max(0, initialIndex),
      images.length > 0 ? images.length - 1 : 0
    );
    setIndex(next);
  }, [initialIndex, images.length]);
  const current = images[index];

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleKeyDown]);

  if (images.length === 0) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="리뷰 이미지 확대"
    >
      <div
        className="relative flex max-h-[90vh] max-w-[90vw] items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute -right-2 -top-2 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-white/90 text-black shadow-md transition hover:bg-white"
          aria-label="닫기"
        >
          <span className="text-xl leading-none">&times;</span>
        </button>
        <img
          src={current.imageUrl}
          alt={`리뷰 이미지 ${index + 1}`}
          className="max-h-[90vh] max-w-full rounded-lg object-contain shadow-lg"
          onClick={(e) => e.stopPropagation()}
        />
        {images.length > 1 && (
          <>
            <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded bg-black/60 px-3 py-1 text-sm text-white">
              {index + 1} / {images.length}
            </span>
            {index > 0 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => i - 1);
                }}
                className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black shadow hover:bg-white"
                aria-label="이전 이미지"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            {index < images.length - 1 && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIndex((i) => i + 1);
                }}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-2 text-black shadow hover:bg-white"
                aria-label="다음 이미지"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
