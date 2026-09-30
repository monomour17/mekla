import React, { memo, useCallback, useEffect, useRef, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import Avatar from '../../components/Avatar';
import { timeAgo } from '../../utils/dateFormat';
import { uploadPhoto, pickFromGallery } from '../../utils/photos';
import { COLORS, SHADOWS } from '../../constants/colors';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import FullScreenImageModal from '../../components/FullScreenImageModal';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';
import { enrichPosts as enrichPostsUtil, toggleLike, optimisticToggleLike } from '../../utils/postHelpers';
import { LABELS, MESSAGES, PLACEHOLDERS } from '../../constants/strings';
import PollCard from '../../components/meydan/PollCard';
import CreatePollModal from '../../components/meydan/CreatePollModal';
import CommunityPostCard from '../../components/meydan/CommunityPostCard';

const REPORT_REASONS = [
  'Uygunsuz davranış',
  'Spam / Reklam',
  'Taciz veya zorbalık',
  'Sahte profil',
  'Diğer',
];

/* ===================== FEED TAB ===================== */
function FeedTab({ communityId, communityName, userId, navigation }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [postPhotoViewer, setPostPhotoViewer] = useState({ visible: false, uris: [], index: 0 });
  const setFeedStale = useAppStore((s) => s.setFeedStale);
  const pendingNewPost = useAppStore((s) => s.pendingNewPost);
  const setPendingNewPost = useAppStore((s) => s.setPendingNewPost);
  const commentCountUpdates = useAppStore((s) => s.commentCountUpdates);
  const clearCommentCountUpdate = useAppStore((s) => s.clearCommentCountUpdate);

  // Anket state
  const [polls, setPolls] = useState([]);
  const [pollModalVisible, setPollModalVisible] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [isCommunityCreator, setIsCommunityCreator] = useState(false);

  // Topluluk yaratıcısı mı?
  useEffect(() => {
    supabase
      .from('communities')
      .select('created_by')
      .eq('id', communityId)
      .single()
      .then(({ data }) => { if (data?.created_by === userId) setIsCommunityCreator(true); });
  }, [communityId, userId]);

  const loadPolls = useCallback(async () => {
    const { data: pollRows } = await supabase
      .from('community_polls')
      .select('*')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!pollRows?.length) { setPolls([]); return; }

    const pollIds = pollRows.map((p) => p.id);
    const [{ data: votes }, { data: myVotes }] = await Promise.all([
      supabase.from('community_poll_votes').select('poll_id, option_index').in('poll_id', pollIds),
      supabase.from('community_poll_votes').select('poll_id, option_index').in('poll_id', pollIds).eq('user_id', userId),
    ]);

    const myVoteMap = Object.fromEntries((myVotes ?? []).map((v) => [v.poll_id, v.option_index]));
    const countMap = {};
    (votes ?? []).forEach(({ poll_id, option_index }) => {
      if (!countMap[poll_id]) countMap[poll_id] = {};
      countMap[poll_id][option_index] = (countMap[poll_id][option_index] ?? 0) + 1;
    });

    setPolls(pollRows.map((p) => ({ ...p, myVote: myVoteMap[p.id] ?? null, voteCounts: countMap[p.id] ?? {} })));
  }, [communityId, userId]);

  const handleCreatePoll = async ({ question, options, ends_at }) => {
    setPollSubmitting(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('community_polls').insert({
          community_id: communityId,
          creator_id: userId,
          question,
          options,
          ends_at,
        })
      );
      if (error) throw error;
      setPollModalVisible(false);
      await loadPolls();
    } catch (err) {
      handleError('Anket oluşturulurken', err, { onRetry: () => handleCreatePoll({ question, options, ends_at }) });
    } finally {
      setPollSubmitting(false);
    }
  };

  const deletePoll = async (pollId) => {
    try {
      const { error } = await runWithBackgroundRetry(() => supabase.from('community_polls').delete().eq('id', pollId));
      if (error) throw error;
      setPolls((prev) => prev.filter((p) => p.id !== pollId));
    } catch (err) {
      handleError('Anket silinirken', err, { onRetry: () => deletePoll(pollId) });
    }
  };

  const handleDeletePoll = (pollId) => {
    Alert.alert('Anketi Sil', 'Bu anketi silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deletePoll(pollId) },
    ]);
  };

  const loadPosts = useCallback(async () => {
    try {
      const now = new Date().toISOString();
      const { data: rawPosts } = await supabase
        .from('posts')
        .select('id, author_id, post_type, content, related_event_id, location_text, created_at, expires_at')
        .eq('community_id', communityId)
        .order('created_at', { ascending: false })
        .limit(50);

      const filtered = (rawPosts ?? []).filter((p) => {
        if (p.post_type === 'notice' && p.expires_at && new Date(p.expires_at) < new Date(now)) return false;
        return true;
      });

      if (filtered.length === 0) { setPosts([]); return; }

      const enriched = await enrichPostsUtil(filtered, userId, { communityId });
      setPosts(enriched);
    } catch (err) { if (__DEV__) console.error(err); handleError('Gönderiler yüklenirken', err); } finally { setLoading(false); }
  }, [communityId, userId]);

  useEffect(() => { loadPosts(); loadPolls(); }, [loadPosts, loadPolls]);

  // Prepend newly created post without refetch
  useEffect(() => {
    if (pendingNewPost && pendingNewPost.community_id === communityId) {
      setPosts((prev) => {
        if (prev.find((p) => p.id === pendingNewPost.id)) return prev;
        return [pendingNewPost, ...prev];
      });
      setPendingNewPost(null);
    }
  }, [pendingNewPost, communityId]);

  // Apply comment count updates without refetch
  useEffect(() => {
    const updates = Object.entries(commentCountUpdates);
    if (updates.length === 0) return;
    setPosts((prev) => {
      let changed = false;
      const next = prev.map((p) => {
        if (commentCountUpdates[p.id] !== undefined) {
          changed = true;
          return { ...p, commentCount: commentCountUpdates[p.id] };
        }
        return p;
      });
      return changed ? next : prev;
    });
    updates.forEach(([id]) => clearCommentCountUpdate(id));
  }, [commentCountUpdates]);

  // CommunityPostCard memo() ile sarılı — bu handler'ların her render'da
  // yeniden oluşturulması memo'yu etkisiz kılıp görünen tüm kartların
  // gereksiz yere yeniden render olmasına yol açardı (bkz. MeydanScreen'de
  // aynı sebepten yapılan düzeltme).
  const handleLike = useCallback((post) => {
    setPosts((prev) => optimisticToggleLike(prev, post.id));
    toggleLike(userId, post.id, post.isLiked);
  }, [userId]);

  const handleDeletePost = useCallback(async (postId) => {
    const { error } = await runWithBackgroundRetry(() => supabase.from('posts').delete().eq('id', postId));
    if (!error) setPosts((prev) => prev.filter((p) => p.id !== postId));
    else handleError('Gönderi silinirken', error, { onRetry: () => handleDeletePost(postId) });
  }, []);

  const showPostMenu = useCallback((item) => {
    Alert.alert('Gönderi', null, [
      {
        text: 'Düzenle',
        onPress: () => navigation.navigate('CreatePost', {
          editPost: item,
          editMedia: item.media ?? [],
        }),
      },
      {
        text: 'Sil',
        style: 'destructive',
        onPress: () =>
          Alert.alert('Gönderiyi Sil', 'Bu gönderiyi silmek istediğine emin misin?', [
            { text: 'Vazgeç', style: 'cancel' },
            { text: 'Sil', style: 'destructive', onPress: () => handleDeletePost(item.id) },
          ]),
      },
      { text: 'Vazgeç', style: 'cancel' },
    ]);
  }, [navigation, handleDeletePost]);

  const navigateToPostDetail = useCallback((post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  }, [navigation]);

  const openPhotoViewer = useCallback((post) => {
    setPostPhotoViewer({
      visible: true,
      uris: post.media.map((m) => m.media_url),
      index: 0,
    });
  }, []);

  const onRefresh = async () => { setRefreshing(true); await Promise.all([loadPosts(), loadPolls()]); setRefreshing(false); };

  if (loading) return <LoadingState />;

  const renderItem = ({ item }) => (
    <CommunityPostCard
      post={item}
      isOwner={item.author_id === userId}
      onPress={navigateToPostDetail}
      onMenuPress={showPostMenu}
      onLikeToggle={handleLike}
      onPhotoPress={openPhotoViewer}
    />
  );

  const pollsHeader = polls.length > 0 ? (
    <View style={styles.pollsSection}>
      <View style={styles.pollsSectionHeader}>
        <Ionicons name="bar-chart" size={15} color={COLORS.primary} />
        <Text style={styles.pollsSectionTitle}>Anketler</Text>
      </View>
      {polls.map((poll) => (
        <PollCard
          key={poll.id}
          poll={poll}
          userId={userId}
          isCreator={poll.creator_id === userId}
          onDelete={handleDeletePoll}
        />
      ))}
    </View>
  ) : null;

  return (
    <View style={{ flex: 1 }}>
      <FlashList
        data={posts}
        keyExtractor={(i) => i.id}
        renderItem={renderItem}
        estimatedItemSize={260}
        contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListHeaderComponent={pollsHeader}
        ListEmptyComponent={
          <EmptyState icon="document-text-outline" title={MESSAGES.noPosts} description="Bu toplulukta ilk seslenişi sen yap!" />
        }
      />

      {/* FAB grubu */}
      <View style={styles.fabGroup}>
        {isCommunityCreator && (
          <TouchableOpacity
            style={[styles.fab, styles.fabSecondary]}
            onPress={() => setPollModalVisible(true)}
            accessibilityRole="button"
            accessibilityLabel="Anket oluştur"
          >
            <Ionicons name="bar-chart" size={22} color={COLORS.primary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.fab, styles.fabSecondary]}
          onPress={() => navigation.navigate('CreateEvent', { communityId, communityName })}
          accessibilityRole="button"
          accessibilityLabel="Bu alan için etkinlik oluştur"
        >
          <Ionicons name="calendar" size={20} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('CreatePost', { postType: 'post', communityId })}
          accessibilityRole="button"
          accessibilityLabel="Yeni gönderi oluştur"
        >
          <Ionicons name="add" size={28} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      <FullScreenImageModal
        uris={postPhotoViewer.uris}
        initialIndex={postPhotoViewer.index}
        visible={postPhotoViewer.visible}
        onClose={() => setPostPhotoViewer({ visible: false, uris: [], index: 0 })}
      />

      <CreatePollModal
        visible={pollModalVisible}
        loading={pollSubmitting}
        onSubmit={handleCreatePoll}
        onClose={() => setPollModalVisible(false)}
      />
    </View>
  );
}

