"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { getDashboardReviewsByKeyword } from "@/entities/dashboard/api/dashboard-api";
import { getAdminStoreDashboardReviewsByKeyword } from "@/entities/admin/api/store-api";
import type {
  DashboardReviewKeywordReviewListData,
} from "@/entities/dashboard/reviews-types";
import type { DashboardRange } from "@/entities/dashboard/types";

type ReviewKeywordReviewsModalVariant = "member" | "admin";

const PLATFORM_LABEL: Record<string, string> = {
  baemin: "배달의민족",
  coupang_eats: "쿠팡이츠",
  yogiyo: "요기요",
  ddangyo: "땡겨요",
};

function platformLabel(platform: string): string {
  return PLATFORM_LABEL[platform] ?? platform;
}

function formatWrittenAt(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function excerpt(text: string | null, max = 160): string {
  if (!text?.trim()) return "(내용 없음)";
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

export type ReviewKeywordModalSelection = {
  keyword: string;
  sentiment: "positive" | "negative";
};

type ReviewKeywordReviewsModalProps = {
  variant: ReviewKeywordReviewsModalVariant;
  adminUserId: string;
  storeId: string;
  range: DashboardRange;
  platform: string;
  selection: ReviewKeywordModalSelection | null;
  onClose: () => void;
};

export function ReviewKeywordReviewsModal({
  variant,
  adminUserId,
  storeId,
  range,
  platform,
  selection,
  onClose,
}: ReviewKeywordReviewsModalProps) {
  const open = selection != null;
  const [data, setData] = useState<DashboardReviewKeywordReviewListData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !selection) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    const req = {
      storeId,
      range,
      platform: platform || undefined,
      keyword: selection.keyword,
      sentiment: selection.sentiment,
    };
    const p =
      variant === "member"
        ? getDashboardReviewsByKeyword(req)
        : getAdminStoreDashboardReviewsByKeyword({
            userId: adminUserId,
            ...req,
          });
    void p
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setData(null);
          setError(e.message ?? "불러오기에 실패했습니다.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, variant, adminUserId, storeId, range, platform, selection]);

  const sentimentTitle =
    selection?.sentiment === "positive" ? "긍정 키워드" : "개선 키워드";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={
        selection
          ? `「${selection.keyword}」 관련 리뷰`
          : ""
      }
      className="max-w-[560px]"
      footer={
        <Button type="button" variant="secondary" size="md" onClick={onClose}>
          닫기
        </Button>
      }
    >
      <div className="flex max-h-[min(60vh,520px)] flex-col gap-3 overflow-y-auto pr-1">
        {selection && (
          <p className="typo-body-03-regular text-gray-03">
            {sentimentTitle} ·{" "}
            {loading ? "불러오는 중…" : data?.periodLabel ?? ""}
            {data != null && !loading && (
              <span className="tabular-nums">
                {" "}
                · {data.count.toLocaleString("ko-KR")}건
              </span>
            )}
          </p>
        )}
        {error && (
          <p className="typo-body-02-regular text-red-600">{error}</p>
        )}
        {loading && (
          <p className="typo-body-02-regular text-gray-03">
            리뷰를 불러오는 중…
          </p>
        )}
        {!loading && data && data.reviews.length === 0 && (
          <p className="typo-body-02-regular text-gray-03">
            해당 기간·조건에 맞는 리뷰가 없어요.
          </p>
        )}
        {!loading &&
          data?.reviews.map((r) => (
            <div
              key={r.id}
              className="rounded-lg border border-gray-07 bg-gray-08/40 p-3"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="typo-body-03-bold text-gray-01">
                  {platformLabel(r.platform)}
                </span>
                <span className="typo-body-03-regular text-gray-03 tabular-nums">
                  {formatWrittenAt(r.written_at)}
                </span>
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 typo-body-03-regular text-gray-02">
                {r.rating != null && (
                  <span className="tabular-nums">{r.rating.toFixed(1)}점</span>
                )}
                {r.author_name?.trim() && (
                  <span className="truncate">{r.author_name}</span>
                )}
              </div>
              <p className="mt-2 typo-body-03-regular text-gray-02">
                {excerpt(r.content)}
              </p>
            </div>
          ))}
      </div>
    </Modal>
  );
}
