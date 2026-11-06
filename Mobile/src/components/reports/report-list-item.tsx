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
      <View>
        <Image
          source={{ uri: resolveImageUrl(report.image_url) }}
          style={styles.thumbnail}
          contentFit="cover"
          accessibilityLabel={t.detail.photoLabel}
        />
        {report.has_update ? (
          // Changed since the owner last opened it: a small yellow-punk tag on the photo (ink text, 15.3:1).
          <View style={styles.newTag} accessible accessibilityLabel={t.myReports.updatedA11y}>
            <Text style={styles.newTagText}>{t.myReports.updated}</Text>
          </View>
        ) : null}
      </View>
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
  newTag: {
    position: 'absolute',
    top: -6,
    left: -6,
    backgroundColor: Palette.highlight,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    paddingHorizontal: 5,
    paddingVertical: 1,
    transform: [{ rotate: '-6deg' }],
  },
  newTagText: {
    fontFamily: FontFamily.extrabold,
    fontSize: 11,
    lineHeight: 14,
    color: Palette.ink,
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
