"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";

/**
 * /manage 진입 시: 가게가 없으면 매장 관리로, 있으면 리뷰 관리로 이동.
 * 가게 연동이 안 된 신규 유저만 매장 연동 흐름으로 유도.
 * isSuccess일 때만 판단해, 에러/로딩 시에는 리뷰 관리로 보내서 깜빡임 방지.
 */
export default function ManagePage() {
  const router = useRouter();
  const { data: stores, isSuccess, isError } = useStoreList();

  useEffect(() => {
    if (isError) {
      router.replace("/manage/reviews");
      return;
    }
    if (!isSuccess) return;
    const hasStores = Array.isArray(stores) && stores.length > 0;
    if (hasStores) {
      router.replace("/manage/reviews");
    } else {
      router.replace("/manage/stores");
    }
  }, [isSuccess, isError, stores, router]);

  return (
    <div className="flex min-h-[200px] items-center justify-center">
      <p className="typo-body-02-regular text-gray-04">이동 중…</p>
    </div>
  );
}
