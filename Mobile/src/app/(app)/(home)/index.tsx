import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, View } from 'react-native';

import { ReportListItem } from '@/components/reports/report-list-item';
import { StatusFilter } from '@/components/reports/status-filter';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage } from '@/lib/errors';
import { listMyReports } from '@/services/reports';
import type { Report, ReportStatus } from '@/types/api';
import { STATUS_LABELS } from '@/utils/format';

const PAGE_SIZE = 20;

export default function MyReportsScreen() {
  const theme = useTheme();
  const [statusFilter, setStatusFilter] = useState<ReportStatus | undefined>(undefined);
  const [reports, setReports] = useState<Report[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  // Only the newest request may update the list (e.g. after switching filters quickly).
  const latestRequest = useRef(0);

  const loadFirstPage = useCallback(async (filter: ReportStatus | undefined) => {
    const requestId = ++latestRequest.current;
    try {
      const result = await listMyReports({ page: 1, limit: PAGE_SIZE, status: filter });
      if (requestId !== latestRequest.current) return;
      setReports(result.reports);
      setTotal(result.pagination.total);
      setPage(1);
      setLoadMoreError(null);
      setPhase('ready');
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(getErrorMessage(err));
      setPhase('error');
    }
  }, []);

  // Reload whenever this tab is shown (e.g. after creating a report) or the filter changes.
  useFocusEffect(
    useCallback(() => {
      loadFirstPage(statusFilter);
    }, [loadFirstPage, statusFilter])
  );

  function changeFilter(filter: ReportStatus | undefined) {
    if (filter === statusFilter) return;
    setReports([]);
    setPhase('loading');
    setStatusFilter(filter);
  }

  function retry() {
    setPhase('loading');
    loadFirstPage(statusFilter);
  }

  async function refresh() {
    setRefreshing(true);
    await loadFirstPage(statusFilter);
    setRefreshing(false);
  }

  async function loadMore() {
    if (phase !== 'ready' || loadingMore || reports.length >= total) return;

    const requestId = latestRequest.current;
    const nextPage = page + 1;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const result = await listMyReports({ page: nextPage, limit: PAGE_SIZE, status: statusFilter });
      if (requestId !== latestRequest.current) return;
      // Skip reports already shown (new reports can shift the pages).
      setReports((current) => [
        ...current,
        ...result.reports.filter((report) => !current.some((shown) => shown.id === report.id)),
      ]);
      setTotal(result.pagination.total);
      setPage(nextPage);
    } catch (err) {
      setLoadMoreError(getErrorMessage(err));
    } finally {
      setLoadingMore(false);
    }
  }

  let content;
  if (phase === 'loading') {
    content = <LoadingState message="Loading your reports…" />;
  } else if (phase === 'error') {
    content = <ErrorState message={error} onRetry={retry} />;
  } else {
    content = (
      <FlatList
        data={reports}
        keyExtractor={(report) => report.id}
        renderItem={({ item }) => <ReportListItem report={item} />}
        contentContainerStyle={styles.list}
        contentInsetAdjustmentBehavior="automatic"
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={theme.primary} />}
        ListEmptyComponent={
          statusFilter ? (
            <EmptyState title={`No ${STATUS_LABELS[statusFilter].toLowerCase()} reports`} />
          ) : (
            <EmptyState title="No reports yet" message="Use the New report tab to report waste." />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={theme.primary} style={styles.footer} />
          ) : loadMoreError ? (
            <View style={styles.footer}>
              <ThemedText type="small" style={{ color: theme.danger }}>
                {loadMoreError}
              </ThemedText>
              <Button title="Load more" onPress={loadMore} variant="secondary" />
            </View>
          ) : undefined
        }
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View>
        <StatusFilter value={statusFilter} onChange={changeFilter} />
      </View>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    flexGrow: 1,
    padding: Spacing.three,
    gap: Spacing.two,
  },
  footer: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
});
