// Supabase Edge Function: weekly-event-reminder
// Deploy: supabase functions deploy weekly-event-reminder --no-verify-jwt
//
// Cron tetikleyici: Her Cuma 14:00 UTC (= 17:00 Türkiye saati)
// Supabase Dashboard → Edge Functions → weekly-event-reminder → Schedules → "0 14 * * 5"
//
// Mantık:
//   1. Son 7 günde oluşturulmuş, hafta sonu veya önümüzdeki 7 günde olan etkinlikleri şehir bazında grupla
//   2. Her aktif kullanıcıya şehrine özel, bağlamsal bir push bildirimi gönder
//   3. Zaten bu haftanın etkinliğine katılmış kullanıcıları atla (spam değil, değer)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100;

serve(async (_req: Request) => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  const now   = new Date();
  const in7d  = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // 1. Önümüzdeki 7 günde açık etkinlikleri şehir bazında say
  const { data: events, error: evErr } = await supabase
    .from('events')
    .select('id, city, title')
    .eq('status', 'open')
    .gte('event_date', now.toISOString())
    .lte('event_date', in7d.toISOString());

  if (evErr) {
    console.error('[weekly-reminder] Etkinlik çekme hatası:', evErr.message);
    return json({ error: evErr.message }, 500);
  }

  // city → count map
  const cityCount: Record<string, number> = {};
  for (const ev of events ?? []) {
    if (ev.city) cityCount[ev.city] = (cityCount[ev.city] ?? 0) + 1;
  }

  const activeCities = Object.keys(cityCount);
  if (activeCities.length === 0) {
    return json({ skipped: true, reason: 'Bu hafta etkinlik yok' });
  }

  // 2. Aktif, push token'ı olan ve bildirimi kapatmamış kullanıcıları çek
  const { data: profiles, error: profErr } = await supabase
    .from('profiles')
    .select('id, city, push_token, notification_prefs')
    .eq('is_active', true)
    .in('city', activeCities)
    .not('push_token', 'is', null);

  if (profErr) {
    console.error('[weekly-reminder] Profil çekme hatası:', profErr.message);
    return json({ error: profErr.message }, 500);
  }

  // 3. Bu hafta zaten bir etkinliğe katılmış kullanıcıları atla
  const { data: activeParticipants } = await supabase
    .from('event_participants')
    .select('user_id')
    .eq('status', 'approved')
    .in('event_id', (events ?? []).map((e) => e.id));

  const alreadyActiveIds = new Set((activeParticipants ?? []).map((p: any) => p.user_id));

  const eligible = (profiles ?? []).filter((p: any) => {
    if (alreadyActiveIds.has(p.id)) return false;
    const prefs = p.notification_prefs ?? {};
    return prefs.event_reminder !== false;
  });

  console.log(`[weekly-reminder] ${eligible.length} kullanıcıya bildirim gönderilecek`);

  // 4. Şehre özel bağlamsal mesaj oluştur ve batch push gönder
  let sent = 0;
  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE).map((p: any) => {
      const count = cityCount[p.city] ?? 1;
      return {
        to: p.push_token,
        sound: 'default',
        title: 'Hafta sonu planın hazır mı? 🗓️',
        body: `${p.city}'de ${count} yeni aile etkinliği seni bekliyor!`,
        data: { type: 'weekly_reminder', city: p.city },
        channelId: 'default',
      };
    });

    try {
      await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(batch),
      });
      sent += batch.length;
    } catch (err) {
      console.error('[weekly-reminder] Push batch hatası:', (err as Error).message);
    }
  }

  return json({ success: true, sent, cities: cityCount });
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