/* ===================== CHAT TAB ===================== */
const CommunityMessageBubble = memo(function CommunityMessageBubble({
  item, isMe, prof, isEditing, editingText,
  onEditTextChange, onSaveEdit, onCancelEdit, onLongPress, onImagePress,
}) {
  return (
    <View style={[styles.msgRow, isMe && styles.msgRowMe]}>
      {!isMe && <Avatar profile={prof} size={32} />}
      <Pressable
        onLongPress={() => onLongPress(item)}
        delayLongPress={300}
        style={[styles.msgBubble, isMe ? styles.msgBubbleMe : styles.msgBubbleOther, { flexShrink: 1 }]}
        accessibilityRole="button"
        accessibilityLabel="Mesaj seçenekleri için basılı tut"
      >
        {!isMe && <Text style={styles.msgSender}>{prof?.display_name ?? 'Kullanıcı'}</Text>}
        {isEditing ? (
          <View>
            <TextInput
              style={[styles.msgEditInput, { color: isMe ? COLORS.white : COLORS.textDark }]}
              value={editingText}
              onChangeText={onEditTextChange}
              multiline
              autoFocus
              maxLength={1000}
              accessibilityLabel="Mesajı düzenle"
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TouchableOpacity
                onPress={onCancelEdit}
                style={[styles.msgEditCancelBtn, !isMe && { backgroundColor: COLORS.border }]}
                accessibilityRole="button"
                accessibilityLabel="İptal"
              >
                <Text style={{ fontSize: 12, color: COLORS.textMuted }}>İptal</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => onSaveEdit(item.id)}
                style={styles.msgEditSaveBtn}
                accessibilityRole="button"
                accessibilityLabel="Kaydet"
              >
                <Text style={{ fontSize: 12, color: COLORS.white, fontWeight: '600' }}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <>
            {item.media_url && (
              <TouchableOpacity onPress={() => onImagePress(item.media_url)} accessibilityRole="button" accessibilityLabel="Fotoğrafı büyüt">
                <Image source={{ uri: item.media_url }} style={styles.msgImage} contentFit="cover" />
              </TouchableOpacity>
            )}
            {item.content && item.content !== '📷 Fotoğraf' && (
              <Text style={[styles.msgText, isMe && { color: COLORS.white }]}>{item.content}</Text>
            )}
          </>
        )}
        <Text style={[styles.msgTime, isMe && { color: 'rgba(255,255,255,0.6)' }]}>{timeAgo(item.created_at)}</Text>
      </Pressable>
    </View>
  );
});

