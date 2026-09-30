-- ============================================
-- Meydan/Mekla: Büyüme Paketi
-- 1) Alan-içi etkinlik oluşturma: events.community_id
-- 2) Gönderi/yorum seviyesi şikayet izlenebilirliği: reports.post_id, reports.comment_id
-- ============================================

-- 1. Etkinlikler bir alana (community) bağlanabilsin
ALTER TABLE events ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_community ON events(community_id) WHERE community_id IS NOT NULL;

-- 2. Şikayetler hangi gönderi/yorum için yapıldığını kaydetsin
-- (reported_user_id zaten vardı — bu, "kimin şikayet edildiğini" değil
--  "hangi içerik yüzünden" bilgisini ekliyor; moderatör inceleme hızını artırır)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS post_id UUID REFERENCES posts(id) ON DELETE SET NULL;
ALTER TABLE reports ADD COLUMN IF NOT EXISTS comment_id UUID REFERENCES post_comments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS reports_post_idx ON reports(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS reports_comment_idx ON reports(comment_id) WHERE comment_id IS NOT NULL;
