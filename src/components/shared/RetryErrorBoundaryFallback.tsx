"use client";

import { Button } from "@/components/ui/button";

export interface RetryErrorBoundaryFallbackProps {
  error: Error;
  onRetry?: () => void;
}

export function RetryErrorBoundaryFallback({
  error,
  onRetry,
}: RetryErrorBoundaryFallbackProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-8 text-center">
      <p className="text-sm font-medium text-destructive">
        오류가 발생했습니다.
      </p>
      <p className="text-xs text-muted-foreground">{error.message}</p>
      {onRetry && (
        <Button type="button" variant="secondary" onClick={onRetry}>
          다시 시도
        </Button>
      )}
    </div>
  );
}
