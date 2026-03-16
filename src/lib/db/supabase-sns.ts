import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/** SNS automation 서비스용 Supabase 클라이언트. env: SNS_SUPABASE_URL, SNS_SUPABASE_SERVICE_ROLE_KEY */
export function createSnsSupabaseClient(): SupabaseClient {
  const url = process.env.SNS_SUPABASE_URL;
  const key = process.env.SNS_SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "SNS Supabase env missing: SNS_SUPABASE_URL, SNS_SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
