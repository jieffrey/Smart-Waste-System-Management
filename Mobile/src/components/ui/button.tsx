import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { FontFamily, Palette, Spacing } from '@/constants/theme';

// primary   = red orange fill + ink label (5.57:1). Once per screen, for the main action.
// secondary = 1px ink outline.
// ink       = ink fill + snow label, for use on a colored block.
// text      = text only, underlined.
// Disabled stays readable instead of fading to an illegible ghost. A disabled primary keeps a pale red-orange
// tint (ink label, 11:1+) so the screen's main action is still recognisable before the form is filled;
// the others go gray-700 on gray-100 (7.81:1).
type Variant = 'primary' | 'secondary' | 'ink' | 'text';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityHint?: string;
}

// Red orange at ~35% on snow.
const SIGNAL_TINT = '#FFC2B2';

const VARIANTS: Record<Variant, { background: string; border: string; text: string }> = {
  primary: { background: Palette.signal, border: Palette.signal, text: Palette.ink },
  secondary: { background: Palette.snow, border: Palette.ink, text: Palette.ink },
  ink: { background: Palette.ink, border: Palette.ink, text: Palette.snow },
  text: { background: 'transparent', border: 'transparent', text: Palette.ink },
};

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false, style, accessibilityHint }: ButtonProps) {
  const inactive = disabled || loading;
  const colors = VARIANTS[variant];
  const isText = variant === 'text';
  const textColor = disabled && !isText ? (variant === 'primary' ? Palette.ink : Palette.gray700) : colors.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      accessibilityHint={accessibilityHint}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        isText ? styles.textButton : styles.button,
        !isText && {
          backgroundColor: disabled ? (variant === 'primary' ? SIGNAL_TINT : Palette.gray100) : colors.background,
          borderColor: disabled ? (variant === 'primary' ? SIGNAL_TINT : Palette.gray300) : colors.border,
        },
        pressed && !inactive && (isText ? styles.textPressed : styles.pressed),
        style,
      ]}>
      {({ pressed }) =>
        loading ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color={textColor} />
          </View>
        ) : (
          <Text
            style={[
              styles.title,
              isText && styles.textTitle,
              { color: textColor },
              pressed && variant === 'primary' && { color: Palette.ink },
            ]}>
            {title}
          </Text>
        )
      }
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderWidth: 1.5,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    minHeight: 44,
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  pressed: {
    transform: [{ translateY: 1 }],
    opacity: 0.85,
  },
  textPressed: {
    opacity: 0.6,
  },
  loadingRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
  },
  textTitle: {
    fontFamily: FontFamily.semibold,
    textDecorationLine: 'underline',
  },
});
