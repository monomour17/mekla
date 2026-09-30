// Supabase Edge Function: notify-business-event
// Deploy: supabase functions deploy notify-business-event --no-verify-jwt
//
// Bir işletme etkinlik oluşturduğunda tüm takipçilerine bildirim gönderir.
// Mobil uygulama sadece bu fonksiyonu çağırır — binlerce HTTP isteği
// artık kullanıcının telefonundan değil, sunucudan gönderilir.
//
// Payload: { eventId, businessId, eventTitle, city, locationDetail }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const BATCH_SIZE = 100; // Expo push API batch limit

serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  let body: { eventId: string; businessId: string; eventTitle: string; city: string; locationDetail?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Geçersiz JSON' }, 400);
  }

  const { eventId, businessId, eventTitle, city, locationDetail } = body;
  if (!eventId || !businessId || !eventTitle) {
    return json({ error: 'Eksik alan: eventId, businessId, eventTitle zorunlu' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase    = createClient(supabaseUrl, serviceKey);

  // 0. Güvenlik: çağıran, bildirimi gönderilen işletmenin kendisi olmalı.
  // supabase.functions.invoke() kullanıcı JWT'sini otomatik ekler; URL'i bilen
  // üçüncü kişilerin takipçilere sahte push göndermesini engeller.
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace(/^Bearer\s+/i, '');
  const { data: userData, error: authErr } = await supabase.auth.getUser(jwt);
  if (authErr || !userData?.user) {
    return json({ error: 'Yetkisiz: geçerli oturum gerekli' }, 401);
  }
  if (userData.user.id !== businessId) {
    console.warn(`[notify-business-event] Sahtecilik denemesi: ${userData.user.id} → ${businessId}`);
    return json({ error: 'Yetkisiz: yalnızca kendi işletmen için bildirim gönderebilirsin' }, 403);
  }

  // 1. Takipçileri ve bildirim tercihlerini çek
  const { data: followers, error: fetchErr } = await supabase
    .from('business_follows')
    .select('follower_id, profiles!follower_id(push_token, notification_prefs)')
    .eq('business_id', businessId);

  if (fetchErr) {
    console.error('[notify-business-event] Takipçi çekme hatası:', fetchErr.message);
    return json({ error: fetchErr.message }, 500);
  }

  const eligible = (followers ?? []).filter((f: any) => {
    const prefs = f.profiles?.notification_prefs ?? {};
    return f.profiles?.push_token && prefs.business_events !== false;
  });

  console.log(`[notify-business-event] ${eligible.length} / ${(followers ?? []).length} takipçiye bildirim gönderilecek`);

  // 2. Notifications tablosuna kayıt ekle (uygulama içi bildirimler için)
  const notifInserts = eligible.map((f: any) => ({
    user_id: f.follower_id,
    type: 'new_business_event',
    title: `${eventTitle} — Yeni etkinlik!`,
    body: `${city}${locationDetail ? ' · ' + locationDetail : ''}`,
    data: { eventId, businessId, screen: 'EventDetail' },
  }));

  if (notifInserts.length > 0) {
    const { error: insertErr } = await supabase
      .from('notifications')
      .insert(notifInserts);
    if (insertErr) console.error('[notify-business-event] Notification insert hatası:', insertErr.message);
  }

  // 3. Push bildirimleri batch halinde gönder
  const pushTokens = eligible
    .map((f: any) => f.profiles?.push_token)
    .filter(Boolean);

  let pushSent = 0;
  for (let i = 0; i < pushTokens.length; i += BATCH_SIZE) {
    const batch = pushTokens.slice(i, i + BATCH_SIZE).map((token: string) => ({
      to: token,
      sound: 'default',
      title: `📅 ${eventTitle}`,
      body: `${city}${locationDetail ? ' · ' + locationDetail : ''}`,
      data: { eventId, businessId, type: 'new_business_event', screen: 'EventDetail' },
      channelId: 'default',
    }));

    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(batch),
      });
      const result = await res.json();
      if (__DEV_LOG__) console.log(`[notify-business-event] Batch ${i / BATCH_SIZE + 1}:`, JSON.stringify(result).slice(0, 200));
      pushSent += batch.length;
    } catch (err) {
      console.error('[notify-business-event] Push batch hatası:', (err as Error).message);
    }
  }

  return json({ success: true, followers: eligible.length, pushSent });
});

// Deno ortamında __DEV_LOG__ tanımlanmamış olabilir
const __DEV_LOG__ = true;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
