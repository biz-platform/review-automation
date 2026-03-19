"use client";

import { Button } from "@/components/ui/button";
import type {
  AdminCustomerData,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { MEMBER_TYPE_DROPDOWN_OPTIONS } from "./constants";
import { rowToOption } from "./utils";

const selectClass =
  "h-10 w-full min-w-[80px] rounded-lg border border-gray-07 bg-white px-3 py-2 typo-body-02-regular text-gray-01 outline-none focus:border-main-02";

export interface MemberTypeCellProps {
  row: AdminCustomerData;
  selectedOption: AdminCustomerMemberTypeOption;
  onOptionChange: (id: string, value: AdminCustomerMemberTypeOption) => void;
  onSave: (row: AdminCustomerData) => void;
  saving: boolean;
}

export function MemberTypeCell({
  row,
  selectedOption,
  onOptionChange,
  onSave,
  saving,
}: MemberTypeCellProps) {
  const currentOption = rowToOption(row);
  const hasChange = selectedOption !== currentOption;

  return (
    <div className="flex items-center gap-2">
      <select
        value={selectedOption}
        onChange={(e) =>
          onOptionChange(
            row.id,
            e.target.value as AdminCustomerMemberTypeOption,
          )
        }
        className={selectClass}
      >
        {MEMBER_TYPE_DROPDOWN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <Button
        type="button"
        variant="secondaryDark"
        size="md"
        disabled={!hasChange || saving}
        onClick={() => onSave(row)}
        className="shrink-0"
      >
        {saving ? "저장 중…" : "저장"}
      </Button>
    </div>
  );
}
