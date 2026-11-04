import { Stack } from 'expo-router';

import { Palette } from '@/constants/theme';

// Login and register draw their own headers (the front-door panel); no native header bar.
export default function AuthLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.snow } }} />;
}
