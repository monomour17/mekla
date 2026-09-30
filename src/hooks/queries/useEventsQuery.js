import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';

// ── Shared enrichment helper ────────────────────────────────────────────────
// Fetches participants + profiles for a list of events and attaches:
//   _creatorProfile, _approvedCount, _participantAvatars
async function enrichEventsHelper(events) {
  if (!events || events.length === 0) return [];

  const eventIds = events.map((e) => e.id);

  const { data: allParts } = await supabase
    .from('event_participants')
    .select('event_id, user_id, status')
    .in('event_id', eventIds)
    .eq('status', 'approved');

  const allProfileIds = new Set(events.map((e) => e.creator_id));
  (allParts ?? []).forEach((p) => allProfileIds.add(p.user_id));

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('id, display_name, photos')
    .in('id', [...allProfileIds]);

  const profileMap = Object.fromEntries((allProfiles ?? []).map((p) => [p.id, p]));

  // Organizatör rating ortalaması — N+1 önlemek için toplu fetch
  // events listesindeki tüm creator'ların TÜM geçmiş etkinliklerinin review'larını
  // tek seferde çek, creator bazında aggregate et.
  const creatorIds = [...new Set(events.map((e) => e.creator_id))];
  const creatorRatings = {};
  if (creatorIds.length > 0) {
    const { data: creatorEvents } = await supabase
      .from('events')
      .select('id, creator_id')
      .in('creator_id', creatorIds);

    const eventToCreator = {};
    (creatorEvents ?? []).forEach((e) => { eventToCreator[e.id] = e.creator_id; });
    const allCreatorEventIds = (creatorEvents ?? []).map((e) => e.id);

    if (allCreatorEventIds.length > 0) {
      const { data: reviews } = await supabase
        .from('event_reviews')
        .select('event_id, rating')
        .in('event_id', allCreatorEventIds);

      const agg = {};
      (reviews ?? []).forEach((r) => {
        const cid = eventToCreator[r.event_id];
        if (!cid) return;
        if (!agg[cid]) agg[cid] = { sum: 0, count: 0 };
        agg[cid].sum += r.rating;
        agg[cid].count += 1;
      });
      Object.entries(agg).forEach(([cid, { sum, count }]) => {
        creatorRatings[cid] = {
          avgRating: count > 0 ? Number((sum / count).toFixed(1)) : null,
          reviewCount: count,
        };
      });
    }
  }

  const partMap = {};
  (allParts ?? []).forEach((p) => {
    if (!partMap[p.event_id]) partMap[p.event_id] = [];
    partMap[p.event_id].push(p.user_id);
  });

  const toAvatar = (prof) => ({
    id: prof.id,
    photo: prof.photos?.[0] ?? null,
    initials: (prof.display_name ?? '?')
      .split(' ')
      .map((w) => w[0])
      .join('')
      .toUpperCase()
      .slice(0, 2),
  });

  return events.map((e) => {
    const creatorProf = profileMap[e.creator_id];
    const creatorAvatar = creatorProf ? toAvatar(creatorProf) : null;
    const partUserIds = partMap[e.id] ?? [];
    const partAvatars = partUserIds
      .filter((uid) => uid !== e.creator_id)
      .slice(0, 2)
      .map((uid) => profileMap[uid])
      .filter(Boolean)
      .map(toAvatar);

    const avatars = creatorAvatar ? [creatorAvatar, ...partAvatars] : partAvatars;

    return {
      ...e,
      _creatorProfile: creatorProf ?? null,
      _approvedCount: partUserIds.length + 1,
      _participantAvatars: avatars,
      _creatorRating: creatorRatings[e.creator_id] ?? null,
    };
  });
}

// ── useEventsQuery ──────────────────────────────────────────────────────────
/**
 * Etkinlik listesini zenginleştirilmiş şekilde çeker.
 * Creator profilleri, katılımcı avatarları ve kullanıcının rolünü dahil eder.
 */
export function useEventsQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['events', user?.id],
    queryFn: async () => {
      const { data: events, error } = await supabase
        .from('events')
        .select('*')
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true });

      if (error) throw error;
      if (!events || events.length === 0) return [];

      const eventIds = events.map((e) => e.id);

      // Katılımcıları tek sorguda çek
      const { data: allParts } = await supabase
        .from('event_participants')
        .select('event_id, user_id, status')
        .in('event_id', eventIds);

      // Tüm profil ID'lerini topla (creator + katılımcılar)
      const allProfileIds = new Set(events.map((e) => e.creator_id));
      (allParts ?? []).forEach((p) => allProfileIds.add(p.user_id));

      const { data: allProfiles } = await supabase
        .from('profiles')
        .select('id, display_name, photos')
        .in('id', [...allProfileIds]);

      const profileMap = Object.fromEntries((allProfiles ?? []).map((p) => [p.id, p]));

      // Etkinlik bazında katılımcı listesi
      const partMap = {};
      (allParts ?? []).forEach((p) => {
        if (!partMap[p.event_id]) partMap[p.event_id] = [];
        partMap[p.event_id].push(p);
      });

      const getAvatar = (profile) => {
        if (!profile) return null;
        return {
          uri: profile.photos?.[0] ?? null,
          name: profile.display_name ?? '?',
        };
      };

      return events.map((ev) => {
        const parts = partMap[ev.id] ?? [];
        const approved = parts.filter((p) =>
          p.status === 'approved' || p.status === 'attended' || p.status === 'no_show',
        );
        const myPart = parts.find((p) => p.user_id === user.id);
        const avatars = approved
          .slice(0, 4)
          .map((p) => getAvatar(profileMap[p.user_id]))
          .filter(Boolean);

        return {
          ...ev,
          _creatorProfile: profileMap[ev.creator_id] ?? null,
          _approvedCount: approved.length,
          _participantAvatars: avatars,
          _myRole: ev.creator_id === user.id ? 'organizer' : myPart ? 'participant' : null,
          _myStatus: myPart?.status ?? null,
        };
      });
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 1, // 1 dk
  });
}

