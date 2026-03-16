interface PlatformIconProps {
  platform: string;
  className?: string;
}

/** 플랫폼 로고/아이콘 (매장 연동 플로우용) */
export function PlatformIcon({ platform: _platform, className }: PlatformIconProps) {
  return (
    <svg
      className={className ?? "h-6 w-6"}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M5 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M19 17a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
      <path d="M7 9l2-4h6l2 4" />
      <path d="M7 9v6M17 9v6" />
      <path d="M9 9h6" />
    </svg>
  );
}
