import React, { useCallback } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import { Pressable } from 'react-native';

/**
 * Basıldığında scale-down efekti veren genel amaçlı pressable bileşen.
 * Projede herhangi bir butonun yerine kullanılabilir.
 */
export default function AnimatedPressable({ children, onPress, style, disabled, ...rest }) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    scale.value = withTiming(0.95, { duration: 100 });
  }, []);

  const handlePressOut = useCallback(() => {
    scale.value = withTiming(1, { duration: 150 });
  }, []);

  return (
    <Pressable
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={onPress}
      disabled={disabled}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
