-- ============================================
-- MEYDAN - İşletme Profili
-- Supabase Dashboard → SQL Editor'da çalıştır
-- ============================================

-- 1) PROFILES → işletme alanları
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_name       TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_category   TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_website    TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_instagram  TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_bio        TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS business_cover_url  TEXT;

-- 2) EVENTS → hangi işletmenin etkinliği (opsiyonel)
ALTER TABLE events ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES profiles(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_events_business_id ON events(business_id);

-- 3) BUSINESS_FOLLOWS tablosu
CREATE TABLE IF NOT EXISTS business_follows (
  follower_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  business_id  UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (follower_id, business_id)
);

CREATE INDEX IF NOT EXISTS idx_business_follows_business ON business_follows(business_id);
CREATE INDEX IF NOT EXISTS idx_business_follows_follower ON business_follows(follower_id);

ALTER TABLE business_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can follow businesses"
  ON business_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow businesses"
  ON business_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

CREATE POLICY "Users can view follows"
  ON business_follows FOR SELECT TO authenticated
  USING (true);

-- 4) NOTIFICATION_PREFS → business_events toggle ekle
UPDATE profiles
SET notification_prefs = notification_prefs || '{"business_events": true}'::jsonb
WHERE notification_prefs IS NOT NULL
  AND NOT (notification_prefs ? 'business_events');

-- 5) Takipçi sayısını hızlı okumak için view
CREATE OR REPLACE VIEW business_follow_counts AS
SELECT business_id, COUNT(*) AS follower_count
FROM business_follows
GROUP BY business_id;
