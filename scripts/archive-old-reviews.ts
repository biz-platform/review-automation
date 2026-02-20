/**
 * 180일 초과 리뷰를 reviews_archive로 이관 후 reviews에서 삭제.
 * env: .env.local 또는 NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * run: npx tsx scripts/archive-old-reviews.ts  또는  pnpm run archive-reviews
 */
import { createClient } from "@supabase/supabase-js";

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require("dotenv").config({ path: ".env.local" });
  require("dotenv").config();
} catch {
  // dotenv optional
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  const { data, error } = await supabase.rpc("archive_old_reviews");
  if (error) {
    console.error("archive_old_reviews failed:", error.message);
    process.exit(1);
  }
  const row = Array.isArray(data) && data.length > 0 ? data[0] : data;
  const archived = row?.archived_count ?? 0;
  const deleted = row?.deleted_count ?? 0;
  console.log("Archive done.", { archived, deleted });
}

main();
