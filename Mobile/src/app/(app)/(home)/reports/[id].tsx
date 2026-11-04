import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { StatusMarker } from '@/components/ui/status-marker';
import { StatusTimeline } from '@/components/reports/status-timeline';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ErrorState, LoadingState } from '@/components/ui/state-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { getReport } from '@/services/reports';
import type { ReportDetail } from '@/types/api';
import { CATEGORY_LABELS, formatConfidence, formatDateTime } from '@/utils/format';
import { resolveImageUrl } from '@/utils/image-url';

export default function ReportDetailScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
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
    return <LoadingState message="Loading report…" />;
  }
  if (phase === 'error' || !report) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  const categoryWasCorrected =
    report.ai_predicted_category !== null && report.ai_predicted_category !== report.category;
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${report.latitude},${report.longitude}`;

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      contentInsetAdjustmentBehavior="automatic"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}>
      <Image
        source={{ uri: resolveImageUrl(report.image_url) }}
        style={[styles.photo, { backgroundColor: theme.backgroundSelected }]}
        contentFit="cover"
        accessibilityLabel="Report photo"
      />

      <View style={styles.row}>
        <StatusMarker status={report.status} />
        <ThemedText type="small" themeColor="textSecondary">
          {formatDateTime(report.created_at)}
        </ThemedText>
      </View>

      <Section title="Category">
        <ThemedText>
          {CATEGORY_LABELS[report.category]}
          {categoryWasCorrected && report.ai_predicted_category
            ? ` (AI suggested: ${CATEGORY_LABELS[report.ai_predicted_category]})`
            : ''}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          AI confidence: {formatConfidence(report.ai_confidence)}
          {report.ai_model_version ? ` · model ${report.ai_model_version}` : ''}
        </ThemedText>
      </Section>

      <Section title="Description">
        <ThemedText>{report.description}</ThemedText>
      </Section>

      {report.admin_note ? (
        <Section title="Note from the admin">
          <ThemedText>{report.admin_note}</ThemedText>
        </Section>
      ) : null}

      <Section title="Location">
        {report.address ? <ThemedText>{report.address}</ThemedText> : null}
        <ThemedText type="small" themeColor="textSecondary">
          {report.latitude.toFixed(6)}, {report.longitude.toFixed(6)}
        </ThemedText>
        <Button title="Open in Maps" onPress={() => Linking.openURL(mapsUrl)} variant="secondary" />
      </Section>

      <Section title="Status history">
        <StatusTimeline history={report.status_history} />
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <ThemedText type="smallBold">{title}</ThemedText>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: Spacing.three,
    gap: Spacing.three,
  },
  photo: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  section: {
    gap: Spacing.one,
  },
});
