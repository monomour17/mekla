-- ============================================================
-- TEST VERİSİ TEMİZLİĞİ — MEKLA
-- Çalıştır: Supabase Dashboard → SQL Editor → Run
-- Seed organizatör + seed communities + seed events KORUNUR
-- Geri kalan her şey silinir
-- ============================================================

DO $$
DECLARE
  seed_org UUID := '3a8219e9-fafd-4869-a876-369796ea85b5';
BEGIN

  -- Anketler
  DELETE FROM community_poll_votes;
  DELETE FROM community_polls;

  -- Topluluk içerikleri
  DELETE FROM community_messages;
  DELETE FROM user_communities;

  -- Gönderi içerikleri
  DELETE FROM post_likes;
  DELETE FROM post_comments;
  DELETE FROM saved_posts;
  DELETE FROM post_media;
  DELETE FROM posts;

  -- Etkinlik içerikleri
  DELETE FROM event_photos;
  DELETE FROM event_reviews;
  DELETE FROM event_messages;
  DELETE FROM event_participants;
  DELETE FROM event_questions;

  -- Diğer kullanıcı verisi
  DELETE FROM notifications;
  DELETE FROM blocks;
  DELETE FROM reports;
  DELETE FROM business_follows;
  DELETE FROM sms_send_log;

  -- Profiller (seed organizatör hariç)
  DELETE FROM profiles WHERE id != seed_org;

  RAISE NOTICE 'Temizlik tamamlandı. Seed organizatör, topluluklar ve etkinlikler korundu.';
END $$;
