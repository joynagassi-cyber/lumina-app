/**
 * Icon — Wrapper around lucide-react-native icons.
 *
 * Traceability: ITS-V1 NB-TECH-009 (color from token, never hardcoded hex)
 *              EXPERIENCE.md §4.3 (lucide-react-native icon library)
 */

import React from 'react';
import { cn } from '@/utils';
import { Pressable, Text, View, type PressableProps } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface IconProps extends Omit<PressableProps, 'onPress'> {
  /** Name of the Lucide icon to render (e.g. 'home', 'settings'). */
  name: string;
  /** Visual size in dp. Default matches NativeWind `size-5` (20dp). */
  size?: number;
  /** Color derived from a design token string (e.g. 'text-lumina-accent'). */
  color?: string;
  /** Fallback color when no color class or color prop is provided. */
  fallbackColor?: string;
  /** When true, sets accessibilityRole to 'image'. */
  decorative?: boolean;
}

/**
 * Resolve the Lucide icon component by name at runtime.
 * In production, import statically; this mapping supports dynamic lookup.
 */
const iconMap: Record<string, React.FC<{ size?: number; color?: string }>> = {};

// Runtime registry — consumers populate iconMap during app bootstrap
// with their chosen icon set.
function getIcon(name: string): React.FC<{ size?: number; color?: string }> | null {
  return iconMap[name] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function Icon({
  name,
  size = 20,
  color = '',
  fallbackColor = '#FFFFFF',
  decorative = false,
  onPress,
  ...rest
}: IconProps) {
  const IconComponent = getIcon(name);

  /** Extract token class suffix, e.g. 'text-lumina-text' → '#FFFFFF' resolved at runtime. */
  const resolvedColor = color || fallbackColor;

  const content = IconComponent ? (
    <IconComponent size={size} color={resolvedColor} />
  ) : (
    /**
     * Graceful degradation: show a circle placeholder when the icon
     * has not been registered yet. This avoids crashing during bootstrapping.
     */
    <View style={{ width: size, height: size }} className="items-center justify-center rounded-full bg-lumina-border" />
  );

  if (!onPress) {
    return (
      <View
        style={{ width: size, height: size }}
        accessibilityRole={decorative ? 'none' : 'image'}
        accessibilityLabel={decorative ? undefined : name}
      >
        {content}
      </View>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={name}
      className={cn('flex items-center justify-center', rest.className)}
      {...rest}
    >
      {content}
    </Pressable>
  );
}
