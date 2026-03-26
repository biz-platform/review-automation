"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import { COMMENT_REGISTER_OPTIONS } from "./constants";
import { formatScheduledHourLabel } from "./formatScheduledHour";
import { cn } from "@/lib/utils/cn";

export interface CommentRegisterTabProps {
  mode: "direct" | "auto";
  onModeChange: (mode: "direct" | "auto") => void;
  scheduledHour: number;
  onScheduledHourChange: (hour: number) => void;
}

/** 댓글 등록 탭: 등록 방법(직접/자동) + 리뷰 등록 시간. 저장은 상단 공통 하단 바 사용 */
export function CommentRegisterTab({
  mode,
  onModeChange,
  scheduledHour,
  onScheduledHourChange,
}: CommentRegisterTabProps) {
  const isAuto = mode === "auto";

  const timePicker = (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center gap-3 rounded-lg border border-gray-07 px-4 py-3",
        !isAuto && "cursor-not-allowed opacity-60",
      )}
    >
      <button
        type="button"
        aria-label="한 시간 앞으로"
        disabled={!isAuto}
        onClick={() => onScheduledHourChange((scheduledHour - 1 + 24) % 24)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-04 hover:enabled:text-gray-01 disabled:pointer-events-none"
      >
        <ChevronLeftIcon />
      </button>
      <span
        className={cn(
          "min-w-24 text-center typo-body-02-regular",
          isAuto ? "text-gray-01" : "text-gray-04",
        )}
      >
        {formatScheduledHourLabel(scheduledHour)}
      </span>
      <button
        type="button"
        aria-label="한 시간 뒤로"
        disabled={!isAuto}
        onClick={() => onScheduledHourChange((scheduledHour + 1) % 24)}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-gray-04 hover:enabled:text-gray-01 disabled:pointer-events-none"
      >
        <ChevronRightIcon />
      </button>
    </div>
  );

  return (
    <section>
      <h2 className="typo-body-01-bold mb-4 text-gray-01">등록 방법</h2>
      <div className="rounded-lg border border-gray-07 p-5">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2.5">
              <h3 className="typo-body-01-bold text-gray-01">리뷰 자동 댓글</h3>
              <p className="typo-body-02-regular text-gray-04">
                예약 시각의 동기화가 끝난 뒤, 미답변 리뷰에 AI 초안을 만들고
                조건을 맞추면 플랫폼에 댓글까지 등록해요. 댓글 관리 화면의
                「실시간 리뷰 불러오기」는 동기화만 하며 이 흐름과 별개예요.
              </p>
            </div>
            <div className="flex">
              {COMMENT_REGISTER_OPTIONS.map((opt, index) => {
                const selected = mode === opt.value;
                const isFirst = index === 0;
                const isLast = index === COMMENT_REGISTER_OPTIONS.length - 1;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onModeChange(opt.value as "direct" | "auto")}
                    className={cn(
                      "flex flex-1 items-center justify-center px-4 py-3 typo-body-02-regular text-gray-01 transition-colors",
                      isFirst &&
                        "rounded-l-lg border border-gray-07 border-r-0",
                      isLast && "-ml-px rounded-r-lg border border-gray-07",
                      selected && "border-main-02 bg-main-05",
                    )}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-gray-07 pt-6">
            <h3 className="typo-body-01-bold mb-2.5 text-gray-01 lg:mb-0">
              리뷰 등록 시간
            </h3>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between lg:gap-4">
              <p className="typo-body-02-regular text-gray-04">
                선택한 시간에 하루 한 번 자동으로 리뷰가 등록돼요
              </p>
              {timePicker}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
