/**
 * Google Geocoding API tabanlı adres → koordinat çevirici.
 * API Key: EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ortam değişkeninden okunur.
 * Docs: https://developers.google.com/maps/documentation/geocoding
 */

const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_PLACES_AUTOCOMPLETE_URL = 'https://maps.googleapis.com/maps/api/place/autocomplete/json';
const GOOGLE_PLACE_DETAILS_URL = 'https://maps.googleapis.com/maps/api/place/details/json';
const API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

/**
 * Adres metnini koordinata çevirir.
 * @param {string} locationDetail  - "Moda Sahili, Kadıköy" gibi serbest metin
 * @param {string} city            - "İstanbul" gibi şehir adı
 * @returns {Promise<{latitude: number, longitude: number, addressComponents: Array} | null>}
 */
export async function geocodeAddress(locationDetail, city) {
  const query = [locationDetail, city, 'Türkiye'].filter(Boolean).join(', ');
  return (await _geocode(query)) ?? (await geocodeCity(city));
}

/**
 * Kullanıcı yazarken canlı adres önerileri döner (Google Places Autocomplete).
 * @param {string} query - kullanıcının o ana kadar yazdığı metin
 * @param {string} [city] - varsa şehir, öneriler o bölgeye ağırlıklandırılır
 * @returns {Promise<Array<{placeId: string, description: string}>>}
 */
export async function getPlaceSuggestions(query, city) {
  if (!API_KEY || !query || query.trim().length < 3) return [];
  try {
    const url = new URL(GOOGLE_PLACES_AUTOCOMPLETE_URL);
    url.searchParams.set('input', query);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', 'tr');
    url.searchParams.set('components', 'country:tr');

    // Şehir metnini input'a eklemek yerine gerçek konum ağırlığı veriyoruz —
    // sonuçlar rastgele sırayla değil, şehir merkezine yakınlığa göre gelir
    const cityCoords = await getCityCoords(city);
    if (cityCoords) {
      url.searchParams.set('locationbias', `circle:20000@${cityCoords.latitude},${cityCoords.longitude}`);
    }

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const data = await res.json();
    if (data.status !== 'OK' || !data.predictions?.length) return [];

    return data.predictions.map((p) => ({ placeId: p.place_id, description: p.description }));
  } catch (err) {
    if (__DEV__) console.warn('[geocoding] Öneri hatası:', err.message);
    return [];
  }
}

/**
 * Seçilen öneri için tam adres + koordinat + adres bileşenlerini getirir.
 * @param {string} placeId
 * @returns {Promise<{latitude: number, longitude: number, formattedAddress: string, addressComponents: Array} | null>}
 */
export async function getPlaceDetails(placeId) {
  if (!API_KEY || !placeId) return null;
  try {
    const url = new URL(GOOGLE_PLACE_DETAILS_URL);
    url.searchParams.set('place_id', placeId);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', 'tr');
    url.searchParams.set('fields', 'formatted_address,geometry,address_component');

    const res = await fetch(url.toString());
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.result) return null;

    const { lat, lng } = data.result.geometry.location;
    return {
      latitude: lat,
      longitude: lng,
      formattedAddress: data.result.formatted_address ?? '',
      addressComponents: data.result.address_components ?? [],
    };
  } catch (err) {
    if (__DEV__) console.warn('[geocoding] Place details hatası:', err.message);
    return null;
  }
}

