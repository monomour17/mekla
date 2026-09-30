import React, { memo } from 'react';
import { View, Text } from 'react-native';
import { Image } from 'expo-image';
import { COLORS } from '../constants/colors';

/**
 * Paylaşılan Avatar component.
 * @param {object}  profile  - { display_name, photos }
 * @param {number}  size     - px (default 40)
 * @param {string}  bgColor  - fallback arka plan rengi (default COLORS.avatarFallback)
 */
export default memo(function Avatar({ profile, size = 40, bgColor }) {
  const name = profile?.display_name ?? '?';
  const photo = profile?.photos?.[0] ?? null;
  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  const r = size / 2;

  if (photo) {
    return (
      <Image
        source={{ uri: photo }}
        style={{ width: size, height: size, borderRadius: r }}
        contentFit="cover"
      />
    );
  }

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: r,
        backgroundColor: bgColor || COLORS.avatarFallback,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <Text style={{ color: COLORS.white, fontSize: size * 0.35, fontWeight: '800' }}>
        {initials}
      </Text>
    </View>
  );
});
