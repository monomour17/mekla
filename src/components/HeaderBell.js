import React from 'react';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useUnreadNotificationCount } from '../hooks/useNotifications';
import { COLORS } from '../constants/colors';

/**
 * Her ana ekranın header'ına eklenen bildirim zili.
 * Okunmamış bildirim varsa kırmızı badge gösterir.
 * Tıklanınca root stack'teki Notifications ekranına gider.
 */
export default function HeaderBell() {
  const navigation = useNavigation();
  const unread = useUnreadNotificationCount();

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={() => navigation.navigate('Notifications')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Bildirimler, ${unread} okunmamış` : 'Bildirimler'}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Ionicons
        name={unread > 0 ? 'notifications' : 'notifications-outline'}
        size={24}
        color={unread > 0 ? COLORS.primary : '#888'}
      />
      {unread > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unread > 9 ? '9+' : unread}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  btn: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    lineHeight: 11,
  },
});
