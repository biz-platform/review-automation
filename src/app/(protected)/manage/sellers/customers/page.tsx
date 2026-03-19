"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import {
  SellerListCard,
  SellerListCardRow,
  SellerListFilterRow,
  SellerListSection,
} from "@/components/sellers";
import { getSellerCustomers } from "@/entities/sellers/api/seller-customers-api";
import type { SellerCustomerData } from "@/entities/sellers/types";
import {
  formatAmount,
  formatDateTime,
  maskPhone,
} from "@/lib/utils/display-formatters";

const PAGE_SIZE = 20;

export default function SellerCustomersPage() {
  const [emailSearch, setEmailSearch] = useState("");
  const [emailQuery, setEmailQuery] = useState("");
  const [page, setPage] = useState(1);
  const [list, setList] = useState<SellerCustomerData[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSellerCustomers({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        email: emailQuery || undefined,
      });
      setList(data.list);
      setCount(data.count);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "SELLER_REQUIRED") {
        setForbidden(true);
        return;
      }
      setList([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, emailQuery]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSearch = () => {
    setEmailQuery(emailSearch.trim());
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (forbidden) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">고객 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          셀러 권한이 필요합니다.
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8">
      <div className="flex flex-col gap-6">
        <div>
          <h1 className="typo-heading-01-bold text-gray-01">고객 목록</h1>
          <p className="mt-2 typo-body-02-regular text-gray-03">
            내 셀러 영업 링크로 가입한 고객을 가입일 최신순으로 확인할 수 있어요
          </p>
        </div>

        <SellerListFilterRow label="고객 정보">
          <input
            type="text"
            placeholder="올리뷰 서비스 이메일"
            value={emailSearch}
            onChange={(e) => setEmailSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="min-w-0 flex-1 rounded-lg border border-gray-07 bg-white p-4 typo-body-02-regular text-gray-01 outline-none placeholder:text-gray-05 focus:border-main-02 focus:ring-1 focus:ring-main-02 md:max-w-[240px]"
          />
          <Button
            type="button"
            variant="secondaryDark"
            size="lg"
            className="h-12 w-20 shrink-0 text-sm sm:w-24"
            onClick={handleSearch}
          >
            검색
          </Button>
        </SellerListFilterRow>

        <SellerListSection
          countLabel={`총 ${count}명`}
          loading={loading}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        >
          <>
            {/* 모바일: 카드 목록 (정산 관리·어드민 고객과 동일 스타일) */}
            <div className="flex flex-col gap-3 md:hidden">
              {list.length === 0 ? (
                <div className="min-h-52 w-full rounded-lg border border-gray-07 bg-white px-4 py-8 text-center typo-body-02-regular text-gray-05">
                  조회된 고객이 없습니다.
                </div>
              ) : (
                list.map((row) => (
                  <SellerListCard key={row.id} title={row.email ?? "—"}>
                    <SellerListCardRow
                      label="휴대전화 번호"
                      value={maskPhone(row.phone)}
                    />
                    <SellerListCardRow
                      label="누적 결제 금액"
                      value={formatAmount(row.cumulative_payment_amount)}
                    />
                    <SellerListCardRow
                      label="서비스 가입일"
                      value={formatDateTime(row.created_at)}
                    />
                    <SellerListCardRow
                      label="마지막 결제일"
                      value={
                        row.last_payment_at
                          ? formatDateTime(row.last_payment_at)
                          : "—"
                      }
                    />
                  </SellerListCard>
                ))
              )}
            </div>
            {/* 데스크톱: 테이블 (어드민 고객 관리와 동일 DataTable 디자인) */}
            <DataTable<SellerCustomerData>
              columns={[
                { id: "id", header: "ID" },
                { id: "email", header: "이메일" },
                { id: "phone", header: "휴대전화 번호" },
                { id: "cumulative_payment_amount", header: "누적 결제 금액" },
                { id: "created_at", header: "서비스 가입일" },
                { id: "last_payment_at", header: "마지막 결제일" },
              ]}
              data={list}
              getRowKey={(row) => row.id}
              emptyMessage="조회된 고객이 없습니다."
              minWidth="min-w-[640px]"
              className="hidden md:block"
              renderCell={(row, columnId, idx) => {
                switch (columnId) {
                  case "id":
                    return (page - 1) * PAGE_SIZE + idx + 1;
                  case "email":
                    return row.email ?? "—";
                  case "phone":
                    return maskPhone(row.phone);
                  case "cumulative_payment_amount":
                    return formatAmount(row.cumulative_payment_amount);
                  case "created_at":
                    return formatDateTime(row.created_at);
                  case "last_payment_at":
                    return row.last_payment_at
                      ? formatDateTime(row.last_payment_at)
                      : "—";
                  default:
                    return null;
                }
              }}
            />
          </>
        </SellerListSection>
      </div>
    </div>
  );
}
