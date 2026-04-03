"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { SellerApplyModal } from "@/components/sellers/SellerApplyModal";
import { SellerListSection } from "@/components/sellers";
import {
  applySellerForAdmin,
  getAdminCustomers,
  updateAdminCustomerReferral,
  updateAdminCustomerRole,
} from "@/entities/admin/api/customer-api";
import type {
  AdminCustomerData,
  AdminCustomerFilterValue,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import {
  AdminCustomerFilters,
  AdminCustomerTable,
  AdminCustomerMobileList,
  AdminReferralLinkModal,
  PAGE_SIZE,
  optionToRole,
  rowToOption,
} from "./_components";

function isAdminLikeRole(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin);
}

export default function AdminCustomersPage() {
  const { data: profile, isLoading: profileLoading } = useAccountProfile();
  const [keyword, setKeyword] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [memberType, setMemberType] = useState<AdminCustomerFilterValue>("all");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminCustomerData[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [editingRoleById, setEditingRoleById] = useState<
    Record<string, AdminCustomerMemberTypeOption>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [sellerApplyModalOpen, setSellerApplyModalOpen] = useState(false);
  const [sellerApplyTarget, setSellerApplyTarget] =
    useState<AdminCustomerData | null>(null);
  const [referralModalOpen, setReferralModalOpen] = useState(false);
  const [referralTarget, setReferralTarget] =
    useState<AdminCustomerData | null>(null);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminCustomers({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        keyword: keywordQuery || undefined,
        memberType,
      });
      setList(data.list);
      setCount(data.count);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "ADMIN_REQUIRED") {
        setForbidden(true);
        return;
      }
      setList([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, keywordQuery, memberType]);

  const handleSaveRole = useCallback(
    async (row: AdminCustomerData) => {
      const selected = editingRoleById[row.id] ?? rowToOption(row);
      if (selected === rowToOption(row)) return;
      setSavingId(row.id);
      try {
        await updateAdminCustomerRole({
          id: row.id,
          role: optionToRole(selected),
        });
        setEditingRoleById((prev) => {
          const next = { ...prev };
          delete next[row.id];
          return next;
        });
        await fetchList();
      } finally {
        setSavingId(null);
      }
    },
    [editingRoleById, fetchList],
  );

  const handleSellerRegister = useCallback((row: AdminCustomerData) => {
    if (row.role !== "center_manager" && row.role !== "planner") return;
    if (row.is_seller) return;
    setSellerApplyTarget(row);
    setSellerApplyModalOpen(true);
  }, []);

  const handleReferralConnect = useCallback((row: AdminCustomerData) => {
    setReferralTarget(row);
    setReferralModalOpen(true);
  }, []);

  const handleReferralSubmit = useCallback(
    async (referredByUserId: string | null) => {
      if (!referralTarget) return;
      setSavingId(referralTarget.id);
      try {
        await updateAdminCustomerReferral({
          id: referralTarget.id,
          referredByUserId,
        });
        await fetchList();
      } finally {
        setSavingId(null);
      }
    },
    [referralTarget, fetchList],
  );

  const handleEditingRoleChange = useCallback(
    (id: string, value: AdminCustomerMemberTypeOption) => {
      setEditingRoleById((prev) => ({ ...prev, [id]: value }));
    },
    [],
  );

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdminLikeRole(profile?.is_admin)) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    setForbidden(false);
    void fetchList();
  }, [profileLoading, profile?.is_admin, fetchList]);

  const handleSearch = () => {
    setKeywordQuery(keyword.trim());
    setPage(1);
  };

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(count / PAGE_SIZE)),
    [count],
  );

  const sortedList = useMemo(
    () => [...list].sort((a, b) => b.id.localeCompare(a.id)),
    [list],
  );

  if (profileLoading) {
    return (
      <div className="">
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="">
        <h1 className="typo-heading-01-bold text-gray-01">고객 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="typo-heading-01-bold text-gray-01">고객 목록</h1>
          <p className="mt-2 typo-body-02-regular text-gray-03">
            고객 정보를 가입 일자 기준 최신순으로 확인할 수 있습니다
          </p>
        </div>

        <AdminCustomerFilters
          keyword={keyword}
          onKeywordChange={setKeyword}
          memberType={memberType}
          onMemberTypeChange={(v) => {
            setMemberType(v);
            setPage(1);
          }}
          onSearch={handleSearch}
        />

        <SellerListSection
          countLabel={`총 ${count}명`}
          loading={loading}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        >
          <>
            <AdminCustomerMobileList
              list={sortedList}
              editingRoleById={editingRoleById}
              onEditingRoleChange={handleEditingRoleChange}
              onSaveRole={handleSaveRole}
              onSellerRegister={handleSellerRegister}
              onReferralConnect={handleReferralConnect}
              savingId={savingId}
            />
            <AdminCustomerTable
              list={sortedList}
              page={page}
              pageSize={PAGE_SIZE}
              editingRoleById={editingRoleById}
              onEditingRoleChange={handleEditingRoleChange}
              onSaveRole={handleSaveRole}
              onSellerRegister={handleSellerRegister}
              onReferralConnect={handleReferralConnect}
              savingId={savingId}
            />
          </>
        </SellerListSection>
      </div>

      <AdminReferralLinkModal
        open={referralModalOpen}
        onOpenChange={(open) => {
          setReferralModalOpen(open);
          if (!open) setReferralTarget(null);
        }}
        customer={referralTarget}
        onSubmit={handleReferralSubmit}
      />

      {sellerApplyTarget && (
        <SellerApplyModal
          open={sellerApplyModalOpen}
          onOpenChange={(open) => {
            if (!open) {
              setSellerApplyModalOpen(false);
              setSellerApplyTarget(null);
            }
          }}
          targetUserLabel={`대상: ${sellerApplyTarget.email}`}
          submitLabel="신청하기"
          onSubmit={async (data) => {
            await applySellerForAdmin({
              id: sellerApplyTarget.id,
              ...data,
            });
            await fetchList();
          }}
          onSuccess={() => {
            setSellerApplyTarget(null);
          }}
        />
      )}
    </div>
  );
}
