import type { SupabaseClient } from "@supabase/supabase-js";

/** `stores.name`·표시명 폴백용 기본 라벨 — 실제 점포명으로 바꿀 후보 */
export const PLACEHOLDER_STORE_NAMES = new Set(["내 매장", "내매장"]);

export function isPlaceholderStoreName(name: string | null | undefined): boolean {
  const t = String(name ?? "").trim();
  return t.length > 0 && PLACEHOLDER_STORE_NAMES.has(t);
}

/**
 * 첫 연동 워커 결과로 `stores.name` 초기값. 없으면 null → 호출측에서 "내 매장" 등 폴백.
 */
export function deriveInitialStoreNameFromLinkResult(
  jobType: string,
  result: Record<string, unknown>,
): string | null {
  const str = (v: unknown): string | null => {
    if (typeof v !== "string") return null;
    const t = v.trim();
    return t.length > 0 ? t : null;
  };

  const fromSessionLike = (): string | null =>
    str(result.store_name) ?? str((result as { storeName?: unknown }).storeName);

  switch (jobType) {
    case "baemin_link": {
      const direct = fromSessionLike();
      if (direct) return direct;
      const ext = String(result.external_shop_id ?? "").trim();
      const shops = result.shops;
      if (!Array.isArray(shops)) return null;
      for (const row of shops) {
        if (row == null || typeof row !== "object") continue;
        const shopNo = String((row as { shopNo?: unknown }).shopNo ?? "").trim();
        const shopName = str((row as { shopName?: unknown }).shopName);
        if (ext && shopNo === ext && shopName) return shopName;
      }
      for (const row of shops) {
        if (row == null || typeof row !== "object") continue;
        const shopName = str((row as { shopName?: unknown }).shopName);
        if (shopName) return shopName;
      }
      return null;
    }
    case "coupang_eats_link":
      return fromSessionLike();
    case "yogiyo_link": {
      const ext = String(result.external_shop_id ?? "").trim();
      const vendors = result.vendors;
      if (!Array.isArray(vendors) || vendors.length === 0) return null;
      const parsed: { idStr: string; nameStr: string }[] = [];
      for (const v of vendors) {
        if (v == null || typeof v !== "object") continue;
        const idRaw = (v as { id?: unknown }).id;
        const nameRaw = (v as { name?: unknown }).name;
        const idStr =
          typeof idRaw === "number" && Number.isFinite(idRaw)
            ? String(Math.trunc(idRaw))
            : String(idRaw ?? "").trim();
        const nameStr = str(nameRaw);
        if (!idStr || !nameStr) continue;
        parsed.push({ idStr, nameStr });
      }
      if (parsed.length === 0) return null;
      const hit = ext ? parsed.find((p) => p.idStr === ext) : undefined;
      if (hit) return hit.nameStr;
      if (parsed.length === 1) return parsed[0].nameStr;
      return [...parsed].sort((a, b) => b.nameStr.length - a.nameStr.length)[0]
        .nameStr;
    }
    case "ddangyo_link": {
      const ext = String(result.external_shop_id ?? "").trim();
      const patstos = result.patstos;
      if (!Array.isArray(patstos) || patstos.length === 0) return null;
      for (const p of patstos) {
        if (p == null || typeof p !== "object") continue;
        const no = String((p as { patsto_no?: unknown }).patsto_no ?? "").trim();
        const nm = str((p as { patsto_nm?: unknown }).patsto_nm);
        if (ext && no === ext && nm) return nm;
      }
      const first = patstos[0];
      if (first != null && typeof first === "object") {
        return str((first as { patsto_nm?: unknown }).patsto_nm);
      }
      return null;
    }
    default:
      return null;
  }
}

type ShopAgg = {
  platform: string;
  externalId: string;
  reviews: number;
  orders: number;
};

/**
 * `stores.name` 이 플레이스홀더일 때만, `store_platform_dashboard_daily` 합산 기준으로
 * (리뷰 수 우선, 동률이면 주문 수) 가장 큰 점포의 `store_platform_shops.shop_name` 으로 갱신.
 */
export async function promoteStoreNameFromPlatformActivity(
  supabase: SupabaseClient,
  storeId: string,
): Promise<void> {
  const { data: storeRow, error: e1 } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .maybeSingle();
  if (e1 || !storeRow) return;
  const current = String((storeRow as { name?: unknown }).name ?? "").trim();
  if (!isPlaceholderStoreName(current)) return;

  const { data: daily, error: e2 } = await supabase
    .from("store_platform_dashboard_daily")
    .select("platform, platform_shop_external_id, review_count, order_count")
    .eq("store_id", storeId);
  if (e2 || !daily?.length) return;

  const map = new Map<string, ShopAgg>();
  for (const r of daily as {
    platform?: unknown;
    platform_shop_external_id?: unknown;
    review_count?: unknown;
    order_count?: unknown;
  }[]) {
    const platform = String(r.platform ?? "").trim();
    const ext = String(r.platform_shop_external_id ?? "").trim();
    if (!platform || !ext) continue;
    const key = `${platform}\0${ext}`;
    const prev =
      map.get(key) ?? { platform, externalId: ext, reviews: 0, orders: 0 };
    prev.reviews += Number(r.review_count ?? 0);
    prev.orders += Number(r.order_count ?? 0);
    map.set(key, prev);
  }

  let best: ShopAgg | null = null;
  for (const v of map.values()) {
    if (!best) best = v;
    else if (v.reviews > best.reviews) best = v;
    else if (v.reviews === best.reviews && v.orders > best.orders) best = v;
  }
  if (!best || (best.reviews === 0 && best.orders === 0)) return;

  const { data: shop, error: e3 } = await supabase
    .from("store_platform_shops")
    .select("shop_name")
    .eq("store_id", storeId)
    .eq("platform", best.platform)
    .eq("platform_shop_external_id", best.externalId)
    .maybeSingle();
  if (e3) {
    console.error(
      "[promoteStoreNameFromPlatformActivity] shop lookup failed",
      storeId,
      e3.message,
    );
    return;
  }
  const rawName = (shop as { shop_name?: unknown } | null)?.shop_name;
  const label =
    typeof rawName === "string" && rawName.trim() ? rawName.trim() : null;
  if (!label) return;

  const { error: e4 } = await supabase
    .from("stores")
    .update({ name: label, updated_at: new Date().toISOString() })
    .eq("id", storeId);
  if (e4) {
    console.error(
      "[promoteStoreNameFromPlatformActivity] stores update failed",
      storeId,
      e4.message,
    );
  }
}

