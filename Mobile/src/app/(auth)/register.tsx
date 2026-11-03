import { useState } from 'react';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { TextField } from '@/components/ui/text-field';
import { useTheme } from '@/hooks/use-theme';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import { useSession } from '@/store/session';

export default function RegisterScreen() {
  const theme = useTheme();
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
      await signUp(fullName.trim(), email.trim(), password);
      // On success the protected routes switch to the app automatically.
    } catch (err) {
      setError(getErrorMessage(err));
      setFieldErrors(getFieldErrors(err));
      setSubmitting(false);
    }
  }

  return (
    <Screen edges={['left', 'right']}>
      <ThemedText themeColor="textSecondary">Create an account to report waste in your area.</ThemedText>

      {error ? <ThemedText style={{ color: theme.danger }}>{error}</ThemedText> : null}

      <TextField
        label="Full name"
        value={fullName}
        onChangeText={setFullName}
        error={fieldErrors.full_name}
        autoComplete="name"
        textContentType="name"
      />
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
        label="Password (8–72 characters)"
        value={password}
        onChangeText={setPassword}
        error={fieldErrors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />

      <Button
        title="Create account"
        onPress={handleSubmit}
        loading={submitting}
        disabled={!fullName || !email || !password}
      />
    </Screen>
  );
}
