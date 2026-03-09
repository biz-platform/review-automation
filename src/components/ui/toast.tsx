"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/cn";

/**
 * Toast (디자인 시스템 3205-234)
 * - 컨테이너: bg-gray-02, rounded (4px), padding 16px, max-w 320, row center
 * - 텍스트: typo-body-02-regular, white, center
 */

export interface ToastProps {
  children: ReactNode;
  className?: string;
}

/** 단일 토스트 말풍선 (프레젠테이션) */
export function Toast({ children, className }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex max-w-[320px] items-center justify-center gap-2.5 rounded px-4 py-4",
        "bg-gray-02 text-center typo-body-02-regular text-white",
        className
      )}
    >
      {children}
    </div>
  );
}

// --- Toast Provider (목록 + 자동 제거) ---

export interface ToastItem {
  id: string;
  message: ReactNode;
  duration?: number;
}

const ToastContext = createContext<{
  toasts: ToastItem[];
  addToast: (message: ReactNode, options?: { duration?: number }) => string;
  removeToast: (id: string) => void;
} | null>(null);

const DEFAULT_DURATION = 3000;

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast는 ToastProvider 안에서 사용해야 합니다.");
  return ctx;
}

export interface ToastProviderProps {
  children: ReactNode;
  /** 토스트가 붙을 컨테이너 (기본 document.body) */
  container?: HTMLElement;
  /** 기본 표시 시간(ms). 기본 3000 */
  defaultDuration?: number;
}

export function ToastProvider({
  children,
  container,
  defaultDuration = DEFAULT_DURATION,
}: ToastProviderProps) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback(
    (message: ReactNode, options?: { duration?: number }) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
      const duration = options?.duration ?? defaultDuration;
      setToasts((prev) => [...prev, { id, message, duration }]);
      return id;
    },
    [defaultDuration]
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      {typeof document !== "undefined" &&
        toasts.length > 0 &&
        createPortal(
          <ToastList toasts={toasts} removeToast={removeToast} />,
          container ?? document.body
        )}
    </ToastContext.Provider>
  );
}

function ToastList({
  toasts,
  removeToast,
}: {
  toasts: ToastItem[];
  removeToast: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-6 left-1/2 z-200 flex -translate-x-1/2 flex-col gap-2"
      aria-label="토스트 알림"
    >
      {toasts.map((t) => (
        <ToastWithAutoDismiss
          key={t.id}
          id={t.id}
          duration={t.duration ?? DEFAULT_DURATION}
          onDismiss={() => removeToast(t.id)}
        >
          {t.message}
        </ToastWithAutoDismiss>
      ))}
    </div>
  );
}

function ToastWithAutoDismiss({
  id,
  duration,
  onDismiss,
  children,
}: {
  id: string;
  duration: number;
  onDismiss: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [id, duration, onDismiss]);
  return <Toast>{children}</Toast>;
}
