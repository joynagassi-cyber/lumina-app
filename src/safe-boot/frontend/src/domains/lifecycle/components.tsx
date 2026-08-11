/**
 * Lifecycle Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 8 (LifecycleAggregate)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import type {
  ArchiveEntry,
  ArchiveEntryWithPreview,
  ArchiveState,
  PurgeSchedule,
} from './types';

/* ------------------------------------------------------------------ */
/*  ArchiveList                                                        */
/* ------------------------------------------------------------------ */

export interface ArchiveListProps {
  entries: ReadonlyArray<ArchiveEntryWithPreview>;
  isLoading?: boolean;
  error?: string;
  onSelect?: (entry: ArchiveEntry) => void;
  onArchive?: () => void;
  filterState?: ArchiveState;
  onFilterChange?: (state: ArchiveState | undefined) => void;
}

export function ArchiveList({
  entries,
  isLoading = false,
  error,
  onSelect,
  onArchive,
  filterState,
  onFilterChange,
}: ArchiveListProps): React.ReactElement | null {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredEntries = useMemo(() => {
    return entries
      .filter((e) => {
        const matchesFilter = !filterState || e.entry.state === filterState;
        const matchesSearch = !searchQuery ||
          e.entry.resourceId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          e.entry.resourceType.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => new Date(b.entry.updatedAt).getTime() - new Date(a.entry.updatedAt).getTime());
  }, [entries, filterState, searchQuery]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Error: {error}</Text>
      </View>
    );
  }

  if (filteredEntries.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No archive entries</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onArchive && (
        <Pressable style={styles.addButton} onPress={onArchive}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.searchInput}
        placeholder="Search archives..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#888"
      />

      <FlatList
        data={filteredEntries}
        keyExtractor={(e) => e.entry.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.archiveItem}
            onPress={() => onSelect?.(item.entry)}
          >
            <View style={styles.archiveInfo}>
              <Text style={styles.archiveTitle}>
                {item.entry.resourceType}: {item.entry.resourceId}
              </Text>
              <Text style={styles.archiveMeta}>
                {item.entry.state} • Archived {formatTimeAgo(item.entry.archivedAt)}
              </Text>
            </View>
            <View style={styles.archiveStatus}>
              <Text style={[styles.stateTag, styles[stateTagStyle(item.entry.state)]]}>
                {item.entry.state}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

function stateTagStyle(state: ArchiveState): keyof typeof styles {
  const styleMap: Record<ArchiveState, keyof typeof styles> = {
    pending: 'pendingTag',
    archived: 'archivedTag',
    purged: 'purgedTag',
    restored: 'restoredTag',
  };
  return styleMap[state] || 'pendingTag';
}

/* ------------------------------------------------------------------ */
/*  ArchiveEntryDetail                                                 */
/* ------------------------------------------------------------------ */

export interface ArchiveEntryDetailProps {
  entry: ArchiveEntry | null;
  data: Record<string, unknown> | null;
  isLoading?: boolean;
  error?: string;
  onRestore?: () => void;
  onPurge?: () => void;
  onBack?: () => void;
}

export function ArchiveEntryDetail({
  entry,
  data,
  isLoading = false,
  error,
  onRestore,
  onPurge,
  onBack,
}: ArchiveEntryDetailProps): React.ReactElement | null {
  if (!entry) {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Archive entry not found</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.detailContainer}>
      {onBack && (
        <TouchableOpacity
          style={styles.backButton}
          onPress={onBack}
        >
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
      )}

      <Text style={styles.detailTitle}>Archive Entry Details</Text>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Resource Type</Text>
        <Text style={styles.detailValue}>{entry.resourceType}</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Resource ID</Text>
        <Text style={styles.detailValue}>{entry.resourceId}</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Organization</Text>
        <Text style={styles.detailValue}>{entry.organizationId}</Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>State</Text>
        <Text style={[styles.detailValue, styles[stateTagStyle(entry.state)]]}>
          {entry.state}
        </Text>
      </View>

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Archived At</Text>
        <Text style={styles.detailValue}>{new Date(entry.archivedAt).toLocaleString()}</Text>
      </View>

      {entry.reason && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Reason</Text>
          <Text style={styles.detailValue}>{entry.reason}</Text>
        </View>
      )}

      <View style={styles.detailSection}>
        <Text style={styles.detailLabel}>Archived By</Text>
        <Text style={styles.detailValue}>{entry.archivedBy}</Text>
      </View>

      {data && (
        <View style={styles.detailSection}>
          <Text style={styles.detailLabel}>Data Preview</Text>
          <View style={styles.dataPreview}>
            <Text style={styles.dataText}>{JSON.stringify(data, null, 2).substring(0, 500)}{JSON.stringify(data, null, 2).length > 500 ? '...' : ''}</Text>
          </View>
        </View>
      )}

      {(onRestore || onPurge) && (
        <View style={styles.actionButtons}>
          {onRestore && (
            <Pressable
              style={styles.actionButton}
              onPress={onRestore}
            >
              <Text style={styles.actionButtonText}>Restore</Text>
            </Pressable>
          )}
          {onPurge && (
            <Pressable
              style={[styles.actionButton, styles.deleteButton]}
              onPress={() => Alert.alert('Confirm Purge', 'Are you sure you want to permanently purge this archive?', [
                { text: 'Cancel' },
                { text: 'Purge', style: 'destructive', onPress: onPurge },
              ])}
            >
              <Text style={styles.actionButtonText}>Purge</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  errorText: { color: '#ff6b6b', fontSize: 14 },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  emptyText: { color: '#888', fontSize: 16 },
  addButton: {
    backgroundColor: '#6366f1',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    margin: 16,
    alignSelf: 'flex-end',
  },
  addButtonText: { color: '#ffffff', fontSize: 24, fontWeight: 'bold' },
  searchInput: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginHorizontal: 16,
    borderColor: '#333',
    borderWidth: 1,
  },
  archiveItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
    borderRadius: 8,
  },
  archiveInfo: { flex: 1 },
  archiveTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  archiveMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  archiveStatus: { marginLeft: 16 },
  detailContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  backButton: { marginBottom: 16 },
  backButtonText: { color: '#6366f1', fontSize: 16 },
  detailTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 16 },
  detailSection: { marginBottom: 16 },
  detailLabel: { color: '#888', fontSize: 12, fontWeight: '500' },
  detailValue: { color: '#ffffff', fontSize: 14, marginTop: 4 },
  dataPreview: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
  },
  dataText: { color: '#888', fontSize: 12, fontFamily: 'monospace' },
  actionButtons: { flexDirection: 'row', gap: 12, marginTop: 24 },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  deleteButton: { backgroundColor: '#E51332' },
  actionButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  stateTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  pendingTag: { backgroundColor: '#FF9800', color: '#000' },
  archivedTag: { backgroundColor: '#2196F3', color: '#fff' },
  purgedTag: { backgroundColor: '#F44336', color: '#fff' },
  restoredTag: { backgroundColor: '#4CAF50', color: '#fff' },
});