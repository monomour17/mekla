-- ============================================================
-- OTOMATIK ONAY — Çalıştır: Supabase Dashboard → SQL Editor
-- Organizatör "Katılımları Otomatik Onayla" açarsa katılımcılar
-- onay beklemeden doğrudan 'approved' statüsüyle eklenir.
-- ============================================================

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS auto_approve boolean NOT NULL DEFAULT false;

-- Ek INSERT politikası (mevcut politikalarla OR'lanır, onları daraltmaz):
-- kullanıcı kendi adına 'approved'/'waiting' satırını YALNIZCA etkinlik
-- auto_approve ise ekleyebilir. Normal etkinliklerde 'pending' akışı değişmez.
DROP POLICY IF EXISTS "self insert on auto approve events" ON event_participants;
CREATE POLICY "self insert on auto approve events" ON event_participants
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND status IN ('approved', 'waiting')
    AND EXISTS (
      SELECT 1 FROM events e
      WHERE e.id = event_participants.event_id
        AND e.auto_approve = true
        AND e.status = 'open'
    )
  );
