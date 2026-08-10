/**
 * Member Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import type { MemberProfile, GroupMembership, MemberState } from './types';

/* ------------------------------------------------------------------ */
/*  MemberList                                                         */
/* ------------------------------------------------------------------ */

export interface MemberListProps {
  members: ReadonlyArray<MemberProfile>;
  isLoading?: boolean;
  error?: string;
  onSelect?: (member: MemberProfile) => void;
  onAdd?: () => void;
  filterState?: MemberState;
  onFilterChange?: (state: MemberState | undefined) => void;
  searchPlaceholder?: string;
}

export function MemberList({
  members,
  isLoading = false,
  error,
  onSelect,
  onAdd,
  filterState,
  onFilterChange,
  searchPlaceholder = 'Search members...',
}: MemberListProps): React.ReactElement | null {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredMembers = members
    .filter((m) => {
      const matchesFilter = !filterState || m.state === filterState;
      const matchesSearch = !searchQuery ||
        m.firstName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.lastName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()));
      return matchesFilter && matchesSearch;
    })
    .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

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

  if (filteredMembers.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No members found</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onAdd && (
        <Pressable style={styles.addButton} onPress={onAdd}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.searchInput}
        placeholder={searchPlaceholder}
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#888"
      />

      <FlatList
        data={filteredMembers}
        keyExtractor={(m) => m.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.memberItem}
            onPress={() => onSelect?.(item)}
          >
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{item.fullName}</Text>
              <Text style={styles.memberMeta}>
                {item.email || 'No email'} • {item.memberNumber}
              </Text>
            </View>
            <View style={styles.memberStatus}>
              <Text style={[styles.stateTag, styles[stateTagStyle(item.state)]]}>
                {item.state}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function stateTagStyle(state: MemberState): keyof typeof styles {
  const styleMap: Record<MemberState, keyof typeof styles> = {
    active: 'activeTag',
    inactive: 'inactiveTag',
    deceased: 'deceasedTag',
    transferred: 'transferredTag',
  };
  return styleMap[state] || 'activeTag';
}

/* ------------------------------------------------------------------ */
/*  GroupMembershipTable                                               */
/* ------------------------------------------------------------------ */

export interface GroupMembershipTableProps {
  memberships: ReadonlyArray<GroupMembership>;
  isLoading?: boolean;
  error?: string;
  onRemove?: (membership: GroupMembership) => void;
}

export function GroupMembershipTable({
  memberships,
  isLoading = false,
  error,
  onRemove,
}: GroupMembershipTableProps): React.ReactElement | null {
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color="#6366f1" />
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

  if (memberships.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No group memberships</Text>
      </View>
    );
  }

  return (
    <View style={styles.tableContainer}>
      <View style={styles.tableHeader}>
        <Text style={styles.tableCell}>Member</Text>
        <Text style={styles.tableCell}>Group</Text>
        <Text style={styles.tableCell}>Role</Text>
        <Text style={styles.tableCell}>Status</Text>
        {onRemove && <Text style={styles.tableCell}>Actions</Text>}
      </View>

      {memberships.map((m) => (
        <View key={m.id} style={styles.tableRow}>
          <Text style={styles.tableCell}>Member ID: {m.memberId}</Text>
          <Text style={styles.tableCell}>Group ID: {m.groupId}</Text>
          <Text style={styles.tableCell}>{m.role}</Text>
          <Text style={styles.tableCell}>{m.status}</Text>
          {onRemove && (
            <Pressable
              style={styles.deleteButton}
              onPress={() => onRemove?.(m)}
            >
              <Text style={styles.deleteButtonText}>Remove</Text>
            </Pressable>
          )}
        </View>
      ))}
    </View>
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
  memberItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
    borderRadius: 8,
  },
  memberInfo: { flex: 1 },
  memberName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  memberMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  memberStatus: { marginLeft: 16 },
  stateTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  activeTag: { backgroundColor: '#1DB954', color: '#000' },
  inactiveTag: { backgroundColor: '#FFB800', color: '#000' },
  deceasedTag: { backgroundColor: '#888', color: '#fff' },
  transferredTag: { backgroundColor: '#E51332', color: '#fff' },
  tableContainer: { flex: 1 },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#181818',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  tableRow: {
    flexDirection: 'row',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1e1e1e',
  },
  tableCell: {
    color: '#ffffff',
    fontSize: 12,
  },
  deleteButton: {
    backgroundColor: '#E51332',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 4,
  },
  deleteButtonText: { color: '#ffffff', fontSize: 11 },
});