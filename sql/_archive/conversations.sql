-- ============================================
-- Conversations: Yeni DM Sistemi
-- matches tablosundan bağımsız DM desteği
-- ============================================

-- 1. conversations tablosu
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user1_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  user2_id UUID REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user1_id, user2_id),
  CHECK (user1_id < user2_id)
);

CREATE INDEX idx_conversations_user1 ON conversations(user1_id);
CREATE INDEX idx_conversations_user2 ON conversations(user2_id);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
  ON conversations FOR SELECT
  TO authenticated
  USING (auth.uid() IN (user1_id, user2_id));

CREATE POLICY "Users can create conversations"
  ON conversations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IN (user1_id, user2_id));

-- 2. messages tablosuna conversation_id eklenir
-- Mevcut match_id ile mesajlar korunur, yeni mesajlar conversation_id kullanır
ALTER TABLE messages ADD COLUMN IF NOT EXISTS conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)
  WHERE conversation_id IS NOT NULL;

-- Mevcut RLS politikalarını güncelle: conversation_id ile de erişim
-- Not: Mevcut match_id bazlı politikalar korunur, üstüne eklenir

CREATE POLICY "Conversation participants can read messages"
  ON messages FOR SELECT
  TO authenticated
  USING (
    conversation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.user1_id, conversations.user2_id)
    )
  );

CREATE POLICY "Conversation participants can send messages"
  ON messages FOR INSERT
  TO authenticated
  WITH CHECK (
    conversation_id IS NOT NULL
    AND auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations
      WHERE conversations.id = messages.conversation_id
        AND auth.uid() IN (conversations.user1_id, conversations.user2_id)
    )
  );
