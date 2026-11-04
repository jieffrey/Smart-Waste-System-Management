import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@/constants/strings';
import { CategoryColors, FontFamily, Palette } from '@/constants/theme';
import type { WasteCategory } from '@/types/api';

// A square in the true category color. `framed` adds a thin white border for colored backgrounds,
// where a category can match the background (plastic on cobalt, paper on ink).
export function CategorySwatch({ category, framed = false, size = 12 }: { category: WasteCategory; framed?: boolean; size?: number }) {
  return (
    <View
      style={[
        { width: size, height: size, backgroundColor: CategoryColors[category].fill },
        framed && styles.framed,
      ]}
    />
  );
}

// Swatch + ink label (red-orange text would fail AA at this size).
export function CategoryLabel({ category, color = Palette.ink, framed = false }: { category: WasteCategory; color?: string; framed?: boolean }) {
  return (
    <View style={styles.row}>
      <CategorySwatch category={category} framed={framed} />
      <Text style={[styles.text, { color }]}>{CATEGORY_LABELS[category]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  framed: {
    borderWidth: 1,
    borderColor: Palette.white,
  },
  text: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
});
