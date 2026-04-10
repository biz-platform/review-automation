/**
 * `stores.name` 이 "내 매장" / "내매장" 인 기존 연동 매장 일괄 보정.
 * 1) store_platform_dashboard_daily 합산으로 대표 점포명
 * 2) 실패 시 store_platform_sessions / store_platform_shops 표시명
 *
 * run: pnpm run store:backfill-placeholder-names
 * env: .env.local 의 SUPABASE_SERVICE_ROLE_KEY 등 (createServiceRoleClient)
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";
import { backfillPlaceholderStoreNames } from "@/lib/services/store-name-helpers";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config();
} catch {
  /* no dotenv */
}

async function main(): Promise<void> {
  const supabase = createServiceRoleClient();
  const report = await backfillPlaceholderStoreNames(supabase);
  console.log("[backfill-placeholder-store-names]", report);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
