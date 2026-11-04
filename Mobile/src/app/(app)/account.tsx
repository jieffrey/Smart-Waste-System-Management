import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Screen } from '@/components/ui/screen';
import { t } from '@/constants/strings';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useSession } from '@/store/session';

export default function AccountScreen() {
  const theme = useTheme();
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);

  const [confirming, setConfirming] = useState(false);

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

      <Button title={t.account.logOut} onPress={() => setConfirming(true)} variant="secondary" loading={signingOut} />

      <ConfirmDialog
        visible={confirming}
        title={t.account.logOutTitle}
        message={t.account.logOutMessage}
        confirmLabel={t.account.logOut}
        onDismiss={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          setSigningOut(true);
          signOut();
        }}
      />
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
