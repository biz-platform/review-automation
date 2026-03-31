import Image, { type StaticImageData } from "next/image";
import { cn } from "@/lib/utils/cn";

export type IconRasterSize = 14 | 24 | 28 | 36 | 40;

const RASTER_PX: Record<IconRasterSize, number> = {
  14: 14,
  24: 24,
  28: 28,
  36: 36,
  40: 40,
};

const RASTER_CLASS: Record<IconRasterSize, string> = {
  14: "h-3.5 w-3.5",
  24: "h-6 w-6",
  28: "h-7 w-7",
  36: "h-9 w-9",
  40: "h-10 w-10",
};

export type Icon24Props = {
  src: StaticImageData;
  /** 장식용 아이콘은 기본 빈 문자열 */
  alt?: string;
  className?: string;
  priority?: boolean;
  /** 에셋 폴더 기준 디자인 픽셀 (`Image` intrinsic). `className`으로 표시 크기 덮어쓰기 가능 */
  pixelSize?: IconRasterSize;
};

/** 정적 아이콘 WebP (`src/assets/icons/{14,24,28,36,40}px`) */
export function Icon24({
  src,
  alt = "",
  className,
  priority,
  pixelSize = 24,
}: Icon24Props) {
  const px = RASTER_PX[pixelSize];
  return (
    <Image
      src={src}
      alt={alt}
      width={px}
      height={px}
      sizes={`${px}px`}
      className={cn(
        RASTER_CLASS[pixelSize],
        "shrink-0 object-contain",
        className,
      )}
      priority={priority}
    />
  );
}
