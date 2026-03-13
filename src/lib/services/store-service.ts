import type { SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { AppNotFoundError } from "@/lib/errors/app-error";
import { ERROR_CODES } from "@/lib/errors/error-codes";
import type {
  CreateStoreDto,
  UpdateStoreDto,
  StoreResponse,
  StoreWithSessionResponse,
} from "@/lib/types/dto/store-dto";

function getSupabase(client?: SupabaseClient): Promise<SupabaseClient> {
  return client ? Promise.resolve(client) : createServerSupabaseClient();
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
    return (data ?? []).map(rowToStore);
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
    return (data ?? []).map(rowToStore);
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
    return (storeRows ?? []).map((row) => {
      const store = rowToStore(row);
      const session = sessionByStoreId.get(store.id);
      return {
        ...store,
        external_shop_id: session?.external_shop_id ?? null,
        shop_category: session?.shop_category ?? null,
        business_registration_number: session?.business_registration_number ?? null,
        store_name: session?.store_name ?? null,
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
    return rowToStore(data);
  }

  async create(userId: string, dto: CreateStoreDto, supabaseClient?: SupabaseClient): Promise<StoreResponse> {
    const supabase = await getSupabase(supabaseClient);
    const { data, error } = await supabase
      .from("stores")
      .insert({ name: dto.name, user_id: userId })
      .select()
      .single();

    if (error) throw error;
    return rowToStore(data);
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
    return rowToStore(data);
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

function rowToStore(row: Record<string, unknown>): StoreResponse {
  return {
    id: row.id as string,
    name: row.name as string,
    user_id: row.user_id as string,
    created_at: (row.created_at as string) ?? new Date().toISOString(),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
