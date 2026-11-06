import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_600SemiBold,
} from '@expo-google-fonts/jetbrains-mono';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { DefaultTheme, router, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Platform } from 'react-native';
import { PaperProvider, Portal } from 'react-native-paper';

import { Onboarding } from '@/components/onboarding/onboarding';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { EmptyState, ErrorState } from '@/components/ui/state-view';
import { paperTheme } from '@/constants/paper-theme';
import { AppColors } from '@/constants/theme';
import { t } from '@/constants/strings';
import { OnboardingProvider, useOnboarding } from '@/store/onboarding';
import { SessionProvider, useSession } from '@/store/session';

// Keep the splash screen up until the fonts are loaded and the saved session has been checked.
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

// Light only: navigation colors from our palette, whatever the phone's dark-mode setting.
const navigationTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: AppColors.ink,
    background: AppColors.background,
    card: AppColors.background,
    text: AppColors.text,
    border: AppColors.ink,
    notification: AppColors.signal,
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_600SemiBold,
  });

  if (!fontsLoaded && !fontError) {
    return null; // the splash screen stays visible
  }

  // The app needs the camera, GPS and secure storage of a phone.
  if (Platform.OS === 'web') {
    return <EmptyState title={t.web.title} message={t.web.message} />;
  }

  return (
    <PaperProvider theme={paperTheme}>
      <ThemeProvider value={navigationTheme}>
        <StatusBar style="dark" />
        <SessionProvider>
          <OnboardingProvider>
            <RootNavigator />
          </OnboardingProvider>
        </SessionProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

function RootNavigator() {
  const { status, retry, signOut } = useSession();
  const onboarding = useOnboarding();
  const [confirmingLogOut, setConfirmingLogOut] = useState(false);

  if (status === 'loading' || !onboarding.ready) {
    return null; // the splash screen is still visible
  }
  SplashScreen.hide();

  if (status === 'offline') {
    return (
      <>
        <ErrorState
          message={t.errors.offlineStartup}
          onRetry={retry}
          secondaryAction={{ title: t.account.logOut, onPress: () => setConfirmingLogOut(true) }}
        />
        <ConfirmDialog
          visible={confirmingLogOut}
          title={t.account.logOutTitle}
          message={t.account.logOutMessage}
          confirmLabel={t.account.logOut}
          onDismiss={() => setConfirmingLogOut(false)}
          onConfirm={() => {
            setConfirmingLogOut(false);
            signOut();
          }}
        />
      </>
    );
  }

  const signedIn = status === 'signed-in';

  // The onboarding is drawn through Paper's Portal, above everything (including the floating tab bar when it
  // is replayed from Pengaturan). "Mulai lapor" opens the report form when signed in, else stays on login.
  function startReporting() {
    onboarding.finish();
    if (signedIn) router.navigate('/new');
  }

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: AppColors.background } }}>
        <Stack.Protected guard={signedIn} redirectTo="/login">
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn} redirectTo="/">
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      {onboarding.visible ? (
        <Portal>
          <Onboarding onDone={onboarding.finish} onStart={startReporting} />
        </Portal>
      ) : null}
    </>
  );
}
