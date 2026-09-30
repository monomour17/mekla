-- ============================================
-- Hafta 1: In-App Bildirimler + Bildirim Tercihleri
-- + Eski conversations/messages tablolarının temizliği
-- ============================================

-- 1) NOTIFICATIONS TABLOSU
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  type TEXT NOT NULL,                  -- 'request_approved' | 'request_rejected' | 'new_question' | 'question_answered' | 'event_cancelled' | 'event_reminder' | 'new_participant' | 'system'
  title TEXT NOT NULL,
  body TEXT,
  data JSONB DEFAULT '{}'::jsonb,      -- { eventId, postId, ... } — deep link için
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, read_at, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Sadece sahibi okuyabilir
CREATE POLICY "Users read own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

-- Sahibi okundu olarak işaretleyebilir / silebilir
CREATE POLICY "Users update own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own notifications" ON notifications
  FOR DELETE USING (auth.uid() = user_id);

-- Authenticated kullanıcılar başka birine bildirim oluşturabilir
-- (örn. organizatör katılım onayladığında, kullanıcı soru sorduğunda)
-- Spam riski için trigger ile sınırlı tutulabilir; V1 için yeterli.
CREATE POLICY "Authenticated insert notifications" ON notifications
  FOR INSERT TO authenticated WITH CHECK (true);


-- 2) PROFILES → notification_prefs JSONB
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS notification_prefs JSONB
  DEFAULT '{"event_reminder": true, "request_update": true, "new_question": true, "community_post": true}'::jsonb;


-- 3) ESKİ DM SİSTEMİ TEMİZLİĞİ
-- Match/DM sistemi koddan tamamen silindi (memory: match_system_removed.md).
-- DB tablolarını da kaldırıyoruz ki ileride yanlışlıkla kullanılmasın.
DROP TABLE IF EXISTS messages CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
