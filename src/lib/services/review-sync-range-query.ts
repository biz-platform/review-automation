import type { SupabaseClient } from "@supabase/supabase-js";

/** `reviews`에 해당 매장·플랫폼 행이 하나라도 있으면 이미 풀 동기화 등이 한 번이라도 된 것으로 본다. */
export async function storeHasReviewsForPlatform(
  supabase: SupabaseClient,
  storeId: string,
  platform: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("reviews")
    .select("id", { count: "exact", head: true })
    .eq("store_id", storeId)
    .eq("platform", platform);

  if (error) {
    throw new Error(`storeHasReviewsForPlatform: ${error.message}`);
  }
  return (count ?? 0) > 0;
}
