import { Stack } from 'expo-router';
import { StyleSheet } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { GlassSurface } from '@/components/ui/glass';
import { t } from '@/constants/strings';
import { FontFamily, Palette } from '@/constants/theme';

// Stack inside "Laporan saya": the list (draws its own title) and a report's detail screen. The detail header is
// glass: transparent, blurred, with the photo and content scrolling underneath it (the screen pads its top by
// the header height). Pushes slide in from the right; with "reduce motion" on they simply appear.
export default function HomeStackLayout() {
  const reduceMotion = useReducedMotion();
  return (
    <Stack
      screenOptions={{
        animation: reduceMotion ? 'none' : 'slide_from_right',
        contentStyle: { backgroundColor: Palette.snow },
        headerStyle: { backgroundColor: Palette.snow },
        headerShadowVisible: false,
        headerTintColor: Palette.ink,
        headerTitleStyle: { fontFamily: FontFamily.extrabold, fontSize: 18, color: Palette.ink },
        headerBackTitle: t.myReports.back,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: t.myReports.title }} />
      <Stack.Screen
        name="reports/[id]"
        options={{
          title: t.myReports.reportDetailTitle,
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
