import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Dimensions, Alert } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { MotiView } from 'moti';
import Avatar from '../Avatar';
import AnimatedLikeButton from '../AnimatedLikeButton';
import AnimatedPressable from '../AnimatedPressable';
import { timeAgo, expiresIn } from '../../utils/dateFormat';
import { COLORS, SHADOWS } from '../../constants/colors';
import { lightImpact } from '../../utils/haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export default memo(function PostCard({ post, currentUserId, onProfile, onDetail, onLikeToggle, isSaved, onSaveToggle, onDelete, onEdit }) {
  const author = post.author;
  const media = post.media || [];
  const isLiked = post.isLiked;
  const likeCount = post.likeCount || 0;
  const commentCount = post.commentCount || 0;
  const isNotice = post.post_type === 'notice';
  const remaining = isNotice && post.expires_at ? expiresIn(post.expires_at) : null;
  const isOwner = currentUserId && post.author_id === currentUserId;

  const handleOptionsPress = () => {
    Alert.alert('Gönderi', null, [
      {
        text: 'Düzenle',
        onPress: () => onEdit?.(post),
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Gönderiyi Sil', 'Bu gönderiyi silmek istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Sil', style: 'destructive', onPress: () => onDelete?.(post.id) },
          ]),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  };

  return (
    <MotiView
      from={{ opacity: 0, translateY: 20 }}
      animate={{ opacity: 1, translateY: 0 }}
      transition={{ type: 'timing', duration: 400 }}
    >
      <View style={s.card}>
        {/* Header */}
        <TouchableOpacity style={s.cardHeader} onPress={() => onProfile(author?.id)} accessibilityRole="button" accessibilityLabel={`${author?.display_name ?? 'Kullanıcı'} profilini görüntüle`}>
          <Avatar profile={author} size={40} />
          <View style={{ marginLeft: 10, flex: 1 }}>
            <Text style={s.authorName}>{author?.display_name ?? 'Kullanıcı'}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={s.timeText}>{timeAgo(post.created_at)}</Text>
              {author?.city ? <Text style={s.cityBadge}>{author.city}</Text> : null}
            </View>
          </View>
          {isNotice && remaining && (
            <View style={s.noticeBadge}>
              <Ionicons name="time-outline" size={12} color={COLORS.warning} />
              <Text style={s.noticeText}>{remaining}</Text>
            </View>
          )}
          {isOwner && (
            <TouchableOpacity onPress={handleOptionsPress} style={s.deleteBtn} accessibilityRole="button" accessibilityLabel="Gönderi seçenekleri">
              <Ionicons name="ellipsis-horizontal" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* Type badge */}
        {isNotice ? (
          <View style={[s.typeBadge, { backgroundColor: COLORS.warningBg }]}>
            <Text style={[s.typeBadgeText, { color: COLORS.warningText }]}>📢 Sesleniş</Text>
          </View>
        ) : post.eventName ? (
          <View style={[s.typeBadge, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[s.typeBadgeText, { color: COLORS.primary }]}>{media.length > 0 ? '📸' : '✍️'} {post.eventName}</Text>
          </View>
        ) : (
          <View style={[s.typeBadge, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[s.typeBadgeText, { color: COLORS.primary }]}>{media.length > 0 ? '📸 Anı' : '✍️ Gönderi'}</Text>
          </View>
        )}

        {/* Tıklanabilir içerik alanı */}
        <TouchableOpacity onPress={() => onDetail(post)} activeOpacity={0.7}>

        {/* Content */}
        <Text style={s.contentText}>{post.content}</Text>

        {/* Location */}
        {post.location_text ? (
          <View style={s.locationRow}>
            <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
            <Text style={s.locationText}>{post.location_text}</Text>
          </View>
        ) : null}

        {/* Media */}
        {media.length > 0 && (
          <ScrollView
            horizontal
            pagingEnabled={media.length > 1}
            showsHorizontalScrollIndicator={false}
            style={s.mediaScroll}
          >
            {media.map((m, i) => (
              <Image
                key={m.id || i}
                source={{ uri: m.media_url }}
                style={[s.mediaImage, media.length === 1 && { width: SCREEN_WIDTH - 48 }]}
                contentFit="cover"
                accessibilityLabel={`Gönderi fotoğrafı ${i + 1}`}
              />
            ))}
          </ScrollView>
        )}

        </TouchableOpacity>

        {/* Actions */}
        <View style={s.actionsRow}>
          <AnimatedLikeButton
            isLiked={isLiked}
            likeCount={likeCount}
            onPress={() => onLikeToggle(post)}
          />
          <AnimatedPressable style={s.actionBtn} onPress={() => onDetail(post)} accessibilityRole="button" accessibilityLabel="Yorumlar">
            <Ionicons name="chatbubble-outline" size={20} color={COLORS.textSecondary} />
            {commentCount > 0 && <Text style={s.actionCount}>{commentCount}</Text>}
          </AnimatedPressable>
          <AnimatedPressable style={[s.actionBtn, { marginLeft: 'auto' }]} onPress={() => { lightImpact(); onSaveToggle(post); }} accessibilityRole="button" accessibilityLabel={isSaved ? 'Kaydedilenlerden çıkar' : 'Kaydet'}>
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? COLORS.primary : COLORS.textSecondary} />
          </AnimatedPressable>
        </View>
      </View>
    </MotiView>
  );
});

const s = StyleSheet.create({
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
  deleteBtn: { padding: 4, marginLeft: 8 },
});
