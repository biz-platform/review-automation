"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";

/**
 * Tooltip (디자인 시스템 3195-558)
 * - 텍스트: typo-body-03-regular, white
 * - 컨테이너: bg-gray-02, rounded, padding, shadow
 */

type TooltipContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
};

const TooltipContext = createContext<TooltipContextValue | null>(null);

function useTooltip(): TooltipContextValue {
  const ctx = useContext(TooltipContext);
  if (!ctx) throw new Error("Tooltip 컴포넌트는 TooltipRoot 안에서 사용해야 합니다.");
  return ctx;
}

export interface TooltipRootProps {
  children: ReactNode;
  delayOpen?: number;
  delayClose?: number;
}

export function TooltipRoot({
  children,
  delayOpen = 0,
  delayClose = 0,
}: TooltipRootProps) {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleOpen = useCallback(() => {
    closeTimerRef.current && clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
    if (delayOpen <= 0) setOpen(true);
    else openTimerRef.current = setTimeout(() => setOpen(true), delayOpen);
  }, [delayOpen]);

  const scheduleClose = useCallback(() => {
    openTimerRef.current && clearTimeout(openTimerRef.current);
    openTimerRef.current = null;
    if (delayClose <= 0) setOpen(false);
    else closeTimerRef.current = setTimeout(() => setOpen(false), delayClose);
  }, [delayClose]);

  return (
    <TooltipContext.Provider value={{ open, setOpen }}>
      <div
        className="relative inline-block"
        onMouseEnter={scheduleOpen}
        onMouseLeave={scheduleClose}
        onFocusCapture={scheduleOpen}
        onBlurCapture={scheduleClose}
      >
        {children}
      </div>
    </TooltipContext.Provider>
  );
}

export interface TooltipTriggerProps {
  children: ReactNode;
}

export function TooltipTrigger({ children }: TooltipTriggerProps) {
  return <>{children}</>;
}

export interface TooltipContentProps {
  children: ReactNode;
  className?: string;
  side?: "top" | "bottom";
}

export function TooltipContent({
  children,
  className,
  side = "top",
}: TooltipContentProps) {
  const { open } = useTooltip();
  if (!open) return null;

  return (
    <div
      className={cn(
        "absolute left-1/2 z-100 -translate-x-1/2",
        side === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"
      )}
    >
      <div
        role="tooltip"
        className={cn(
          "max-w-[240px] rounded px-3 py-2 typo-body-03-regular text-white",
          "bg-gray-02 shadow-md",
          className
        )}
      >
        {children}
      </div>
    </div>
  );
}

/** compound export: Tooltip.Root, Tooltip.Trigger, Tooltip.Content */
export const Tooltip = {
  Root: TooltipRoot,
  Trigger: TooltipTrigger,
  Content: TooltipContent,
} as const;

