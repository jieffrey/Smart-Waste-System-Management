import { Link, router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AuthHero } from '@/components/auth/auth-hero';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FieldMessage } from '@/components/ui/field-message';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { t } from '@/constants/strings';
import { Spacing } from '@/constants/theme';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { useSession } from '@/store/session';

export default function RegisterScreen() {
  const { signUp } = useSession();
  const [fullName, setFullName] = useState('');
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
      const result = await signUp(fullName.trim(), email.trim(), password);
      // Signed in: the protected routes switch to the app automatically. Otherwise the code screen comes next.
      if (result === 'verify') {
        setSubmitting(false);
        router.push({ pathname: '/verify', params: { email: email.trim().toLowerCase(), sent: '1' } });
      }
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  }

  return (
    <Screen>
      <AuthHero headline={t.auth.registerTitle} subline={t.auth.registerIntro} compact />

      <View style={styles.form}>
        {error ? <FieldMessage>{error}</FieldMessage> : null}

        <TextField
          label={t.auth.fullName}
          value={fullName}
          onChangeText={setFullName}
          error={fieldErrors.full_name}
          autoComplete="name"
          textContentType="name"
        />
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
          label={t.auth.passwordHint}
          value={password}
          onChangeText={setPassword}
          error={fieldErrors.password}
          secureTextEntry
          autoComplete="new-password"
          textContentType="newPassword"
        />

        <Button
          title={t.auth.createAccount}
          onPress={handleSubmit}
          loading={submitting}
          disabled={!fullName || !email || !password}
        />

        <View style={styles.switchRow}>
          <ThemedText themeColor="textSecondary">{t.auth.haveAccount}</ThemedText>
          <Link href="/login" style={styles.link}>
            <ThemedText type="link">{t.auth.goToLogin}</ThemedText>
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
