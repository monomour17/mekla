/**
 * Shared post enrichment & like toggle utilities.
 * Eliminates duplicate enrichPosts / handleLike patterns across screens.
 */
import { supabase } from '../services/supabase';

/**
 * Enrich an array of raw posts with author profiles, media, like counts, and comment counts.
 *
 * @param {Array} posts        – raw post rows (must have at least id, author_id)
 * @param {string} currentUserId – the logged-in user's id (for isLiked check)
 * @param {object} [options]
 * @param {string} [options.cityFilter] – if provided, only keep posts whose author is in this city
 * @param {boolean} [options.includeEventNames] – fetch related event titles (default false)
 * @param {string} [options.communityId] – if all posts belong to one fixed alan (raw rows may omit community_id), pass it here so alan-içi takma ad resolves
 * @returns {Promise<Array>} enriched posts
 */
export async function enrichPosts(posts, currentUserId, options = {}) {
  if (!posts || posts.length === 0) return [];

  const { cityFilter, includeEventNames = false, communityId: fixedCommunityId = null } = options;

  // 1. Collect IDs
  const authorIds = [...new Set(posts.map((p) => p.author_id))];
  const postIds = posts.map((p) => p.id);
  const eventIds = includeEventNames
    ? [...new Set(posts.filter((p) => p.related_event_id).map((p) => p.related_event_id))]
    : [];

  // Alan-içi takma ad: her gönderinin ait olduğu alan (raw row'da varsa onu,
  // yoksa (tek alan sabit ise) options.communityId'yi kullan
  const communityIdFor = (p) => p.community_id ?? fixedCommunityId ?? null;
  const aliasCommunityIds = [...new Set(posts.map(communityIdFor).filter(Boolean))];

  // 2. Parallel batch queries
  const [authorRes, mediaRes, likesRes, commentsRes, eventsRes, aliasRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, display_name, photos, city, is_active')
      .in('id', authorIds),
    supabase
      .from('post_media')
      .select('id, post_id, media_url, media_order')
      .in('post_id', postIds)
      .order('media_order', { ascending: true }),
    supabase
      .from('post_likes')
      .select('post_id, user_id')
      .in('post_id', postIds),
    supabase
      .from('post_comments')
      .select('post_id')
      .in('post_id', postIds),
    eventIds.length > 0
      ? supabase.from('events').select('id, title').in('id', eventIds)
      : { data: [] },
    aliasCommunityIds.length > 0
      ? supabase
          .from('user_communities')
          .select('user_id, community_id, alias_display_name, alias_avatar_url')
          .in('user_id', authorIds)
          .in('community_id', aliasCommunityIds)
      : { data: [] },
  ]);

  // 3. Build lookup maps
  const authorMap = Object.fromEntries(
    (authorRes.data ?? []).filter((p) => p.is_active !== false).map((p) => [p.id, p])
  );

  const mediaMap = {};
  (mediaRes.data ?? []).forEach((m) => {
    if (!mediaMap[m.post_id]) mediaMap[m.post_id] = [];
    mediaMap[m.post_id].push(m);
  });

  const likeCountMap = {};
  const myLikes = new Set();
  (likesRes.data ?? []).forEach((l) => {
    likeCountMap[l.post_id] = (likeCountMap[l.post_id] || 0) + 1;
    if (l.user_id === currentUserId) myLikes.add(l.post_id);
  });

  const commentCountMap = {};
  (commentsRes.data ?? []).forEach((c) => {
    commentCountMap[c.post_id] = (commentCountMap[c.post_id] || 0) + 1;
  });

  const eventMap = includeEventNames
    ? Object.fromEntries((eventsRes.data ?? []).map((e) => [e.id, e.title]))
    : {};

  // Alan-içi takma ad haritası — sadece görüntüleme katmanında isim/foto
  // değiştirir, post.author_id gerçek kullanıcıyı göstermeye devam eder
  // (moderasyon/şikayet her zaman gerçek kimliği çözer)
  const aliasMap = {};
  (aliasRes.data ?? []).forEach((a) => {
    if (a.alias_display_name) aliasMap[`${a.user_id}:${a.community_id}`] = a;
  });

  // 4. Optional city filter
  let filtered = posts;
  if (cityFilter) {
    filtered = posts.filter((p) => {
      const a = authorMap[p.author_id];
      return a && a.city === cityFilter;
    });
  }

  // 5. Map to enriched shape
  return filtered.map((p) => {
    const realAuthor = authorMap[p.author_id] || null;
    const alias = aliasMap[`${p.author_id}:${communityIdFor(p)}`];
    const author = alias
      ? { ...realAuthor, display_name: alias.alias_display_name, photos: alias.alias_avatar_url ? [alias.alias_avatar_url] : null }
      : realAuthor;

    return {
      ...p,
      author,
      eventName: p.related_event_id ? eventMap[p.related_event_id] || null : null,
      media: mediaMap[p.id] || [],
      likeCount: likeCountMap[p.id] || 0,
      isLiked: myLikes.has(p.id),
      commentCount: commentCountMap[p.id] || 0,
    };
  });
}

/**
 * Toggle like on a post — handles the Supabase insert/delete.
 *
 * @param {string} userId
 * @param {string} postId
 * @param {boolean} currentlyLiked
 * @returns {Promise<void>}
 */
export async function toggleLike(userId, postId, currentlyLiked) {
  if (currentlyLiked) {
    await supabase.from('post_likes').delete().eq('user_id', userId).eq('post_id', postId);
  } else {
    await supabase.from('post_likes').insert({ user_id: userId, post_id: postId });
  }
}

/**
 * Helper: optimistic like toggle for a posts array (for list screens).
 * Returns a new array with the toggled post updated.
 *
 * @param {Array} posts – current posts array
 * @param {string} postId – post to toggle
 * @returns {Array} updated posts array
 */
export function optimisticToggleLike(posts, postId) {
  return posts.map((p) => {
    if (p.id !== postId) return p;
    const wasLiked = p.isLiked;
    return {
      ...p,
      isLiked: !wasLiked,
      likeCount: wasLiked ? p.likeCount - 1 : p.likeCount + 1,
    };
  });
}
