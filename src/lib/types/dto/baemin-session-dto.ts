import { z } from "zod";

/** 쿠키 한 건 (브라우저 개발자도구에서 추출한 형식) */
export const cookieItemSchema = z.object({
  name: z.string(),
  value: z.string(),
  domain: z.string().optional(),
  path: z.string().optional().default("/"),
});

export const baeminSessionCookiesSchema = z.object({
  cookies: z.array(cookieItemSchema).min(1, "쿠키가 1개 이상 필요합니다"),
  external_shop_id: z.string().min(1).optional(),
  shop_owner_number: z.string().min(1).optional(),
});

export type CookieItem = z.infer<typeof cookieItemSchema>;
export type BaeminSessionCookiesDto = z.infer<typeof baeminSessionCookiesSchema>;
