import { BlurTargetView } from 'expo-blur';
import { Tabs } from 'expo-router/js-tabs';
import { useRef, type ComponentRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { GlassTargetContext, TAB_BAR_HEIGHT, TabBarSpaceContext, useTabBarBottom } from '@/components/ui/glass';
import { TabBar } from '@/components/ui/tab-bar';
import { t } from '@/constants/strings';
import { UpdatesProvider, useUpdates } from '@/store/updates';
import { Palette, Spacing } from '@/constants/theme';

// Signed-in area: three tabs under a floating glass tab bar. The screens sit inside a BlurTargetView (what the
// bar blurs on Android) and scroll behind the bar; TabBarSpaceContext tells them how much bottom padding to
// leave. Switching tabs fades and shifts slightly ("shift"), or cuts with "reduce motion" on.
export default function AppTabsLayout() {
  return (
    <UpdatesProvider>
      <AppTabs />
    </UpdatesProvider>
  );
}

function AppTabs() {
  const { count: updates } = useUpdates();
  const target = useRef<ComponentRef<typeof View>>(null);
  const reduceMotion = useReducedMotion();
  const tabBarSpace = TAB_BAR_HEIGHT + useTabBarBottom() + Spacing.three;

  return (
    <GlassTargetContext.Provider value={target}>
      <TabBarSpaceContext.Provider value={tabBarSpace}>
        <BlurTargetView ref={target} style={styles.fill}>
          <Tabs
            tabBar={(props) => <TabBar {...props} target={target} badges={{ '(home)': updates }} />}
            screenOptions={{
              headerShown: false,
              sceneStyle: { backgroundColor: Palette.snow },
              animation: reduceMotion ? 'none' : 'shift',
            }}>
            <Tabs.Screen name="(home)" options={{ title: t.tabs.myReports }} />
            <Tabs.Screen name="new" options={{ title: t.tabs.report }} />
            <Tabs.Screen name="account" options={{ title: t.tabs.account }} />
          </Tabs>
        </BlurTargetView>
      </TabBarSpaceContext.Provider>
    </GlassTargetContext.Provider>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    backgroundColor: Palette.snow,
  },
});
