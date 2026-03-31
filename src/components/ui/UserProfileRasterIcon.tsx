import { Icon24, type IconRasterSize } from "@/components/ui/Icon24";
import managerIcon from "@/assets/icons/40px/manager.webp";
import profileIcon from "@/assets/icons/40px/profile.webp";

export type UserProfileRasterIconProps = {
  /** `true` → manager.webp, 그 외 → profile.webp */
  isAdmin?: boolean;
  className?: string;
  pixelSize?: IconRasterSize;
};

export function UserProfileRasterIcon({
  isAdmin = false,
  className,
  pixelSize = 40,
}: UserProfileRasterIconProps) {
  return (
    <Icon24
      src={isAdmin ? managerIcon : profileIcon}
      alt=""
      pixelSize={pixelSize}
      className={className}
    />
  );
}
