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
          tone: dto.tone ?? "default",
          extra_instruction: dto.extra_instruction ?? null,
          comment_length: dto.comment_length ?? "normal",
          comment_register_mode: dto.comment_register_mode ?? "direct",
          auto_register_scheduled_hour:
            dto.auto_register_scheduled_hour ?? null,
          industry: dto.industry ?? null,
          customer_segment: dto.customer_segment ?? null,
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
  const mode = row.comment_register_mode as string | undefined;
  const hour = row.auto_register_scheduled_hour as number | undefined | null;
  return {
    store_id: row.store_id as string,
    tone: (row.tone as string) ?? "default",
    extra_instruction: (row.extra_instruction as string) ?? null,
    comment_length: (row.comment_length as string) ?? "normal",
    comment_register_mode:
      mode === "auto" || mode === "direct" ? mode : "direct",
    auto_register_scheduled_hour:
      typeof hour === "number" && hour >= 0 && hour <= 23 ? hour : null,
    industry: (row.industry as string) ?? null,
    customer_segment: (row.customer_segment as string) ?? null,
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
}
