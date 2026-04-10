import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppNotFoundError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import type {
  CreateStoreDto,
  UpdateStoreDto,
  StoreResponse,
  StoreWithSessionResponse,
  StorePlatformShopResponse,
} from "@/lib/types/dto/store-dto";
import { isPlaceholderStoreName } from "@/lib/services/store-name-helpers";

function getSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ? Promise.resolve(client) : createServerSupabaseClient();
}

type StoreRowBase = Omit<StoreResponse, "display_name">;

/**
 * 매장 필터·목록 UI용: stores.name 우선, 없으면 배민 세션 store_name → 기타 세션 → 점포 shop_name(primary 우선).
 */
export function computeStoreDisplayName(args: {
  storeId: string;
  name: string;
  sessionRows: { store_id: string; platform: string; store_name: string | null }[];
  shopRows: { store_id: string; shop_name: string | null; is_primary: boolean }[];
}): string {
  const { storeId, name, sessionRows, shopRows } = args;
  const trimmed = name?.trim();
  if (trimmed && !isPlaceholderStoreName(trimmed)) return trimmed;

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

  return `매장 ${storeId.slice(0, 8)}`;
}

async function attachDisplayNames(
  supabase: SupabaseClient,
  stores: StoreRowBase[],
): Promise<StoreResponse[]> {
  if (stores.length === 0) return [];
  const ids = stores.map((s) => s.id);
  const { data: sessionRows, error: sErr } = await supabase
    .from("store_platform_sessions")
    .select("store_id, platform, store_name")
    .in("store_id", ids);
  if (sErr) throw sErr;
  const { data: shopRows, error: shErr } = await supabase
    .from("store_platform_shops")
    .select("store_id, shop_name, is_primary")
    .in("store_id", ids);
  if (shErr) throw shErr;

  const sessions = (sessionRows ?? []) as {
    store_id: string;
    platform: string;
    store_name: string | null;
  }[];
  const shops = (shopRows ?? []) as {
    store_id: string;
    shop_name: string | null;
    is_primary: boolean;
  }[];

  return stores.map((store) => ({
    ...store,
    display_name: computeStoreDisplayName({
      storeId: store.id,
      name: store.name,
      sessionRows: sessions,
      shopRows: shops,
    }),
  }));
}

export class StoreService {
  async findAll(userId: string, supabaseClient?: SupabaseClient): Promise<StoreResponse[]> {
    const supabase = await getSupabase(supabaseClient);
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    const base = (data ?? []).map(rowToStore);
    return attachDisplayNames(supabase, base);
  }

