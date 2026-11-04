import { StyleSheet, Text, View } from 'react-native';
import Animated from 'react-native-reanimated';

import { fadeIn } from '@/components/ui/motion';
import { StatusSquare } from '@/components/ui/status-marker';
import { STATUS_LABELS, t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import type { StatusHistoryEntry } from '@/types/api';
import { formatDateTime } from '@/utils/format';

// The report's status changes as a vertical sequence (oldest first), with the same squares as the web,
// joined by an ink line. Steps appear one after another (no movement with "reduce motion" on).
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  if (history.length === 0) {
    return <Text style={styles.empty}>{t.detail.noHistory}</Text>;
  }

  return (
    <View>
      {history.map((entry, index) => {
        const last = index === history.length - 1;
        return (
          <Animated.View key={`${entry.created_at}-${index}`} entering={fadeIn(index * 110)} style={styles.entry}>
            <View style={styles.rail}>
              <StatusSquare status={entry.new_status} size={16} />
              {last ? null : <View style={styles.line} />}
            </View>
            <View style={[styles.text, !last && styles.textSpacing]}>
              <Text style={[styles.status, entry.new_status === 'rejected' && styles.struck]}>
                {STATUS_LABELS[entry.new_status]}
              </Text>
              <Text style={styles.meta}>
                {entry.old_status ? t.detail.timelineChanged(STATUS_LABELS[entry.old_status]) : t.detail.timelineReported}
              </Text>
              <Text style={styles.date}>{formatDateTime(entry.created_at)}</Text>
              {entry.note ? <Text style={styles.note}>“{entry.note}”</Text> : null}
            </View>
          </Animated.View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Palette.gray600,
  },
  entry: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  rail: {
    alignItems: 'center',
    paddingTop: 3,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: Palette.ink,
    marginTop: Spacing.one,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  textSpacing: {
    paddingBottom: Spacing.four,
  },
  status: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    lineHeight: 22,
    color: Palette.ink,
  },
  struck: {
    textDecorationLine: 'line-through',
  },
  meta: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Palette.gray600,
  },
  date: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    color: Palette.gray600,
  },
  note: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 20,
    color: Palette.ink,
    marginTop: Spacing.one,
  },
});
