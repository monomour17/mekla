import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import { enrichPosts as enrichPostsUtil, toggleLike } from '../../utils/postHelpers';

const PAGE_SIZE = 20;

async function fetchBlockedIds(userId) {
  const { data } = await supabase
    .from('blocks')
    .select('blocked_id, blocker_id')
    .or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);
  return new Set(
    (data ?? []).map((b) => (b.blocker_id === userId ? b.blocked_id : b.blocker_id)),
  );
}

function filterPosts(posts, blockedIds) {
  const now = new Date();
  return (posts ?? []).filter((p) => {
    if (blockedIds.has(p.author_id)) return false;
    if (p.post_type === 'notice' && p.expires_at && new Date(p.expires_at) < now) return false;
    return true;
  });
}

/**
 * React Query hook — Feed gönderilerini sonsuz kaydırma ile çeker.
 * Cache'ler, arka planda yeniler, ve hata durumlarını yönetir.
 */
export function useFeedQuery() {
  const { user } = useAuth();
  const myCity = useAppStore((s) => s.myCity);

  return useInfiniteQuery({
    queryKey: ['feed', user?.id, myCity],
    queryFn: async ({ pageParam }) => {
      if (!user || !myCity) return [];

      const blockedIds = await fetchBlockedIds(user.id);

      let query = supabase
        .from('posts')
        .select('id, author_id, post_type, content, related_event_id, community_id, location_text, created_at, expires_at')
        .is('community_id', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (pageParam) {
        query = query.lt('created_at', pageParam);
      }

      const { data: rawPosts, error } = await query;
      if (error) throw error;

      const filtered = filterPosts(rawPosts, blockedIds);
      return enrichPostsUtil(filtered, user.id, { cityFilter: myCity, includeEventNames: true });
    },
    getNextPageParam: (lastPage) => {
      if (!lastPage || lastPage.length < PAGE_SIZE) return undefined;
      return lastPage[lastPage.length - 1].created_at;
    },
    initialPageParam: undefined,
    enabled: !!user && !!myCity,
  });
}

/**
 * React Query hook — Beğeni toggle mutation.
 * Optimistic update ile hemen UI günceller, hata durumunda geri alır.
 */
export function useLikeMutation() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const myCity = useAppStore((s) => s.myCity);

  return useMutation({
    mutationFn: async ({ postId, currentlyLiked }) => {
      await toggleLike(user.id, postId, currentlyLiked);
    },
    onMutate: async ({ postId }) => {
      const queryKey = ['feed', user?.id, myCity];
      await queryClient.cancelQueries({ queryKey });
      const prev = queryClient.getQueryData(queryKey);

      queryClient.setQueryData(queryKey, (old) => {
        if (!old) return old;
        return {
          ...old,
          pages: old.pages.map((page) =>
            page.map((p) => {
              if (p.id !== postId) return p;
              return {
                ...p,
                isLiked: !p.isLiked,
                likeCount: p.isLiked ? p.likeCount - 1 : p.likeCount + 1,
              };
            }),
          ),
        };
      });

      return { prev };
    },
    onError: (_err, _vars, context) => {
      if (context?.prev) {
        queryClient.setQueryData(['feed', user?.id, myCity], context.prev);
      }
    },
  });
}

/**
 * React Query hook — Kaydedilen gönderi ID'lerini çeker.
 */
export function useSavedPostIdsQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['savedPostIds', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', user.id);
      return new Set((data ?? []).map((r) => r.post_id));
    },
    enabled: !!user,
  });
}

/**
 * React Query hook — Topluluk listesini çeker.
 */
export function useCommunitiesQuery() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['communities', user?.id],
    queryFn: async () => {
      const [{ data: comms }, { data: memberships }, { data: myMemberships }] = await Promise.all([
        supabase.from('communities').select('id, name, description, icon').order('name'),
        supabase.from('user_communities').select('community_id'),
        supabase.from('user_communities').select('community_id').eq('user_id', user.id),
      ]);

      const counts = {};
      (memberships ?? []).forEach((m) => {
        counts[m.community_id] = (counts[m.community_id] || 0) + 1;
      });

      return {
        communities: comms ?? [],
        memberCounts: counts,
        joinedIds: (myMemberships ?? []).map((m) => m.community_id),
      };
    },
    enabled: !!user,
  });
}
