-- 셀러 영업 링크용 짧은 추천인 코드. ?ref=코드 형태로 사용.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS referral_code TEXT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
  ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

COMMENT ON COLUMN public.users.referral_code IS '셀러 영업 링크용 짧은 코드. oliview.kr/?ref=코드';
