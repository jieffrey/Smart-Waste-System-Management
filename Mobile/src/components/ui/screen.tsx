import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { useTabBarSpace } from '@/components/ui/glass';
import { Palette, Spacing } from '@/constants/theme';

interface ScreenProps {
  children: ReactNode;
  // Screens with a navigation header don't need the top safe-area padding.
  edges?: Edge[];
}

// A scrollable snow screen with safe-area padding that moves up when the keyboard opens. Inside the tabs the
// content gets extra bottom padding, so it can scroll clear of the floating tab bar.
export function Screen({ children, edges = ['top', 'left', 'right'] }: ScreenProps) {
  const tabBarSpace = useTabBarSpace();
  return (
    <SafeAreaView edges={edges} style={styles.safeArea}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, tabBarSpace > 0 && { paddingBottom: tabBarSpace }]}
          keyboardShouldPersistTaps="handled">
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
