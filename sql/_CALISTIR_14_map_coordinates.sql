-- _CALISTIR_14_map_coordinates.sql
-- events tablosuna harita koordinatları eklenir.
-- Mevcut etkinliklerde bu alanlar NULL kalır (haritada gösterilmez).
-- Yeni etkinlikler oluşturulurken Nominatim ile otomatik geocode edilir.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS latitude  DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Harita sorgularını hızlandırmak için index
CREATE INDEX IF NOT EXISTS idx_events_coords
  ON events (latitude, longitude)
  WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