// ── useEventDetailQuery ─────────────────────────────────────────────────────
/**
 * Tek bir etkinliğin detayını çeker.
 */
export function useEventDetailQuery(eventId) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['event', eventId],
    queryFn: async () => {
      const { data: ev, error } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (error) throw error;
      return ev;
    },
    enabled: !!user && !!eventId,
  });
}

// ── useDiscoverEventsQuery ──────────────────────────────────────────────────
/**
 * Kullanıcının şehrine göre filtrelenmiş, uygunluk kontrolü yapılmış
 * etkinlik listesini döner. EventsScreen → Keşfet sekmesi.
 *
 * Returns { events, hasPhotos, city } inside data.
 */
export function useDiscoverEventsQuery(cityOverride = null) {
  const { user } = useAuth();
  const setMyCity = useAppStore((s) => s.setMyCity);
  const profileVersion = useAppStore((s) => s.profileVersion);

  return useQuery({
    queryKey: ['discoverEvents', user?.id, profileVersion, cityOverride],
    queryFn: async () => {
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('city, account_type, looking_for, has_children, photos')
        .eq('id', user.id)
        .single();

      // cityOverride: başlıktaki 📍 seçiciden gelen geçici şehir (profili değiştirmez)
      const city = cityOverride || myProfile?.city || '';
      // Profil şehrini global store'a yaz — diğer ekranlar için (feed, vb.)
      setMyCity(myProfile?.city ?? '');

      const { data: rawEvents } = await supabase
        .from('events')
        .select('*')
        .eq('city', city)
        .neq('status', 'cancelled')
        .gte('event_date', new Date().toISOString())
        .order('event_date', { ascending: true });

      const allEvents = rawEvents ?? [];

      const eligible = allEvents.filter((e) => {
        if (e.creator_id === user.id) return true;
        if (
          myProfile?.account_type &&
          !e.allowed_account_types?.includes(myProfile.account_type)
        ) return false;
        if (
          myProfile?.looking_for &&
          !e.allowed_looking_for?.includes(myProfile.looking_for)
        ) return false;
        if (e.requires_children && !myProfile?.has_children) return false;
        return true;
      });

      const enriched = await enrichEventsHelper(eligible);

      return {
        events: enriched,
        hasPhotos: (myProfile?.photos?.length ?? 0) > 0,
        city,
      };
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2, // 2 dk
  });
}

// ── useMyEventsQuery ────────────────────────────────────────────────────────
/**
 * Kullanıcının oluşturduğu ve katıldığı etkinlikleri döner.
 * EventsScreen → Benim Etkinliklerim sekmesi.
 */
export function useMyEventsQuery({ enabled = true } = {}) {
  const { user } = useAuth();
  const profileVersion = useAppStore((s) => s.profileVersion);

  return useQuery({
    queryKey: ['myEvents', user?.id, profileVersion],
    queryFn: async () => {
      const { data: created } = await supabase
        .from('events')
        .select('*')
        .eq('creator_id', user.id)
        .neq('status', 'cancelled')
        .order('event_date', { ascending: true });

      const { data: myParts } = await supabase
        .from('event_participants')
        .select('event_id, status')
        .eq('user_id', user.id)
        .in('status', ['approved', 'pending']);

      const myPartStatusMap = {};
      (myParts ?? []).forEach((p) => { myPartStatusMap[p.event_id] = p.status; });
      const partEventIds = Object.keys(myPartStatusMap);

      let participatingEvents = [];
      if (partEventIds.length > 0) {
        const { data: pe } = await supabase
          .from('events')
          .select('*')
          .in('id', partEventIds)
          .neq('status', 'cancelled')
          .order('event_date', { ascending: true });
        participatingEvents = pe ?? [];
      }

      const merged = [];
      (created ?? []).forEach((e) => merged.push({ ...e, _myRole: 'creator' }));
      participatingEvents.forEach((e) => {
        if (!merged.some((m) => m.id === e.id)) {
          merged.push({
            ...e,
            _myRole: 'participant',
            _myStatus: myPartStatusMap[e.id] ?? 'approved',
          });
        }
      });
      merged.sort((a, b) => new Date(a.event_date) - new Date(b.event_date));

      return await enrichEventsHelper(merged);
    },
    enabled: !!user && enabled,
    staleTime: 1000 * 60 * 2, // 2 dk
  });
}
