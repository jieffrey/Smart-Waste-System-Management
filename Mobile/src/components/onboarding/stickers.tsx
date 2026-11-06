import { useEffect, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { FontFamily, Palette } from '@/constants/theme';

// Sticker-like shapes for the onboarding, built from plain Views (no images, no SVG dependency): a flat color
// shape with a thick ink outline and a hard ink "drop" offset behind it, like a die-cut sticker.

export type Motion = 'pop' | 'snapLeft' | 'snapRight' | 'drop';

interface StickerProps {
  active: boolean; // the slide is on screen: (re)play the entrance
  motion?: Motion;
  delay?: number;
  drift?: boolean; // keep floating gently after the entrance
  rotate?: number; // resting angle, degrees
  width: number;
  height: number;
  radius?: number;
  color: string;
  style?: StyleProp<ViewStyle>;
  bare?: boolean; // only animate the children: no face, outline or drop
  children?: ReactNode;
}

const OUTLINE = 3;
const DROP = 5;

export function Sticker({
  active,
  motion = 'pop',
  delay = 0,
  drift = false,
  rotate = 0,
  width,
  height,
  radius = 14,
  color,
  style,
  bare = false,
  children,
}: StickerProps) {
  const reduceMotion = useReducedMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);
  const float = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      progress.value = 1;
      return;
    }
    if (!active) {
      progress.value = 0;
      float.value = 0;
      return;
    }
    progress.value = withDelay(delay, withSpring(1, { damping: 11, stiffness: 170, mass: 0.8 }));
    if (drift) {
      float.value = withDelay(
        delay + 500,
        withRepeat(withSequence(withTiming(-7, { duration: 1700, easing: Easing.inOut(Easing.sin) }), withTiming(7, { duration: 1700, easing: Easing.inOut(Easing.sin) })), -1, true)
      );
    }
  }, [active, delay, drift, reduceMotion, progress, float]);

  const animatedStyle = useAnimatedStyle(() => {
    const p = progress.value;
    const enter = 1 - p;
    const base = [{ translateY: float.value }, { rotate: `${rotate + (motion === 'pop' ? -18 * enter : 0)}deg` }];
    switch (motion) {
      case 'snapLeft':
        return { opacity: Math.min(1, p * 2), transform: [{ translateX: -220 * enter }, ...base] };
      case 'snapRight':
        return { opacity: Math.min(1, p * 2), transform: [{ translateX: 220 * enter }, ...base] };
      case 'drop':
        return { opacity: Math.min(1, p * 2), transform: [{ translateY: float.value - 160 * enter }, { rotate: `${rotate}deg` }] };
      default:
        return { opacity: Math.min(1, p * 3), transform: [...base, { scale: Math.max(0, p) }] };
    }
  });

  if (bare) {
    return <Animated.View style={[{ width, height }, style, animatedStyle]}>{children}</Animated.View>;
  }

  return (
    <Animated.View style={[{ width: width + DROP, height: height + DROP }, style, animatedStyle]}>
      <View style={[styles.drop, { width, height, borderRadius: radius }]} />
      <View style={[styles.face, { width, height, borderRadius: radius, backgroundColor: color }]}>{children}</View>
    </Animated.View>
  );
}

export function StickerText({ children, color = Palette.ink, size = 18 }: { children: ReactNode; color?: string; size?: number }) {
  return <Text style={[styles.text, { color, fontSize: size, lineHeight: size * 1.15 }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  drop: {
    position: 'absolute',
    left: DROP,
    top: DROP,
    backgroundColor: Palette.ink,
  },
  face: {
    borderWidth: OUTLINE,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  text: {
    fontFamily: FontFamily.extrabold,
    letterSpacing: -0.4,
    textAlign: 'center',
  },
});
