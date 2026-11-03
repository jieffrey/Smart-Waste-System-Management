import { Link } from 'expo-router';
import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { useSession } from '@/store/session';

export default function LoginScreen() {
  const theme = useTheme();
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
      <ThemedText type="subtitle">SWMS</ThemedText>
      <ThemedText themeColor="textSecondary">Log in to report waste and follow your reports.</ThemedText>

      {message ? <ThemedText style={{ color: theme.danger }}>{message}</ThemedText> : null}

      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={fieldErrors.email}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="password"
        textContentType="password"
        onSubmitEditing={handleSubmit}
      />

      <Button title="Log in" onPress={handleSubmit} loading={submitting} disabled={!email || !password} />

      <Link href="/register" style={{ color: theme.primary }}>
        No account yet? Create one
      </Link>
    </Screen>
  );
}
