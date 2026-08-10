/**
 * Modal — Confirmation / dialog modal.
 *
 * Traceability: EXPERIENCE.md §3.5 (confirmation dialogs before destructive actions)
 *              ITS-V1 NB-TECH-008 (design-token colors)
 */

import React from 'react';
import { cn } from '@/utils';
import {
  Modal as RnModal,
  Pressable,
  Text,
  View,
  Dimensions,
} from 'react-native';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface ModalProps {
  /** Whether the modal is currently visible. */
  visible: boolean;
  /** Title displayed in the header. */
  title?: string;
  /** Message body rendered below the title. */
  message?: string;
  /** Label for the confirm/primary action button. */
  confirmText?: string;
  /** Label for the cancel/secondary action button. */
  cancelText?: string;
  /** Handler for the confirm button. */
  onConfirm?: () => void;
  /** Handler for the cancel button or overlay tap. */
  onCancel?: () => void;
  /** When true, hides the cancel button and onConfirm acts as dismiss. */
  destructive?: boolean;
  /** Additional className for overrides. */
  className?: string;
}

export function Modal({
  visible,
  title,
  message,
  confirmText = 'OK',
  cancelText = 'Annuler',
  onConfirm,
  onCancel,
  destructive = false,
  className,
}: ModalProps) {
  return (
    <RnModal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onCancel?.()}
    >
      <Pressable
        className="flex-1 items-center justify-center bg-black/60"
        onPress={onCancel}
      >
        <View
          className={cn(
            'w-[85%] max-w-sm overflow-hidden rounded-2xl bg-lumina-surface p-5 gap-4',
            className,
          )}
          style={{ minHeight: 180 }}
          accessibilityLabel={title}
        >
          {title && (
            <Text className="text-xl font-bold text-lumina-text">{title}</Text>
          )}
          {message && (
            <Text className="text-base leading-relaxed text-lumina-text-secondary">
              {message}
            </Text>
          )}

          <View className="flex-row justify-end gap-3 pt-2">
            {!destructive && cancelText && (
              <Pressable
                onPress={onCancel}
                className={cn(
                  'min-w-[44px] min-h-[44px] flex-1 items-center justify-center rounded-lg py-2.5',
                )}
                accessibilityRole="button"
                accessibilityLabel={cancelText}
              >
                <Text className="text-base font-medium text-lumina-text-secondary">
                  {cancelText}
                </Text>
              </Pressable>
            )}
            <Pressable
              onPress={onConfirm}
              className={cn(
                'min-w-[44px] min-h-[44px] flex-1 items-center justify-center rounded-lg py-2.5 px-4',
                destructive ? 'bg-lumina-error' : 'bg-lumina-accent',
              )}
              accessibilityRole="button"
              accessibilityLabel={confirmText}
            >
              <Text
                className={cn(
                  'text-base font-semibold text-lumina-bg',
                )}
              >
                {confirmText}
              </Text>
            </Pressable>
          </View>
        </View>
      </Pressable>
    </RnModal>
  );
}
