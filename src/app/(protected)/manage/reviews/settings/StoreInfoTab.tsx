"use client";

import { TextField } from "@/components/ui/text-field";

export interface StoreInfoTabProps {
  industry: string;
  customerSegment: string;
  onIndustryChange: (value: string) => void;
  onCustomerSegmentChange: (value: string) => void;
}

/** 매장 정보 탭: 댓글 작성 정보 (업종, 주요 고객층). 저장은 상단 공통 하단 바 사용 */
export function StoreInfoTab({
  industry,
  customerSegment,
  onIndustryChange,
  onCustomerSegmentChange,
}: StoreInfoTabProps) {
  return (
    <section className="mb-8">
      <h2 className="typo-body-01-bold mb-2 text-gray-01">댓글 작성 정보</h2>
      <p className="typo-body-02-regular mb-6 text-gray-04">
        입력하면 AI가 더 정확하게 댓글을 작성할 수 있어요
      </p>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TextField
          label="업종"
          placeholder="업종을 입력해주세요 예) 소고기, 해산물, 카페"
          value={industry}
          onChange={(e) => onIndustryChange(e.target.value)}
          className="mb-0"
        />
        <TextField
          label="주요 고객층"
          placeholder="가게의 특징을 간단하게 적어주세요 예) 직장인 점심, 가성비, 프리미엄"
          value={customerSegment}
          onChange={(e) => onCustomerSegmentChange(e.target.value)}
          className="mb-0"
        />
      </div>
    </section>
  );
}
