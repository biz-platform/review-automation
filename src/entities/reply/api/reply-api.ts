import type { AsyncApiRequestFn } from "@/types/api";
import { API_ENDPOINT } from "@/const/endpoint";
import type { ReplyDraftData, ApproveReplyApiRequestData } from "@/entities/reply/types";

async function getJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    credentials: "same-origin",
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? err.message ?? res.statusText);
  }
  return res.json();
}

export const createReplyDraft: AsyncApiRequestFn<ReplyDraftData, { reviewId: string }> = async ({
  reviewId,
}) => {
  const data = await getJson<{ result: ReplyDraftData }>(
    API_ENDPOINT.reviews.replyDraft(reviewId),
    { method: "POST" }
  );
  return data.result;
};

export const approveReply: AsyncApiRequestFn<
  ReplyDraftData,
  { reviewId: string } & ApproveReplyApiRequestData
> = async ({ reviewId, approved_content }) => {
  const data = await getJson<{ result: ReplyDraftData }>(
    API_ENDPOINT.reviews.replyApprove(reviewId),
    {
      method: "POST",
      body: JSON.stringify({ approved_content }),
    }
  );
  return data.result;
};
