-- ============================================
-- Storage Bucket Politikaları
-- Supabase Dashboard → SQL Editor'da çalıştır
-- ============================================

-- ── 1. Event Memories (etkinlik anı fotoğrafları) ──────────
-- Path: event_memories/{eventId}/{userId}_{timestamp}.jpg
-- Bucket: photos

-- Varsa eski politikaları temizle
DROP POLICY IF EXISTS "Authenticated can upload event memories" ON storage.objects;
DROP POLICY IF EXISTS "Public can view event memories"          ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own event memories"     ON storage.objects;

-- Oturum açmış kullanıcı event_memories/ altına yükleyebilir
CREATE POLICY "Authenticated can upload event memories" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'photos'
    AND name LIKE 'event_memories/%'
  );

-- Herkes event_memories/ altındaki fotoğrafları görebilir
CREATE POLICY "Public can view event memories" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'photos'
    AND name LIKE 'event_memories/%'
  );

-- Kullanıcı sadece kendi yüklediği fotoğrafı silebilir
CREATE POLICY "Users can delete own event memories" ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'photos'
    AND name LIKE 'event_memories/%'
    AND owner = auth.uid()
  );

-- ── 2. reports tablosu: eksik DROP POLICY IF EXISTS ────────
-- _CALISTIR_2 ikinci kez çalıştırıldığında patlamaması için

DROP POLICY IF EXISTS "Users can create reports" ON reports;
DROP POLICY IF EXISTS "Users can view own reports" ON reports;

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ── 3. Eksik RLS kontrolü: notifications / push_tokens ─────
-- profiles tablosunda push_token alanı var, tablonun RLS'i zaten açık.
-- Aşağıdaki sadece kontrol / güvence amaçlı:
ALTER TABLE reports      ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_photos  ENABLE ROW LEVEL SECURITY;
