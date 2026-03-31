import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils/cn";
import baeminLogo from "@/assets/logos/baemin.webp";
import coupangLogo from "@/assets/logos/coupang.webp";
import ddangyoLogo from "@/assets/logos/ddangyo.webp";
import yogiyoLogo from "@/assets/logos/yogiyo.webp";
import naverLogo from "@/assets/logos/naver.webp";
import store1Fallback from "@/assets/icons/24px/store1.webp";

const PLATFORM_LOGO: Record<string, StaticImageData> = {
  baemin: baeminLogo,
  coupang_eats: coupangLogo,
  ddangyo: ddangyoLogo,
  yogiyo: yogiyoLogo,
  naver: naverLogo,
};

interface PlatformIconProps {
  platform: string;
  className?: string;
}

/** 배달/플랫폼 브랜드 마크 (연동 카드·목록) */
export function PlatformIcon({ platform, className }: PlatformIconProps) {
  const src = PLATFORM_LOGO[platform] ?? store1Fallback;
  return (
    <Image
      src={src}
      alt=""
      width={48}
      height={48}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}
