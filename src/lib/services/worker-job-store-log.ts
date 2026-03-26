import { createServerSupabaseClient } from "@/lib/db/supabase-server";

/** job.type 접두사 → store_platform_sessions.platform */
export function inferPlatformFromJobType(jobType: string): string | null {
  if (jobType.startsWith("coupang_eats_")) return "coupang_eats";
  if (jobType.startsWith("baemin_")) return "baemin";
  if (jobType.startsWith("yogiyo_")) return "yogiyo";
  if (jobType.startsWith("ddangyo_")) return "ddangyo";
  return null;
}

export type WorkerJobStoreLogFields = {
  ollyStoreName: string | null;
  platform: string | null;
  externalShopId: string | null;
  platformStoreName: string | null;
};

const emptyFields = (): WorkerJobStoreLogFields => ({
  ollyStoreName: null,
  platform: null,
  externalShopId: null,
  platformStoreName: null,
});

/**
 * 워커 로그용: 올리뷰 매장명 + (잡 타입으로 추론된) 플랫폼의 외부 매장 ID·플랫폼 매장명.
 * SERVICE_ROLE(워커)로 조회; user_id로 스토어 소유 검증.
 */
export async function getWorkerJobStoreLogFields(
  storeId: string | null,
  userId: string,
  jobType: string,
  payload?: Record<string, unknown> | null,
): Promise<WorkerJobStoreLogFields> {
  if (!storeId) return emptyFields();

  const supabase = await createServerSupabaseClient();
  const { data: storeRow } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .eq("user_id", userId)
    .maybeSingle();

  const ollyStoreName =
    storeRow != null &&
    typeof (storeRow as { name?: unknown }).name === "string"
      ? (storeRow as { name: string }).name
      : null;

  let platform = inferPlatformFromJobType(jobType);
  if (
    !platform &&
    jobType === "auto_register_post_sync" &&
    payload &&
    typeof payload.platform === "string"
  ) {
    platform = payload.platform;
  }
  if (!platform) {
    return { ...emptyFields(), ollyStoreName };
  }

  const { data: sess } = await supabase
    .from("store_platform_sessions")
    .select("external_shop_id, store_name")
    .eq("store_id", storeId)
    .eq("platform", platform)
    .maybeSingle();

  const row = sess as {
    external_shop_id?: unknown;
    store_name?: unknown;
  } | null;

  return {
    ollyStoreName,
    platform,
    externalShopId:
      typeof row?.external_shop_id === "string" ? row.external_shop_id : null,
    platformStoreName:
      typeof row?.store_name === "string" ? row.store_name : null,
  };
}
