/**
 * LanguageSwitcher — Toggle between fr/en languages.
 *
 * Updates i18next language setting at runtime.
 * Traceability: BR-CONFIG-002 (language setting persisted per org)
 *              ITS-V1 NB-TECH-008 (design-token colors)
 */

import React from 'react';
import { cn } from '@/utils';
import { Pressable, Text, View } from 'react-native';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

export interface LanguageSwitcherProps {
  /** Currently active language code ('fr' or 'en'). */
  currentLanguage: 'fr' | 'en';
  /** Invoked when user toggles the language. Caller should persist via Redux or config. */
  onLanguageChange: (lang: 'fr' | 'en') => void;
  /** Display mode: 'toggle' shows a simple button; 'dropdown' shows a selector. */
  mode?: 'toggle' | 'dropdown';
  /** When true, shows the language name in the current locale. */
  showLabel?: boolean;
  /** Additional className overrides. */
  className?: string;
}

const languages = [
  { code: 'fr', label: 'Francais' },
  { code: 'en', label: 'English' },
] as const;

export function LanguageSwitcher({
  currentLanguage,
  onLanguageChange,
  mode = 'toggle',
  showLabel = true,
  className,
}: LanguageSwitcherProps) {
  if (mode === 'dropdown') {
    return (
      <View className={cn('flex-row items-center gap-2 rounded-lg border border-lumina-border bg-lumina-surface px-3 py-2', className)}>
        {languages.map((lang) => (
          <Pressable
            key={lang.code}
            onPress={() => onLanguageChange(lang.code as 'fr' | 'en')}
            style={{ minHeight: 44 }}
            accessibilityRole="button"
            accessibilityLabel={`Set language to ${lang.label}`}
            className={cn(
              'px-3 py-1.5 rounded-md',
              currentLanguage === lang.code && 'bg-lumina-accent/20',
            )}
          >
            <Text
              className={cn(
                'text-sm font-medium',
                currentLanguage === lang.code ? 'text-lumina-text' : 'text-lumina-text-muted',
              )}
            >
              {showLabel ? lang.label : lang.code.toUpperCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  /** Toggle mode: switch to the other language. */
  const nextLang: 'fr' | 'en' = currentLanguage === 'fr' ? 'en' : 'fr';
  const nextLabel = languages.find((l) => l.code === nextLang)?.label ?? nextLang.toUpperCase();

  return (
    <Pressable
      onPress={() => onLanguageChange(nextLang)}
      className={cn(
        'flex-row items-center gap-2 rounded-lg bg-lumina-surface px-3 py-2',
        className,
      )}
      style={{ minHeight: 44 }}
      accessibilityRole="button"
      accessibilityLabel={`Current: ${currentLanguage}. Tap to switch to ${nextLang}.`}
    >
      <Text className="text-base text-lumina-text-secondary">
        {showLabel ? currentLanguage.toUpperCase() : null}
      </Text>
      <Text className="text-xs text-lumina-text-muted">{"⇄"}</Text>
      <Text className="text-sm font-medium text-lumina-text">{nextLabel}</Text>
    </Pressable>
  );
}
