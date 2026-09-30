-- ============================================
-- Push Token: profiles tablosuna push_token sütunu ekleme
-- ============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Güvenlik: kullanıcılar sadece kendi push_token'larını güncelleyebilir
-- (Mevcut RLS politikaları zaten "users can update own profile" şeklindeyse
--  bu yeterlidir. Eğer yoksa aşağıdaki politikayı ekleyin.)
