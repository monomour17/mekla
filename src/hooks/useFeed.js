import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';
import useAppStore from '../store/useAppStore';
import { handleError } from '../utils/errorHandler';
import { enrichPosts as enrichPostsUtil, toggleLike, optimisticToggleLike } from '../utils/postHelpers';

const PAGE_SIZE = 20;

/**
 * Feed verilerini yöneten custom hook.
 * MeydanScreen'den çıkarılmıştır — gönderi çekme, pagination,
 * realtime dinleme, beğeni/kaydetme işlemlerini kapsar.
 */
export function useFeed() {
  const { user } = useAuth();
  const feedStale = useAppStore((s) => s.feedStale);
  const setFeedStale = useAppStore((s) => s.setFeedStale);
  const myCity = useAppStore((s) => s.myCity);
  const setMyCity = useAppStore((s) => s.setMyCity);
  const pendingNewPost = useAppStore((s) => s.pendingNewPost);
  const setPendingNewPost = useAppStore((s) => s.setPendingNewPost);
  const commentCountUpdates = useAppStore((s) => s.commentCountUpdates);
  const clearCommentCountUpdate = useAppStore((s) => s.clearCommentCountUpdate);

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const loadFeedRef = useRef(null);

  // ── Helpers ──────────────────────────────────────────────

  const enrichPosts = useCallback(
    async (rawFiltered, city) =>
      enrichPostsUtil(rawFiltered, user?.id, { cityFilter: city, includeEventNames: true }),
    [user],
  );

  const loadBlockedIds = useCallback(async () => {
    const { data: blocksData } = await supabase
      .from('blocks')
      .select('blocked_id, blocker_id')
      .or(`blocker_id.eq.${user.id},blocked_id.eq.${user.id}`);
    return new Set(
      (blocksData ?? []).map((b) => (b.blocker_id === user.id ? b.blocked_id : b.blocker_id)),
    );
  }, [user]);

  // ── Load Feed ────────────────────────────────────────────

  const loadFeed = useCallback(async () => {
    if (!user) return;
    try {
      const city =
        myCity ||
        (await supabase.from('profiles').select('city').eq('id', user.id).single()).data?.city;
      if (!city) return;
      if (!myCity) setMyCity(city);

      const blockedIds = await loadBlockedIds();

      const { data: rawPosts, error } = await supabase
        .from('posts')
        .select('id, author_id, post_type, content, related_event_id, community_id, location_text, created_at, expires_at')
        .is('community_id', null)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) { if (__DEV__) console.error(error); return; }

      const now = new Date();
      const filtered = (rawPosts ?? []).filter((p) => {
        if (blockedIds.has(p.author_id)) return false;
        if (p.post_type === 'notice' && p.expires_at && new Date(p.expires_at) < now) return false;
        return true;
      });

      const enriched = await enrichPosts(filtered, city);
      setPosts(enriched);
      setHasMore((rawPosts ?? []).length === PAGE_SIZE);
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Akış yüklenirken', err);
    }
  }, [user, myCity, enrichPosts, loadBlockedIds]);

  // ── Load More (Pagination) ──────────────────────────────

  const loadMore = useCallback(async () => {
    if (!user || !hasMore || loadingMore || posts.length === 0) return;
    setLoadingMore(true);
    try {
      const city = myCity;
      if (!city) return;

      const lastPost = posts[posts.length - 1];
      const blockedIds = await loadBlockedIds();

      const { data: rawPosts, error } = await supabase
        .from('posts')
        .select('id, author_id, post_type, content, related_event_id, community_id, location_text, created_at, expires_at')
        .is('community_id', null)
        .lt('created_at', lastPost.created_at)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (error) { if (__DEV__) console.error(error); return; }

      const now = new Date();
      const filtered = (rawPosts ?? []).filter((p) => {
        if (blockedIds.has(p.author_id)) return false;
        if (p.post_type === 'notice' && p.expires_at && new Date(p.expires_at) < now) return false;
        return true;
      });

      const enriched = await enrichPosts(filtered, city);
      setPosts((prev) => [...prev, ...enriched]);
      setHasMore((rawPosts ?? []).length === PAGE_SIZE);
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Daha fazla gönderi yüklenirken', err);
    } finally {
      setLoadingMore(false);
    }
  }, [user, myCity, hasMore, loadingMore, posts, enrichPosts, loadBlockedIds]);

  // ── Delete Post ──────────────────────────────────────────

  const handleDeletePost = useCallback(async (postId) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (!error) {
      setPosts((prev) => prev.filter((p) => p.id !== postId));
    }
  }, []);

  // ── Like Toggle ──────────────────────────────────────────

  const handleLikeToggle = useCallback(
    async (post) => {
      if (!user) return;
      setPosts((prev) => optimisticToggleLike(prev, post.id));
      toggleLike(user.id, post.id, post.isLiked);
    },
    [user],
  );

  // loadFeed ref — AppState/interval closure'ları güncel kopyayı kullanır
  useEffect(() => { loadFeedRef.current = loadFeed; }, [loadFeed]);

  // ── Background Refresh ───────────────────────────────────
  // Realtime yerine: uygulama ön plana geldiğinde + her 5 dakikada sessiz yenileme.
  // Böylece 1000 kullanıcı aynı anda DB'ye istek atmaz.

  useEffect(() => {
    if (!user) return;

    // Ön plana dönünce yenile (background → active)
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') loadFeedRef.current?.();
    });

    // Her 5 dakikada bir sessiz arka plan yenilemesi
    const timer = setInterval(() => loadFeedRef.current?.(), 5 * 60 * 1000);

    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [user]);

  // ── Pending New Post ─────────────────────────────────────

  useEffect(() => {
    if (pendingNewPost && !pendingNewPost.community_id) {
      setPosts((prev) => {
        if (prev.find((p) => p.id === pendingNewPost.id)) return prev;
        return [pendingNewPost, ...prev];
      });
      setPendingNewPost(null);
      setFeedStale(false);
    }
  }, [pendingNewPost]);

  // ── Comment Count Sync ───────────────────────────────────

  useEffect(() => {
    const updates = Object.entries(commentCountUpdates);
    if (updates.length === 0) return;
    setPosts((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (commentCountUpdates[p.id] !== undefined) {
          changed = true;
          return { ...p, commentCount: commentCountUpdates[p.id] };
        }
        return p;
      });
      return changed ? next : prev;
    });
    updates.forEach(([id]) => clearCommentCountUpdate(id));
  }, [commentCountUpdates]);

  // ── Feed Stale Re-fetch on Focus ─────────────────────────

  useFocusEffect(
    useCallback(() => {
      if (feedStale && !pendingNewPost) {
        loadFeed();
        setFeedStale(false);
      }
    }, [feedStale, pendingNewPost]),
  );

  // ── Refresh ──────────────────────────────────────────────

  const onRefreshFeed = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
    await loadFeed();
    setRefreshing(false);
  }, [loadFeed]);

  return {
    posts,
    loading,
    setLoading,
    refreshing,
    loadingMore,
    hasMore,
    loadFeed,
    loadMore,
    onRefreshFeed,
    handleLikeToggle,
    handleDeletePost,
  };
}
