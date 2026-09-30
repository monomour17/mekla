CREATE TABLE IF NOT EXISTS saved_posts (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

ALTER TABLE saved_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage their own saves" ON saved_posts FOR ALL USING (auth.uid() = user_id);
