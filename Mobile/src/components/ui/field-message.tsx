import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Palette, Spacing } from '@/constants/theme';

// An error or notice line: ink text with an icon (errors are never red in this design system).
export function FieldMessage({ children, tone = 'error' }: { children: React.ReactNode; tone?: 'error' | 'info' }) {
  return (
    <View style={styles.row} accessibilityRole={tone === 'error' ? 'alert' : undefined}>
      <MaterialCommunityIcons
        name={tone === 'error' ? 'alert-outline' : 'information-outline'}
        size={16}
        color={Palette.ink}
        style={styles.icon}
      />
      <ThemedText type="small" style={styles.text}>
        {children}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  icon: {
    marginTop: 2,
  },
  text: {
    flex: 1,
  },
});
