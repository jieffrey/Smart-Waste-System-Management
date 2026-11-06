import { router, type Href } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Rule } from '@/components/ui/rule';
import { Screen } from '@/components/ui/screen';
import { Wordmark } from '@/components/ui/wordmark';
import { t } from '@/constants/strings';
import { Spacing } from '@/constants/theme';
import { useSession } from '@/store/session';

function Row({ label, value }: { label: string; value?: string }) {
  return (
    <View style={styles.row}>
      <ThemedText type="micro" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="heading">{value}</ThemedText>
    </View>
  );
}

export default function AccountScreen() {
  const { user, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [confirming, setConfirming] = useState(false);

  return (
    <Screen>
      <ThemedText type="title" accessibilityRole="header">
        {t.account.title}
      </ThemedText>
      <Rule weight="strong" />

      <Row label={t.account.name} value={user?.full_name} />
      <Rule weight="faint" />
      <Row label={t.account.email} value={user?.email} />
      <Rule weight="faint" />

      <Button title={t.account.settings} onPress={() => router.push('/account/settings' as Href)} variant="secondary" style={styles.logOut} />
      <Button title={t.account.logOut} onPress={() => setConfirming(true)} variant="text" loading={signingOut} />

      <View style={styles.footer}>
        <Wordmark />
      </View>

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
  row: {
    gap: Spacing.one,
    paddingVertical: Spacing.one,
  },
  logOut: {
    marginTop: Spacing.three,
  },
  footer: {
    marginTop: Spacing.five,
    opacity: 0.9,
  },
});
