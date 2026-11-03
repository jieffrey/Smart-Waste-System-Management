import { NativeTabs } from 'expo-router/native-tabs';

import { useTheme } from '@/hooks/use-theme';

// Signed-in area: three tabs. "My reports" has its own stack for the report detail screen.
export default function AppTabsLayout() {
  const theme = useTheme();

  return (
    <NativeTabs
      backgroundColor={theme.background}
      indicatorColor={theme.backgroundElement}
      labelStyle={{ selected: { color: theme.text } }}>
      <NativeTabs.Trigger name="(home)">
        <NativeTabs.Trigger.Label>My reports</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="list.bullet" md="list" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="new">
        <NativeTabs.Trigger.Label>New report</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="camera.fill" md="add_a_photo" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle" md="person" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
