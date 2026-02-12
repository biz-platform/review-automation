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
};

export type ReviewListData = ReviewData[];

export type ReviewListApiRequestData = {
  store_id?: string;
  platform?: string;
  linked_only?: boolean;
  limit?: number;
  offset?: number;
};
