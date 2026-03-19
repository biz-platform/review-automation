"use client";

const INPUT_CLASS =
  "h-12 min-w-0 flex-1 rounded-lg border border-gray-07 bg-white px-3 typo-body-02-regular text-gray-01 outline-none focus:border-main-02 focus:ring-1 focus:ring-main-02";

export interface DateRangeFilterProps {
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  /** 라벨. 없으면 라벨 미표시 */
  label?: string;
  /** 라벨+입력 세로 배치 시 사용 (단독 필터 블록). false면 입력만 */
  showLabel?: boolean;
  /** 래퍼 div className. 기본값은 매장 목록 필터와 열 맞춤용 너비 포함 */
  className?: string;
}

/**
 * 기간(시작일 ~ 종료일) 필터. 매장 목록, 매장 상세, 작업 로그 등에서 재사용.
 * showLabel=false: 라벨 행/컨트롤 행 분리 레이아웃에서 컨트롤만 렌더.
 */
export function DateRangeFilter({
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  label = "기간",
  showLabel = true,
  className = "flex w-[292px] shrink-0 items-center gap-2",
}: DateRangeFilterProps) {
  const inputs = (
    <div className={className}>
      <input
        type="date"
        value={dateFrom}
        onChange={(e) => onDateFromChange(e.target.value)}
        className={INPUT_CLASS}
        aria-label={label ? `${label} 시작일` : "시작일"}
      />
      <span className="typo-body-02-regular text-gray-05">~</span>
      <input
        type="date"
        value={dateTo}
        onChange={(e) => onDateToChange(e.target.value)}
        className={INPUT_CLASS}
        aria-label={label ? `${label} 종료일` : "종료일"}
      />
    </div>
  );

  if (!showLabel) return inputs;

  return (
    <div className="flex shrink-0 flex-col gap-1">
      <h2 className="typo-body-03-bold text-gray-01">{label}</h2>
      {inputs}
    </div>
  );
}
