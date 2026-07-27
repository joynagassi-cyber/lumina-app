/**
 * Input — Lumina design system primitive.
 *
 * States: default, active, error, disabled
 * Traceability: ITS-V1 NB-TECH-009 (tokens only)
 *              EXPERIENCE.md §3.4 (field-level validation feedback)
 */

import React from 'react';
import { cn } from '@/utils';
import {
  TextInput,
  TextInputProps as RNTextInputProps,
  Text,
  View,
} from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface InputProps extends Omit<RNTextInputProps, 'style' | 'placeholderTextColor'> {
  /** Optional label displayed above the input. */
  label?: string;
  /** Placeholder text when value is empty. */
  placeholder?: string;
  /** Validation error message shown below the input. */
  error?: string;
  /** Icon rendered on the right side of the input. */
  rightIcon?: React.FC<{ size?: number; color?: string }>;
  /** Icon rendered on the left side of the input. */
  leftIcon?: React.FC<{ size?: number; color?: string }>;
  /** Whether to mask the input (password fields). */
  secureTextEntry?: boolean;
  /** Keyboard type selector. */
  keyboardType?: RNTextInputProps['keyboardType'];
  /** Optional className for additional NativeWind overrides. */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const stateStyles = {
  default: {
    border: 'border-lumina-border',
    bg: 'bg-lumina-surface',
    text: 'text-lumina-text',
  },
  active: {
    border: 'border-lumina-accent',
    bg: 'bg-lumina-surface',
    text: 'text-lumina-text',
  },
  error: {
    border: 'border-lumina-error',
    bg: 'bg-lumina-surface',
    text: 'text-lumina-text',
  },
  disabled: {
    border: 'border-lumina-border',
    bg: 'bg-lumina-bg',
    text: 'text-lumina-text-muted',
  },
};

export function Input({
  label,
  placeholder,
  error,
  rightIcon: RightIcon,
  leftIcon: LeftIcon,
  secureTextEntry = false,
  keyboardType,
  className,
  disabled,
  ...rest
}: InputProps) {
  const [focused, setFocused] = React.useState(false);

  const state = error
    ? 'error'
    : disabled
      ? 'disabled'
      : focused
        ? 'active'
        : 'default';

  const styles = stateStyles[state];

  return (
    <View className={cn('w-full gap-1.5', className)}>
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
      <View className="flex-row items-center rounded-lg border">
        {LeftIcon && (
          <View className="pl-3">
            <LeftIcon size={20} color="" />
          </View>
        )}
        <TextInput
          placeholder={placeholder}
          placeholderTextColor="#727272"
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          editable={!disabled}
          className={cn(
            'flex-1 rounded-lg py-3 px-3 text-base',
            styles.bg,
            styles.text,
          )}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityRole="textinput"
          accessibilityErrorMessage={error}
          {...rest}
        />
        {RightIcon && (
          <View className="pr-3">
            <RightIcon size={20} color="" />
          </View>
        )}
      </View>
      {error && (
        <Text className="text-xs text-lumina-error" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}
    </View>
  );
}
