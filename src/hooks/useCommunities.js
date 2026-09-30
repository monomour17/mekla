import { useCallback, useMemo, useState } from 'react';
import { Alert } from 'react-native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import useAppStore from '../store/useAppStore';
import { handleError } from '../utils/errorHandler';
import { track, EVENTS } from '../services/analytics';

/**
 * Topluluk verilerini yöneten custom hook.
 * MeydanScreen'den çıkarılmıştır — topluluk listesi, arama,
 * katılma/ayrılma işlemlerini kapsar.
 */
export function useCommunities() {
  const { user } = useAuth();
  const joinedCommunities = useAppStore((s) => s.joinedCommunities);
  const setJoinedCommunities = useAppStore((s) => s.setJoinedCommunities);

  const [communities, setCommunities] = useState([]);
  const [memberCounts, setMemberCounts] = useState({});
  const [communitySearch, setCommunitySearch] = useState('');

  const filteredCommunities = useMemo(() => {
    const joinedSet = new Set(joinedCommunities);
    const query = communitySearch.trim().toLowerCase();

    return [...communities]
      .filter(
        (c) =>
          !query ||
          c.name?.toLowerCase().includes(query)
      )
      .sort((a, b) => {
        const aJoined = joinedSet.has(a.id);
        const bJoined = joinedSet.has(b.id);

        if (aJoined !== bJoined) {
          return aJoined ? -1 : 1;
        }

        return (a.name ?? '').localeCompare(b.name ?? '', 'tr', {
          sensitivity: 'base',
        });
      });
  }, [communities, communitySearch, joinedCommunities]);

  const loadCommunities = useCallback(async () => {
    if (!user) return;
    try {
      // Üçü de birbirinden bağımsız, paralel çalıştır — sırayla await etmek
      // gereksiz yere ekstra round-trip süresi ekliyordu.
      const [{ data: comms }, { data: memberships }, { data: myMemberships }] = await Promise.all([
        supabase.from('communities').select('id, name, description, icon').order('name'),
        supabase.from('user_communities').select('community_id'),
        supabase.from('user_communities').select('community_id').eq('user_id', user.id),
      ]);

      setCommunities(comms ?? []);

      const counts = {};
      (memberships ?? []).forEach((m) => {
        counts[m.community_id] = (counts[m.community_id] || 0) + 1;
      });
      setMemberCounts(counts);

      setJoinedCommunities((myMemberships ?? []).map((m) => m.community_id));
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Topluluklar yüklenirken', err);
    }
  }, [user]);

  const handleToggleJoin = useCallback(
    async (communityId) => {
      if (!user) return;
      const isJoined = joinedCommunities.includes(communityId);
      if (isJoined) {
        const community = communities.find((c) => c.id === communityId);
        Alert.alert(
          'Topluluktan Ayrıl',
          `${community?.name ?? 'Bu topluluk'}tan ayrılmak istediğine emin misin?`,
          [
            { text: 'İptal', style: 'cancel' },
            {
              text: 'Ayrıl',
              style: 'destructive',
              onPress: async () => {
                setJoinedCommunities(joinedCommunities.filter((id) => id !== communityId));
                setMemberCounts((prev) => ({
                  ...prev,
                  [communityId]: (prev[communityId] || 1) - 1,
                }));
                await supabase
                  .from('user_communities')
                  .delete()
                  .eq('user_id', user.id)
                  .eq('community_id', communityId);
              },
            },
          ],
        );
        return;
      } else {
        setJoinedCommunities([...joinedCommunities, communityId]);
        setMemberCounts((prev) => ({
          ...prev,
          [communityId]: (prev[communityId] || 0) + 1,
        }));
        await supabase
          .from('user_communities')
          .insert({ user_id: user.id, community_id: communityId });
        track(EVENTS.COMMUNITY_JOINED, { community_id: communityId });
      }
    },
    [user, joinedCommunities, communities],
  );

  return {
    communities,
    filteredCommunities,
    memberCounts,
    communitySearch,
    setCommunitySearch,
    joinedCommunities,
    loadCommunities,
    handleToggleJoin,
  };
}
