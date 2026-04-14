import { ENV_KEY } from "@/lib/config/env-keys";

/** OG·canonical·마케팅 링크 등 public 기본 오리진 */
export const DEFAULT_PUBLIC_SITE_ORIGIN = "https://oliview.kr" as const;

export function getPublicSiteOrigin(): string {
  const a = process.env[ENV_KEY.NEXT_PUBLIC_APP_URL]?.trim();
  const b = process.env[ENV_KEY.NEXT_PUBLIC_BASE_URL]?.trim();
  return a || b || DEFAULT_PUBLIC_SITE_ORIGIN;
}
