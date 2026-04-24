import type { SupabaseClient } from "@supabase/supabase-js";

/** PostgREST upsert 한 번에 실을 행 수 (배민·요기요·땡겨요 공통) */
export const STORE_PLATFORM_ORDERS_UPSERT_CHUNK = 250;

export type StorePlatformOrderUpsertRow = {
  store_id: string;
  platform: string;
  platform_shop_external_id: string;
  store_platform_shop_id: string;
  order_number: string;
  status: string | null;
  pay_amount: number;
  /** 플랫폼별 실정산(순액) — 없으면 null */
  actually_amount: number | null;
  order_at: string;
  delivery_type: string | null;
  pay_type: string | null;
  items: unknown;
  updated_at: string;
};

/**
 * `store_platform_orders` 청크 upsert. shop FK가 채워진 행만 전달.
 * `onConflict`: store_id, platform, order_number
 */
export async function upsertStorePlatformOrdersInChunks(
  supabase: SupabaseClient,
  rows: readonly StorePlatformOrderUpsertRow[],
  options?: {
    chunkSize?: number;
    onWarning?: (message: string) => void;
  },
): Promise<{
  upserted: number;
  /** 전달한 `rows.length` */
  attempted: number;
  /** 청크 오류 없이 `upserted === attempted` (attempted=0 이면 true) */
  ordersUpsertComplete: boolean;
}> {
  const attempted = rows.length;
  const chunkSize = options?.chunkSize ?? STORE_PLATFORM_ORDERS_UPSERT_CHUNK;
  const warn = options?.onWarning ?? (() => {});
  if (attempted === 0) {
    return { upserted: 0, attempted: 0, ordersUpsertComplete: true };
  }
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("store_platform_orders").upsert(chunk, {
      onConflict: "store_id,platform,order_number",
    });
    if (error) {
      warn(`store_platform_orders upsert: ${error.message}`);
      return { upserted, attempted, ordersUpsertComplete: false };
    }
    upserted += chunk.length;
  }
  return { upserted, attempted, ordersUpsertComplete: upserted === attempted };
}
