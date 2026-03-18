"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/DataTable";
import {
  SellerListCard,
  SellerListCardRow,
  SellerListFilterRow,
  SellerListSection,
} from "@/components/sellers";
import { getSellerSettlement } from "@/entities/sellers/api/seller-settlement-api";
import type {
  SettlementItemData,
  SettlementSummaryData,
} from "@/entities/sellers/types";
import { cn } from "@/lib/utils/cn";
import {
  formatAmount,
  formatDateTime,
  maskPhone,
} from "@/lib/utils/display-formatters";

const PAGE_SIZE = 20;

function getYearMonthDisplay(ym: string): string {
  if (!ym || ym.length < 7) return "";
  return `${ym.slice(0, 4)}.${ym.slice(5, 7)}`;
}

function prevMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, "0")}`;
}

function nextMonth(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, "0")}`;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

const MONTH_LABELS = [
  "1월",
  "2월",
  "3월",
  "4월",
  "5월",
  "6월",
  "7월",
  "8월",
  "9월",
  "10월",
  "11월",
  "12월",
];

type MonthPickerPopoverProps = {
  yearMonth: string;
  currentYearMonth: string;
  onSelect: (ym: string) => void;
  onClose: () => void;
};

function isFutureMonth(viewYear: number, month: number, currentYearMonth: string) {
  const ym = `${viewYear}-${String(month).padStart(2, "0")}`;
  return ym > currentYearMonth;
}

