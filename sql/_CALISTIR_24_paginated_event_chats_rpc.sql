-- ============================================
-- Meydan/Mekla: Sohbetler ekranı gerçek sayfalama (infinite scroll)
-- Kullanıcı önceki turda (_CALISTIR_23) "37 event için 37 sorgu" sorununu
-- tek sorguya indirmiştik, ama ekran hâlâ TÜM etkinlikleri tek seferde
-- çekiyordu. Kullanıcının kendisi events.last_message_at sütununu ve
-- event_messages insert'inde onu güncelleyen trigger'ı ekledi (bkz.
-- oturum notları). Bu RPC, artık "son mesaj zamanı"na göre sıralı,
-- LIMIT/OFFSET ile sayfalanabilir bir liste dönüyor — get_latest_event_messages
-- (_CALISTIR_23) RPC'sine artık gerek yok, bu yüzden o da siliniyor.
-- ============================================

CREATE OR REPLACE FUNCTION get_my_event_chats(p_user_id uuid, p_limit int DEFAULT 20, p_offset int DEFAULT 0)
RETURNS TABLE (id uuid, title text, cover_photo_url text, last_message_at timestamptz)
LANGUAGE sql
STABLE
AS $$
  SELECT e.id, e.title, e.cover_photo_url, e.last_message_at
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

DROP FUNCTION IF EXISTS get_latest_event_messages(uuid[]);
