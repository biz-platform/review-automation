import { z } from "zod";
import { cookieItemSchema, type CookieItem } from "./platform-dto";

export { cookieItemSchema, type CookieItem };

export const baeminSessionCookiesSchema = z.object({
  cookies: z.array(cookieItemSchema).min(1, "쿠키가 1개 이상 필요합니다"),
  external_shop_id: z.string().min(1).optional(),
  shop_owner_number: z.string().min(1).optional(),
});

export type BaeminSessionCookiesDto = z.infer<typeof baeminSessionCookiesSchema>;
