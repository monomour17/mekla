-- ============================================
-- Meydan/Mekla: Eksik INSERT politikası düzeltmesi
-- event_participants'ta mevcut iki INSERT politikası da sadece
-- "auth.uid() = user_id" (kişi kendi adına başvuru) izin veriyordu.
-- Gönderi→Etkinlik köprüsünde (CreateEventScreen.js, sourcePostId akışı)
-- etkinlik sahibi, gönderiye yorum yapanları OTOMATİK katılımcı yapmaya
-- çalışıyor — yani kendi adına değil, başkaları adına insert atıyor.
-- Bu politika olmadan RLS bu insert'i sessizce reddediyordu (kod try/catch
-- ile hatayı yutup sadece console.warn basıyordu), özellik hiç çalışmıyordu.
-- ============================================

CREATE POLICY "Etkinlik sahibi yorumlayanları katılımcı olarak ekleyebilir"
  ON event_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    status IN ('approved', 'waiting')
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_participants.event_id
        AND e.creator_id = auth.uid()
    )
  );
