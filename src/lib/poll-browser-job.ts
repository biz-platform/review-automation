/** API(네트워크) 연결 실패가 이 횟수 이상 연속이면 throw */
const MAX_CONSECUTIVE_FETCH_FAILURES = 50;
/** 완료(completed/failed/cancelled) 응답 없이 이 횟수만큼 폴링되면 worker 미응답으로 throw (기본값, sync는 더 많이 허용) */
const DEFAULT_MAX_POLLS_WITHOUT_TERMINAL = 50;

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;

export type PollBrowserJobOptions = {
  intervalMs?: number;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** sync 작업 등 장시간 job용. 미지정 시 50 */
  maxPollsWithoutTerminal?: number;
};

/** GET /api/stores/[storeId]/jobs/[jobId] 또는 storeId 없으면 /api/me/jobs/[jobId] 폴링. completed | failed 시 resolve. */
export async function pollBrowserJob(
  storeId: string | null,
  jobId: string,
  options?: PollBrowserJobOptions,
): Promise<{ status: string; error_message?: string; store_id?: string }> {
  const intervalMs = options?.intervalMs ?? 2_000;
  const timeoutMs = options?.timeoutMs ?? 300_000; // 5 min
  const maxPolls =
    options?.maxPollsWithoutTerminal ?? DEFAULT_MAX_POLLS_WITHOUT_TERMINAL;
  const signal = options?.signal;
  const start = Date.now();
  let consecutiveFetchFailures = 0;
  let pollsWithoutTerminal = 0;
  const pollUrl =
    storeId != null
      ? `/api/stores/${storeId}/jobs/${jobId}`
      : `/api/me/jobs/${jobId}`;

  for (;;) {
    if (signal?.aborted) throw new DOMException("취소됨", "AbortError");

    let res: Response;
    try {
      res = await fetch(pollUrl, {
        credentials: "same-origin",
        signal,
      });
      consecutiveFetchFailures = 0;
    } catch (e) {
      consecutiveFetchFailures += 1;
      if (consecutiveFetchFailures >= MAX_CONSECUTIVE_FETCH_FAILURES) {
        throw new Error(
          "서버와의 연결에 실패했습니다.\n잠시 후 다시 시도해 주세요.",
        );
      }
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(resolve, intervalMs);
        signal?.addEventListener("abort", () => {
          clearTimeout(t);
          reject(new DOMException("취소됨", "AbortError"));
        });
      });
      continue;
    }

    if (!res.ok) throw new Error(`Job status ${res.status}`);
    const body = await res.json();
    const job = (body.result != null ? body.result : body) as {
      status: string;
      error_message?: string;
      store_id?: string;
    };
    if (
      TERMINAL_STATUSES.includes(
        job.status as (typeof TERMINAL_STATUSES)[number],
      )
    ) {
      return {
        status: job.status,
        error_message: job.error_message,
        store_id: job.store_id,
      };
    }

    pollsWithoutTerminal += 1;
    if (pollsWithoutTerminal >= maxPolls) {
      throw new Error(
        "서버로부터 완료 응답을 받지 못했습니다.\n잠시 후 다시 시도해 주세요.",
      );
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
