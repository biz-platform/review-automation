"use client";

import Link from "next/link";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useSearchParams } from "next/navigation";

const PLATFORM_LABEL: Record<string, string> = {
  baedal: "배달의민족",
  coupang_eats: "쿠팡이츠",
  yogiyo: "요기요",
  danggeoyo: "땡겨요",
  naver: "네이버",
};

export default function StoresPage() {
  const searchParams = useSearchParams();
  const accountsMode = searchParams.get("accounts") === "1";
  const platform = searchParams.get("platform") ?? "";
  const { data: stores, isLoading, error } = useStoreList();

  if (isLoading) return <p className="p-8">로딩 중…</p>;
  if (error) return <p className="p-8 text-red-600">오류: {String(error)}</p>;

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">매장 관리</h1>
        <Link
          href="/stores/new"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground"
        >
          매장 등록
        </Link>
      </div>

      {accountsMode && platform && (
        <div className="mb-6 rounded-lg border border-border bg-muted/50 p-4">
          <p className="font-medium">
            {PLATFORM_LABEL[platform] ?? platform} 계정을 연동할 매장을 선택한 뒤 &quot;계정 설정&quot;에서 로그인해 주세요.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {(stores ?? []).map((store) => (
          <li key={store.id} className="flex items-center gap-4 rounded-lg border border-border p-4">
            <Link href={`/stores/${store.id}`} className="font-medium hover:underline">
              {store.name}
            </Link>
            <Link
              href={`/stores/${store.id}/reviews`}
              className="text-sm text-muted-foreground hover:underline"
            >
              리뷰 보기
            </Link>
            <Link
              href={`/stores/${store.id}/accounts${platform ? `?platform=${platform}` : ""}`}
              className="text-sm text-primary hover:underline"
            >
              계정 설정
            </Link>
          </li>
        ))}
      </ul>
      {(!stores || stores.length === 0) && (
        <p className="text-muted-foreground">등록된 매장이 없습니다.</p>
      )}
    </div>
  );
}
