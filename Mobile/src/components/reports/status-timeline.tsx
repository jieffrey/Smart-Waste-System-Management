import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StatusHistoryEntry } from '@/types/api';
import { STATUS_LABELS, formatDateTime } from '@/utils/format';

// The report's status changes, oldest first.
export function StatusTimeline({ history }: { history: StatusHistoryEntry[] }) {
  const theme = useTheme();

  if (history.length === 0) {
    return <ThemedText themeColor="textSecondary">No status changes yet.</ThemedText>;
  }

  return (
    <View style={styles.list}>
      {history.map((entry, index) => (
        <View key={`${entry.created_at}-${index}`} style={styles.entry}>
          <View style={[styles.dot, { backgroundColor: theme.primary }]} />
          <View style={styles.text}>
            <ThemedText type="smallBold">
              {entry.old_status
                ? `${STATUS_LABELS[entry.old_status]} → ${STATUS_LABELS[entry.new_status]}`
                : `Reported (${STATUS_LABELS[entry.new_status]})`}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {formatDateTime(entry.created_at)}
            </ThemedText>
            {entry.note ? <ThemedText type="small">{entry.note}</ThemedText> : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.three,
  },
  entry: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 6,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
