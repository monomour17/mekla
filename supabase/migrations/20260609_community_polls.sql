-- ============================================================
-- Topluluk Anket (Poll) Sistemi
-- Çalıştır: Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Anket tablosu
create table if not exists community_polls (
  id          uuid primary key default gen_random_uuid(),
  community_id uuid not null references communities(id) on delete cascade,
  creator_id   uuid not null references profiles(id) on delete cascade,
  question     text not null,
  options      jsonb not null default '[]',  -- [{text: string}]
  ends_at      timestamptz,                  -- null = süresiz
  created_at   timestamptz default now()
);

-- 2. Oy tablosu (kullanıcı başına 1 oy)
create table if not exists community_poll_votes (
  id           uuid primary key default gen_random_uuid(),
  poll_id      uuid not null references community_polls(id) on delete cascade,
  user_id      uuid not null references profiles(id) on delete cascade,
  option_index int  not null,
  created_at   timestamptz default now(),
  unique (poll_id, user_id)
);

-- 3. RLS
alter table community_polls       enable row level security;
alter table community_poll_votes  enable row level security;

-- Topluluk üyeleri okuyabilir
create policy "polls_select" on community_polls
  for select using (
    exists (
      select 1 from user_communities uc
      where uc.community_id = community_polls.community_id
        and uc.user_id = auth.uid()
    )
  );

-- Topluluk üyeleri anket oluşturabilir (yönetici kısıtlaması frontend'de)
create policy "polls_insert" on community_polls
  for insert with check (creator_id = auth.uid());

-- Oluşturan kişi silebilir
create policy "polls_delete" on community_polls
  for delete using (creator_id = auth.uid());

-- Oy okuma: topluluk üyeleri
create policy "votes_select" on community_poll_votes
  for select using (
    exists (
      select 1 from community_polls cp
      join user_communities uc on uc.community_id = cp.community_id
      where cp.id = community_poll_votes.poll_id
        and uc.user_id = auth.uid()
    )
  );

-- Oy verme: topluluk üyeleri
create policy "votes_insert" on community_poll_votes
  for insert with check (user_id = auth.uid());

-- Oy değiştirme
create policy "votes_update" on community_poll_votes
  for update using (user_id = auth.uid());

-- Indeksler
create index if not exists idx_polls_community_id on community_polls(community_id, created_at desc);
create index if not exists idx_votes_poll_id      on community_poll_votes(poll_id);
create index if not exists idx_votes_user_poll    on community_poll_votes(user_id, poll_id);
