/**
 * Forms Engine — React Native renderer. Declarative: a form is rendered purely
 * from its JSON definition (INV-009 — never hardcoded JSX per screen).
 *
 * Each field type maps to a component through the FIELD_COMPONENTS registry.
 * The registry is extensible: capabilities can register custom field
 * components without touching the engine (Capability model, ADR-001).
 */
import React from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import type { FormDefinitionRef, FormFieldDef } from '../../manifest/types';
import { FormModel } from '../forms-engine';
import type { VocabularyEngine } from '../../vocabulary/vocabulary-engine';

export interface FieldComponentProps {
  field: FormFieldDef;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string;
  options?: { key: string; label: string }[];
  editable?: boolean;
}

export interface FieldComponent {
  (props: FieldComponentProps): React.ReactElement;
}

const inputStyle = (error?: string) => ({
  borderWidth: 1,
  borderColor: error ? '#E51332' : '#333333',
  borderRadius: 8,
  paddingHorizontal: 12,
  paddingVertical: 10,
  color: '#FFFFFF',
  backgroundColor: '#181818',
  fontSize: 16,
});

function TextField({ field, value, onChange, error, editable }: FieldComponentProps) {
  return (
    <TextInput
      testID={`field-${field.key}`}
      value={String(value ?? '')}
      onChangeText={(t) => onChange(t)}
      editable={editable}
      maxLength={field.max}
      placeholderTextColor="#8A8A8A"
      style={inputStyle(error)}
      accessibilityLabel={field.key}
    />
  );
}

function NumberField({ field, value, onChange, error, editable }: FieldComponentProps) {
  return (
    <TextInput
      testID={`field-${field.key}`}
      value={value === undefined || value === null ? '' : String(value)}
      onChangeText={(t) => onChange(t)}
      editable={editable}
      keyboardType="decimal-pad"
      placeholderTextColor="#8A8A8A"
      style={inputStyle(error)}
      accessibilityLabel={field.key}
    />
  );
}

function DateField({ field, value, onChange, error, editable }: FieldComponentProps) {
  return (
    <TextInput
      testID={`field-${field.key}`}
      value={String(value ?? '')}
      onChangeText={(t) => onChange(t)}
      editable={editable}
      placeholder="AAAA-MM-JJ"
      placeholderTextColor="#8A8A8A"
      style={inputStyle(error)}
      accessibilityLabel={field.key}
    />
  );
}

function SelectField({ field, value, onChange, options, error, editable }: FieldComponentProps) {
  const selected = options?.find((o) => o.key === value);
  return (
    <View style={{ gap: 4 }}>
      <Pressable
        testID={`field-${field.key}`}
        onPress={() => undefined}
        disabled={editable === false}
        style={({ pressed }) => [
          inputStyle(error),
          { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
          pressed ? { opacity: 0.7 } : null,
        ]}
      >
        <Text style={{ color: selected ? '#FFFFFF' : '#8A8A8A', fontSize: 16 }}>
          {selected?.label ?? 'Sélectionner…'}
        </Text>
        <Text style={{ color: '#8A8A8A', fontSize: 16 }}>▾</Text>
      </Pressable>
      {options?.map((o) => (
        <Pressable
          key={o.key}
          testID={`option-${field.key}-${o.key}`}
          onPress={() => onChange(o.key)}
          disabled={editable === false}
        >
          <Text style={{ color: value === o.key ? '#FF6B00' : '#D0D0D0', paddingVertical: 6, fontSize: 15 }}>
            {o.label}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

function BooleanField({ field, value, onChange, editable }: FieldComponentProps) {
  return (
    <Switch
      testID={`field-${field.key}`}
      value={value === true}
      onValueChange={(v) => onChange(v)}
      disabled={editable === false}
      trackColor={{ false: '#333333', true: '#FF6B00' }}
      accessibilityLabel={field.key}
    />
  );
}

function MultiSelectField({ field, value, onChange, options, editable }: FieldComponentProps) {
  const current: string[] = Array.isArray(value) ? value : [];
  const toggle = (key: string) => {
    const next = current.includes(key) ? current.filter((k) => k !== key) : [...current, key];
    onChange(next);
  };
  return (
    <View style={{ gap: 4 }}>
      {options?.map((o) => {
        const active = current.includes(o.key);
        return (
          <Pressable
            key={o.key}
            testID={`option-${field.key}-${o.key}`}
            onPress={() => toggle(o.key)}
            disabled={editable === false}
          >
            <Text style={{ color: active ? '#FF6B00' : '#D0D0D0', paddingVertical: 6, fontSize: 15 }}>
              {active ? '☑ ' : '☐ '}
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Default field catalog — extendable by capabilities via registerFieldComponent. */
export const FIELD_COMPONENTS: Record<FormFieldDef['type'], FieldComponent> = {
  text: TextField,
  number: NumberField,
  currency: NumberField,
  date: DateField,
  select: SelectField,
  multiselect: MultiSelectField,
  boolean: BooleanField,
  richtext: TextField,
};

const fieldRegistry: Record<string, FieldComponent> = {};

/** Capabilities may register custom field components by field type. */
export function registerFieldComponent(type: string, component: FieldComponent): void {
  fieldRegistry[type] = component;
}

export interface FormRendererProps {
  form: FormDefinitionRef;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  errors?: Record<string, string>;
  vocabulary?: VocabularyEngine;
  locale?: string;
  editable?: boolean;
}

/**
 * Renders a whole form from its JSON definition. The model instance is created
 * once by the caller (useMemo) — see useFormModel hook below.
 */
export function FormRenderer({
  form,
  values,
  onChange,
  errors = {},
  vocabulary,
  locale,
  editable = true,
}: FormRendererProps) {
  const model = React.useMemo(() => new FormModel(form), [form]);
  return (
    <View style={{ gap: 14 }}>
      {form.fields.map((field) => {
        const Component = fieldRegistry[field.type] ?? FIELD_COMPONENTS[field.type];
        if (!Component) return null;
        const options = field.optionsVocab && vocabulary ? model.selectOptions(field, vocabulary, locale) : undefined;
        return (
          <View key={field.key} style={{ gap: 6 }}>
            <Text style={{ color: '#D0D0D0', fontSize: 14, fontWeight: '600' }}>
              {field.labelTerm && vocabulary ? vocabulary.lookupOrNull('form_labels', field.labelTerm, locale) ?? field.key : field.key}
              {field.required ? ' *' : ''}
            </Text>
            <Component
              field={field}
              value={values[field.key]}
              onChange={(v) => onChange(field.key, v)}
              error={errors[field.key]}
              options={options}
              editable={editable}
            />
            {errors[field.key] ? (
              <Text style={{ color: '#E51332', fontSize: 12 }}>{errors[field.key]}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Hook: memoized FormModel for validation/coercion outside the renderer. */
export function useFormModel(form: FormDefinitionRef): FormModel {
  return React.useMemo(() => new FormModel(form), [form]);
}
