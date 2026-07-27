/**
 * EmptyState — Screen displayed when no content is available.
 *
 * Props: title, description, actionLabel, onAction, icon
 * Traceability: EXPERIENCE.md §3.3 (empty states MUST show a CTA)
 *              ITS-V1 NB-TECH-008 (design-token colors)
 */

import React from 'react';
import { cn } from '@/utils';
import { Text, View } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface EmptyStateProps {
  /** Title shown prominently at the top of the empty state. */
  title: string;
  /** Description explaining why content is empty and what the user can do. */
  description?: string;
  /** Label for the primary call-to-action button. */
  actionLabel?: string;
  /** Handler invoked when the CTA is pressed. */
  onAction?: () => void;
  /** Icon name to display above the title (from lucide icon registry). */
  icon?: string;
  /** Icon size in dp. Default 48. */
  iconSize?: number;
  /** Additional className overrides for the root container. */
  className?: string;
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
  iconSize = 48,
  className,
}: EmptyStateProps) {
  return (
    <View
      className={cn('flex-1 items-center justify-center p-6 gap-4', className)}
      accessibilityRole="group"
      accessibilityLabel={`Empty state: ${title}`}
    >
      {icon && (
        <View style={{ width: iconSize, height: iconSize }} className="items-center justify-center rounded-full bg-lumina-surface">
          <Text className="text-lumina-text-muted text-xs">
            {'icon'}
          </Text>
        </View>
      )}
      <Text className="text-center text-lg font-semibold text-lumina-text">{title}</Text>
      {description && (
        <Text className="max-w-xs text-center text-sm leading-relaxed text-lumina-text-secondary">
          {description}
        </Text>
      )}
      {actionLabel && (
        <Pressable
          onPress={onAction}
          className="flex-row items-center justify-center rounded-lg bg-lumina-accent h-9 px-3"
          style={{ minHeight: 44 }}
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-sm font-semibold text-lumina-bg">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
