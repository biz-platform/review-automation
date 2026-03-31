import { Icon24 } from "@/components/ui/Icon24";
import linkIcon from "@/assets/icons/24px/link.webp";

/** 플랫폼 연동 완료·연동 상태 표시 (탭 등) */
export function LinkedPlatformCheckIcon({
  className,
}: {
  className?: string;
}) {
  return (
    <Icon24 src={linkIcon} alt="" pixelSize={24} className={className ?? "h-5 w-5"} />
  );
}
