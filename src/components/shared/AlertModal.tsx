"use client";

import { Button } from "@/components/ui/button";

export interface AlertModalProps {
  show: boolean;
  title?: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}

export function AlertModal({
  show,
  title = "안내",
  message,
  confirmLabel = "확인",
  onConfirm,
}: AlertModalProps) {
  if (!show) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      aria-modal
      aria-labelledby="alert-modal-title"
    >
      <div className="mx-4 w-full max-w-md rounded-lg border border-border bg-background p-6 shadow-lg">
        <h2 id="alert-modal-title" className="mb-3 text-lg font-semibold">
          {title}
        </h2>
        <p className="mb-6 whitespace-pre-line text-sm text-muted-foreground">
          {message}
        </p>
        <div className="flex justify-end">
          <Button type="button" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
