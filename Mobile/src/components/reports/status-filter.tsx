import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ReportStatus } from '@/types/api';
import { STATUS_LABELS } from '@/utils/format';

const OPTIONS: { label: string; value: ReportStatus | undefined }[] = [
  { label: 'All', value: undefined },
  ...(Object.keys(STATUS_LABELS) as ReportStatus[]).map((status) => ({ label: STATUS_LABELS[status], value: status })),
];

interface StatusFilterProps {
  value: ReportStatus | undefined;
  onChange: (value: ReportStatus | undefined) => void;
}

// A horizontal row of chips: All, Pending, In progress, Completed, Rejected.
export function StatusFilter({ value, onChange }: StatusFilterProps) {
  const theme = useTheme();

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      {OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.label}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            style={[
              styles.chip,
              { borderColor: selected ? theme.primary : theme.border },
              selected && { backgroundColor: theme.primary },
            ]}>
            <ThemedText type="smallBold" style={selected ? { color: theme.onPrimary } : undefined}>
              {option.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  chip: {
    borderWidth: 1,
    borderRadius: Spacing.four,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
});
