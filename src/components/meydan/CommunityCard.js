import React, { memo } from 'react';
import { Text, StyleSheet, TouchableOpacity } from 'react-native';
import { COLORS, SHADOWS } from '../../constants/colors';

export default memo(function CommunityCard({ community, isJoined, memberCount, onPress, onToggleJoin }) {
  return (
    <TouchableOpacity style={s.communityCard} onPress={onPress} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel={`${community.name} topluluğu`}>
      <Text style={s.communityIcon}>{community.icon || '👥'}</Text>
      <Text style={s.communityName} numberOfLines={1}>{community.name}</Text>
      <Text style={s.communityMemberCount}>{memberCount} üye</Text>
      <TouchableOpacity
        style={[s.joinBtn, isJoined && s.joinedBtn]}
        onPress={(e) => { e.stopPropagation?.(); onToggleJoin(); }}
        accessibilityRole="button"
        accessibilityLabel={isJoined ? `${community.name} topluluğundan ayrıl` : `${community.name} topluluğuna katıl`}
      >
        <Text style={[s.joinBtnText, isJoined && s.joinedBtnText]}>
          {isJoined ? 'Katıldın' : 'Katıl'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const s = StyleSheet.create({
  communityCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    ...SHADOWS.card,
  },
  communityIcon: { fontSize: 36, marginBottom: 8 },
  communityName: { fontSize: 16, fontWeight: '700', color: COLORS.textDark, textAlign: 'center', marginBottom: 4 },
  communityMemberCount: { fontSize: 13, color: COLORS.textMuted, marginBottom: 12 },
  joinBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 8,
    borderRadius: 20,
  },
  joinedBtn: { backgroundColor: COLORS.inputBackground },
  joinBtnText: { color: COLORS.white, fontWeight: '700', fontSize: 14 },
  joinedBtnText: { color: COLORS.textSecondary },
});
