/**
 * OfflineBanner — Banner showing offline connectivity status.
 *
 * Connects to useSync hook to reflect isOnline state.
 * Traceability: BR-SYNC-007 (user operations don't depend on sync API call)
 *              EXPERIENCE.md §3.7 (offline feedback patterns)
 *              ITS-V1 NB-TECH-008 (design-token colors)
 */

import React from 'react';
import { cn } from '@/utils';
import { Text, View, Pressable } from 'react-native';
import { useSync } from '@/hooks/useSync';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface OfflineBannerProps {
  /** When true, always show the banner regardless of sync state. */
  forceVisible?: boolean;
  /** Custom message override. Default uses i18n keys. */
  message?: string;
  /** Optional action when user taps the banner. */
  onAction?: () => void;
  /** Label for the action button. */
  actionLabel?: string;
  /** Additional className overrides. */
  className?: string;
}

const defaultMessages = {
  fr: {
    title: 'Hors ligne',
    body: 'Vos modifications seront synchronisées automatiquement.',
    retry: 'Réessayer',
  },
  en: {
    title: 'Offline',
    body: 'Your changes will sync automatically when reconnected.',
    retry: 'Retry',
  },
};

export function OfflineBanner({
  forceVisible = false,
  message,
  onAction,
  actionLabel = 'Retry',
  className,
}: OfflineBannerProps) {
  const { isOnline } = useSync();
  const [lang] = React.useState<'fr' | 'en'>('fr');

  const t = defaultMessages[lang];
  const visible = !isOnline || forceVisible;

  if (!visible) return null;

  return (
    <View
      className={cn(
        'flex-row items-center gap-3 px-4 py-2',
        'bg-lumina-warning/90 border-b border-lumina-border',
        className,
      )}
      accessibilityRole="alert"
      accessibilityLabel={t.title}
      accessibilityLiveRegion="polite"
    >
      <Text className="text-sm font-semibold text-white flex-1">
        {message ?? t.title}
      </Text>
      {onAction && (
        <Pressable
          onPress={onAction}
          style={{ minHeight: 44 }}
          className="shrink-0 items-center justify-center rounded-md bg-white/20 px-3"
          accessibilityRole="button"
          accessibilityLabel={actionLabel}
        >
          <Text className="text-xs font-semibold text-white">{actionLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}