  /** 플랫폼 연동된 매장만 조회 (store_platform_sessions에 해당 platform 존재) */
  async findAllByLinkedPlatform(
    userId: string,
    platform: string,
    supabaseClient?: SupabaseClient
  ): Promise<StoreResponse[]> {
    const supabase = await getSupabase(supabaseClient);
    const { data: sessionRows, error: sessionError } = await supabase
      .from("store_platform_sessions")
      .select("store_id")
      .eq("platform", platform);
    if (sessionError || !sessionRows?.length) return [];
    const storeIds = sessionRows.map((r) => r.store_id as string);
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .in("id", storeIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const base = (data ?? []).map(rowToStore);
    return attachDisplayNames(supabase, base);
  }

  /** 플랫폼 연동 목록 + 세션 필드(external_shop_id, shop_category, business_registration_number) */
  async findAllByLinkedPlatformWithSession(
    userId: string,
    platform: string,
    supabaseClient?: SupabaseClient
  ): Promise<StoreWithSessionResponse[]> {
    const supabase = await getSupabase(supabaseClient);
    const { data: sessionRows, error: sessionError } = await supabase
      .from("store_platform_sessions")
      .select("store_id, external_shop_id, shop_category, business_registration_number, store_name")
      .eq("platform", platform);
    if (sessionError || !sessionRows?.length) return [];
    const storeIds = sessionRows.map((r) => r.store_id as string);
    const { data: storeRows, error } = await supabase
      .from("stores")
      .select("*")
      .eq("user_id", userId)
      .in("id", storeIds)
      .order("created_at", { ascending: false });
    if (error) throw error;
    const { data: platformShopRows } = await supabase
      .from("store_platform_shops")
      .select("store_id, platform_shop_external_id, shop_name, shop_category, is_primary")
      .eq("platform", platform)
      .in("store_id", storeIds)
      .order("is_primary", { ascending: false })
      .order("shop_name", { ascending: true, nullsFirst: false })
      .order("platform_shop_external_id", { ascending: true });
    const sessionByStoreId = new Map(
      sessionRows.map((r) => [
        r.store_id as string,
        {
          external_shop_id: (r.external_shop_id as string) ?? null,
          shop_category: (r.shop_category as string) ?? null,
          business_registration_number: (r.business_registration_number as string) ?? null,
          store_name: (r.store_name as string) ?? null,
        },
      ])
    );
    const shopsByStoreId = new Map<string, StorePlatformShopResponse[]>();
    for (const row of platformShopRows ?? []) {
      const storeId = row.store_id as string;
      const list = shopsByStoreId.get(storeId) ?? [];
      list.push({
        platform_shop_external_id: String(
          row.platform_shop_external_id ?? "",
        ).trim(),
        shop_name:
          row.shop_name != null && String(row.shop_name).trim() !== ""
            ? String(row.shop_name).trim()
            : null,
        shop_category:
          row.shop_category != null && String(row.shop_category).trim() !== ""
            ? String(row.shop_category).trim()
            : null,
        is_primary: Boolean(row.is_primary),
      });
      shopsByStoreId.set(storeId, list);
    }
    const base = (storeRows ?? []).map(rowToStore);
    const withDisplay = await attachDisplayNames(supabase, base);
    return withDisplay.map((store) => {
      const session = sessionByStoreId.get(store.id);
      return {
        ...store,
        external_shop_id: session?.external_shop_id ?? null,
        shop_category: session?.shop_category ?? null,
        business_registration_number: session?.business_registration_number ?? null,
        store_name: session?.store_name ?? null,
        platform_shops: shopsByStoreId.get(store.id) ?? [],
      };
    });
  }

  async findById(id: string, userId: string): Promise<StoreResponse> {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("stores")
      .select("*")
      .eq("id", id)
      .eq("user_id", userId)
      .single();

    if (error || !data) {
      throw new AppNotFoundError({
        ...ERROR_CODES.STORE_NOT_FOUND,
        detail: `Store ${id} not found`,
      });
    }
    const base = rowToStore(data);
    const [withDisplay] = await attachDisplayNames(supabase, [base]);
    return withDisplay;
  }

  async create(userId: string, dto: CreateStoreDto, supabaseClient?: SupabaseClient): Promise<StoreResponse> {
    const supabase = await getSupabase(supabaseClient);
    const { data, error } = await supabase
      .from("stores")
      .insert({ name: dto.name, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    const base = rowToStore(data);
    const [withDisplay] = await attachDisplayNames(supabase, [base]);
    return withDisplay;
  }

  async update(id: string, userId: string, dto: UpdateStoreDto): Promise<StoreResponse> {
    await this.findById(id, userId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("stores")
      .update({ ...dto, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", userId)
      .select()
      .single();

    if (error) throw error;
    const base = rowToStore(data);
    const [withDisplay] = await attachDisplayNames(supabase, [base]);
    return withDisplay;
  }

  async delete(id: string, userId: string): Promise<void> {
    await this.findById(id, userId);
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from("stores")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) throw error;
  }
}

function rowToStore(row: Record<string, unknown>): StoreRowBase {
  return {
    id: row.id as string,
    name: row.name as string,
    user_id: row.user_id as string,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
