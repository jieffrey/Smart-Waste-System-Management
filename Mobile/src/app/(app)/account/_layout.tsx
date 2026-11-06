import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/glass';
import { t } from '@/constants/strings';
import { FontFamily, Palette } from '@/constants/theme';

// Stack inside "Akun": the account screen (draws its own title) and Pengaturan (glass header, like the
// report detail).
export default function AccountStackLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: Palette.snow },
        headerShadowVisible: false,
        headerTintColor: Palette.ink,
        headerTitleStyle: { fontFamily: FontFamily.extrabold, fontSize: 18, color: Palette.ink },
        headerBackTitle: t.settings.back,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: t.account.title }} />
      <Stack.Screen
        name="settings"
        options={{
          title: t.settings.title,
          headerTransparent: true,
          headerBackground: () => <GlassSurface style={[StyleSheet.absoluteFill, styles.headerGlass]} />,
        }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  headerGlass: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(18, 18, 18, 0.12)',
  },
});
