"use client";

import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { TextField } from "@/components/ui/text-field";
import { searchAdminReferralSellers } from "@/entities/admin/api/customer-api";
import type {
  AdminCustomerData,
  AdminReferralSellerSearchRow,
} from "@/entities/admin/types";
import { cn } from "@/lib/utils/cn";
import { sellerRoleLabel } from "./utils";

export interface AdminReferralLinkModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer: AdminCustomerData | null;
  onSubmit: (referredByUserId: string | null) => Promise<void>;
}

export function AdminReferralLinkModal({
  open,
  onOpenChange,
  customer,
  onSubmit,
}: AdminReferralLinkModalProps) {
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<AdminReferralSellerSearchRow[]>([]);
  const [selected, setSelected] = useState<AdminReferralSellerSearchRow | null>(
    null,
  );
  const [searching, setSearching] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"form" | "clearConfirm">("form");

  useEffect(() => {
    if (!open) return;
    setKeyword("");
    setResults([]);
    setSelected(null);
    setSearching(false);
    setSubmitting(false);
    setError(null);
    setMode("form");
  }, [open, customer?.id]);

  const handleSearch = useCallback(async () => {
    setError(null);
    setSelected(null);
    const q = keyword.trim();
    if (q.length < 2) {
      setError("이메일 또는 추천 코드를 2자 이상 입력해 주세요.");
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const data = await searchAdminReferralSellers({ keyword: q });
      setResults(data.list);
      if (data.list.length === 0) {
        setError(
          "검색 결과가 없습니다. 셀러 등록이 완료된 센터장·플래너만 연결됩니다.",
        );
      }
    } catch (e) {
      setResults([]);
      setError(e instanceof Error ? e.message : "검색에 실패했습니다.");
    } finally {
      setSearching(false);
    }
  }, [keyword]);

  const handleConnect = useCallback(async () => {
    if (!customer || !selected) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(selected.id);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  }, [customer, selected, onSubmit, onOpenChange]);

  const handleClear = useCallback(async () => {
    if (!customer) return;
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit(null);
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "처리에 실패했습니다.");
    } finally {
      setSubmitting(false);
      setMode("form");
    }
  }, [customer, onSubmit, onOpenChange]);

  if (!customer) return null;

  const hasLink = customer.referred_by_user_id != null;
  const sameSeller =
    selected != null && selected.id === customer.referred_by_user_id;

  const formBody = (
    <div className="flex w-full flex-col gap-4">
      <p className="typo-body-02-regular text-gray-03">
        대상:{" "}
        <span className="text-gray-01">{customer.email ?? customer.id}</span>
      </p>
      {hasLink && (
        <div className="flex flex-col gap-2 rounded-lg border border-gray-07 bg-gray-08 px-3 py-3">
          <p className="typo-body-03-regular text-gray-04">연결된 셀러</p>
          <p className="min-w-0 break-words typo-body-02-regular text-gray-01">
            {customer.referred_by_email ?? "—"}
          </p>
          {customer.referred_by_role != null && (
            <span className="inline-flex w-fit items-center rounded-md border border-gray-06 bg-white px-2.5 py-1 typo-body-03-bold text-gray-03">
              {sellerRoleLabel(customer.referred_by_role)}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <label className="typo-body-03-regular text-gray-03">
            {hasLink ? "다른 셀러 검색" : "셀러 이메일 또는 추천 코드"}
          </label>
          {hasLink && (
            <p className="typo-body-03-regular text-gray-04">
              검색 후 선택하면 연결이 변경됩니다.
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <TextField
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="검색"
            className="w-full flex-1"
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSearch();
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            className={cn(
              "h-12 shrink-0 py-0",
              "w-full sm:w-auto",
            )}
            disabled={searching}
            onClick={() => void handleSearch()}
          >
            {searching ? "검색 중…" : "검색"}
          </Button>
        </div>
      </div>
      {results.length > 0 && (
        <ul className="max-h-48 overflow-y-auto rounded-lg border border-gray-07">
          {results.map((r) => {
            const active = selected?.id === r.id;
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`w-full px-3 py-2.5 text-left typo-body-02-regular transition-colors ${
                    active
                      ? "bg-main-05 text-main-01"
                      : "text-gray-01 hover:bg-gray-08"
                  }`}
                  onClick={() => setSelected(r)}
                >
                  <span className="block truncate">{r.email ?? r.id}</span>
                  <span className="mt-0.5 block typo-body-03-regular text-gray-04">
                    {sellerRoleLabel(r.role)}
                    {r.referral_code != null
                      ? ` · 코드 ${r.referral_code}`
                      : ""}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {hasLink && selected && !sameSeller && (
        <p className="typo-body-03-regular text-amber-700">
          기존 연결을 끊고 새 셀러로 저장합니다.
        </p>
      )}
      {sameSeller && (
        <p className="typo-body-03-regular text-gray-04">
          이미 이 셀러에 연결되어 있습니다.
        </p>
      )}
      {error != null && (
        <p className="typo-body-03-regular text-red-01">{error}</p>
      )}
    </div>
  );

  const clearBody = (
    <p className="typo-body-02-regular text-gray-03">
      이 고객의 셀러 연결을 해제할까요?{" "}
      <span className="text-gray-01">{customer.email ?? customer.id}</span>
    </p>
  );

  return (
    <>
      <Modal
        open={open && mode === "form"}
        onOpenChange={(v) => {
          if (!v) onOpenChange(false);
        }}
        title={hasLink ? "셀러 정보" : "셀러 연결"}
        size="default"
        className="max-w-[520px]"
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {hasLink ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                disabled={submitting}
                onClick={() => setMode("clearConfirm")}
              >
                연결 해제
              </Button>
            ) : (
              <span />
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                type="button"
                variant="secondary"
                size="md"
                disabled={submitting}
                onClick={() => onOpenChange(false)}
              >
                취소
              </Button>
              <Button
                type="button"
                variant="primary"
                size="md"
                disabled={submitting || selected == null || sameSeller}
                onClick={() => void handleConnect()}
              >
                {submitting
                  ? "저장 중…"
                  : hasLink
                    ? "변경하기"
                    : "연결하기"}
              </Button>
            </div>
          </div>
        }
      >
        {formBody}
      </Modal>

      <Modal
        open={open && mode === "clearConfirm"}
        onOpenChange={(v) => {
          if (!v) {
            setMode("form");
          }
        }}
        title="연결 해제"
        footer={
          <div className="flex w-full justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              disabled={submitting}
              onClick={() => setMode("form")}
            >
              취소
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="md"
              disabled={submitting}
              onClick={() => void handleClear()}
            >
              {submitting ? "처리 중…" : "해제"}
            </Button>
          </div>
        }
      >
        {clearBody}
      </Modal>
    </>
  );
}
