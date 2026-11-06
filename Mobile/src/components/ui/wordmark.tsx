import { StyleSheet, Text, View } from 'react-native';

import { CategoryColors, FontFamily, Palette } from '@/constants/theme';

// The SWMS mark: three squares in the category colors + the wordmark (same as the app icon).
export function Wordmark({ color = Palette.ink, framed = false }: { color?: string; framed?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityLabel="SWMS">
      {(['organic', 'paper', 'plastic'] as const).map((category) => (
        <View key={category} style={[styles.square, framed && styles.framed]}>
          <View style={[styles.fill, { backgroundColor: CategoryColors[category].fill }]} />
        </View>
      ))}
      <Text style={[styles.word, { color }]}>SWMS</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  square: {
    width: 14,
    height: 14,
  },
  fill: {
    flex: 1,
  },
  // On an ink panel: white border + 2px snow gap, so paper (ink) reads as a solid square, not an empty outline.
  framed: {
    borderWidth: 1,
    borderColor: Palette.white,
    backgroundColor: Palette.snow,
    padding: 2,
  },
  word: {
    marginLeft: 6,
    fontFamily: FontFamily.black,
    fontSize: 20,
    letterSpacing: -0.5,
  },
});
