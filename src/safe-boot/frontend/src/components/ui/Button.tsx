/**
 * Button — Lumina design system primitive.
 *
 * Variants: primary, secondary, destructive, ghost, link
 * Sizes: sm, md, lg, icon
 * Traceability: ITS-V1 NB-TECH-008 (design-token driven)
 *              EXPERIENCE.md (touch target min 44x44pt iOS guideline)
 *              API-CONTRACT-006 (feedback for user actions)
 */

import React from 'react';
import {
  Pressable,
  Text,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { cn } from '@/utils';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ButtonProps {
  /** Visual variant controlling color/style mapping. */
  variant?: 'primary' | 'secondary' | 'destructive' | 'ghost' | 'link';
  /** Size preset. 'icon' enforces a square touch target. */
  size?: 'sm' | 'md' | 'lg' | 'icon';
  /** Whether to show a loading spinner instead of children. */
  isLoading?: boolean;
  /** Disables interaction and applies muted styles. */
  disabled?: boolean;
  /** Press handler invoked on touch-down (debounced while loading). */
  onPress?: () => void;
  /** Accessible label for screen readers. */
  accessibilityLabel?: string;
  /** Children (label text or custom content). */
  children: React.ReactNode;
  /** Optional Lucide icon rendered before the label. */
  iconLeft?: React.FC<{ size?: number; color?: string }>;
  /** Optional Lucide icon rendered after the label. */
  iconRight?: React.FC<{ size?: number; color?: string }>;
  /** Additional style classes appended to the root container. */
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const variantStyles: Record<string, { bg: string; text: string; border: string }> = {
  primary: {
    bg: 'bg-lumina-accent',
    text: 'text-lumina-bg',
    border: '',
  },
  secondary: {
    bg: 'bg-lumina-elevated',
    text: 'text-lumina-text',
    border: 'border border-lumina-border',
  },
  destructive: {
    bg: 'bg-lumina-error',
    text: 'text-lumina-bg',
    border: '',
  },
  ghost: {
    bg: 'bg-transparent',
    text: 'text-lumina-text',
    border: '',
  },
  link: {
    bg: 'bg-transparent',
    text: 'text-lumina-accent underline',
    border: '',
  },
};

const sizeStyles: Record<string, { h: string; px: string; text: string; iconSize: string }> = {
  sm: { h: 'h-9', px: 'px-3', text: 'text-sm', iconSize: 'size-4' },
  md: { h: 'h-11', px: 'px-4', text: 'text-base', iconSize: 'size-5' },
  lg: { h: 'h-14', px: 'px-6', text: 'text-lg', iconSize: 'size-6' },
  icon: { h: 'h-11 w-11', px: '', text: '', iconSize: 'size-5' },
};

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  onPress,
  accessibilityLabel,
  children,
  iconLeft: IconLeft,
  iconRight: IconRight,
  className,
}: ButtonProps) {
  const colors = variantStyles[variant];
  const dimensions = sizeStyles[size];
  const interactive = !disabled && !isLoading;

  /** Haptic feedback via React Native on Android. */
  const triggerFeedback = React.useCallback(() => {
    if (Platform.OS === 'android') {
      // Haptic feedback would come from expo-haptics when available.
      // For now, this placeholder documents intent per ITS-V1 NB-TECH-008.
    }
  }, []);

  const handlePress = React.useCallback(() => {
    if (!interactive) return;
    triggerFeedback();
    onPress?.();
  }, [interactive, onPress, triggerFeedback]);

  /** Ensure minimum 44x44pt touch target (iOS / WCAG). */
  const baseStyle: ViewStyle = { minHeight: 44, minWidth: 44 };

  const leftIcon = IconLeft && !isLoading ? <IconLeft size={20} color="" /> : null;
  const rightIcon = IconRight && !isLoading ? <IconRight size={20} color="" /> : null;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!interactive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? String(children)}
      accessibilityState={{ disabled: !interactive }}
      className={cn(
        'flex-row items-center justify-center rounded-lg',
        colors.bg,
        colors.border,
        dimensions.h,
        size !== 'icon' ? dimensions.px : '',
        className,
      )}
      style={[baseStyle]}
    >
      {isLoading ? (
        <ActivityIndicator
          color={variant === 'primary' || variant === 'destructive' ? 'white' : undefined}
          size="small"
        />
      ) : (
        <>
          {leftIcon}
          <Text
            className={cn('font-medium', colors.text, dimensions.text)}
            numberOfLines={1}
          >
            {children}
          </Text>
          {rightIcon}
        </>
      )}
    </Pressable>
  );
}
