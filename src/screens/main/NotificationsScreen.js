import React, { memo, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, RefreshControl,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/colors';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import { useNotifications } from '../../hooks/useNotifications';
import { formatDate } from '../../utils/dateFormat';

const TYPE_META = {
  request_approved: { icon: 'checkmark-circle', color: '#10b981' },
  request_rejected: { icon: 'close-circle', color: COLORS.error },
  new_question: { icon: 'help-circle', color: COLORS.primary },
  question_answered: { icon: 'chatbubble-ellipses', color: COLORS.primary },
  event_cancelled: { icon: 'alert-circle', color: COLORS.warning },
  event_reminder: { icon: 'alarm', color: COLORS.warning },
  new_participant: { icon: 'person-add', color: COLORS.primary },
  new_business_event: { icon: 'storefront', color: '#f59e0b' },
  weekly_reminder: { icon: 'calendar', color: COLORS.primary },
  system: { icon: 'information-circle', color: COLORS.textMuted },
};

function timeAgo(iso) {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.max(0, now - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'Şimdi';
  if (m < 60) return `${m}d`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}sa`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}g`;
  return formatDate(iso);
}

const NotificationRow = memo(function NotificationRow({ item, onPress }) {
  const meta = TYPE_META[item.type] ?? TYPE_META.system;
  const isUnread = !item.read_at;
  return (
    <TouchableOpacity
      style={[styles.item, isUnread && styles.itemUnread]}
      onPress={() => onPress(item)}
      activeOpacity={0.7}
    >
      <View style={[styles.iconBox, { backgroundColor: meta.color + '20' }]}>
        <Ionicons name={meta.icon} size={22} color={meta.color} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>{item.title}</Text>
        {item.body ? <Text style={styles.body} numberOfLines={2}>{item.body}</Text> : null}
        <Text style={styles.time}>{timeAgo(item.created_at)}</Text>
      </View>
      {isUnread && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
});

export default function NotificationsScreen({ navigation }) {
  const { notifications, loading, refresh, markAsRead, markAllAsRead, unreadCount } = useNotifications();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  // NotificationRow memo() ile sarılı — handlePress her render'da yeniden
  // oluşturulursa memo etkisiz kalır.
  const handlePress = useCallback(async (n) => {
    if (!n.read_at) await markAsRead(n.id);
    const { eventId, businessId } = n.data ?? {};
    // NotificationsScreen, MainTabs'ın kardeşi olarak root stack'e kayıtlı —
    // 'Etkinlikler' sekmesi MainTabs'ın içinde, bir seviye daha derinde.
    // Önce MainTabs'a, sonra içinden Etkinlikler'e inmek gerekiyor, aksi halde
    // "was not handled by any navigator" hatası alınıyor.
    if (n.type === 'new_business_event' && businessId) {
      navigation.navigate('MainTabs', { screen: 'Etkinlikler', params: { screen: 'BusinessProfile', params: { businessId } } });
    } else if (n.type === 'weekly_reminder') {
      navigation.navigate('MainTabs', { screen: 'Etkinlikler' });
    } else if (eventId) {
      navigation.navigate('MainTabs', { screen: 'Etkinlikler', params: { screen: 'EventDetail', params: { eventId } } });
    }
  }, [navigation, markAsRead]);

  const renderNotification = useCallback(({ item }) => (
    <NotificationRow item={item} onPress={handlePress} />
  ), [handlePress]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header navigation={navigation} unreadCount={0} onMarkAll={markAllAsRead} />
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header navigation={navigation} unreadCount={unreadCount} onMarkAll={markAllAsRead} />
      <FlashList
        data={notifications}
        keyExtractor={(item) => item.id}
        renderItem={renderNotification}
        estimatedItemSize={90}
        contentContainerStyle={notifications.length === 0 ? { flex: 1 } : { paddingVertical: 8 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-outline"
            title="Henüz Bildirim Yok"
            description="Etkinlik onayların, sorulara gelen cevaplar ve hatırlatıcılar burada görünecek."
          />
        }
      />
    </SafeAreaView>
  );
}

function Header({ navigation, unreadCount, onMarkAll }) {
  return (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Ionicons name="arrow-back" size={22} color={COLORS.textDark} />
      </TouchableOpacity>
      <Text style={styles.headerTitle}>Bildirimler</Text>
      {unreadCount > 0 ? (
        <TouchableOpacity onPress={onMarkAll}>
          <Text style={styles.markAllText}>Tümünü Okundu</Text>
        </TouchableOpacity>
      ) : (
        <View style={{ width: 80 }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, height: 40, justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textDark },
  markAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },

  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.divider,
    gap: 12,
  },
  itemUnread: { backgroundColor: COLORS.primaryLight + '40' },
  iconBox: {
    width: 40, height: 40, borderRadius: 20,
    justifyContent: 'center', alignItems: 'center',
  },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.textDark, marginBottom: 2 },
  body: { fontSize: 13, color: COLORS.textBody, lineHeight: 18 },
  time: { fontSize: 11, color: COLORS.textMuted, marginTop: 4 },
  unreadDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary,
    marginTop: 6,
  },
});
