/**
 * Toast — Notification overlay (success / error / warning / info).
 *
 * Traceability: API-CONTRACT-006 (notification delivery)
 *              EXPERIENCE.md §3.6 (brief non-blocking feedback)
 *              ITS-V1 NB-TECH-008 (design-token colors)
 */

import React from 'react';
import { cn } from '@/utils';
import { Pressable, Text, View, Animated } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ToastProps {
  /** Visual variant controlling icon and color semantics. */
  variant?: 'success' | 'error' | 'warning' | 'info';
  /** Main message text displayed in the toast. */
  message: string;
  /** Optional secondary description line. */
  description?: string;
  /** Duration in ms before auto-dismiss. Default 3500. */
  duration?: number;
  /** Callback invoked when the toast is dismissed (manual or auto). */
  onDismiss?: () => void;
  /** Whether the toast is currently visible. */
  visible: boolean;
  /** Additional className overrides. */
  className?: string;
}

const variantStyles: Record<string, { bg: string; iconBg: string }> = {
  success: {
    bg: 'bg-lumina-success',
    iconBg: 'bg-white/20',
  },
  error: {
    bg: 'bg-lumina-error',
    iconBg: 'bg-white/20',
  },
  warning: {
    bg: 'bg-lumina-warning',
    iconBg: 'bg-black/20',
  },
  info: {
    bg: 'bg-lumina-accent',
    iconBg: 'bg-white/20',
  },
};

export function Toast({
  variant = 'info',
  message,
  description,
  duration = 3500,
  onDismiss,
  visible,
  className,
}: ToastProps) {
  const slideAnim = React.useRef(new Animated.Value(0)).current;
  const styles = variantStyles[variant];

  React.useEffect(() => {
    if (!visible) return;

    slideAnim.setValue(-80);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(slideAnim, {
        toValue: -80,
        duration: 300,
        useNativeDriver: true,
      }).start(() => onDismiss?.());
    }, duration);

    return () => clearTimeout(timer);
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={{
        transform: [{ translateY: slideAnim }],
      }}
      className={cn(
        'mx-4 mt-2 overflow-hidden rounded-xl px-4 py-3 shadow-lg',
        styles.bg,
        className,
      )}
      accessibilityRole="alert"
      accessibilityLabel={message}
    >
      <View className="flex-row items-start gap-3">
        <View className={cn('mt-0.5 h-2 w-2 shrink-0 rounded-full', styles.iconBg)} />
        <View className="flex-1">
          <Text className="text-sm font-semibold text-white">{message}</Text>
          {description && (
            <Text className="mt-0.5 text-xs text-white/80">{description}</Text>
          )}
        </View>
        <Pressable
          onPress={() => {
            slideAnim.setValue(-80);
            onDismiss?.();
          }}
          className="ml-2 min-h-[44px] min-w-[44px] items-center justify-center"
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
        >
          <Text className="text-sm font-bold text-white/80">{"×"}</Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}
