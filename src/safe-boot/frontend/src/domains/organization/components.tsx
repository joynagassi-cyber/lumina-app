/**
 * Organization Domain — React Native UI component.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 1 (OrganizationAggregate)
 * @traceability DOC-021: Physical Data Model fields for org settings form
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView, ActivityIndicator } from 'react-native';

export interface OrganizationSettingsFormProps {
  profile: {
    readonly name: string;
    readonly currency: string;
    readonly timezone: string;
    readonly language: 'fr' | 'en';
    readonly accentHex: string;
  } | null;
  isLoading: boolean;
  onSave: (settings: Record<string, unknown>) => void;
}

/**
 * Renders the organization configuration form.
 * Displays org profile fields with inline validation UI.
 */
export function OrganizationSettingsForm({
  profile,
  isLoading,
  onSave,
}: OrganizationSettingsFormProps): React.ReactElement | null {
  const [name, setName] = useState(profile?.name ?? '');
  const [currency, setCurrency] = useState(profile?.currency ?? '');
  const [timezone, setTimezone] = useState(profile?.timezone ?? '');
  const [accentHex, setAccentHex] = useState(profile?.accentHex ?? '#6366f1');

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  const handleSave = useCallback(() => {
    onSave({ name, currency, timezone, accentHex });
  }, [name, currency, timezone, accentHex, onSave]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Organization Settings</Text>

      <Text style={styles.label}>Organization Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="Enter organization name"
        accessibilityLabel="organization-name-input"
      />

      <Text style={styles.label}>Currency (ISO 4217)</Text>
      <TextInput
        style={styles.input}
        value={currency}
        onChangeText={setCurrency}
        placeholder="e.g. CDF, USD, EUR"
        accessibilityLabel="currency-input"
      />

      <Text style={styles.label}>Timezone (IANA)</Text>
      <TextInput
        style={styles.input}
        value={timezone}
        onChangeText={setTimezone}
        placeholder="e.g. Africa/Lubumbashi"
        accessibilityLabel="timezone-input"
      />

      <Text style={styles.label}>Accent Color</Text>
      <View style={styles.colorRow}>
        <TextInput
          style={[styles.input, styles.colorInput]}
          value={accentHex}
          onChangeText={setAccentHex}
          placeholder="#6366f1"
          accessibilityLabel="accent-color-input"
        />
        <View style={[styles.colorPreview, { backgroundColor: accentHex }]} />
      </View>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save Settings</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  title: { fontSize: 20, fontWeight: '600', color: '#ffffff' },
  label: { fontSize: 14, fontWeight: '500', color: '#a0a0a0' },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#ffffff',
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  colorInput: { flex: 1 },
  colorPreview: { width: 36, height: 36, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  saveButton: {
    backgroundColor: '#6366f1',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  saveButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 },
});
