/**
 * usePendingRatings — Otomatik rating reminder hook.
 *
 * Kullanıcının onaylı/katılmış olduğu ve tarihi geçmiş etkinlikleri kontrol eder.
 * Henüz değerlendirme yapılmamışsa bu listeyi döner.
 *
 * Kullanım: EventsScreen veya MeydanScreen'de çağır.
 * pendingRatings.length > 0 ise banner veya modal göster.
 *
 * @example
 *   const { pendingRatings } = usePendingRatings();
 *   // pendingRatings: [{ id, title, event_date }, ...]
 */
import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

export function usePendingRatings() {
  const { user } = useAuth();
  const [pendingRatings, setPendingRatings] = useState([]);
  const [loading, setLoading] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!user?.id) return;

      let cancelled = false;

      (async () => {
        setLoading(true);
        try {
          // 1. Kullanıcının onaylı veya katılmış olduğu kayıtlar
          const { data: myParts } = await supabase
            .from('event_participants')
            .select('event_id')
            .eq('user_id', user.id)
            .in('status', ['approved', 'attended']);

          if (!myParts?.length || cancelled) return;

          const eventIds = myParts.map((p) => p.event_id);

          // 2. Bu etkinliklerden tarihi geçenler (sadece son 30 günü tara — performans)
          const thirtyDaysAgo = new Date();
          thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

          const { data: pastEvents } = await supabase
            .from('events')
            .select('id, title, event_date')
            .in('id', eventIds)
            .lt('event_date', new Date().toISOString())
            .gte('event_date', thirtyDaysAgo.toISOString())
            .neq('status', 'cancelled')
            .order('event_date', { ascending: false });

          if (!pastEvents?.length || cancelled) {
            setPendingRatings([]);
            return;
          }

          const pastEventIds = pastEvents.map((e) => e.id);

          // 3. Zaten değerlendirdiğim etkinlikler
          const { data: myReviews } = await supabase
            .from('event_reviews')
            .select('event_id')
            .eq('reviewer_id', user.id)
            .in('event_id', pastEventIds);

          if (cancelled) return;

          const reviewedIds = new Set((myReviews ?? []).map((r) => r.event_id));

          // 4. Değerlendirme yapılmamış biten etkinlikler
          const unrated = pastEvents.filter((e) => !reviewedIds.has(e.id));

          setPendingRatings(unrated);
        } catch (_) {
          // Sessiz hata — kullanıcı deneyimini bozma
          setPendingRatings([]);
        } finally {
          if (!cancelled) setLoading(false);
        }
      })();

      return () => {
        cancelled = true;
      };
    }, [user?.id]),
  );

  return { pendingRatings, loading };
}
