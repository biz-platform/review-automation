/** GET /api/stores/[storeId]/jobs/[jobId] 폴링. completed | failed 시 resolve */
export async function pollBrowserJob(
  storeId: string,
  jobId: string,
  options?: { intervalMs?: number; timeoutMs?: number }
): Promise<{ status: string; error_message?: string }> {
  const intervalMs = options?.intervalMs ?? 2_000;
  const timeoutMs = options?.timeoutMs ?? 300_000; // 5 min
  const start = Date.now();

  for (;;) {
    const res = await fetch(`/api/stores/${storeId}/jobs/${jobId}`, {
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(`Job status ${res.status}`);
    const job = (await res.json()) as {
      status: string;
      error_message?: string;
    };
    if (job.status === "completed" || job.status === "failed") {
      return { status: job.status, error_message: job.error_message };
    }
    if (Date.now() - start >= timeoutMs) {
      throw new Error("작업 시간이 초과되었습니다.");
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}
