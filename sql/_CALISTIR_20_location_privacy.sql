-- ============================================
-- Meydan/Mekla: Kademeli Konum Gizliliği
-- Tam konum artık herkese açık değil — sadece organizatör ve
-- onaylanmış/katılmış kullanıcılar görebilir (RLS ile, UI'da değil).
-- ============================================

-- 1. Herkese açık, kaba konum (mahalle/şehir seviyesi) — mevcut events satırında kalır
ALTER TABLE events ADD COLUMN IF NOT EXISTS location_rough TEXT;
-- Haritada bulanık gösterim için mahalle merkezine yuvarlanmış yaklaşık koordinat
ALTER TABLE events ADD COLUMN IF NOT EXISTS rough_latitude DOUBLE PRECISION;
ALTER TABLE events ADD COLUMN IF NOT EXISTS rough_longitude DOUBLE PRECISION;

-- 2. Tam konum — ayrı tablo, RLS ile korunur
CREATE TABLE IF NOT EXISTS event_locations (
  event_id UUID PRIMARY KEY REFERENCES events(id) ON DELETE CASCADE,
  location_detail TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION
);

ALTER TABLE event_locations ENABLE ROW LEVEL SECURITY;

-- Yeniden çalıştırmak güvenli olsun diye önce kaldırıp tekrar oluşturuyoruz
DROP POLICY IF EXISTS "Organizatör ve onaylı katılımcılar tam konumu görür" ON event_locations;
DROP POLICY IF EXISTS "Organizatör tam konum ekler/günceller/siler" ON event_locations;

CREATE POLICY "Organizatör ve onaylı katılımcılar tam konumu görür"
  ON event_locations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM events WHERE events.id = event_locations.event_id AND events.creator_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_participants.event_id = event_locations.event_id
        AND event_participants.user_id = auth.uid()
        AND event_participants.status IN ('approved', 'attended')
    )
  );

CREATE POLICY "Organizatör tam konum ekler/günceller/siler"
  ON event_locations FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM events WHERE events.id = event_locations.event_id AND events.creator_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM events WHERE events.id = event_locations.event_id AND events.creator_id = auth.uid()));

-- 3. Geriye dönük veri taşıma: mevcut etkinliklerin tam konumunu yeni tabloya kopyala
INSERT INTO event_locations (event_id, location_detail, latitude, longitude)
SELECT id, location_detail, latitude, longitude FROM events
WHERE location_detail IS NOT NULL
ON CONFLICT (event_id) DO NOTHING;

-- Mevcut etkinliklerde kaba konum boşsa geçici olarak şehri kullan
UPDATE events SET location_rough = city WHERE location_rough IS NULL;

-- 4. Eski genel-erişim sütunlarını temizle — artık herkese açık olmamalı
-- (location_detail baştan NOT NULL tanımlıydı, önce kısıtı kaldırıyoruz)
ALTER TABLE events ALTER COLUMN location_detail DROP NOT NULL;
ALTER TABLE events ALTER COLUMN latitude DROP NOT NULL;
ALTER TABLE events ALTER COLUMN longitude DROP NOT NULL;

UPDATE events SET location_detail = NULL, latitude = NULL, longitude = NULL;

-- 5. view_events_with_stats, "e.*" içeriyor — Postgres bu wildcard'ı VIEW
-- oluşturulduğu anda sabit bir sütun listesine genişletir, yeni eklenen
-- sütunları (location_rough, rough_latitude, rough_longitude) otomatik
-- almaz. Yeni sütunlar e.*'nin ORTASINA değil sonuna eklenmiş olsa da,
-- events tablosundaki en son mevcut sütundan (business_id) SONRA gelip
-- view'ın kendi ek sütunlarından (creator_display_name vb.) ÖNCE
-- geldiğinden pozisyonlar kayıyor — CREATE OR REPLACE bunu kabul etmiyor
-- ("cannot change name of view column"). DROP + CREATE ile çözülüyor.
DROP VIEW IF EXISTS view_events_with_stats;
CREATE VIEW view_events_with_stats AS
SELECT
  e.*,
  p.display_name AS creator_display_name,
  p.photos       AS creator_photos,
  COALESCE(stats.approved_count, 0) + 1 AS participant_count,
  COALESCE(stats.pending_count, 0) AS pending_count,
  COALESCE(avatars.avatar_list, '[]'::jsonb) AS participant_avatars
FROM events e
LEFT JOIN profiles p ON p.id = e.creator_id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE ep.status = 'approved') AS approved_count,
    COUNT(*) FILTER (WHERE ep.status = 'pending')  AS pending_count
  FROM event_participants ep
  WHERE ep.event_id = e.id
) stats ON true
LEFT JOIN LATERAL (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', av_p.id,
      'photo', av_p.photos[1],
      'display_name', av_p.display_name
    )
  ) AS avatar_list
  FROM (
    SELECT ep2.user_id
    FROM event_participants ep2
    WHERE ep2.event_id = e.id AND ep2.status = 'approved'
    LIMIT 3
  ) top3
  JOIN profiles av_p ON av_p.id = top3.user_id
) avatars ON true;
