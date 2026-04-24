/**
 * dev: browser_jobs row 확인
 *
 * 실행:
 * - JOB_ID=... pnpm run -s dev:check-browser-job
 */
import { createServiceRoleClient } from "@/lib/db/supabase-server";

try {
   
  require("dotenv").config({ path: ".env.local" });
   
  require("dotenv").config();
} catch {
  /* no dotenv */
}

async function main(): Promise<void> {
  const jobId = process.env.JOB_ID?.trim();
  if (!jobId) throw new Error("JOB_ID env가 필요함");

  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("browser_jobs")
    .select("id, type, status, payload, result, error_message, created_at, updated_at")
    .eq("id", jobId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  console.dir(data, { depth: 8 });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

