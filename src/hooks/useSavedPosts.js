import { useCallback, useState } from 'react';
import { supabase } from '../services/supabase';
import { useAuth } from '../context/AuthContext';

/**
 * Kaydedilen gönderi ID'lerini yöneten custom hook.
 * Kaydetme/kaldırma ile birlikte optimistic update yapar.
 */
export function useSavedPosts() {
  const { user } = useAuth();
  const [savedPostIds, setSavedPostIds] = useState(new Set());

  const loadSavedPostIds = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_posts')
      .select('post_id')
      .eq('user_id', user.id);
    setSavedPostIds(new Set((data ?? []).map((r) => r.post_id)));
  }, [user]);

  const handleSaveToggle = useCallback(
    async (post) => {
      if (!user) return;
      const isSaved = savedPostIds.has(post.id);
      // Optimistic update
      setSavedPostIds((prev) => {
        const next = new Set(prev);
        if (isSaved) next.delete(post.id);
        else next.add(post.id);
        return next;
      });
      if (isSaved) {
        await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', post.id);
      } else {
        await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
      }
    },
    [user, savedPostIds],
  );

  return { savedPostIds, loadSavedPostIds, handleSaveToggle };
}
