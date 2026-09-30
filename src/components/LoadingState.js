import React from 'react';
import { View, ActivityIndicator, Text, StyleSheet } from 'react-native';
import { COLORS } from '../constants/colors';

/**
 * Reusable loading indicator with optional message.
 * Usage: <LoadingState /> or <LoadingState message="Yükleniyor..." />
 */
export default function LoadingState({ message, size = 'large', style }) {
  return (
    <View style={[styles.container, style]} accessibilityRole="progressbar" accessibilityLabel={message || 'Yükleniyor'}>
      <ActivityIndicator size={size} color={COLORS.primary} />
      {message ? <Text style={styles.message}>{message}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  message: {
    marginTop: 12,
    fontSize: 14,
    color: COLORS.textMuted,
  },
});
