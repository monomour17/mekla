-- ============================================
-- MEYDAN - Sohbet Fotoğrafı & Mesaj Politikaları
-- Supabase Dashboard → SQL Editor'da çalıştır
-- ============================================

-- ── 1. Storage: event_chat/ (Etkinlik grup sohbeti fotoğrafları) ──
DROP POLICY IF EXISTS "Authenticated can upload event chat photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event chat photos"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event chat photos"     ON storage.objects;

CREATE POLICY "Authenticated can upload event chat photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'photos'
    AND name LIKE 'event_chat/%'
  );

CREATE POLICY "Public can view event chat photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos'
    AND name LIKE 'event_chat/%'
  );

CREATE POLICY "Users can delete own event chat photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'photos'
    AND name LIKE 'event_chat/%'
    AND owner = auth.uid()
  );

-- ── 2. Storage: community_chat/ (Topluluk sohbeti fotoğrafları) ──
DROP POLICY IF EXISTS "Authenticated can upload community chat photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view community chat photos"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own community chat photos"     ON storage.objects;

CREATE POLICY "Authenticated can upload community chat photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'photos'
    AND name LIKE 'community_chat/%'
  );

CREATE POLICY "Public can view community chat photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos'
    AND name LIKE 'community_chat/%'
  );

CREATE POLICY "Users can delete own community chat photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'photos'
    AND name LIKE 'community_chat/%'
    AND owner = auth.uid()
  );

-- ── 3. event_messages: Kendi mesajını düzenle / sil ────────────────
DROP POLICY IF EXISTS "Users can update own event messages" ON event_messages;
DROP POLICY IF EXISTS "Users can delete own event messages" ON event_messages;

CREATE POLICY "Users can update own event messages"
  ON event_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete own event messages"
  ON event_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);

-- ── 4. community_messages: Kendi mesajını düzenle / sil ──────────
DROP POLICY IF EXISTS "Users can update own community messages" ON community_messages;
DROP POLICY IF EXISTS "Users can delete own community messages" ON community_messages;

CREATE POLICY "Users can update own community messages"
  ON community_messages FOR UPDATE
  TO authenticated
  USING (auth.uid() = sender_id)
  WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can delete own community messages"
  ON community_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = sender_id);
