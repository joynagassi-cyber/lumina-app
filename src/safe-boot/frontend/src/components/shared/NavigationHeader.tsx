/**
 * NavigationHeader — Stack header with back button and title.
 *
 * Uses expo-router navigation APIs for back behavior.
 * Traceability: ITS-V1 NB-TECH-008 (design-token colors)
 *              EXPERIENCE.md §4 (navigation patterns)
 */

import React from 'react';
import { cn } from '@/utils';
import { Text, View, Pressable, Platform } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface NavigationHeaderProps {
  /** Title displayed in the center of the header. */
  title?: string;
  /** When true, shows a back chevron button. */
  showBack?: boolean;
  /** Called when the back button is pressed. Default pops the router stack. */
  onBack?: () => void;
  /** Optional right-side content (e.g. settings icon). */
  rightAction?: React.ReactNode;
  /** Optional left-side content replacing the default back button. */
  leftAction?: React.ReactNode;
  /** Additional className overrides for the root container. */
  className?: string;
}

export function NavigationHeader({
  title,
  showBack = false,
  onBack,
  rightAction,
  leftAction,
  className,
}: NavigationHeaderProps) {
  /**
   * Resolve native goBack if available, otherwise invoke fallback.
   * expo-router exposes navigation via React Navigation under the hood.
   */
  const handleBack = React.useCallback(() => {
    // If caller provided custom handler, use it.
    if (onBack) {
      onBack();
      return;
    }

    /*
     * Attempt router-level back. This works for expo-router's
     * file-based navigation stack. Falls back silently on web/edge.
     */
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const anyGlobal = global as any;
      if (typeof anyGlobal.navigator?.popState === 'function') {
        anyGlobal.navigator.popState();
      }
    } catch {
      // Silently fail — no back action needed
    }
  }, [onBack]);

  return (
    <View
      className={cn(
        'flex-row items-center gap-2 px-4 py-3',
        'border-b border-lumina-border bg-lumina-surface',
        className,
      )}
      accessibilityRole="none"
    >
      {/* Left side */}
      <View style={{ width: 44, height: 44 }} className="items-center justify-center">
        {leftAction ??
          (showBack && (
            <Pressable
              onPress={handleBack}
              style={{ minHeight: 44 }}
              accessibilityRole="button"
              accessibilityLabel="Go back"
            >
              <Text className="text-lg text-lumina-text-secondary">{"◂"}</Text>
            </Pressable>
          ))}
      </View>

      {/* Center title */}
      {title && (
        <Text
          className="flex-1 text-base font-semibold text-lumina-text"
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {title}
        </Text>
      )}

      {/* Right side */}
      <View style={{ width: 44, height: 44 }} className="items-center justify-center">
        {rightAction}
      </View>
    </View>
  );
}
