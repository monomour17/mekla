import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';

/**
 * Paylaşılan EmptyState component.
 * @param {string}  icon        - Ionicons adı (default 'leaf-outline')
 * @param {string}  title       - Ana başlık
 * @param {string}  description - Açıklama metni
 * @param {string}  actionLabel - Buton metni (opsiyonel)
 * @param {func}    onAction    - Buton callback (opsiyonel)
 */
export default function EmptyState({
  icon = 'leaf-outline',
  title = 'Henüz bir şey yok',
  description = '',
  actionLabel,
  onAction,
}) {
  return (
    <View style={styles.container} accessibilityRole="text" accessibilityLabel={`${title}. ${description}`}>
      <View style={styles.iconCircle}>
        <Ionicons name={icon} size={48} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {actionLabel && onAction ? (
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={onAction}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingVertical: 60,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.textDark,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  actionBtn: {
    marginTop: 20,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 12,
  },
  actionText: {
    color: COLORS.white,
    fontWeight: '700',
    fontSize: 15,
  },
});
