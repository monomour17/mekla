// Supabase Edge Function: send-sms
// Deploy: supabase functions deploy send-sms
//
// Supabase Auth → Send SMS Hook olarak ayarlanır:
//   Dashboard → Authentication → Hooks → Send SMS → bu fonksiyon URL'i
//
// FAZ 1 (Simülasyon): SMS_PROVIDER env var set edilmemişse OTP sadece loglara düşer.
// FAZ 2 (Canlı):      SMS_PROVIDER=netgsm yapıldığında gerçek SMS gönderilir.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

// ─── Tip tanımları ────────────────────────────────────────────────────────────

interface SmsHookPayload {
  user: {
    id: string;
    phone: string;
  };
  sms: {
    otp: string;
  };
}

interface NetgsmConfig {
  username: string;
  password: string;
  header: string; // Gönderici başlık (Alphanumeric Sender ID)
}

// ─── Ana handler ──────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  // Supabase Auth Hook yalnızca POST gönderir
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405);
  }

  const rawBody = await req.text();

  // ── Güvenlik 0: Webhook imza doğrulaması ───────────────────────────────────
  // Fonksiyon --no-verify-jwt ile deploy edildiği için herkes çağırabilir;
  // imza kontrolü sayesinde yalnızca Supabase Auth'un (hook secret ile
  // imzalanmış) istekleri kabul edilir. Secret: Dashboard → Auth → Hooks.
  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET');
  if (hookSecret) {
    try {
      const wh = new Webhook(hookSecret.replace('v1,whsec_', ''));
      wh.verify(rawBody, {
        'webhook-id': req.headers.get('webhook-id') ?? '',
        'webhook-timestamp': req.headers.get('webhook-timestamp') ?? '',
        'webhook-signature': req.headers.get('webhook-signature') ?? '',
      });
    } catch {
      console.warn('[send-sms] Geçersiz webhook imzası — istek reddedildi');
      return jsonResponse({ error: { http_code: 401, message: 'Geçersiz imza' } }, 401);
    }
  } else {
    console.warn('[send-sms] SEND_SMS_HOOK_SECRET tanımlı değil — imza doğrulaması ATLANDI');
  }

  let payload: SmsHookPayload;

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return jsonResponse({ error: 'Geçersiz JSON payload' }, 400);
  }

  const phone = payload?.user?.phone;
  const otp   = payload?.sms?.otp;

  if (!phone || !otp) {
    console.error('[send-sms] Eksik alan — phone:', phone, 'otp:', otp);
    return jsonResponse({ error: 'Eksik alan: phone veya otp yok' }, 400);
  }

  // ── Güvenlik 1: Ülke kodu kısıtı ───────────────────────────────────────────
  // Sadece Türkiye (+90, KKTC dahil) ve Kıbrıs (+357) — SMS toll fraud koruması.
  // Başka ülke açmak gerekirse SMS_ALLOWED_PREFIXES env'ine virgülle ekle.
  const allowedPrefixes = (Deno.env.get('SMS_ALLOWED_PREFIXES') ?? '+90,90,+357,357')
    .split(',')
    .map((p) => p.trim());
  if (!allowedPrefixes.some((p) => phone.startsWith(p))) {
    console.warn('[send-sms] Engellenen ülke kodu:', phone);
    return jsonResponse(
      { error: { http_code: 403, message: 'Bu bölge için SMS doğrulama desteklenmiyor.' } },
      403,
    );
  }

  // ── Güvenlik 2: Telefon başına rate limit ──────────────────────────────────
  // Varsayılan: saatte 3 SMS. Kontrol başarısız olursa (DB hatası) akışı
  // bloklamamak için SMS'e izin verilir (fail-open) ama loglanır.
  const hourlyLimit = Number(Deno.env.get('SMS_HOURLY_LIMIT') ?? '3');
  try {
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count, error: countError } = await admin
      .from('sms_send_log')
      .select('id', { count: 'exact', head: true })
      .eq('phone', phone)
      .gte('sent_at', oneHourAgo);

    if (countError) {
      console.error('[send-sms] Rate limit sorgusu başarısız:', countError.message);
    } else if ((count ?? 0) >= hourlyLimit) {
      console.warn(`[send-sms] Rate limit aşıldı: ${phone} (${count}/${hourlyLimit})`);
      return jsonResponse(
        { error: { http_code: 429, message: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar dene.' } },
        429,
      );
    }

    // Limiti geçmediyse bu gönderimi logla
    const { error: insertError } = await admin.from('sms_send_log').insert({ phone });
    if (insertError) console.error('[send-sms] Log yazılamadı:', insertError.message);
  } catch (err) {
    console.error('[send-sms] Rate limit kontrolü atlandı:', (err as Error).message);
  }

  const provider = Deno.env.get('SMS_PROVIDER') ?? 'simulation';

  // ── FAZ 1: Simülasyon ──────────────────────────────────────────────────────
  if (provider === 'simulation') {
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[send-sms] FAZ 1 — Simülasyon modu');
    console.log(`[send-sms] Telefon : ${phone}`);
    console.log(`[send-sms] OTP Kodu: ${otp}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    return jsonResponse({ success: true, mode: 'simulation' });
  }

  // ── FAZ 2: Netgsm ──────────────────────────────────────────────────────────
  if (provider === 'netgsm') {
    try {
      const result = await sendViaNetgsm(phone, otp);
      return jsonResponse({ success: true, mode: 'netgsm', result });
    } catch (err) {
      console.error('[send-sms] Netgsm hatası:', (err as Error).message);
      // Auth akışını bloklamamak için 200 döndür; hata loglanır
      return jsonResponse({ success: false, error: (err as Error).message });
    }
  }

  // Bilinmeyen sağlayıcı
  console.error('[send-sms] Bilinmeyen SMS_PROVIDER:', provider);
  return jsonResponse({ error: `Bilinmeyen sağlayıcı: ${provider}` }, 500);
});

// ─── Netgsm entegrasyonu ──────────────────────────────────────────────────────

async function sendViaNetgsm(phone: string, otp: string): Promise<string> {
  const cfg: NetgsmConfig = {
    username: requireEnv('NETGSM_USERNAME'),
    password: requireEnv('NETGSM_PASSWORD'),
    header:   requireEnv('NETGSM_HEADER'),
  };

  // Netgsm E.164 formatını (+90...) kabul eder; başındaki + işaretini kaldır
  const gsm = phone.startsWith('+') ? phone.slice(1) : phone;

  const message = `Mekla doğrulama kodunuz: ${otp}`;

  // Netgsm XML API (https://www.netgsm.com.tr/dokuman/#sms-gonder)
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<mainbody>
  <header>
    <company dil="TR">Netgsm</company>
    <usercode>${cfg.username}</usercode>
    <password>${cfg.password}</password>
    <startdate></startdate>
    <stopdate></stopdate>
    <type>1:n</type>
    <msgheader>${cfg.header}</msgheader>
  </header>
  <body>
    <msg><![CDATA[${message}]]></msg>
    <no>${gsm}</no>
  </body>
</mainbody>`;

  const res = await fetch('https://api.netgsm.com.tr/sms/send/xml', {
    method: 'POST',
    headers: { 'Content-Type': 'application/xml; charset=UTF-8' },
    body: xml,
  });

  const responseText = await res.text();
  console.log('[send-sms] Netgsm yanıtı:', responseText);

  // Netgsm başarılı yanıtı "00 <msgid>" şeklinde döner
  if (!responseText.startsWith('00')) {
    throw new Error(`Netgsm API hatası: ${responseText}`);
  }

  return responseText;
}

// ─── Yardımcılar ──────────────────────────────────────────────────────────────

function requireEnv(key: string): string {
  const value = Deno.env.get(key);
  if (!value) throw new Error(`Eksik ortam değişkeni: ${key}`);
  return value;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
