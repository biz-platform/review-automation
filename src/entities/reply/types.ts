export type ReplyDraftData = {
  id: string;
  review_id: string;
  draft_content: string;
  status: string;
  approved_content: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ApproveReplyApiRequestData = { approved_content: string };
