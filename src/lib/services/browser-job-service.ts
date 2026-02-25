import { createServerSupabaseClient } from "@/lib/db/supabase-server";
import { createServiceRoleClient } from "@/lib/db/supabase-server";

export const BROWSER_JOB_TYPES = [
  "baemin_link",
  "baemin_sync",
  "coupang_eats_link",
  "coupang_eats_sync",
  "yogiyo_link",
  "yogiyo_sync",
  "ddangyo_link",
  "ddangyo_sync",
] as const;

export type BrowserJobType = (typeof BROWSER_JOB_TYPES)[number];

export type BrowserJobStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "cancelled";

export type BrowserJobRow = {
  id: string;
  type: BrowserJobType;
  store_id: string;
  user_id: string;
  status: BrowserJobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  worker_id: string | null;
  created_at: string;
  updated_at: string;
};

/** 사용자 요청 시 job 생성 (RLS: 본인 매장만). 반환 id로 폴링 */
export async function createBrowserJob(
  type: BrowserJobType,
  storeId: string,
  userId: string,
  payload: Record<string, unknown>
): Promise<string> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("browser_jobs")
    .insert({
      type,
      store_id: storeId,
      user_id: userId,
      status: "pending",
      payload,
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error) throw error;
  if (!data?.id) throw new Error("browser_jobs insert returned no id");
  return data.id;
}

/** 작업 상태 조회 (사용자 폴링용). RLS로 본인 매장 job만 조회 가능 */
export async function getBrowserJob(
  jobId: string,
  storeId: string
): Promise<BrowserJobRow | null> {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("browser_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("store_id", storeId)
    .maybeSingle();

  if (error) throw error;
  return data as BrowserJobRow | null;
}

/** 워커: pending 1건 원자적 선점 후 반환. service role 사용 */
export async function claimNextBrowserJob(
  workerId: string
): Promise<BrowserJobRow | null> {
  const supabase = createServiceRoleClient();
  const { data: rows, error } = await supabase.rpc("claim_next_browser_job", {
    p_worker_id: workerId,
  });

  if (error || !rows?.length) return null;
  return rows[0] as BrowserJobRow;
}

/** 워커: 작업 완료 제출. service role 사용 */
export async function completeBrowserJob(
  jobId: string,
  result: Record<string, unknown>
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("browser_jobs")
    .update({
      status: "completed",
      result,
      error_message: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw error;
}

/** 워커: 작업 실패 제출. service role 사용 */
export async function failBrowserJob(
  jobId: string,
  errorMessage: string
): Promise<void> {
  const supabase = createServiceRoleClient();
  const { error } = await supabase
    .from("browser_jobs")
    .update({
      status: "failed",
      error_message: errorMessage,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) throw error;
}

/** job 1건 조회 (service role). 워커 결과 적용 전 확인용 */
export async function getBrowserJobById(jobId: string): Promise<BrowserJobRow | null> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("browser_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error || !data) return null;
  return data as BrowserJobRow;
}

/** 사용자 취소: pending/processing인 job을 cancelled로 변경. service role 사용. 호출 전 getBrowserJob으로 소유 검증 필수 */
export async function cancelBrowserJob(jobId: string): Promise<boolean> {
  const supabase = createServiceRoleClient();
  const { data, error } = await supabase
    .from("browser_jobs")
    .update({
      status: "cancelled",
      updated_at: new Date().toISOString(),
    })
    .in("status", ["pending", "processing"])
    .eq("id", jobId)
    .select("id")
    .maybeSingle();

  if (error) throw error;
  return data != null;
}
