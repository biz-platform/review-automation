"use client";

import { Card } from "@/components/ui/card";
import { useFormattedBusinessRegistration } from "@/lib/hooks/use-formatted-business-registration";

export interface LinkedStoreCardProps {
  storeName: string;
  externalShopId: string | null;
  shopCategory: string | null;
  businessRegistrationNumber: string | null;
}

function display(v: string | null): string {
  return v?.trim() ? v : "—";
}

export function LinkedStoreCard({
  storeName,
  externalShopId,
  shopCategory,
  businessRegistrationNumber,
}: LinkedStoreCardProps) {
  const formattedBusinessNumber =
    useFormattedBusinessRegistration(businessRegistrationNumber);

  return (
    <Card
      padding="none"
      variant="default"
      className="rounded-xl border-gray-07 py-5 px-4"
    >
      <p className="typo-body-01-bold mb-5 text-gray-01">{storeName}</p>
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="typo-body-02-bold text-gray-01">가게 아이디</span>
          <span className="typo-body-02-regular text-right text-gray-02">
            {display(externalShopId)}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="typo-body-02-bold text-gray-01">사업자 번호</span>
          <span className="typo-body-02-regular text-right text-gray-02">
            {formattedBusinessNumber}
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="typo-body-02-bold text-gray-01">업종</span>
          <span className="typo-body-02-regular text-right text-gray-02">
            {display(shopCategory)}
          </span>
        </div>
      </div>
    </Card>
  );
}
