-- Event mesajlarına media_url kolonu ekle (fotoğraf ve konum paylaşımı için)
ALTER TABLE event_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
