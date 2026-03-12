import { z } from "zod";

export const createStoreSchema = z.object({
  name: z.string().min(1, "매장명은 필수입니다"),
});

export type CreateStoreDto = z.infer<typeof createStoreSchema>;

export const updateStoreSchema = createStoreSchema.partial();

export type UpdateStoreDto = z.infer<typeof updateStoreSchema>;

export type StoreResponse = {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
};

/** 플랫폼 연동 목록 조회 시 세션 필드 포함 (매장 관리 카드용) */
export type StoreWithSessionResponse = StoreResponse & {
  external_shop_id: string | null;
  shop_category: string | null;
  business_registration_number: string | null;
};
