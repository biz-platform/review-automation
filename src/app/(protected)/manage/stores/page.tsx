"use client";

import Link from "next/link";
import { useStoreList } from "@/entities/store/hooks/query/use-store-list";
import { useSearchParams } from "next/navigation";
import { PLATFORM_LABEL } from "@/const/platform";
import { Card } from "@/components/ui/card";

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
          href="/manage/stores/new"
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90"
        >
          매장 등록
        </Link>
      </div>

      {accountsMode && platform && (
        <Card variant="muted" padding="md" className="mb-6">
          <p className="font-medium">
            {PLATFORM_LABEL[platform] ?? platform} 계정을 연동할 매장을 선택한
            뒤 &quot;계정 설정&quot;에서 로그인해 주세요.
          </p>
        </Card>
      )}

      <ul className="space-y-2">
        {(stores ?? []).map((store) => (
          <li key={store.id}>
            <Card padding="md" className="flex items-center gap-4">
              <Link
                href={`/manage/stores/${store.id}`}
                className="font-medium hover:underline"
              >
                {store.name}
              </Link>
              <Link
                href={`/manage/stores/${store.id}/reviews`}
                className="text-sm text-muted-foreground hover:underline"
              >
                리뷰 보기
              </Link>
              <Link
                href={`/manage/stores/${store.id}/accounts${platform ? `?platform=${platform}` : ""}`}
                className="text-sm text-primary hover:underline"
              >
                계정 설정
              </Link>
            </Card>
          </li>
        ))}
      </ul>
      {(!stores || stores.length === 0) && (
        <p className="text-muted-foreground">등록된 매장이 없습니다.</p>
      )}
    </div>
  );
}