function ChatTab({ communityId, userId }) {
  const [messages, setMessages] = useState([]);
  const [profiles, setProfiles] = useState({});
  const profilesRef = useRef({});
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  // Long-press context menu
  const [menuVisible, setMenuVisible] = useState(false);
  const [menuMessage, setMenuMessage] = useState(null);

  // Inline edit
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');

  // Fullscreen image
  const [fullScreenImage, setFullScreenImage] = useState(null);

  // Report
  const [reportVisible, setReportVisible] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportTargetId, setReportTargetId] = useState(null);
  const [reporting, setReporting] = useState(false);

  const flatListRef = useRef(null);
  const channelRef = useRef(null);

  // Keep ref in sync with state
  useEffect(() => { profilesRef.current = profiles; }, [profiles]);

  useEffect(() => {
    loadMessages();
    const channel = supabase
      .channel(`community_messages:${communityId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'community_messages',
        filter: `community_id=eq.${communityId}`,
      }, (payload) => {
        const msg = payload.new;
        setMessages((prev) => {
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        loadProfileIfNeeded(msg.sender_id);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .subscribe();
    channelRef.current = channel;
    return () => { if (channelRef.current) supabase.removeChannel(channelRef.current); };
  }, [communityId]);

  const loadMessages = async () => {
    try {
      const { data } = await supabase
        .from('community_messages')
        .select('*')
        .eq('community_id', communityId)
        .order('created_at', { ascending: true })
        .limit(200);
      const msgs = data ?? [];
      setMessages(msgs);

      const senderIds = [...new Set(msgs.map((m) => m.sender_id))];
      if (senderIds.length > 0) {
        const [{ data: profs }, { data: aliases }] = await Promise.all([
          supabase.from('profiles').select('id, display_name, photos').in('id', senderIds),
          supabase.from('user_communities').select('user_id, alias_display_name, alias_avatar_url').in('user_id', senderIds).eq('community_id', communityId),
        ]);
        const aliasMap = Object.fromEntries((aliases ?? []).filter((a) => a.alias_display_name).map((a) => [a.user_id, a]));
        setProfiles(Object.fromEntries((profs ?? []).map((p) => {
          const alias = aliasMap[p.id];
          const resolved = alias
            ? { ...p, display_name: alias.alias_display_name, photos: alias.alias_avatar_url ? [alias.alias_avatar_url] : null }
            : p;
          return [p.id, resolved];
        })));
      }
    } catch (err) { if (__DEV__) console.error(err); handleError('Mesajlar yüklenirken', err); } finally { setLoading(false); }
  };

  const loadProfileIfNeeded = async (senderId) => {
    if (profilesRef.current[senderId]) return;
    const [{ data }, { data: alias }] = await Promise.all([
      supabase.from('profiles').select('id, display_name, photos').eq('id', senderId).single(),
      supabase.from('user_communities').select('alias_display_name, alias_avatar_url').eq('user_id', senderId).eq('community_id', communityId).maybeSingle(),
    ]);
    if (data) {
      const resolved = alias?.alias_display_name
        ? { ...data, display_name: alias.alias_display_name, photos: alias.alias_avatar_url ? [alias.alias_avatar_url] : null }
        : data;
      setProfiles((prev) => ({ ...prev, [resolved.id]: resolved }));
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    const text = inputText.trim();
    setInputText('');
    const { error } = await runWithBackgroundRetry(() =>
      supabase.from('community_messages').insert({
        community_id: communityId,
        sender_id: userId,
        content: text,
      })
    );
    if (error) {
      setInputText(text); // gönderilemeyen mesajı geri yükle
      Alert.alert('Hata', 'Mesaj gönderilemedi, tekrar dene.');
    }
  };

  const sendPhoto = async () => {
    const uri = await pickFromGallery({ quality: 1 });
    if (!uri) return;

    setUploading(true);
    try {
      const publicUrl = await uploadPhoto('photos', `community_chat/${communityId}`, uri);
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('community_messages').insert({
          community_id: communityId,
          sender_id: userId,
          content: '📷 Fotoğraf',
          media_url: publicUrl,
        })
      );
      if (error) throw error;
    } catch (err) { handleError('Fotoğraf gönder', err); }
    finally { setUploading(false); }
  };

  // ── Context menu actions ─────────────────────────────────────
  const openMenu = (item) => { setMenuMessage(item); setMenuVisible(true); };
  const closeMenu = () => { setMenuVisible(false); setMenuMessage(null); };

  const handleCopy = async () => {
    if (menuMessage?.content) await Clipboard.setStringAsync(menuMessage.content);
    closeMenu();
  };

  const handleEditFromMenu = () => {
    setEditingId(menuMessage.id);
    setEditingText(menuMessage.content);
    closeMenu();
  };

  const deleteMessage = async (id) => {
    const { error } = await runWithBackgroundRetry(() =>
      supabase.from('community_messages').delete().eq('id', id)
    );
    if (!error) setMessages((prev) => prev.filter((m) => m.id !== id));
    else handleError('Mesaj silinirken', error, { onRetry: () => deleteMessage(id) });
  };

  const handleDeleteFromMenu = () => {
    const id = menuMessage.id;
    closeMenu();
    Alert.alert('Mesajı Sil', 'Bu mesajı silmek istediğine emin misin?', [
      { text: 'Vazgeç', style: 'cancel' },
      { text: 'Sil', style: 'destructive', onPress: () => deleteMessage(id) },
    ]);
  };

  const handleReportFromMenu = () => {
    const targetId = menuMessage?.sender_id;
    closeMenu();
    setReportTargetId(targetId);
    setReportReason('');
    setReportVisible(true);
  };

  const handleSubmitReport = async () => {
    if (!reportReason || !reportTargetId) return;
    setReporting(true);
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('reports').insert({
          reporter_id: userId,
          reported_user_id: reportTargetId,
          reason: reportReason,
          details: 'Topluluk sohbet mesajı',
        })
      );
      if (error) throw error;
      setReportVisible(false);
      Alert.alert('Teşekkürler', 'Şikayetiniz iletildi. Ekibimiz en kısa sürede inceleyecek.');
    } catch (err) {
      handleError('Şikayet gönderilirken', err, { onRetry: handleSubmitReport });
    } finally {
      setReporting(false);
    }
  };

  const handleSaveEdit = async (id) => {
    const trimmed = editingText.trim();
    if (!trimmed) return;
    const { error } = await runWithBackgroundRetry(() =>
      supabase.from('community_messages').update({ content: trimmed }).eq('id', id)
    );
    if (!error) {
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, content: trimmed } : m));
    } else {
      handleError('Mesaj düzenlenirken', error, { onRetry: () => handleSaveEdit(id) });
      return;
    }
    setEditingId(null);
    setEditingText('');
  };

  if (loading) return <LoadingState />;

  const isMenuMine = menuMessage?.sender_id === userId;

  const handleCancelMsgEdit = useCallback(() => {
    setEditingId(null);
    setEditingText('');
  }, []);

  // CommunityMessageBubble memo() ile sarılı — bu her render'da yeniden
  // oluşturulursa memo etkisiz kalır.
  const renderMessage = useCallback(({ item }) => (
    <CommunityMessageBubble
      item={item}
      isMe={item.sender_id === userId}
      prof={profiles[item.sender_id]}
      isEditing={editingId === item.id}
      editingText={editingText}
      onEditTextChange={setEditingText}
      onSaveEdit={handleSaveEdit}
      onCancelEdit={handleCancelMsgEdit}
      onLongPress={openMenu}
      onImagePress={setFullScreenImage}
    />
  ), [userId, profiles, editingId, editingText, handleCancelMsgEdit]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <FlashList
        ref={flatListRef}
        data={messages}
        keyExtractor={(i) => i.id}
        renderItem={renderMessage}
        estimatedItemSize={70}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <EmptyState icon="chatbubble-outline" title={MESSAGES.noChats} description="Sohbete başla!" />
        }
      />
      {uploading && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 6, gap: 8 }}>
          <ActivityIndicator size="small" color={COLORS.primary} />
          <Text style={{ fontSize: 12, color: COLORS.textMuted }}>Gönderiliyor...</Text>
        </View>
      )}
      <View style={styles.chatInputBar}>
        <TouchableOpacity onPress={sendPhoto} disabled={uploading} style={{ padding: 6 }} accessibilityRole="button" accessibilityLabel="Fotoğraf gönder">
          <Ionicons name="image-outline" size={24} color={uploading ? COLORS.textPlaceholder : COLORS.primary} />
        </TouchableOpacity>
        <TextInput
          style={styles.chatInput}
          placeholder={PLACEHOLDERS.writeMessage}
          placeholderTextColor={COLORS.textMuted}
          value={inputText}
          onChangeText={setInputText}
          maxLength={1000}
          accessibilityLabel="Mesaj yaz"
        />
        <TouchableOpacity
          style={[styles.chatSendBtn, !inputText.trim() && { opacity: 0.4 }]}
          onPress={sendMessage}
          disabled={!inputText.trim()}
          accessibilityRole="button"
          accessibilityLabel={LABELS.send}
        >
          <Ionicons name="send" size={18} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {/* ── Long-press context menu (WA style) ── */}
      <Modal visible={menuVisible} transparent animationType="fade" onRequestClose={closeMenu}>
        <Pressable style={styles.menuOverlay} onPress={closeMenu}>
          <View style={styles.menuCard}>
            <TouchableOpacity style={styles.menuItem} onPress={handleCopy} accessibilityRole="button" accessibilityLabel="Kopyala">
              <Ionicons name="copy-outline" size={20} color={COLORS.textBody} />
              <Text style={styles.menuItemText}>Kopyala</Text>
            </TouchableOpacity>
            {isMenuMine && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleEditFromMenu} accessibilityRole="button" accessibilityLabel="Düzenle">
                  <Ionicons name="create-outline" size={20} color={COLORS.textBody} />
                  <Text style={styles.menuItemText}>Düzenle</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleDeleteFromMenu} accessibilityRole="button" accessibilityLabel="Sil">
                  <Ionicons name="trash-outline" size={20} color={COLORS.error} />
                  <Text style={[styles.menuItemText, { color: COLORS.error }]}>Sil</Text>
                </TouchableOpacity>
              </>
            )}
            {!isMenuMine && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={handleReportFromMenu} accessibilityRole="button" accessibilityLabel="Şikayet et">
                  <Ionicons name="flag-outline" size={20} color={COLORS.warning} />
                  <Text style={[styles.menuItemText, { color: COLORS.warning }]}>Şikayet Et</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Pressable>
      </Modal>

      {/* ── Fullscreen Image ── */}
      <Modal visible={!!fullScreenImage} transparent animationType="fade" onRequestClose={() => setFullScreenImage(null)}>
        <View style={styles.fullScreenOverlay}>
          <TouchableOpacity style={styles.fullScreenClose} onPress={() => setFullScreenImage(null)} accessibilityRole="button" accessibilityLabel="Kapat">
            <Ionicons name="close-circle" size={36} color={COLORS.white} />
          </TouchableOpacity>
          {fullScreenImage && (
            <Image source={{ uri: fullScreenImage }} style={styles.fullScreenImg} contentFit="contain" />
          )}
        </View>
      </Modal>

      {/* ── Report Modal ── */}
      <Modal visible={reportVisible} transparent animationType="slide" onRequestClose={() => setReportVisible(false)}>
        <Pressable style={styles.menuOverlay} onPress={() => setReportVisible(false)}>
          <View style={styles.reportSheet}>
            <View style={styles.menuDivider} />
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
    </KeyboardAvoidingView>
  );
}

/* ===================== MEMBERS TAB ===================== */
const MemberRow = memo(function MemberRow({ item, isMe, onPress }) {
  return (
    <TouchableOpacity
      style={styles.memberRow}
      onPress={() => onPress(item)}
      accessibilityRole="button"
      accessibilityLabel={`${item.profile?.display_name ?? 'Kullanıcı'} profili`}
    >
      <Avatar profile={item.profile} size={44} />
      <View style={{ marginLeft: 12, flex: 1 }}>
        <Text style={styles.memberName}>{item.profile?.display_name ?? 'Kullanıcı'}</Text>
        {item.profile?.city ? <Text style={styles.memberCity}>{item.profile.city}</Text> : null}
      </View>
      {isMe && (
        <View style={styles.youBadge}><Text style={styles.youBadgeText}>Sen</Text></View>
      )}
    </TouchableOpacity>
  );
});

function MembersTab({ communityId, userId, navigation }) {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadMembers(); }, [communityId]);

  const loadMembers = async () => {
    try {
      const { data: memberships } = await supabase
        .from('user_communities')
        .select('user_id, joined_at')
        .eq('community_id', communityId)
        .order('joined_at', { ascending: true });

      const userIds = (memberships ?? []).map((m) => m.user_id);
      if (userIds.length === 0) { setMembers([]); return; }

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, photos, city')
        .in('id', userIds);

      const profMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setMembers((memberships ?? []).map((m) => ({ ...m, profile: profMap[m.user_id] })));
    } catch (err) { if (__DEV__) console.error(err); handleError('Üyeler yüklenirken', err); } finally { setLoading(false); }
  };

  if (loading) return <LoadingState />;

  const navigateToMemberProfile = (item) => {
    if (item.user_id !== userId) navigation.navigate('ProfileDetail', { userId: item.user_id });
  };

  const renderMember = ({ item }) => (
    <MemberRow item={item} isMe={item.user_id === userId} onPress={navigateToMemberProfile} />
  );

  return (
    <FlashList
      data={members}
      keyExtractor={(i) => i.user_id}
      renderItem={renderMember}
      estimatedItemSize={68}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      ListEmptyComponent={
        <EmptyState icon="person-outline" title={MESSAGES.noMembers} />
      }
    />
  );
}

/* ===================== MAIN SCREEN ===================== */
export default function CommunityScreen({ route, navigation }) {
  const { communityId, communityName } = route.params;
  const { user } = useAuth();
  const joinedCommunities = useAppStore((s) => s.joinedCommunities);
  const setJoinedCommunities = useAppStore((s) => s.setJoinedCommunities);

  const [activeTab, setActiveTab] = useState('feed');
  const isJoined = joinedCommunities.includes(communityId);

  // Alan-içi takma ad — sadece bu alanda görünen isim, hesap gerçek kalır
  const [aliasModalVisible, setAliasModalVisible] = useState(false);
  const [aliasInput, setAliasInput] = useState('');
  const [aliasSaving, setAliasSaving] = useState(false);

  useEffect(() => {
    if (!isJoined || !user) return;
    supabase
      .from('user_communities')
      .select('alias_display_name')
      .eq('user_id', user.id)
      .eq('community_id', communityId)
      .maybeSingle()
      .then(({ data }) => setAliasInput(data?.alias_display_name ?? ''));
  }, [isJoined, user, communityId]);

  const openAliasModal = () => setAliasModalVisible(true);

  const handleSaveAlias = async (clear = false) => {
    if (!user) return;
    setAliasSaving(true);
    const value = clear ? null : aliasInput.trim() || null;
    try {
      const { error } = await runWithBackgroundRetry(() =>
        supabase.from('user_communities').update({ alias_display_name: value }).eq('user_id', user.id).eq('community_id', communityId)
      );
      if (error) throw error;
      setAliasInput(value ?? '');
      setAliasModalVisible(false);
    } catch (error) {
      if (__DEV__) console.error('Takma ad kaydedilemedi:', error);
      handleError('Takma ad kaydedilirken', error, { onRetry: () => handleSaveAlias(clear) });
    } finally {
      setAliasSaving(false);
    }
  };

  const handleToggleJoin = async () => {
    if (isJoined) {
      Alert.alert('Topluluktan Ayrıl', `${communityName} topluluğundan ayrılmak istediğine emin misin?`, [
        { text: 'İptal', style: 'cancel' },
        { text: 'Ayrıl', style: 'destructive', onPress: async () => {
          setJoinedCommunities(joinedCommunities.filter((id) => id !== communityId));
          try {
            const { error } = await runWithBackgroundRetry(() =>
              supabase.from('user_communities').delete().eq('user_id', user.id).eq('community_id', communityId)
            );
            if (error) throw error;
          } catch (error) {
            setJoinedCommunities((prev) => [...prev, communityId]); // rollback
            handleError('Topluluktan ayrılırken', error);
          }
        }},
      ]);
      return;
    } else {
      setJoinedCommunities([...joinedCommunities, communityId]);
      try {
        const { error } = await runWithBackgroundRetry(() =>
          supabase.from('user_communities').insert({ user_id: user.id, community_id: communityId })
        );
        if (error) throw error;
      } catch (error) {
        setJoinedCommunities((prev) => prev.filter((id) => id !== communityId)); // rollback
        handleError('Topluluğa katılırken', error);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} accessibilityRole="button" accessibilityLabel={LABELS.back}>
          <Ionicons name="arrow-back" size={24} color={COLORS.textBody} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>{communityName}</Text>
        </View>
        {isJoined && (
          <TouchableOpacity
            onPress={openAliasModal}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel="Bu alandaki takma adını ayarla"
            style={{ marginRight: 8 }}
          >
            <Text style={{ fontSize: 20 }}>🎭</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.headerJoinBtn, isJoined && styles.headerJoinedBtn]}
          onPress={handleToggleJoin}
          accessibilityRole="button"
          accessibilityLabel={isJoined ? 'Topluluktan ayrıl' : 'Topluluğa katıl'}
        >
          <Text style={[styles.headerJoinText, isJoined && styles.headerJoinedText]}>
            {isJoined ? LABELS.leave : LABELS.join}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Bar */}
      <View style={styles.tabBar}>
        {['feed', 'chat', 'members'].map((tab) => {
          const labels = { feed: LABELS.feed, chat: 'Sohbet', members: 'Üyeler' };
          const icons = { feed: 'newspaper-outline', chat: 'chatbubbles-outline', members: 'people-outline' };
          const isActive = activeTab === tab;
          return (
            <TouchableOpacity key={tab} style={[styles.tab, isActive && styles.tabActive]} onPress={() => setActiveTab(tab)} accessibilityRole="tab" accessibilityState={{ selected: isActive }} accessibilityLabel={labels[tab]}>
              <Ionicons name={icons[tab]} size={16} color={isActive ? COLORS.primary : COLORS.textMuted} />
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>{labels[tab]}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Content */}
      {!isJoined ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.textPlaceholder} />
          <Text style={{ fontSize: 16, fontWeight: '600', color: COLORS.textSecondary, marginTop: 12, textAlign: 'center' }}>
            İçeriği görmek için topluluğa katıl
          </Text>
          <TouchableOpacity style={[styles.headerJoinBtn, { marginTop: 16, paddingHorizontal: 32 }]} onPress={handleToggleJoin} accessibilityRole="button" accessibilityLabel="Topluluğa katıl">
            <Text style={styles.headerJoinText}>Katıl</Text>
          </TouchableOpacity>
        </View>
      ) : activeTab === 'feed' ? (
        <FeedTab communityId={communityId} communityName={communityName} userId={user?.id} navigation={navigation} />
      ) : activeTab === 'chat' ? (
        <ChatTab communityId={communityId} userId={user?.id} />
      ) : (
        <MembersTab communityId={communityId} userId={user?.id} navigation={navigation} />
      )}

      {/* Alan-içi takma ad */}
      <Modal visible={aliasModalVisible} transparent animationType="slide" onRequestClose={() => setAliasModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <Pressable style={styles.aliasOverlay} onPress={() => setAliasModalVisible(false)}>
          <View style={styles.aliasSheet}>
            <Text style={styles.reportTitle}>Bu alanda nasıl görünmek istersin?</Text>
            <Text style={styles.reportSub}>
              Sadece {communityName} alanındaki gönderi ve yorumlarında görünür. Hesabın gerçek kalır, moderasyon her zaman kim olduğunu bilir.
            </Text>
            <TextInput
              style={styles.aliasInput}
              placeholder="Örn: Meraklı Anne"
              placeholderTextColor={COLORS.textMuted}
              value={aliasInput}
              onChangeText={setAliasInput}
              maxLength={24}
              accessibilityLabel="Takma ad"
            />
            <TouchableOpacity
              style={[styles.reportSubmitBtn, aliasSaving && styles.reportSubmitBtnDisabled]}
              onPress={() => handleSaveAlias(false)}
              disabled={aliasSaving || !aliasInput.trim()}
              accessibilityRole="button"
              accessibilityLabel="Takma adı kaydet"
            >
              {aliasSaving ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.reportSubmitText}>Kaydet</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportCancelBtn} onPress={() => handleSaveAlias(true)} disabled={aliasSaving} accessibilityRole="button" accessibilityLabel="Gerçek adımı kullan">
              <Text style={styles.reportCancelText}>Gerçek adımı kullan</Text>
            </TouchableOpacity>
          </View>
        </Pressable>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.inputBackground,
  },
  headerTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark },
  headerJoinBtn: { backgroundColor: COLORS.primary, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 16 },
  headerJoinedBtn: { backgroundColor: COLORS.inputBackground },
  headerJoinText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },
  headerJoinedText: { color: COLORS.textSecondary },

  tabBar: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 11, gap: 5, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: COLORS.textMuted },
  tabTextActive: { color: COLORS.primary },

  fabGroup: {
    position: 'absolute', bottom: 20, right: 16,
    flexDirection: 'column', alignItems: 'center', gap: 10,
  },
  fab: {
    width: 52, height: 52, borderRadius: 26, backgroundColor: COLORS.primary,
    justifyContent: 'center', alignItems: 'center',
    shadowColor: COLORS.primaryShadow, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  fabSecondary: {
    backgroundColor: COLORS.white, borderWidth: 2, borderColor: COLORS.primary,
    shadowColor: '#000', shadowOpacity: 0.08,
  },
  pollsSection: { marginBottom: 4 },
  pollsSectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10,
  },
  pollsSectionTitle: { fontSize: 13, fontWeight: '700', color: COLORS.primary, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Chat
  msgRow: { flexDirection: 'row', marginBottom: 8, gap: 8, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, padding: 10 },
  msgBubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  msgBubbleOther: { backgroundColor: COLORS.inputBackground, borderBottomLeftRadius: 4 },
  msgSender: { fontSize: 11, fontWeight: '700', color: COLORS.primary, marginBottom: 2 },
  msgText: { fontSize: 15, color: COLORS.textDark, lineHeight: 20 },
  msgTime: { fontSize: 10, color: COLORS.textMuted, marginTop: 4, alignSelf: 'flex-end' },
  msgImage: { width: 200, height: 150, borderRadius: 10, marginBottom: 4 },

  chatInputBar: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8,
    borderTopWidth: 1, borderTopColor: COLORS.inputBackground, backgroundColor: COLORS.white, gap: 8,
  },
  chatInput: { flex: 1, backgroundColor: COLORS.inputBackground, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9, fontSize: 15, color: COLORS.textDark, maxHeight: 100 },
  chatSendBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  msgEditInput: { backgroundColor: 'rgba(0,0,0,0.08)', borderRadius: 8, padding: 6, fontSize: 14, minHeight: 36 },
  msgEditCancelBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.1)' },
  msgEditSaveBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: COLORS.primary },

  // Long-press context menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center' },
  menuCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 6,
    width: 220,
    ...SHADOWS.elevated,
  },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14 },
  menuItemText: { fontSize: 15, fontWeight: '500', color: COLORS.textBody },
  menuDivider: { height: 1, backgroundColor: COLORS.inputBackground, marginHorizontal: 12 },

  // Fullscreen image
  fullScreenOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', justifyContent: 'center', alignItems: 'center' },
  fullScreenClose: { position: 'absolute', top: 50, right: 20, zIndex: 10 },
  fullScreenImg: { width: '100%', height: '70%' },

  // Report sheet
  reportSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 40,
  },
  reportTitle: { fontSize: 18, fontWeight: '800', color: COLORS.textDark, marginBottom: 4, marginTop: 8 },
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

  // Alan-içi takma ad
  aliasOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  aliasSheet: {
    backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40,
  },
  aliasInput: {
    backgroundColor: COLORS.inputBackground, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: COLORS.textDark,
  },

  // Members
  memberRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.inputBackground },
  memberName: { fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  memberCity: { fontSize: 12, color: COLORS.textMuted, marginTop: 1 },
  youBadge: { backgroundColor: COLORS.primaryLight, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  youBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.primary },
});
