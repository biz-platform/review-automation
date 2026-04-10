import { env } from "@/lib/config/env";

/**
 * 무료 정책 경계(UTC ISO 8601). 예: KST 2026-05-01 00:00 → 2026-04-30T15:00:00.000Z
 * @see .env.local — MEMBER_TRIAL_ELIGIBLE_SINCE_ISO, MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO
 */
export function getMemberPromoBoundsMs(): {
  trialEligibleSinceMs: number;
  freePromoEndExclusiveMs: number;
} {
  const trialIso =
    env.MEMBER_TRIAL_ELIGIBLE_SINCE_ISO ??
    process.env.MEMBER_TRIAL_ELIGIBLE_SINCE_ISO ??
    "2026-04-30T15:00:00.000Z";
  const promoIso =
    env.MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO ??
    process.env.MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO ??
    "2026-05-31T15:00:00.000Z";

  const trialEligibleSinceMs = Date.parse(trialIso);
  const freePromoEndExclusiveMs = Date.parse(promoIso);
  if (Number.isNaN(trialEligibleSinceMs) || Number.isNaN(freePromoEndExclusiveMs)) {
    throw new Error(
      "Invalid MEMBER_TRIAL_ELIGIBLE_SINCE_ISO or MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO (expected ISO 8601)",
    );
  }
  return { trialEligibleSinceMs, freePromoEndExclusiveMs };
}
