import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import Avatar from '../../components/Avatar';
import { timeAgo } from '../../utils/dateFormat';
import { COLORS } from '../../constants/colors';
import { LABELS, MESSAGES, PLACEHOLDERS } from '../../constants/strings';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import { handleError } from '../../utils/errorHandler';
import { toggleLike } from '../../utils/postHelpers';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const REPORT_REASONS = [
  'Uygunsuz davranış',
  'Spam / Reklam',
  'Taciz veya zorbalık',
  'Sahte profil',
  'Diğer',
];

// Alan-içi takma ad: sadece görüntüleme katmanında isim/foto değiştirir —
// author_id/reported_user_id her zaman gerçek kullanıcıyı gösterir.
async function resolveDisplayProfile(userId, communityId, baseProfile) {
  if (!baseProfile) return null;
  if (!communityId) return { ...baseProfile, isAlias: false };
  const { data: alias } = await supabase
    .from('user_communities')
    .select('alias_display_name, alias_avatar_url')
    .eq('user_id', userId)
    .eq('community_id', communityId)
    .maybeSingle();
  if (!alias?.alias_display_name) return { ...baseProfile, isAlias: false };
  return {
    ...baseProfile,
    display_name: alias.alias_display_name,
    photos: alias.alias_avatar_url ? [alias.alias_avatar_url] : null,
    isAlias: true,
  };
}

