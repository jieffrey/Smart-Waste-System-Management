import {
  Archivo_400Regular,
  Archivo_500Medium,
  Archivo_600SemiBold,
  Archivo_700Bold,
  Archivo_800ExtraBold,
  Archivo_900Black,
} from '@expo-google-fonts/archivo';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium, IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono';
import { useFonts } from 'expo-font';
import { DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { EmptyState, ErrorState } from '@/components/ui/state-view';
import { paperTheme } from '@/constants/paper-theme';
import { AppColors } from '@/constants/theme';
import { t } from '@/constants/strings';
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
    Archivo_400Regular,
    Archivo_500Medium,
    Archivo_600SemiBold,
    Archivo_700Bold,
    Archivo_800ExtraBold,
    Archivo_900Black,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
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
          <RootNavigator />
        </SessionProvider>
      </ThemeProvider>
    </PaperProvider>
  );
}

function RootNavigator() {
  const { status, retry, signOut } = useSession();

  if (status === 'loading') {
    return null; // the splash screen is still visible
  }
  SplashScreen.hide();

  if (status === 'offline') {
    return (
      <ErrorState
        message={t.errors.offlineStartup}
        onRetry={retry}
        secondaryAction={{ title: t.account.logOut, onPress: () => signOut() }}
      />
    );
  }

  const signedIn = status === 'signed-in';

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: AppColors.background } }}>
      <Stack.Protected guard={signedIn} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
