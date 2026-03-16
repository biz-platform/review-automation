"use client";

import { Card } from "@/components/ui/card";
import { AI_TONE_OPTIONS, AI_LENGTH_OPTIONS } from "./constants";
import { cn } from "@/lib/utils/cn";

export interface CustomAiTabProps {
  storeId: string;
  storeList: { id: string; name: string }[];
  selectedStoreId: string;
  onStoreChange: (id: string) => void;
  tone: string;
  length: string;
  onToneChange: (tone: string) => void;
  onLengthChange: (length: string) => void;
  toneLoading: boolean;
  /** 마케팅 문구가 있으면 '길게' 비활성화 및 보통으로 강제 */
  hasMarketingText?: boolean;
}

/** 우리 가게 맞춤 AI 탭: 톤 카드 + 댓글 길이. 저장은 상단 공통 하단 바 사용 */
export function CustomAiTab({
  tone: effectiveTone,
  length: effectiveLength,
  onToneChange,
  onLengthChange,
  toneLoading,
  hasMarketingText = false,
}: CustomAiTabProps) {
  return (
    <>
      <section className="mb-8">
        <h2 className="typo-body-01-bold mb-4 flex items-center gap-1.5 text-gray-01">
          AI 말투
          <span
            className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-01"
            aria-hidden
          />
        </h2>
        {toneLoading ? (
          <p className="typo-body-02-regular text-gray-04">설정 불러오는 중…</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {AI_TONE_OPTIONS.map((opt) => {
              const selected = effectiveTone === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToneChange(opt.value)}
                  className={cn(
                    "flex w-full flex-row items-stretch gap-5 rounded-lg border px-4 py-5 text-left transition-colors bg-background",
                    selected
                      ? "border-main-02 bg-main-05"
                      : "border-gray-07 hover:border-gray-06",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 mt-0.5",
                      selected
                        ? "border-main-02 bg-main-02"
                        : "border-gray-06 bg-background",
                    )}
                    aria-hidden
                  >
                    {selected && (
                      <svg
                        className="h-3 w-3 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    )}
                  </span>
                  <div className="flex min-w-0 flex-1 flex-col items-stretch gap-5">
                    <div className="flex flex-col gap-3">
                      <span className="typo-body-01-bold text-gray-01">
                        {opt.label}
                      </span>
                      <p className="typo-body-02-regular whitespace-pre-line text-gray-02">
                        {opt.description}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-07 bg-white px-4 py-5">
                      <p className="typo-body-03-bold mb-2 text-gray-04">
                        AI 추천 댓글
                      </p>
                      <p className="typo-body-02-regular text-gray-02 line-clamp-3">
                        {opt.example}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <h2 className="typo-body-01-bold mb-4 flex items-center gap-1.5 text-gray-01">
        AI 댓글 길이
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-01"
          aria-hidden
        />
      </h2>
      <Card variant="default" padding="lg" className="mb-[100px]">
        <p className="typo-body-03-regular mb-2 text-gray-04">평균 글자 수</p>
        <p className="typo-body-03-regular mb-4 text-gray-04">
          설정한 글자 수 범위 안에서 자연스럽게 길이를 맞춰 생성해 드려요
        </p>
        <div className="flex flex-wrap gap-0 overflow-hidden rounded-lg border border-gray-07">
          {AI_LENGTH_OPTIONS.map((opt) => {
            const isLong = opt.value === "long";
            const disabled = hasMarketingText && isLong;
            const selected = effectiveLength === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                disabled={disabled}
                onClick={() => !disabled && onLengthChange(opt.value)}
                className={cn(
                  "flex-1 min-w-0 px-4 py-3 typo-body-03-bold transition-colors first:rounded-l-lg last:rounded-r-lg",
                  selected
                    ? "border-2 border-main-02 bg-main-05 text-gray-01"
                    : "bg-background text-gray-02 hover:bg-gray-08",
                  disabled && "cursor-not-allowed opacity-50",
                )}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </Card>
    </>
  );
}
