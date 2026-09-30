-- ============================================
-- Meydan: Communities (Topluluklar) Sistemi
-- ============================================

-- 1. communities tablosu (sistem tarafından seed'lenir)
CREATE TABLE IF NOT EXISTS communities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '👥',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_communities_name ON communities(name);

ALTER TABLE communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view communities"
  ON communities FOR SELECT
  TO authenticated
  USING (true);

-- 2. user_communities (many-to-many ara tablo)
CREATE TABLE IF NOT EXISTS user_communities (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, community_id)
);

CREATE INDEX idx_user_communities_community ON user_communities(community_id);
CREATE INDEX idx_user_communities_user ON user_communities(user_id);

ALTER TABLE user_communities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view memberships"
  ON user_communities FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can join communities"
  ON user_communities FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave communities"
  ON user_communities FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 3. community_messages (grup sohbeti)
CREATE TABLE IF NOT EXISTS community_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  community_id UUID REFERENCES communities(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  media_url TEXT,
  type TEXT DEFAULT 'text' CHECK (type IN ('text', 'system')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_community_messages_community ON community_messages(community_id, created_at);
CREATE INDEX idx_community_messages_sender ON community_messages(sender_id);

ALTER TABLE community_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Community members can read messages"
  ON community_messages FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_communities
      WHERE user_communities.community_id = community_messages.community_id
        AND user_communities.user_id = auth.uid()
    )
  );

CREATE POLICY "Community members can send messages"
  ON community_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM user_communities
      WHERE user_communities.community_id = community_messages.community_id
        AND user_communities.user_id = auth.uid()
    )
  );

-- ============================================
-- Seed: 12 Başlangıç Topluluğu
-- ============================================
INSERT INTO communities (name, description, icon) VALUES
  ('0-3 Yaş Ebeveynleri', 'Bebek ve küçük çocuk sahibi ailelerin buluşma noktası', '👶'),
  ('Kutu Oyunu Sevenler', 'Aile ve çift oyun gecelerini sevenler için', '🎲'),
  ('Hafta Sonu Kampçıları', 'Doğada kamp yapmayı seven aileler', '⛺'),
  ('Yemek & Mutfak', 'Birlikte yemek yapmayı ve yeni tarifler denemeyi sevenler', '🍳'),
  ('Spor & Doğa Yürüyüşü', 'Aktif yaşam tarzını benimseyen çiftler ve aileler', '🥾'),
  ('Çocuklu Gezginler', 'Çocuklarla seyahat eden ve gezi planlayan aileler', '✈️'),
  ('Evcil Hayvan Sahipleri', 'Evcil hayvan sahibi aileler için buluşma alanı', '🐾'),
  ('Kitap Kurdu Aileler', 'Okumayı seven ve kitap tartışan aileler', '📚'),
  ('Oyun Gecesi Severler', 'Video oyunu, masa oyunu ve eğlence geceleri', '🎮'),
  ('Bebek Bekliyoruz', 'Hamilelik sürecini birlikte yaşayan çiftler', '🤰'),
  ('Tek Ebeveynler', 'Tek ebeveynlerin destek ve sosyalleşme alanı', '💪'),
  ('Müzik & Sanat', 'Müzik ve sanatla ilgilenen yaratıcı aileler', '🎨')
ON CONFLICT (name) DO NOTHING;