function MonthPickerContent({
  viewYear,
  setViewYear,
  yearMonth,
  currentYearMonth,
  onSelect,
}: {
  viewYear: number;
  setViewYear: (fn: (prev: number) => number) => void;
  yearMonth: string;
  currentYearMonth: string;
  onSelect: (ym: string) => void;
}) {
  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setViewYear((prev) => prev - 1)}
          className="flex min-h-10 min-w-10 items-center justify-center rounded p-2 text-gray-01 hover:bg-gray-08 active:bg-gray-07"
          aria-label="이전 해"
        >
          ◀
        </button>
        <span className="typo-body-03-bold text-gray-01">{viewYear} 년</span>
        <button
          type="button"
          onClick={() => setViewYear((prev) => prev + 1)}
          className="flex min-h-10 min-w-10 items-center justify-center rounded p-2 text-gray-01 hover:bg-gray-08 active:bg-gray-07"
          aria-label="다음 해"
        >
          ▶
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {MONTH_LABELS.map((label, i) => {
          const month = i + 1;
          const disabled = isFutureMonth(viewYear, month, currentYearMonth);
          const ym = `${viewYear}-${String(month).padStart(2, "0")}`;
          const isSelected = yearMonth === ym;
          return (
            <button
              key={month}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(ym)}
              className={cn(
                "min-h-11 rounded py-3 text-sm font-medium transition-colors",
                isSelected && "bg-main-02 text-white",
                !isSelected && !disabled && "text-gray-01 hover:bg-gray-08 active:bg-gray-07",
                disabled &&
                  "cursor-not-allowed bg-transparent text-gray-04 opacity-70 hover:bg-transparent active:bg-transparent",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </>
  );
}

function MonthPickerPopover({
  yearMonth,
  currentYearMonth,
  onSelect,
  onClose,
}: MonthPickerPopoverProps) {
  const [y] = yearMonth.split("-").map(Number);
  const [viewYear, setViewYear] = useState(y);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setViewYear(y);
  }, [y]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (dropdownRef.current?.contains(target) || modalPanelRef.current?.contains(target))
        return;
      onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  const content = (
    <MonthPickerContent
      viewYear={viewYear}
      setViewYear={setViewYear}
      yearMonth={yearMonth}
      currentYearMonth={currentYearMonth}
      onSelect={onSelect}
    />
  );

  return (
    <>
      {/* 모바일: 모달 (가운데 정렬, 잘림 없음) */}
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 md:hidden"
        role="dialog"
        aria-modal="true"
        aria-label="연월 선택"
      >
        <div
          className="absolute inset-0 bg-black/50"
          onClick={onClose}
          aria-hidden
        />
        <div
          ref={modalPanelRef}
          className="relative z-10 w-full max-w-[280px] rounded-lg border border-gray-01 bg-white p-3 shadow-lg"
          onClick={(e) => e.stopPropagation()}
        >
          {content}
          <Button
            type="button"
            variant="secondaryDark"
            size="md"
            className="mt-3 w-full"
            onClick={onClose}
          >
            닫기
          </Button>
        </div>
      </div>
      {/* 데스크톱: 드롭다운 */}
      <div
        ref={dropdownRef}
        className="absolute left-0 top-full z-50 mt-1 hidden w-52 rounded-lg border border-gray-01 bg-white p-3 shadow-lg md:block lg:w-60"
        role="dialog"
        aria-label="연월 선택"
      >
        {content}
      </div>
    </>
  );
}

export default function SellerSettlementPage() {
  const now = new Date();
  const defaultYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const currentYearMonth = getCurrentYearMonth();
  const [emailOrPhone, setEmailOrPhone] = useState("");
  const [emailOrPhoneQuery, setEmailOrPhoneQuery] = useState("");
  const [yearMonth, setYearMonth] = useState(defaultYearMonth);
  const [page, setPage] = useState(1);
  const [summary, setSummary] = useState<SettlementSummaryData>({
    paymentCount: 0,
    estimatedSettlementAmount: 0,
  });
  const [list, setList] = useState<SettlementItemData[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSellerSettlement({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        yearMonth: yearMonth || undefined,
        emailOrPhone: emailOrPhoneQuery || undefined,
      });
      setSummary(data.summary);
      setList(data.list);
      setCount(data.count);
    } catch (err) {
      const code = (err as Error & { code?: string })?.code;
      if (code === "SELLER_REQUIRED") {
        setForbidden(true);
        return;
      }
      setSummary({ paymentCount: 0, estimatedSettlementAmount: 0 });
      setList([]);
      setCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, yearMonth, emailOrPhoneQuery]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSearch = () => {
    setEmailOrPhoneQuery(emailOrPhone.trim());
    setPage(1);
  };

  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE));

  if (forbidden) {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">정산 관리</h1>
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
          <h1 className="typo-heading-01-bold text-gray-01">정산 내역</h1>
          <p className="mt-2 typo-body-02-regular text-gray-03">
            내 셀러 영업 링크로 발생한 결제 내역과 월별 정산 금액을 확인할 수
            있어요
          </p>
        </div>

        {/* 요약 카드 */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 mb-6 lg:mb-8.5">
          <div className="rounded-lg border border-gray-07 bg-white px-5 py-4 outline outline-1 -outline-offset-px outline-gray-07">
            <p className="typo-body-03-regular text-gray-05">결제 건수</p>
            <p className="mt-1 typo-heading-02-bold text-gray-01">
              {summary.paymentCount}건
            </p>
          </div>
          <div className="rounded-lg border border-gray-07 bg-white px-5 py-4 outline outline-1 -outline-offset-px outline-gray-07">
            <p className="typo-body-03-regular text-gray-05">예상 정산 금액</p>
            <p className="mt-1 typo-heading-02-bold text-gray-01">
              {formatAmount(summary.estimatedSettlementAmount)}
            </p>
          </div>
        </div>

        {/* 고객 정보 - 기간 - 검색 (한 행, 데스크톱/모바일 동일) */}
        <div className="mb-5 md:mb-2">
          <SellerListFilterRow label="고객 정보">
            <input
              type="text"
              placeholder="이메일 또는 휴대전화 번호"
              value={emailOrPhone}
              onChange={(e) => setEmailOrPhone(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="min-w-0 flex-1 rounded-lg border border-gray-07 bg-white px-4 py-3 typo-body-02-regular text-gray-01 outline-none placeholder:text-gray-05 focus:border-main-02 focus:ring-1 focus:ring-main-02 md:max-w-[240px]"
            />
            <div className="relative h-12 min-w-0 flex-1 md:w-60 md:flex-none">
              {/* 모바일: 기간 단일 박스 (클릭 시 월 피커) */}
              <button
                type="button"
                onClick={() => setMonthPickerOpen((v) => !v)}
                className="flex h-full w-full items-center justify-center rounded-lg border border-gray-01 bg-white text-sm font-medium text-gray-01 hover:bg-gray-08 md:sr-only"
                aria-expanded={monthPickerOpen}
                aria-haspopup="dialog"
                aria-label="연월 선택"
              >
                {getYearMonthDisplay(yearMonth).replace(".", ". ")}
              </button>
              {/* 데스크톱: 좌우 화살표 + 연월 */}
              <div className="absolute inset-0 hidden overflow-hidden rounded-lg border border-gray-01 bg-white md:flex">
                <button
                  type="button"
                  onClick={() => setYearMonth((ym) => prevMonth(ym))}
                  className="flex h-full w-12 shrink-0 items-center justify-center border-r border-gray-01 text-gray-01 hover:bg-gray-08"
                  aria-label="이전 달"
                >
                  <span className="text-[10px] leading-none">◀</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMonthPickerOpen((v) => !v)}
                  className="flex min-w-0 flex-1 items-center justify-center border-r border-gray-01 text-sm font-medium text-gray-01 hover:bg-gray-08"
                  aria-expanded={monthPickerOpen}
                  aria-haspopup="dialog"
                  aria-label="연월 선택"
                >
                  {getYearMonthDisplay(yearMonth).replace(".", ". ")}
                </button>
                <button
                  type="button"
                  onClick={() => setYearMonth((ym) => nextMonth(ym))}
                  disabled={yearMonth >= currentYearMonth}
                  className="flex h-full w-12 shrink-0 items-center justify-center text-gray-01 hover:bg-gray-08 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                  aria-label="다음 달"
                >
                  <span className="text-[10px] leading-none">▶</span>
                </button>
              </div>
              {monthPickerOpen && (
                <MonthPickerPopover
                  yearMonth={yearMonth}
                  currentYearMonth={currentYearMonth}
                  onSelect={(ym) => {
                    setYearMonth(ym);
                    setMonthPickerOpen(false);
                  }}
                  onClose={() => setMonthPickerOpen(false)}
                />
              )}
            </div>
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
        </div>

        {/* 정산 내역: 모바일 카드 / 데스크톱 테이블 */}
        <SellerListSection
          countLabel={`총 ${count}건`}
          loading={loading}
          page={page}
          totalPages={totalPages}
          pageSize={PAGE_SIZE}
          onPageChange={setPage}
        >
          <>
            {/* 모바일: 카드 목록 (고객 관리 페이지와 동일 스타일) */}
            <div className="flex flex-col gap-3 md:hidden">
              {list.length === 0 ? (
                <div className="min-h-52 w-full rounded-lg border border-gray-07 bg-white px-4 py-8 text-center typo-body-02-regular text-gray-05">
                  조회된 정산 내역이 없습니다.
                </div>
              ) : (
                list.map((row) => (
                  <SellerListCard key={row.id}>
                    <SellerListCardRow
                      label="이메일"
                      value={row.email ?? "—"}
                    />
                    <SellerListCardRow
                      label="휴대전화 번호"
                      value={maskPhone(row.phone)}
                    />
                    <SellerListCardRow
                      label="결제 금액"
                      value={formatAmount(row.payment_amount)}
                    />
                    <SellerListCardRow
                      label="정산 금액"
                      value={formatAmount(row.settlement_amount)}
                      valueClassName="text-main-02 font-bold"
                    />
                    <SellerListCardRow
                      label="결제 일시"
                      value={formatDateTime(row.payment_at)}
                    />
                  </SellerListCard>
                ))
              )}
            </div>
            {/* 데스크톱: 테이블 (어드민 고객 관리와 동일 DataTable 디자인) */}
            <DataTable<SettlementItemData>
              columns={[
                { id: "id", header: "ID" },
                { id: "email", header: "이메일" },
                { id: "phone", header: "휴대전화 번호" },
                { id: "payment_amount", header: "결제 금액" },
                {
                  id: "settlement_amount",
                  header: "정산 금액",
                  cellClassName: "typo-body-02-bold text-main-02",
                },
                { id: "payment_at", header: "결제 일시" },
              ]}
              data={list}
              getRowKey={(row) => row.id}
              emptyMessage="조회된 정산 내역이 없습니다."
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
                  case "payment_amount":
                    return formatAmount(row.payment_amount);
                  case "settlement_amount":
                    return formatAmount(row.settlement_amount);
                  case "payment_at":
                    return formatDateTime(row.payment_at);
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
