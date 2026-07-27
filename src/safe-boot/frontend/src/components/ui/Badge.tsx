/**
 * Badge — Status indicator chip.
 *
 * Variants: success, warning, error, info
 * Traceability: ITS-V1 NB-TECH-008 (design-token colors)
 *              API-CONTRACT-006 (visual status indicators)
 */

import React from 'react';
import { cn } from '@/utils';
import { Text, View } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface BadgeProps {
  /** Visual variant controlling color semantics. */
  variant?: 'success' | 'warning' | 'error' | 'info';
  /** Label text displayed inside the badge. */
  label: string;
  /** When true, renders a dot before the label. */
  withDot?: boolean;
  /** Additional className for overrides. */
  className?: string;
}

const variantStyles: Record<string, { bg: string; text: string }> = {
  success: {
    bg: 'bg-lumina-success/20',
    text: 'text-lumina-success',
  },
  warning: {
    bg: 'bg-lumina-warning/20',
    text: 'text-lumina-warning',
  },
  error: {
    bg: 'bg-lumina-error/20',
    text: 'text-lumina-error',
  },
  info: {
    bg: 'bg-lumina-accent/20',
    text: 'text-lumina-accent',
  },
};

export function Badge({
  variant = 'info',
  label,
  withDot = false,
  className,
}: BadgeProps) {
  const styles = variantStyles[variant];

  return (
    <View
      className={cn(
        'flex-row items-center gap-1 rounded-full px-2.5 py-1',
        styles.bg,
        className,
      )}
      accessibilityRole="status"
      accessibilityLabel={label}
      accessible
    >
      {withDot && <View className="h-2 w-2 rounded-full bg-current" />}
      <Text className={cn('text-xs font-semibold', styles.text)} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}
