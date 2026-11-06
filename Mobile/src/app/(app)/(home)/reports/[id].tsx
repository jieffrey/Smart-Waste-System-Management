import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HandlingGuide } from '@/components/reports/handling-guide';
import { StatusTimeline } from '@/components/reports/status-timeline';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { CategoryLabel } from '@/components/ui/category-label';
import { useTabBarSpace } from '@/components/ui/glass';
import { Rule } from '@/components/ui/rule';
import { ErrorState, LoadingState } from '@/components/ui/state-view';
import { StatusMarker } from '@/components/ui/status-marker';
import { CATEGORY_LABELS, t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { getReport } from '@/services/reports';
import type { ReportDetail } from '@/types/api';
import { formatConfidence, formatDateTime } from '@/utils/format';
import { resolveImageUrl } from '@/utils/image-url';
import { coordinatesLabel, shortLocation } from '@/utils/short-location';

export default function ReportDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const headerHeight = useHeaderHeight();
  const tabBarSpace = useTabBarSpace();
  const [report, setReport] = useState<ReportDetail | null>(null);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const handleLoaded = useCallback((result: { report: ReportDetail }) => {
    setReport(result.report);
    setPhase('ready');
  }, []);

  const handleFailed = useCallback((err: unknown) => {
    setError(getErrorMessage(err));
    setPhase('error');
  }, []);

  useEffect(() => {
    getReport(id).then(handleLoaded, handleFailed);
  }, [id, handleLoaded, handleFailed]);

  function retry() {
    setPhase('loading');
    getReport(id).then(handleLoaded, handleFailed);
  }

  async function refresh() {
    setRefreshing(true);
    await getReport(id).then(handleLoaded, handleFailed);
    setRefreshing(false);
  }

  if (phase === 'loading') {
    return <LoadingState message={t.detail.loading} />;
  }
  if (phase === 'error' || !report) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  const categoryWasCorrected =
    report.ai_predicted_category !== null && report.ai_predicted_category !== report.category;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`;

  // Reading order: photo -> status (the most prominent element) -> what was reported (category and AI) ->
  // admin note -> timeline -> location -> description. Category comes early, like the web detail's title.
  return (
    <ScrollView
      style={styles.screen}
      // The glass header is transparent: start below it, scroll underneath it, stop above the floating tab bar.
      contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.three, paddingBottom: tabBarSpace }]}
      scrollIndicatorInsets={{ top: headerHeight, bottom: tabBarSpace }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={refresh}
          progressViewOffset={headerHeight}
          tintColor={Palette.ink}
          colors={[Palette.ink]}
        />
      }>
      <Image
        source={{ uri: resolveImageUrl(report.image_url) }}
        style={styles.photo}
        contentFit="cover"
        accessibilityLabel={t.detail.photoLabel}
      />

      <View style={styles.statusBlock}>
        <ThemedText type="micro" themeColor="textSecondary">
          {t.detail.statusLabel}
        </ThemedText>
        <StatusMarker status={report.status} size="large" />
        <ThemedText type="mono" themeColor="textSecondary">
          {t.detail.reportedOn(formatDateTime(report.created_at))}
        </ThemedText>
      </View>

      <Section title={t.detail.category}>
        <CategoryLabel category={report.category} />
        {categoryWasCorrected && report.ai_predicted_category ? (
          <ThemedText type="small">{t.detail.aiSuggested(CATEGORY_LABELS[report.ai_predicted_category])}</ThemedText>
        ) : null}
        <ThemedText type="mono" themeColor="textSecondary">
          {t.detail.aiConfidence(formatConfidence(report.ai_confidence))}
        </ThemedText>
      </Section>

      <Section title={t.handling.title}>
        <HandlingGuide category={report.category} />
      </Section>

      {report.admin_note ? (
        <View style={styles.note}>
          <ThemedText type="micro">{t.detail.adminNote}</ThemedText>
          <Text style={styles.noteText}>
            <Text style={styles.highlight}> {report.admin_note} </Text>
          </Text>
        </View>
      ) : null}

      <Section title={t.detail.timeline}>
        <StatusTimeline history={report.status_history} />
      </Section>

      <Section title={t.detail.location}>
        <ThemedText type="heading">{shortLocation(report.address, report.latitude, report.longitude)}</ThemedText>
        {report.address ? <ThemedText type="small">{report.address}</ThemedText> : null}
        <ThemedText type="mono" themeColor="textSecondary">
          {coordinatesLabel(report.latitude, report.longitude)}
        </ThemedText>
        <Button title={t.detail.openMaps} onPress={() => Linking.openURL(mapsUrl)} variant="text" />
      </Section>

      <Section title={t.detail.description}>
        <ThemedText>{report.description}</ThemedText>
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Rule />
      <ThemedText type="micro" themeColor="textSecondary">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    backgroundColor: Palette.snow,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.four,
  },
  photo: {
    aspectRatio: 4 / 3,
    backgroundColor: Palette.gray100,
    marginHorizontal: -Spacing.three, // edge to edge
    marginTop: -Spacing.three,
  },
  statusBlock: {
    gap: Spacing.two,
    borderTopWidth: 2,
    borderTopColor: Palette.ink,
    paddingTop: Spacing.three,
  },
  note: {
    gap: Spacing.two,
  },
  noteText: {
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    lineHeight: 30,
    color: Palette.ink,
  },
  highlight: {
    backgroundColor: Palette.highlight, // ink on yellow, 15.34:1
  },
  section: {
    gap: Spacing.two,
  },
});
