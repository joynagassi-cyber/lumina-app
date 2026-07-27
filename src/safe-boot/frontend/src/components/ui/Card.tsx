/**
 * Card — Lumina design system primitive.
 *
 * Variants: default, elevated
 * Traceability: ITS-V1 NB-TECH-008 (design-token driven)
 *              EXPERIENCE.md §3.2 (content density: 2–3 lines per row)
 */

import React from 'react';
import { cn } from '@/utils';
import { Pressable, Text, View, type ViewStyle } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface CardProps {
  /** Optional title displayed at the top. */
  title?: string;
  /** Subtitle rendered below the title in muted style. */
  subtitle?: string;
  /** Main content area children. */
  children?: React.ReactNode;
  /** Optional footer content below the body. */
  footer?: React.ReactNode;
  /** When present, makes the card pressable with subtle feedback. */
  onPress?: () => void;
  /** Visual variant controlling elevation/shadow. */
  variant?: 'default' | 'elevated';
  /** Accessible label for the card. */
  accessibilityLabel?: string;
  /** Additional NativeWind className overrides. */
  className?: string;
}

const variantStyles: Record<string, { bg: string; shadow: string }> = {
  default: {
    bg: 'bg-lumina-surface',
    shadow: '',
  },
  elevated: {
    bg: 'bg-lumina-elevated',
    shadow: 'shadow-lg',
  },
};

export function Card({
  title,
  subtitle,
  children,
  footer,
  onPress,
  variant = 'default',
  accessibilityLabel,
  className,
}: CardProps) {
  const styles = variantStyles[variant];

  const innerContent = (
    <View className={cn('gap-3 p-4', styles.bg)}>
      {(title || subtitle) && (
        <View>
          {title && (
            <Text className="text-base font-semibold text-lumina-text" numberOfLines={2}>
              {title}
            </Text>
          )}
          {subtitle && (
            <Text className="text-sm text-lumina-text-secondary" numberOfLines={2}>
              {subtitle}
            </Text>
          )}
        </View>
      )}
      {children}
      {footer && <View className="pt-1 border-t border-lumina-border">{footer}</View>}
    </View>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        className={cn('overflow-hidden rounded-xl', styles.shadow, className)}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        android_ripple={{ color: '#333333', foreground: true }}
      >
        {innerContent}
      </Pressable>
    );
  }

  return <View className={cn('overflow-hidden rounded-xl', styles.shadow, className)}>{innerContent}</View>;
}
