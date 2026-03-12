"use client";

import { useMemo } from "react";
import { formatPhoneDisplay } from "@/lib/utils/format-phone";

/**
 * 휴대전화 번호를 UI 표시용(010-XXXX-XXXX)으로 포맷.
 * null/빈 문자열이면 "-" 반환.
 */
export function useFormattedPhone(phone: string | null | undefined): string {
  return useMemo(() => {
    if (phone == null || phone.trim() === "") return "-";
    return formatPhoneDisplay(phone);
  }, [phone]);
}
