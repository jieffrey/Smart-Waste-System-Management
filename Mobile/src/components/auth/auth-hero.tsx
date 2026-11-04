import { StyleSheet, Text, View } from 'react-native';

import { Wordmark } from '@/components/ui/wordmark';
import { FontFamily, Palette, Spacing } from '@/constants/theme';

interface AuthHeroProps {
  headline: string;
  highlight?: string; // the last phrase, in yellow on ink (15.34:1)
  subline?: string;
  compact?: boolean;
}

// The "front door" panel: an ink block inside the page margin (so the status bar stays dark-on-snow), with
// one bold sentence about what the app does.
export function AuthHero({ headline, highlight, subline, compact = false }: AuthHeroProps) {
  return (
    <View style={[styles.panel, compact && styles.compact]}>
      <Wordmark color={Palette.snow} framed />
      <Text style={[styles.headline, compact && styles.headlineCompact]} accessibilityRole="header">
        {headline}
        {highlight ? <Text style={styles.highlight}> {highlight}</Text> : null}
      </Text>
      {subline ? <Text style={styles.subline}>{subline}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Palette.ink,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  compact: {
    gap: Spacing.three,
  },
  headline: {
    fontFamily: FontFamily.black,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.2,
    color: Palette.snow,
  },
  headlineCompact: {
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.8,
  },
  highlight: {
    color: Palette.highlight,
  },
  subline: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    lineHeight: 24,
    color: Palette.gray300, // 9.64:1 on ink
  },
});
