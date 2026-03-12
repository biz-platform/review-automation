"use client";

import { useMemo } from "react";
import { formatBusinessRegistrationDisplay } from "@/lib/utils/format-business-registration";

/**
 * 사업자등록번호를 UI 표시용(xxx-xx-xxxxx)으로 포맷.
 * null/빈 문자열이면 "-" 반환.
 */
export function useFormattedBusinessRegistration(
  value: string | null | undefined,
): string {
  return useMemo(() => {
    if (value == null || String(value).trim() === "") return "—";
    const formatted = formatBusinessRegistrationDisplay(value);
    return formatted || "—";
  }, [value]);
}
