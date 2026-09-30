-- ============================================
-- Meydan/Mekla: Sohbetler ekranı N+1 sorgu düzeltmesi
-- ChatsScreen.js'in load() fonksiyonu, kullanıcının her etkinliği için
-- (oluşturduğu + katıldığı) ayrı bir "son mesaj" sorgusu atıyordu —
-- 37 etkinliği olan bir kullanıcı için 37 paralel HTTP isteği demek.
-- Bu, Postgres'in DISTINCT ON deseniyle tek sorguda "her event_id için
-- en son mesajı getir" işini yapıyor. RLS invoker olarak çalışıyor
-- (SECURITY DEFINER değil) — event_messages'ın mevcut RLS politikası
-- zaten sadece organizatör/onaylı katılımcının görebileceği satırları
-- döndürüyor, bu fonksiyon o korumayı bypass etmiyor.
-- ============================================

CREATE OR REPLACE FUNCTION get_latest_event_messages(p_event_ids uuid[])
RETURNS TABLE (event_id uuid, content text, type text, created_at timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT DISTINCT ON (event_id) event_id, content, type, created_at
  FROM event_messages
  WHERE event_id = ANY(p_event_ids)
  ORDER BY event_id, created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION get_latest_event_messages(uuid[]) TO authenticated;
