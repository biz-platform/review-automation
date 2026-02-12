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
