export type StoreData = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/** linked_platform으로 목록 조회 시 포함되는 세션 필드 (매장 관리 카드용) */
export type StoreWithSessionData = StoreData & {
  external_shop_id?: string | null;
  shop_category?: string | null;
  business_registration_number?: string | null;
};

export type StoreListData = StoreData[];

export type StoreApiRequestData = void;

export type CreateStoreApiRequestData = { name: string };

export type UpdateStoreApiRequestData = Partial<CreateStoreApiRequestData>;

export type ToneSettingsData = {
  store_id: string;
  tone: string;
  extra_instruction: string | null;
  comment_length: string;
  updated_at: string;
};

export type ToneSettingsApiRequestData = {
  tone?: string;
  extra_instruction?: string | null;
  comment_length?: string;
};
