"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  deleteAdminSeller,
  getAdminSellerCustomers,
  getAdminSellers,
} from "@/entities/admin/api/seller-api";
import type {
  AdminSellerCustomerRow,
  AdminSellerRow,
  AdminSellerTypeFilter,
} from "@/entities/admin/types";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { AdminSellerFilters } from "./_components/AdminSellerFilters";
import { AdminSellerTable } from "./_components/AdminSellerTable";
import { PAGE_SIZE } from "./_components/constants";

function isAdminLikeRole(isAdmin?: boolean | null): boolean {
  return Boolean(isAdmin);
}

export default function AdminSellersPage() {
  const { data: profile, isLoading: profileLoading } = useAccountProfile();
  const [keyword, setKeyword] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [sellerType, setSellerType] = useState<AdminSellerTypeFilter>("all");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminSellerRow[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const [expandedSellerId, setExpandedSellerId] = useState<string | null>(null);
  const [customersBySellerId, setCustomersBySellerId] = useState<
    Record<string, AdminSellerCustomerRow[]>
  >({});
  const [customersLoadingId, setCustomersLoadingId] = useState<string | null>(
    null,
  );

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminSellerRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminSellers({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        keyword: keywordQuery || undefined,
        sellerType,
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
  }, [page, keywordQuery, sellerType]);

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
    setExpandedSellerId(null);
  };

  const loadCustomers = useCallback(async (sellerId: string) => {
    setCustomersLoadingId(sellerId);
    try {
      const data = await getAdminSellerCustomers({
        userId: sellerId,
        limit: 200,
        offset: 0,
      });
      setCustomersBySellerId((prev) => ({ ...prev, [sellerId]: data.list }));
    } catch {
      setCustomersBySellerId((prev) => ({ ...prev, [sellerId]: [] }));
    } finally {
      setCustomersLoadingId(null);
    }
  }, []);

  useEffect(() => {
    if (!expandedSellerId) return;
    if (customersBySellerId[expandedSellerId] !== undefined) return;
    void loadCustomers(expandedSellerId);
  }, [expandedSellerId, customersBySellerId, loadCustomers]);

  const handleToggleExpand = useCallback((sellerId: string) => {
    setExpandedSellerId((prev) => (prev === sellerId ? null : sellerId));
  }, []);

  const handleRequestDelete = useCallback((row: AdminSellerRow) => {
    setDeleteTarget(row);
    setDeleteModalOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const removedId = deleteTarget.id;
      await deleteAdminSeller({ userId: removedId });
      setDeleteModalOpen(false);
      setDeleteTarget(null);
      setExpandedSellerId(null);
      setCustomersBySellerId((prev) => {
        const next = { ...prev };
        delete next[removedId];
        return next;
      });
      await fetchList();
    } finally {
      setDeleting(false);
    }
  }, [deleteTarget, fetchList]);

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

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
        <h1 className="typo-heading-01-bold text-gray-01">셀러 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="">
      <div className="flex flex-col gap-6">
        <div className="mb-4">
          <h1 className="typo-heading-01-bold text-gray-01">셀러 목록</h1>
          <p className="mt-2 typo-body-02-regular text-gray-03">
            셀러 정보를 등록 일자 기준 최신순으로 확인할 수 있습니다
          </p>
        </div>

        <AdminSellerFilters
          keyword={keyword}
          onKeywordChange={setKeyword}
          sellerType={sellerType}
          onSellerTypeChange={(v) => {
            setSellerType(v);
            setPage(1);
          }}
          onSearch={handleSearch}
        />

        <p className="typo-body-02-bold text-gray-01">총 {count}명</p>

        <div className="flex flex-col gap-4">
          {loading ? (
            <p className="typo-body-02-regular text-gray-04">목록 불러오는 중…</p>
          ) : (
            <AdminSellerTable
              list={list}
              expandedSellerId={expandedSellerId}
              onToggleExpand={handleToggleExpand}
              customersBySellerId={customersBySellerId}
              customersLoadingId={customersLoadingId}
              onRequestDelete={handleRequestDelete}
            />
          )}

          {!loading && count > PAGE_SIZE && (
            <Pagination
              page={page}
              totalPages={totalPages}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
              ariaLabel="셀러 목록 페이지"
            />
          )}
        </div>
      </div>

      <Modal
        open={deleteModalOpen}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeleteModalOpen(false);
            setDeleteTarget(null);
          }
        }}
        title="셀러 삭제 전 확인해주세요"
        description={
          <ul className="list-disc space-y-2 pl-5 typo-body-02-regular text-gray-03">
            <li>삭제 시 해당 셀러의 정산 및 활동 내역이 모두 제거돼요</li>
            <li>해당 셀러의 고객 수수료는 모두 회사로 귀속돼요</li>
          </ul>
        }
        footer={
          <Button
            type="button"
            variant="destructive"
            size="lg"
            disabled={deleting}
            onClick={() => void handleConfirmDelete()}
          >
            삭제
          </Button>
        }
      />
    </div>
  );
}
