-- ============================================
-- Meydan/Mekla: Büyüme Paketi 2
-- 1) Cevapsız gönderi kurtarma: posts.unanswered_notified_at
-- 2) Alan-içi takma ad: user_communities.alias_display_name / alias_avatar_url
-- ============================================

-- 1. Bir gönderi için kurtarma bildirimi bir kez atılsın diye kilit
ALTER TABLE posts ADD COLUMN IF NOT EXISTS unanswered_notified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_posts_unanswered
  ON posts(created_at)
  WHERE community_id IS NOT NULL AND unanswered_notified_at IS NULL;

-- 2. Kullanıcı+alan başına takma ad (üyelik süresince sabit, platforma karşı
-- anonim değil — author_id her zaman gerçek kullanıcıyı gösterir, bu sadece
-- görüntüleme katmanında bir isim/foto değişimi)
ALTER TABLE user_communities ADD COLUMN IF NOT EXISTS alias_display_name TEXT;
ALTER TABLE user_communities ADD COLUMN IF NOT EXISTS alias_avatar_url TEXT;
