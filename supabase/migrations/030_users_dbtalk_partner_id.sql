-- 셀러 인증 시 사용한 디비톡 파트너 ID. 동일 인증 정보 재사용 방지용.
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dbtalk_partner_id INTEGER NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_dbtalk_partner_id
  ON public.users (dbtalk_partner_id)
  WHERE dbtalk_partner_id IS NOT NULL;

COMMENT ON COLUMN public.users.dbtalk_partner_id IS 'SNS dbtalk_partners.id. 센터장 인증 시 저장, 동일 정보 타 계정 재사용 방지.';