/**
 * Adres bileşenlerinden herkese açık, kaba (mahalle/ilçe seviyesi) konum
 * çıkarır. Bulamazsa şehre düşer — tam adresi asla içermez.
 *
 * Öncelik: mahalle/semt (en detaylı) → ilçe → şehir. Google'ın Türkiye'deki
 * geocoding'i mahalleyi tutarsız etiketliyor — bazen `neighborhood`/
 * `sublocality`, çoğunlukla (özellikle Ankara/İzmir'de) Türkiye'nin idari
 * hiyerarşisine uygun şekilde `administrative_area_level_4` (il→ilçe→mahalle
 * = level_1→level_2→level_4) olarak geliyor; gerçek adreslerle doğrulandı.
 * Bu tip eklenmeden önce mahalle bilgisi hiç yakalanamıyor, direkt "Ankara"
 * gibi tek başına şehir adına düşülüyordu — ilçe fallback'iyle en kötü
 * ihtimalle "Çankaya, Ankara" gibi bir sonuç çıkıyor.
 * @param {Array} addressComponents - Google'ın address_components dizisi
 * @param {string} city - fallback
 * @returns {string}
 */
export function extractRoughLocation(addressComponents, city) {
  if (!addressComponents?.length) return city ?? '';
  const types = ['neighborhood', 'sublocality', 'sublocality_level_1', 'administrative_area_level_4', 'administrative_area_level_2'];
  for (const type of types) {
    const match = addressComponents.find((c) => c.types?.includes(type));
    if (match && match.long_name !== city) return city ? `${match.long_name}, ${city}` : match.long_name;
  }
  return city ?? '';
}

/**
 * Sadece şehir adını koordinata çevirir.
 * @param {string} city
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
export async function geocodeCity(city) {
  if (!city) return null;
  const cached = CITY_COORDS[city];
  if (cached) return cached;
  return _geocode(`${city}, Türkiye`);
}

/**
 * Şehir adından koordinat döner (önce cache, sonra Google).
 * @param {string} city
 * @returns {Promise<{latitude: number, longitude: number} | null>}
 */
export async function getCityCoords(city) {
  if (!city) return null;
  const cached = CITY_COORDS[city];
  if (cached) return cached;
  return _geocode(`${city}, Türkiye`);
}

// ─── İç yardımcı ─────────────────────────────────────────────────────────────

async function _geocode(address) {
  if (!API_KEY) {
    if (__DEV__) console.warn('[geocoding] EXPO_PUBLIC_GOOGLE_MAPS_API_KEY tanımlı değil.');
    return null;
  }

  try {
    const url = new URL(GOOGLE_GEOCODING_URL);
    url.searchParams.set('address', address);
    url.searchParams.set('key', API_KEY);
    url.searchParams.set('language', 'tr');
    url.searchParams.set('region', 'tr');
    url.searchParams.set('components', 'country:TR');

    const res = await fetch(url.toString());
    if (!res.ok) return null;

    const data = await res.json();

    if (data.status !== 'OK' || !data.results?.length) {
      if (__DEV__) console.warn('[geocoding] Google yanıtı:', data.status, address);
      return null;
    }

    const { lat, lng } = data.results[0].geometry.location;
    return { latitude: lat, longitude: lng, addressComponents: data.results[0].address_components ?? [] };
  } catch (err) {
    if (__DEV__) console.warn('[geocoding] Hata:', err.message);
    return null;
  }
}

// ─── Bilinen şehirler cache ───────────────────────────────────────────────────
// Google API başarısız olursa fallback olarak kullanılır.

export const CITY_COORDS = {
  'Ankara':    { latitude: 39.9334, longitude: 32.8597 },
  'İstanbul':  { latitude: 41.0082, longitude: 28.9784 },
  'İzmir':     { latitude: 38.4192, longitude: 27.1287 },
  'Bursa':     { latitude: 40.1885, longitude: 29.0610 },
  'Antalya':   { latitude: 36.8969, longitude: 30.7133 },
  'Adana':     { latitude: 37.0000, longitude: 35.3213 },
  'Konya':     { latitude: 37.8746, longitude: 32.4932 },
  'Gaziantep': { latitude: 37.0662, longitude: 37.3833 },
  'Kayseri':   { latitude: 38.7312, longitude: 35.4787 },
  'Eskişehir': { latitude: 39.7767, longitude: 30.5206 },
};
