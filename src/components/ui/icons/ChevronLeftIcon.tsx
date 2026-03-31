import { Icon24 } from "@/components/ui/Icon24";
import leftarrow from "@/assets/icons/14px/leftarrow.webp";

export function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <Icon24
      src={leftarrow}
      alt=""
      pixelSize={14}
      className={className ?? "h-6 w-6"}
    />
  );
}
