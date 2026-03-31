"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";
import {
  MaskedNativeSelect,
  type MaskedNativeSelectProps,
} from "@/components/ui/masked-native-select";

export interface NativeSelectOption {
  value: string;
  label: string;
}

export interface NativeSelectProps
  extends Omit<
    MaskedNativeSelectProps,
    "children" | "className" | "wrapperClassName"
  > {
  label?: string;
  options: NativeSelectOption[];
  className?: string;
  inputClassName?: string;
}

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  (
    { label, options, id, className, inputClassName, uiSize = "md", ...props },
    ref,
  ) => (
    <div className={cn("mb-4", className)}>
      {label && (
        <label
          htmlFor={id}
          className="typo-body-02-bold mb-2 block text-gray-01"
        >
          {label}
        </label>
      )}
      <MaskedNativeSelect
        ref={ref}
        id={id}
        uiSize={uiSize}
        className={inputClassName}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </MaskedNativeSelect>
    </div>
  ),
);
NativeSelect.displayName = "NativeSelect";