/**
 * `computeStoreDisplayName` 과 동일한 세션·점포 우선순위(플레이스홀더 분기만).
 * store-service 와 순환 import 를 피하기 위해 여기에 둠.
 */
export function linkedDisplayLabelFromRows(args: {
  storeId: string;
  sessionRows: {
    store_id: string;
    platform: string;
    store_name: string | null;
  }[];
  shopRows: {
    store_id: string;
    shop_name: string | null;
    is_primary: boolean;
  }[];
}): string | null {
  const { storeId, sessionRows, shopRows } = args;
  const sess = sessionRows.filter((r) => r.store_id === storeId);
  const baemin = sess.find((s) => s.platform === "baemin");
  const order = [
    baemin?.store_name,
    ...sess.filter((s) => s.platform !== "baemin").map((s) => s.store_name),
  ];
  for (const t of order) {
    if (t != null && String(t).trim() !== "") return String(t).trim();
  }

  const shops = shopRows.filter((r) => r.store_id === storeId);
  const sorted = [...shops].sort((a, b) => {
    if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
    return (a.shop_name ?? "").localeCompare(b.shop_name ?? "");
  });
  for (const sh of sorted) {
    if (sh.shop_name != null && String(sh.shop_name).trim() !== "") {
      return String(sh.shop_name).trim();
    }
  }
  return null;
}

/** 대시보드 승격 후에도 이름이 플레이스홀더면 연동 세션·점포명으로 `stores.name` 갱신. */
export async function promoteStoreNameFromLinkedRows(
  supabase: SupabaseClient,
  storeId: string,
): Promise<boolean> {
  const { data: store, error: e1 } = await supabase
    .from("stores")
    .select("name")
    .eq("id", storeId)
    .maybeSingle();
  if (e1 || !store) return false;
  if (!isPlaceholderStoreName(String((store as { name?: unknown }).name)))
    return false;

  const { data: sessions, error: e2 } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform, store_name")
    .eq("store_id", storeId);
  if (e2) {
    console.error(
      "[promoteStoreNameFromLinkedRows] sessions",
      storeId,
      e2.message,
    );
    return false;
  }
  const { data: shops, error: e3 } = await supabase
    .from("store_platform_shops")
    .select("store_id, shop_name, is_primary")
    .eq("store_id", storeId);
  if (e3) {
    console.error(
      "[promoteStoreNameFromLinkedRows] shops",
      storeId,
      e3.message,
    );
    return false;
  }

  const label = linkedDisplayLabelFromRows({
    storeId,
    sessionRows: (sessions ?? []) as {
      store_id: string;
      platform: string;
      store_name: string | null;
    }[],
    shopRows: (shops ?? []) as {
      store_id: string;
      shop_name: string | null;
      is_primary: boolean;
    }[],
  });
  if (!label || isPlaceholderStoreName(label)) return false;

  const { error: e4 } = await supabase
    .from("stores")
    .update({ name: label, updated_at: new Date().toISOString() })
    .eq("id", storeId);
  if (e4) {
    console.error(
      "[promoteStoreNameFromLinkedRows] update",
      storeId,
      e4.message,
    );
    return false;
  }
  return true;
}

export type BackfillPlaceholderStoreNamesReport = {
  scanned: number;
  promotedFromDashboard: number;
  promotedFromLinkedMetadata: number;
  unchanged: number;
};

/**
 * 이미 연동된 기존 매장: `stores.name` 이 플레이스홀더인 행만 스캔.
 * 1) 대시보드 합산 승격 → 2) 그래도 플레이스홀더면 세션·`store_platform_shops` 표시명.
 */
export async function backfillPlaceholderStoreNames(
  supabase: SupabaseClient,
): Promise<BackfillPlaceholderStoreNamesReport> {
  const { data: rows, error } = await supabase
    .from("stores")
    .select("id, name")
    .in("name", [...PLACEHOLDER_STORE_NAMES]);
  if (error) throw error;

  let promotedFromDashboard = 0;
  let promotedFromLinkedMetadata = 0;
  let unchanged = 0;

  for (const r of rows ?? []) {
    const id = String((r as { id: unknown }).id);
    const nameBefore = String((r as { name: unknown }).name ?? "").trim();

    await promoteStoreNameFromPlatformActivity(supabase, id);

    const { data: afterDash } = await supabase
      .from("stores")
      .select("name")
      .eq("id", id)
      .maybeSingle();
    const n1 = String((afterDash as { name?: unknown })?.name ?? "").trim();
    if (n1 !== nameBefore) {
      promotedFromDashboard++;
      continue;
    }

    const ok = await promoteStoreNameFromLinkedRows(supabase, id);
    if (ok) promotedFromLinkedMetadata++;
    else unchanged++;
  }

  return {
    scanned: rows?.length ?? 0,
    promotedFromDashboard,
    promotedFromLinkedMetadata,
    unchanged,
  };
}
