import { Icon24 } from "@/components/ui/Icon24";
import visibilityOff from "@/assets/icons/24px/visibility-off.webp";

export function EyeOffIcon({ className }: { className?: string }) {
  return (
    <Icon24 src={visibilityOff} alt="" className={className ?? "h-6 w-6"} />
  );
}
