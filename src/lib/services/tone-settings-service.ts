import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { StoreService } from "@/lib/services/store-service";
import type { ToneSettingsDto, ToneSettingsResponse } from "@/lib/types/dto/tone-settings-dto";

const storeService = new StoreService();

export class ToneSettingsService {
  async getByStoreId(storeId: string, userId: string): Promise<ToneSettingsResponse | null> {
    await storeService.findById(storeId, userId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("tone_settings")
      .select("*")
      .eq("store_id", storeId)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    return rowToToneSettings(data);
  }

  async upsert(storeId: string, userId: string, dto: ToneSettingsDto): Promise<ToneSettingsResponse> {
    await storeService.findById(storeId, userId);
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from("tone_settings")
      .upsert(
        {
          store_id: storeId,
          tone: dto.tone ?? "friendly",
          extra_instruction: dto.extra_instruction ?? null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "store_id" }
      )
      .select()
      .single();

    if (error) throw error;
    return rowToToneSettings(data);
  }
}

function rowToToneSettings(row: Record<string, unknown>): ToneSettingsResponse {
  return {
    store_id: row.store_id as string,
    tone: (row.tone as string) ?? "friendly",
    extra_instruction: (row.extra_instruction as string) ?? null,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
