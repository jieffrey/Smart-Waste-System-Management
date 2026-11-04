import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { t } from '@/constants/strings';
import { Palette, Spacing } from '@/constants/theme';

// Full-area loading, error and empty states. Left-aligned under a rule, no boxes; errors are ink + icon.

export function LoadingState({ message = t.common.loading }: { message?: string }) {
  return (
    <View style={[styles.container, styles.centered]}>
      <ActivityIndicator size="large" color={Palette.ink} />
      <ThemedText themeColor="textSecondary">{message}</ThemedText>
    </View>
  );
}

interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
  secondaryAction?: { title: string; onPress: () => void };
}

export function ErrorState({ message, onRetry, secondaryAction }: ErrorStateProps) {
  return (
    <View style={[styles.container, styles.centered]}>
      <View style={styles.block}>
        <MaterialCommunityIcons name="alert-outline" size={28} color={Palette.ink} />
        <ThemedText type="heading">{t.common.somethingWrong}</ThemedText>
        <ThemedText>{message}</ThemedText>
        <View style={styles.actions}>
          {onRetry ? <Button title={t.common.tryAgain} onPress={onRetry} /> : null}
          {secondaryAction ? <Button title={secondaryAction.title} onPress={secondaryAction.onPress} variant="text" /> : null}
        </View>
      </View>
    </View>
  );
}

interface EmptyStateProps {
  title: string;
  message?: string;
  action?: { title: string; onPress: () => void };
}

export function EmptyState({ title, message, action }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.block}>
        <View style={styles.topRule} />
        <ThemedText type="title">{title}</ThemedText>
        {message ? <ThemedText themeColor="textSecondary">{message}</ThemedText> : null}
        {action ? <Button title={action.title} onPress={action.onPress} style={styles.emptyAction} /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: Spacing.four,
    backgroundColor: Palette.snow,
  },
  centered: {
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: Spacing.three,
  },
  block: {
    gap: Spacing.two,
  },
  topRule: {
    height: 2,
    backgroundColor: Palette.ink,
    marginBottom: Spacing.three,
  },
  actions: {
    gap: Spacing.two,
    marginTop: Spacing.three,
  },
  emptyAction: {
    marginTop: Spacing.three,
  },
});
