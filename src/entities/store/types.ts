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
  /** 플랫폼에서 보이는 매장명 (null이면 name 사용) */
  store_name?: string | null;
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
  /** direct | auto. 기본값 direct */
  comment_register_mode: "direct" | "auto";
  /** 0-23. 자동 등록 시 매일 실행 시각 */
  auto_register_scheduled_hour: number | null;
  /** 매장 정보: 업종 (AI 댓글 작성 참고) */
  industry: string | null;
  /** 매장 정보: 주요 고객층 (AI 댓글 작성 참고) */
  customer_segment: string | null;
  updated_at: string;
};

export type ToneSettingsApiRequestData = {
  tone?: string;
  extra_instruction?: string | null;
  comment_length?: string;
  comment_register_mode?: "direct" | "auto";
  /** 0-23. 자동 등록 시에만 사용 */
  auto_register_scheduled_hour?: number | null;
  industry?: string | null;
  customer_segment?: string | null;
};
