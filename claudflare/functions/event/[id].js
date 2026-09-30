// Marka/mağaza sabitleri — mağaza kayıtları açılınca APP_STORE_URL güncellenecek
const BRAND = 'Mekla';
const SITE_URL = 'https://meklasocial.com';
const APP_SCHEME = 'mekla';
const APP_STORE_URL = 'https://apps.apple.com/tr/app/mekla/id6780237196';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.mekla.app';

export async function onRequestGet(context) {
  const { params, env } = context;
  const eventId = params.id;

  // Basic UUID check to avoid injection
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) {
    return notFound();
  }

  const SUPABASE_URL = env.SUPABASE_URL;
  const SUPABASE_SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

  let event = null;
  let creatorName = 'Organizatör';

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    try {
      const h = {
        apikey: SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      };
      const evRes = await fetch(
        `${SUPABASE_URL}/rest/v1/events?id=eq.${eventId}&select=id,title,event_date,city,location_detail,description,cover_photo_url,category,max_participants,creator_id,status&limit=1`,
        { headers: h }
      );
      const rows = await evRes.json();
      event = rows[0] || null;

      if (event?.creator_id) {
        const profRes = await fetch(
          `${SUPABASE_URL}/rest/v1/profiles?id=eq.${event.creator_id}&select=display_name&limit=1`,
          { headers: h }
        );
        const profs = await profRes.json();
        creatorName = profs[0]?.display_name || 'Organizatör';
      }
    } catch (_) {}
  }

  if (!event || event.status === 'cancelled') {
    return notFound();
  }

  return new Response(buildHtml(event, creatorName, eventId), {
    headers: {
      'Content-Type': 'text/html;charset=UTF-8',
      'Cache-Control': 'public, max-age=60, stale-while-revalidate=300',
    },
  });
}

// ─── helpers ────────────────────────────────────────────────────────────────

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      timeZone: 'Europe/Istanbul',
      day: 'numeric', month: 'long', year: 'numeric',
      weekday: 'long', hour: '2-digit', minute: '2-digit',
    }).format(new Date(iso));
  } catch (_) { return iso; }
}

function notFound() {
  return new Response(
    `<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"><title>Etkinlik bulunamadı — ${BRAND}</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{font-family:-apple-system,sans-serif;background:#f9f9f9;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
.box{background:#fff;border-radius:16px;padding:48px 32px;text-align:center;max-width:360px;box-shadow:0 2px 16px rgba(0,0,0,.06)}
h1{font-size:24px;font-weight:700;color:#1a1a1a;margin-bottom:12px}p{color:#666;font-size:15px;margin-bottom:28px}
a{background:#6C47FF;color:#fff;text-decoration:none;padding:12px 28px;border-radius:100px;font-weight:600;font-size:15px}</style></head>
<body><div class="box"><h1>Etkinlik bulunamadı</h1><p>Bu etkinlik kaldırılmış veya iptal edilmiş olabilir.</p>
<a href="${SITE_URL}">${BRAND}'ya git</a></div></body></html>`,
    { status: 404, headers: { 'Content-Type': 'text/html;charset=UTF-8' } }
  );
}

