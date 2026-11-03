import { Stack } from 'expo-router';

// Stack inside the "My reports" tab: the list, then a report's detail screen.
export default function HomeStackLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: 'My reports' }} />
    </Stack>
  );
}
