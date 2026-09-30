import { useState, useCallback, useRef } from 'react';

export function usePagination(fetchFn, pageSize = 20) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const offsetRef = useRef(0);

  const load = useCallback(async (reset = false) => {
    if (reset) {
      setLoading(true);
      offsetRef.current = 0;
      setHasMore(true);
    } else {
      if (loadingMore || !hasMore) return;
      setLoadingMore(true);
    }

    try {
      const items = await fetchFn(reset ? 0 : offsetRef.current, pageSize);
      const newItems = items ?? [];

      if (reset) {
        setData(newItems);
      } else {
        setData((prev) => [...prev, ...newItems]);
      }

      offsetRef.current = (reset ? 0 : offsetRef.current) + newItems.length;
      setHasMore(newItems.length >= pageSize);
    } catch (err) {
      if (__DEV__) console.error('usePagination error:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, [fetchFn, pageSize, loadingMore, hasMore]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await load(true);
  }, [load]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      load(false);
    }
  }, [load, loadingMore, hasMore, loading]);

  return { data, setData, loading, loadingMore, refreshing, hasMore, loadMore, refresh, load };
}
