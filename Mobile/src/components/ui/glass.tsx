import { BlurView } from 'expo-blur';
import { createContext, useContext, type ComponentRef, type ReactNode, type RefObject } from 'react';
import { Platform, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Frosted "glass" surfaces (floating tab bar, sticky headers).
//
// iOS and web: a real blur (UIVisualEffectView / CSS backdrop-filter).
// Android: expo-blur's Dimezis blur needs a BlurTargetView (the content to blur) that the BlurView is NOT inside.
// The tabs layout wraps the screens in one and shares its ref through GlassTargetContext; without a target
// (or on Android < 12, where 'dimezisBlurViewSdk31Plus' falls back) the surface is a translucent snow panel.

export type GlassTarget = RefObject<ComponentRef<typeof View> | null>;
export const GlassTargetContext = createContext<GlassTarget | null>(null);

// Snow at 72% over the blur keeps ink text at 4.5:1+ whatever scrolls behind it; 92% when there is no blur.
const TINT_OVER_BLUR = 'rgba(251, 251, 248, 0.72)';
const TINT_NO_BLUR = 'rgba(251, 251, 248, 0.92)';

export function GlassSurface({
  target,
  style,
  children,
}: {
  target?: GlassTarget | null;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}) {
  const canBlur = Platform.OS !== 'android' || target != null;
  return (
    <View style={[styles.surface, style]}>
      {canBlur ? (
        <BlurView
          style={StyleSheet.absoluteFill}
          intensity={40}
          tint="light"
          blurMethod={Platform.OS === 'android' ? 'dimezisBlurViewSdk31Plus' : undefined}
          blurTarget={Platform.OS === 'android' ? (target ?? undefined) : undefined}
        />
      ) : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: canBlur ? TINT_OVER_BLUR : TINT_NO_BLUR }]} />
      {children}
    </View>
  );
}

// ─── Floating tab bar geometry ─────────────────────────────────────────────

export const TAB_BAR_HEIGHT = 68;
export const TAB_BAR_SIDE_INSET = 16;

// Distance from the screen's bottom edge to the bar.
export function useTabBarBottom() {
  const insets = useSafeAreaInsets();
  return Math.max(insets.bottom, 12);
}

// Screens inside the tabs read this to pad their scroll content, so the last item can scroll clear of the
// floating bar. 0 outside the tabs (sign-in, register).
export const TabBarSpaceContext = createContext(0);
export const useTabBarSpace = () => useContext(TabBarSpaceContext);

const styles = StyleSheet.create({
  surface: {
    overflow: 'hidden',
  },
});
