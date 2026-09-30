-- ====== Etkinlik Soru & Cevap ======

CREATE TABLE IF NOT EXISTS event_questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT,
  answered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS event_questions_event_idx ON event_questions(event_id);
CREATE INDEX IF NOT EXISTS event_questions_user_idx ON event_questions(user_id);

ALTER TABLE event_questions ENABLE ROW LEVEL SECURITY;

-- Herkes soruları ve cevapları görebilir
CREATE POLICY "Anyone can view event questions" ON event_questions
  FOR SELECT USING (true);

-- Giriş yapmış kullanıcılar soru sorabilir
CREATE POLICY "Users can ask questions" ON event_questions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Etkinlik organizatörü cevap verebilir
CREATE POLICY "Event creator can answer questions" ON event_questions
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_questions.event_id
        AND events.creator_id = auth.uid()
    )
  );

-- Soru sahibi, cevaplanmamış sorusunu silebilir
CREATE POLICY "Users can delete own unanswered questions" ON event_questions
  FOR DELETE USING (auth.uid() = user_id AND answer IS NULL);
