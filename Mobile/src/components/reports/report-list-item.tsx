import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { CategoryLabel } from '@/components/ui/category-label';
import { StatusMarker } from '@/components/ui/status-marker';
import { t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import type { Report } from '@/types/api';
import { formatDate } from '@/utils/format';
import { resolveImageUrl } from '@/utils/image-url';
import { shortLocation } from '@/utils/short-location';

// One report as a row (rules between rows, no card): thumbnail, category, short location, date in mono, status.
export function ReportListItem({ report }: { report: Report }) {
  return (
    <View style={styles.row}>
      <Image
        source={{ uri: resolveImageUrl(report.image_url) }}
        style={styles.thumbnail}
        contentFit="cover"
        accessibilityLabel={t.detail.photoLabel}
      />
      <View style={styles.text}>
        <CategoryLabel category={report.category} />
        <Text style={styles.place} numberOfLines={1}>
          {shortLocation(report.address, report.latitude, report.longitude)}
        </Text>
        <Text style={styles.date}>{formatDate(report.created_at)}</Text>
      </View>
      <StatusMarker status={report.status} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
  },
  thumbnail: {
    width: 64,
    height: 64,
    backgroundColor: Palette.gray100,
  },
  text: {
    flex: 1,
    gap: 2,
  },
  place: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    lineHeight: 22,
    color: Palette.ink,
  },
  date: {
    fontFamily: FontFamily.mono,
    fontSize: 12,
    lineHeight: 16,
    color: Palette.gray600,
  },
});
