import React, { memo, useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import useAppStore from '../../store/useAppStore';
import { getLastReadMap, markChatRead, isUnread } from '../../utils/chatReadState';
import { formatRelativeTime } from '../../utils/dateFormat';
import { COLORS } from '../../constants/colors';
import { LABELS, MESSAGES, PLACEHOLDERS } from '../../constants/strings';
import { handleError } from '../../utils/errorHandler';
import { ChatListSkeleton } from '../../components/SkeletonLoader';
import EmptyState from '../../components/EmptyState';
import HeaderBell from '../../components/HeaderBell';

const EventChatItem = memo(function EventChatItem({ event, onPress }) {
  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => onPress(event)}
      accessibilityRole="button"
      accessibilityLabel={`${event.eventTitle} etkinlik sohbeti`}
    >
      <View>
        {event.coverPhoto ? (
          <Image
            source={{ uri: event.coverPhoto }}
            style={styles.eventAvatar}
            contentFit="cover"
            accessibilityElementsHidden={true}
          />
        ) : (
          <View style={styles.eventAvatarPlaceholder}>
            <Ionicons name="people" size={22} color={COLORS.white} />
          </View>
        )}
        <View style={styles.eventBadge}>
          <Ionicons name="calendar" size={10} color={COLORS.white} />
        </View>
      </View>

      <View style={styles.itemInfo}>
        <View style={styles.itemRow}>
          <Text style={[styles.itemName, event.unread && styles.itemNameUnread]} numberOfLines={1}>{event.eventTitle}</Text>
          {event.lastTime ? (
            <Text style={styles.itemTime}>{formatRelativeTime(event.lastTime)}</Text>
          ) : null}
        </View>
        <View style={styles.itemSubRow}>
          <Text style={[styles.itemSub, event.unread && styles.itemSubUnread]} numberOfLines={1}>
            {event.lastMessage ?? 'Henüz mesaj yok'}
          </Text>
          {event.unread && <View style={styles.unreadDot} />}
        </View>
      </View>
    </TouchableOpacity>
  );
});

const PAGE_SIZE = 20;

function toItem(e, readMap) {
  return {
    id: `event-${e.id}`,
    eventId: e.id,
    eventTitle: e.title,
    coverPhoto: e.cover_photo_url,
    lastMessage: e.last_message_content ?? null,
    lastTime: e.last_message_at ?? null,
    unread: isUnread(e.last_message_at, readMap[e.id]),
  };
}

