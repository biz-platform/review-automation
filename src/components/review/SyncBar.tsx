"use client";

import { Button } from "@/components/ui/button";

export interface SyncBarProps {
  count: number;
  onSync: () => void;
  isSyncing: boolean;
  syncLabel?: string;
  syncingLabel?: string;
}

export function SyncBar({
  count,
  onSync,
  isSyncing,
  syncLabel = "리뷰 동기화",
  syncingLabel = "리뷰 동기화 중…",
}: SyncBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-4">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm">
        <span className="text-foreground">전체 {count}건</span>
      </div>
      <Button
        type="button"
        variant="secondary"
        onClick={onSync}
        disabled={isSyncing}
        className="bg-muted/50"
      >
        {isSyncing ? syncingLabel : syncLabel}
      </Button>
    </div>
  );
}
