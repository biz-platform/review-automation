import { pollBrowserJob } from "@/lib/poll-browser-job";

const PLATFORM_PATH: Record<string, string> = {
  baemin: "baemin",
  coupang_eats: "coupang-eats",
  yogiyo: "yogiyo",
  ddangyo: "ddangyo",
};

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
    jobId?: string;
    detail?: string;
    message?: string;
  };

  if (res.status === 202 && data.jobId) {
    const job = await pollBrowserJob(storeId, data.jobId, { signal });
    if (job.status === "failed")
      throw new Error(job.error_message ?? "연동 실패");
    const effectiveStoreId = job.store_id ?? storeId;
    if (effectiveStoreId) {
      fetch(`/api/stores/${effectiveStoreId}/platforms/${path}/reviews/sync`, {
        method: "POST",
        credentials: "same-origin",
      }).catch(() => {});
    }
    return;
  }

  if (!res.ok)
    throw new Error(data.detail ?? data.message ?? "연동 실패");
}
