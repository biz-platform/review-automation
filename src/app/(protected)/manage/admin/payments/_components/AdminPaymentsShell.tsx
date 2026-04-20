"use client";

import { useCallback, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Info } from "@/components/ui/info";
import { DataTable } from "@/components/shared/DataTable";
import { CautionIcon } from "@/components/ui/icons/CautionIcon";
import { PAGE_SIZE } from "@/app/(protected)/manage/admin/customers/_components/constants";
import type {
  AdminBillingInvoiceRow,
  AdminBillingInvoiceRefundStatus,
} from "@/entities/admin/types";
import { formatKstYmdDots } from "@/lib/billing/format-billing-display";
import { formatKstYmdHmsDots } from "@/lib/billing/format-billing-display";
import { useAdminBillingInvoices } from "@/lib/hooks/use-admin-billing-invoices";
import { usePatchAdminBillingInvoiceRefund } from "@/lib/hooks/use-patch-admin-billing-invoice-refund";
import { ADMIN_PAYMENTS_MOCK_LIST } from "../_mock/adminPaymentsMock";

const COLUMNS = [
  { id: "id", header: "ID" },
  { id: "paidAt", header: "결제 일시" },
  { id: "email", header: "이메일" },
  { id: "planName", header: "구독 플랜" },
  { id: "amountWon", header: "결제 금액" },
  { id: "usagePeriod", header: "이용 가능 기간" },
  { id: "referrerCode", header: "추천인 코드" },
  { id: "paymentStatus", header: "결제 상태" },
  { id: "refundStatus", header: "환불 상태" },
  { id: "actions", header: "처리" },
] as const;

function PaymentStatusBadge({ status }: { status: "completed" | "error" }) {
  if (status === "completed") {
    return <Badge variant="adminPaymentComplete">완료</Badge>;
  }
  return <Badge variant="adminPaymentError">오류</Badge>;
}

function RefundStatusBadge({
  status,
}: {
  status: AdminBillingInvoiceRefundStatus;
}) {
  switch (status) {
    case "eligible":
      return <Badge variant="adminRefundEligible">환불 가능</Badge>;
    case "pending":
      return <Badge variant="adminRefundPending">환불 대기</Badge>;
    case "ineligible":
      return <Badge variant="adminRefundIneligible">요건 미달</Badge>;
    case "completed":
      return <Badge variant="adminRefundCompleted">환불 완료</Badge>;
    default:
      return <Badge variant="adminRefundNone">해당 없음</Badge>;
  }
}

function RefundActions({
  row,
  onPatch,
  patchPending,
}: {
  row: AdminBillingInvoiceRow;
  onPatch: (
    id: string,
    body: { refundStatus: "eligible" | "pending" | "completed" },
  ) => void;
  patchPending: boolean;
}) {
  const busy = patchPending;
  const rs = row.refundStatus;

  if (row.paymentStatus === "error") {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled
        className="h-9"
      >
        환불 불가
      </Button>
    );
  }

  if (rs === "eligible") {
    return (
      <Button
        type="button"
        variant="secondaryDark"
        size="sm"
        className="h-9"
        disabled={busy}
        onClick={() => onPatch(row.id, { refundStatus: "pending" })}
      >
        환불 대기
      </Button>
    );
  }

  if (rs === "pending") {
    return (
      <div className="flex flex-col gap-2">
        <Button
          type="button"
          variant="secondaryDark"
          size="sm"
          className="h-9"
          disabled={busy}
          onClick={() => onPatch(row.id, { refundStatus: "completed" })}
        >
          환불 완료
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          className="h-9 bg-red-01 text-white outline-red-01"
          disabled={busy}
          onClick={() => onPatch(row.id, { refundStatus: "eligible" })}
        >
          처리 불가
        </Button>
      </div>
    );
  }

  if (rs === "completed") {
    return (
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled
        className="h-9"
      >
        환불 불가
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      disabled
      className="h-9"
    >
      환불 불가
    </Button>
  );
}

