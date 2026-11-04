import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/ui/tab-bar';
import { t } from '@/constants/strings';
import { Palette } from '@/constants/theme';

// Signed-in area: three tabs with our own tab bar ("Lapor" is the dominant one). "Laporan saya" has its own
// stack for the report detail screen.
export default function AppTabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Palette.snow } }}>
      <Tabs.Screen name="(home)" options={{ title: t.tabs.myReports }} />
      <Tabs.Screen name="new" options={{ title: t.tabs.report }} />
      <Tabs.Screen name="account" options={{ title: t.tabs.account }} />
    </Tabs>
  );
}
