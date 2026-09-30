import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import Avatar from '../../../components/Avatar';
import { timeAgo, expiresIn } from '../../../utils/dateFormat';
import { COLORS, SHADOWS } from '../../../constants/colors';
import FullScreenImageModal from '../../../components/FullScreenImageModal';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default function PostCard({ post, currentUserId, onProfile, onDetail, onLikeToggle }) {
  const author = post.author;
  const media = post.media || [];
  const isLiked = post.isLiked;
  const likeCount = post.likeCount || 0;
  const commentCount = post.commentCount || 0;
  const isNotice = post.post_type === 'notice';
  const remaining = isNotice && post.expires_at ? expiresIn(post.expires_at) : null;
  const [photoViewer, setPhotoViewer] = useState({ visible: false, index: 0 });

  return (
    <View style={styles.card}>
      {/* Header */}
      <TouchableOpacity style={styles.cardHeader} onPress={() => onProfile(author?.id)} accessibilityRole="button" accessibilityLabel={`${author?.display_name ?? 'Kullanıcı'} profilini görüntüle`}>
        <Avatar profile={author} size={40} />
        <View style={{ marginLeft: 10, flex: 1 }}>
          <Text style={styles.authorName}>{author?.display_name ?? 'Kullanıcı'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Text style={styles.timeText}>{timeAgo(post.created_at)}</Text>
            {author?.city ? <Text style={styles.cityBadge}>{author.city}</Text> : null}
          </View>
        </View>
        {isNotice && remaining && (
          <View style={styles.noticeBadge}>
            <Ionicons name="time-outline" size={12} color={COLORS.warning} />
            <Text style={styles.noticeText}>{remaining}</Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Type badge */}
      {isNotice ? (
        <View style={[styles.typeBadge, { backgroundColor: COLORS.warningBg }]}>
          <Text style={[styles.typeBadgeText, { color: COLORS.warningText }]}>📢 Seslenış</Text>
        </View>
      ) : post.eventName ? (
        <View style={[styles.typeBadge, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={[styles.typeBadgeText, { color: COLORS.primary }]}>📸 {post.eventName}</Text>
        </View>
      ) : (
        <View style={[styles.typeBadge, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={[styles.typeBadgeText, { color: COLORS.primary }]}>📸 Ani</Text>
        </View>
      )}

      {/* Content */}
      <Text style={styles.contentText}>{post.content}</Text>

      {/* Location */}
      {post.location_text ? (
        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
          <Text style={styles.locationText}>{post.location_text}</Text>
        </View>
      ) : null}

      {/* Media */}
      {media.length > 0 && (
        <>
          <ScrollView
            horizontal
            pagingEnabled={media.length > 1}
            showsHorizontalScrollIndicator={false}
            style={styles.mediaScroll}
          >
            {media.map((m, i) => (
              <TouchableOpacity
                key={m.id || i}
                activeOpacity={0.9}
                onPress={() => setPhotoViewer({ visible: true, index: i })}
                accessibilityRole="button"
                accessibilityLabel={`Fotoğrafı tam ekran göster`}
              >
                <Image
                  source={{ uri: m.media_url }}
                  style={[styles.mediaImage, media.length === 1 && { width: SCREEN_WIDTH - 48 }]}
                  contentFit="cover"
                />
              </TouchableOpacity>
            ))}
          </ScrollView>
          <FullScreenImageModal
            uris={media.map((m) => m.media_url)}
            initialIndex={photoViewer.index}
            visible={photoViewer.visible}
            onClose={() => setPhotoViewer({ visible: false, index: 0 })}
          />
        </>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onLikeToggle(post)} accessibilityRole="button" accessibilityLabel={isLiked ? 'Begeniyi kaldir' : 'Begen'}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={22} color={isLiked ? COLORS.error : COLORS.textSecondary} />
          {likeCount > 0 && <Text style={[styles.actionCount, isLiked && { color: COLORS.error }]}>{likeCount}</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => onDetail(post)} accessibilityRole="button" accessibilityLabel="Yorumlar">
          <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
          {commentCount > 0 && <Text style={styles.actionCount}>{commentCount}</Text>}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 16,
    padding: 16,
    ...SHADOWS.card,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  authorName: { fontSize: 15, fontWeight: '700', color: COLORS.textDark },
  timeText: { fontSize: 12, color: COLORS.textMuted },
  cityBadge: { fontSize: 11, color: COLORS.textSecondary, backgroundColor: COLORS.inputBackground, paddingHorizontal: 6, paddingVertical: 1, borderRadius: 4, overflow: 'hidden' },
  noticeBadge: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#fffbeb', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 12 },
  noticeText: { fontSize: 11, fontWeight: '600', color: COLORS.warning },
  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 8 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },
  contentText: { fontSize: 15, color: COLORS.textBody, lineHeight: 22, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  locationText: { fontSize: 13, color: COLORS.textSecondary },
  mediaScroll: { marginBottom: 10, borderRadius: 12, overflow: 'hidden' },
  mediaImage: { width: SCREEN_WIDTH * 0.7, height: 200, borderRadius: 12, marginRight: 8 },
  actionsRow: { flexDirection: 'row', gap: 20, paddingTop: 4, borderTopWidth: 1, borderTopColor: COLORS.divider },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6 },
  actionCount: { fontSize: 13, color: COLORS.textSecondary, fontWeight: '600' },
});