export function AdminPaymentsShell() {
  const [draftKeyword, setDraftKeyword] = useState("");
  const [draftInvoiceCode, setDraftInvoiceCode] = useState("");
  const [draftMonth, setDraftMonth] = useState("");

  const [applied, setApplied] = useState({
    keyword: "",
    invoiceCode: "",
    month: "",
    page: 1,
  });

  const listParams = useMemo(
    () => ({
      limit: PAGE_SIZE,
      offset: (applied.page - 1) * PAGE_SIZE,
      keyword: applied.keyword || undefined,
      invoiceCode: applied.invoiceCode || undefined,
      month: applied.month || undefined,
    }),
    [applied],
  );

  const { data, isLoading, isError, refetch } =
    useAdminBillingInvoices(listParams);
  const patchMutation = usePatchAdminBillingInvoiceRefund();
  const mockMode =
    typeof window !== "undefined" && window.location.search.includes("mock=1");

  const onSearch = useCallback(() => {
    setApplied({
      keyword: draftKeyword.trim(),
      invoiceCode: draftInvoiceCode.trim(),
      month: draftMonth.trim(),
      page: 1,
    });
  }, [draftKeyword, draftInvoiceCode, draftMonth]);

  const total = data?.count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const tableData = mockMode ? ADMIN_PAYMENTS_MOCK_LIST : (data?.list ?? []);
  const tableTotal = mockMode ? ADMIN_PAYMENTS_MOCK_LIST.length : total;
  const showError = !mockMode && isError;
  const showLoading = !mockMode && isLoading;
  const showTable = mockMode || (!isLoading && !isError);

  const onPatch = useCallback(
    (
      invoiceId: string,
      body: { refundStatus: "eligible" | "pending" | "completed" },
    ) => {
      patchMutation.mutate({ invoiceId, body });
    },
    [patchMutation],
  );

  return (
    <div className="w-full min-w-0">
      <h1 className="mb-2 typo-heading-02-bold text-gray-01">결제 관리</h1>
      <p className="mb-6 typo-body-02-regular text-gray-04">
        결제·환불 요청 처리 이력을 조회하고 환불 상태를 관리합니다.
      </p>

      <Info
        className="mb-6"
        title="환불 가능 조건 안내"
        icon={
          <CautionIcon className="mt-0.5 text-amber-500" />
        }
        description={
          "고객 결제일 기준 7일이 지나지 않고, 매장 연동이 되지 않은 고객의 결제 건에 한해 환불이 가능합니다.\n실제 환불 처리는 CS팀을 통해 수동으로 진행됩니다."
        }
      />

      <div className="mb-6 flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex min-w-[200px] flex-col gap-1">
            <span className="typo-body-03-bold text-gray-01">고객 정보</span>
            <input
              type="text"
              placeholder="이메일 또는 휴대전화"
              value={draftKeyword}
              onChange={(e) => setDraftKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="h-12 w-full rounded-lg border border-gray-07 bg-white px-3 typo-body-02-regular outline-none focus:border-main-02"
            />
          </label>
          <label className="flex min-w-[140px] flex-col gap-1">
            <span className="typo-body-03-bold text-gray-01">결제 ID</span>
            <input
              type="text"
              placeholder="청구 번호"
              value={draftInvoiceCode}
              onChange={(e) => setDraftInvoiceCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onSearch()}
              className="h-12 w-full rounded-lg border border-gray-07 bg-white px-3 typo-body-02-regular outline-none focus:border-main-02"
            />
          </label>
          <label className="flex min-w-[160px] flex-col gap-1">
            <span className="typo-body-03-bold text-gray-01">결제 기간</span>
            <input
              type="month"
              value={draftMonth}
              onChange={(e) => setDraftMonth(e.target.value)}
              className="h-12 w-full rounded-lg border border-gray-07 bg-white px-3 typo-body-02-regular outline-none focus:border-main-02"
            />
          </label>
          <Button
            type="button"
            variant="secondaryDark"
            size="lg"
            className="h-12 shrink-0 px-6"
            onClick={onSearch}
          >
            검색
          </Button>
        </div>
      </div>

      <p className="mb-3 typo-body-02-bold text-gray-01">
        총 {tableTotal.toLocaleString("ko-KR")}건
      </p>

      {showError ? (
        <p className="typo-body-02-regular text-red-01">
          목록을 불러오지 못했습니다.
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-2"
            onClick={() => void refetch()}
          >
            다시 시도
          </Button>
        </p>
      ) : showLoading ? (
        <p className="typo-body-02-regular text-gray-04">불러오는 중…</p>
      ) : showTable ? (
        <DataTable<AdminBillingInvoiceRow>
          columns={COLUMNS.map((c) => ({ id: c.id, header: c.header }))}
          data={tableData}
          getRowKey={(row) => row.id}
          emptyMessage="조회된 결제 건이 없습니다."
          minWidth="min-w-[1200px]"
          renderCell={(row, columnId) => {
            switch (columnId) {
              case "id":
                return row.invoiceCode;
              case "paidAt":
                return (
                  <span className="tabular-nums">
                    {formatKstYmdHmsDots(row.paidAt)}
                  </span>
                );
              case "email":
                return row.payerEmail ?? "—";
              case "planName":
                return row.planName;
              case "amountWon":
                return (
                  <span className="tabular-nums">
                    {row.amountWon.toLocaleString("ko-KR")}원
                  </span>
                );
              case "usagePeriod":
                return (
                  <span className="whitespace-pre-line tabular-nums">
                    {formatKstYmdDots(row.usagePeriodStart)}
                    {"\n"}
                    {formatKstYmdDots(row.usagePeriodEnd)}
                  </span>
                );
              case "referrerCode":
                return (
                  <span className="text-gray-03">
                    {row.referrerCode != null && row.referrerCode.trim() !== ""
                      ? row.referrerCode
                      : "추천인 없음"}
                  </span>
                );
              case "paymentStatus":
                return <PaymentStatusBadge status={row.paymentStatus} />;
              case "refundStatus":
                return (
                  <div className="flex flex-col items-start gap-1">
                    <RefundStatusBadge status={row.refundStatus} />
                    {row.refundSubtext ? (
                      <span className="typo-body-03-regular text-gray-04">
                        {row.refundSubtext}
                      </span>
                    ) : null}
                  </div>
                );
              case "actions":
                return <RefundActionsTwoLine row={row} onPatch={onPatch} patchPending={patchMutation.isPending} />;
              default:
                return null;
            }
          }}
        />
      ) : null}

      {!mockMode && total > 0 ? (
        <div className="mt-6 flex items-center justify-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={applied.page <= 1}
            onClick={() =>
              setApplied((s) => ({ ...s, page: Math.max(1, s.page - 1) }))
            }
          >
            이전
          </Button>
          <span className="typo-body-02-regular text-gray-03">
            {applied.page} / {totalPages}
          </span>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            disabled={applied.page >= totalPages}
            onClick={() =>
              setApplied((s) => ({
                ...s,
                page: Math.min(totalPages, s.page + 1),
              }))
            }
          >
            다음
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function RefundActionsTwoLine({
  row,
  onPatch,
  patchPending,
}: {
  row: AdminBillingInvoiceRow;
  onPatch: (
    id: string,
    body: { refundStatus: "eligible" | "pending" | "completed" },
  ) => void;
  patchPending: boolean;
}) {
  const rs = row.refundStatus;

  if (rs === "pending") {
    return <RefundActions row={row} onPatch={onPatch} patchPending={patchPending} />;
  }

  return (
    <div className="flex flex-col gap-2">
      <RefundActions row={row} onPatch={onPatch} patchPending={patchPending} />
      <div className="h-9" aria-hidden />
    </div>
  );
}
