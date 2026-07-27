/**
 * Sync Domain — React Native UI component for sync status indicator.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 13 (OfflineSyncAggregate)
 * @traceability OFFLINE-FIRST-SPEC: Connection state + pending count display
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import type { ConnectionState } from './types';

export interface SyncStatusIndicatorProps {
  connectionState: ConnectionState;
  pendingCount: number;
  lastSyncTimestamp: string | null;
  isSyncing: boolean;
}

/**
 * Renders a compact sync status badge showing connection state,
 * pending operations count, and last sync time.
 */
export function SyncStatusIndicator({
  connectionState,
  pendingCount,
  lastSyncTimestamp,
  isSyncing,
}: SyncStatusIndicatorProps): React.ReactElement {
  const { icon, label, color } = useMemo(() => {
    switch (connectionState) {
      case 'online':
        return { icon: '✅', label: 'Online', color: '#22c55e' };
      case 'offline':
        return { icon: '⚠️', label: 'Offline', color: '#f59e0b' };
      case 'unreachable':
        return { icon: '🔴', label: 'Unreachable', color: '#ef4444' };
      default:
        return { icon: '?', label: 'Unknown', color: '#a0a0a0' };
    }
  }, [connectionState]);

  const formattedLastSync = useMemo(() => {
    if (!lastSyncTimestamp) return 'Never synced';
    try {
      const d = new Date(lastSyncTimestamp);
      return d.toLocaleString();
    } catch {
      return lastSyncTimestamp.slice(0, 19);
    }
  }, [lastSyncTimestamp]);

  return (
    <View style={styles.container}>
      <Text style={[styles.badge, { backgroundColor: color }]}>
        {icon} {label}
      </Text>

      {isSyncing && <Text style={styles.syncingText}>Syncing...</Text>}

      {pendingCount > 0 && (
        <Text style={styles.pendingBadge}>{pendingCount} pending</Text>
      )}

      <Text style={styles.meta}>Last sync: {formattedLastSync}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#ffffff',
  },
  syncingText: { fontSize: 13, fontStyle: 'italic', color: '#60a5fa' },
  pendingBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    fontSize: 12,
    color: '#f59e0b',
  },
  meta: { fontSize: 12, color: '#707070' },
});
