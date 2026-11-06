import { Link, router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ReportListItem } from '@/components/reports/report-list-item';
import { StatusFilter } from '@/components/reports/status-filter';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ExitConfirmOnBack } from '@/components/ui/exit-confirm';
import { FieldMessage } from '@/components/ui/field-message';
import { fadeIn } from '@/components/ui/motion';
import { Rule } from '@/components/ui/rule';
import { useTabBarSpace } from '@/components/ui/glass';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/state-view';
import { STATUS_LABELS, t } from '@/constants/strings';
import { Palette, Spacing } from '@/constants/theme';
import { getErrorMessage } from '@/lib/errors';
import { listMyReports } from '@/services/reports';
import { useUpdates } from '@/store/updates';
import type { Report, ReportStatus } from '@/types/api';

const PAGE_SIZE = 20;

export default function MyReportsScreen() {
  const tabBarSpace = useTabBarSpace();
  const { setCount: setUpdatesCount } = useUpdates();
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
      setUpdatesCount(result.unseen_updates ?? 0);
      setPage(1);
      setLoadMoreError(null);
      setPhase('ready');
    } catch (err) {
      if (requestId !== latestRequest.current) return;
      setError(getErrorMessage(err));
      setPhase('error');
    }
  }, [setUpdatesCount]);

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
    content = <LoadingState message={t.myReports.loading} />;
  } else if (phase === 'error') {
    content = <ErrorState message={error} onRetry={retry} />;
  } else {
    content = (
      <FlatList
        data={reports}
        keyExtractor={(report) => report.id}
        renderItem={({ item, index }) => (
          // Rows fade in once when they first appear (no movement with "reduce motion" on).
          <Animated.View entering={fadeIn(Math.min(index, 8) * 40)}>
            <Link href={{ pathname: '/reports/[id]', params: { id: item.id } }} asChild>
              <Pressable accessibilityRole="button" style={({ pressed }) => [styles.rowPress, pressed && styles.pressed]}>
                <ReportListItem report={item} />
              </Pressable>
            </Link>
          </Animated.View>
        )}
        ItemSeparatorComponent={() => <Rule weight="faint" />}
        contentContainerStyle={[styles.list, { paddingBottom: tabBarSpace }]}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={Palette.ink} colors={[Palette.ink]} />}
        ListEmptyComponent={
          statusFilter ? (
            <EmptyState title={t.myReports.emptyFiltered(STATUS_LABELS[statusFilter])} />
          ) : (
            <EmptyState
              title={t.myReports.emptyTitle}
              message={t.myReports.emptyMessage}
              action={{ title: t.myReports.emptyAction, onPress: () => router.navigate('/new') }}
            />
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={Palette.ink} style={styles.footer} />
          ) : loadMoreError ? (
            <View style={styles.footer}>
              <FieldMessage>{loadMoreError}</FieldMessage>
              <Button title={t.common.loadMore} onPress={loadMore} variant="secondary" />
            </View>
          ) : undefined
        }
      />
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title" accessibilityRole="header">
          {t.myReports.title}
        </ThemedText>
        {phase === 'ready' && total > 0 ? (
          <ThemedText type="mono" themeColor="textSecondary">
            {t.myReports.count(total)}
          </ThemedText>
        ) : null}
      </View>
      <Rule weight="strong" />
      <StatusFilter value={statusFilter} onChange={changeFilter} />
      {content}
      <ExitConfirmOnBack />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.snow,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: Spacing.two,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  list: {
    flexGrow: 1,
    paddingHorizontal: Spacing.three,
  },
  rowPress: {
    marginHorizontal: -Spacing.three,
    paddingHorizontal: Spacing.three,
  },
  footer: {
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  pressed: {
    backgroundColor: Palette.gray50,
  },
});
