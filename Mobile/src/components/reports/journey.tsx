import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { fadeIn } from '@/components/ui/motion';
import { StatusSquare } from '@/components/ui/status-marker';
import { t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import type { ReportStatus } from '@/types/api';

// The report's journey as a short preview: Terkirim -> Menunggu -> Diproses -> Selesai, current step marked
// (yellow behind ink). Uses the same status squares as everywhere else.
const STEPS: { key: 'sent' | ReportStatus; label: string; square: ReportStatus }[] = [
  { key: 'sent', label: t.journey.sent, square: 'completed' },
  { key: 'pending', label: t.journey.pending, square: 'pending' },
  { key: 'in_progress', label: t.journey.in_progress, square: 'in_progress' },
  { key: 'completed', label: t.journey.completed, square: 'completed' },
];

export function Journey({ current }: { current: ReportStatus }) {
  const currentIndex = STEPS.findIndex((step) => step.key === current);

  return (
    <View style={styles.row} accessibilityRole="list">
      {STEPS.map((step, index) => {
        const done = index < currentIndex;
        const isCurrent = index === currentIndex;
        return (
          <Animated.View key={step.key} entering={fadeIn(120 + index * 90)} style={styles.step}>
            <View style={styles.track}>
              <View style={[styles.line, index === 0 && styles.hidden, (done || isCurrent) && styles.lineDone]} />
              <View style={!done && !isCurrent ? styles.future : undefined}>
                <StatusSquare status={done ? 'completed' : step.square === 'completed' && !isCurrent ? 'pending' : step.square} size={16} />
              </View>
              <View style={[styles.line, index === STEPS.length - 1 && styles.hidden, done && styles.lineDone]} />
            </View>
            <Text style={[styles.label, isCurrent && styles.current, !done && !isCurrent && styles.futureText]}>
              {step.label}
            </Text>
            {isCurrent ? <Text style={styles.now}>{t.journey.now}</Text> : null}
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
  },
  step: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.one,
  },
  track: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: Palette.gray300,
  },
  lineDone: {
    backgroundColor: Palette.ink,
  },
  hidden: {
    opacity: 0,
  },
  future: {
    opacity: 0.45,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: Palette.ink,
    textAlign: 'center',
    paddingHorizontal: 2,
  },
  current: {
    fontFamily: FontFamily.bold,
    backgroundColor: Palette.highlight, // ink on yellow, 15.34:1
  },
  futureText: {
    color: Palette.gray600,
  },
  now: {
    fontFamily: FontFamily.monoMedium,
    fontSize: 12,
    lineHeight: 16,
    color: Palette.gray600,
  },
});
