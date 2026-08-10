/**
 * Vocabulary Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 7 (VocabularyAggregate)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Pressable,
  type ViewStyle,
} from 'react-native';
import type {
  VocabularyNamespace,
  VocabularyTerm,
  VocabValue,
  TermWithValues,
  NamespaceWithTerms,
} from './types';

/* ------------------------------------------------------------------ */
/*  TermSelector                                                       */
/* ------------------------------------------------------------------ */

export interface TermSelectorProps {
  selectedTerm?: VocabularyTerm | null;
  onSelect?: (term: VocabularyTerm) => void;
  namespaces?: ReadonlyArray<VocabularyNamespace>;
  terms?: ReadonlyArray<TermWithValues>;
  isLoading?: boolean;
  error?: string;
  placeholder?: 'Select a term' | null;
  style?: ViewStyle;
}

export function TermSelector({
  selectedTerm,
  onSelect,
  namespaces = [],
  terms = [],
  isLoading = false,
  error,
  placeholder = 'Select a term',
  style,
}: TermSelectorProps): React.ReactElement | null {
  const [modalVisible, setModalVisible] = useState(false);

  const selectedLabel = selectedTerm ? selectedTerm.label : placeholder;

  const handleSelect = (term: VocabularyTerm) => {
    onSelect?.(term);
    setModalVisible(false);
  };

  if (isLoading) {
    return (
      <View style={[styles.container, style]}>
        <ActivityIndicator size="small" color="#6366f1" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.errorContainer, style]}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (terms.length === 0 && namespaces.length === 0) {
    return (
      <View style={[styles.emptyContainer, style]}>
        <Text style={styles.emptyText}>No terms available</Text>
      </View>
    );
  }

  return (
    <Pressable
      style={[styles.selectorContainer, style]}
      onPress={() => setModalVisible(true)}
    >
      <View style={styles.selectorInput}>
        <Text style={[styles.selectorLabel, !selectedLabel && styles.selectorPlaceholder]}>
          {selectedLabel ?? ''}
        </Text>
      </View>
      <Text style={styles.selectorArrow}>▼</Text>

      <Modal
        visible={modalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Term</Text>

            {terms.length > 0 && (
              <FlatList
                data={terms}
                keyExtractor={(t) => t.term.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.modalItem}
                    onPress={() => handleSelect(item.term)}
                  >
                    <Text style={styles.modalItemLabel}>{item.term.label}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

            <Pressable
              style={styles.modalCloseButton}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.modalCloseButtonText}>Close</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ */
/*  ValuePicker                                                        */
/* ------------------------------------------------------------------ */

export interface ValuePickerProps {
  selectedValue?: VocabValue | null;
  onSelect?: (value: VocabValue) => void;
  term?: TermWithValues;
  language?: string;
  isLoading?: boolean;
  error?: string;
  placeholder?: 'Select a value' | null;
}

export function ValuePicker({
  selectedValue,
  onSelect,
  term,
  language = 'en',
  isLoading = false,
  error,
  placeholder = 'Select a value',
}: ValuePickerProps): React.ReactElement | null {
  const values = term ? (term.values[language] || []) : [];
  const selectedLabel = selectedValue ? selectedValue.label : placeholder;

  if (isLoading) {
    return (
      <View style={styles.valuePickerContainer}>
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

  if (values.length === 0) {
    return (
      <View style={styles.valuePickerContainer}>
        <Text style={styles.valuePickerText}>{selectedLabel ?? ''}</Text>
      </View>
    );
  }

  return (
    <View style={styles.valuePickerContainer}>
      <Text style={styles.valuePickerText}>{selectedLabel ?? ''}</Text>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  selectorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#333',
    flex: 1,
  },
  selectorInput: { flex: 1 },
  selectorLabel: { color: '#ffffff', fontSize: 16 },
  selectorPlaceholder: { color: '#888' },
  selectorArrow: { color: '#888', marginLeft: 8 },
  valuePickerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  valuePickerText: { color: '#ffffff', fontSize: 16 },
  errorContainer: {
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
  },
  errorText: { color: '#ff6b6b', fontSize: 14 },
  emptyContainer: {
    padding: 16,
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
  },
  emptyText: { color: '#888', fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1e1e1e',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 16,
    maxHeight: '70%',
  },
  modalTitle: { color: '#ffffff', fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalItemLabel: { color: '#ffffff', fontSize: 16 },
  modalCloseButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  modalCloseButtonText: { color: '#6366f1', fontSize: 16, fontWeight: '600' },
});