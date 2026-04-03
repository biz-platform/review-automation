import type { AdminStoreSummaryRow } from "@/entities/admin/types";

/** 어드민 대시보드 고객 드롭다운 라벨 */
export function adminDashboardUserLabel(row: AdminStoreSummaryRow): string {
  const email = row.email?.trim() ?? "";
  const name = row.previewStoreName?.trim() ?? "";
  if (email && name) return `${email} · ${name}`;
  if (email) return email;
  if (name) return name;
  return `${row.userId.slice(0, 8)}…`;
}
