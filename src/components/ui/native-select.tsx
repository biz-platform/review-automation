"use client";

import { forwardRef } from "react";
import { cn } from "@/lib/utils/cn";

const selectInputClass =
  "h-12 w-full rounded-lg border border-gray-07 bg-white pl-4 pr-4 typo-body-01-regular text-gray-01 outline-none focus:border-gray-03 focus:ring-1 focus:ring-gray-03";

export interface NativeSelectOption {
  value: string;
  label: string;
}

export interface NativeSelectProps
  extends Omit<
    React.SelectHTMLAttributes<HTMLSelectElement>,
    "className" | "children"
  > {
  label?: string;
  options: NativeSelectOption[];
  className?: string;
  inputClassName?: string;
}

export const NativeSelect = forwardRef<HTMLSelectElement, NativeSelectProps>(
  ({ label, options, id, className, inputClassName, ...props }, ref) => (
    <div className={cn("mb-4", className)}>
      {label && (
        <label
          htmlFor={id}
          className="typo-body-02-bold mb-2 block text-gray-01"
        >
          {label}
        </label>
      )}
      <select
        ref={ref}
        id={id}
        className={cn(selectInputClass, inputClassName)}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  )
);
NativeSelect.displayName = "NativeSelect";
