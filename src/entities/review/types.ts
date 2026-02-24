export type ReviewImage = { imageUrl: string };

export type ReviewListFilter = "all" | "unanswered" | "answered" | "expired";

/** 목록 include_drafts 시 함께 오는 draft 요약 */
export type ReviewReplyDraftSummary = {
  draft_content: string;
  approved_content: string | null;
};

export type ReviewData = {
  id: string;
  store_id: string;
  platform: string;
  external_id: string | null;
  rating: number | null;
  content: string | null;
  author_name: string | null;
  written_at: string | null;
  created_at: string;
  images?: ReviewImage[];
  platform_reply_content: string | null;
  reply_draft?: ReviewReplyDraftSummary;
};

export type ReviewListData = ReviewData[];

export type ReviewListApiRequestData = {
  store_id?: string;
  platform?: string;
  linked_only?: boolean;
  limit?: number;
  offset?: number;
  filter?: ReviewListFilter;
  include_drafts?: boolean;
};
