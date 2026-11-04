import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthHero } from '@/components/auth/auth-hero';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FieldMessage } from '@/components/ui/field-message';
import { Rule } from '@/components/ui/rule';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { t } from '@/constants/strings';
import { Spacing } from '@/constants/theme';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { useSession } from '@/store/session';

export default function LoginScreen() {
  const { signIn, notice } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    setFieldErrors({});
    try {
      await signIn(email.trim(), password);
      // On success the protected routes switch to the app automatically.
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  }

  const message = error ?? notice;

  return (
    <Screen>
      <AuthHero headline={t.auth.headline} highlight={t.auth.headlineHighlight} subline={t.auth.subline} />

      <View style={styles.form}>
        <ThemedText type="title" accessibilityRole="header">
          {t.auth.loginTitle}
        </ThemedText>
        <Rule weight="strong" />

        {message ? <FieldMessage>{message}</FieldMessage> : null}

        <TextField
          label={t.auth.email}
          value={email}
          onChangeText={setEmail}
          error={fieldErrors.email}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
        />
        <TextField
          label={t.auth.password}
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          onSubmitEditing={handleSubmit}
        />

        <Button title={t.auth.logIn} onPress={handleSubmit} loading={submitting} disabled={!email || !password} />

        <View style={styles.switchRow}>
          <ThemedText themeColor="textSecondary">{t.auth.noAccount}</ThemedText>
          <Link href="/register" style={styles.link}>
            <ThemedText type="link">{t.auth.createOne}</ThemedText>
          </Link>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  switchRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.one,
  },
  link: {
    paddingVertical: Spacing.two,
  },
});
