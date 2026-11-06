import { useHeaderHeight } from 'expo-router/react-navigation';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FieldMessage } from '@/components/ui/field-message';
import { useTabBarSpace } from '@/components/ui/glass';
import { Rule } from '@/components/ui/rule';
import { TextField } from '@/components/ui/text-field';
import { t } from '@/constants/strings';
import { Palette, Spacing } from '@/constants/theme';
import { getErrorMessage, getFieldErrors } from '@/lib/errors';
import * as authService from '@/services/auth';
import { useOnboarding } from '@/store/onboarding';
import { useSession } from '@/store/session';

type Notice = { kind: 'success' | 'error'; text: string } | null;

// Akun → Pengaturan: edit profile, change password, replay the onboarding, log out.
export default function SettingsScreen() {
  const headerHeight = useHeaderHeight();
  const tabBarSpace = useTabBarSpace();

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[styles.content, { paddingTop: headerHeight + Spacing.three, paddingBottom: tabBarSpace }]}
        keyboardShouldPersistTaps="handled">
        <ProfileSection />
        <PasswordSection />
        <GuideSection />
        <LogOutSection />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Rule weight="strong" />
      <ThemedText type="heading" accessibilityRole="header">
        {title}
      </ThemedText>
      {children}
    </View>
  );
}

function NoticeText({ notice }: { notice: Notice }) {
  if (!notice) return null;
  if (notice.kind === 'error') return <FieldMessage>{notice.text}</FieldMessage>;
  return (
    <ThemedText type="smallBold" style={styles.success}>
      {notice.text}
    </ThemedText>
  );
}

// Field errors from the backend go under their field; anything else is one message above the button.
function useFormErrors() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<Notice>(null);
  function reset() {
    setErrors({});
    setNotice(null);
  }
  function fromError(err: unknown) {
    const fieldErrors = getFieldErrors(err);
    setErrors(fieldErrors);
    if (Object.keys(fieldErrors).length === 0) {
      setNotice({ kind: 'error', text: getErrorMessage(err) });
    }
  }
  return { errors, setErrors, notice, setNotice, reset, fromError };
}

function ProfileSection() {
  const { user, setUser } = useSession();
  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [saving, setSaving] = useState(false);
  const form = useFormErrors();

  async function save() {
    setSaving(true);
    form.reset();
    try {
      const { user: updated } = await authService.updateProfile({ full_name: fullName, email });
      setUser(updated);
      form.setNotice({ kind: 'success', text: t.settings.profileSaved });
    } catch (err) {
      form.fromError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={t.settings.profile}>
      <TextField label={t.settings.fullName} value={fullName} onChangeText={setFullName} autoComplete="name" error={form.errors.full_name} />
      <TextField
        label={t.settings.email}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        error={form.errors.email}
      />
      <NoticeText notice={form.notice} />
      <Button title={t.settings.saveProfile} onPress={save} loading={saving} />
    </Section>
  );
}

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [saving, setSaving] = useState(false);
  const form = useFormErrors();

  async function change() {
    form.reset();
    if (next !== repeat) {
      form.setErrors({ repeat: t.settings.passwordMismatch });
      return;
    }
    setSaving(true);
    try {
      await authService.changePassword(current, next);
      setCurrent('');
      setNext('');
      setRepeat('');
      form.setNotice({ kind: 'success', text: t.settings.passwordChanged });
    } catch (err) {
      form.fromError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Section title={t.settings.password}>
      <TextField
        label={t.settings.currentPassword}
        value={current}
        onChangeText={setCurrent}
        secureTextEntry
        autoComplete="current-password"
        error={form.errors.current_password}
      />
      <TextField
        label={t.settings.newPassword}
        value={next}
        onChangeText={setNext}
        secureTextEntry
        autoComplete="new-password"
        error={form.errors.new_password}
      />
      <TextField
        label={t.settings.repeatPassword}
        value={repeat}
        onChangeText={setRepeat}
        secureTextEntry
        autoComplete="new-password"
        error={form.errors.repeat}
      />
      <NoticeText notice={form.notice} />
      <Button
        title={t.settings.changePassword}
        onPress={change}
        variant="secondary"
        loading={saving}
        disabled={!current || !next || !repeat}
      />
    </Section>
  );
}

function GuideSection() {
  const { replay } = useOnboarding();
  return (
    <Section title={t.settings.guide}>
      <ThemedText type="small" themeColor="textSecondary">
        {t.settings.guideHint}
      </ThemedText>
      <Button title={t.settings.replayGuide} onPress={replay} variant="secondary" />
    </Section>
  );
}

function LogOutSection() {
  const { signOut } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  return (
    <Section title={t.settings.session}>
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
    </Section>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  screen: {
    backgroundColor: Palette.snow,
  },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.five,
  },
  section: {
    gap: Spacing.three,
  },
  success: {
    alignSelf: 'flex-start',
    backgroundColor: Palette.highlight,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.one,
  },
});
