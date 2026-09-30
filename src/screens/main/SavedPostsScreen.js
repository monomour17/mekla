import React, { useCallback, useState } from 'react';
import {
  View, Text, StyleSheet, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { LABELS } from '../../constants/strings';
import { enrichPosts, toggleLike, optimisticToggleLike } from '../../utils/postHelpers';
import PostCard from '../../components/meydan/PostCard';
import LoadingState from '../../components/LoadingState';
import EmptyState from '../../components/EmptyState';
import { handleError } from '../../utils/errorHandler';

export default function SavedPostsScreen({ navigation }) {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [savedPostIds, setSavedPostIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    try {
      const { data: savedRows } = await supabase
        .from('saved_posts')
        .select('post_id')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      const postIds = (savedRows ?? []).map((r) => r.post_id);
      setSavedPostIds(new Set(postIds));

      if (postIds.length === 0) {
        setPosts([]);
        return;
      }

      const { data: rawPosts } = await supabase
        .from('posts')
        .select('id, author_id, post_type, content, related_event_id, community_id, location_text, created_at, expires_at')
        .in('id', postIds);

      // Keep original saved order
      const postMap = Object.fromEntries((rawPosts ?? []).map((p) => [p.id, p]));
      const ordered = postIds.map((id) => postMap[id]).filter(Boolean);

      const enriched = await enrichPosts(ordered, user.id, { includeEventNames: true });
      setPosts(enriched);
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Kaydedilen gönderiler yüklenirken', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  // PostCard memo() ile sarılı — bu handler'lar her render'da yeniden
  // oluşturulursa memo etkisiz kalır.
  const handleLikeToggle = useCallback((post) => {
    if (!user) return;
    setPosts((prev) => optimisticToggleLike(prev, post.id));
    toggleLike(user.id, post.id, post.isLiked);
  }, [user]);

  const handleSaveToggle = useCallback(async (post) => {
    if (!user) return;
    const isSaved = savedPostIds.has(post.id);
    setSavedPostIds((prev) => {
      const next = new Set(prev);
      if (isSaved) next.delete(post.id);
      else next.add(post.id);
      return next;
    });
    if (isSaved) {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      await supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', post.id);
    } else {
      await supabase.from('saved_posts').insert({ user_id: user.id, post_id: post.id });
    }
  }, [user, savedPostIds]);

  const navigateToProfile = useCallback((userId) => {
    if (userId && userId !== user?.id) {
      navigation.navigate('ProfileDetail', { userId });
    }
  }, [navigation, user?.id]);

  const navigateToPostDetail = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  const renderItem = useCallback(({ item }) => (
    <PostCard
      post={item}
      onProfile={navigateToProfile}
      onDetail={navigateToPostDetail}
      onLikeToggle={handleLikeToggle}
      isSaved={savedPostIds.has(item.id)}
      onSaveToggle={handleSaveToggle}
    />
  ), [navigateToProfile, navigateToPostDetail, handleLikeToggle, savedPostIds, handleSaveToggle]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={LABELS.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Kaydedilenler</Text>
        <View style={{ width: 24 }} />
      </View>

      <FlashList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        estimatedItemSize={420}
        contentContainerStyle={{ paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <EmptyState icon="bookmark-outline" title="Kaydedilen gönderi yok" description="Beğendiğin gönderileri kaydet, sonra buradan ulaş!" />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBackground,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },
});
