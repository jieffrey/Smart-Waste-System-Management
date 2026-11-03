import { DarkTheme, DefaultTheme, SplashScreen, Stack, ThemeProvider } from 'expo-router';
import { Platform, useColorScheme } from 'react-native';

import { EmptyState, ErrorState } from '@/components/ui/state-view';
import { SessionProvider, useSession } from '@/store/session';

// Keep the splash screen up until the saved session has been checked.
if (Platform.OS !== 'web') {
  SplashScreen.preventAutoHideAsync();
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // The app needs the camera, GPS and secure storage of a phone.
  if (Platform.OS === 'web') {
    return (
      <EmptyState
        title="Please use the mobile app"
        message="SWMS reporting works on Android and iOS (Expo Go). Admins use the web dashboard."
      />
    );
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </ThemeProvider>
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
        message="Can't reach the server. Check your internet connection and that the backend is running."
        onRetry={retry}
        secondaryAction={{ title: 'Log out', onPress: () => signOut() }}
      />
    );
  }

  const signedIn = status === 'signed-in';

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={signedIn} redirectTo="/login">
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
    </Stack>
  );
}
