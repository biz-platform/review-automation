"use client";

import { SellerListCard, SellerListCardRow } from "@/components/sellers";
import type {
  AdminCustomerData,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { MemberTypeCell } from "./MemberTypeCell";
import { SellerRegisterCell } from "./SellerRegisterCell";
import { AdminCustomerReferralCell } from "./AdminCustomerReferralCell";
import {
  maskPhone,
  rowToOption,
  isSellerEligible,
  canLinkReferral,
} from "./utils";

export interface AdminCustomerMobileListProps {
  list: AdminCustomerData[];
  editingRoleById: Record<string, AdminCustomerMemberTypeOption>;
  onEditingRoleChange: (
    id: string,
    value: AdminCustomerMemberTypeOption,
  ) => void;
  onSaveRole: (row: AdminCustomerData) => void;
  onSellerRegister: (row: AdminCustomerData) => void;
  onReferralConnect: (row: AdminCustomerData) => void;
  savingId: string | null;
}

export function AdminCustomerMobileList({
  list,
  editingRoleById,
  onEditingRoleChange,
  onSaveRole,
  onSellerRegister,
  onReferralConnect,
  savingId,
}: AdminCustomerMobileListProps) {
  return (
    <div className="flex flex-col gap-3 md:hidden">
      {list.map((row) => {
        const selectedOption = editingRoleById[row.id] ?? rowToOption(row);
        return (
          <SellerListCard key={row.id} title={row.email ?? "—"}>
            <SellerListCardRow
              label="휴대전화 번호"
              value={maskPhone(row.phone)}
            />
            <SellerListCardRow
              label="회원 유형"
              value={
                <MemberTypeCell
                  row={row}
                  selectedOption={selectedOption}
                  onOptionChange={onEditingRoleChange}
                  onSave={onSaveRole}
                  saving={savingId === row.id}
                />
              }
            />
            {isSellerEligible(row.role) && (
              <SellerListCardRow
                label="셀러 등록"
                value={
                  <SellerRegisterCell
                    row={row}
                    onRegister={onSellerRegister}
                    saving={savingId === row.id}
                  />
                }
              />
            )}
            {canLinkReferral(row) && (
              <SellerListCardRow
                label="셀러 연결"
                value={
                  <AdminCustomerReferralCell
                    row={row}
                    onConnect={onReferralConnect}
                    saving={savingId === row.id}
                  />
                }
              />
            )}
          </SellerListCard>
        );
      })}
    </div>
  );
}
