import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { StatusBadge } from '@/components/reports/status-badge';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Report } from '@/types/api';
import { CATEGORY_LABELS, formatDate } from '@/utils/format';
import { resolveImageUrl } from '@/utils/image-url';

export function ReportListItem({ report }: { report: Report }) {
  const theme = useTheme();

  return (
    <View style={[styles.row, { backgroundColor: theme.backgroundElement }]}>
      <Image
        source={{ uri: resolveImageUrl(report.image_url) }}
        style={[styles.thumbnail, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        accessibilityLabel="Report photo"
      />
      <View style={styles.text}>
        <ThemedText type="smallBold">{CATEGORY_LABELS[report.category]}</ThemedText>
        <ThemedText type="small" numberOfLines={1}>
          {report.description}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {formatDate(report.created_at)}
        </ThemedText>
      </View>
      <StatusBadge status={report.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Spacing.two,
  },
  thumbnail: {
    width: 64,
    height: 64,
    borderRadius: Spacing.two,
  },
  text: {
    flex: 1,
    gap: Spacing.half,
  },
});
