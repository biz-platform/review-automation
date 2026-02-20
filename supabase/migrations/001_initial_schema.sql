-- stores
CREATE TABLE stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stores_user_id ON stores(user_id);

ALTER TABLE stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own stores"
  ON stores FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- tone_settings (1:1 per store)
CREATE TABLE tone_settings (
  store_id UUID PRIMARY KEY REFERENCES stores(id) ON DELETE CASCADE,
  tone TEXT NOT NULL DEFAULT 'friendly',
  extra_instruction TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE tone_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage tone_settings of own stores"
  ON tone_settings FOR ALL
  USING (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = tone_settings.store_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = tone_settings.store_id AND s.user_id = auth.uid())
  );

-- reviews
CREATE TYPE platform_enum AS ENUM (
  'naver', 'baemin', 'yogiyo', 'coupang_eats', 'ddangyo'
);

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  platform platform_enum NOT NULL,
  external_id TEXT,
  rating INTEGER,
  content TEXT,
  author_name TEXT,
  written_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(store_id, platform, external_id)
);

CREATE INDEX idx_reviews_store_id ON reviews(store_id);
CREATE INDEX idx_reviews_platform ON reviews(platform);

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage reviews of own stores"
  ON reviews FOR ALL
  USING (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = reviews.store_id AND s.user_id = auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM stores s WHERE s.id = reviews.store_id AND s.user_id = auth.uid())
  );

-- reply_drafts
CREATE TYPE reply_draft_status AS ENUM ('pending', 'approved', 'rejected');

CREATE TABLE reply_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  draft_content TEXT NOT NULL,
  status reply_draft_status NOT NULL DEFAULT 'pending',
  approved_content TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(review_id)
);

CREATE INDEX idx_reply_drafts_review_id ON reply_drafts(review_id);

ALTER TABLE reply_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage reply_drafts of own stores"
  ON reply_drafts FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM reviews r
      JOIN stores s ON s.id = r.store_id
      WHERE r.id = reply_drafts.review_id AND s.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM reviews r
      JOIN stores s ON s.id = r.store_id
      WHERE r.id = reply_drafts.review_id AND s.user_id = auth.uid()
    )
  );
