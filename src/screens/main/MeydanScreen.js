import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl, Dimensions, ScrollView, TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import { LABELS, MESSAGES } from '../../constants/strings';
import EmptyState from '../../components/EmptyState';
import { FeedSkeleton } from '../../components/SkeletonLoader';
import PostCard from '../../components/meydan/PostCard';
import CommunityCard from '../../components/meydan/CommunityCard';
import CreatePostModal from '../../components/meydan/CreatePostModal';
import AnimatedFAB from '../../components/AnimatedFAB';
import HeaderBell from '../../components/HeaderBell';
import { useFeed } from '../../hooks/useFeed';
import { useCommunities } from '../../hooks/useCommunities';
import { useSavedPosts } from '../../hooks/useSavedPosts';
import { selectionFeedback } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function MeydanScreen({ navigation }) {
  const { user } = useAuth();

  // Custom hooks — tüm veri çekme ve iş mantığı burada
  const {
    posts, loading, setLoading, refreshing: feedRefreshing,
    loadingMore, hasMore, loadFeed, loadMore, onRefreshFeed, handleLikeToggle, handleDeletePost,
  } = useFeed();

  const {
    filteredCommunities, memberCounts, communitySearch, setCommunitySearch,
    joinedCommunities, loadCommunities, handleToggleJoin,
  } = useCommunities();

  const { savedPostIds, loadSavedPostIds, handleSaveToggle } = useSavedPosts();

  const [activeTab, setActiveTab] = useState('akis');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const swipeRef = useRef(null);

  // İlk yükleme
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([loadFeed(), loadCommunities(), loadSavedPostIds()]).finally(() => setLoading(false));
  }, [user]);

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([onRefreshFeed(), loadCommunities(), loadSavedPostIds()]);
    setRefreshing(false);
  };

  // PostCard/CommunityCard memo() ile sarılı ama bu handler'lar her render'da
  // yeniden oluşturulursa memo'yu etkisiz kılar — görünen tüm kartlar,
  // ekrandaki HERHANGİ bir state değişiminde (örn. pull-to-refresh, arama
  // kutusuna yazma) gereksiz yere yeniden render olur. useCallback ile
  // referansları sabitliyoruz.
  const navigateToProfile = useCallback((userId) => {
    if (userId && userId !== user?.id) {
      navigation.navigate('ProfileDetail', { userId });
    }
  }, [navigation, user?.id]);

  const navigateToPostDetail = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  const handleEditPost = useCallback((post) => {
    navigation.navigate('CreatePost', {
      editPost: post,
      editMedia: post.media ?? [],
    });
  }, [navigation]);

  const navigateToCommunity = useCallback((community) => {
    navigation.navigate('CommunityScreen', { communityId: community.id, communityName: community.name });
  }, [navigation]);

  const renderPostItem = ({ item }) => (
    <PostCard
      post={item}
      currentUserId={user?.id}
      onProfile={navigateToProfile}
      onDetail={navigateToPostDetail}
      onLikeToggle={handleLikeToggle}
      isSaved={savedPostIds.has(item.id)}
      onSaveToggle={handleSaveToggle}
      onDelete={handleDeletePost}
      onEdit={handleEditPost}
    />
  );

  const renderCommunityItem = ({ item }) => (
    <CommunityCard
      community={item}
      isJoined={joinedCommunities.includes(item.id)}
      memberCount={memberCounts[item.id] || 0}
      onPress={() => navigateToCommunity(item)}
      onToggleJoin={() => handleToggleJoin(item.id)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Mekla</Text>
          <HeaderBell />
        </View>
        <FeedSkeleton count={4} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Mekla</Text>
        <HeaderBell />
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'akis' && styles.tabActive]}
          onPress={() => { selectionFeedback(); setActiveTab('akis'); swipeRef.current?.scrollTo({ x: 0, animated: true }); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'akis' }}
          accessibilityLabel={LABELS.feed}
        >
          <Ionicons name="newspaper-outline" size={18} color={activeTab === 'akis' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'akis' && styles.tabTextActive]}>{LABELS.feed}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'gruplar' && styles.tabActive]}
          onPress={() => { selectionFeedback(); setActiveTab('gruplar'); swipeRef.current?.scrollTo({ x: SCREEN_WIDTH, animated: true }); }}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'gruplar' }}
          accessibilityLabel={LABELS.groups}
        >
          <Ionicons name="people-outline" size={18} color={activeTab === 'gruplar' ? COLORS.primary : COLORS.textMuted} />
          <Text style={[styles.tabText, activeTab === 'gruplar' && styles.tabTextActive]}>{LABELS.groups}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={swipeRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => {
          const page = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
          setActiveTab(page === 0 ? 'akis' : 'gruplar');
        }}
        style={{ flex: 1 }}
      >
        {/* Page 1: Akış */}
        <View style={{ width: SCREEN_WIDTH }}>
          <FlashList
            data={posts}
            keyExtractor={(item) => item.id}
            renderItem={renderPostItem}
            estimatedItemSize={420}
            contentContainerStyle={{ paddingBottom: 100 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            onEndReached={loadMore}
            onEndReachedThreshold={0.4}
            ListFooterComponent={
              loadingMore ? (
                <ActivityIndicator size="small" color={COLORS.primary} style={{ paddingVertical: 20 }} />
              ) : null
            }
            ListEmptyComponent={
              <EmptyState
                icon="megaphone-outline"
                title={MESSAGES.noPosts}
                description="İlk anını veya seslenişini paylaş, topluluğu harekete geçir!"
                actionLabel="Gönderi Paylaş"
                onAction={() => setShowCreateModal(true)}
              />
            }
          />
          <AnimatedFAB onPress={() => setShowCreateModal(true)} />
        </View>

        {/* Page 2: Gruplar */}
        <View style={{ width: SCREEN_WIDTH }}>
          <View style={styles.communitySearchContainer}>
            <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
            <TextInput
              style={styles.communitySearchInput}
              placeholder="Topluluk ara..."
              placeholderTextColor={COLORS.textPlaceholder}
              value={communitySearch}
              onChangeText={setCommunitySearch}
              accessibilityLabel="Topluluk ara"
            />
            {communitySearch.length > 0 && (
              <TouchableOpacity onPress={() => setCommunitySearch('')} accessibilityLabel="Aramayı temizle">
                <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
              </TouchableOpacity>
            )}
          </View>
          <FlashList
            data={filteredCommunities}
            keyExtractor={(item) => item.id}
            renderItem={renderCommunityItem}
            estimatedItemSize={90}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
            ListEmptyComponent={
              <EmptyState icon="people-outline" title="Topluluk bulunamadı" />
            }
          />
        </View>
      </ScrollView>

      <CreatePostModal
        visible={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSelectType={(type) => navigation.navigate('CreatePost', { postType: type })}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 12,
  },
  headerTitle: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  tabBar: {
    flexDirection: 'row', borderBottomWidth: 1,
    borderBottomColor: COLORS.border, backgroundColor: COLORS.white,
  },
  tab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 12, gap: 6, borderBottomWidth: 2, borderBottomColor: 'transparent',
  },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },
  communitySearchContainer: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.inputBackground, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 8,
    marginHorizontal: 16, marginTop: 12, marginBottom: 4,
  },
  communitySearchInput: { flex: 1, marginLeft: 8, fontSize: 15, color: COLORS.textDark },
});
