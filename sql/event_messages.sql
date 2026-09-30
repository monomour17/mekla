
-- Tablo Oluşturma
CREATE TABLE event_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Hızlı Sorgular İçin İndeksleme
CREATE INDEX event_messages_event_id_idx ON event_messages(event_id);
CREATE INDEX event_messages_created_at_idx ON event_messages(created_at);

-- Row Level Security (RLS) Etkinleştirme
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;

-- 1. Herkes Okuyabilir (Sadece Organizatör ve Onaylı Katılımcı)
CREATE POLICY "Onaylı katılımcılar ve organizatör mesajları okuyabilir" ON event_messages
    FOR SELECT
    USING (
        auth.uid() = (SELECT creator_id FROM events WHERE id = event_id)
        OR 
        EXISTS (
            SELECT 1 FROM event_participants 
            WHERE event_participants.event_id = event_messages.event_id 
            AND event_participants.user_id = auth.uid() 
            AND event_participants.status = 'approved'
        )
    );

-- 2. Herkes Yazabilir (Sadece Organizatör ve Onaylı Katılımcı)
CREATE POLICY "Onaylı katılımcılar ve organizatör mesaj gönderebilir" ON event_messages
    FOR INSERT
    WITH CHECK (
        auth.uid() = sender_id AND (
            auth.uid() = (SELECT creator_id FROM events WHERE id = event_id)
            OR 
            EXISTS (
                SELECT 1 FROM event_participants 
                WHERE event_participants.event_id = event_messages.event_id 
                AND event_participants.user_id = auth.uid() 
                AND event_participants.status = 'approved'
            )
        )
    );

