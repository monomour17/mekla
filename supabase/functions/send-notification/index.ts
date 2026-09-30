// Supabase Edge Function: send-notification
// Deploy: supabase functions deploy send-notification
//
// Tetikleyici: notifications tablosuna INSERT → ilgili kullanıcıya push notification gönder
// Supabase Dashboard → Database → Webhooks → notifications INSERT → bu URL'e POST
//
// Payload: { type: "INSERT", record: { user_id, type, title, body, data } }

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

// Bildirim tipine göre notification_prefs anahtarı
const PREF_KEY: Record<string, string> = {
  request_approved:    'request_update',
  request_rejected:    'request_update',
  new_question:        'new_question',
  question_answered:   'new_question',
  event_cancelled:     'request_update',
  event_reminder:      'event_reminder',
  new_participant:     'request_update',
  new_business_event:  'business_events',
  community_post:      'community_post',
  post_became_event:   'community_post',
  system:              'request_update',
};

serve(async (req) => {
  try {
    // ── Güvenlik: paylaşılan secret doğrulaması ────────────────────────────
    // Fonksiyon --no-verify-jwt ile açık olduğundan, yalnızca Supabase
    // Database Webhook'unun (özel header ile) gönderdiği istekler kabul edilir.
    // Kurulum: Dashboard → Database → Webhooks → HTTP Headers →
    //   x-webhook-secret: <NOTIF_WEBHOOK_SECRET ile aynı değer>
    // Secret: supabase secrets set NOTIF_WEBHOOK_SECRET=<rastgele-uzun-değer>
    const expectedSecret = Deno.env.get('NOTIF_WEBHOOK_SECRET');
    if (expectedSecret) {
      const provided = req.headers.get('x-webhook-secret');
      if (provided !== expectedSecret) {
        console.warn('[send-notification] Geçersiz webhook secret — istek reddedildi');
        return new Response(JSON.stringify({ error: 'Yetkisiz' }), { status: 401 });
      }
    } else {
      console.warn('[send-notification] NOTIF_WEBHOOK_SECRET tanımlı değil — doğrulama ATLANDI');
    }

    const payload = await req.json();
    const { type, record } = payload;

    // Sadece INSERT olaylarını işle
    if (type !== 'INSERT') {
      return new Response(JSON.stringify({ skipped: true }), { status: 200 });
    }

    const { user_id, type: notifType, title, body, data } = record;

    if (!user_id || !title) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Eksik alan' }), { status: 200 });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Kullanıcının push token ve bildirim tercihlerini al
    const { data: profile } = await supabase
      .from('profiles')
      .select('push_token, notification_prefs')
      .eq('id', user_id)
      .single();

    if (!profile?.push_token) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Push token yok' }), { status: 200 });
    }

    // Kullanıcı bu bildirim tipini kapatmış mı?
    const prefKey = PREF_KEY[notifType] ?? 'request_update';
    const prefs = profile.notification_prefs ?? {};
    if (prefs[prefKey] === false) {
      return new Response(JSON.stringify({ skipped: true, reason: 'Bildirim kapalı' }), { status: 200 });
    }

    // Expo Push API'ye gönder
    const pushResponse = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
      },
      body: JSON.stringify({
        to: profile.push_token,
        sound: 'default',
        title,
        body: body ?? '',
        data: data ?? {},
        channelId: 'default',
      }),
    });

    const pushResult = await pushResponse.json();

    return new Response(JSON.stringify({ success: true, pushResult }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500 }
    );
  }
});