export default function ChatsScreen({ navigation }) {
  const { user } = useAuth();
  const setUnreadChatCount = useAppStore((s) => s.setUnreadChatCount);
  const [eventChats, setEventChats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState(null);
  const [chatSearch, setChatSearch] = useState('');

  const eventMsgsChannelRef = useRef(null);
  // eventChats her realtime mesajda değişebiliyor — pagination offset'i
  // buna bağlarsak bir mesaj gelince sayfa kayardı. Ayrı, sadece
  // "kaç satır çektik" diye artan bir sayaç tutuyoruz.
  const offsetRef = useRef(0);

  // last_message_at/content artık events tablosunda denormalize (bkz.
  // sql/_CALISTIR_24-25) — trigger her yeni event_messages satırında
  // otomatik güncelliyor. Önceden her odaklanışta TÜM etkinliklerin TÜM
  // "son mesaj" verisini çekiyorduk (37 etkinlik → 37 sorgu, sonra tek
  // RPC'ye indirmiştik ama yine hepsini birden çekiyorduk); artık tek
  // basit, sıralı, LIMIT'li bir sorguyla sadece ekranda görünecek kadarını
  // çekiyoruz, aşağı kaydırınca devamı geliyor.
  const load = useCallback(async () => {
    if (!user) {
      setEventChats([]);
      setLoading(false);
      return;
    }

    setError(null);
    const userId = user.id;
    offsetRef.current = 0;

    try {
      const { data: rows, error: rpcError } = await supabase.rpc('get_my_event_chats', {
        p_user_id: userId,
        p_limit: PAGE_SIZE,
        p_offset: 0,
      });
      if (rpcError) throw rpcError;

      const readMap = await getLastReadMap();
      const items = (rows ?? []).map((e) => toItem(e, readMap));

      offsetRef.current = items.length;
      setHasMore((rows ?? []).length === PAGE_SIZE);
      setEventChats(items);
      setUnreadChatCount(items.filter((i) => i.unread).length);

      // Realtime: sadece şu an yüklü sohbetlerin son mesajını günceller.
      // Henüz yüklenmemiş (sayfalanmamış) bir etkinliğe mesaj gelirse,
      // kullanıcı o sohbete kaydırınca/yenileyince görür.
      if (eventMsgsChannelRef.current) {
        supabase.removeChannel(eventMsgsChannelRef.current);
        eventMsgsChannelRef.current = null;
      }

      eventMsgsChannelRef.current = supabase
        .channel(`chats-events-${userId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_messages',
            // Supabase Realtime in.() syntax'ı güvenilir değil — client-side filtre kullan
          },
          (payload) => {
            const newMsg = payload.new;
            const fromMe = newMsg.sender_id === userId;
            setEventChats((prev) => {
              const existing = prev.find((c) => c.eventId === newMsg.event_id);
              if (!existing) return prev; // yüklü değilse dokunma
              const updated = {
                ...existing,
                lastMessage: newMsg.content,
                lastTime: newMsg.created_at,
                unread: existing.unread || !fromMe,
              };
              const next = [updated, ...prev.filter((c) => c.eventId !== newMsg.event_id)];
              setUnreadChatCount(next.filter((i) => i.unread).length);
              return next;
            });
          }
        )
        .subscribe();
    } catch (e) {
      handleError('Sohbetler yükleme', e, { silent: true });
      setError('Sohbetler yüklenemedi. İnternet bağlantını kontrol et.');
    }

    setLoading(false);
  }, [user]);

  const loadMore = useCallback(async () => {
    if (!user || !hasMore || loadingMore || chatSearch.trim()) return;
    setLoadingMore(true);
    try {
      const { data: rows, error: rpcError } = await supabase.rpc('get_my_event_chats', {
        p_user_id: user.id,
        p_limit: PAGE_SIZE,
        p_offset: offsetRef.current,
      });
      if (rpcError) throw rpcError;

      const readMap = await getLastReadMap();
      const newItems = (rows ?? []).map((e) => toItem(e, readMap));

      offsetRef.current += newItems.length;
      setHasMore((rows ?? []).length === PAGE_SIZE);
      setEventChats((prev) => {
        const existingIds = new Set(prev.map((c) => c.eventId));
        return [...prev, ...newItems.filter((i) => !existingIds.has(i.eventId))];
      });
    } catch (e) {
      handleError('Daha fazla sohbet yüklenirken', e, { silent: true });
    } finally {
      setLoadingMore(false);
    }
  }, [user, hasMore, loadingMore, chatSearch]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load().finally(() => setRefreshing(false));
  }, [load]);

  // EventChatItem memo() ile sarılı — bu her render'da yeniden oluşturulursa
  // memo etkisiz kalır (bkz. Meydan/Topluluk feed'lerinde aynı sebepten
  // yapılan düzeltme).
  const handleChatPress = useCallback((item) => {
    // Sohbete girildiğinde okundu say — rozet anında sönsün
    markChatRead(item.eventId);
    setEventChats((prev) => {
      const next = prev.map((c) => (c.eventId === item.eventId ? { ...c, unread: false } : c));
      setUnreadChatCount(next.filter((i) => i.unread).length);
      return next;
    });
    navigation.navigate('EventChat', {
      eventId: item.eventId,
      eventTitle: item.eventTitle,
    });
  }, [navigation, setUnreadChatCount]);

  useFocusEffect(
    useCallback(() => {
      load();
      return () => {
        if (eventMsgsChannelRef.current) {
          supabase.removeChannel(eventMsgsChannelRef.current);
          eventMsgsChannelRef.current = null;
        }
      };
    }, [load])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <ChatListSkeleton count={6} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>📡</Text>
        <Text style={styles.title}>Bağlantı Sorunu</Text>
        <Text style={styles.subtitle}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => { setError(null); setLoading(true); load(); }}
          accessibilityRole="button"
          accessibilityLabel="Tekrar dene"
        >
          <Text style={styles.retryBtnText}>Tekrar Dene</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!eventChats.length) {
    return (
      <View style={styles.center}>
        <EmptyState
          icon="chatbubbles-outline"
          title={MESSAGES.noChats}
          description="Bir etkinliğe katıl veya düzenle, grup sohbeti otomatik açılır!"
          actionLabel="Etkinliklere Git"
          onAction={() => navigation.navigate('Etkinlikler')}
        />
      </View>
    );
  }

  const filtered = chatSearch.trim()
    ? eventChats.filter((c) => c.eventTitle?.toLowerCase().includes(chatSearch.toLowerCase()))
    : eventChats;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.header}>{LABELS.chats}</Text>
        <HeaderBell />
      </View>
      <View style={styles.searchContainer}>
        <Ionicons name="search-outline" size={20} color={COLORS.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Etkinlik ara..."
          placeholderTextColor={COLORS.textPlaceholder}
          value={chatSearch}
          onChangeText={setChatSearch}
          accessibilityLabel="Etkinlik ara"
        />
        {chatSearch.length > 0 && (
          <TouchableOpacity onPress={() => setChatSearch('')} accessibilityLabel="Aramayı temizle">
            <Ionicons name="close-circle" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        )}
      </View>
      <FlashList
        data={filtered}
        keyExtractor={(item) => item.id}
        estimatedItemSize={80}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        renderItem={({ item }) => (
          <EventChatItem event={item} onPress={handleChatPress} />
        )}
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ paddingVertical: 20 }} />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    paddingHorizontal: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  header: {
    fontSize: 28,
    fontWeight: '800',
    color: COLORS.primary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.inputBackground,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 15,
    color: COLORS.textDark,
  },
  emoji: { fontSize: 56, marginBottom: 20 },
  title: { fontSize: 20, fontWeight: '700', color: COLORS.textDark, marginBottom: 10 },
  subtitle: { fontSize: 15, color: COLORS.textMuted, textAlign: 'center', lineHeight: 22 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  eventAvatar: { width: 52, height: 52, borderRadius: 16, marginRight: 14 },
  eventAvatarPlaceholder: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: COLORS.avatarFallback,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  eventBadge: {
    position: 'absolute',
    bottom: 0,
    right: 10,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  itemInfo: { flex: 1 },
  itemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 3,
  },
  itemName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, flex: 1, marginRight: 8 },
  itemNameUnread: { fontWeight: '900' },
  itemSubRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemSubUnread: { color: COLORS.textDark, fontWeight: '700' },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  itemTime: { fontSize: 12, color: COLORS.textMuted },
  itemSub: { fontSize: 14, color: COLORS.textSecondary, flex: 1 },
  retryBtn: {
    marginTop: 20,
    paddingHorizontal: 28,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },
  retryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: '700' },
});
