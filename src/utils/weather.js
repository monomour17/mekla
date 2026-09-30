// Open-Meteo entegrasyonu — API key gerektirmez.
// Geocoding (şehir → koordinat) + günlük tahmin (16 güne kadar).

const GEOCODE_URL = 'https://geocoding-api.open-meteo.com/v1/search';
const FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';

// In-memory cache (oturum süresince) — şehir tekrar tekrar sorulmasın.
const geoCache = new Map();
const forecastCache = new Map();

/**
 * weather_code → { label, icon (Ionicons), tone }
 * Open-Meteo WMO kodlarını basitleştirilmiş Türkçe etiketlere indirger.
 */
export function decodeWeatherCode(code) {
  if (code == null) return { label: 'Bilinmiyor', icon: 'help-circle', tone: 'neutral' };
  if (code === 0) return { label: 'Güneşli', icon: 'sunny', tone: 'good' };
  if ([1, 2].includes(code)) return { label: 'Az bulutlu', icon: 'partly-sunny', tone: 'good' };
  if (code === 3) return { label: 'Bulutlu', icon: 'cloud', tone: 'neutral' };
  if ([45, 48].includes(code)) return { label: 'Sisli', icon: 'cloud-outline', tone: 'neutral' };
  if ([51, 53, 55, 56, 57].includes(code)) return { label: 'Çisenti', icon: 'rainy-outline', tone: 'warn' };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return { label: 'Yağmurlu', icon: 'rainy', tone: 'warn' };
  if ([71, 73, 75, 77, 85, 86].includes(code)) return { label: 'Karlı', icon: 'snow', tone: 'warn' };
  if ([95, 96, 99].includes(code)) return { label: 'Fırtınalı', icon: 'thunderstorm', tone: 'bad' };
  return { label: 'Değişken', icon: 'cloud', tone: 'neutral' };
}

async function geocodeCity(city) {
  const key = city.trim().toLowerCase();
  if (!key) return null;
  if (geoCache.has(key)) return geoCache.get(key);
  try {
    const url = `${GEOCODE_URL}?name=${encodeURIComponent(city)}&count=1&language=tr&format=json`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const hit = json?.results?.[0];
    if (!hit) {
      geoCache.set(key, null);
      return null;
    }
    const coords = { latitude: hit.latitude, longitude: hit.longitude, timezone: hit.timezone };
    geoCache.set(key, coords);
    return coords;
  } catch {
    return null;
  }
}

/**
 * Bir şehir + tarih için günlük hava tahmini döner.
 * @param {string} city
 * @param {string|Date} date - event_date (ISO veya Date)
 * @returns {Promise<null | {
 *   tempMax:number, tempMin:number, precipProb:number,
 *   code:number, label:string, icon:string, tone:string,
 *   tooFar:boolean, daysAhead:number
 * }>}
 */
export async function fetchEventWeather(city, date) {
  if (!city || !date) return null;
  const target = new Date(date);
  if (isNaN(target.getTime())) return null;

  // Tarih aralığı kontrolü
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDay = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const daysAhead = Math.round((targetDay - today) / 86400000);

  if (daysAhead < 0) return null;       // geçmiş
  if (daysAhead > 15) {
    return { tooFar: true, daysAhead };
  }

  const ds = targetDay.toISOString().slice(0, 10); // yyyy-mm-dd
  const cacheKey = `${city.toLowerCase()}|${ds}`;
  if (forecastCache.has(cacheKey)) return forecastCache.get(cacheKey);

  const coords = await geocodeCity(city);
  if (!coords) return null;

  try {
    const params = new URLSearchParams({
      latitude: String(coords.latitude),
      longitude: String(coords.longitude),
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      timezone: coords.timezone || 'auto',
      start_date: ds,
      end_date: ds,
    });
    const res = await fetch(`${FORECAST_URL}?${params.toString()}`);
    if (!res.ok) return null;
    const json = await res.json();
    const d = json?.daily;
    if (!d || !d.time?.length) return null;

    const code = d.weather_code?.[0];
    const decoded = decodeWeatherCode(code);
    const result = {
      tempMax: Math.round(d.temperature_2m_max?.[0] ?? 0),
      tempMin: Math.round(d.temperature_2m_min?.[0] ?? 0),
      precipProb: d.precipitation_probability_max?.[0] ?? 0,
      code,
      ...decoded,
      tooFar: false,
      daysAhead,
    };
    forecastCache.set(cacheKey, result);
    return result;
  } catch {
    return null;
  }
}
