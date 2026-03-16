"use client";

import { useEffect } from "react";
import { REFERRAL_CODE_STORAGE_KEY } from "@/const/referral";

/**
 * URL에 ?ref= 있으면 referral_code를 localStorage에 저장.
 * 셀러 영업 링크(/?ref=코드)로 진입 시 회원가입에서 사용할 수 있도록 함.
 */
export function RefReferralStorage() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const ref = params.get("ref")?.trim();
    if (ref) {
      localStorage.setItem(REFERRAL_CODE_STORAGE_KEY, ref);
    }
  }, []);
  return null;
}
