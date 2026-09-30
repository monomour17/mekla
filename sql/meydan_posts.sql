-- ============================================
-- Meydan: Posts (Akış Gönderileri) Sistemi
-- ============================================

-- 1. posts tablosu (Anı + Sesleniş)
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  post_type TEXT NOT NULL CHECK (post_type IN ('moment', 'notice', 'post')),
  content TEXT NOT NULL,
  related_event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  community_id UUID REFERENCES communities(id) ON DELETE SET NULL,
  location_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ
);

CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_community ON posts(community_id) WHERE community_id IS NOT NULL;
CREATE INDEX idx_posts_author ON posts(author_id);
CREATE INDEX idx_posts_event ON posts(related_event_id) WHERE related_event_id IS NOT NULL;

ALTER TABLE posts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view posts"
  ON posts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own posts"
  ON posts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can update own posts"
  ON posts FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "Users can delete own posts"
  ON posts FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- 2. post_media tablosu (çoklu fotoğraf)
CREATE TABLE IF NOT EXISTS post_media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  media_url TEXT NOT NULL,
  media_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_post_media_post ON post_media(post_id, media_order);

ALTER TABLE post_media ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view post media"
  ON post_media FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Post authors can add media"
  ON post_media FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
        AND posts.author_id = auth.uid()
    )
  );

CREATE POLICY "Post authors can delete media"
  ON post_media FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM posts
      WHERE posts.id = post_media.post_id
        AND posts.author_id = auth.uid()
    )
  );

-- 3. post_likes tablosu
CREATE TABLE IF NOT EXISTS post_likes (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX idx_post_likes_post ON post_likes(post_id);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view likes"
  ON post_likes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can like posts"
  ON post_likes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike posts"
  ON post_likes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 4. post_comments tablosu
CREATE TABLE IF NOT EXISTS post_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  author_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_post_comments_post ON post_comments(post_id, created_at);
CREATE INDEX idx_post_comments_author ON post_comments(author_id);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view comments"
  ON post_comments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can create own comments"
  ON post_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Users can delete own comments"
  ON post_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);
