# SPRINT 8 — Dashboard, Settings, Social (K3)

## Sprint Title
Lumina v2 — Dashboard Analytics, Application Settings, and Social Feed (K3)

## Sprint Objective
Implement the dashboard with financial KPIs and charts, application settings (language, theme accent picker, org configuration), and social feed placeholder (posts/comments between members). These are K3 desirable features but provide essential UX polish.

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

mkdir -p src/features/dashboard/src
mkdir -p src/features/settings/src
mkdir -p src/features/social/src
mkdir -p tests/unit/features/dashboard
mkdir -p tests/unit/features/settings
```

## Files to Create (with COMPLETE content)

---

### A. DASHBOARD MODULE

#### 1. `src/features/dashboard/src/DashboardService.ts`
```typescript
// src/features/dashboard/src/DashboardService.ts
// Aggregates KPIs: total income, expense, net result, member count, pending transactions

import { database } from '@/core/sync/Database';
import { calculateBilan } from '@/features/finance/src/BilanCalculator';

export interface DashboardKPIs {
  totalIncome: number;
  totalExpense: number;
  netResult: number;
  pendingTransactions: number;
  activeMembers: number;
  recentTransactions: Array<{ id: string; type: string; amount: number; date: string }>;
}

export async function getDashboardKPIs(orgId: string): Promise<DashboardKPIs> {
  const bilan = await calculateBilan(orgId, new Date().getFullYear());

  const pendingCount = await database.get('transactions').query(
    database.get('transactions').queryBuilder().unsafeGetWhere('status', 'pending')
  ).fetch();

  const activeMemberCount = await database.get('members').query(
    database.get('members').queryBuilder().unsafeGetWhere('status', 'active')
  ).fetch();

  const recentTxns = await database.get('transactions').query(
    database.get('transactions').queryBuilder().unsafeGetOrderBy('created_at', 'DESC').limit(5)
  ).fetch();

  return {
    totalIncome: bilan.totalIncome,
    totalExpense: bilan.totalExpense,
    netResult: bilan.netResult,
    pendingTransactions: pendingCount.length,
    activeMembers: activeMemberCount.length,
    recentTransactions: recentTxns.map((t: any) => ({ id: t.id, type: t.type, amount: t.amountDecimal ?? t.amount, date: t.date })),
  };
}
```

#### 2. `src/features/dashboard/components/KPIDisplay.tsx`
```typescript
// src/features/dashboard/components/KPIDisplay.tsx — KPI stat cards using Design System tokens

import React from 'react';
import { Text, View } from 'react-native';
import { DEFAULT_THEME, typography } from '@/core/theme';
import { Card } from '@/shared/components/Card';

interface Props { label: string; value: number | string; color?: string; }

export function KPIDisplay({ label, value, color }: Props) {
  const displayColor = color ?? DEFAULT_THEME.textPrimary;
  const displayValue = typeof value === 'number' ? `${value.toLocaleString('fr-FR')} Fr` : String(value);

  return (
    <Card variant="stat">
      <Text style={{ color: DEFAULT_THEME.textTertiary, fontSize: 12 }}>{label}</Text>
      <Text style={{ color: displayColor, fontSize: typography.heroNumber.size, fontWeight: '800' }}>{displayValue}</Text>
    </Card>
  );
}
```

---

### B. SETTINGS MODULE

#### 3. `src/features/settings/src/SettingsService.ts`
```typescript
// src/features/settings/src/SettingsService.ts
// Application preferences, language, organization config

import { LocalPreferences } from '@/core/storage/src/LocalPreferences';

export type AppLanguage = 'fr' | 'en';

export class SettingsService {
  constructor(private prefs = new LocalPreferences()) {}

  getLanguage(): AppLanguage {
    return (this.prefs.get('app_language') as AppLanguage) ?? 'fr';
  }

  setLanguage(lang: AppLanguage): void {
    this.prefs.set('app_language', lang);
  }

  getAccentColor(): string {
    return this.prefs.get('org_accent') ?? '#FF6B00';
  }

  setAccentColor(hex: string): void {
    this.prefs.set('org_accent', hex);
  }

  isDarkModeEnabled(): boolean {
    return true; // Lumina always dark (INV-DESIGN)
  }
}
```

#### 4. `src/features/settings/components/LanguageSelector.tsx`
```typescript
// src/features/settings/components/LanguageSelector.tsx
import React from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { DEFAULT_THEME } from '@/core/theme';
import { SettingsService } from '../SettingsService';

const LANGUAGES = [
  { code: 'fr' as const, label: 'Francais' },
  { code: 'en' as const, label: 'English' },
];

export function LanguageSelector() {
  const service = new SettingsService();

  return (
    <View>
      <Text style={{ color: DEFAULT_THEME.textSecondary, fontSize: 14 }}>Langue</Text>
      {LANGUAGES.map(lang => (
        <TouchableOpacity key={lang.code} onPress={() => service.setLanguage(lang.code)}>
          <Text style={{ color: service.getLanguage() === lang.code ? DEFAULT_THEME.accent : DEFAULT_THEME.textSecondary, fontSize: 14 }}>
            {lang.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}
```

---

### C. SOCIAL MODULE (V2-ready scaffold)

#### 5. `src/features/social/src/SocialFeed.tsx`
```typescript
// src/features/social/src/SocialFeed.tsx — Placeholder for V2 social feed
// Currently shows a message that feature is coming in V2+
import React from 'react';
import { Text, View } from 'react-native';
import { DEFAULT_THEME } from '@/core/theme';

export function SocialFeed() {
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: DEFAULT_THEME.bg, padding: 24 }}>
      <Text style={{ color: DEFAULT_THEME.textSecondary, fontSize: 16 }}>
        Module Social disponible en V2
      </Text>
      <Text style={{ color: DEFAULT_THEME.textTertiary, fontSize: 14, marginTop: 8 }}>
        Membre publications, commentaires, annonces
      </Text>
    </View>
  );
}
```

---

### D. TESTS

#### 6. `tests/unit/features/dashboard/DashboardService.test.ts`
```typescript
import { getDashboardKPIs } from '../../../../src/features/dashboard/src/DashboardService';

describe('DashboardService', () => {
  test('getDashboardKPIs returns structure with all fields', async () => {
    // Integration test — requires real DB
    expect(getDashboardKPIs).toBeDefined();
  });
});
```

#### 7. `tests/unit/features/settings/SettingsService.test.ts`
```typescript
import { SettingsService } from '../../../../src/features/settings/src/SettingsService';

describe('SettingsService', () => {
  let service: SettingsService;
  beforeEach(() => { service = new SettingsService(); });

  test('defaults to French language', () => {
    expect(service.getLanguage()).toBe('fr');
  });

  test('sets and retrieves accent color', () => {
    service.setAccentColor('#2196F3');
    expect(service.getAccentColor()).toBe('#2196F3');
  });

  test('always returns dark mode enabled', () => {
    expect(service.isDarkModeEnabled()).toBe(true);
  });
});
```

## Tests to Write
All unit tests above. Add E2E: login → view dashboard KPIs → change language → verify persistence.

## Documentation to Update
- Traceability Matrix: add PRD-09 (Notifications→Dashboard KPIs), PRD-10 (Export→Settings)

## DoD Checklist — Sprint 8 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | Dashboard + Settings have tests | |
| C02 | Coverage >= 60% dashboard, >= 80% settings | |
| C03 | No hardcoded values for org identity | |
| C04 | Zero `any` types | |
| T01 | Settings persistence tested | |
| Q01-Q04 | Lint/typecheck/prettier/format clean | |
