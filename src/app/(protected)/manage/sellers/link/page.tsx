"use client";

import { useEffect, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { API_ENDPOINT } from "@/const/endpoint";

export default function SellerLinkPage() {
  const [link, setLink] = useState<string | null>(null);
  const [loadStatus, setLoadStatus] = useState<
    "loading" | "success" | "forbidden"
  >("loading");
  const [copyLinkStatus, setCopyLinkStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [copyQrStatus, setCopyQrStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const qrContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(API_ENDPOINT.sellers.marketingLink, { credentials: "same-origin" })
      .then((res) => {
        if (!res.ok) throw new Error("Forbidden");
        return res.json();
      })
      .then((data: { result?: { link: string } }) => {
        setLink(data.result?.link ?? null);
        setLoadStatus("success");
      })
      .catch(() => setLoadStatus("forbidden"));
  }, []);

  const handleCopyLink = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopyLinkStatus("success");
      setTimeout(() => setCopyLinkStatus("idle"), 2000);
    } catch {
      setCopyLinkStatus("error");
      setTimeout(() => setCopyLinkStatus("idle"), 2000);
    }
  };

  const getQrCanvas = (): HTMLCanvasElement | null =>
    qrContainerRef.current?.querySelector("canvas") ?? null;

  const handleCopyQrImage = async () => {
    const canvas = getQrCanvas();
    if (!canvas) return;
    try {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (blob)
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
      setCopyQrStatus("success");
      setTimeout(() => setCopyQrStatus("idle"), 2000);
    } catch {
      setCopyQrStatus("error");
      setTimeout(() => setCopyQrStatus("idle"), 2000);
    }
  };

  const handleDownloadQrImage = () => {
    const canvas = getQrCanvas();
    if (!canvas) return;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = "oliview-sales-qr.png";
    a.click();
  };

  if (loadStatus === "loading") {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">영업 링크</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">불러오는 중…</p>
      </div>
    );
  }

  if (loadStatus === "forbidden") {
    return (
      <div className="p-6 md:p-8">
        <h1 className="typo-heading-01-bold text-gray-01">영업 링크</h1>
        <p className="mt-4 typo-body-02-regular text-gray-03">
          셀러 권한이 필요합니다. 셀러 등록 신청 후 이용해 주세요.
        </p>
      </div>
    );
  }

  const displayLink = link ?? "";

  return (
    <div className="p-6 md:p-8">
      <h1 className="typo-heading-01-bold text-gray-01">영업 링크</h1>
      <p className="mt-2 typo-body-02-regular text-gray-03">
        아래 링크를 공유해 고객이 결제하면 결제가 발생할 때마다 셀러에게
        수수료가 지급돼요
      </p>

      <div className="mt-6 inline-flex w-full flex-col items-start justify-center gap-6 rounded-lg px-6 py-5 outline outline-1 outline-offset-[-1px] outline-gray-07">
        {/* 올리뷰 서비스 영업 링크 */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-end sm:gap-3">
          <div className="min-w-0 flex-1 flex-col gap-3">
            <div className="typo-body-01-bold text-gray-01">
              올리뷰 서비스 영업 링크
            </div>
            <div className="mt-2 h-12 w-full rounded-lg bg-gray-08 px-5 py-2.5 outline outline-1 outline-offset-[-1px] outline-gray-07 flex items-center">
              <span className="truncate typo-body-01-regular text-gray-01">
                {displayLink || "—"}
              </span>
            </div>
          </div>
          <Button
            type="button"
            variant="secondaryDark"
            size="md"
            className="w-full shrink-0 sm:w-28 lg:p-4 lg:typo-body-01-bold"
            onClick={handleCopyLink}
            disabled={!displayLink}
          >
            {copyLinkStatus === "success"
              ? "복사됨"
              : copyLinkStatus === "error"
                ? "복사 실패"
                : "링크 복사"}
          </Button>
        </div>

        {/* 올리뷰 서비스 영업 QR 코드 */}
        <div className="flex w-full flex-col gap-4">
          <div className="typo-body-01-bold text-gray-01">
            올리뷰 서비스 영업 QR 코드
          </div>
          <div className="flex w-full flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div
              ref={qrContainerRef}
              className="flex h-28 w-28 shrink-0 items-center justify-center rounded-lg outline outline-1 outline-offset-[-1px] outline-gray-07 bg-white p-3"
            >
              {displayLink ? (
                <QRCodeCanvas value={displayLink} size={96} level="M" />
              ) : (
                <div className="h-24 w-24 bg-gray-08" />
              )}
            </div>
            <div className="flex w-full flex-1 flex-wrap items-center gap-3 sm:w-auto sm:flex-initial">
              <Button
                type="button"
                variant="secondaryDark"
                size="md"
                className="whitespace-nowrap px-3 py-2 lg:p-4 lg:typo-body-01-bold"
                onClick={handleCopyQrImage}
                disabled={!displayLink}
              >
                {copyQrStatus === "success"
                  ? "복사됨"
                  : copyQrStatus === "error"
                    ? "복사 실패"
                    : (
                        <>
                          <span className="lg:hidden">이미지 복사</span>
                          <span className="hidden lg:inline">QR 코드 이미지 복사</span>
                        </>
                      )}
              </Button>
              <Button
                type="button"
                variant="secondaryDark"
                size="md"
                className="whitespace-nowrap px-3 py-2 lg:p-4 lg:typo-body-01-bold"
                onClick={handleDownloadQrImage}
                disabled={!displayLink}
              >
                <span className="lg:hidden">이미지 다운로드</span>
                <span className="hidden lg:inline">QR 코드 이미지 다운로드</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
