import { createServiceRoleClient } from "@/lib/db/supabase-server";
import type { PlatformCode } from "@/lib/types/dto/platform-dto";

export type UnlinkPlatformSnapshotResult = {
  retention_rows_active: number;
  retention_rows_archive: number;
  session_rows_deleted: number;
};

/**
 * 플랫폼 세션 삭제 + 해당 매장·플랫폼 리뷰 스냅샷·정리.
 * RPC `unlink_platform_session_with_review_snapshot` — 트리거 대신 명시 호출.
 * 호출 전 소유/권한 검증은 상위에서 수행할 것.
 */
export async function unlinkPlatformSessionWithReviewSnapshot(
  storeId: string,
  platform: PlatformCode,
): Promise<UnlinkPlatformSnapshotResult> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase.rpc("unlink_platform_session_with_review_snapshot", {
    p_store_id: storeId,
    p_platform: platform,
  });

  if (error) throw error;

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    retention_rows_active: Number(row.retention_rows_active ?? 0),
    retention_rows_archive: Number(row.retention_rows_archive ?? 0),
    session_rows_deleted: Number(row.session_rows_deleted ?? 0),
  };
}
