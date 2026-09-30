-- ============================================
-- event_reviews tablosu (organizatör puanlama)
-- ============================================
CREATE TABLE IF NOT EXISTS event_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  reviewer_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Aynı kullanıcı aynı etkinliği iki kez puanlayamasın
CREATE UNIQUE INDEX IF NOT EXISTS event_reviews_unique_idx ON event_reviews(event_id, reviewer_id);
CREATE INDEX IF NOT EXISTS event_reviews_event_idx ON event_reviews(event_id);

ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can create reviews" ON event_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON event_reviews;
DROP POLICY IF EXISTS "Anyone can view reviews" ON event_reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON event_reviews;

CREATE POLICY "Users can create reviews" ON event_reviews
  FOR INSERT WITH CHECK (auth.uid() = reviewer_id);

CREATE POLICY "Users can update own reviews" ON event_reviews
  FOR UPDATE USING (auth.uid() = reviewer_id);

CREATE POLICY "Anyone can view reviews" ON event_reviews
  FOR SELECT USING (true);

CREATE POLICY "Users can delete own reviews" ON event_reviews
  FOR DELETE USING (auth.uid() = reviewer_id);

-- ============================================
-- event_photos tablosu (etkinlik anı galerisi)
-- ============================================
CREATE TABLE IF NOT EXISTS event_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_photos_event_idx ON event_photos(event_id);

ALTER TABLE event_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can upload photos" ON event_photos;
DROP POLICY IF EXISTS "Anyone can view event photos" ON event_photos;
DROP POLICY IF EXISTS "Users can delete own photos" ON event_photos;

CREATE POLICY "Authenticated users can upload photos" ON event_photos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can view event photos" ON event_photos
  FOR SELECT USING (true);

CREATE POLICY "Users can delete own photos" ON event_photos
  FOR DELETE USING (auth.uid() = user_id);
