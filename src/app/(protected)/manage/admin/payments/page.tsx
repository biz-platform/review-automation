"use client";

import { useAccountProfile } from "@/lib/hooks/use-account-profile";

function isAdminLikeRole(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin);
}

export default function AdminPaymentsPage() {
  const { data: profile, isLoading } = useAccountProfile();

  if (isLoading) {
    return (
      <div className="p-6 md:p-8">
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      </div>
    );
  }

  if (!isAdminLikeRole(profile?.is_admin)) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">결제 조회</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <h1 className="typo-heading-01-bold text-gray-01">결제 조회</h1>
      <p className="mt-4 typo-body-02-regular text-gray-03">
        결제 조회 페이지는 준비 중입니다.
      </p>
    </div>
  );
}
