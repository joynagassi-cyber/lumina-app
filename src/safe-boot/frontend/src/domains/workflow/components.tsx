/**
 * Workflow Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 5 (WorkflowAggregate)
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
  TextInput,
} from 'react-native';
import type {
  WorkflowDefinition,
  WorkflowInstance,
  WorkflowStep,
  WorkflowState,
  StepState,
} from './types';

/* ------------------------------------------------------------------ */
/*  WorkflowList                                                       */
/* ------------------------------------------------------------------ */

export interface WorkflowListProps {
  instances: ReadonlyArray<WorkflowInstance>;
  definitions?: ReadonlyArray<WorkflowDefinition>;
  isLoading?: boolean;
  error?: string;
  onSelect?: (instance: WorkflowInstance) => void;
  onCreate?: () => void;
  filterState?: WorkflowState;
  onFilterChange?: (state: WorkflowState | undefined) => void;
}

export function WorkflowList({
  instances,
  definitions = [],
  isLoading = false,
  error,
  onSelect,
  onCreate,
  filterState,
  onFilterChange,
}: WorkflowListProps): React.ReactElement | null {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredInstances = useMemo(() => {
    return instances
      .filter((i) => {
        const matchesFilter = !filterState || i.state === filterState;
        const matchesSearch = !searchQuery ||
          i.contextId.toLowerCase().includes(searchQuery.toLowerCase()) ||
          definitions.find(d => d.id === i.workflowDefinitionId)?.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          false;
        return matchesFilter && matchesSearch;
      })
      .sort((a, b) => new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime());
  }, [instances, filterState, searchQuery, definitions]);

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

  if (filteredInstances.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No workflows running</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {onCreate && (
        <Pressable style={styles.addButton} onPress={onCreate}>
          <Text style={styles.addButtonText}>+</Text>
        </Pressable>
      )}

      <TextInput
        style={styles.searchInput}
        placeholder="Search workflows..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        placeholderTextColor="#888"
      />

      <FlatList
        data={filteredInstances}
        keyExtractor={(i) => i.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.workflowItem}
            onPress={() => onSelect?.(item)}
          >
            <View style={styles.workflowInfo}>
              <Text style={styles.workflowTitle}>
                {getWorkflowTitle(item, definitions)}
              </Text>
              <Text style={styles.workflowMeta}>
                Context: {item.contextId} • Step {item.currentStep + 1}/{item.totalSteps}
              </Text>
            </View>
            <View style={styles.workflowStatus}>
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

function getWorkflowTitle(instance: WorkflowInstance, definitions: ReadonlyArray<WorkflowDefinition>) {
  const def = definitions.find(d => d.id === instance.workflowDefinitionId);
  return def ? def.title : `Workflow (${instance.contextType})`;
}

function stateTagStyle(state: string): keyof typeof styles {
  const styleMap: Record<string, keyof typeof styles> = {
    draft: 'draftTag',
    active: 'activeTag',
    paused: 'pausedTag',
    completed: 'completedTag',
    archived: 'archivedTag',
  };
  return styleMap[state] || 'draftTag';
}

/* ------------------------------------------------------------------ */
/*  WorkflowStepDetails                                                */
/* ------------------------------------------------------------------ */

export interface WorkflowStepDetailsProps {
  instance: WorkflowInstance | null;
  steps: ReadonlyArray<WorkflowStep>;
  isLoading?: boolean;
  error?: string;
  onStepAction?: (stepId: string, action: 'complete' | 'skip' | 'retry' | 'assign') => void;
  onAssignModalOpen?: () => void;
}

export function WorkflowStepDetails({
  instance,
  steps,
  isLoading = false,
  error,
  onStepAction,
  onAssignModalOpen,
}: WorkflowStepDetailsProps): React.ReactElement | null {
  if (!instance) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>Select a workflow instance</Text>
      </View>
    );
  }

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
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.stepsContainer}>
      <Text style={styles.stepsTitle}>
        Steps for {instance.contextType}
      </Text>

      <FlatList
        data={steps}
        keyExtractor={(s) => s.id}
        renderItem={({ item }) => (
          <View style={styles.stepItem}>
            <View style={styles.stepHeader}>
              <Text style={styles.stepName}>{item.name}</Text>
              <Text style={[styles.stateTag, styles[stateTagStyle(item.state)]]}>
                {item.state}
              </Text>
            </View>
            <Text style={styles.stepMeta}>
              Step {item.index + 1} of {steps.length}
            </Text>
            {item.assignedTo && (
              <Text style={styles.stepMeta}>Assigned to: {item.assignedTo}</Text>
            )}
            {item.state === 'failed' && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => onStepAction?.(item.id, 'retry')}
              >
                <Text style={styles.actionButtonText}>Retry</Text>
              </TouchableOpacity>
            )}
            {item.state === 'pending' && (
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => onStepAction?.(item.id, 'complete')}
                >
                  <Text style={styles.actionButtonText}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionButton, styles.deleteButton]}
                  onPress={() => onStepAction?.(item.id, 'skip')}
                >
                  <Text style={styles.actionButtonText}>Skip</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
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
  workflowItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
    borderRadius: 8,
  },
  workflowInfo: { flex: 1 },
  workflowTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  workflowMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  workflowStatus: { marginLeft: 16 },
  stepsContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
  stepsTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  stepItem: {
    backgroundColor: '#1e1e1e',
    padding: 16,
    marginVertical: 8,
    borderRadius: 8,
  },
  stepHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  stepName: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  stateTag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    fontSize: 11,
    fontWeight: '600',
  },
  draftTag: { backgroundColor: '#FF9800', color: '#000' },
  activeTag: { backgroundColor: '#4CAF50', color: '#fff' },
  pausedTag: { backgroundColor: '#FF9800', color: '#fff' },
  completedTag: { backgroundColor: '#9C27B0', color: '#fff' },
  archivedTag: { backgroundColor: '#888', color: '#fff' },
  pendingTag: { backgroundColor: '#2196F3', color: '#fff' },
  inProgressTag: { backgroundColor: '#2196F3', color: '#fff' },
  skippedTag: { backgroundColor: '#9E9E9E', color: '#fff' },
  failedTag: { backgroundColor: '#F44336', color: '#fff' },
  stepMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  actionButtons: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 8,
  },
  deleteButton: { backgroundColor: '#E51332' },
  actionButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
});