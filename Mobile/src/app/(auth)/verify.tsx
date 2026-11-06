import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { AuthHero } from '@/components/auth/auth-hero';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { FieldMessage } from '@/components/ui/field-message';
import { Screen } from '@/components/ui/screen';
import { t } from '@/constants/strings';
import { FontFamily, Palette, Spacing } from '@/constants/theme';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import * as authService from '@/services/auth';
import { useSession } from '@/store/session';

const RESEND_COOLDOWN_SECONDS = 60; // same as the backend

// Email verification (only when the backend has OTP_ENABLED): the 6-digit code from the email, a resend
// button with a countdown, and plain errors. The code is checked by the backend; the app never sees it.
// `sent=1` (coming from registration) starts the countdown, because a code was just sent.
export default function VerifyScreen() {
  const { email = '', sent } = useLocalSearchParams<{ email: string; sent?: string }>();
  const { verifyEmail } = useSession();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(sent === '1' ? RESEND_COOLDOWN_SECONDS : 0);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((seconds) => seconds - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function submit() {
    setSubmitting(true);
    setError(null);
    setInfo(null);
    try {
      await verifyEmail(email, code);
      // Signed in: the protected routes switch to the app automatically.
    } catch (err) {
      setError(getFieldErrors(err).code ?? getErrorMessage(err));
      setSubmitting(false);
    }
  }

  async function resend() {
    setResending(true);
    setError(null);
    setInfo(null);
    try {
      await authService.resendCode(email);
      setCode('');
      setInfo(t.verify.resent);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setResending(false);
    }
  }

  return (
    <Screen>
      <AuthHero headline={t.verify.title} subline={t.verify.intro(email)} compact />

      <View style={styles.form}>
        <ThemedText type="smallBold">{t.verify.code}</ThemedText>
        <TextInput
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={6}
          accessibilityLabel={t.verify.code}
          placeholder="000000"
          placeholderTextColor={Palette.gray300}
          style={[styles.code, error ? styles.codeInvalid : null]}
        />
        {error ? <FieldMessage>{error}</FieldMessage> : null}
        {info ? (
          <ThemedText type="smallBold" style={styles.info}>
            {info}
          </ThemedText>
        ) : null}

        <Button title={t.verify.submit} onPress={submit} loading={submitting} disabled={code.length !== 6} />
        <Button
          title={cooldown > 0 ? t.verify.resendIn(cooldown) : t.verify.resend}
          onPress={resend}
          variant="secondary"
          loading={resending}
          disabled={cooldown > 0}
        />
        <Button title={t.verify.otherEmail} onPress={() => router.back()} variant="text" />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: {
    gap: Spacing.three,
  },
  code: {
    minHeight: 72,
    borderWidth: 1.5,
    borderColor: Palette.ink,
    backgroundColor: Palette.snow,
    textAlign: 'center',
    fontFamily: FontFamily.monoSemibold,
    fontSize: 36,
    letterSpacing: 12,
    color: Palette.ink,
  },
  codeInvalid: {
    borderWidth: 3,
  },
  info: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.highlight,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
