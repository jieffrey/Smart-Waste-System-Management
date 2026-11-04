import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Palette, Spacing } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  // Screens with a navigation header don't need the top safe-area padding.
  edges?: Edge[];
}

// A scrollable snow screen with safe-area padding that moves up when the keyboard opens.
export function Screen({ children, edges = ['top', 'left', 'right'] }: ScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Palette.snow,
  },
  flex: {
    flex: 1,
  },
  content: {
    padding: Spacing.three,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
});
