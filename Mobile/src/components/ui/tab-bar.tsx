import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { Portal } from 'react-native-paper';
import Animated, { Easing, useAnimatedStyle, useReducedMotion, useSharedValue, withTiming } from 'react-native-reanimated';

import { GlassSurface, TAB_BAR_HEIGHT, TAB_BAR_SIDE_INSET, useTabBarBottom, type GlassTarget } from '@/components/ui/glass';
import { t } from '@/constants/strings';
import { FontFamily, Palette } from '@/constants/theme';

type IconName = keyof typeof MaterialCommunityIcons.glyphMap;

const TABS: Record<string, { label: string; icon: IconName; iconActive: IconName; anchor?: boolean }> = {
  '(home)': { label: t.tabs.myReports, icon: 'format-list-bulleted', iconActive: 'format-list-bulleted' },
  new: { label: t.tabs.report, icon: 'camera-outline', iconActive: 'camera', anchor: true },
  account: { label: t.tabs.account, icon: 'account-outline', iconActive: 'account' },
};

const ROW_PADDING = 4;
const ICON_SIZE = 24;
const ANCHOR_ICON_SIZE = 28;
const INDICATOR_INSET = 6;
const SLIDE = { duration: 260, easing: Easing.bezier(0.2, 0, 0, 1) };

type Slot = { x: number; width: number };

// Floating glass tab bar: rounded, inset from the screen edges, content scrolls behind it. Every tab has the same
// active state: a yellow-punk pill slides behind it and its icon and label turn ink. "Lapor" stays the visual
// anchor only through a slightly wider slot and a larger camera icon, never a colored block of its own.
// Rendered through Paper's Portal so that, on Android, it sits outside the BlurTargetView it blurs.
// `badges`: a count per tab (e.g. reports with news), drawn as an ink dot with a yellow number on the icon.
export function TabBar({
  state,
  navigateToTab,
  target,
  badges = {},
}: BottomTabBarProps & { target: GlassTarget; badges?: Record<string, number> }) {
  const bottom = useTabBarBottom();
  const reduceMotion = useReducedMotion();
  const [slots, setSlots] = useState<Record<number, Slot>>({});

  const x = useSharedValue(0);
  const width = useSharedValue(0);
  const active = slots[state.index];

  useEffect(() => {
    if (!active) return;
    const config = reduceMotion ? { duration: 0 } : SLIDE;
    x.value = withTiming(active.x + INDICATOR_INSET, config);
    width.value = withTiming(active.width - INDICATOR_INSET * 2, config);
  }, [active, reduceMotion, x, width]);

  const indicatorStyle = useAnimatedStyle(() => ({ transform: [{ translateX: x.value }], width: width.value }));

  function onSlotLayout(index: number, event: LayoutChangeEvent) {
    const { x: slotX, width: slotWidth } = event.nativeEvent.layout;
    setSlots((current) => ({ ...current, [index]: { x: slotX, width: slotWidth } }));
  }

  return (
    <Portal>
      <View pointerEvents="box-none" style={[styles.host, { bottom }]}>
        <GlassSurface target={target} style={styles.bar}>
          {active ? <Animated.View style={[styles.indicator, indicatorStyle]} /> : null}
          <View style={styles.row} accessibilityRole="tablist">
            {state.routes.map((route, index) => {
              const tab = TABS[route.name];
              if (!tab) return null;
              const focused = state.index === index;
              const badge = badges[route.name] ?? 0;
              return (
                <Pressable
                  key={route.key}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: focused }}
                  accessibilityLabel={badge > 0 && route.name === '(home)' ? `${tab.label}, ${t.myReports.tabUpdates(badge)}` : tab.label}
                  onLayout={(event) => onSlotLayout(index, event)}
                  onPress={() => {
                    if (!focused) navigateToTab(route.key);
                  }}
                  style={({ pressed }) => [styles.item, tab.anchor && styles.anchorSlot, pressed && styles.pressed]}>
                  {({ pressed }) => (
                    <View style={[styles.content, pressed && !focused && styles.contentPressed]}>
                      <View>
                        <MaterialCommunityIcons
                          name={focused ? tab.iconActive : tab.icon}
                          size={tab.anchor ? ANCHOR_ICON_SIZE : ICON_SIZE}
                          color={focused ? Palette.ink : Palette.gray700}
                        />
                        {badge > 0 ? (
                          <View style={styles.badge}>
                            <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
                          </View>
                        ) : null}
                      </View>
                      <Text style={[styles.label, focused ? styles.labelStrong : styles.labelIdle]}>{tab.label}</Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </View>
        </GlassSurface>
      </View>
    </Portal>
  );
}

const styles = StyleSheet.create({
  host: {
    position: 'absolute',
    left: TAB_BAR_SIDE_INSET,
    right: TAB_BAR_SIDE_INSET,
    // Soft shadow so the bar floats above snow content (on the host: the glass clips its own overflow).
    borderRadius: TAB_BAR_HEIGHT / 2,
    shadowColor: Palette.ink,
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  bar: {
    height: TAB_BAR_HEIGHT,
    borderRadius: TAB_BAR_HEIGHT / 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.85)',
  },
  row: {
    flex: 1,
    flexDirection: 'row',
    paddingHorizontal: ROW_PADDING,
  },
  indicator: {
    position: 'absolute',
    top: INDICATOR_INSET,
    bottom: INDICATOR_INSET,
    left: ROW_PADDING,
    borderRadius: TAB_BAR_HEIGHT / 2,
    backgroundColor: Palette.highlight, // ink on yellow punk: 15.3:1
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  anchorSlot: {
    flex: 1.15,
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 999,
  },
  // Pressing an inactive tab: a faint ink wash, so the press shows without looking like the active pill.
  contentPressed: {
    backgroundColor: 'rgba(18, 18, 18, 0.06)',
  },
  label: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
  labelStrong: {
    fontFamily: FontFamily.extrabold,
    color: Palette.ink,
  },
  badge: {
    position: 'absolute',
    top: -5,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontFamily: FontFamily.monoSemibold,
    fontSize: 11,
    lineHeight: 14,
    color: Palette.highlight, // yellow punk on ink: 15.3:1
  },
  labelIdle: {
    color: Palette.gray700, // 9.4:1 on the glass tint
  },
});
