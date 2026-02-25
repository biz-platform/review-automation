/** GET /api/stores/[storeId]/jobs/[jobId] 폴링. completed | failed 시 resolve. signal 시 취소 가능 */
export async function pollBrowserJob(
  storeId: string,
  jobId: string,
  options?: { intervalMs?: number; timeoutMs?: number; signal?: AbortSignal }
): Promise<{ status: string; error_message?: string }> {
  const intervalMs = options?.intervalMs ?? 2_000;
  const timeoutMs = options?.timeoutMs ?? 300_000; // 5 min
  const signal = options?.signal;
  const start = Date.now();

  for (;;) {
    if (signal?.aborted) throw new DOMException("취소됨", "AbortError");
    const res = await fetch(`/api/stores/${storeId}/jobs/${jobId}`, {
      credentials: "same-origin",
      signal,
    });
    if (!res.ok) throw new Error(`Job status ${res.status}`);
    const job = (await res.json()) as {
      status: string;
      error_message?: string;
    };
    if (job.status === "completed" || job.status === "failed" || job.status === "cancelled") {
      return { status: job.status, error_message: job.error_message };
    }
    if (Date.now() - start >= timeoutMs) {
      throw new Error("작업 시간이 초과되었습니다.");
    }
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, intervalMs);
      signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(new DOMException("취소됨", "AbortError"));
      });
    });
  }
}
