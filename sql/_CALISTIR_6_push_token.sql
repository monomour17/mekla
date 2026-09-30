-- profiles tablosuna push_token kolonu ekle
-- (Zaten varsa hiçbir şey yapmaz)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS push_token TEXT;
