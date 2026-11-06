import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { HANDLING } from '@/constants/handling';
import { t } from '@/constants/strings';
import { Spacing } from '@/constants/theme';
import type { WasteCategory } from '@/types/api';

// Singkat dan praktis: apa ini, cara menangani, ke mana bisa dibawa.
export function HandlingGuide({ category }: { category: WasteCategory }) {
  const guide = HANDLING[category];
  return (
    <View style={styles.container}>
      <ThemedText type="small" themeColor="textSecondary">
        {guide.what}
      </ThemedText>
      {guide.handle.map((step) => (
        <View key={step} style={styles.step}>
          <ThemedText type="small">—</ThemedText>
          <ThemedText type="small" style={styles.flex}>
            {step}
          </ThemedText>
        </View>
      ))}
      <ThemedText type="small">
        <ThemedText type="smallBold">{t.handling.goesTo} </ThemedText>
        {guide.goesTo}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.two,
  },
  step: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  flex: {
    flex: 1,
  },
});
