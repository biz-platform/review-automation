"use client";

import { forwardRef, useId, useState } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * PasswordField state별 디자인 정의
 * - default: 빈 값, placeholder, outline gray-07, visibility-off(마스킹)
 * - masked: 값 있음·비밀번호 표시(●●●●), outline focus 시 gray-03, visibility-off
 * - unmasked: 값 있음·평문 표시, visibility-on
 * - filled: 값 있음(masked와 동일 스타일)
 * - error: outline red-01, 하단 에러 메시지
 */
const passwordFieldWrapperVariants = cva(
  "flex h-12 w-full items-center rounded-lg pl-0 pr-4 outline outline-1 outline-offset-[-1px] transition-colors",
  {
    variants: {
      status: {
        default:
          "outline-gray-07 focus-within:outline-2 focus-within:outline-offset-[-2px] focus-within:outline-gray-03",
        error:
          "outline-2 outline-offset-[-2px] outline-red-01 focus-within:outline-red-01",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

export interface PasswordFieldProps
  extends Omit<
      React.InputHTMLAttributes<HTMLInputElement>,
      "size" | "className" | "type"
    >,
    VariantProps<typeof passwordFieldWrapperVariants> {
  /** 라벨 (예: "비밀번호") */
  label?: string;
  /** 에러 메시지 (있으면 status="error" 스타일 + 하단 빨간 텍스트) */
  errorMessage?: string;
  /** 래퍼 div 클래스 */
  className?: string;
  /** input 엘리먼트 클래스 */
  inputClassName?: string;
}

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(
  (
    {
      label,
      errorMessage,
      status,
      className,
      inputClassName,
      disabled,
      ...props
    },
    ref
  ) => {
    const [visible, setVisible] = useState(false);
    const effectiveStatus = status ?? (errorMessage ? "error" : "default");
    const generatedId = useId();
    const id =
      props.id ?? (label ? `password-field-${label.replace(/\s/g, "-")}` : generatedId);

    return (
      <div className={cn("inline-flex flex-col items-start gap-3", className)}>
        {label != null && (
          <label
            htmlFor={id}
            className="text-base font-medium leading-6 text-gray-01"
          >
            {label}
          </label>
        )}
        <div
          className={cn(
            passwordFieldWrapperVariants({ status: effectiveStatus }),
            disabled && "outline-wgray-04 bg-gray-06"
          )}
        >
          <input
            ref={ref}
            id={id}
            type={visible ? "text" : "password"}
            disabled={disabled}
            className={cn(
              "h-12 min-w-0 flex-1 rounded-lg border-0 bg-transparent pl-5 py-2.5 pr-2 text-base font-normal text-gray-01 placeholder:text-gray-06 outline-none disabled:cursor-not-allowed disabled:text-gray-06",
              inputClassName
            )}
            {...props}
            aria-invalid={effectiveStatus === "error" ? true : undefined}
            aria-describedby={
              errorMessage ? `${id}-error` : undefined
            }
          />
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setVisible((v) => !v)}
            disabled={disabled}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-gray-03 hover:text-gray-01 disabled:pointer-events-none disabled:opacity-50"
            aria-label={visible ? "비밀번호 숨기기" : "비밀번호 표시"}
          >
            {visible ? (
              <VisibilityOffIcon />
            ) : (
              <VisibilityOnIcon />
            )}
          </button>
        </div>
        {errorMessage && (
          <span
            id={`${id}-error`}
            className="h-6 text-base font-normal leading-6 text-red-01"
          >
            {errorMessage}
          </span>
        )}
      </div>
    );
  }
);
PasswordField.displayName = "PasswordField";

function VisibilityOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-6 w-6", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

function VisibilityOnIcon({ className }: { className?: string }) {
  return (
    <svg
      className={cn("h-6 w-6", className)}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
