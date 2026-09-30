-- ============================================================
-- MEYDAN - Güvenlik Tamamlamaları & delete_my_account RPC
-- Supabase Dashboard → SQL Editor'da çalıştır
-- ============================================================

-- ── 1. PROFILE FOTOĞRAFLARI — Storage Policy ────────────────
-- Path: {userId}/{timestamp}.jpg  (photos bucket)
-- photos.js → pickAndUploadPhoto() bu yolu kullanıyor

DROP POLICY IF EXISTS "Users can upload own profile photos"  ON storage.objects;
DROP POLICY IF EXISTS "Public can view profile photos"       ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos"  ON storage.objects;

-- Kullanıcı kendi UUID klasörüne yükleyebilir
CREATE POLICY "Users can upload own profile photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Herkese açık okuma (profil fotoğrafları herkese görünür)
CREATE POLICY "Public can view profile photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

-- Kullanıcı yalnızca kendi fotoğrafını silebilir
CREATE POLICY "Users can delete own profile photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 2. POST FOTOĞRAFLARI — Storage Policy ───────────────────
-- Bucket: 'post-photos'   Path: {userId}/{timestamp}_{rand}.jpg
-- CreatePostScreen → uploadPhoto('post-photos', userId, uri)

DROP POLICY IF EXISTS "Authenticated can upload post photos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view post photos"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own post photos"     ON storage.objects;

CREATE POLICY "Authenticated can upload post photos" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'post-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public can view post photos" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'post-photos'
  );

CREATE POLICY "Users can delete own post photos" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'post-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ── 3. DELETE MY ACCOUNT RPC ────────────────────────────────
-- SettingsScreen.js: supabase.rpc('delete_my_account')
-- SECURITY DEFINER → auth.users'ı silebilmek için gerekli

CREATE OR REPLACE FUNCTION delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Oturum açık değil';
  END IF;

  -- Profil silme → tüm bağlı veriler (posts, events, blocks, reports...)
  -- ON DELETE CASCADE ile otomatik temizlenir
  DELETE FROM profiles WHERE id = v_user_id;

  -- Auth kaydını sil
  DELETE FROM auth.users WHERE id = v_user_id;
END;
$$;

-- Sadece oturum açmış kullanıcılar çağırabilir
REVOKE ALL ON FUNCTION delete_my_account() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION delete_my_account() TO authenticated;


-- ── 4. EVENT MESSAGES — Bant Kontrolü Düzeltmesi ────────────
-- 'approved' zaten doğru ama policy adını netleştiriyoruz.
-- Eski policy'yi düşür, yenisini ekle (idempotent).

DROP POLICY IF EXISTS "Onaylı katılımcılar ve organizatör mesajları okuyabilir" ON event_messages;
DROP POLICY IF EXISTS "Onaylı katılımcılar ve organizatör mesaj gönderebilir"  ON event_messages;
DROP POLICY IF EXISTS "Event messages select policy" ON event_messages;
DROP POLICY IF EXISTS "Event messages insert policy" ON event_messages;

CREATE POLICY "Event messages select policy" ON event_messages
  FOR SELECT USING (
    -- Organizatör her zaman görebilir
    auth.uid() = (SELECT creator_id FROM events WHERE id = event_messages.event_id)
    OR
    -- Onaylı katılımcı görebilir (banned_global, removed, rejected dışarıda kalır)
    EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_participants.event_id = event_messages.event_id
        AND event_participants.user_id   = auth.uid()
        AND event_participants.status    = 'approved'
    )
  );

CREATE POLICY "Event messages insert policy" ON event_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND (
      auth.uid() = (SELECT creator_id FROM events WHERE id = event_messages.event_id)
      OR
      EXISTS (
        SELECT 1 FROM event_participants
        WHERE event_participants.event_id = event_messages.event_id
          AND event_participants.user_id   = auth.uid()
          AND event_participants.status    = 'approved'
      )
    )
  );
