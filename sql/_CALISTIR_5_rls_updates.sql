-- ============================================
-- RLS GÜNCELLEMELERİ & PERFORMANS INDEX'LERİ
-- ============================================

-- 1. PROFILES: is_active=false olanları gizle
DROP POLICY IF EXISTS "Users can view active profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

CREATE POLICY "Users can view active profiles"
ON profiles FOR SELECT TO authenticated
USING (is_active = true OR id = auth.uid());

-- 2. POSTS: inaktif yazarların gönderilerini gizle
DROP POLICY IF EXISTS "Authenticated users can view posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;

CREATE POLICY "Authenticated users can view posts"
ON posts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = posts.author_id AND profiles.is_active = true
  )
);

-- 3. POST_COMMENTS: inaktif kullanıcı yorumlarını gizle
DROP POLICY IF EXISTS "Authenticated users can view comments" ON post_comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON post_comments;

CREATE POLICY "Authenticated users can view comments"
ON post_comments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = post_comments.author_id AND profiles.is_active = true
  )
);

-- 4. POST_LIKES: inaktif kullanıcı beğenilerini gizle
DROP POLICY IF EXISTS "Authenticated users can view likes" ON post_likes;
DROP POLICY IF EXISTS "Anyone can view likes" ON post_likes;

CREATE POLICY "Authenticated users can view likes"
ON post_likes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = post_likes.user_id AND profiles.is_active = true
  )
);

-- 5. EVENTS: sadece aktif kullanıcıların etkinlikleri
DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view events" ON events;

CREATE POLICY "Authenticated users can view events"
ON events FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.creator_id AND profiles.is_active = true
  )
);

-- 6. Performans index'leri
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts (community_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts (author_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles (is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants (event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);
