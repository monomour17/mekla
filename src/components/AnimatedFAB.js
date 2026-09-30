import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../constants/colors';
import { lightImpact } from '../utils/haptics';

/**
 * Animasyonlu Floating Action Button.
 * Ekrana girişte bounce + scale animasyonu, basıldığında rotate + scale efekti.
 */
export default function AnimatedFAB({ onPress, icon = 'add', style }) {
  const scale = useSharedValue(0);
  const rotation = useSharedValue(0);

  useEffect(() => {
    // Ekrana girişte bounce animasyonu
    scale.value = withDelay(
      300,
      withSpring(1, { damping: 12, stiffness: 180 }),
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: scale.value },
      { rotate: `${rotation.value}deg` },
    ],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.9, { damping: 15, stiffness: 300 });
    rotation.value = withTiming(90, { duration: 200 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 12, stiffness: 200 });
    rotation.value = withSpring(0, { damping: 12, stiffness: 200 });
  };

  const handlePress = () => {
    lightImpact();
    onPress();
  };

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Yeni gönderi oluştur"
    >
      <Animated.View style={[styles.fab, animatedStyle, style]}>
        <Ionicons name={icon} size={28} color={COLORS.white} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.primaryShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
});
