"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils/cn";
import { MaskedNativeSelectArrow } from "@/components/ui/masked-native-select";

/**
 * Dropdown (디자인 시스템 3073:335)
 * - Trigger: with-icon(아이콘+라벨+chevron) | without-icon(라벨+chevron), border gray-07, rounded-lg, h-[38px]
 * - Content: 패널 padding 16px 0 16px 16px, 옵션 간 gap 24px
 * - Item: typo-body-02-regular text-gray-01
 *
 * 사용: DropdownRoot > DropdownTrigger + DropdownContent > DropdownItem[]
 */

type DropdownContextValue = {
  open: boolean;
  setOpen: (v: boolean) => void;
  triggerRef: React.RefObject<HTMLButtonElement | null>;
};

const DropdownContext = createContext<DropdownContextValue | null>(null);

export function useDropdown(): DropdownContextValue {
  const ctx = useContext(DropdownContext);
  if (!ctx)
    throw new Error("Dropdown 컴포넌트는 DropdownRoot 안에서 사용해야 합니다.");
  return ctx;
}

export interface DropdownRootProps {
  children: ReactNode;
  /** 제어 모드: 지정 시 open/onOpenChange 필수 */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** 비제어 모드 기본 열림 여부 */
  defaultOpen?: boolean;
  /** 래퍼 클래스 (기본: inline-block). w-full 필요 시 지정 */
  className?: string;
}

export function DropdownRoot({
  children,
  open: controlledOpen,
  onOpenChange,
  defaultOpen = false,
  className,
}: DropdownRootProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : internalOpen;
  const setOpen = useCallback(
    (v: boolean) => {
      if (!isControlled) setInternalOpen(v);
      onOpenChange?.(v);
    },
    [isControlled, onOpenChange],
  );

  return (
    <DropdownContext.Provider value={{ open, setOpen, triggerRef }}>
      <div className={cn("relative inline-block", className)}>{children}</div>
    </DropdownContext.Provider>
  );
}

export interface DropdownTriggerProps {
  /** structure=with-icon 시 왼쪽 아이콘 (24x24) */
  icon?: ReactNode;
  /** 트리거 라벨 */
  children: ReactNode;
  className?: string;
  disabled?: boolean;
  /** false면 우측 셰브론 숨김 (데스크톱 GNB 프로필 등) */
  showChevron?: boolean;
}

export function DropdownTrigger({
  icon,
  children,
  className,
  disabled,
  showChevron = true,
}: DropdownTriggerProps) {
  const { open, setOpen, triggerRef } = useDropdown();

  return (
    <button
      ref={triggerRef}
      type="button"
      aria-expanded={open}
      aria-haspopup="listbox"
      disabled={disabled}
      onClick={() => setOpen(!open)}
      className={cn(
        "flex h-[38px] w-full min-w-[200px] max-w-[320px] items-center justify-between gap-2.5 rounded-lg border border-gray-07 bg-transparent py-2.5 pr-3 text-left typo-body-02-regular text-gray-01 transition-colors hover:border-gray-06 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        icon != null ? "pl-3" : "pl-4",
        className,
      )}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2">
        {icon != null && (
          <span className="flex h-6 w-6 shrink-0 items-center justify-center [&>img]:h-6 [&>img]:w-6 [&>svg]:h-6 [&>svg]:w-6">
            {icon}
          </span>
        )}
        <span className="truncate">{children}</span>
      </span>
      {showChevron ? <ChevronDownIcon /> : null}
    </button>
  );
}

function ChevronDownIcon() {
  return <MaskedNativeSelectArrow className="size-6 shrink-0" />;
}

export interface DropdownContentProps {
  children: ReactNode;
  className?: string;
  /** 클릭 외부 시 닫기 (기본 true) */
  closeOnClickOutside?: boolean;
  /**
   * 트리거 너비에 맞춰 패널 폭을 고정.
   * 모바일에서 native select 폭 이슈 대체용으로 사용.
   */
  matchTriggerWidth?: boolean;
  /** 뷰포트 밖으로 나가지 않게 maxWidth/scroll 적용 */
  constrainToViewport?: boolean;
}

export function DropdownContent({
  children,
  className,
  closeOnClickOutside = true,
  matchTriggerWidth = false,
  constrainToViewport = false,
}: DropdownContentProps) {
  const { open, setOpen, triggerRef } = useDropdown();
  const panelRef = useRef<HTMLDivElement>(null);
  const [triggerWidth, setTriggerWidth] = useState<number | null>(null);

  useEffect(() => {
    if (!closeOnClickOutside || !open) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        panelRef.current?.contains(target) ||
        triggerRef.current?.contains(target)
      )
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [closeOnClickOutside, open, setOpen]);

  useEffect(() => {
    if (!matchTriggerWidth || !open) return;
    const el = triggerRef.current;
    if (!el) return;
    const w = Math.round(el.getBoundingClientRect().width);
    if (Number.isFinite(w) && w > 0) setTriggerWidth(w);
  }, [matchTriggerWidth, open, triggerRef]);

  if (!open) return null;

  return (
    <div
      ref={panelRef}
      role="listbox"
      className={cn(
        "absolute left-0 top-full z-50 mt-1 min-w-[200px] max-w-[320px] rounded-lg border border-gray-07 bg-white py-4 px-4 shadow-lg",
        "flex flex-col gap-6",
        constrainToViewport && "max-h-[min(60vh,320px)] overflow-y-auto",
        className,
      )}
      style={
        matchTriggerWidth && triggerWidth != null
          ? {
              width: triggerWidth,
              minWidth: triggerWidth,
              maxWidth: constrainToViewport ? "calc(100vw - 32px)" : undefined,
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}

export interface DropdownItemProps {
  children: ReactNode;
  className?: string;
  /** 선택 시 호출 후 드롭다운 닫기 */
  onSelect?: () => void;
  /** true면 button 대신 div 렌더 (구분선/라벨용, 클릭해도 닫지 않음) */
  asChild?: boolean;
}

export function DropdownItem({
  children,
  className,
  onSelect,
  asChild,
}: DropdownItemProps) {
  const { setOpen } = useDropdown();

  const handleClick = () => {
    onSelect?.();
    setOpen(false);
  };

  if (asChild) {
    return (
      <div className={cn("flex items-center gap-1.5", className)}>
        {children}
      </div>
    );
  }

  return (
    <button
      type="button"
      role="option"
      onClick={handleClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left typo-body-02-regular text-gray-01 transition-colors hover:bg-gray-08 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        className,
      )}
    >
      {children}
    </button>
  );
}

/** compound export: Dropdown.Root, Dropdown.Trigger, Dropdown.Content, Dropdown.Item */
export const Dropdown = {
  Root: DropdownRoot,
  Trigger: DropdownTrigger,
  Content: DropdownContent,
  Item: DropdownItem,
} as const;
