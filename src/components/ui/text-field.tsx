"use client";

import { forwardRef, useId } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils/cn";

/**
 * TextField state별 디자인 정의
 * - default: outline gray-07, placeholder gray-06
 * - focus: border gray-03
 * - filled: border gray-07, text gray-01
 * - disabled: outline neutral-200(연한 테두리), bg stone-50(밝은 배경), placeholder stone-300
 * - readonly: border wgray-04, bg gray-06, text gray-01
 * - timer: border gray-03, text gray-01, addon red-01
 */
const textFieldInputVariants = cva(
  "h-12 w-full rounded-lg pl-5 py-2.5 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline outline-1 outline-offset-[-1px] transition-colors disabled:cursor-not-allowed disabled:bg-stone-50 disabled:outline-neutral-200 disabled:placeholder:text-stone-300 disabled:text-stone-300 read-only:cursor-default read-only:outline-wgray-04 read-only:bg-gray-06",
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
      <div className={cn("inline-flex flex-col items-start gap-3", className)}>
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
              "relative flex h-12 w-full items-center rounded-lg outline-1 -outline-offset-1 outline-gray-07 transition-colors focus-within:outline-2 focus-within:-outline-offset-2 focus-within:outline-gray-03",
              effectiveStatus === "error" &&
                "outline-2 -outline-offset-2 outline-red-01 focus-within:outline-red-01",
              effectiveStatus === "success" &&
                "outline-2 -outline-offset-2 outline-blue-01 focus-within:outline-blue-01",
              disabled &&
                (keepDefaultOutlineWhenDisabled
                  ? "bg-white outline-gray-07"
                  : "bg-stone-50 outline-neutral-200"),
              props.readOnly && "outline-wgray-04 bg-gray-06"
            )}
          >
            <input
              ref={ref}
              id={id}
              disabled={disabled}
              className={cn(
                "min-w-0 flex-1 rounded-lg border-0 bg-transparent pl-5 py-2.5 pr-2 typo-body-01-regular text-gray-01 placeholder:text-gray-06 outline-none disabled:cursor-not-allowed disabled:bg-transparent disabled:text-stone-300 disabled:placeholder:text-stone-300 read-only:cursor-default read-only:text-gray-01",
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
              keepDefaultOutlineWhenDisabled &&
                "disabled:outline-gray-07 disabled:bg-white",
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