// ── Ayrı memo component — yazarken re-render olmaz ──────────
const CommentItem = React.memo(function CommentItem({
  item, prof, isMyComment, isEditing, editingText,
  onEditTextChange, onSaveEdit, onCancelEdit, onMenuPress, onReportPress, onProfilePress,
}) {
  return (
    <View style={styles.commentRow}>
      <TouchableOpacity onPress={() => onProfilePress(item.author_id)} accessibilityRole="button" accessibilityLabel={`${prof?.display_name ?? 'Kullanıcı'} profilini görüntüle`}>
        <Avatar profile={prof} size={32} />
      </TouchableOpacity>
      <View style={styles.commentBubble}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={styles.commentAuthor}>{prof?.display_name ?? 'Kullanıcı'}</Text>
          {!isEditing && (
            <TouchableOpacity
              onPress={() => isMyComment ? onMenuPress(item) : onReportPress(item)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={isMyComment ? 'Yorum seçenekleri' : 'Şikayet et'}
            >
              <Ionicons name={isMyComment ? 'ellipsis-horizontal' : 'flag-outline'} size={16} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        {isEditing ? (
          <View style={{ marginTop: 6 }}>
            <TextInput
              style={styles.editCommentInput}
              value={editingText}
              onChangeText={onEditTextChange}
              multiline
              autoFocus
              maxLength={500}
              accessibilityLabel="Yorumu düzenle"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TouchableOpacity onPress={onCancelEdit} style={styles.editCancelBtn} accessibilityRole="button" accessibilityLabel="İptal">
                <Text style={{ fontSize: 13, color: COLORS.textMuted }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => onSaveEdit(item.id)} style={styles.editSaveBtn} accessibilityRole="button" accessibilityLabel="Kaydet">
                <Text style={{ fontSize: 13, color: COLORS.white, fontWeight: '600' }}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <Text style={styles.commentContent}>{item.content}</Text>
        )}
        <Text style={styles.commentTime}>{timeAgo(item.created_at)}</Text>
      </View>
    </View>
  );
});

export default function PostDetailScreen({ route, navigation }) {
  const { postId } = route.params;
  const { user } = useAuth();
  const setCommentCountUpdate = useAppStore((s) => s.setCommentCountUpdate);

  const [post, setPost] = useState(null);
  const [author, setAuthor] = useState(null);
  // Bu alanda takma ad kullanan yazarların id'leri — profiline gidilmesini
  // engellemek için (aksi halde alias görüntüleme katmanı, profile tıklayınca
  // gerçek kimliği açık ederdi)
  const [aliasedUserIds, setAliasedUserIds] = useState(new Set());
  const [media, setMedia] = useState([]);
  const [comments, setComments] = useState([]);
  const [commentProfiles, setCommentProfiles] = useState({});
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [eventName, setEventName] = useState(null);
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [editingCommentText, setEditingCommentText] = useState('');

  // Report
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportTargetId, setReportTargetId] = useState(null);
  const [reportPostId, setReportPostId] = useState(null);
  const [reportCommentId, setReportCommentId] = useState(null);
  const [reporting, setReporting] = useState(false);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);

  useEffect(() => {
    loadPost();
    loadComments();
    subscribeToComments();
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  }, [postId]);

  const loadPost = async () => {
    try {
      const { data: p } = await supabase
        .from('posts')
        .select('*')
        .eq('id', postId)
        .single();
      if (!p) return;
      setPost(p);

      // Author
      const { data: prof } = await supabase
        .from('profiles')
        .select('id, display_name, photos, city')
        .eq('id', p.author_id)
        .single();
      const resolvedAuthor = await resolveDisplayProfile(p.author_id, p.community_id, prof);
      setAuthor(resolvedAuthor);
      if (resolvedAuthor?.isAlias) {
        setAliasedUserIds((prev) => new Set(prev).add(p.author_id));
      }

      // Media
      const { data: mediaRows } = await supabase
        .from('post_media')
        .select('id, media_url, media_order')
        .eq('post_id', postId)
        .order('media_order', { ascending: true });
      setMedia(mediaRows ?? []);

      // Event name
      if (p.related_event_id) {
        const { data: ev } = await supabase.from('events').select('title').eq('id', p.related_event_id).single();
        setEventName(ev?.title ?? null);
      }

      // Likes
      const { data: likes } = await supabase.from('post_likes').select('user_id').eq('post_id', postId);
      setLikeCount((likes ?? []).length);
      setIsLiked((likes ?? []).some((l) => l.user_id === user?.id));

      // Saved
      if (user?.id) {
        const { data: saved } = await supabase.from('saved_posts').select('post_id').eq('user_id', user.id).eq('post_id', postId).maybeSingle();
        setIsSaved(!!saved);
      }
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Gönderi yüklenirken', err);
    } finally {
      setLoading(false);
    }
  };

  const loadComments = async () => {
    try {
      const { data: rows, error } = await supabase
        .from('post_comments')
        .select('id, author_id, content, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const commentsList = rows ?? [];
      setComments(commentsList);

      const authorIds = [...new Set(commentsList.map((c) => c.author_id))];
      if (authorIds.length > 0) {
        const [{ data: profiles }, { data: postRow }] = await Promise.all([
          supabase.from('profiles').select('id, display_name, photos').in('id', authorIds),
          supabase.from('posts').select('community_id').eq('id', postId).single(),
        ]);
        const communityId = postRow?.community_id ?? null;

        let aliasMap = {};
        if (communityId) {
          const { data: aliases } = await supabase
            .from('user_communities')
            .select('user_id, alias_display_name, alias_avatar_url')
            .in('user_id', authorIds)
            .eq('community_id', communityId);
          aliasMap = Object.fromEntries(
            (aliases ?? []).filter((a) => a.alias_display_name).map((a) => [a.user_id, a])
          );
        }

        const map = Object.fromEntries((profiles ?? []).map((p) => {
          const alias = aliasMap[p.id];
          const resolved = alias
            ? { ...p, display_name: alias.alias_display_name, photos: alias.alias_avatar_url ? [alias.alias_avatar_url] : null }
            : p;
          return [p.id, resolved];
        }));
        setCommentProfiles((prev) => ({ ...prev, ...map }));

        const newAliasedIds = Object.keys(aliasMap);
        if (newAliasedIds.length > 0) {
          setAliasedUserIds((prev) => {
            const next = new Set(prev);
            newAliasedIds.forEach((id) => next.add(id));
            return next;
          });
        }
      }
    } catch {
      // Yorumlar yüklenemedi — sessizce geç, ekran boş kalır
    }
  };

  const subscribeToComments = () => {
    channelRef.current = supabase
      .channel(`post_comments:${postId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'post_comments',
        filter: `post_id=eq.${postId}`,
      }, async (payload) => {
        const newComment = payload.new;
        setComments((prev) => {
          if (prev.find((c) => c.id === newComment.id)) return prev;
          return [...prev, newComment];
        });
        // Load profile if needed
        if (!commentProfiles[newComment.author_id]) {
          const [{ data: prof }, { data: postRow }] = await Promise.all([
            supabase.from('profiles').select('id, display_name, photos').eq('id', newComment.author_id).single(),
            supabase.from('posts').select('community_id').eq('id', postId).single(),
          ]);
          if (prof) {
            const resolved = await resolveDisplayProfile(newComment.author_id, postRow?.community_id, prof);
            setCommentProfiles((prev) => ({ ...prev, [resolved.id]: resolved }));
            if (resolved.isAlias) {
              setAliasedUserIds((prev) => new Set(prev).add(resolved.id));
            }
          }
        }
      })
      .subscribe();
  };

  const handleLikeToggle = async () => {
    if (!user) return;
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikeCount((c) => wasLiked ? c - 1 : c + 1);
    toggleLike(user.id, postId, wasLiked);
  };

  const handleSaveToggle = async () => {
    if (!user) return;
    const wasSaved = isSaved;
    setIsSaved(!wasSaved); // optimistic
    try {
      const { error } = await runWithBackgroundRetry(() =>
        wasSaved
          ? supabase.from('saved_posts').delete().eq('user_id', user.id).eq('post_id', postId)
          : supabase.from('saved_posts').insert({ user_id: user.id, post_id: postId })
      );
      if (error) throw error;
    } catch {
      setIsSaved(wasSaved); // rollback
    }
  };

  const handleSendComment = async () => {
    const trimmed = commentText.trim();
    if (!trimmed || sending || !user) return;

    setSending(true);

    const tempId = `temp-${Date.now()}`;
    const optimisticComment = {
      id: tempId,
      post_id: postId,
      author_id: user.id,
      content: trimmed,
      created_at: new Date().toISOString(),
    };

    const previousComments = comments;

    try {
      // Yorumu ekranda hemen göster
      setComments((prev) => [...prev, optimisticComment]);
      setCommentText('');

      // Kendi profilimiz commentProfiles içinde yoksa ekleyelim
      setCommentProfiles((prev) => {
        if (prev[user.id]) return prev;
        return {
          ...prev,
          [user.id]: {
            id: user.id,
            display_name: 'Sen',
            photos: [],
          },
        };
      });

      setCommentCountUpdate(postId, previousComments.length + 1);
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);

      const { data: insertedComment, error } = await runWithBackgroundRetry(() =>
        supabase
          .from('post_comments')
          .insert({
            post_id: postId,
            author_id: user.id,
            content: trimmed,
          })
          .select('id, author_id, content, created_at')
          .single()
      );

      if (error) throw error;

      // Temp yorumu gerçek yorumla değiştir
      setComments((prev) =>
        prev.map((c) => (c.id === tempId ? insertedComment : c))
      );
    } catch (err) {
      // Hata olursa optimistic yorumu geri al
      setComments(previousComments);
      setCommentCountUpdate(postId, previousComments.length);

      if (__DEV__) console.error(err);
      handleError('Yorum gönderilirken', err);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('post_comments').delete().eq('id', commentId)
      );
      if (error) throw error;
      setComments((prev) => {
        const next = prev.filter((c) => c.id !== commentId);
        setCommentCountUpdate(postId, next.length);
        return next;
      });
    } catch (err) {
      handleError('Yorum silinirken', err, { onRetry: () => handleDeleteComment(commentId) });
    }
  };

  const handleSaveCommentEdit = async (commentId) => {
    const trimmed = editingCommentText.trim();
    if (!trimmed) return;
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('post_comments').update({ content: trimmed }).eq('id', commentId)
      );
      if (error) throw error;
      setComments((prev) => prev.map((c) => c.id === commentId ? { ...c, content: trimmed } : c));
    } catch (err) {
      handleError('Yorum düzenlenirken', err, { onRetry: () => handleSaveCommentEdit(commentId) });
      return;
    }
    setEditingCommentId(null);
    setEditingCommentText('');
  };

  const showCommentMenu = useCallback((item) => {
    Alert.alert('Yorum', null, [
      {
        text: 'Düzenle',
        onPress: () => {
          setEditingCommentId(item.id);
          setEditingCommentText(item.content);
        },
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Yorumu Sil', 'Bu yorumu silmek istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Sil', style: 'destructive', onPress: () => handleDeleteComment(item.id) },
          ]),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }, [editingCommentId]);

  const handleReportComment = useCallback((item) => {
    setReportTargetId(item.author_id);
    setReportPostId(null);
    setReportCommentId(item.id);
    setReportReason('');
    setReportVisible(true);
  }, []);

  const handleReportPost = () => {
    setReportTargetId(post.author_id);
    setReportPostId(post.id);
    setReportCommentId(null);
    setReportReason('');
    setReportVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportTargetId) return;
    setReporting(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('reports').insert({
          reporter_id: user.id,
          reported_user_id: reportTargetId,
          post_id: reportPostId,
          comment_id: reportCommentId,
          reason: reportReason,
        })
      );
      if (error) throw error;
      setReportVisible(false);
      Alert.alert('Teşekkürler', 'Şikayetiniz iletildi. Ekibimiz en kısa sürede inceleyecek.');
    } catch {
      Alert.alert('Hata', 'Şikayet gönderilemedi, tekrar dene.');
    } finally {
      setReporting(false);
    }
  };

  const navigateToProfile = (userId) => {
    if (!userId || userId === user?.id) return;
    if (aliasedUserIds.has(userId)) {
      Alert.alert('Profil Gizli', 'Bu kişi bu alanda takma ad kullanıyor, profili görüntülenemez.');
      return;
    }
    navigation.navigate('ProfileDetail', { userId });
  };

  const handleDeletePost = async () => {
    try {
      // Delete related media
      await runWithBackgroundRetry(() => supabase.from('post_media').delete().eq('post_id', postId));
      // Delete comments
      await runWithBackgroundRetry(() => supabase.from('post_comments').delete().eq('post_id', postId));
      // Delete likes
      await runWithBackgroundRetry(() => supabase.from('post_likes').delete().eq('post_id', postId));
      // Delete the post
      const { error } = await runWithBackgroundRetry(() => supabase.from('posts').delete().eq('id', postId));
      if (error) throw error;
      navigation.goBack();
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Gönderi silinirken', err, { onRetry: handleDeletePost });
    }
  };

  const canConvertToEvent = !!post && post.post_type !== 'moment' && !post.related_event_id;

  const handleConvertToEvent = () => {
    navigation.navigate('CreateEvent', {
      prefill: {
        title: post.content.trim().slice(0, 60),
        description: post.content.trim(),
        communityId: post.community_id ?? null,
      },
      sourcePostId: post.id,
    });
  };

  const showPostMenu = () => {
    Alert.alert(null, null, [
      {
        text: 'Düzenle',
        onPress: () => navigation.navigate('CreatePost', { postType: post.post_type, editPost: post, editMedia: media }),
      },
      ...(canConvertToEvent ? [{
        text: 'Bu Gönderiyi Etkinliğe Çevir',
        onPress: handleConvertToEvent,
      }] : []),
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Gönderiyi Sil', 'Bu gönderiyi silmek istediğine emin misin?', [
            { text: 'İptal', style: 'cancel' },
            { text: 'Sil', style: 'destructive', onPress: handleDeletePost },
          ]);
        },
      },
      { text: 'İptal', style: 'cancel' },
    ]);
  };

  const renderComment = useCallback(({ item }) => (
    <CommentItem
      item={item}
      prof={commentProfiles[item.author_id]}
      isMyComment={item.author_id === user?.id}
      isEditing={editingCommentId === item.id}
      editingText={editingCommentText}
      onEditTextChange={setEditingCommentText}
      onSaveEdit={handleSaveCommentEdit}
      onCancelEdit={() => { setEditingCommentId(null); setEditingCommentText(''); }}
      onMenuPress={showCommentMenu}
      onReportPress={handleReportComment}
      onProfilePress={navigateToProfile}
    />
  ), [commentProfiles, user, editingCommentId, editingCommentText, showCommentMenu, handleReportComment]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingState />
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={LABELS.back}>
            <Ionicons name="arrow-back" size={24} color={COLORS.textBody} />
          </TouchableOpacity>
        </View>
        <View style={{ alignItems: 'center', marginTop: 60 }}>
          <Text style={{ fontSize: 16, color: COLORS.textMuted }}>Gönderi bulunamadı</Text>
        </View>
      </SafeAreaView>
    );
  }

  const isNotice = post.post_type === 'notice';

  const PostHeader = () => (
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
      {/* Author */}
      <TouchableOpacity style={styles.authorRow} onPress={() => navigateToProfile(author?.id)} accessibilityRole="button" accessibilityLabel={`${author?.display_name ?? 'Kullanıcı'} profilini görüntüle`}>
        <Avatar profile={author} size={44} />
        <View style={{ marginLeft: 12 }}>
          <Text style={styles.authorName}>{author?.display_name ?? 'Kullanıcı'}</Text>
          <Text style={styles.timeText}>{timeAgo(post.created_at)} {author?.city ? `· ${author.city}` : ''}</Text>
        </View>
      </TouchableOpacity>

      {/* Type badge */}
      {isNotice ? (
        <View style={[styles.typeBadge, { backgroundColor: COLORS.warningBg }]}>
          <Text style={[styles.typeBadgeText, { color: COLORS.warningText }]}>📢 Sesleniş</Text>
        </View>
      ) : eventName ? (
        <View style={[styles.typeBadge, { backgroundColor: COLORS.primaryLight }]}>
          <Text style={[styles.typeBadgeText, { color: COLORS.primary }]}>📸 {eventName}</Text>
        </View>
      ) : null}

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
        <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={media.length > 1} style={{ marginVertical: 12 }}>
          {media.map((m, i) => (
            <Image
              key={m.id || i}
              source={{ uri: m.media_url }}
              style={{ width: SCREEN_WIDTH - 32, height: 280, borderRadius: 12, marginRight: media.length > 1 ? 8 : 0 }}
              contentFit="cover"
              accessibilityLabel={`Gönderi fotoğrafı ${i + 1}`}
            />
          ))}
        </ScrollView>
      )}

      {/* Actions */}
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={handleLikeToggle} accessibilityRole="button" accessibilityLabel={isLiked ? 'Beğeniyi kaldır' : 'Beğen'}>
          <Ionicons name={isLiked ? 'heart' : 'heart-outline'} size={24} color={isLiked ? COLORS.error : COLORS.textSecondary} />
          {likeCount > 0 && <Text style={[styles.actionCount, isLiked && { color: COLORS.error }]}>{likeCount}</Text>}
        </TouchableOpacity>
        <View style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={22} color={COLORS.textSecondary} />
          {comments.length > 0 && <Text style={styles.actionCount}>{comments.length}</Text>}
        </View>
        <TouchableOpacity style={[styles.actionBtn, { marginLeft: 'auto' }]} onPress={handleSaveToggle} accessibilityRole="button" accessibilityLabel={isSaved ? 'Kaydedilenlerden çıkar' : 'Kaydet'}>
          <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={22} color={isSaved ? COLORS.primary : COLORS.textSecondary} />
        </TouchableOpacity>
      </View>

      {/* Divider */}
      <View style={styles.divider} />
      <Text style={styles.commentsTitle}>{LABELS.comments}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={LABELS.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textBody} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{LABELS.post}</Text>
        {post.author_id === user?.id ? (
          <TouchableOpacity onPress={showPostMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Gönderi seçenekleri">
            <Ionicons name="ellipsis-horizontal" size={24} color={COLORS.textBody} />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={handleReportPost} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel="Şikayet et">
            <Ionicons name="flag-outline" size={22} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <FlashList
          ref={flatListRef}
          data={comments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          estimatedItemSize={90}
          ListHeaderComponent={PostHeader}
          contentContainerStyle={{ paddingBottom: 16 }}
          ListEmptyComponent={
            <EmptyState icon="chatbubble-ellipses-outline" title={MESSAGES.noComments} description="İlk yorumu sen yap!" />
          }
        />

        {/* Comment Input */}
        <View style={styles.inputBar}>
          <TextInput
            style={styles.commentInput}
            placeholder={PLACEHOLDERS.writeComment}
            placeholderTextColor={COLORS.textMuted}
            value={commentText}
            onChangeText={setCommentText}
            maxLength={500}
            accessibilityLabel="Yorum yaz"
          />
          <TouchableOpacity
            style={[styles.sendBtn, !commentText.trim() && { opacity: 0.4 }]}
            onPress={handleSendComment}
            disabled={!commentText.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Yorum gönder"
          >
            {sending ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={18} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* Report Modal */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <Pressable style={styles.reportOverlay} onPress={() => setReportVisible(false)}>
          <View style={styles.reportSheet}>
            <View style={styles.reportHandle} />
            <Text style={styles.reportTitle}>Şikayet Nedeni</Text>
            <Text style={styles.reportSub}>Lütfen bir neden seçin</Text>
            {REPORT_REASONS.map((reason) => (
              <TouchableOpacity
                key={reason}
                style={[styles.reasonItem, reportReason === reason && styles.reasonItemSelected]}
                onPress={() => setReportReason(reason)}
                accessibilityRole="button"
                accessibilityLabel={reason}
              >
                <View style={[styles.reasonRadio, reportReason === reason && styles.reasonRadioSelected]}>
                  {reportReason === reason && <View style={styles.reasonRadioDot} />}
                </View>
                <Text style={[styles.reasonText, reportReason === reason && styles.reasonTextSelected]}>{reason}</Text>
              </TouchableOpacity>
            ))}
            <TouchableOpacity
              style={[styles.reportSubmitBtn, !reportReason && styles.reportSubmitBtnDisabled]}
              onPress={handleSubmitReport}
              disabled={!reportReason || reporting}
              accessibilityRole="button"
              accessibilityLabel="Şikayeti gönder"
            >
              {reporting ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Text style={styles.reportSubmitText}>Gönder</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportCancelBtn} onPress={() => setReportVisible(false)} accessibilityRole="button" accessibilityLabel="Vazgeç">
              <Text style={styles.reportCancelText}>Vazgeç</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBackground,
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textDark },

  authorRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16, marginBottom: 12 },
  authorName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark },
  timeText: { fontSize: 13, color: COLORS.textMuted, marginTop: 2 },

  typeBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  typeBadgeText: { fontSize: 12, fontWeight: '600' },

  contentText: { fontSize: 16, color: COLORS.textBody, lineHeight: 24, marginBottom: 8 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 8 },
  locationText: { fontSize: 13, color: COLORS.textSecondary },

  actionsRow: { flexDirection: 'row', gap: 24, paddingVertical: 10 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionCount: { fontSize: 14, color: COLORS.textSecondary, fontWeight: '600' },

  divider: { height: 1, backgroundColor: COLORS.inputBackground, marginVertical: 8 },
  commentsTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textBody, marginBottom: 8 },

  commentRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 6, gap: 10 },
  commentBubble: { flex: 1, backgroundColor: COLORS.background, borderRadius: 12, padding: 10 },
  commentAuthor: { fontSize: 13, fontWeight: '700', color: COLORS.textBody },
  commentContent: { fontSize: 14, color: '#4b5563', marginTop: 2, lineHeight: 20 },
  commentTime: { fontSize: 11, color: COLORS.textPlaceholder, marginTop: 4 },
  editCommentInput: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 8,
    fontSize: 14,
    color: COLORS.textDark,
  },
  editCancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.inputBackground,
  },
  editSaveBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: COLORS.inputBackground,
    backgroundColor: COLORS.white,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: COLORS.inputBackground,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: COLORS.textDark,
    maxHeight: 100,
  },
  sendBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Report
  reportOverlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: 'flex-end' },
  reportSheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40 },
  reportHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.border, alignSelf: 'center', marginBottom: 16 },
  reportTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 4 },
  reportSub: { fontSize: 14, color: COLORS.textMuted, marginBottom: 16 },
  reasonItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: COLORS.inputBackground },
  reasonItemSelected: { backgroundColor: '#faf8ff' },
  reasonRadio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: COLORS.textPlaceholder, justifyContent: 'center', alignItems: 'center' },
  reasonRadioSelected: { borderColor: COLORS.primary },
  reasonRadioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  reasonText: { fontSize: 15, color: COLORS.textBody },
  reasonTextSelected: { color: COLORS.primary, fontWeight: '600' },
  reportSubmitBtn: { marginTop: 20, backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  reportSubmitBtnDisabled: { backgroundColor: COLORS.textPlaceholder },
  reportSubmitText: { color: COLORS.white, fontSize: 16, fontWeight: '700' },
  reportCancelBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center', backgroundColor: COLORS.inputBackground, borderRadius: 14 },
  reportCancelText: { fontSize: 15, color: COLORS.textSecondary, fontWeight: '600' },
});
