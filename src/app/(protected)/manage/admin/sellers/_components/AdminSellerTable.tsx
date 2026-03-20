"use client";

import { Button } from "@/components/ui/button";
import type {
  AdminSellerCustomerRow,
  AdminSellerRow,
} from "@/entities/admin/types";
import { formatAmount, formatDateTime } from "@/lib/utils/display-formatters";
import { formatPhoneDisplay } from "@/lib/utils/format-phone";
import { cn } from "@/lib/utils/cn";

const COLS = 7;

/** 가로 구분선만 (세로선 없음). 셀러·하위 고객 동일 행 높이. */
const thClass =
  "border-b border-gray-07 px-4 py-3 text-left align-middle typo-body-03-bold text-gray-01 min-h-[52px]";
const tdClass =
  "border-b border-gray-07 px-4 py-3 text-left align-middle typo-body-02-regular text-gray-01 min-h-[52px]";

function roleLabel(role: AdminSellerRow["role"]): string {
  return role === "center_manager" ? "센터장" : "플래너";
}

/** 고객 관리 admin_list_customers와 동일한 구분 직관 (member → 유료/무료) */
function customerMemberTypeLabel(
  role: AdminSellerCustomerRow["role"],
  paidUntil: string | null,
): string {
  if (role === "center_manager") return "센터장";
  if (role === "planner") return "플래너";
  if (paidUntil != null && paidUntil !== "") {
    const until = new Date(paidUntil).getTime();
    if (!Number.isNaN(until) && until >= Date.now()) return "유료 회원";
  }
  return "무료 회원";
}

function MemberTypeBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex min-h-8 items-center rounded-lg border border-gray-07 bg-white px-3 py-1 typo-body-03-regular text-gray-01">
      {label}
    </span>
  );
}

function displayPhone(raw: string | null): string {
  if (raw == null || raw === "") return "—";
  const trimmed = raw.trim();
  if (trimmed.includes("-")) return trimmed;
  return formatPhoneDisplay(trimmed);
}

function sellerNameWithCount(row: AdminSellerRow): string {
  const base = row.dbtalkName?.trim() ? row.dbtalkName.trim() : "—";
  return `${base} (${row.referralCustomerCount})`;
}

export interface AdminSellerTableProps {
  list: AdminSellerRow[];
  expandedSellerId: string | null;
  onToggleExpand: (sellerId: string) => void;
  customersBySellerId: Record<string, AdminSellerCustomerRow[] | undefined>;
  customersLoadingId: string | null;
  onRequestDelete: (row: AdminSellerRow) => void;
}

export function AdminSellerTable({
  list,
  expandedSellerId,
  onToggleExpand,
  customersBySellerId,
  customersLoadingId,
  onRequestDelete,
}: AdminSellerTableProps) {
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-07">
      <table className="w-full min-w-[960px] border-collapse">
        <thead>
          <tr className="bg-gray-08">
            <th className={thClass}>셀러 이름</th>
            <th className={thClass}>휴대전화 번호</th>
            <th className={thClass}>회원 유형</th>
            <th className={thClass}>결제 건수</th>
            <th className={thClass}>예상 정산 금액</th>
            <th className={thClass}>마지막 주문일</th>
            <th className={thClass}>삭제</th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 ? (
            <tr>
              <td
                colSpan={COLS}
                className={`${tdClass} py-8 text-center typo-body-02-regular text-gray-05`}
              >
                조회된 셀러가 없습니다.
              </td>
            </tr>
          ) : (
            list.map((row) => {
              const open = expandedSellerId === row.id;
              const customers = customersBySellerId[row.id];
              const loadingCust = customersLoadingId === row.id;

              return (
                <SellerRowGroup
                  key={row.id}
                  row={row}
                  open={open}
                  customers={customers}
                  loadingCust={loadingCust}
                  onToggleExpand={() => onToggleExpand(row.id)}
                  onRequestDelete={() => onRequestDelete(row)}
                />
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

function SellerRowGroup({
  row,
  open,
  customers,
  loadingCust,
  onToggleExpand,
  onRequestDelete,
}: {
  row: AdminSellerRow;
  open: boolean;
  customers: AdminSellerCustomerRow[] | undefined;
  loadingCust: boolean;
  onToggleExpand: () => void;
  onRequestDelete: () => void;
}) {
  return (
    <>
      <tr className="bg-white">
        <td className={tdClass}>
          <button
            type="button"
            onClick={onToggleExpand}
            className="inline-flex max-w-full items-center gap-1 text-left underline-offset-2 hover:underline"
          >
            <span className="min-w-0 break-all">{sellerNameWithCount(row)}</span>
            <ChevronIcon open={open} />
          </button>
        </td>
        <td className={tdClass}>{displayPhone(row.dbtalkPhone)}</td>
        <td className={tdClass}>
          <MemberTypeBadge label={roleLabel(row.role)} />
        </td>
        <td className={tdClass}>{row.paymentCount ?? 0}건</td>
        <td className={tdClass}>{formatAmount(row.estimatedSettlementAmount)}</td>
        <td className={tdClass}>
          {row.lastOrderAt ? formatDateTime(row.lastOrderAt) : "—"}
        </td>
        <td className={tdClass}>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-gray-03"
            onClick={onRequestDelete}
          >
            삭제
          </Button>
        </td>
      </tr>
      {open && loadingCust && (
        <tr className="bg-[#FAFFF0]">
          <td colSpan={COLS} className={`${tdClass} typo-body-02-regular text-gray-04`}>
            불러오는 중…
          </td>
        </tr>
      )}
      {open && !loadingCust && customers == null && (
        <tr className="bg-[#FAFFF0]">
          <td colSpan={COLS} className={`${tdClass} typo-body-02-regular text-gray-04`}>
            목록을 불러오지 못했습니다.
          </td>
        </tr>
      )}
      {open && !loadingCust && customers != null && customers.length === 0 && (
        <tr className="bg-[#FAFFF0]">
          <td colSpan={COLS} className={`${tdClass} text-gray-05`}>
            등록된 하위 고객이 없습니다.
          </td>
        </tr>
      )}
      {open &&
        !loadingCust &&
        customers != null &&
        customers.map((c) => (
          <tr key={c.id} className="bg-[#FAFFF0]">
            <td className={cn(tdClass, "pl-8")}>{c.email ?? "—"}</td>
            <td className={tdClass}>{displayPhone(c.phone)}</td>
            <td className={tdClass}>
              <MemberTypeBadge
                label={customerMemberTypeLabel(c.role, c.paid_until)}
              />
            </td>
            <td className={tdClass}>{c.paymentCount ?? 0}건</td>
            <td className={tdClass}>{formatAmount(c.estimatedSettlementAmount)}</td>
            <td className={tdClass}>
              {c.lastPaidAt ? formatDateTime(c.lastPaidAt) : "—"}
            </td>
            <td className={tdClass} />
          </tr>
        ))}
    </>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={cn("shrink-0 text-gray-04 transition-transform", open && "rotate-180")}
      aria-hidden
    >
      <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
