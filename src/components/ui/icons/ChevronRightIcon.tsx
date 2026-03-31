import { Icon24 } from "@/components/ui/Icon24";
import { cn } from "@/lib/utils/cn";
import leftarrow from "@/assets/icons/14px/leftarrow.webp";

export function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <Icon24
      src={leftarrow}
      alt=""
      pixelSize={14}
      className={cn("rotate-180", className ?? "h-6 w-6")}
    />
  );
}
