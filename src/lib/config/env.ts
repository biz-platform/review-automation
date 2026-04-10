import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url().optional().default(""),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().optional().default(""),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  /** 가입일 + 1개월 무료 적용 시작 시각(UTC ISO). KST 2026-05-01 00:00 = 2026-04-30T15:00:00.000Z */
  MEMBER_TRIAL_ELIGIBLE_SINCE_ISO: z.string().optional(),
  /** 전 사용자 무료 종료 직후 시각(UTC ISO). KST 2026-06-01 00:00 = 2026-05-31T15:00:00.000Z */
  MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO: z.string().optional(),
});

const parsed = envSchema.safeParse({
  NODE_ENV: process.env.NODE_ENV,
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  MEMBER_TRIAL_ELIGIBLE_SINCE_ISO: process.env.MEMBER_TRIAL_ELIGIBLE_SINCE_ISO,
  MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO: process.env.MEMBER_FREE_PROMO_END_EXCLUSIVE_ISO,
});

export const env = parsed.success ? parsed.data : ({} as z.infer<typeof envSchema>);

export function requireEnv() {
  const required = z.object({
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  });
  return required.parse(process.env);
}
