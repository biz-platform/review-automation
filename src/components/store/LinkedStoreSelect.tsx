"use client";

import { NativeSelect } from "@/components/ui/native-select";

export interface LinkedStoreSelectProps {
  /** 매장 목록 (GET /stores 의 display_name 권장) */
  stores: { id: string; name: string; display_name?: string }[];
  /** 선택된 store id */
  value: string;
  onChange: (storeId: string) => void;
  /** 라벨 텍스트. 기본: 연동 매장 */
  label?: string;
  className?: string;
}

/**
 * 연동 매장 선택 드롭다운. 리뷰 관리, AI 댓글 설정 등에서 공통 사용.
 */
export function LinkedStoreSelect({
  stores,
  value,
  onChange,
  label = "연동 매장",
  className,
}: LinkedStoreSelectProps) {
  return (
    <div className={className ? `flex items-center gap-4 ${className}` : "mb-4 flex items-center gap-4"}>
      <span className="typo-body-02-medium text-gray-01">{label}</span>
      <NativeSelect
        value={value}
        onChange={(e) => onChange(e.target.value)}
        options={stores.map((s) => ({
          value: s.id,
          label: (s.display_name ?? s.name ?? "").trim() || "매장",
        }))}
        className="mb-0 max-w-xs flex-1"
      />
    </div>
  );
}
