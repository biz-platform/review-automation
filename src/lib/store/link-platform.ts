import { pollBrowserJob } from "@/lib/poll-browser-job";

const PLATFORM_PATH: Record<string, string> = {
  baemin: "baemin",
  coupang_eats: "coupang-eats",
  yogiyo: "yogiyo",
  ddangyo: "ddangyo",
};

const LONG_LINK_POLL_OPTIONS = {
  timeoutMs: 60 * 60 * 1000, // 60분
  maxPollsWithoutTerminal: 1800, // 2초 간격 기준 약 60분
} as const;

function isPendingTimeoutError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("작업 시간이 초과되었습니다.") ||
    error.message.includes("서버로부터 완료 응답을 받지 못했습니다.")
  );
}

/** storeId가 null이면 첫 연동(매장 없음) 플로우. 연동 성공 시에만 서버에서 매장 생성됨. */
export async function linkPlatform(
  storeId: string | null,
  platformId: string,
  username: string,
  password: string,
  signal: AbortSignal | undefined,
): Promise<void> {
  const path = PLATFORM_PATH[platformId];
  if (!path) throw new Error("지원하지 않는 플랫폼입니다.");

  const linkUrl =
    storeId != null
      ? `/api/stores/${storeId}/platforms/${path}/link`
      : `/api/me/platforms/${path}/link`;

  const res = await fetch(linkUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ username: username.trim(), password }),
    signal,
  });
  const data = (await res.json().catch(() => ({}))) as {
    result?: { jobId?: string };
    jobId?: string;
    detail?: string;
    message?: string;
  };
  const jobId = data.result?.jobId ?? data.jobId;
  if (res.status === 202 && jobId) {
    let job: { status: string; error_message?: string; store_id?: string };
    try {
      job = await pollBrowserJob(storeId, jobId, {
        signal,
        ...LONG_LINK_POLL_OPTIONS,
      });
    } catch (e) {
      if (isPendingTimeoutError(e)) {
        throw new Error(
          "매장 연동 작업이 아직 진행 중입니다.\n잠시 후 상태를 다시 확인해 주세요.",
        );
      }
      throw e;
    }
    if (job.status === "failed")
      throw new Error(job.error_message ?? "연동 실패");
    const effectiveStoreId = job.store_id ?? storeId;
    if (effectiveStoreId) {
      try {
        const syncRes = await fetch(
          `/api/stores/${effectiveStoreId}/platforms/${path}/reviews/sync`,
          { method: "POST", credentials: "same-origin", signal },
        );
        const syncBody = (await syncRes.json().catch(() => ({}))) as {
          result?: { jobId?: string };
          jobId?: string;
          detail?: string;
          message?: string;
        };
        const syncJobId = syncBody.result?.jobId ?? syncBody.jobId;
        if (!syncRes.ok) {
          throw new Error(
            syncBody.detail ??
              syncBody.message ??
              `알 수 없는 오류로 리뷰 동기화 작업 생성에 실패했습니다. (${syncRes.status})`,
          );
        }
        if (syncRes.status === 202 && syncJobId) {
          const syncJob = await pollBrowserJob(effectiveStoreId, syncJobId, {
            signal,
            ...LONG_LINK_POLL_OPTIONS,
          });
          if (syncJob.status === "failed") {
            throw new Error(syncJob.error_message ?? "리뷰 동기화 실패");
          }
          if (syncJob.status === "cancelled") {
            throw new DOMException("취소됨", "AbortError");
          }
        } else if (syncRes.status === 202 && !syncJobId) {
          throw new Error("리뷰 동기화 jobId를 받지 못했습니다.");
        }
      } catch (syncError) {
        if (isPendingTimeoutError(syncError)) {
          // 동기화 job은 생성되어 돌아가는 중일 수 있으므로 연동 롤백하지 않는다.
          return;
        }
        try {
          const rollbackRes = await fetch(
            `/api/stores/${effectiveStoreId}/platform-session?platform=${encodeURIComponent(platformId)}`,
            { method: "DELETE", credentials: "same-origin" },
          );
          if (!rollbackRes.ok) {
            console.error(
              "[linkPlatform] sync 실패 후 플랫폼 연동 롤백 응답 비정상",
              {
                status: rollbackRes.status,
                storeId: effectiveStoreId,
                platformId,
              },
            );
          }
        } catch (rollbackError) {
          console.error(
            "[linkPlatform] sync 실패 후 플랫폼 연동 롤백 요청 실패",
            rollbackError,
          );
        }
        throw syncError;
      }
    }
    return;
  }

  if (!res.ok) throw new Error(data.detail ?? data.message ?? "연동 실패");
}
