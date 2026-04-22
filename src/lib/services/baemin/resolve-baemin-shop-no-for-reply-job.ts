import { createServiceRoleClient } from "@/lib/db/supabase-server";

export type BaeminReplyShopResolutionSource =
  | "payload"
  | "review_row"
  | "login_fallback";

export type BaeminReplyShopResolution = {
  shopNo: string | null;
  source: BaeminReplyShopResolutionSource;
  /** `store_platform_shops.shop_name` (없으면 null) */
  platformShopLabel: string | null;
};

async function fetchBaeminPlatformShopLabel(
  storeId: string,
  shopNo: string,
): Promise<string | null> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("store_platform_shops")
    .select("shop_name")
    .eq("store_id", storeId)
    .eq("platform", "baemin")
    .eq("platform_shop_external_id", shopNo)
    .maybeSingle();
  const name = (data as { shop_name?: unknown } | null)?.shop_name;
  return typeof name === "string" && name.trim() !== "" ? name.trim() : null;
}

/**
 * 배민 답글 잡: 리뷰가 속한 shopNo + 로그용 지점명.
 * payload.platform_shop_external_id → reviews.platform_shop_external_id(복구) → 폴백
 */
export async function resolveBaeminShopNoForReplyJobDetailed(
  storeId: string,
  payload: Record<string, unknown> | null | undefined,
  fallbackShopNo: string | null,
): Promise<BaeminReplyShopResolution> {
  const fromPayload =
    typeof payload?.platform_shop_external_id === "string"
      ? payload.platform_shop_external_id.trim()
      : "";
  if (fromPayload) {
    return {
      shopNo: fromPayload,
      source: "payload",
      platformShopLabel: await fetchBaeminPlatformShopLabel(
        storeId,
        fromPayload,
      ),
    };
  }

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
    if (sid) {
      return {
        shopNo: sid,
        source: "review_row",
        platformShopLabel: await fetchBaeminPlatformShopLabel(storeId, sid),
      };
    }
  }

  const fb = fallbackShopNo?.trim() || null;
  return {
    shopNo: fb,
    source: "login_fallback",
    platformShopLabel: fb ? await fetchBaeminPlatformShopLabel(storeId, fb) : null,
  };
}

/**
 * 배민 답글 잡: 리뷰가 속한 shopNo 결정.
 * payload.platform_shop_external_id → reviews.platform_shop_external_id(복구) → 폴백
 */
export async function resolveBaeminShopNoForReplyJob(
  storeId: string,
  payload: Record<string, unknown> | null | undefined,
  fallbackShopNo: string | null,
): Promise<string | null> {
  const r = await resolveBaeminShopNoForReplyJobDetailed(
    storeId,
    payload,
    fallbackShopNo,
  );
  return r.shopNo;
}
