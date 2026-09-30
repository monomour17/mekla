import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../Avatar';
import { timeAgo } from '../../utils/dateFormat';
import { COLORS, SHADOWS } from '../../constants/colors';

function CommunityPostCard({ post, isOwner, onPress, onMenuPress, onLikeToggle, onPhotoPress }) {
  return (
    <TouchableOpacity style={styles.postCard} onPress={() => onPress(post)} accessibilityRole="button" accessibilityLabel={`${post.author?.display_name ?? 'Kullanıcı'} gönderisi`}>
      <View style={styles.postHeader}>
        <Avatar profile={post.author} size={36} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.postAuthor}>{post.author?.display_name ?? 'Kullanıcı'}</Text>
          <Text style={styles.postTime}>{timeAgo(post.created_at)}</Text>
        </View>
        {isOwner && (
          <TouchableOpacity
            onPress={() => onMenuPress(post)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Gönderi seçenekleri"
          >
            <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.postContent} numberOfLines={4}>{post.content}</Text>
      {post.media.length > 0 && (
        <TouchableOpacity
          activeOpacity={0.92}
          onPress={(e) => {
            e.stopPropagation();
            onPhotoPress(post);
          }}
        >
          <Image source={{ uri: post.media[0].media_url }} style={styles.postImage} contentFit="cover" />
        </TouchableOpacity>
      )}
      <View style={styles.postActions}>
        <TouchableOpacity style={styles.postActionBtn} onPress={() => onLikeToggle(post)} accessibilityRole="button" accessibilityLabel={post.isLiked ? 'Beğeniyi kaldır' : 'Beğen'}>
          <Ionicons name={post.isLiked ? 'heart' : 'heart-outline'} size={20} color={post.isLiked ? COLORS.error : COLORS.textMuted} />
          {post.likeCount > 0 && <Text style={styles.postActionCount}>{post.likeCount}</Text>}
        </TouchableOpacity>
        <View style={styles.postActionBtn}>
          <Ionicons name="chatbubble-outline" size={18} color={COLORS.textMuted} />
          {post.commentCount > 0 && <Text style={styles.postActionCount}>{post.commentCount}</Text>}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// enrichPosts her yüklemede post başına yeni obje üretiyor — referans eşitliği
// hiçbir zaman tutmayacağı için varsayılan memo() işe yaramaz. Sadece
// görüntüyü etkileyen alanları karşılaştırıyoruz; enrichPosts'u "referansı
// koru" şeklinde değiştirmekten daha sağlam çünkü nested author/media
// objeleriyle uğraşmıyor.
function areEqual(prev, next) {
  const a = prev.post;
  const b = next.post;
  return (
    a.id === b.id &&
    a.content === b.content &&
    a.likeCount === b.likeCount &&
    a.isLiked === b.isLiked &&
    a.commentCount === b.commentCount &&
    a.media.length === b.media.length &&
    (a.media[0]?.media_url ?? null) === (b.media[0]?.media_url ?? null) &&
    a.author?.display_name === b.author?.display_name &&
    a.author?.photos?.[0] === b.author?.photos?.[0] &&
    prev.isOwner === next.isOwner
  );
}

export default memo(CommunityPostCard, areEqual);

const styles = StyleSheet.create({
  postCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 14, marginBottom: 12, ...SHADOWS.subtle },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  postAuthor: { fontSize: 14, fontWeight: '700', color: COLORS.textDark },
  postTime: { fontSize: 11, color: COLORS.textMuted },
  postContent: { fontSize: 14, color: COLORS.textBody, lineHeight: 20, marginBottom: 8 },
  postImage: { width: '100%', height: 180, borderRadius: 10, marginBottom: 8 },
  postActions: { flexDirection: 'row', gap: 16 },
  postActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  postActionCount: { fontSize: 12, color: COLORS.textMuted, fontWeight: '600' },
});
