/**
 * reviews 테이블에서 platform_reply_content 조회 (배민 최근 15건).
 * run: npx tsx scripts/check-reviews-platform-reply.ts
 */
import { createClient } from "@supabase/supabase-js";

try {
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  // dotenv optional
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, external_id, platform, platform_reply_content, written_at")
    .eq("platform", "baemin")
    .order("written_at", { ascending: false })
    .limit(15);

  if (error) {
    console.error("query error:", error.message);
    process.exit(1);
  }

  console.log("reviews (baemin, 최근 15건):");
  console.table(
    (data ?? []).map((r) => ({
      id: r.id.slice(0, 8) + "…",
      external_id: r.external_id,
      has_platform_reply: r.platform_reply_content != null,
      reply_len: r.platform_reply_content?.length ?? 0,
      written_at: r.written_at?.slice(0, 10),
    }))
  );
  console.log("\nplatform_reply_content가 있는 행 수:", (data ?? []).filter((r) => r.platform_reply_content != null).length);
}

main();
