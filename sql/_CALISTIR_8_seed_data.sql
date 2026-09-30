-- ============================================================
-- MEYDAN LAUNCH SEED DATA — İstanbul & Ankara
-- Çalıştırmadan önce: BURAYA_KENDI_USER_UUID'yi değiştir
-- Bulmak için: Supabase → Authentication → Users → senin satırın → UUID sütunu
-- ============================================================

DO $$
DECLARE
  creator UUID := 'BURAYA_KENDI_USER_UUID'; -- ← DEĞİŞTİR

BEGIN

-- ============================================================
-- 1. TOPLULUKLAR (8 adet)
-- ============================================================

INSERT INTO communities (name, description, icon) VALUES
  ('Doğa & Piknik Aileleri',   'Hafta sonları doğaya çıkmak, piknik yapmak ve çocuklarla macera yaşamak isteyen aileler.', '🏕️'),
  ('Kahve & Sohbet',           'Benzer yaşam evresindeki çiftlerin şehrin en güzel kafelerinde buluştuğu topluluk.', '☕'),
  ('Çocuklu Çiftler',          'Çocuğuyla sosyal hayatı dengeleyen, yeni ailelerle tanışmak isteyen çiftler.', '👨‍👩‍👧‍👦'),
  ('Film & Dizi Kulübü',       'Birlikte film izleyip tartışmak, ev sineması gecesi düzenlemek isteyen aileler.', '🎬'),
  ('Spor & Aktif Yaşam',       'Koşu, yürüyüş, bisiklet — aktif olmayı sevenler için buluşma noktası.', '🏃'),
  ('Yemek & Sofra Keyfi',      'Ev yemekleri, potluck buluşmalar ve restoran keşifleri için aileler.', '🍱'),
  ('Küçük Çocuk & Oyun Grubu', '0–6 yaş çocuğu olan aileler için oyun grupları, deneyim paylaşımı ve destek.', '🍼'),
  ('Sanat & Kültür',           'Müze gezileri, sanat atölyeleri ve kültürel etkinliklere birlikte katılmak isteyenler.', '🎨')
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- 2. ETKİNLİKLER — İSTANBUL (5 adet)
-- ============================================================

INSERT INTO events (
  creator_id, title, description, category,
  city, location_detail, event_date,
  max_participants, payment_type, status
) VALUES

(creator,
 'Belgrad Ormanı Sabah Yürüyüşü',
 'İstanbul''un ciğerlerinde ailece bir sabah yürüyüşü. Tempo ağır, çocuklar dahil herkes katılabilir. Yürüyüş sonrası orman kafesinde kahve molası.',
 'Doğa', 'İstanbul',
 'Belgrad Ormanı Ana Giriş, Sarıyer',
 NOW() + INTERVAL '10 days', 8, 'free', 'open'),

(creator,
 'Karaköy Kahve Turu',
 'Karaköy''ün gözde spesiyalte kafelerini birlikte geziyoruz. 3 kafe, 3 saat, yeni dostluklar. Çocuk arabası uyumlu güzergah.',
 'Sosyal', 'İstanbul',
 'Karaköy Meydanı (Galata Köprüsü yanı)',
 NOW() + INTERVAL '7 days', 6, 'free', 'open'),

(creator,
 'Moda Sahili Brunch',
 'Kadıköy Moda''da açık hava brunch! Çocuklar oyun alanında koşarken büyükler tanışıyor. 4–10 yaş için küçük etkinlikler hazırlanacak.',
 'Yemek', 'İstanbul',
 'Moda Sahili Parkı, Kadıköy',
 NOW() + INTERVAL '14 days', 10, 'free', 'open'),

(creator,
 'Polonezköy Aile Pikniği',
 'Polonezköy Tabiat Parkı''nda potluck piknik. Herkes bir şey getirir, hep birlikte yeniriz. Doğa içinde çocukların özgürce koşturabileceği geniş alan.',
 'Piknik', 'İstanbul',
 'Polonezköy Tabiat Parkı, Beykoz',
 NOW() + INTERVAL '21 days', 12, 'free', 'open'),

(creator,
 'İstanbul Modern Müze Gezisi',
 'Galataport''taki İstanbul Modern''de birlikte sanat deneyimi. Çocuklar için interaktif bölümler mevcut. Tur sonrası müze kafesinde buluşacağız.',
 'Kültür', 'İstanbul',
 'İstanbul Modern, Galataport, Beyoğlu',
 NOW() + INTERVAL '18 days', 8, 'free', 'open'),

-- ============================================================
-- 3. ETKİNLİKLER — ANKARA (4 adet)
-- ============================================================

(creator,
 'Eymir Gölü Yürüyüşü',
 'Ankara''nın en güzel doğa noktalarından Eymir Gölü çevresinde aile yürüyüşü. Göl kenarında piknik yapacağız, çocuklar için ideal.',
 'Doğa', 'Ankara',
 'Eymir Gölü, Gölbaşı',
 NOW() + INTERVAL '9 days', 8, 'free', 'open'),

(creator,
 'Tunalı Kahve Buluşması',
 'Ankara''nın kalbinde, Tunalı Hilmi''nin en sevilen kafelerinden birinde tanışma buluşması. Çiftler ve aileler için rahat bir sohbet ortamı.',
 'Sosyal', 'Ankara',
 'Tunalı Hilmi Caddesi (buluşma noktası katılım sonrası)',
 NOW() + INTERVAL '6 days', 6, 'free', 'open'),

(creator,
 'Seğmenler Parkı Aile Günü',
 'Seğmenler''de açık hava etkinliği. Çocuklar için mini oyunlar, büyükler için sohbet alanı. Herkes bir atıştırmalık getirir.',
 'Piknik', 'Ankara',
 'Seğmenler Parkı, Çankaya',
 NOW() + INTERVAL '16 days', 10, 'free', 'open'),

(creator,
 'CerModern Sanat Turu',
 'CerModern''de birlikte sergi gezisi. Ankara''nın en prestijli çağdaş sanat mekanında ailece kültür keyfi. Çocuklar için de ilgi çekici eserler mevcut.',
 'Kültür', 'Ankara',
 'CerModern Sanat Merkezi, Altındağ',
 NOW() + INTERVAL '20 days', 8, 'free', 'open');

-- ============================================================
RAISE NOTICE '✅ Topluluklar ve etkinlikler eklendi!';

END $$;
