-- event_messages tablosuna type kolonu ekle
-- (Zaten varsa hiçbir şey yapmaz — güvenle çalıştır)
ALTER TABLE event_messages ADD COLUMN IF NOT EXISTS type TEXT NOT NULL DEFAULT 'text';
