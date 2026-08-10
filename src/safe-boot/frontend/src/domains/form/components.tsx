/**
 * Form Domain — React Native UI components.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 6 (FormAggregate)
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Pressable,
  FlatList,
  Modal,
  Alert,
} from 'react-native';
import { SelectField } from '@/components/ui';
import type {
  FormDefinition,
  FormField,
  FieldType,
  FormSubmission,
} from './types';

/* ------------------------------------------------------------------ */
/*  FormList                                                           */
/* ------------------------------------------------------------------ */

export interface FormListProps {
  forms: ReadonlyArray<FormDefinition>;
  isLoading?: boolean;
  error?: string;
  onSelect?: (form: FormDefinition) => void;
  onCreate?: () => void;
}

export function FormList({
  forms,
  isLoading = false,
  error,
  onSelect,
  onCreate,
}: FormListProps): React.ReactElement | null {
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

  if (forms.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No forms available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Pressable style={styles.addButton} onPress={onCreate}>
        <Text style={styles.addButtonText}>+</Text>
      </Pressable>

      <FlatList
        data={forms}
        keyExtractor={(f) => f.id}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.formItem}
            onPress={() => onSelect?.(item)}
          >
            <View style={styles.formInfo}>
              <Text style={styles.formItemTitle}>{item.title}</Text>
              <Text style={styles.formMeta}>
                Code: {item.code} • {item.fields.length} field(s)
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/*  FormRenderer                                                       */
/* ------------------------------------------------------------------ */

export interface FormRendererProps {
  form: FormDefinition | null;
  onSubmit?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
  initialData?: Record<string, unknown>;
}

export function FormRenderer({
  form,
  onSubmit,
  onCancel,
  isSubmitting = false,
  initialData = {},
}: FormRendererProps): React.ReactElement | null {
  if (!form) {
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>No form to display</Text>
      </View>
    );
  }

  const [values, setValues] = useState<Record<string, unknown>>({});

  useEffect(() => {
    if (initialData) {
      setValues((prev) => ({ ...prev, ...initialData }));
    } else {
      const initialValues: Record<string, unknown> = {};
      form.fields.forEach((field) => {
        if (field.defaultValue !== undefined) {
          initialValues[field.name] = field.defaultValue;
        } else {
          initialValues[field.name] = '';
        }
      });
      setValues(initialValues);
    }
  }, [form, initialData]);

  const handleChange = (name: string, value: unknown) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    if (onSubmit) {
      onSubmit(values);
    }
  };

  const renderField = (field: FormField) => {
    const value = values[field.name] ?? '';

    switch (field.type) {
      case 'text':
      case 'email':
      case 'tel':
        return (
          <TextInput
            key={field.name}
            style={styles.input}
            placeholder={field.placeholder || field.label}
            value={String(value)}
            onChangeText={(v) => handleChange(field.name, v)}
            keyboardType={field.type === 'email' ? 'email-address' : 'default'}
            secureTextEntry={false}
          />
        );

      case 'number':
        return (
          <TextInput
            key={field.name}
            style={styles.input}
            placeholder={field.placeholder || field.label}
            value={String(value)}
            onChangeText={(v) => handleChange(field.name, isNaN(Number(v)) ? '' : Number(v))}
            keyboardType='numeric'
          />
        );

      case 'date':
      case 'datetime':
        return (
          <TextInput
            key={field.name}
            style={styles.input}
            placeholder={field.placeholder || field.label}
            value={String(value)}
            onChangeText={(v) => handleChange(field.name, v)}
            keyboardType='default'
          />
        );

      case 'textarea':
        return (
          <TextInput
            key={field.name}
            style={[styles.input, styles.textarea]}
            placeholder={field.placeholder || field.label}
            value={String(value)}
            onChangeText={(v) => handleChange(field.name, v)}
            multiline
            numberOfLines={4}
          />
        );

      case 'select':
      case 'multiselect':
        if (!field.options) return null;
        return (
          <SelectField
            key={field.name}
            label={field.label}
            value={String(value)}
            options={field.options.map((opt) => ({ value: String(opt.value), label: opt.label }))}
            onChange={(v) => handleChange(field.name, v)}
          />
        );

      case 'checkbox':
        return (
          <TouchableOpacity
            key={field.name}
            style={styles.checkboxContainer}
            onPress={() => handleChange(field.name, !(value as boolean))}
          >
            <View style={[styles.checkbox, (value as boolean) && styles.checkboxChecked]} />
            <Text style={styles.checkboxLabel}>{field.label}</Text>
          </TouchableOpacity>
        );

      case 'radio':
        if (!field.options) return null;
        return (
          <View key={field.name} style={styles.radioGroup}>
            {field.options.map((opt) => (
              <TouchableOpacity
                key={String(opt.value)}
                style={styles.radioItem}
                onPress={() => handleChange(field.name, opt.value)}
              >
                <View
                  style={[
                    styles.radio,
                    (value === opt.value) && styles.radioChecked,
                  ]}
                />
                <Text style={styles.radioLabel}>{opt.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        );

      case 'file':
        return (
          <TouchableOpacity key={field.name} style={styles.fileButton}>
            <Text style={styles.fileButtonText}>Choose File</Text>
          </TouchableOpacity>
        );

      default:
        return (
          <TextInput
            key={field.name}
            style={styles.input}
            placeholder={field.placeholder || field.label}
            value={String(value)}
            onChangeText={(v) => handleChange(field.name, v)}
          />
        );
    }
  };

  return (
    <ScrollView style={styles.formContainer}>
      <Text style={styles.formTitle}>{form.title}</Text>

      <View style={styles.formFields}>
        {[...form.fields]
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .filter((f) => !f.hidden)
          .map((field) => (
            <View key={field.name} style={styles.formFieldGroup}>
              <Text style={styles.fieldLabel}>
                {field.label}{field.required ? '*' : ''}
              </Text>
              {renderField(field)}
              {Boolean(field.validation?.required) && !values[field.name] && (
                <Text style={styles.errorText}>This field is required</Text>
              )}
            </View>
          ))}
      </View>

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
          onPress={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <Text style={styles.submitButtonText}>Submit</Text>
          )}
        </Pressable>
      </View>
    </ScrollView>
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
  formItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#1e1e1e',
    marginVertical: 8,
    borderRadius: 8,
  },
  formInfo: { flex: 1 },
  formItemTitle: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  formMeta: { color: '#888', fontSize: 12, marginTop: 4 },
  formTitle: { color: '#ffffff', fontSize: 24, fontWeight: '700', marginBottom: 24 },
  formFields: { marginBottom: 24 },
  formFieldGroup: { marginBottom: 16 },
  fieldLabel: { color: '#888', fontSize: 12, marginBottom: 4 },
  input: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    borderColor: '#333',
    borderWidth: 1,
    color: '#ffffff',
  },
  textarea: { height: 100, textAlignVertical: 'top' },
  picker: {
    backgroundColor: '#1e1e1e',
    color: '#ffffff',
    height: 50,
    borderWidth: 1,
    borderColor: '#333',
    borderRadius: 8,
  },
  checkboxContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: { width: 20, height: 20, borderRadius: 4, borderColor: '#6366f1', borderWidth: 2 },
  checkboxChecked: { backgroundColor: '#6366f1' },
  checkboxLabel: { color: '#ffffff', fontSize: 16 },
  radioGroup: { gap: 8 },
  radioItem: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  radio: { width: 16, height: 16, borderRadius: 8, borderColor: '#6366f1', borderWidth: 2 },
  radioChecked: { backgroundColor: '#6366f1' },
  radioLabel: { color: '#ffffff', fontSize: 16 },
  fileButton: {
    backgroundColor: '#1e1e1e',
    padding: 12,
    borderRadius: 8,
    borderColor: '#333',
    borderWidth: 1,
    alignItems: 'center',
  },
  fileButtonText: { color: '#6366f1', fontSize: 16 },
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
});