function buildHtml(event, creatorName, eventId) {
  const title = esc(event.title);
  const date = esc(formatDate(event.event_date));
  const location = esc(event.location_detail || event.city || '');
  const desc = esc(event.description || `${event.city} — ${BRAND} etkinliği`);
  const category = esc(event.category || '');
  const coverImg = event.cover_photo_url ? esc(event.cover_photo_url) : '';
  const creator = esc(creatorName);
  const max = event.max_participants || '';
  const pageUrl = `${SITE_URL}/event/${eventId}`;
  const deepLink = `${APP_SCHEME}://event/${eventId}`;

  const ogImage = coverImg || `${SITE_URL}/og-default.png`;
  const shortDesc = event.description
    ? event.description.slice(0, 120) + (event.description.length > 120 ? '…' : '')
    : `${event.city} · ${formatDate(event.event_date)}`;

  return `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title} — ${BRAND}</title>

  <!-- Open Graph / WhatsApp -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${pageUrl}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${esc(shortDesc)}" />
  ${coverImg ? `<meta property="og:image" content="${coverImg}" />` : `<meta property="og:image" content="${ogImage}" />`}
  <meta property="og:site_name" content="${BRAND}" />

  <!-- Twitter card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${esc(shortDesc)}" />

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

    .category-badge { display: inline-block; background: #f3f0ff; color: #6C47FF; font-size: 12px;
                      font-weight: 600; padding: 4px 12px; border-radius: 100px; margin-bottom: 12px; }

    h1 { font-size: 22px; font-weight: 700; line-height: 1.3; margin-bottom: 20px; }

    .meta-row { display: flex; gap: 8px; align-items: flex-start; margin-bottom: 10px; font-size: 14px; color: #555; }
    .meta-icon { font-size: 16px; flex-shrink: 0; width: 20px; }

    .divider { border: none; border-top: 1px solid #f0f0f0; margin: 20px 0; }

    .desc-title { font-size: 13px; font-weight: 600; color: #999; text-transform: uppercase;
                  letter-spacing: 0.5px; margin-bottom: 8px; }
    .desc-text { font-size: 15px; color: #444; line-height: 1.7; }

    .cta-section { margin-top: 28px; }

    .btn-open { display: block; background: #6C47FF; color: #fff; text-align: center;
                font-size: 16px; font-weight: 700; padding: 16px; border-radius: 100px;
                text-decoration: none; cursor: pointer; border: none; width: 100%;
                transition: background .2s; }
    .btn-open:hover { background: #5235cc; }

    .download-section { display: none; margin-top: 16px; text-align: center; }
    .download-label { font-size: 13px; color: #aaa; margin-bottom: 12px; }
    .store-buttons { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; }
    .btn-store { display: inline-block; background: #1a1a1a; color: #fff; text-decoration: none;
                 padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600;
                 transition: opacity .2s; }
    .btn-store:hover { opacity: .8; }
    .btn-store.secondary { background: #f0f0f0; color: #333; }

    .creator-row { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #888; margin-top: 20px; }

    footer { text-align: center; padding: 24px; font-size: 12px; color: #bbb; }
    footer a { color: #6C47FF; text-decoration: none; }

    @media (min-width: 600px) {
      .card { margin-top: -40px; padding: 36px; }
      h1 { font-size: 26px; }
    }
  </style>
</head>
<body>

  <header>
    <a href="${SITE_URL}" class="header-logo">mekla</a>
  </header>

  ${coverImg ? `<img class="cover" src="${coverImg}" alt="${title}" />` : '<div style="height:8px;background:#6C47FF"></div>'}

  <div class="container">
    <div class="card">
      ${category ? `<span class="category-badge">${category}</span>` : ''}
      <h1>${title}</h1>

      <div class="meta-row"><span class="meta-icon">📅</span><span>${date}</span></div>
      <div class="meta-row"><span class="meta-icon">📍</span><span>${location}</span></div>
      ${max ? `<div class="meta-row"><span class="meta-icon">👥</span><span>Maks. ${max} kişi</span></div>` : ''}

      ${desc && desc !== esc(event.city + ` — ${BRAND} etkinliği`) ? `
      <hr class="divider" />
      <p class="desc-title">Hakkında</p>
      <p class="desc-text">${desc}</p>
      ` : ''}

      <div class="cta-section">
        <button class="btn-open" id="openBtn">Uygulamada Aç</button>

        <div class="download-section" id="downloadSection">
          <p class="download-label">${BRAND} uygulaması yüklü değil mi?</p>
          <div class="store-buttons">
            <a href="${APP_STORE_URL}" class="btn-store">App Store</a>
            <a href="${PLAY_STORE_URL}" class="btn-store secondary">Google Play</a>
          </div>
        </div>
      </div>

      <p class="creator-row">Organizatör: <strong>${creator}</strong></p>
    </div>
  </div>

  <footer>
    <a href="${SITE_URL}">meklasocial.com</a> &nbsp;·&nbsp;
    <a href="${SITE_URL}/privacy-policy">Gizlilik</a> &nbsp;·&nbsp;
    <a href="${SITE_URL}/kullanim-kosullari">Koşullar</a>
  </footer>

  <script>
    const DEEP_LINK = '${deepLink}';
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    const btn = document.getElementById('openBtn');
    const dl = document.getElementById('downloadSection');

    function tryOpen() {
      const t = Date.now();
      window.location = DEEP_LINK;
      const check = setInterval(function () {
        if (Date.now() - t > 2200) {
          clearInterval(check);
          if (!document.hidden) dl.style.display = 'block';
        }
      }, 100);
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) clearInterval(check);
      }, { once: true });
    }

    btn.addEventListener('click', tryOpen);

    if (!isMobile) {
      btn.style.display = 'none';
      dl.style.display = 'block';
    }
  </script>
</body>
</html>`;
}
