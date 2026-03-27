import { createServiceRoleClient } from "@/lib/db/supabase-server";

/**
 * 배민 답글 잡: 리뷰가 속한 shopNo 결정.
 * payload.platform_shop_external_id → reviews.platform_shop_external_id(복구) → 폴백
 */
export async function resolveBaeminShopNoForReplyJob(
  storeId: string,
  payload: Record<string, unknown> | null | undefined,
  fallbackShopNo: string | null,
): Promise<string | null> {
  const fromPayload =
    typeof payload?.platform_shop_external_id === "string"
      ? payload.platform_shop_external_id.trim()
      : "";
  if (fromPayload) return fromPayload;

  const reviewUuid =
    (typeof payload?.reviewId === "string" && payload.reviewId.trim()) ||
    (typeof payload?.review_id === "string" && payload.review_id.trim()) ||
    "";

  if (reviewUuid) {
    const supabase = createServiceRoleClient();
    const { data } = await supabase
      .from("reviews")
      .select("platform_shop_external_id")
      .eq("id", reviewUuid)
      .eq("store_id", storeId)
      .maybeSingle();

    const sid =
      data != null &&
      typeof (data as { platform_shop_external_id?: unknown })
        .platform_shop_external_id === "string"
        ? String(
            (data as { platform_shop_external_id: string })
              .platform_shop_external_id,
          ).trim()
        : "";
    if (sid) return sid;
  }

  return fallbackShopNo?.trim() || null;
}
