/**
 * Configuration Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Switch,
  Pressable,
} from 'react-native';
import { SelectField } from '@/components/ui';
import type { OrganizationSettings, SettingEntry, SettingType, SettingValue } from './types';

/* ------------------------------------------------------------------ */
/*  SettingsForm                                                       */
/* ------------------------------------------------------------------ */

export interface SettingsFormProps {
  settings: OrganizationSettings | null;
  isLoading?: boolean;
  error?: string;
  onSave?: (settings: Partial<OrganizationSettings>) => void;
  onCancel?: () => void;
}

export function SettingsForm({
  settings,
  isLoading = false,
  error,
  onSave,
  onCancel,
}: SettingsFormProps): React.ReactElement | null {
  const [formData, setFormData] = useState<Partial<OrganizationSettings>>({});

  if (!settings) {
    if (isLoading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      );
    }
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>Settings not found</Text>
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

  // Initialize form with current settings values
  const initializedFormData = useMemo(() => ({
    name: settings.name,
    currency: settings.currency,
    timezone: settings.timezone,
    language: settings.language,
    accent: settings.accent,
    custom: settings.custom || {},
  }), [settings]);

  const [formValues, setFormValues] = useState(initializedFormData);

  const handleSave = () => {
    if (onSave) {
      onSave({
        name: formValues.name,
        currency: formValues.currency,
        timezone: formValues.timezone,
        language: formValues.language,
        accent: formValues.accent,
        custom: formValues.custom,
      });
    }
  };

  return (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>Organization Settings</Text>

      <View style={styles.formSection}>
        <Text style={styles.sectionLabel}>Basic Configuration</Text>

        <TextInput
          style={styles.input}
          placeholder="Organization Name"
          value={formValues.name || ''}
          onChangeText={(v) => setFormValues({...formValues, name: v})}
        />

        <TextInput
          style={styles.input}
          placeholder="Currency (e.g., CDF, USD)"
          value={formValues.currency || ''}
          onChangeText={(v) => setFormValues({...formValues, currency: v})}
        />

        <TextInput
          style={styles.input}
          placeholder="Timezone (e.g., Africa/Lubumbashi)"
          value={formValues.timezone || ''}
          onChangeText={(v) => setFormValues({...formValues, timezone: v})}
        />

        <SelectField
          label="Language"
          value={formValues.language || 'fr'}
          options={[
            { value: 'fr', label: 'French (FR)' },
            { value: 'en', label: 'English (EN)' },
          ]}
          onChange={(v) => setFormValues({...formValues, language: v as 'fr' | 'en'})}
        />

        <View style={styles.colorRow}>
          <TextInput
            style={[styles.input, styles.colorInput]}
            placeholder="Accent Color (#hex)"
            value={formValues.accent || '#6366f1'}
            onChangeText={(v) => setFormValues({...formValues, accent: v})}
          />
          <View style={[styles.colorPreview, { backgroundColor: formValues.accent || '#6366f1' }]} />
        </View>
      </View>

      {settings.custom && Object.keys(settings.custom).length > 0 && (
        <View style={styles.formSection}>
          <Text style={styles.sectionLabel}>Custom Settings</Text>
          <TextInput
            style={styles.textarea}
            placeholder="Add custom settings in JSON format"
            value={JSON.stringify(formValues.custom, null, 2)}
            onChangeText={(v) => {
              try {
                setFormValues({...formValues, custom: JSON.parse(v)});
              } catch (e) {
                // Ignore parse errors during typing
              }
            }}
            numberOfLines={6}
          />
        </View>
      )}

      <View style={styles.formActions}>
        {onCancel && (
          <Pressable
            style={styles.cancelButton}
            onPress={onCancel}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </Pressable>
        )}
        <Pressable
          style={styles.submitButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Save Settings</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/*  SettingEditor                                                      */
/* ------------------------------------------------------------------ */

export interface SettingEditorProps {
  setting: SettingEntry | null;
  onSave?: (setting: Partial<SettingEntry>) => void;
  isLoading?: boolean;
  error?: string;
}

export function SettingEditor({
  setting,
  onSave,
  isLoading = false,
  error,
}: SettingEditorProps): React.ReactElement | null {
  if (!setting) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No setting selected</Text>
      </View>
    );
  }

  const [value, setValue] = useState(setting.value !== undefined ? setting.value : '');

  const handleChange = (newValue: SettingValue) => {
    setValue(newValue);
  };

  const handleSave = () => {
    if (onSave && typeof setting.type === 'string') {
      // Parse value based on type
      let parsedValue: SettingValue = value as string;
      if (setting.type === 'number') {
        parsedValue = Number(value) || 0;
      } else if (setting.type === 'boolean') {
        parsedValue = value === 'true';
      } else if (setting.type === 'json') {
        try {
          parsedValue = JSON.parse(String(value));
        } catch {
          parsedValue = value;
        }
      }
      onSave({ ...setting, value: parsedValue });
    }
  };

  return (
    <View style={styles.editorContainer}>
      <Text style={styles.editorTitle}>Edit Setting</Text>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Key:</Text>
        <Text style={styles.infoValue}>{setting.key}</Text>
      </View>

      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>Type:</Text>
        <Text style={styles.infoValue}>{setting.type}</Text>
      </View>

      <View style={styles.inputGroup}>
        <Text style={styles.titleLabel}>Value</Text>
        {setting.type === 'boolean' ? (
          <Switch
            value={!!(setting.value && String(setting.value).toLowerCase() === 'true')}
            onValueChange={handleChange}
          />
        ) : setting.type === 'select' ? (
          <SelectField
            value={String(value)}
            options={[
              { value: 'option1', label: 'Option 1' },
              { value: 'option2', label: 'Option 2' },
              { value: 'option3', label: 'Option 3' },
            ]}
            onChange={(v) => setValue(v)}
          />
        ) : (
          <TextInput
            style={styles.input}
            value={String(value)}
            onChangeText={setValue}
            placeholder={`Enter ${setting.type}`}
          />
        )}
      </View>

      <View style={styles.editorActions}>
        <Pressable
          style={styles.cancelButton}
          onPress={() => setValue(setting.value !== undefined ? setting.value : '')}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </Pressable>
        <Pressable
          style={styles.submitButton}
          onPress={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="#ffffff" size="small" />
          ) : (
            <Text style={styles.submitButtonText}>Save</Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#121212' },
  formContainer: { flex: 1, padding: 16, backgroundColor: '#121212' },
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
  formTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  sectionLabel: { color: '#6366f1', fontSize: 16, fontWeight: '600', marginBottom: 12 },
  formSection: { marginBottom: 24 },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    borderColor: '#333',
    borderWidth: 1,
    color: '#ffffff',
    marginBottom: 12,
  },
  textarea: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    borderColor: '#333',
    borderWidth: 1,
    color: '#ffffff',
    marginBottom: 12,
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: { marginBottom: 12 },
  picker: {
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    height: 50,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
  },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  colorInput: { flex: 1 },
  colorPreview: { width: 40, height: 40, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#333',
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#ffffff', fontSize: 16 },
  submitButton: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: '#6366f1',
    borderRadius: 8,
    alignItems: 'center',
  },
  submitButtonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  editorContainer: { padding: 16, backgroundColor: '#121212' },
  editorTitle: { color: '#ffffff', fontSize: 20, fontWeight: '600', marginBottom: 16 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, padding: 12, backgroundColor: '#1e1e1e', borderRadius: 8 },
  infoLabel: { color: '#888', fontSize: 14 },
  infoValue: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  inputGroup: { marginBottom: 16 },
  titleLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  editorActions: { flexDirection: 'row', gap: 12, marginTop: 24 },
});