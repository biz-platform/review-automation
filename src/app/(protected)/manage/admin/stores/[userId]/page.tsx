"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ManageSectionTabLine } from "@/app/(protected)/manage/ManageSectionTabLine";
import { DataTable } from "@/components/shared/DataTable";
import { DateRangeFilter } from "@/components/shared/DateRangeFilter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeftIcon } from "@/components/ui/icons";
import { Modal } from "@/components/ui/modal";
import { Pagination } from "@/components/ui/pagination";
import {
  getAdminStoreDetail,
  getAdminStoreReviewDetail,
  getAdminStoreWorkLogs,
} from "@/entities/admin/api/store-api";
import type { AdminReviewDetailData } from "@/entities/admin/api/store-api";
import type {
  AdminStoreDetailData,
  AdminStoreSessionRow,
  AdminWorkLogRow,
} from "@/entities/admin/types";
import { useAccountProfile } from "@/lib/hooks/use-account-profile";
import { getDefaultDateRangeLast7Days } from "@/lib/utils/date-range";
import { formatDateTime } from "@/lib/utils/display-formatters";
import {
  AdminWorkLogFilters,
  type WorkLogStatusFilter,
} from "./_components/AdminWorkLogFilters";

const ADMIN_STORE_TABS = [
  { value: "info", label: "매장 정보" },
  { value: "worklog", label: "작업 로그" },
] as const;

const PLATFORM_LABELS: Record<string, string> = {
  baemin: "배민",
  coupang_eats: "쿠팡이츠",
  yogiyo: "요기요",
  ddangyo: "땡겨요",
};

type TabId = "info" | "worklog";

function isAdmin(profile: { is_admin?: boolean | null } | undefined): boolean {
  return Boolean(profile?.is_admin);
}

