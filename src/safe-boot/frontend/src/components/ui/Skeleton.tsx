/**
 * Skeleton — Loading placeholder (skeleton screens).
 *
 * Traceability: EXPERIENCE.md §3.1 (loading states per loading-patterns)
 *              ITS-V1 NB-TECH-008 (colors from design tokens)
 */

import React from 'react';
import { cn } from '@/utils';
import { View, type ViewStyle } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface SkeletonProps {
  /** Width of the skeleton bar. Default 'full'. */
  width?: string | number;
  /** Height of the skeleton bar. Default 16dp. */
  height?: number;
  /** Border radius preset or custom px value. Default 'rounded'. */
  radius?: 'none' | 'sm' | 'md' | 'lg' | 'rounded' | number;
  /** Optional className for additional styling. */
  className?: string;
}

const radiusMap: Record<string, string | ViewStyle> = {
  none: '',
  sm: 'rounded-sm',
  md: 'rounded',
  lg: 'rounded-lg',
  rounded: 'rounded-full',
};

export function Skeleton({
  width = 'w-full',
  height = 16,
  radius = 'rounded',
  className,
}: SkeletonProps) {
  const radiusClass = typeof radius === 'number' ? '' : radiusMap[radius] ?? '';
  const radiusStyle: ViewStyle | undefined = typeof radius === 'number' ? { borderRadius: radius } : undefined;

  return (
    <View
      className={cn('animate-pulse bg-lumina-elevated', width, radiusClass, className)}
      style={[{ height }, radiusStyle]}
      accessibilityHidden
    />
  );
}
