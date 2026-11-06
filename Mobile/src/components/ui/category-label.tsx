import { StyleSheet, Text, View } from 'react-native';

import { CATEGORY_LABELS } from '@/constants/strings';
import { CategoryColors, FontFamily, Palette } from '@/constants/theme';
import type { WasteCategory } from '@/types/api';

// A square in the true category color. `framed` is for colored backgrounds, where a category can match the
// background (plastic on cobalt, paper on ink). A border alone made the fill read as an empty outline;
// a white border + 2px snow gap keeps the fill solid on any background.
export function CategorySwatch({ category, framed = false, size = 12 }: { category: WasteCategory; framed?: boolean; size?: number }) {
  const fill = <View style={{ flex: 1, backgroundColor: CategoryColors[category].fill }} />;
  if (framed) {
    return <View style={[styles.framed, { width: size + 2, height: size + 2 }]}>{fill}</View>;
  }
  return <View style={{ width: size, height: size, backgroundColor: CategoryColors[category].fill }} />;
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
    backgroundColor: Palette.snow,
    padding: 2,
  },
  text: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    lineHeight: 20,
  },
});
