/**
 * dev: 쿠팡이츠 order/condition 응답에서 actuallyAmount 필드 형태 확인
 *
 * 실행:
 * - STORE_ID=... pnpm -s run dev:debug-coupang-eats-actually-amount
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import {
  coupangEatsOrdersDateRangeLastDays,
} from "@/lib/services/coupang-eats/coupang-eats-orders-fetch";
import { fetchCoupangEatsOrdersAllShopsPlaywright } from "@/lib/services/coupang-eats/coupang-eats-orders-fetch-playwright";
import * as CoupangEatsSession from "@/lib/services/coupang-eats/coupang-eats-session-service";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

function pickKeys(o: any): Record<string, unknown> {
  const keys = Object.keys(o ?? {}).slice(0, 50);
  const out: Record<string, unknown> = { keys };
  out.salePrice = o?.salePrice;
  out.totalAmount = o?.totalAmount;
  out.actuallyAmount = o?.actuallyAmount;
  out.actually_amount = o?.actually_amount;
  out.actuallyAmt = o?.actuallyAmt;
  out.createdAt = o?.createdAt;
  out.status = o?.status;
  out.storeId = o?.storeId;
  out.store = o?.store;
  return out;
}

async function main(): Promise<void> {
  const storeId = process.env.STORE_ID?.trim();
  if (!storeId) throw new Error("STORE_ID env 필요");

  const supabase = createServiceRoleClient();
  const { data: s, error: sErr } = await supabase
    .from("stores")
    .select("id, user_id, name")
    .eq("id", storeId)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!s?.user_id) throw new Error("store.user_id 없음");

  const cookies = await CoupangEatsSession.getCoupangEatsCookies(storeId, s.user_id as string);
  if (!cookies?.length) throw new Error("쿠팡이츠 쿠키 없음");

  const shopId = await CoupangEatsSession.getCoupangEatsStoreId(storeId, s.user_id as string);
  if (!shopId) throw new Error("쿠팡이츠 externalShopId 없음");

  const r = coupangEatsOrdersDateRangeLastDays(60);
  const bundle = await fetchCoupangEatsOrdersAllShopsPlaywright({
    cookies,
    shopExternalIds: [shopId],
    startDate: r.startDate,
    endDate: r.endDate,
    delayMsBetweenPages: 0,
  });

  const first = bundle.allRows[0] as any;
  console.log("[debug coupang order sample]", {
    storeId,
    storeName: s.name,
    userId: s.user_id,
    shopId,
    totalRows: bundle.allRows.length,
    perShop: bundle.perShop,
    first: pickKeys(first),
  });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

