/**
 * Expo Router — Root Layout
 *
 * Implements ITS-V1 requirements:
 * - i18n provider (i18next)
 * - Redux Toolkit store
 * - React Query for API caching
 * - Dark/light theme via NativeWind v4
 *
 * @traceability PAS-v1 → RTS-v1 → Frontend Implementation
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as ReduxProvider } from 'react-redux';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';

import store from '@/store';
import i18n from '@/i18n';
import { useColorScheme } from 'react-native';
import { PortalProvider } from '@gorhom/portal';

// React Query client — global API cache per ITS-V1 RTK Query integration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      gcTime: 300_000, // 5 minutes
    },
  },
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  // Initialize i18n on first render
  useEffect(() => {
    // TODO: Load locale from user settings or device locale
  }, []);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <ReduxProvider store={store}>
          <QueryClientProvider client={queryClient}>
            <I18nextProvider i18n={i18n}>
              <PortalProvider>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    navigationBarColor: colorScheme === 'dark' ? '#121212' : '#ffffff',
                  }}
                >
                  <Stack.Screen name="(auth)" options={{ headerShown: false }} />
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="+not-found" />
                </Stack>
                <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
              </PortalProvider>
            </I18nextProvider>
          </QueryClientProvider>
        </ReduxProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
