-- 배민/요기요/땡겨요/쿠팡이츠 등 플랫폼 로그인 세션 저장 (매장별)
CREATE TABLE store_platform_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform TEXT NOT NULL DEFAULT 'baemin',
  cookies_encrypted TEXT NOT NULL,
  external_shop_id TEXT,
  shop_owner_number TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, platform)
);

CREATE INDEX idx_store_platform_sessions_store_platform ON store_platform_sessions(store_id, platform);

ALTER TABLE store_platform_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage platform sessions of own stores"
  ON store_platform_sessions FOR ALL
  USING (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = store_platform_sessions.store_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = store_platform_sessions.store_id AND s.user_id = auth.uid())
  );
