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
  external_id: string;
  rating: number | null;
  content: string | null;
  author_name: string | null;
  written_at: string | null;
  created_at: string;
  images?: ReviewImage[];
  /** 주문 메뉴명 목록 */
  menus?: string[];
  platform_reply_content: string | null;
  /** 배민 동기화: 운영자 등 비가게 노출 답글(있으면). 사장님 미답변과 공존 가능 */
  platform_operator_reply_content?: string | null;
  /** 배민 다매장용 shopNo 등 */
  platform_shop_external_id?: string | null;
  reply_draft?: ReviewReplyDraftSummary;
};

export type ReviewListData = ReviewData[];

export type ReviewListApiRequestData = {
  store_id?: string;
  platform_shop_external_id?: string;
  platform?: string;
  linked_only?: boolean;
  rating_lte?: number;
  limit?: number;
  offset?: number;
  filter?: ReviewListFilter;
  include_drafts?: boolean;
};
