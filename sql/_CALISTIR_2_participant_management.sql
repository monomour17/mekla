-- ============================================
-- event_participants: status genişletme
-- ============================================
ALTER TABLE event_participants DROP CONSTRAINT IF EXISTS event_participants_status_check;

ALTER TABLE event_participants ADD CONSTRAINT event_participants_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'removed', 'banned_global', 'attended', 'no_show', 'waiting'));

-- ============================================
-- reports tablosu
-- ============================================
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reported_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'dismissed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS reports_reporter_idx ON reports(reporter_id);
CREATE INDEX IF NOT EXISTS reports_reported_idx ON reports(reported_user_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports" ON reports
  FOR SELECT USING (auth.uid() = reporter_id);
