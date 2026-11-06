import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { t } from '@/constants/strings';
import { FontFamily, Palette } from '@/constants/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName; dominant?: boolean }> = {
  '(home)': { label: t.tabs.myReports, icon: 'format-list-bulleted', iconActive: 'format-list-bulleted' },
  new: { label: t.tabs.report, icon: 'camera-outline', iconActive: 'camera', dominant: true },
  account: { label: t.tabs.account, icon: 'account-outline', iconActive: 'account' },
};

// Custom tab bar: "Lapor" is a red-orange block (the app's main action), the other two are quiet. The active
// tab is marked with a 3px ink bar on top and a bold label; no Material pill indicator.
export function TabBar({ state, navigateToTab, insets }: BottomTabBarProps) {
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const tab = TABS[route.name];
        if (!tab) return null;
        const focused = state.index === index;

        function onPress() {
          if (!focused) {
            navigateToTab(route.key);
          }
        }

        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={tab.label}
            onPress={onPress}
            style={({ pressed }) => [
              styles.item,
              tab.dominant && styles.dominant,
              pressed && (tab.dominant ? styles.dominantPressed : styles.pressed),
            ]}>
            {!tab.dominant && focused ? <View style={styles.activeBar} /> : null}
            {/* Same icon box for every tab, so the labels share one baseline. */}
            <View style={styles.iconBox}>
              <MaterialCommunityIcons
                name={focused ? tab.iconActive : tab.icon}
                size={tab.dominant ? 28 : 24}
                color={Palette.ink}
              />
            </View>
            <Text style={[styles.label, (focused || tab.dominant) && styles.labelStrong]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: Palette.ink,
    backgroundColor: Palette.snow,
  },
  item: {
    flex: 1,
    minHeight: 60,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 6,
  },
  dominant: {
    flex: 1.3,
    backgroundColor: Palette.signal, // ink icon + label on red orange: 5.57:1
  },
  pressed: {
    backgroundColor: Palette.gray50,
  },
  dominantPressed: {
    backgroundColor: '#E8411A',
  },
  activeBar: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 3,
    backgroundColor: Palette.ink,
  },
  iconBox: {
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 12,
    lineHeight: 16,
    color: Palette.ink,
  },
  labelStrong: {
    fontFamily: FontFamily.bold,
  },
});
