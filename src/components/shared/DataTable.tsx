"use client";

import type { ReactNode } from "react";

const cellBaseClass =
  "border-r border-gray-07 px-4 py-3 text-left last:border-r-0";

export interface DataTableColumn<T> {
  id: string;
  header: string;
  /** optional: custom header cell class */
  headerClassName?: string;
  /** optional: custom body cell class */
  cellClassName?: string;
}

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  data: T[];
  getRowKey: (row: T) => string;
  renderCell: (row: T, columnId: string, rowIndex: number) => ReactNode;
  emptyMessage?: string;
  minWidth?: string;
  className?: string;
}

/**
 * 공용 테이블. 컬럼 구분선(border-r), 헤더/빈 메시지 지원.
 * 다양한 목록 페이지에서 재사용.
 */
export function DataTable<T>({
  columns,
  data,
  getRowKey,
  renderCell,
  emptyMessage = "조회된 데이터가 없습니다.",
  minWidth = "min-w-[900px]",
  className = "",
}: DataTableProps<T>) {
  return (
    <div
      className={`overflow-x-auto rounded-lg border border-gray-07 ${className}`}
    >
      <table className={`w-full border-collapse ${minWidth}`}>
        <thead>
          <tr className="border-b border-gray-07 bg-gray-08">
            {columns.map((col) => (
              <th
                key={col.id}
                className={`${cellBaseClass} typo-body-03-bold text-gray-01 ${col.headerClassName ?? ""}`}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                className={`${cellBaseClass} px-4 py-8 text-center typo-body-02-regular text-gray-05`}
              >
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => (
              <tr
                key={getRowKey(row)}
                className="border-b border-gray-07 last:border-b-0"
              >
                {columns.map((col) => (
                  <td
                    key={col.id}
                    className={`${cellBaseClass} typo-body-02-regular text-gray-01 ${col.cellClassName ?? ""}`}
                  >
                    {renderCell(row, col.id, idx)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
