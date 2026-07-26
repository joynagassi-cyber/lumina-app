/**
 * Expo Router — Tabs Layout (Bottom Navigation)
 *
 * Per ADR-012: expo-router v4 bottom-tabs for primary sections.
 * Matches the 5 primary aggregates: Finance, Members, Events, Groups, Settings
 */

import { Tabs } from 'expo-router';
import { Icon } from '@/components/ui/Icon';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#9966FF', // Lumina accent (from org config)
        tabBarInactiveTintColor: '#888',
        tabBarStyle: {
          borderTopWidth: 1,
          borderTopColor: '#333',
          paddingBottom: 5,
          paddingTop: 5,
        },
      }}
    >
      <Tabs.Screen name="finance" options={{ title: 'Finance' }} />
      <Tabs.Screen name="members" options={{ title: 'Members' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="groups" options={{ title: 'Groups' }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
    </Tabs>
  );
}
