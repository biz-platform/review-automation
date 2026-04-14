"use client";

import type { DashboardSalesData } from "@/entities/dashboard/sales-types";

function formatInt(n: number): string {
  return n.toLocaleString("ko-KR");
}

function formatWon(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

export function TopMenusTable({
  rows,
  emptyText = "메뉴 집계 데이터가 없어요.",
}: {
  rows: DashboardSalesData["topMenus"];
  emptyText?: string;
}) {
  if (!rows || rows.length === 0) {
    return (
      <div className="mt-4 rounded-lg border border-border bg-gray-08 px-4 py-8 text-center typo-body-02-regular text-gray-03">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="mt-4 overflow-hidden rounded-lg border border-border">
      <table className="w-full table-fixed border-collapse">
        <thead className="bg-gray-09">
          <tr className="typo-body-03-regular text-gray-03">
            <th className="w-12 px-3 py-3 text-left">No</th>
            <th className="px-3 py-3 text-left">메뉴명</th>
            <th className="w-24 px-3 py-3 text-right">판매 수</th>
            <th className="w-28 px-3 py-3 text-right">매출</th>
            <th className="w-20 px-3 py-3 text-right">비중</th>
          </tr>
        </thead>
        <tbody className="bg-white">
          {rows.map((r, idx) => (
            <tr key={r.menuName} className="border-t border-border">
              <td className="px-3 py-3 text-left typo-body-03-regular text-gray-03 tabular-nums">
                {idx + 1}
              </td>
              <td className="px-3 py-3 text-left typo-body-02-regular text-gray-01">
                <span className="block truncate">{r.menuName}</span>
              </td>
              <td className="px-3 py-3 text-right typo-body-03-regular text-gray-03 tabular-nums">
                {formatInt(r.quantity)}개
              </td>
              <td className="px-3 py-3 text-right typo-body-02-bold text-gray-01 tabular-nums">
                {formatWon(r.lineTotal)}
              </td>
              <td className="px-3 py-3 text-right typo-body-03-regular text-gray-03 tabular-nums">
                {r.shareOfRevenuePercent != null
                  ? `${r.shareOfRevenuePercent.toFixed(1)}%`
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

