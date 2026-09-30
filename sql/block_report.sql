-- blocks tablosu (kullanıcı engelleme)
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (blocker_id, blocked_id)
);

CREATE INDEX IF NOT EXISTS blocks_blocker_idx ON blocks(blocker_id);
CREATE INDEX IF NOT EXISTS blocks_blocked_idx ON blocks(blocked_id);

ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

-- Kullanıcılar engel ekleyebilir
CREATE POLICY "Users can insert own blocks" ON blocks
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);

-- Kullanıcılar kendi engellerini görebilir
CREATE POLICY "Users can view own blocks" ON blocks
  FOR SELECT USING (auth.uid() = blocker_id OR auth.uid() = blocked_id);

-- Kullanıcılar kendi engellerini kaldırabilir
CREATE POLICY "Users can delete own blocks" ON blocks
  FOR DELETE USING (auth.uid() = blocker_id);

-- reports tablosu participant_management.sql içinde tanımlı.
-- event_id nullable olduğu için profil şikayetleri de destekleniyor
-- (event_id olmadan INSERT yapılabilir).