export default function AdminStoreDetailPage() {
  const params = useParams();
  const userId = typeof params?.userId === "string" ? params.userId : "";
  const defaultRange = useMemo(() => getDefaultDateRangeLast7Days(), []);
  const { data: profile, isLoading: profileLoading } = useAccountProfile();
  const [tab, setTab] = useState<TabId>("info");
  const [data, setData] = useState<AdminStoreDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [dateFrom, setDateFrom] = useState(defaultRange.dateFrom);
  const [dateTo, setDateTo] = useState(defaultRange.dateTo);
  const [workLogStoreId, setWorkLogStoreId] = useState("");
  const [workLogPlatform, setWorkLogPlatform] = useState("");
  const [workLogCategory, setWorkLogCategory] = useState("");
  const [workLogStatusFilter, setWorkLogStatusFilter] =
    useState<WorkLogStatusFilter>("all");
  const [workLogList, setWorkLogList] = useState<AdminWorkLogRow[]>([]);
  const [workLogCount, setWorkLogCount] = useState(0);
  const [workLogLoading, setWorkLogLoading] = useState(false);
  const [workLogPage, setWorkLogPage] = useState(1);
  const [reviewDetailModalOpen, setReviewDetailModalOpen] = useState(false);
  const [selectedReviewId, setSelectedReviewId] = useState<string | null>(null);
  const [showReplyInModal, setShowReplyInModal] = useState(true);
  const [reviewDetail, setReviewDetail] =
    useState<AdminReviewDetailData | null>(null);
  const [reviewDetailLoading, setReviewDetailLoading] = useState(false);

  const WORK_LOG_PAGE_SIZE = 20;

  const openReviewDetail = useCallback(
    (reviewId: string, showReply: boolean) => {
      setSelectedReviewId(reviewId);
      setShowReplyInModal(showReply);
      setReviewDetailModalOpen(true);
      setReviewDetail(null);
    },
    [],
  );

  useEffect(() => {
    if (!reviewDetailModalOpen || !selectedReviewId || !userId) return;
    setReviewDetailLoading(true);
    getAdminStoreReviewDetail({ userId, reviewId: selectedReviewId })
      .then(setReviewDetail)
      .catch(() => setReviewDetail(null))
      .finally(() => setReviewDetailLoading(false));
  }, [reviewDetailModalOpen, selectedReviewId, userId]);

  const fetchDetail = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await getAdminStoreDetail({ userId });
      setData(res);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "ADMIN_REQUIRED") setForbidden(true);
      else setData(null);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (profileLoading) return;
    if (!isAdmin(profile)) {
      setForbidden(true);
      setLoading(false);
      return;
    }
    void fetchDetail();
  }, [profileLoading, profile?.is_admin, fetchDetail]);

  const fetchWorkLogs = useCallback(async () => {
    if (!userId) return;
    setWorkLogLoading(true);
    try {
      const res = await getAdminStoreWorkLogs({
        userId,
        storeId: workLogStoreId || undefined,
        platform: workLogPlatform || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        category: workLogCategory || undefined,
        status: workLogStatusFilter,
        limit: WORK_LOG_PAGE_SIZE,
        offset: (workLogPage - 1) * WORK_LOG_PAGE_SIZE,
      });
      setWorkLogList(res.list);
      setWorkLogCount(res.count);
    } catch {
      setWorkLogList([]);
      setWorkLogCount(0);
    } finally {
      setWorkLogLoading(false);
    }
  }, [
    userId,
    workLogStoreId,
    workLogPlatform,
    dateFrom,
    dateTo,
    workLogCategory,
    workLogStatusFilter,
    workLogPage,
  ]);

  useEffect(() => {
    if (tab === "worklog" && userId) void fetchWorkLogs();
  }, [tab, userId, fetchWorkLogs]);

  const storeOptions = useMemo(() => {
    const sess = data?.sessions ?? [];
    const seen = new Set<string>();
    return sess.reduce<{ value: string; label: string }[]>((acc, s) => {
      if (s.storeId && !seen.has(s.storeId)) {
        seen.add(s.storeId);
        acc.push({
          value: s.storeId,
          label: s.storeName ?? `${s.storeId.slice(0, 8)}…`,
        });
      }
      return acc;
    }, []);
  }, [data?.sessions]);

  if (profileLoading || !userId) {
    return (
      <div className="p-6 md:p-8">
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">매장 상세</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          관리자 권한이 필요합니다.
        </p>
      </div>
    );
  }

  const summary = data?.summary;
  const sessions = data?.sessions ?? [];

  return (
    <div className="">
      <div className="flex flex-col gap-6">
        <Link
          href="/manage/admin/stores"
          className="flex items-center gap-2 typo-body-02-regular text-gray-03 hover:text-gray-01"
        >
          <ChevronLeftIcon className="h-5 w-5 shrink-0" />
          <span>매장 관리 / 매장 상세</span>
        </Link>

        <ManageSectionTabLine
          items={[...ADMIN_STORE_TABS]}
          value={tab}
          onValueChange={(v) => setTab(v as TabId)}
        />

        {tab === "info" && (
          <>
            <div className="flex flex-wrap items-end gap-3">
              <DateRangeFilter
                dateFrom={dateFrom}
                dateTo={dateTo}
                onDateFromChange={setDateFrom}
                onDateToChange={setDateTo}
                showLabel={true}
                className="flex items-center gap-2"
              />
              <Button type="button" variant="secondaryDark" size="lg">
                검색
              </Button>
            </div>

            {loading ? (
              <p className="typo-body-02-regular text-gray-04">
                매장 정보 불러오는 중…
              </p>
            ) : summary ? (
              <>
                <div>
                  <h2 className="typo-body-03-bold text-gray-01 mb-2">
                    매장 전체 요약
                  </h2>
                  <div className="overflow-x-auto rounded-lg border border-gray-07">
                    <table className="w-full border-collapse typo-body-02-regular">
                      <thead>
                        <tr className="border-b border-gray-07">
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            이메일
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            등록 방법
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            등록한 댓글 수
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            배민
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            쿠팡
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            요기요
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            땡겨요
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            작업 상태
                          </th>
                          <th className="border-r border-gray-07 bg-gray-08 px-4 py-3 text-left typo-body-03-regular text-gray-05">
                            작업 로그
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="border-r border-gray-07 px-4 py-3 text-gray-01 last:border-r-0">
                            {summary.email ?? "—"}
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 last:border-r-0">
                            <Badge variant="outline">
                              {summary.registerMethod}
                            </Badge>
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 text-gray-01 last:border-r-0">
                            {summary.registeredReplyCount}개
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 text-gray-01 last:border-r-0">
                            {summary.baeminCount}개
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 text-gray-01 last:border-r-0">
                            {summary.coupangCount}개
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 text-gray-01 last:border-r-0">
                            {summary.yogiyoCount}개
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 text-gray-01 last:border-r-0">
                            {summary.ddangyoCount}개
                          </td>
                          <td className="border-r border-gray-07 px-4 py-3 last:border-r-0">
                            <span
                              className={`inline-flex rounded-lg border px-3 py-1 typo-body-03-regular ${
                                summary.hasError
                                  ? "border-red-200 bg-red-50 text-red-700"
                                  : "border-blue-200 bg-blue-50 text-blue-700"
                              }`}
                            >
                              {summary.hasError ? "오류" : "정상"}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setWorkLogStoreId("");
                                setWorkLogPlatform("");
                                setTab("worklog");
                              }}
                            >
                              확인
                            </Button>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h2 className="typo-body-03-bold text-gray-01 mb-2">
                    매장 개별 정보
                  </h2>
                  <DataTable<AdminStoreSessionRow>
                    columns={[
                      { id: "platform", header: "플랫폼" },
                      { id: "storeName", header: "매장명" },
                      { id: "businessNumber", header: "사업자등록번호" },
                      { id: "reviewCount", header: "리뷰 수" },
                      { id: "unregistered", header: "미등록" },
                      { id: "registered", header: "등록 완료" },
                      { id: "workStatus", header: "작업 상태" },
                      { id: "workLog", header: "작업 로그" },
                    ]}
                    data={sessions}
                    getRowKey={(row) => `${row.storeId}:${row.platform}`}
                    renderCell={(row, colId) => {
                      switch (colId) {
                        case "platform":
                          return PLATFORM_LABELS[row.platform] ?? row.platform;
                        case "storeName":
                          return row.storeName ?? "—";
                        case "businessNumber":
                          return row.businessRegistrationNumber ?? "—";
                        case "reviewCount":
                          return row.reviewCount;
                        case "unregistered":
                          return row.unregisteredCount;
                        case "registered":
                          return row.registeredCount;
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
                        case "workLog":
                          return (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setWorkLogStoreId(row.storeId);
                                setWorkLogPlatform(row.platform);
                                setTab("worklog");
                              }}
                            >
                              확인
                            </Button>
                          );
                        default:
                          return "—";
                      }
                    }}
                  />
                </div>
              </>
            ) : (
              <p className="typo-body-02-regular text-gray-04">
                매장 정보가 없습니다.
              </p>
            )}
          </>
        )}

        {tab === "worklog" && (
          <div className="flex flex-col gap-4">
            <AdminWorkLogFilters
              storeOptions={storeOptions}
              storeId={workLogStoreId}
              onStoreIdChange={setWorkLogStoreId}
              platform={workLogPlatform}
              onPlatformChange={setWorkLogPlatform}
              dateFrom={dateFrom}
              dateTo={dateTo}
              onDateFromChange={setDateFrom}
              onDateToChange={setDateTo}
              category={workLogCategory}
              onCategoryChange={setWorkLogCategory}
              statusFilter={workLogStatusFilter}
              onStatusFilterChange={setWorkLogStatusFilter}
              onSearch={() => setWorkLogPage(1)}
            />
            {workLogLoading ? (
              <p className="typo-body-02-regular text-gray-04">
                작업 로그 불러오는 중…
              </p>
            ) : (
              <DataTable<AdminWorkLogRow>
                columns={[
                  {
                    id: "createdAt",
                    header: "로그 기록 일시",
                    headerClassName: "min-w-[200px]",
                    cellClassName: "min-w-[200px]",
                  },
                  {
                    id: "platform",
                    header: "플랫폼",
                    headerClassName: "min-w-[80px]",
                    cellClassName: "min-w-[80px]",
                  },
                  {
                    id: "category",
                    header: "카테고리",
                    headerClassName: "min-w-[160px]",
                    cellClassName: "min-w-[160px]",
                  },
                  {
                    id: "status",
                    header: "상태",
                    headerClassName: "min-w-[80px]",
                    cellClassName: "min-w-[80px]",
                  },
                  { id: "message", header: "내용" },
                ]}
                data={workLogList}
                getRowKey={(row) => row.id}
                renderCell={(row, colId) => {
                  switch (colId) {
                    case "createdAt":
                      return formatDateTime(row.createdAt);
                    case "platform":
                      return (
                        <span className="typo-body-02-regular text-gray-01">
                          {row.platformLabel ?? "—"}
                        </span>
                      );
                    case "category":
                      return (
                        <Badge variant="outline">{row.categoryLabel}</Badge>
                      );
                    case "status":
                      return (
                        <span
                          className={`inline-flex rounded-lg border px-3 py-1 typo-body-03-regular ${
                            row.status === "completed"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : row.status === "failed"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : "border-gray-200 bg-gray-50 text-gray-600"
                          }`}
                        >
                          {row.status === "completed"
                            ? "성공"
                            : row.status === "failed"
                              ? "오류"
                              : row.status === "processing"
                                ? "처리 중"
                                : "대기"}
                        </span>
                      );
                    case "message": {
                      const shortId = row.reviewId
                        ? `${row.reviewId.slice(0, 8)}...`
                        : "";
                      const showReply = !row.type.endsWith("_delete_reply");
                      if (
                        row.reviewId &&
                        shortId &&
                        row.message.includes(shortId)
                      ) {
                        const parts = row.message.split(shortId);
                        return (
                          <span className="typo-body-02-regular text-gray-01 whitespace-pre-line">
                            {parts[0]}
                            <button
                              type="button"
                              onClick={() =>
                                openReviewDetail(row.reviewId!, showReply)
                              }
                              className="underline text-blue-600 hover:text-blue-800 focus:outline-none focus:underline"
                            >
                              {shortId}
                            </button>
                            {parts.slice(1).join(shortId)}
                          </span>
                        );
                      }
                      return (
                        <span className="typo-body-02-regular text-gray-01 whitespace-pre-line">
                          {row.message}
                        </span>
                      );
                    }
                    default:
                      return "—";
                  }
                }}
              />
            )}
            {!workLogLoading && workLogCount > WORK_LOG_PAGE_SIZE && (
              <Pagination
                page={workLogPage}
                totalPages={Math.max(
                  1,
                  Math.ceil(workLogCount / WORK_LOG_PAGE_SIZE),
                )}
                pageSize={WORK_LOG_PAGE_SIZE}
                onPageChange={setWorkLogPage}
                ariaLabel="작업 로그 페이지"
              />
            )}
          </div>
        )}
      </div>

      <Modal
        open={reviewDetailModalOpen}
        onOpenChange={(open) => !open && setReviewDetailModalOpen(false)}
        title="리뷰 상세"
        size="default"
        className="max-w-[520px]"
        footer={
          <Button
            variant="primary"
            size="md"
            onClick={() => setReviewDetailModalOpen(false)}
          >
            닫기
          </Button>
        }
      >
        <div className="flex flex-col gap-4 typo-body-02-regular text-gray-01">
          {reviewDetailLoading && <p className="text-gray-05">불러오는 중…</p>}
          {!reviewDetailLoading && reviewDetail && (
            <>
              <div className="flex flex-col gap-1">
                <span className="typo-body-03-bold text-gray-01">
                  리뷰 내용
                </span>
                <p className="whitespace-pre-wrap rounded-lg border border-gray-07 bg-gray-08/30 px-3 py-2 text-gray-01">
                  {reviewDetail.content ?? "(내용 없음)"}
                </p>
                {reviewDetail.written_at && (
                  <span className="text-gray-05">
                    {reviewDetail.written_at.slice(0, 10)}{" "}
                    {reviewDetail.author_name &&
                      `· ${reviewDetail.author_name}`}
                  </span>
                )}
              </div>
              {showReplyInModal && (
                <div className="flex flex-col gap-1">
                  <span className="typo-body-03-bold text-gray-01">
                    등록 답글
                  </span>
                  <p className="whitespace-pre-wrap rounded-lg border border-gray-07 bg-gray-08/30 px-3 py-2 text-gray-01">
                    {reviewDetail.platform_reply_content ?? "(답글 없음)"}
                  </p>
                </div>
              )}
            </>
          )}
          {!reviewDetailLoading && !reviewDetail && selectedReviewId && (
            <p className="text-gray-05">리뷰를 불러올 수 없습니다.</p>
          )}
        </div>
      </Modal>
    </div>
  );
}
