"use client";

import { DataTable } from "@/components/shared/DataTable";
import type {
  AdminCustomerData,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { MemberTypeCell } from "./MemberTypeCell";
import { SellerRegisterCell } from "./SellerRegisterCell";
import { maskPhone, rowToOption } from "./utils";

const COLUMNS = [
  { id: "id", header: "ID" },
  { id: "email", header: "이메일" },
  { id: "phone", header: "휴대전화 번호" },
  { id: "memberType", header: "회원 유형" },
  { id: "sellerRegister", header: "셀러 등록" },
] as const;

export interface AdminCustomerTableProps {
  list: AdminCustomerData[];
  page: number;
  pageSize: number;
  editingRoleById: Record<string, AdminCustomerMemberTypeOption>;
  onEditingRoleChange: (id: string, value: AdminCustomerMemberTypeOption) => void;
  onSaveRole: (row: AdminCustomerData) => void;
  onSellerRegister: (row: AdminCustomerData) => void;
  savingId: string | null;
}

export function AdminCustomerTable({
  list,
  page,
  pageSize,
  editingRoleById,
  onEditingRoleChange,
  onSaveRole,
  onSellerRegister,
  savingId,
}: AdminCustomerTableProps) {
  return (
    <DataTable<AdminCustomerData>
      columns={COLUMNS.map((c) => ({ id: c.id, header: c.header }))}
      data={list}
      getRowKey={(row) => row.id}
      emptyMessage="조회된 고객이 없습니다."
      minWidth="min-w-[900px]"
      className="hidden md:block"
      renderCell={(row, columnId, idx) => {
        switch (columnId) {
          case "id":
            return (page - 1) * pageSize + idx + 1;
          case "email":
            return row.email ?? "—";
          case "phone":
            return maskPhone(row.phone);
          case "memberType":
            return (
              <MemberTypeCell
                row={row}
                selectedOption={editingRoleById[row.id] ?? rowToOption(row)}
                onOptionChange={onEditingRoleChange}
                onSave={onSaveRole}
                saving={savingId === row.id}
              />
            );
          case "sellerRegister":
            return (
              <SellerRegisterCell
                row={row}
                onRegister={onSellerRegister}
                saving={savingId === row.id}
              />
            );
          default:
            return null;
        }
      }}
    />
  );
}
