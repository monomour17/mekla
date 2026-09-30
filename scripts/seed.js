/**
 * Meydan — Seed Script
 * =====================
 * Launch öncesi Supabase'e temel içerikleri yükler:
 *   - 8 topluluk (Ankara)
 *   - 10 etkinlik (launch + 7..21 gün arası)
 *   - 5 seed post (moment / notice)
 *
 * KULLANIM:
 *   1. .env dosyasını proje köküne oluştur:
 *        SUPABASE_URL=https://xxxx.supabase.co
 *        SUPABASE_SERVICE_KEY=service_role_key_buraya
 *        SEED_ORGANIZER_ID=admin_user_uuid_buraya   ← Supabase'de mevcut bir kullanıcı
 *
 *   2. Çalıştır:
 *        node scripts/seed.js
 *
 * NOT: SUPABASE_SERVICE_KEY service role key'dir — RLS'yi bypass eder.
 *      Bu key'i asla client tarafında kullanma, sadece bu script için kullan.
 */

// .env dosyasını manuel oku (dotenv paketi gerekmez)
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
  console.error('❌ Eksik env değişkeni! .env dosyasını kontrol et:');
  console.error('   SUPABASE_URL (veya EXPO_PUBLIC_SUPABASE_URL), SUPABASE_SERVICE_KEY, SEED_ORGANIZER_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ── Topluluklar ──────────────────────────────────────────────────────────────

const COMMUNITIES = [
  {
    name: 'Çankaya Oyun Grubu',
    icon: '🧸',
    description: 'Çankaya\'daki 0–8 yaş arası çocuklu ailelerin haftalık buluşma yeri. Her pazar sabahı farklı bir parkta toplanıyoruz.',
  },
  {
    name: 'Ankara Küçük Kaşifler',
    icon: '🌿',
    description: 'Ankara çevresinde doğa yürüyüşleri ve piknikler. Çocuklarla birlikte doğayı keşfetmek isteyenler için.',
  },
  {
    name: 'Ankara Çiftler Kulübü',
    icon: '🥂',
    description: 'Çocuksuz ya da babysitta bırakarak gelen çiftlerin akşam etkinlikleri. Haftada bir buluşuyoruz.',
  },
  {
    name: 'Bahçelievler Kahvaltı Çevresi',
    icon: '☕',
    description: 'Hafta sonu sabah kahvaltı buluşmaları. Farklı semtlerden aileleri Bahçelievler\'de bir araya getiriyoruz.',
  },
  {
    name: 'Ankara Aile Kampçıları',
    icon: '🏕️',
    description: 'Aylık kamp ve piknik organizasyonları. Eymir, Soğuksu, Kızılcahamam başlıca lokasyonlarımız.',
  },
  {
    name: 'Ankara Anneler Çevresi',
    icon: '👩',
    description: 'Annelerin kendi buluşmaları, çocuksuz saatler. Çay, kahve, sohbet — haftada bir nefes al.',
  },
  {
    name: 'Hafta Sonu Babalar',
    icon: '👨',
    description: 'Babaların çocuklarıyla birlikte yaptığı aktiviteler. Futbol, bisiklet, doğa yürüyüşü ve daha fazlası.',
  },
  {
    name: 'Dikmen & Botanik Yürüyüşçüleri',
    icon: '🌳',
    description: 'Ankara\'nın yeşil koridorlarında yürüyüş grupları. Dikmen Vadisi ve Botanik Parkı başlangıç noktamız.',
  },
];

// ── Etkinlikler ──────────────────────────────────────────────────────────────

/**
 * Launch tarihine göre gün ekleyerek ISO tarih döner.
 * Tüm etkinlikler sabah 10:00 olarak ayarlanır.
 */
function launchPlus(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

const EVENTS_SEED = [
  {
    title: 'Seğmenler Pazar Kahvaltısı',
    description:
      'Seğmenler Parkı\'nda güzel bir pazar kahvaltısı. Her aile kendi kahvaltılığını getirir, birlikte piknik masası kurarız. Çocuklar oynasın, biz sohbet edelim.',
    event_date: launchPlus(7, 9, 30),
    city: 'Ankara',
    location_detail: 'Seğmenler Parkı, Çankaya, Ankara',
    latitude: 39.9032,
    longitude: 32.8532,
    max_participants: 6,
    status: 'open',
    payment_type: 'free',
    category: '🥂 Çift Buluşması',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['couple', 'family', 'both'],
    requires_children: false,
  },
  {
    title: 'Küçük Kaşifler Botanik Pikniği',
    description:
      'Botanik Parkı\'nda sabah pikniği. 3–8 yaş arası çocuklar için mükemmel keşif alanı. Böcek gözlemleme, çiçek toplama, doğa defteri tutma gibi aktiviteler yapacağız.',
    event_date: launchPlus(8, 10, 0),
    city: 'Ankara',
    location_detail: 'Ankara Botanik Parkı, Keçiören',
    latitude: 39.9825,
    longitude: 32.8597,
    max_participants: 8,
    status: 'open',
    payment_type: 'free',
    category: '🧸 Oyun Grubu',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: true,
  },
  {
    title: 'Eymir\'de Gün Batımı Yürüyüşü',
    description:
      'Eymir Gölü çevresinde gün batımı yürüyüşü. Yaklaşık 5 km\'lik hafif parkur. Çocuklarla da yapılabilir. Yürüyüş sonrası göl kenarında oturma.',
    event_date: launchPlus(9, 17, 30),
    city: 'Ankara',
    location_detail: 'Eymir Gölü, ODTÜ Ormanı girişi',
    latitude: 39.8612,
    longitude: 32.7857,
    max_participants: 8,
    status: 'open',
    payment_type: 'free',
    category: '🌿 Doğa/Kamp',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: false,
  },
  {
    title: 'Bebek & Küçük Çocuk Oyun Günü',
    description:
      '0–3 yaş arası bebekler ve küçük çocuklar için oyun günü. Abdi İpekçi Parkı\'nın kapalı oyun alanında buluşuyoruz. Anneler ve babalar çay eşliğinde sohbet edebilir.',
    event_date: launchPlus(10, 10, 30),
    city: 'Ankara',
    location_detail: 'Abdi İpekçi Parkı, Tandoğan, Çankaya',
    latitude: 39.9253,
    longitude: 32.8413,
    max_participants: 6,
    status: 'open',
    payment_type: 'free',
    category: '🧸 Oyun Grubu',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: true,
  },
  {
    title: 'Çiftler Akşam Yemeği — Çankaya',
    description:
      'Çankaya\'da küçük bir restoranda çiftler akşam yemeği. 3 çift maksimum — samimi bir ortam için. Yer kesinleşince paylaşılacak.',
    event_date: launchPlus(12, 19, 30),
    city: 'Ankara',
    location_detail: 'Çankaya, Ankara (yer kesinleşince paylaşılacak)',
    latitude: 39.9032,
    longitude: 32.8632,
    max_participants: 6,
    status: 'open',
    payment_type: 'dutch',
    category: '🥂 Çift Buluşması',
    allowed_account_types: ['couple'],
    allowed_looking_for: ['couple', 'both'],
    requires_children: false,
  },
  {
    title: 'Aile Kamp Hazırlık Toplantısı',
    description:
      'Yaz kampı için planlama toplantısı. Lokasyon, tarih, ekipman listesi ve sorumlulukları birlikte belirleyeceğiz. Online veya Çankaya\'da bir kafede.',
    event_date: launchPlus(14, 19, 0),
    city: 'Ankara',
    location_detail: 'Çankaya, Ankara (online alternatif mevcut)',
    latitude: 39.9032,
    longitude: 32.8632,
    max_participants: 8,
    status: 'open',
    payment_type: 'free',
    category: '🏕️ Doğa/Kamp',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: false,
  },
  {
    title: 'Babalar & Çocuklar Futbol Günü',
    description:
      'Altınpark\'ta babalar ve çocuklar halı saha maçı. Her yaştan çocuk katılabilir. Amaç rekabet değil, birlikte eğlenmek. Sonrasında park yürüyüşü.',
    event_date: launchPlus(14, 10, 0),
    city: 'Ankara',
    location_detail: 'Altınpark, Yenimahalle, Ankara',
    latitude: 39.9717,
    longitude: 32.7993,
    max_participants: 8,
    status: 'open',
    payment_type: 'free',
    category: '👨 Sadece Babalar',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: true,
  },
  {
    title: 'Sadece Anneler Brunch',
    description:
      'Çocuklar babada, anneler buluşuyor! Kızılay yakınlarında rahat bir kafede brunch. Konuşmak, dinlenmek ve nefes almak için.',
    event_date: launchPlus(15, 11, 0),
    city: 'Ankara',
    location_detail: 'Kızılay / Çankaya, Ankara (yer onay sonrası paylaşılır)',
    latitude: 39.9208,
    longitude: 32.8541,
    max_participants: 6,
    status: 'open',
    payment_type: 'dutch',
    category: '👩 Sadece Anneler',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: false,
  },
  {
    title: 'Dikmen Vadisi Sabah Yürüyüşü',
    description:
      'Dikmen Vadisi\'nde erken sabah yürüyüşü. Yaklaşık 4 km, hafif tempo. Sonrasında vadi kenarında çay. Çocuklarla da yapılabilir.',
    event_date: launchPlus(17, 8, 0),
    city: 'Ankara',
    location_detail: 'Dikmen Vadisi, Giriş Noktası, Çankaya',
    latitude: 39.8973,
    longitude: 32.8641,
    max_participants: 8,
    status: 'open',
    payment_type: 'free',
    category: '🌳 Doğa/Kamp',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'couple', 'both'],
    requires_children: false,
  },
  {
    title: 'Çankaya Oyun Grubu — Haftalık Buluşma',
    description:
      'Her pazar sabahı buluşuyoruz. Bu hafta Kuğulu Park. Çocuklar için bol alan, ebeveynler için sohbet. 0–8 yaş arası tüm çocuklara açık.',
    event_date: launchPlus(21, 10, 0),
    city: 'Ankara',
    location_detail: 'Kuğulu Park, Çankaya, Ankara',
    latitude: 39.9097,
    longitude: 32.8659,
    max_participants: 8,
    status: 'open',
    payment_type: 'free',
    category: '🧸 Oyun Grubu',
    allowed_account_types: ['couple', 'individual'],
    allowed_looking_for: ['family', 'both'],
    requires_children: true,
  },
];

// ── Seed Postlar ─────────────────────────────────────────────────────────────

function buildPosts(communityIds) {
  // communityIds: { [name]: id }
  const oyunGrubu = communityIds['Çankaya Oyun Grubu'];
  const ciftler = communityIds['Ankara Çiftler Kulübü'];
  const kampcilar = communityIds['Ankara Aile Kampçıları'];

  return [
    {
      author_id: ORGANIZER_ID,
      post_type: 'moment',
      content:
        'Geçen pazar Seğmenler\'de harika bir buluşmaydı 🧡 Çocuklar birbirini buldu, biz de sohbet ettik. Sıradaki buluşmada görüşmek üzere!',
      community_id: oyunGrubu,
      location_text: 'Seğmenler Parkı, Ankara',
    },
    {
      author_id: ORGANIZER_ID,
      post_type: 'notice',
      content:
        '📢 Botanik pikniğine 2 aile daha arıyoruz! Önümüzdeki Cumartesi sabahı 10:00\'da Botanik Parkı\'nda. Çocuğunuzla geliyorsanız katılın 🌿',
      community_id: oyunGrubu,
      location_text: 'Botanik Parkı, Ankara',
    },
    {
      author_id: ORGANIZER_ID,
      post_type: 'moment',
      content:
        'Çiftler akşam yemeği serisi başlıyor ✨ Küçük gruplarla, samimi bir ortamda yeni çiftlerle tanışmak için harika bir format. İlk buluşma çok güzel geçti!',
      community_id: ciftler,
      location_text: 'Çankaya, Ankara',
    },
    {
      author_id: ORGANIZER_ID,
      post_type: 'notice',
      content:
        '🏕️ Yaz kamp planlaması başlıyor! Eymir veya Soğuksu Milli Parkı için yer tutmak istiyoruz. Katılmak isteyen aileler yorum atsın, tarih seçelim.',
      community_id: kampcilar,
      location_text: 'Ankara',
    },
    {
      author_id: ORGANIZER_ID,
      post_type: 'moment',
      content:
        'Meydan\'a hoş geldiniz 👋 Aileler ve çiftler için güvenli buluşma alanı artık Ankara\'da. İlk etkinliklerimiz hazır — keşfedin, başvurun, tanışın!',
      community_id: null,
      location_text: 'Ankara',
    },
  ];
}

// ── Ana Fonksiyon ─────────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Meydan Seed Başlıyor...\n');
  console.log(`   Organizer ID: ${ORGANIZER_ID}`);
  console.log(`   Supabase URL: ${SUPABASE_URL}\n`);

  // ── 1. Topluluklar ──────────────────────────────────────────────────────
  console.log('📦 1/3 Topluluklar ekleniyor...');
  const { data: communities, error: commErr } = await supabase
    .from('communities')
    .upsert(COMMUNITIES, { onConflict: 'name' })
    .select('id, name');

  if (commErr) {
    console.error('❌ Topluluk hatası:', commErr.message);
    process.exit(1);
  }
  console.log(`✅ ${communities.length} topluluk eklendi:`);
  communities.forEach((c) => console.log(`   • ${c.name} (${c.id})`));

  // ── 2. Etkinlikler ─────────────────────────────────────────────────────
  console.log('\n📅 2/3 Etkinlikler ekleniyor...');
  const eventsWithOrganizer = EVENTS_SEED.map((e) => ({
    ...e,
    creator_id: ORGANIZER_ID,
  }));

  const { data: events, error: evErr } = await supabase
    .from('events')
    .insert(eventsWithOrganizer)
    .select('id, title, event_date');

  if (evErr) {
    console.error('❌ Etkinlik hatası:', evErr.message);
    process.exit(1);
  }
  console.log(`✅ ${events.length} etkinlik eklendi:`);
  events.forEach((e) => {
    const date = new Date(e.event_date).toLocaleDateString('tr-TR', {
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit',
    });
    console.log(`   • ${e.title} (${date})`);
  });

  // ── 3. Postlar ─────────────────────────────────────────────────────────
  console.log('\n📝 3/3 Seed postlar ekleniyor...');
  const communityMap = Object.fromEntries(communities.map((c) => [c.name, c.id]));
  const posts = buildPosts(communityMap);

  const { data: insertedPosts, error: postsErr } = await supabase
    .from('posts')
    .insert(posts)
    .select('id, post_type, content');

  if (postsErr) {
    console.error('❌ Post hatası:', postsErr.message);
    process.exit(1);
  }
  console.log(`✅ ${insertedPosts.length} seed post eklendi:`);
  insertedPosts.forEach((p) => {
    console.log(`   • [${p.post_type}] ${p.content.slice(0, 60)}...`);
  });

  // ── Özet ───────────────────────────────────────────────────────────────
  console.log('\n🎉 Seed tamamlandı!\n');
  console.log('┌─────────────────────────────────────┐');
  console.log(`│  Topluluklar : ${String(communities.length).padEnd(20)}│`);
  console.log(`│  Etkinlikler : ${String(events.length).padEnd(20)}│`);
  console.log(`│  Postlar     : ${String(insertedPosts.length).padEnd(20)}│`);
  console.log('└─────────────────────────────────────┘');
  console.log('\n✅ Sonraki adım: beta kullanıcıları davet et ve ilk etkinliğe 2-3 katılımcı ekle.');
}

seed().catch((err) => {
  console.error('\n💥 Beklenmedik hata:', err.message);
  process.exit(1);
});
