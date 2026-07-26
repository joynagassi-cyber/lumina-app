/**
 * Expo Router — Auth Layout (Gate)
 *
 * Guards authenticated routes, shows login screen for unauthenticated users.
 * Per ITS-V1: JWT + SecureStore auth strategy
 */

import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
