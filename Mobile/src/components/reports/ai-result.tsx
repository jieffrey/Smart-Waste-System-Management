import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { HandlingGuide } from '@/components/reports/handling-guide';
import { Journey } from '@/components/reports/journey';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { riseIn } from '@/components/ui/motion';
import { CATEGORY_LABELS, t } from '@/constants/strings';
import { CategoryColors, FontFamily, Palette, Spacing } from '@/constants/theme';
import type { Report } from '@/types/api';
import { formatConfidence } from '@/utils/format';

interface AiResultProps {
  report: Report;
  onViewReport: () => void;
  onReportAgain: () => void;
}

// The emotional peak after submitting: a full-width block in the CATEGORY color with text colors that pass
// contrast (organic: ink on red orange 5.57:1, paper: snow on ink 18.07:1, plastic: white on cobalt 6.77:1),
// saying what was detected and what happens next. Then the journey and the two actions.
export function AiResult({ report, onViewReport, onReportAgain }: AiResultProps) {
  const colors = CategoryColors[report.category];

  return (
    <View style={styles.container}>
      <Animated.View entering={riseIn()} style={[styles.block, { backgroundColor: colors.fill }]}>
        <Text style={[styles.detected, { color: colors.onFill }]} accessibilityRole="header">
          {t.result.detected(CATEGORY_LABELS[report.category])}
        </Text>
        <Text style={[styles.next, { color: colors.onFill }]}>{t.result.whatNext}</Text>
        <Text style={[styles.confidence, { color: colors.onFill }]}>
          {t.result.confidence(formatConfidence(report.ai_confidence))}
        </Text>
        {report.needs_review ? (
          // Plain and honest: the AI wasn't sure, so a person checks it. Ink on yellow punk (15.3:1).
          <Text style={styles.lowConfidence}>{t.result.lowConfidence}</Text>
        ) : null}
      </Animated.View>

      {report.possible_duplicate_of ? (
        // Not a problem, just context: an ink-outlined note under the result block.
        <View style={styles.duplicate}>
          <ThemedText type="smallBold">{t.result.possibleDuplicate}</ThemedText>
        </View>
      ) : null}

      <View style={styles.journey}>
        <ThemedText type="micro" themeColor="textSecondary">
          {t.handling.title}
        </ThemedText>
        <HandlingGuide category={report.category} />
      </View>

      <View style={styles.journey}>
        <ThemedText type="micro" themeColor="textSecondary">
          {t.result.journeyTitle}
        </ThemedText>
        <Journey current={report.status} />
      </View>

      <View style={styles.actions}>
        <Button title={t.result.viewReport} onPress={onViewReport} />
        <Button title={t.result.reportAgain} onPress={onReportAgain} variant="text" style={styles.again} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: Spacing.four,
  },
  block: {
    padding: Spacing.four,
    paddingTop: Spacing.five,
    gap: Spacing.three,
    marginHorizontal: -Spacing.three, // full width, edge to edge
  },
  detected: {
    fontFamily: FontFamily.black,
    fontSize: 36,
    lineHeight: 38,
    letterSpacing: -1.2,
  },
  next: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 26,
  },
  duplicate: {
    borderWidth: 1.5,
    borderColor: Palette.ink,
    borderLeftWidth: 6,
    padding: Spacing.three,
  },
  lowConfidence: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.highlight,
    color: Palette.ink,
    fontFamily: FontFamily.extrabold,
    fontSize: 16,
    lineHeight: 22,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
  confidence: {
    fontFamily: FontFamily.mono,
    fontSize: 14,
    lineHeight: 20,
  },
  journey: {
    gap: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: Palette.ink,
    paddingTop: Spacing.three,
  },
  actions: {
    gap: Spacing.one,
  },
  again: {
    alignSelf: 'center',
  },
});
