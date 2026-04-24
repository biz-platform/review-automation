"use client";

import { useCallback, useEffect, useState } from "react";
import { DataTable } from "@/components/shared/DataTable";
import { Badge } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import { getAdminStores } from "@/entities/admin/api/store-api";
import type { AdminStoreSummaryRow } from "@/entities/admin/types";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { ContentStateMessage } from "@/components/ui/content-state-message";
import { AdminStoreFilters } from "./_components/AdminStoreFilters";
import type { AdminStoreRegistrationMethodFilter } from "./_components/AdminStoreFilters";
import { PAGE_SIZE } from "./_components/constants";
const PLATFORM_LABELS: Record<string, string> = {
  baemin: "배민",
  coupang_eats: "쿠팡",
  yogiyo: "요기요",
  ddangyo: "땡겨요",
};

function isAdmin(profile: { is_admin?: boolean | null } | undefined): boolean {
  return Boolean(profile?.is_admin);
}

export default function AdminStoresPage() {
  const { data: profile, isLoading: profileLoading } = useAccountProfile();
  const [keyword, setKeyword] = useState("");
  const [keywordQuery, setKeywordQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [registrationMethod, setRegistrationMethod] =
    useState<AdminStoreRegistrationMethodFilter>("all");
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [list, setList] = useState<AdminStoreSummaryRow[]>([]);
  const [count, setCount] = useState(0);
  const [totalErrorCount, setTotalErrorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAdminStores({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        keyword: keywordQuery || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        registrationMethod:
          registrationMethod === "all" ? undefined : registrationMethod,
        errorsOnly: errorsOnly || undefined,
      });
      setList(data.list);
      setCount(data.count);
      setTotalErrorCount(data.totalErrorCount);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "ADMIN_REQUIRED") {
        setForbidden(true);
        return;
      }
      setList([]);
      setCount(0);
      setTotalErrorCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, keywordQuery, dateFrom, dateTo, registrationMethod, errorsOnly]);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin(profile)) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    void fetchList();
  }, [profileLoading, profile?.is_admin, fetchList]);

  const handleSearch = () => {
    setKeywordQuery(keyword.trim());
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (profileLoading) {
    return (
      <div className="">
        <ContentStateMessage variant="loading" message="불러오는 중…" />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="">
        <h1 className="typo-heading-01-bold text-gray-01">매장 관리</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  const columns = [
    { id: "previewStoreName", header: "상호" },
    { id: "email", header: "이메일" },
    { id: "registerMethod", header: "등록 방법" },
    { id: "registeredReplyCount", header: "등록한 댓글 수" },
    { id: "baemin", header: "배민" },
    { id: "coupang", header: "쿠팡" },
    { id: "yogiyo", header: "요기요" },
    { id: "ddangyo", header: "땡겨요" },
    { id: "workStatus", header: "작업 상태" },
    { id: "detail", header: "상세 정보" },
  ];

  return (
    <div className="">
      <div className="flex flex-col gap-6">
        <div className="mb-4">
          <h1 className="typo-heading-01-bold text-gray-01">
            고객별 매장 목록
          </h1>
          <p className="mt-2 typo-body-02-regular text-gray-03">
            고객마다 연결된 매장을 한눈에 확인할 수 있습니다.
          </p>
        </div>

        <div className="inline-flex flex-col gap-2 rounded-lg border border-gray-07 max-w-80 p-4">
          <span className="typo-body-03-regular text-gray-05">
            오류 발생 건수
          </span>
          <span className="typo-body-02-bold text-gray-01">
            {totalErrorCount}건
          </span>
        </div>

        <AdminStoreFilters
          keyword={keyword}
          onKeywordChange={setKeyword}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateFromChange={setDateFrom}
          onDateToChange={setDateTo}
          registrationMethod={registrationMethod}
          onRegistrationMethodChange={setRegistrationMethod}
          onSearch={handleSearch}
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setErrorsOnly(false)}
            className={`rounded-lg px-4 py-2 typo-body-03-bold ${
              !errorsOnly
                ? "bg-gray-02 text-white"
                : "border border-gray-07 bg-white text-gray-01"
            }`}
          >
            전체
          </button>
          <button
            type="button"
            onClick={() => setErrorsOnly(true)}
            className={`rounded-lg px-4 py-2 typo-body-03-bold ${
              errorsOnly
                ? "bg-gray-02 text-white"
                : "border border-gray-07 bg-white text-gray-01"
            }`}
          >
            오류 발생
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {loading ? (
            <ContentStateMessage
              variant="loading"
              message="목록 불러오는 중…"
              className="min-h-64"
            />
          ) : (
            <DataTable<AdminStoreSummaryRow>
              columns={columns}
              data={list}
              getRowKey={(row) => row.userId}
              renderCell={(row, colId) => {
                switch (colId) {
                  case "previewStoreName":
                    return row.previewStoreName ?? "—";
                  case "email":
                    return row.email ?? "—";
                  case "registerMethod":
                    return (
                      <Badge variant="outline">{row.registerMethod}</Badge>
                    );
                  case "registeredReplyCount":
                    return `${row.registeredReplyCount}개`;
                  case "baemin":
                    return `${row.baeminCount}개`;
                  case "coupang":
                    return `${row.coupangCount}개`;
                  case "yogiyo":
                    return `${row.yogiyoCount}개`;
                  case "ddangyo":
                    return `${row.ddangyoCount}개`;
                  case "workStatus":
                    return (
                      <span
                        className={`inline-flex rounded-lg border px-3 py-1 typo-body-03-regular ${
                          row.hasError
                            ? "border-red-200 bg-red-50 text-red-700"
                            : "border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                      >
                        {row.hasError ? "오류" : "정상"}
                      </span>
                    );
                  case "detail":
                    return (
                      <ButtonLink
                        href={`/manage/admin/stores/${row.userId}`}
                        variant="ghost"
                        size="sm"
                      >
                        매장 상세
                      </ButtonLink>
                    );
                  default:
                    return "—";
                }
              }}
            />
          )}

          {!loading && count > PAGE_SIZE && (
            <div className="flex justify-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                이전
              </Button>
              <span className="typo-body-02-regular text-gray-03">
                {page} / {totalPages}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                다음
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
