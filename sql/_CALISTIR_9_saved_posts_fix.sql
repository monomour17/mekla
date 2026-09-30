-- Saved posts tablosunu kontrol et ve policy'leri düzelt
CREATE TABLE IF NOT EXISTS saved_posts (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;

-- Eski policy'yi sil, yenilerini ekle (daha explicit)
DROP POLICY IF EXISTS "Users can manage their own saves" ON saved_posts;

CREATE POLICY "saved_posts_select" ON saved_posts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "saved_posts_insert" ON saved_posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved_posts_delete" ON saved_posts
  FOR DELETE USING (auth.uid() = user_id);
