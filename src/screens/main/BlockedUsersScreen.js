import React, { memo, useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/colors';
import Avatar from '../../components/Avatar';
import EmptyState from '../../components/EmptyState';
import LoadingState from '../../components/LoadingState';
import { handleError } from '../../utils/errorHandler';
import { runWithBackgroundRetry } from '../../utils/backgroundRetry';

const BlockedUserRow = memo(function BlockedUserRow({ item, onUnblock }) {
  return (
    <View style={styles.row}>
      <Avatar profile={item.profile} size={44} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={styles.name}>{item.profile?.display_name ?? 'Kullanıcı'}</Text>
        {item.profile?.city ? <Text style={styles.city}>{item.profile.city}</Text> : null}
      </View>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => onUnblock(item)}
        accessibilityRole="button"
        accessibilityLabel="Engeli kaldır"
      >
        <Text style={styles.unblockText}>Engeli Kaldır</Text>
      </TouchableOpacity>
    </View>
  );
});

export default function BlockedUsersScreen({ navigation }) {
  const { user } = useAuth();
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadBlockedUsers();
  }, []);

  const loadBlockedUsers = async () => {
    try {
      const { data: blocks } = await supabase
        .from('blocks')
        .select('blocked_id, created_at')
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false });

      if (!blocks || blocks.length === 0) {
        setBlockedUsers([]);
        return;
      }

      const blockedIds = blocks.map((b) => b.blocked_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, display_name, photos, city')
        .in('id', blockedIds);

      const profMap = Object.fromEntries((profiles ?? []).map((p) => [p.id, p]));
      setBlockedUsers(blocks.map((b) => ({ ...b, profile: profMap[b.blocked_id] })));
    } catch (err) {
      if (__DEV__) console.error(err);
      handleError('Engellenen kullanıcılar yüklenirken', err);
    } finally {
      setLoading(false);
    }
  };

  const unblockUser = async (item) => {
    const { error } = await runWithBackgroundRetry(() =>
      supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', item.blocked_id)
    );
    if (!error) {
      setBlockedUsers((prev) => prev.filter((b) => b.blocked_id !== item.blocked_id));
    } else {
      handleError('Engel kaldırılırken', error, { onRetry: () => unblockUser(item) });
    }
  };

  const handleUnblock = useCallback((item) => {
    const name = item.profile?.display_name ?? 'Bu kullanıcı';
    Alert.alert(
      'Engeli Kaldır',
      `${name} adlı kullanıcının engelini kaldırmak istiyor musun?`,
      [
        { text: 'İptal', style: 'cancel' },
        { text: 'Engeli Kaldır', onPress: () => unblockUser(item) },
      ]
    );
  }, []);

  const renderItem = useCallback(({ item }) => (
    <BlockedUserRow item={item} onUnblock={handleUnblock} />
  ), [handleUnblock]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="Geri">
          <Text style={styles.backText}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Engellenen Kullanıcılar</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <LoadingState />
      ) : (
        <FlashList
          data={blockedUsers}
          keyExtractor={(i) => i.blocked_id}
          renderItem={renderItem}
          estimatedItemSize={72}
          contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
          ListEmptyComponent={
            <EmptyState
              icon="ban-outline"
              title="Engellenen kullanıcı yok"
              description="Engellediğin kullanıcılar burada görünür."
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.backgroundLight },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backBtn: { width: 40, alignItems: 'flex-start' },
  backText: { fontSize: 34, color: COLORS.primary, lineHeight: 38 },
  headerTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: COLORS.textDark, textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  name: { fontSize: 15, fontWeight: '600', color: COLORS.textDark },
  city: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },

  unblockBtn: {
    backgroundColor: COLORS.inputBackground,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  unblockText: { fontSize: 13, fontWeight: '600', color: COLORS.error },
});
