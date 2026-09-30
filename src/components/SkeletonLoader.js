import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { COLORS } from '../constants/colors';

/**
 * Shimmer efektli iskelet yükleyici.
 * Reanimated yerine RN Animated kullanır — native modül sorunu yaşamaz.
 */
function SkeletonBox({ width, height, borderRadius = 8, style }) {
  const shimmer = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmer, { toValue: 0.7, duration: 1000, useNativeDriver: true }),
        Animated.timing(shimmer, { toValue: 0.3, duration: 1000, useNativeDriver: true }),
      ]),
    ).start();
  }, []);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: COLORS.border,
          opacity: shimmer,
        },
        style,
      ]}
    />
  );
}

/**
 * Gönderi kartı iskelet yükleyicisi — feed'de ActivityIndicator yerine gösterilir.
 */
export function PostCardSkeleton() {
  return (
    <View style={skeletonStyles.postCard}>
      <View style={skeletonStyles.postHeader}>
        <SkeletonBox width={44} height={44} borderRadius={22} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <SkeletonBox width={120} height={14} />
          <SkeletonBox width={80} height={10} style={{ marginTop: 6 }} />
        </View>
      </View>
      <SkeletonBox width="100%" height={14} style={{ marginTop: 16 }} />
      <SkeletonBox width="80%" height={14} style={{ marginTop: 8 }} />
      <SkeletonBox width="100%" height={200} borderRadius={12} style={{ marginTop: 16 }} />
      <View style={skeletonStyles.postFooter}>
        <SkeletonBox width={60} height={24} borderRadius={12} />
        <SkeletonBox width={60} height={24} borderRadius={12} />
        <SkeletonBox width={60} height={24} borderRadius={12} />
      </View>
    </View>
  );
}

/**
 * Etkinlik kartı iskelet yükleyicisi.
 */
export function EventCardSkeleton() {
  return (
    <View style={skeletonStyles.eventCard}>
      <SkeletonBox width="100%" height={160} borderRadius={16} />
      <View style={{ padding: 16 }}>
        <SkeletonBox width="70%" height={18} />
        <SkeletonBox width="50%" height={14} style={{ marginTop: 8 }} />
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
          <SkeletonBox width={80} height={28} borderRadius={14} />
          <SkeletonBox width={80} height={28} borderRadius={14} />
        </View>
      </View>
    </View>
  );
}

/**
 * Sohbet listesi öğesi iskelet yükleyicisi.
 */
export function ChatItemSkeleton() {
  return (
    <View style={skeletonStyles.chatItem}>
      <SkeletonBox width={56} height={56} borderRadius={28} />
      <View style={{ flex: 1, marginLeft: 14 }}>
        <SkeletonBox width={140} height={16} />
        <SkeletonBox width={200} height={12} style={{ marginTop: 6 }} />
      </View>
      <SkeletonBox width={40} height={12} />
    </View>
  );
}

/**
 * Profil detay iskelet yükleyicisi.
 */
export function ProfileSkeleton() {
  return (
    <View style={skeletonStyles.profileContainer}>
      <SkeletonBox width="100%" height={300} borderRadius={0} />
      <View style={{ padding: 20 }}>
        <SkeletonBox width={160} height={24} />
        <SkeletonBox width={100} height={14} style={{ marginTop: 8 }} />
        <SkeletonBox width="100%" height={60} style={{ marginTop: 16 }} />
      </View>
    </View>
  );
}

/**
 * Feed skeleton listesi — sayfa ilk yüklenirken birden çok iskelet gösterir.
 */
export function FeedSkeleton({ count = 3 }) {
  return (
    <View style={{ paddingTop: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <PostCardSkeleton key={i} />
      ))}
    </View>
  );
}

/**
 * Etkinlik listesi iskeleti.
 */
export function EventListSkeleton({ count = 3 }) {
  return (
    <View style={{ padding: 16, gap: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <EventCardSkeleton key={i} />
      ))}
    </View>
  );
}

/**
 * Sohbet listesi iskeleti.
 */
export function ChatListSkeleton({ count = 6 }) {
  return (
    <View style={{ paddingTop: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ChatItemSkeleton key={i} />
      ))}
    </View>
  );
}

export { SkeletonBox };

const skeletonStyles = StyleSheet.create({
  postCard: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  postHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  postFooter: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 16,
  },
  eventCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
});
