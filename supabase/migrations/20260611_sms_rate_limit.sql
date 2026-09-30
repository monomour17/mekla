-- SMS gönderim logu — send-sms edge function'ın rate limit kontrolü için.
-- Sadece service role yazar/okur (RLS açık, policy yok = anon erişemez).

create table if not exists public.sms_send_log (
  id bigint generated always as identity primary key,
  phone text not null,
  sent_at timestamptz not null default now()
);

create index if not exists sms_send_log_phone_sent_at_idx
  on public.sms_send_log (phone, sent_at desc);

alter table public.sms_send_log enable row level security;

-- Eski kayıtları temizlemek için (pg_cron varsa günlük çağrılabilir):
--   select public.prune_sms_send_log();
create or replace function public.prune_sms_send_log()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.sms_send_log where sent_at < now() - interval '24 hours';
$$;
