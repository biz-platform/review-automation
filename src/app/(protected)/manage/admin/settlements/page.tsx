"use client";

import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { ContentStateMessage } from "@/components/ui/content-state-message";

function isAdminLike(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin);
}

export default function AdminSettlementsPage() {
  const { data: profile, isLoading } = useAccountProfile();

  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      </div>
    );
  }

  if (!isAdminLike(profile?.is_admin)) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">정산 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="typo-heading-01-bold text-gray-01">정산 관리</h1>
      <p className="mt-4 typo-body-02-regular text-gray-03">
        정산 관리 페이지는 준비 중입니다.
      </p>
    </div>
  );
}
