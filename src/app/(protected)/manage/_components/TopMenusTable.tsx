"use client";

import { cn } from "@/lib/utils/cn";
import type { DashboardSalesData } from "@/entities/dashboard/sales-types";

function formatInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

function formatPctSigned(n: number): string {
  const r = Math.round(n * 10) / 10;
  const s = r > 0 ? "+" : "";
  const body = Number.isInteger(r)
    ? String(Math.abs(r))
    : Math.abs(r).toFixed(1);
  return `${s}${body}%`;
}

function PrevPeriodCell({
  row,
}: {
  row: DashboardSalesData["topMenus"][number];
}) {
  const dq = row.quantity - row.previousQuantity;
  const dRev = row.lineTotal - row.previousLineTotal;
  const prevQ = row.previousQuantity;
  const prevRev = row.previousLineTotal;

  if (row.quantity === 0 && prevQ === 0) {
    return <span className="text-gray-03">—</span>;
  }

  if (prevQ === 0 && prevRev === 0 && row.quantity > 0) {
    return (
      <div className="flex flex-col items-center gap-0.5">
        <span className="typo-body-03-regular text-red-01">
          이전 기간 데이터 없음
        </span>
        <span className="text-[11px] text-gray-03 tabular-nums">
          {formatInt(row.quantity)}건 · {formatWon(row.lineTotal)}
        </span>
      </div>
    );
  }

  const qtySame = dq === 0;
  const revSame = dRev === 0;
  if (qtySame && revSame) {
    return <span className="text-gray-03">변화 없음</span>;
  }

  const qtyPct = prevQ > 0 ? ((row.quantity - prevQ) / prevQ) * 100 : null;
  const revPct =
    prevRev > 0 ? ((row.lineTotal - prevRev) / prevRev) * 100 : null;

  const dir = dq !== 0 ? Math.sign(dq) : dRev !== 0 ? Math.sign(dRev) : 0;
  const netUp = dir > 0;
  const netDown = dir < 0;
  const tone = netUp
    ? "text-red-01"
    : netDown
      ? "text-blue-600"
      : "text-gray-03";
  const arrow = netUp ? "▲" : netDown ? "▼" : "—";

  return (
    <div className="flex flex-col gap-1">
      <p className={cn("typo-body-03-regular", tone)}>
        <span className="mr-0.5">{arrow}</span>
        지난 기간보다 {netUp ? "증가" : netDown ? "감소" : "동일"}
      </p>
      <div className="text-[11px] leading-snug text-gray-03 tabular-nums">
        {!qtySame && (
          <p>
            주문 {dq > 0 ? "+" : ""}
            {formatInt(dq)}건
            {qtyPct != null && (
              <span className="text-gray-04"> ({formatPctSigned(qtyPct)})</span>
            )}
          </p>
        )}
        {!revSame && (
          <p>
            매출 {dRev > 0 ? "+" : dRev < 0 ? "−" : ""}
            {formatWon(Math.abs(dRev))}
            {revPct != null && (
              <span className="text-gray-04"> ({formatPctSigned(revPct)})</span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

export function TopMenusTable({
  rows,
  soldQuantityTotal,
  emptyText = "메뉴 집계 데이터가 없어요.",
}: {
  rows: DashboardSalesData["topMenus"];
  /** 기간 내 전체 판매 수량 합 — '판매 수량 전체 대비 %' 분모 */
  soldQuantityTotal: number;
  emptyText?: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-gray-08 px-4 py-8 text-center typo-body-02-regular text-gray-03">
        {emptyText}
      </div>
    );
  }

  const denom = soldQuantityTotal > 0 ? soldQuantityTotal : 0;

  return (
    <>
      {/* mobile: figma-style list */}
      <div className="mt-4 overflow-hidden rounded-lg border border-[#D9D9D9] bg-white sm:hidden">
        <div className="px-4 py-3">
          <p className="typo-body-02-bold text-gray-04">많이 판매된 메뉴</p>
        </div>
        <div className="h-px w-full bg-gray-07" />
        <ol className="flex flex-col">
          {rows.map((r, idx) => (
            <MobileMenuRow
              key={`${r.menuName}-${idx}`}
              row={r}
              index={idx}
              denom={denom}
            />
          ))}
        </ol>
      </div>

      {/* desktop: keep existing table */}
      <div className="mt-4 hidden overflow-hidden rounded-lg border border-[#D9D9D9] bg-white sm:block">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col className="w-12" />
            <col className="w-[22%]" />
            <col />
            <col className="w-32" />
            <col className="w-40" />
            <col className="min-w-48 w-48" />
          </colgroup>
          <thead>
            <tr className="bg-gray-08 typo-body-03-regular text-gray-03">
              <th
                rowSpan={2}
                className="border-b border-l border-border p-4 text-left align-middle first:border-l-0"
              >
                No
              </th>
              <th
                rowSpan={2}
                className="border-b border-l border-border p-4 text-left align-middle"
              >
                메뉴명
              </th>
              <th
                className="border-b border-l border-border p-4 text-center"
                colSpan={2}
              >
                주문 수
              </th>
              <th
                rowSpan={2}
                className="border-b border-l border-border p-4 align-middle"
              >
                매출
              </th>
              <th
                rowSpan={2}
                className="border-b border-l border-border p-4 text-center align-middle"
              >
                지난 기간 대비
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => {
              const sharePct =
                denom > 0 ? Math.round((r.quantity / denom) * 1000) / 10 : 0;
              return (
                <tr key={`${r.menuName}-${idx}`}>
                  <td className="border-b border-l border-border p-4 text-left typo-body-03-regular text-gray-03 tabular-nums first:border-l-0">
                    {idx + 1}
                  </td>
                  <td className="border-b border-l border-border p-4 text-left typo-body-02-regular text-gray-01">
                    <span className="line-clamp-2">{r.menuName}</span>
                  </td>
                  <td className="border-b border-l border-border p-4">
                    <p className="typo-body-03-regular text-gray-03">
                      판매 수량 전체 대비 {sharePct.toFixed(1)}%
                    </p>
                    <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full bg-gray-08">
                      <div
                        className="h-full rounded-full bg-main-03"
                        style={{
                          width: `${Math.min(100, sharePct)}%`,
                        }}
                      />
                    </div>
                  </td>
                  <td className="border-b border-l border-border p-4">
                    <p className="typo-body-02-regular tabular-nums text-gray-01 whitespace-nowrap">
                      {formatInt(r.quantity)}건
                    </p>
                  </td>
                  <td className="border-b border-l border-border p-4">
                    <p className="typo-body-02-bold text-gray-01 tabular-nums">
                      {formatWon(r.lineTotal)}
                    </p>
                    {r.shareOfRevenuePercent != null && (
                      <p className="mt-1 typo-body-03-regular text-gray-03">
                        전체 매출 대비 {r.shareOfRevenuePercent.toFixed(1)}%
                      </p>
                    )}
                  </td>
                  <td className="border-b border-l border-border p-4">
                    <PrevPeriodCell row={r} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MobileMenuRow({
  row,
  index,
  denom,
}: {
  row: DashboardSalesData["topMenus"][number];
  index: number;
  denom: number;
}) {
  const sharePct = denom > 0 ? Math.round((row.quantity / denom) * 1000) / 10 : 0;
  const dq = row.quantity - row.previousQuantity;
  const up = dq > 0;
  const down = dq < 0;
  const tone = up ? "text-red-01" : down ? "text-blue-600" : "text-gray-03";
  const arrow = up ? "▲" : down ? "▼" : "—";
  const deltaLabel = up ? "증가" : down ? "감소" : "유지";

  return (
    <li className="px-4 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div className="w-5 shrink-0 text-gray-03 typo-body-02-regular tabular-nums">
            {index + 1}
          </div>
          <div className="min-w-0">
            <p className="typo-body-02-regular text-gray-01 line-clamp-2">
              {row.menuName}
            </p>
          </div>
        </div>
        <div className={cn("shrink-0 typo-body-02-regular", tone)}>
          <span className="mr-1">{arrow}</span>
          {deltaLabel}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-3">
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-gray-08">
          <div
            className="h-full rounded-full bg-main-03"
            style={{ width: `${Math.min(100, sharePct)}%` }}
          />
        </div>
        <div className="shrink-0 text-right tabular-nums">
          <span className="typo-body-03-regular text-gray-03">
            {sharePct.toFixed(1)}%
          </span>{" "}
          <span className="typo-body-02-regular text-gray-02">
            {formatInt(row.quantity)}건
          </span>
        </div>
      </div>

      <p className="mt-2 text-[11px] leading-snug text-gray-03 tabular-nums">
        매출 {formatWon(row.lineTotal)}
        {row.shareOfRevenuePercent != null ? (
          <span className="text-gray-04">
            {" "}
            · 전체 매출 대비 {row.shareOfRevenuePercent.toFixed(1)}%
          </span>
        ) : null}
      </p>
    </li>
  );
}
