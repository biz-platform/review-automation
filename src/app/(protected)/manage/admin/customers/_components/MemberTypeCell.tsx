"use client";

import { Button } from "@/components/ui/button";
import type {
  AdminCustomerData,
  AdminCustomerMemberTypeOption,
} from "@/entities/admin/types";
import { MaskedNativeSelect } from "@/components/ui/masked-native-select";
import { MEMBER_TYPE_DROPDOWN_OPTIONS } from "./constants";
import { rowToOption } from "./utils";

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
      <MaskedNativeSelect
        value={selectedOption}
        onChange={(e) =>
          onOptionChange(
            row.id,
            e.target.value as AdminCustomerMemberTypeOption,
          )
        }
        wrapperClassName="w-full min-w-[120px]"
      >
        {MEMBER_TYPE_DROPDOWN_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </MaskedNativeSelect>
      <Button
        type="button"
        variant="secondary"
        size="md"
        disabled={!hasChange || saving}
        onClick={() => onSave(row)}
        className="h-12 shrink-0 text-gray-05 hover:text-gray-01"
      >
        {saving ? "저장 중…" : "저장"}
      </Button>
    </div>
  );
}
