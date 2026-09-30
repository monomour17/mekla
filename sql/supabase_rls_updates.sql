-- ============================================
-- MEYDAN - RLS POLICY GÜNCELLEMELERİ
-- Bu SQL'i Supabase SQL Editor'da çalıştır
-- ============================================

-- ============================================
-- 1. PROFILES: is_active=false olan kullanıcıları gizle
-- ============================================

-- Mevcut SELECT policy'yi güncelle (varsa kaldır, yeniden oluştur)
DROP POLICY IF EXISTS "Users can view active profiles" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;

-- Aktif profilleri herkes görebilir, kendi profilini her zaman görebilir
CREATE POLICY "Users can view active profiles"
ON profiles FOR SELECT
TO authenticated
USING (
  is_active = true OR id = auth.uid()
);

-- ============================================
-- 2. POSTS: Engellenen kullanıcıların gönderilerini filtrele
-- (RLS'de blocks tablosuna cross-reference yapmak pahalı,
--  uygulama tarafında filtreliyoruz - ama is_active kontrolü ekleyelim)
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view posts" ON posts;
DROP POLICY IF EXISTS "Anyone can view posts" ON posts;

CREATE POLICY "Authenticated users can view posts"
ON posts FOR SELECT
TO authenticated
USING (
  -- Yazarın aktif olması gerekiyor
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = posts.author_id
    AND profiles.is_active = true
  )
);

-- ============================================
-- 3. POST_COMMENTS: İnaktif kullanıcı yorumlarını gizle
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view comments" ON post_comments;
DROP POLICY IF EXISTS "Anyone can view comments" ON post_comments;

CREATE POLICY "Authenticated users can view comments"
ON post_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = post_comments.author_id
    AND profiles.is_active = true
  )
);

-- ============================================
-- 4. POST_LIKES: İnaktif kullanıcıların beğenilerini gizle
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view likes" ON post_likes;
DROP POLICY IF EXISTS "Anyone can view likes" ON post_likes;

CREATE POLICY "Authenticated users can view likes"
ON post_likes FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = post_likes.user_id
    AND profiles.is_active = true
  )
);

-- ============================================
-- 5. EVENTS: Sadece aktif kullanıcıların etkinlikleri
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view events" ON events;
DROP POLICY IF EXISTS "Anyone can view events" ON events;

CREATE POLICY "Authenticated users can view events"
ON events FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = events.creator_id
    AND profiles.is_active = true
  )
);

-- ============================================
-- 6. COMMUNITY_MESSAGES: İnaktif kullanıcı mesajlarını gizle
-- ============================================

DROP POLICY IF EXISTS "Authenticated users can view community messages" ON community_messages;
DROP POLICY IF EXISTS "Members can view messages" ON community_messages;

CREATE POLICY "Authenticated users can view community messages"
ON community_messages FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = community_messages.sender_id
    AND profiles.is_active = true
  )
);

-- ============================================
-- 7. MESSAGES (DM): Sadece konuşma tarafları görebilir
-- ============================================

DROP POLICY IF EXISTS "Users can view own messages" ON messages;
DROP POLICY IF EXISTS "Authenticated users can view messages" ON messages;

CREATE POLICY "Users can view own messages"
ON messages FOR SELECT
TO authenticated
USING (
  sender_id = auth.uid()
  OR
  -- Match-based: kullanıcı match'in tarafı mı?
  (match_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM matches
    WHERE matches.id = messages.match_id
    AND (matches.user1_id = auth.uid() OR matches.user2_id = auth.uid())
  ))
  OR
  -- Conversation-based: kullanıcı conversation'ın tarafı mı?
  (conversation_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM conversations
    WHERE conversations.id = messages.conversation_id
    AND (conversations.user1_id = auth.uid() OR conversations.user2_id = auth.uid())
  ))
);

-- ============================================
-- 8. Performans için INDEX'ler
-- ============================================

-- Posts: created_at sıralama + community_id filtre
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_community_id ON posts (community_id);
CREATE INDEX IF NOT EXISTS idx_posts_author_id ON posts (author_id);

-- Profiles: is_active filtre
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON profiles (is_active) WHERE is_active = true;

-- Messages: match_id ve conversation_id lookup
CREATE INDEX IF NOT EXISTS idx_messages_match_id ON messages (match_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id, created_at DESC);

-- Post interactions
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON post_likes (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON post_comments (post_id);

-- Event participants
CREATE INDEX IF NOT EXISTS idx_event_participants_event_id ON event_participants (event_id, status);
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants (user_id);

-- Blocks
CREATE INDEX IF NOT EXISTS idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocks_blocked ON blocks (blocked_id);

-- ============================================
-- BITTI!
-- ============================================
