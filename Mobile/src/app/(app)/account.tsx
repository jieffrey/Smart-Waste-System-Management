import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/store/session';

export default function AccountScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert('Log out?', 'You will need to log in again to report waste.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log out',
        style: 'destructive',
        onPress: () => {
          setSigningOut(true);
          signOut();
        },
      },
    ]);
  }

  return (
    <Screen>
      <ThemedText type="subtitle">Account</ThemedText>

      <View style={[styles.card, { backgroundColor: theme.backgroundElement }]}>
        <ThemedText type="smallBold">Name</ThemedText>
        <ThemedText>{user?.full_name}</ThemedText>
        <ThemedText type="smallBold" style={styles.label}>
          Email
        </ThemedText>
        <ThemedText>{user?.email}</ThemedText>
      </View>

      <Button title="Log out" onPress={confirmSignOut} variant="secondary" loading={signingOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: Spacing.three,
    borderRadius: Spacing.two,
    gap: Spacing.half,
  },
  label: {
    marginTop: Spacing.two,
  },
});
