-- ============================================
-- Meydan/Mekla: get_my_event_chats sadece last_message_at döndürüyordu ama
-- Sohbetler ekranı mesajın İÇERİĞİNİ de gösteriyor ("Fotoğraf", metin vb.).
-- last_message_at/content/type'ı events'e denormalize etmenin amacı zaten
-- "hiçbir ek sorguya gerek kalmasın" — bu yüzden trigger'ı içeriği de
-- yakalayacak şekilde genişletiyoruz, ayrı bir "son mesajı getir" sorgusuna
-- hiç gerek kalmıyor.
-- ============================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS last_message_content text;
ALTER TABLE events ADD COLUMN IF NOT EXISTS last_message_type text;

-- Tek seferlik geriye dönük doldurma: event_messages şu an prod'da boş
-- olsa da, ileride bu migration doluyken çalıştırılırsa mevcut mesajları
-- da yakalasın diye.
UPDATE events e
SET last_message_at = m.created_at,
    last_message_content = m.content,
    last_message_type = m.type
FROM (
  SELECT DISTINCT ON (event_id) event_id, content, type, created_at
  FROM event_messages
  ORDER BY event_id, created_at DESC
) m
WHERE e.id = m.event_id;

CREATE OR REPLACE FUNCTION update_event_last_message() RETURNS trigger AS $$
begin
  update events
  set last_message_at = new.created_at,
      last_message_content = new.content,
      last_message_type = new.type
  where id = new.event_id;
  return new;
end;
$$ language plpgsql;

-- Dönüş tipine (OUT parametrelerine) yeni sütun eklendiği için
-- CREATE OR REPLACE yetmiyor, Postgres önce DROP istiyor.
DROP FUNCTION IF EXISTS get_my_event_chats(uuid, int, int);

CREATE FUNCTION get_my_event_chats(p_user_id uuid, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, title text, cover_photo_url text, last_message_at timestamptz, last_message_content text)
LANGUAGE sql
STABLE
AS $$
  SELECT e.id, e.title, e.cover_photo_url, e.last_message_at, e.last_message_content
  FROM events e
  WHERE e.status != 'cancelled'
    AND (
      e.creator_id = p_user_id
      OR EXISTS (
        SELECT 1 FROM event_participants ep
        WHERE ep.event_id = e.id AND ep.user_id = p_user_id AND ep.status = 'approved'
      )
    )
  ORDER BY e.last_message_at DESC NULLS LAST, e.id DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION get_my_event_chats(uuid, int, int) TO authenticated;
