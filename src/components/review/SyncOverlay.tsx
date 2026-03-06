"use client";

export interface SyncOverlayProps {
  show: boolean;
  title?: string;
  description?: string;
}

export function SyncOverlay({
  show,
  title = "리뷰 동기화 중…",
  description = "완료될 때까지 다른 페이지로 이동할 수 없습니다.",
}: SyncOverlayProps) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      aria-modal
      aria-labelledby="sync-overlay-title"
    >
      <div className="rounded-lg border border-border bg-background p-6 shadow-lg">
        <p id="sync-overlay-title" className="mb-4 font-medium">
          {title}
        </p>
        <p className="mb-4 text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
