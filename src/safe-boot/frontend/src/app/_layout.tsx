/**
 * Expo Router — Root Layout
 *
 * ITS-V1: Defines dark/light color scheme, providers (i18n, Redux),
 * and navigation container for file-based routing.
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

// React Query client — global API cache per ITS-V1 RTK Query integration
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      gcTime: 300_000,
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
            </I18nextProvider>
          </QueryClientProvider>
        </ReduxProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
