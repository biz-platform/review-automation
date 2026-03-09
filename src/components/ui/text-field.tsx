"use client";

import { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * TextField state별 디자인 정의 (디자인 토큰만 사용)
 * - default: outline gray-07, placeholder gray-06
 * - focus: outline gray-03
 * - filled: outline gray-07, text gray-01
 * - disabled: outline gray-07, bg wgray-06(버튼 disabled와 통일), placeholder gray-06, text gray-05
 * - readonly: outline wgray-04, bg gray-06, text gray-01
 * - timer: outline gray-03, text gray-01, addon red-01
 */
const textFieldInputVariants = cva(
  "h-12 w-full rounded-lg bg-white pl-5 py-2.5 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline outline-1 outline-offset-[-1px] transition-colors disabled:cursor-not-allowed disabled:bg-wgray-06 disabled:outline-gray-07 disabled:placeholder:text-gray-06 disabled:text-gray-05 disabled:focus:outline-gray-07 disabled:focus:outline-1 disabled:focus:ring-0 read-only:cursor-default read-only:outline-wgray-04 read-only:bg-gray-06",
  {
    variants: {
      status: {
        /** default/filled: outline gray-07, focus 시 outline gray-03 */
        default:
          "outline-gray-07 focus:outline-2 focus:outline-offset-[-2px] focus:outline-gray-03",
        error:
          "outline-2 outline-offset-[-2px] outline-red-01 focus:outline-red-01",
        success:
          "outline-2 outline-offset-[-2px] outline-blue-01 focus:outline-blue-01",
      },
    },
    defaultVariants: {
      status: "default",
    },
  }
);

export interface TextFieldProps
  extends Omit<
      React.InputHTMLAttributes<HTMLInputElement>,
      "size" | "className"
    >,
    VariantProps<typeof textFieldInputVariants> {
  /** 라벨 (예: "이메일 주소") */
  label?: string;
  /** 에러 메시지 (있으면 status="error" 스타일 + 하단 빨간 텍스트) */
  errorMessage?: string;
  /** 성공/안내 메시지 (있으면 status="success" 스타일 + 하단 파란 텍스트) */
  successMessage?: string;
  /** timer 상태: 오른쪽에 표시할 내용 (예: "04:53") */
  trailingAddon?: React.ReactNode;
  /** 래퍼 div 클래스 */
  className?: string;
  /** input 엘리먼트 클래스 */
  inputClassName?: string;
  /** true면 disabled 시에도 기본 테두리색(outline-gray-07) 유지 (이메일·인증번호 등 시각 통일) */
  keepDefaultOutlineWhenDisabled?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(
  (
    {
      label,
      errorMessage,
      successMessage,
      status,
      trailingAddon,
      className,
      inputClassName,
      keepDefaultOutlineWhenDisabled,
      disabled,
      ...props
    },
    ref
  ) => {
    const effectiveStatus =
      status ?? (errorMessage ? "error" : successMessage ? "success" : "default");
    const generatedId = useId();
    const id = props.id ?? (label ? `text-field-${label.replace(/\s/g, "-")}` : generatedId);
    const ariaInvalid = effectiveStatus === "error" ? true : undefined;
    const ariaDescribedBy = errorMessage
      ? `${id}-error`
      : successMessage && !errorMessage
        ? `${id}-success`
        : undefined;

    return (
      <div
        className={cn(
          "flex min-w-0 flex-col items-stretch gap-3",
          className,
          disabled && "pointer-events-none select-none"
        )}
      >
        {label != null && (
          <label
            htmlFor={id}
            className="typo-body-01-bold text-gray-01"
          >
            {label}
          </label>
        )}
        {trailingAddon != null ? (
          <div
            className={cn(
              "relative flex h-12 w-full items-center rounded-lg bg-white outline-1 -outline-offset-1 outline-gray-07 transition-colors focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-gray-03",
              effectiveStatus === "error" &&
                "outline-2 -outline-offset-2 outline-red-01 focus-within:outline-red-01",
              effectiveStatus === "success" &&
                "outline-2 -outline-offset-2 outline-blue-01 focus-within:outline-blue-01",
              disabled &&
                "bg-wgray-06 outline-gray-07 has-[:disabled]:focus-within:outline-gray-07",
              props.readOnly && "outline-wgray-04 bg-gray-06"
            )}
          >
            <input
              ref={ref}
              id={id}
              disabled={disabled}
              className={cn(
                "h-12 min-w-0 flex-1 rounded-lg border-0 bg-white pl-5 py-2.5 pr-2 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline-none disabled:cursor-not-allowed disabled:bg-wgray-06 disabled:text-gray-05 disabled:placeholder:text-gray-06 disabled:focus:outline-none disabled:focus:ring-0 read-only:cursor-default read-only:text-gray-01",
                disabled && "input-disabled-force-bg",
                "pr-14",
                inputClassName
              )}
              {...props}
              aria-invalid={ariaInvalid}
              aria-describedby={ariaDescribedBy}
            />
            <span
              className="pointer-events-none absolute right-0 inset-y-0 flex items-center pr-4 typo-body-01-bold text-red-01"
              aria-hidden
            >
              {trailingAddon}
            </span>
          </div>
        ) : (
          <input
            ref={ref}
            id={id}
            disabled={disabled}
            className={cn(
              textFieldInputVariants({ status: effectiveStatus }),
              disabled && "input-disabled-force-bg",
              keepDefaultOutlineWhenDisabled &&
                "disabled:outline-gray-07 disabled:focus:outline-gray-07 disabled:focus:ring-0",
              inputClassName
            )}
            {...props}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
          />
        )}
        {errorMessage && (
          <span
            id={`${id}-error`}
            className="h-6 typo-body-01-regular text-red-01"
          >
            {errorMessage}
          </span>
        )}
        {successMessage && !errorMessage && (
          <span
            id={`${id}-success`}
            className="h-6 typo-body-01-regular text-blue-02"
          >
            {successMessage}
          </span>
        )}
      </div>
    );
  }
);
TextField.displayName = "TextField";
