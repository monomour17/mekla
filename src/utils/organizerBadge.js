/**
 * Organizatör rozet hesaplama — merkezi utility.
 *
 * KURAL: Badge eşik değerleri burada tanımlanır.
 * EventDetailScreen, ProfileDetailScreen ve useEventDetail buraya import eder.
 * Threshold değiştirmek istersen yalnızca bu dosyaya dokun.
 */
import { supabase } from '../services/supabase';

// ── Eşik Değerleri ──────────────────────────────────────────────────────────
export const BADGE_MIN_RATING = 4.0;
export const BADGE_MIN_REVIEWS = 3;

/**
 * Verilen ortalama puan + değerlendirme sayısına göre rozet bilgisi döner.
 *
 * @param {number|null} avgRating  - Ortalama puan (null = henüz değerlendirme yok)
 * @param {number}      reviewCount - Toplam değerlendirme sayısı
 * @returns {{ hasBadge: boolean, label: string, icon: string }}
 */
export function calculateOrganizerBadge(avgRating, reviewCount) {
  const hasBadge =
    avgRating !== null &&
    avgRating >= BADGE_MIN_RATING &&
    reviewCount >= BADGE_MIN_REVIEWS;

  return {
    hasBadge,
    label: 'Mekla Yıldızı',
    icon: 'shield-checkmark',
  };
}

/**
 * Organizatör istatistiklerini Supabase'den çeker.
 * ProfileDetailScreen ve useEventDetail içinde kullanılır.
 *
 * @param {string} userId - Organizatör kullanıcı ID'si
 * @returns {Promise<{ avgRating: number|null, reviewCount: number, eventCount: number }>}
 */
export async function fetchOrganizerStats(userId) {
  // Etkinlik ID'lerini tek sorguda al — count için ayrı sorgu gereksiz
  const { data: creatorEvents } = await supabase
    .from('events')
    .select('id')
    .eq('creator_id', userId);

  const eventCount = creatorEvents?.length ?? 0;

  if (!eventCount) {
    return { avgRating: null, reviewCount: 0, eventCount: 0 };
  }

  const eventIds = creatorEvents.map((e) => e.id);

  // Tüm değerlendirmeleri çek
  const { data: reviews } = await supabase
    .from('event_reviews')
    .select('rating')
    .in('event_id', eventIds);

  if (!reviews?.length) {
    return { avgRating: null, reviewCount: 0, eventCount: eventCount ?? 0 };
  }

  const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  return {
    avgRating: Math.round(avg * 10) / 10,
    reviewCount: reviews.length,
    eventCount: eventCount ?? 0,
  };
}
