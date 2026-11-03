import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';

import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({ title, onPress, variant = 'primary', disabled = false, loading = false }: ButtonProps) {
  const theme = useTheme();
  const isPrimary = variant === 'primary';
  const textColor = isPrimary ? theme.onPrimary : theme.text;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        isPrimary
          ? { backgroundColor: theme.primary }
          : { backgroundColor: theme.backgroundElement, borderColor: theme.border, borderWidth: 1 },
        (disabled || loading) && styles.disabled,
        pressed && styles.pressed,
      ]}>
      {loading ? <ActivityIndicator color={textColor} /> : <Text style={[styles.title, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: Spacing.two,
    paddingHorizontal: Spacing.three,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: 600,
  },
  disabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
});
