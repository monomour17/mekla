/**
 * Meydan — Şehir Etkinlik Seed'i (Ankara + Sivas)
 * ===============================================
 * Uygulamayı demo/test için doldurmak üzere GELECEK tarihli etkinlikler ekler.
 * Sadece `events` tablosuna yazar (topluluk/post'a dokunmaz).
 *
 * Discover filtresi (useDiscoverEventsQuery) ile uyumlu olması için:
 *   - event_date  → gelecekte (gte now)
 *   - city        → kullanıcının şehriyle eşleşmeli (Ankara / Sivas)
 *   - category    → CreateEventScreen'deki geçerli kategori değerleri
 *   - allowed_account_types / allowed_looking_for → geniş tutuldu (çoğu profil görsün)
 *
 * KULLANIM:  node scripts/seed_events.js
 *   .env içinde gerekli: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, SEED_ORGANIZER_ID
 */

const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    });
}

const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const ORGANIZER_ID = process.env.SEED_ORGANIZER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !ORGANIZER_ID) {
  console.error('❌ Eksik env değişkeni! .env: EXPO_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_KEY, SEED_ORGANIZER_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// Bugünden N gün sonrası, verilen saat/dakika ile ISO döner
function inDays(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Geniş uygunluk kısayolları
const ALL_ACCOUNTS = ['couple', 'individual'];
const ALL_LOOKING = ['family', 'couple', 'both'];
const COUPLE_LOOKING = ['couple', 'both'];
const FAMILY_LOOKING = ['family', 'both'];

// ── ANKARA ───────────────────────────────────────────────────────────────────
const ANKARA = [
  {
    title: 'Seğmenler Pazar Kahvaltısı',
    description: 'Seğmenler Parkı\'nda ailece pazar kahvaltısı. Herkes kahvaltılığını getirir, birlikte sofra kurarız. Çocuklar oynarken biz sohbet ederiz.',
    event_date: inDays(3, 9, 30),
    location_detail: 'Seğmenler Parkı, Çankaya', latitude: 39.9032, longitude: 32.8532,
    category: '👨‍👩‍👧 Aile Etkinliği', payment_type: 'free', max_participants: 8,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Kuğulu Park Oyun Grubu',
    description: 'Her hafta buluşan oyun grubumuz bu kez Kuğulu Park\'ta. 0–8 yaş çocuklara bol alan, ebeveynlere sohbet. Kahveler bizden!',
    event_date: inDays(5, 10, 0),
    location_detail: 'Kuğulu Park, Çankaya', latitude: 39.9097, longitude: 32.8659,
    category: '🧸 Oyun Grubu', payment_type: 'free', max_participants: 8,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: FAMILY_LOOKING, requires_children: false,
  },
  {
    title: 'Eymir Gölü Gün Batımı Yürüyüşü',
    description: 'Eymir Gölü çevresinde gün batımına karşı hafif tempolu yürüyüş (~5 km). Çocuklarla da yapılabilir. Yürüyüş sonrası göl kenarında çay.',
    event_date: inDays(6, 18, 0),
    location_detail: 'Eymir Gölü, ODTÜ Ormanı girişi', latitude: 39.8612, longitude: 32.7857,
    category: '🏕️ Doğa/Kamp', payment_type: 'free', max_participants: 10,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Çiftler Akşam Yemeği — Çankaya',
    description: 'Çankaya\'da küçük bir restoranda çiftler akşam yemeği. Maksimum 3 çift — samimi bir ortam için. Yer kesinleşince katılımcılara paylaşılır.',
    event_date: inDays(8, 19, 30),
    location_detail: 'Çankaya (yer onay sonrası paylaşılır)', latitude: 39.9032, longitude: 32.8632,
    category: '🍷 Çift Buluşması', payment_type: 'dutch', max_participants: 6,
    allowed_account_types: ['couple'], allowed_looking_for: COUPLE_LOOKING, requires_children: false,
  },
  {
    title: 'Babalar & Çocuklar Futbol Günü',
    description: 'Altınpark\'ta babalar ve çocuklar halı saha keyfi. Amaç rekabet değil birlikte eğlenmek. Her yaştan çocuk katılabilir, sonrasında park yürüyüşü.',
    event_date: inDays(9, 10, 0),
    location_detail: 'Altınpark, Yenimahalle', latitude: 39.9717, longitude: 32.7993,
    category: '👨 Sadece Babalar', payment_type: 'free', max_participants: 8,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: FAMILY_LOOKING, requires_children: false,
  },
  {
    title: 'Anneler Brunch — Kızılay',
    description: 'Çocuklar babada, anneler buluşuyor! Kızılay yakınında rahat bir kafede brunch. Konuşmak, dinlenmek ve nefes almak için.',
    event_date: inDays(11, 11, 0),
    location_detail: 'Kızılay / Çankaya (yer onay sonrası paylaşılır)', latitude: 39.9208, longitude: 32.8541,
    category: '👩 Sadece Anneler', payment_type: 'dutch', max_participants: 6,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: FAMILY_LOOKING, requires_children: false,
  },
  {
    title: 'Dikmen Vadisi Sabah Yürüyüşü',
    description: 'Dikmen Vadisi\'nde erken sabah yürüyüşü (~4 km, hafif tempo). Sonrasında vadi kenarında çay molası. Çocuklarla da uygun.',
    event_date: inDays(13, 8, 30),
    location_detail: 'Dikmen Vadisi, Giriş Noktası, Çankaya', latitude: 39.8973, longitude: 32.8641,
    category: '🏕️ Doğa/Kamp', payment_type: 'free', max_participants: 10,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Tunalı Kahve & Tanışma Buluşması',
    description: 'Tunalı Hilmi\'nin sevilen kafelerinden birinde tanışma buluşması. Çiftler ve aileler için rahat, kalabalık olmayan bir sohbet ortamı.',
    event_date: inDays(16, 16, 0),
    location_detail: 'Tunalı Hilmi Caddesi, Çankaya', latitude: 39.9050, longitude: 32.8570,
    category: '🎉 Diğer', payment_type: 'free', max_participants: 8,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
];

// ── SİVAS ────────────────────────────────────────────────────────────────────
const SIVAS = [
  {
    title: 'Sıcak Çermik Termal Aile Günü',
    description: 'Yıldızeli Sıcak Çermik\'te ailece termal gün. Sıcak havuzların keyfini çıkarıp doğada gün geçiriyoruz. Çocuklar için ideal, rahat bir gün.',
    event_date: inDays(4, 11, 0),
    location_detail: 'Sıcak Çermik Kaplıcaları, Yıldızeli', latitude: 39.8360, longitude: 36.7330,
    category: '🏕️ Doğa/Kamp', payment_type: 'free', max_participants: 10,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Kardeşler Parkı Oyun Günü',
    description: 'Sivas merkezde Kardeşler Parkı\'nda oyun günü. 0–8 yaş çocuklar için bol alan, anne-babalar için çay eşliğinde sohbet köşesi.',
    event_date: inDays(5, 10, 30),
    location_detail: 'Kardeşler Parkı, Sivas Merkez', latitude: 39.7445, longitude: 37.0125,
    category: '🧸 Oyun Grubu', payment_type: 'free', max_participants: 8,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: FAMILY_LOOKING, requires_children: false,
  },
  {
    title: 'Gök Medrese & Tarihi Merkez Turu',
    description: 'Sivas\'ın simgesi Gök Medrese\'den başlayıp tarihi merkezi birlikte geziyoruz. Çocuklar için de ilgi çekici, kısa ve keyifli bir kültür yürüyüşü.',
    event_date: inDays(7, 14, 0),
    location_detail: 'Gök Medrese, Sivas Merkez', latitude: 39.7486, longitude: 37.0156,
    category: '👨‍👩‍👧 Aile Etkinliği', payment_type: 'free', max_participants: 10,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Çiftler Gün Batımı — Sivas Kalesi',
    description: 'Sivas Kalesi (Paşafabrikası) tepesinde gün batımına karşı çiftler buluşması. Şehir manzarası eşliğinde sakin bir akşam. Maksimum birkaç çift.',
    event_date: inDays(8, 18, 30),
    location_detail: 'Sivas Kalesi / Paşafabrikası, Merkez', latitude: 39.7490, longitude: 37.0130,
    category: '🍷 Çift Buluşması', payment_type: 'free', max_participants: 6,
    allowed_account_types: ['couple'], allowed_looking_for: COUPLE_LOOKING, requires_children: false,
  },
  {
    title: 'Tödürge Gölü Doğa Gezisi',
    description: 'Zara yolundaki Tödürge Gölü\'ne doğa gezisi. Göl kenarında yürüyüş ve piknik. Şehirden kısa bir kaçış, aileler ve çiftler için uygun.',
    event_date: inDays(10, 9, 0),
    location_detail: 'Tödürge Gölü, Zara', latitude: 39.8100, longitude: 37.7800,
    category: '🏕️ Doğa/Kamp', payment_type: 'free', max_participants: 12,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Anneler Kahve Buluşması — Merkez',
    description: 'Sivas merkezde anneler kahve buluşması. Çocuksuz birkaç saat, sohbet ve dinlenme için. Yeni tanışmalara da açık, samimi bir ortam.',
    event_date: inDays(12, 15, 0),
    location_detail: 'Sivas Kent Meydanı çevresi, Merkez', latitude: 39.7477, longitude: 37.0179,
    category: '👩 Sadece Anneler', payment_type: 'dutch', max_participants: 6,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: FAMILY_LOOKING, requires_children: false,
  },
  {
    title: 'Kongre Müzesi Kültür Turu',
    description: 'Atatürk Kongre ve Etnografya Müzesi\'nde birlikte tarih turu. Sivas Kongresi\'nin yapıldığı tarihi binada ailece keyifli bir gezi.',
    event_date: inDays(14, 13, 0),
    location_detail: 'Atatürk Kongre ve Etnografya Müzesi, Merkez', latitude: 39.7506, longitude: 37.0144,
    category: '🎉 Diğer', payment_type: 'free', max_participants: 10,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
  {
    title: 'Hafik Gölü Aile Pikniği',
    description: 'Hafik Gölü kıyısında potluck piknik. Herkes bir şey getirir, birlikte yeriz. Göl manzarası ve geniş çimde çocuklar özgürce koştursun.',
    event_date: inDays(17, 11, 0),
    location_detail: 'Hafik Gölü, Hafik', latitude: 39.8500, longitude: 37.4000,
    category: '👨‍👩‍👧 Aile Etkinliği', payment_type: 'free', max_participants: 12,
    allowed_account_types: ALL_ACCOUNTS, allowed_looking_for: ALL_LOOKING, requires_children: false,
  },
];

async function run() {
  console.log('🌱 Şehir etkinlik seed\'i başlıyor (Ankara + Sivas)...\n');
  console.log(`   Organizer ID: ${ORGANIZER_ID}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}\n`);

  const rows = [
    ...ANKARA.map((e) => ({ ...e, city: 'Ankara' })),
    ...SIVAS.map((e) => ({ ...e, city: 'Sivas' })),
  ].map((e) => ({ ...e, creator_id: ORGANIZER_ID, status: 'open' }));

  const { data, error } = await supabase
    .from('events')
    .insert(rows)
    .select('id, title, city, event_date');

  if (error) {
    console.error('❌ Etkinlik ekleme hatası:', error.message);
    process.exit(1);
  }

  const byCity = (c) => data.filter((e) => e.city === c);
  for (const city of ['Ankara', 'Sivas']) {
    const list = byCity(city);
    console.log(`✅ ${city} — ${list.length} etkinlik:`);
    list.forEach((e) => {
      const d = new Date(e.event_date).toLocaleString('tr-TR', {
        day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      });
      console.log(`   • ${e.title} (${d})`);
    });
    console.log('');
  }

  console.log(`🎉 Toplam ${data.length} etkinlik eklendi (hepsi gelecek tarihli, status=open).`);
}

run().catch((err) => {
  console.error('\n💥 Beklenmedik hata:', err.message);
  process.exit(1);
});
