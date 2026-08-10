/**
 * SelectField — Dropdown select referencing vocabulary terms.
 *
 * Traceability: BR-FRM-001 (select fields reference vocab_values, never hardcoded lists)
 *              ITS-V1 NB-TECH-009 (design-token colors)
 */

import React from 'react';
import { cn } from '@/utils';
import {
  Pressable,
  Text,
  View,
  Modal as RnModal,
  FlatList,
} from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

/**
 * A single option in the select dropdown.
 * Options should be populated from vocabulary values per BR-FRM-001.
 */
export interface SelectOption {
  /** Unique identifier for this option. */
  value: string;
  /** Human-readable label displayed to the user. */
  label: string;
}

export interface SelectFieldProps {
  /** Label displayed above the field. */
  label?: string;
  /** Current selected value. */
  value?: string;
  /** Placeholder shown when no value is selected. */
  placeholder?: string;
  /** List of available options from vocabulary_values. */
  options: SelectOption[];
  /** Invoked when the user picks a new value. */
  onChange: (value: string) => void;
  /** Validation error message. */
  error?: string;
  /** Disables selection. */
  disabled?: boolean;
  /** Accessible label for the field. */
  accessibilityLabel?: string;
  /** Additional className overrides. */
  className?: string;
}

export function SelectField({
  label,
  value,
  placeholder = 'Select...',
  options,
  onChange,
  error,
  disabled,
  accessibilityLabel,
  className,
}: SelectFieldProps) {
  const [modalVisible, setModalVisible] = React.useState(false);

  const selectedLabel =
    value && options.length > 0
      ? options.find((o) => o.value === value)?.label ?? placeholder
      : placeholder;

  return (
    <View className={cn('gap-1.5', className)}>
      {label && (
        <Text
          className={cn(
            'text-sm font-medium',
            error ? 'text-lumina-error' : 'text-lumina-text-secondary',
          )}
        >
          {label}
        </Text>
      )}
      <Pressable
        onPress={() => !disabled && setModalVisible(true)}
        disabled={disabled}
        className={cn(
          'flex-row items-center justify-between rounded-lg border border-lumina-border bg-lumina-surface px-3 py-3',
          disabled && 'bg-lumina-bg opacity-60',
          error && 'border-lumina-error',
        )}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? label ?? placeholder}
        accessibilityState={{ disabled: !!disabled }}
      >
        <Text
          className={cn(
            'text-base flex-1',
            value ? 'text-lumina-text' : 'text-lumina-text-muted',
          )}
          numberOfLines={1}
        >
          {selectedLabel}
        </Text>
        <Text className="text-lg text-lumina-text-muted">{"▾"}</Text>
      </Pressable>
      {error && (
        <Text className="text-xs text-lumina-error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <RnModal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <Pressable
          className="flex-1 items-end bg-black/50"
          onPress={() => setModalVisible(false)}
        >
          <View className="h-[70%] w-full min-w-[280px] max-w-md overflow-hidden rounded-t-2xl bg-lumina-elevated">
            <Text className="border-b border-lumina-border bg-lumina-surface p-4 text-lg font-semibold text-lumina-text">
              {label || placeholder}
            </Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              contentContainerStyle={{ padding: 8 }}
              ItemSeparatorComponent={() => <View className="h-px bg-lumina-border mx-4" />}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    onChange(item.value);
                    setModalVisible(false);
                  }}
                  className={cn(
                    'flex-row items-center rounded-lg px-4 py-3',
                    item.value === value && 'bg-lumina-accent/20',
                  )}
                  style={{ minHeight: 44 }}
                  accessibilityRole="menuitem"
                  accessibilityLabel={item.label}
                  accessibilityState={{ selected: item.value === value }}
                >
                  <Text
                    className={cn(
                      'flex-1 text-base',
                      item.value === value ? 'font-semibold text-lumina-text' : 'text-lumina-text-secondary',
                    )}
                  >
                    {item.label}
                  </Text>
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </RnModal>
    </View>
  );
}
