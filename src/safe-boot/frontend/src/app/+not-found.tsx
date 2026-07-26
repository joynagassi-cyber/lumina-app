/**
 * Expo Router — +not-found fallback.
 * ITS-V1: Displayed for any unmatched route.
 */

import { Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <Stack.Screen name="+not-found" options={{ headerShown: false }} />
  );
}
