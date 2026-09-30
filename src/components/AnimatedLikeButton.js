import React, { useCallback } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { lightImpact } from '../utils/haptics';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

/**
 * Animasyonlu beğeni (kalp) butonu.
 * Basıldığında spring bounce efekti ile büyür ve küçülür.
 */
export default function AnimatedLikeButton({ isLiked, likeCount, onPress }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    // Spring bounce: 1 -> 1.4 -> 0.85 -> 1
    scale.value = withSequence(
      withSpring(1.4, { damping: 4, stiffness: 300 }),
      withSpring(0.85, { damping: 4, stiffness: 300 }),
      withSpring(1, { damping: 6, stiffness: 200 })
    );
    lightImpact();
    onPress();
  }, [onPress]);

  return (
    <AnimatedTouchable
      style={[styles.btn, animatedStyle]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={isLiked ? 'Beğeniyi kaldır' : 'Beğen'}
    >
      <Ionicons
        name={isLiked ? 'heart' : 'heart-outline'}
        size={22}
        color={isLiked ? COLORS.error : COLORS.textSecondary}
      />
      {likeCount > 0 && (
        <Animated.Text style={[styles.count, isLiked && { color: COLORS.error }]}>
          {likeCount}
        </Animated.Text>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 6,
  },
  count: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
});
