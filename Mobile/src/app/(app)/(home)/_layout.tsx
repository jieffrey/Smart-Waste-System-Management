import { Stack } from 'expo-router';

import { t } from '@/constants/strings';
import { FontFamily, Palette } from '@/constants/theme';

// Stack inside "Laporan saya": the list (draws its own title) and a report's detail screen (light header with
// a back button, a 1px ink rule under it via the screen content).
export default function HomeStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: Palette.snow },
        headerStyle: { backgroundColor: Palette.snow },
        headerShadowVisible: false,
        headerTintColor: Palette.ink,
        headerTitleStyle: { fontFamily: FontFamily.bold, fontSize: 18, color: Palette.ink },
        headerBackTitle: t.myReports.back,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false, title: t.myReports.title }} />
      <Stack.Screen name="reports/[id]" options={{ title: t.myReports.reportDetailTitle }} />
    </Stack>
  );
}
