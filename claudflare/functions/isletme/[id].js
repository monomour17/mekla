// İşletme profili web önizlemesi — uygulamadan paylaşılan
// https://meklasocial.com/isletme/<id> linklerinin karşılığı.
const BRAND = 'Mekla';
const SITE_URL = 'https://meklasocial.com';
const APP_STORE_URL = 'https://apps.apple.com/tr/app/mekla/id6780237196';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mekla.app';

export async function onRequestGet(context) {
  const { params, env } = context;
  const businessId = params.id;

  if (!/^[0-9a-f-]{36}$/i.test(businessId)) {
    return notFound();
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  let profile = null;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const h = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      };
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/profiles?id=eq.${businessId}&account_type=eq.business&is_active=eq.true&select=id,business_name,display_name,city,bio,photos&limit=1`,
        { headers: h }
      );
      const rows = await res.json();
      profile = rows[0] || null;
    } catch (_) {}
  }

  if (!profile) {
    return notFound();
  }

  return new Response(buildHtml(profile), {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
    },
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function notFound() {
  return new Response(
    `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>İşletme bulunamadı — ${BRAND}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;background:#f9f9f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#fff;border-radius:16px;padding:48px 32px;text-align:center;max-width:360px;box-shadow:0 2px 16px rgba(0,0,0,.06)}
h1{font-size:24px;font-weight:700;color:#1a1a1a;margin-bottom:12px}p{color:#666;font-size:15px;margin-bottom:28px}
a{background:#6C47FF;color:#fff;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:600;font-size:15px}</style></head>
<body><div class="box"><h1>İşletme bulunamadı</h1><p>Bu işletme profili kaldırılmış olabilir.</p>
<a href="${SITE_URL}">${BRAND}'ya git</a></div></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
  );
}

function buildHtml(profile) {
  const name = esc(profile.business_name || profile.display_name || 'İşletme');
  const city = esc(profile.city || '');
  const bio = esc(profile.bio || '');
  const photo = Array.isArray(profile.photos) && profile.photos[0] ? esc(profile.photos[0]) : '';
  const pageUrl = `${SITE_URL}/isletme/${profile.id}`;
  const shortDesc = bio || `${name} — etkinliklerini ve duyurularını ${BRAND}'da takip et.`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${name} — ${BRAND}</title>

  <meta property="og:type" content="profile" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${name}" />
  <meta property="og:description" content="${shortDesc}" />
  ${photo ? `<meta property="og:image" content="${photo}" />` : ''}
  <meta property="og:site_name" content="${BRAND}" />
  <meta name="twitter:card" content="${photo ? 'summary_large_image' : 'summary'}" />
  <meta name="twitter:title" content="${name}" />
  <meta name="twitter:description" content="${shortDesc}" />

  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
           background: #f9f9f9; color: #1a1a1a; min-height: 100vh; }
    header { background: #6C47FF; padding: 16px 24px; }
    .header-logo { font-size: 20px; font-weight: 800; color: #fff; text-decoration: none; letter-spacing: -0.5px; }
    .cover { width: 100%; max-height: 280px; object-fit: cover; display: block; }
    .container { max-width: 580px; margin: 0 auto; padding: 0 20px 48px; }
    .card { background: #fff; border-radius: 16px; padding: 28px; margin-top: -28px;
            position: relative; box-shadow: 0 2px 16px rgba(0,0,0,.08); }
    .badge { display: inline-block; background: #f3f0ff; color: #6C47FF; font-size: 12px;
             font-weight: 600; padding: 4px 12px; border-radius: 100px; margin-bottom: 12px; }
    h1 { font-size: 22px; font-weight: 700; line-height: 1.3; margin-bottom: 8px; }
    .city { font-size: 14px; color: #555; margin-bottom: 16px; }
    .bio { font-size: 15px; color: #444; line-height: 1.7; }
    .cta-section { margin-top: 28px; text-align: center; }
    .download-label { font-size: 13px; color: #aaa; margin-bottom: 12px; }
    .store-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-store { display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none;
                 padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; }
    .btn-store.secondary { background: #f0f0f0; color: #333; }
    footer { text-align: center; padding: 24px; font-size: 12px; color: #bbb; }
    footer a { color: #6C47FF; text-decoration: none; }
  </style>
</head>
<body>
  <header>
    <a href="${SITE_URL}" class="header-logo">mekla</a>
  </header>

  ${photo ? `<img class="cover" src="${photo}" alt="${name}" />` : '<div style="height:8px;background:#6C47FF"></div>'}

  <div class="container">
    <div class="card">
      <span class="badge">İşletme</span>
      <h1>${name}</h1>
      ${city ? `<p class="city">📍 ${city}</p>` : ''}
      ${bio ? `<p class="bio">${bio}</p>` : ''}

      <div class="cta-section">
        <p class="download-label">Etkinliklerini ${BRAND} uygulamasında takip et</p>
        <div class="store-buttons">
          <a href="${APP_STORE_URL}" class="btn-store">App Store</a>
          <a href="${PLAY_STORE_URL}" class="btn-store secondary">Google Play</a>
        </div>
      </div>
    </div>
  </div>

  <footer>
    <a href="${SITE_URL}">meklasocial.com</a> &nbsp;·&nbsp;
    <a href="${SITE_URL}/privacy-policy">Gizlilik</a> &nbsp;·&nbsp;
    <a href="${SITE_URL}/kullanim-kosullari">Koşullar</a>
  </footer>
</body>
</html>`;
}
