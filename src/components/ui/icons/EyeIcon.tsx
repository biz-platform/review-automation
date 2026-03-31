import { Icon24 } from "@/components/ui/Icon24";
import visibilityOn from "@/assets/icons/24px/visibility-on.webp";

export function EyeIcon({ className }: { className?: string }) {
  return (
    <Icon24 src={visibilityOn} alt="" className={className ?? "h-6 w-6"} />
  );
}
