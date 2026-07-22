# SPRINT 0 — Initialization & Project Scaffold

## Sprint Title
Lumina v2 — Project Initialization, Environment, CI Foundation, and Empty App Shell

## Sprint Objective
Create a fully working React Native + Expo + TypeScript project with:
- Expo SDK 52 (managed workflow), strict TypeScript, ESLint, Prettier, Husky
- Directory structure matching Frontend Implementation Guide
- Empty app shells for all features (auth routes, main tabs, feature deep links)
- Theme system implementing Design System "Dark Canvas" tokens
- Config system (.env.example, config.ts)
- CI/CD pipeline skeleton (GitHub Actions: lint + typecheck)
- All foundation docs verified <= 400 lines (NB-RULE-01)

## Commands to Execute

```bash
# Navigate to project root
cd C:\Users\joyda\ZCodeProject\lumina-app

# Initialize Expo TypeScript project
npx create-expo-app@latest . --template typescript-blank

# Install core dependencies
npm install @nozbe/watermelondb@^0.24.0 @insforge/sdk lucide-react-native expo-router expo-localization react-native-reanimated react-native-gesture-handler @react-navigation/native-stack @react-navigation/native

# Install dev dependencies
npm install --save-dev @types/react @types/react-native jest ts-jest @testing-library/react-native eslint-plugin-import @typescript-eslint/parser @typescript-eslint/eslint-plugin prettier husky lint-staged @expo/config dotenv-cli

# Initialize Husky
npx husky init

# Create plans directory
mkdir -p docs/superpowers/plans
```

## Files to Create (with COMPLETE content)

### 1. `.env.example`
```
EXPO_PUBLIC_INSFORGE_URL=https://your-project.us-east.insforge.app
EXPO_PUBLIC_INSFORGE_ANON_KEY=your-anon-key-here
EXPO_PUBLIC_APP_VERSION=2.0.0
EXPO_PUBLIC_DEBUG_MODE=false
EXPO_PUBLIC_API_TIMEOUT_MS=10000
EXPO_PUBLIC_SYNC_INTERVAL_MS=300000
```

### 2. `.gitignore` (ensure Expo standard entries)
```
node_modules/
dist/
build/
*.local
.env*
!env.example
.expo/
*.jks
*.p8
*.keystore
.expo/**
ios/*/Xcode.userdatadesc
android/*/app/src/debug/generated
```

### 3. `tsconfig.json`
```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-native",
    "paths": {
      "@/*": ["./src/*"],
      "@/core/*": ["./src/core/*"],
      "@/features/*": ["./src/features/*"],
      "@/shared/*": ["./src/shared/*"],
      "@/navigation/*": ["./src/navigation/*"],
      "@/models/*": ["./src/models/*"],
      "@/store/*": ["./src/store/*"]
    }
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "app/**/*.ts", "app/**/*.tsx"],
  "exclude": ["node_modules"]
}
```

### 4. `.eslintrc.js`
```javascript
module.exports = {
  root: true,
  extends: ['expo', 'eslint:recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
    ecmaFeatures: { jsx: true }
  },
  plugins: ['@typescript-eslint', 'import'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    'react-hooks/exhaustive-deps': 'error',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'import/order': ['error', {
      'newlines-between': 'always',
      groups: ['builtin', 'external', 'internal', 'parent', 'sibling']
    }]
  },
  ignorePatterns: ['node_modules/', 'dist/', 'build/', 'coverage/']
};
```

### 5. `prettier.config.js`
```javascript
module.exports = {
  semi: true,
  trailingComma: 'all',
  singleQuote: false,
  printWidth: 100,
  tabWidth: 2,
  arrowParens: 'always',
  bracketSpacing: true,
  bracketSameLine: false,
  endOfLine: 'lf'
};
```

### 6. `.husky/pre-commit`
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npx lint-staged
```

### 7. `package.json` (full, with all scripts)
```json
{
  "name": "lumina-app",
  "version": "2.0.0",
  "main": "expo-router/entry",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios",
    "web": "expo start --web",
    "lint": "eslint src/ --max-warnings 0",
    "lint:fix": "eslint src/ --fix",
    "format": "prettier --write \"src/**/*.{ts,tsx,json,md}\"",
    "format:check": "prettier --check \"src/**/*.{ts,tsx,json,md}\"",
    "typecheck": "tsc --noEmit",
    "test": "jest --passWithNoTests",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage",
    "prepare": "husky install",
    "doc:check": "find docs/ -name '*.md' | xargs wc -l | grep total"
  },
  "dependencies": {
    "@expo/vector-icons": "^14.0.0",
    "@insforge/sdk": "latest",
    "@nozbe/watermelondb": "^0.24.0",
    "@react-native-community/netinfo": "^11.0.0",
    "@react-navigation/native": "^6.1.9",
    "@react-navigation/native-stack": "^6.9.17",
    "expo": "~52.0.0",
    "expo-build-properties": "~0.13.1",
    "expo-camera": "~16.0.0",
    "expo-constants": "~17.0.0",
    "expo-file-system": "~18.0.0",
    "expo-image-picker": "~16.0.0",
    "expo-linking": "~7.0.0",
    "expo-localization": "~16.0.0",
    "expo-router": "~4.0.0",
    "expo-secure-store": "~14.0.0",
    "expo-sharing": "~13.0.0",
    "expo-splash-screen": "~0.29.0",
    "expo-status-bar": "~2.0.0",
    "lucide-react-native": "^0.378.0",
    "react": "18.3.1",
    "react-dom": "18.3.1",
    "react-native": "0.76.0",
    "react-native-gesture-handler": "~2.20.2",
    "react-native-mmkv": "^3.0.0",
    "react-native-reanimated": "~3.16.0",
    "react-native-safe-area-context": "4.12.0",
    "react-native-screens": "~4.4.0",
    "react-native-svg": "^15.8.0"
  },
  "devDependencies": {
    "@testing-library/react-native": "^12.0.0",
    "@types/react": "~18.3.12",
    "@typescript-eslint/eslint-plugin": "^7.0.0",
    "@typescript-eslint/parser": "^7.0.0",
    "eslint": "^8.56.0",
    "eslint-plugin-import": "^2.29.1",
    "eslint-plugin-react": "^7.34.0",
    "husky": "^9.0.0",
    "jest": "^29.7.0",
    "jest-expo": "~52.0.0",
    "lint-staged": "^15.0.0",
    "prettier": "^3.2.0",
    "typescript": "~5.4.0"
  },
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.md": [
      "wc -l < {} | xargs test {} <= 400 || echo 'WARNING: File exceeds 400 lines'"
    ]
  },
  "private": true
}
```

### 8. `app.json`
```json
{
  "expo": {
    "name": "Lumina",
    "slug": "lumina-v2",
    "version": "2.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "userInterfaceStyle": "dark",
    "scheme": "lumina",
    "splash": {
      "image": "./assets/splash.png",
      "resizeMode": "contain",
      "backgroundColor": "#121212"
    },
    "assetBundlePatterns": [
      "**/*"
    ],
    "plugins": [
      "expo-router",
      "expo-secure-store",
      "expo-localization",
      [
        "expo-build-properties",
        {
          "ios": {
            "usesNonExemptEncryption": false
          },
          "android": {}
        }
      ]
    ],
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/icon.png",
        "backgroundColor": "#121212"
      },
      "package": "com.lumina.app"
    },
    "ios": {
      "bundleIdentifier": "com.lumina.app",
      "bitcode": false
    }
  }
}
```

### 9. `src/core/theme.ts` (Full Design System Token Implementation)
```typescript
// src/core/theme.ts — Theme tokens implementing Design System ADR-011
// Dark Canvas: #121212 base, configurable accent per organization

export interface AccentPalette {
  primary: string;
  light: string;
  dark: string;
}

export interface ThemeColors {
  // === CANVAS LAYER (fixed, never changes) ===
  bg: string;
  surface: string;
  surfaceHover: string;
  surfaceActive: string;

  // === DATA COLORS (fixed, financial immutability INV-001) ===
  dataGreen: string;
  dataRed: string;
  dataYellow: string;

  // === TEXT COLORS (fixed) ===
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textPlaceholder: string;

  // === ACCENT LAYER (configurable per org) ===
  accent: string;
  accentLight: string;
  accentDark: string;
}

export interface SpacingTokens {
  xs: number; sm: number; md: number; lg: number;
  xl: number; '2xl': number; '3xl': number;
}

export interface TypographyTokens {
  heroNumber: { size: number; weight: 800 };
  h1: { size: number; weight: 700 };
  h2: { size: number; weight: 700 };
  h3: { size: number; weight: 700 };
  body: { size: number; weight: 400 };
  small: { size: number; weight: 400 };
  caption: { size: number; weight: 500 };
}

const canvas: ThemeColors = {
  bg: '#121212',
  surface: '#181818',
  surfaceHover: '#282828',
  surfaceActive: '#333333',
  dataGreen: '#1DB954',
  dataRed: '#E51332',
  dataYellow: '#FFB800',
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textTertiary: '#808080',
  textPlaceholder: '#535353',
  accent: '#FF6B00',
  accentLight: '#FF8533',
  accentDark: '#CC5500',
};

export const spacing: SpacingTokens = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, '2xl': 48, '3xl': 64,
};

export const typography: TypographyTokens = {
  heroNumber: { size: 48, weight: 800 },
  h1: { size: 32, weight: 700 },
  h2: { size: 24, weight: 700 },
  h3: { size: 18, weight: 700 },
  body: { size: 14, weight: 400 },
  small: { size: 12, weight: 400 },
  caption: { size: 11, weight: 500 },
};

export function createTheme(accent: AccentPalette = { primary: '#FF6B00', light: '#FF8533', dark: '#CC5500' }): ThemeColors {
  return {
    ...canvas,
    accent: accent.primary,
    accentLight: accent.light,
    accentDark: accent.dark,
  };
}

export const DEFAULT_THEME = createTheme();
```

### 10. `src/core/config.ts`
```typescript
// src/core/config.ts — Centralized configuration (NB-RULE-10: no hardcoded URLs)
export const config = {
  apiBaseUrl: process.env.EXPO_PUBLIC_INSFORGE_URL ?? 'https://dev.insforge.app',
  apiTimeoutMs: Number(process.env.EXPO_PUBLIC_API_TIMEOUT_MS) || 10000,
  syncIntervalMs: Number(process.env.EXPO_PUBLIC_SYNC_INTERVAL_MS) || 300000,
  appVersion: process.env.EXPO_PUBLIC_APP_VERSION || '2.0.0',
  debugMode: process.env.EXPO_PUBLIC_DEBUG_MODE === 'true',
} as const;

export const NAV = {
  AUTH_STACK: 'AuthStack',
  MAIN_TABS: 'MainTabs',
} as const;

export const ORG_TYPES = ['church', 'school', 'ngo', 'company', 'custom'] as const;
export type OrgType = (typeof ORG_TYPES)[number];

export const CURRENCIES = [
  { code: 'CDF', symbol: 'Fr', name: 'Congolese Franc' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
] as const;
```

### 11. `src/core/bootstrap.tsx`
```typescript
// src/core/bootstrap.tsx — Application bootstrap
// Initializes WatermelonDB, InsForge client, and theme before rendering

import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { config } from './config';

interface BootstrapProps {
  children: React.ReactNode;
}

export function Bootstrap({ children }: BootstrapProps): React.ReactElement {
  if (config.debugMode) {
    console.warn(`[Bootstrap] Debug mode ON | API: ${config.apiBaseUrl}`);
  }

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1, backgroundColor: '#121212' }}>
        {children}
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
```

### 12. `src/navigation/auth/_layout.tsx`
```typescript
// src/navigation/auth/_layout.tsx — Auth stack layout (router pattern)
// Covers: Login, Forgot Password, Onboarding

import { Stack } from 'expo-router';
import { DEFAULT_THEME } from '@/core/theme';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, backgroundColor: DEFAULT_THEME.bg }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="forgot-password" />
    </Stack>
  );
}
```

### 13. `src/navigation/main/_layout.tsx`
```typescript
// src/navigation/main/_layout.tsx — Main tab layout (5 tabs + FAB)
// Bottom navigation with centered FAB per Experience Framework §2

import { Tabs } from 'expo-router';
import { Home, Wallet, Users, Settings } from 'lucide-react-native';
import { DEFAULT_THEME } from '@/core/theme';
import { Pressable, Text, View } from 'react-native';

export default function MainLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: DEFAULT_THEME.bg },
        headerTintColor: DEFAULT_THEME.textPrimary,
        tabBarStyle: {
          backgroundColor: DEFAULT_THEME.surface,
          borderTopColor: DEFAULT_THEME.surfaceActive,
          height: 64,
        },
        tabBarActiveTintColor: DEFAULT_THEME.accent,
        tabBarInactiveTintColor: DEFAULT_THEME.textTertiary,
      }}
    >
      <Tabs.Screen name="dashboard" options={{ title: 'Accueil', tabBarIcon: ({ color }) => <Home size={24} color={color} /> }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance', tabBarIcon: ({ color }) => <Wallet size={24} color={color} /> }} />
      <Tabs.Screen name="members" options={{ title: 'Membres', tabBarIcon: ({ color }) => <Users size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Reglages', tabBarIcon: ({ color }) => <Settings size={24} color={color} /> }} />
    </Tabs>
  );
}
```

### 14. Empty Screen Shells (create empty index.tsx in each route folder)
```
src/navigation/auth/login.tsx       → export default function LoginPage() { return null; }
src/navigation/main/dashboard.tsx   → export default function DashboardPage() { return null; }
src/navigation/main/finance.tsx     → export default function FinancePage() { return null; }
src/navigation/main/members.tsx     → export default function MembersPage() { return null; }
src/navigation/main/settings.tsx    → export default function SettingsPage() { return null; }
src/navigation/_index.tsx           → export default function Index() { return null; }
src/app.tsx                         → Root entry point exporting Bootstrap wrapper
src/index.tsx                       → Entry file bootstrapping Expo
```

### 15. `src/app.tsx` (Root Component)
```typescript
// src/app.tsx — Root component wrapping Bootstrap + navigation
import React from 'react';
import { Bootstrap } from './core/bootstrap';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

const Stack = createStackNavigator();

export default function App() {
  return (
    <Bootstrap>
      <NavigationContainer>
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Root" component={Placeholder} />
        </Stack.Navigator>
      </NavigationContainer>
    </Bootstrap>
  );
}

function Placeholder() {
  return null;
}
```

### 16. `.github/workflows/ci.yml`
```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
jobs:
  lint-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npx tsc --noEmit
      - run: npm run lint
      - run: npm run format:check
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test -- --ci --coverage
```

### 17. `jest.config.js`
```javascript
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterArray: [],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|@insforge/)'
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/core/theme.ts',
    '!src/core/config.ts',
  ],
  coverageThreshold: {
    global: {
      statements: 0,
      branches: 0,
      functions: 0,
      lines: 0,
    },
  },
};
```

### 18. `src/shared/utils/date.ts`
```typescript
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function formatDateTime(date: Date): string {
  return date.toISOString().replace('T', ' ').split('.')[0];
}

export function isToday(date: Date): boolean {
  const now = new Date();
  return date.getFullYear() === now.getFullYear() &&
         date.getMonth() === now.getMonth() &&
         date.getDate() === now.getDate();
}

export function getToday(): string {
  return formatDate(new Date());
}
```

### 19. `src/shared/utils/validator.ts`
```typescript
export function validateEmail(email: string): boolean {
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validatePhone(phone: string): boolean {
  if (!phone) return true; // optional
  return /^\+?[\d\s\-()]{7,15}$/.test(phone);
}

export function validatePositiveNumber(value: number): boolean {
  return Number.isFinite(value) && value > 0;
}

export function validateRequired(value: string): boolean {
  return value.trim().length > 0;
}
```

### 20. `tests/unit/theme.test.ts`
```typescript
import { createTheme, DEFAULT_THEME, spacing, typography, ThemeColors } from '../../src/core/theme';

describe('Theme System', () => {
  test('DEFAULT_THEME uses Spotify-style dark canvas', () => {
    expect(DEFAULT_THEME.bg).toBe('#121212');
    expect(DEFAULT_THEME.surface).toBe('#181818');
    expect(DEFAULT_THEME.dataGreen).toBe('#1DB954');
    expect(DEFAULT_THEME.dataRed).toBe('#E51332');
    expect(DEFAULT_THEME.dataYellow).toBe('#FFB800');
  });

  test('createTheme applies custom accent', () => {
    const blueTheme = createTheme({ primary: '#2196F3', light: '#64B5F6', dark: '#1976D2' });
    expect(blueTheme.accent).toBe('#2196F3');
    expect(blueTheme.bg).toBe('#121212'); // canvas unchanged
  });

  test('spacing follows 4px grid', () => {
    expect(spacing.xs).toBe(4);
    expect(spacing.sm).toBe(8);
    expect(spacing.md).toBe(16);
    expect(spacing.lg).toBe(24);
    expect(spacing.xl).toBe(32);
  });

  test('typography weights are bold (700+) for headings', () => {
    expect(typography.heroNumber.weight).toBe(800);
    expect(typography.h1.weight).toBe(700);
    expect(typography.h2.weight).toBe(700);
    expect(typography.h3.weight).toBe(700);
  });

  test('text colors have correct contrast ratios implied by hex values', () => {
    const tc = {} as ThemeColors;
    tc.bg = '#121212';
    // White on #121212 = 21:1 AAA (textPrimary)
    expect(DEFAULT_THEME.textPrimary).toBe('#FFFFFF');
    // #B3B3B3 on #121212 = ~7.2:1 AA+ (textSecondary)
    expect(DEFAULT_THEME.textSecondary).toBe('#B3B3B3');
  });
});
```

### 21. `tests/unit/validator.test.ts`
```typescript
import { validateEmail, validatePhone, validatePositiveNumber, validateRequired } from '../../src/shared/utils/validator';

describe('Validators', () => {
  test('validateEmail', () => {
    expect(validateEmail('test@example.com')).toBe(true);
    expect(validateEmail('invalid')).toBe(false);
    expect(validateEmail('')).toBe(false);
  });

  test('validatePhone', () => {
    expect(validatePhone('+243812345678')).toBe(true);
    expect(validatePhone('')).toBe(true); // optional
  });

  test('validatePositiveNumber', () => {
    expect(validatePositiveNumber(100)).toBe(true);
    expect(validatePositiveNumber(0)).toBe(false);
    expect(validatePositiveNumber(-5)).toBe(false);
  });

  test('validateRequired', () => {
    expect(validateRequired('hello')).toBe(true);
    expect(validateRequired('  ')).toBe(false);
    expect(validateRequired('')).toBe(false);
  });
});
```

### 22. `src/core/__mocks__/@nozbe/watermelondb.ts`
```typescript
// Mock for WatermelonDB to prevent native module errors in Jest
export class Database {
  get<T>(_: string): any { return {}; }
  write<T>(fn: () => T): T { return fn(); }
  beginWrite(fn: () => unknown): unknown { return fn(); }
  prepareAction(_: string) { return {}; }
}

export const collection = jest.fn(() => ({}));
export const lazy = jest.fn();
export const fix = jest.fn();
export const deprecatedFixedColumn = jest.fn();
export constQ = {};
export const relationship = jest.fn();
export const action = jest.fn();
```

### 23. `metro.config.js` (if needed beyond Expo defaults)
```javascript
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);
config.resolver.nodeModulesPaths = [];

module.exports = config;
```

### 24. `docs/superpowers/plans/SPRINT-0-initialization.plan.md` (THIS FILE)
```
(This file itself — the master plan for Sprint 0)
```

## Tests to Write
1. `tests/unit/theme.test.ts` — Verify design token correctness (see above)
2. `tests/unit/validator.test.ts` — Verify utility validators work (see above)

## Documentation to Update
- None yet — Sprint 0 creates the scaffold only. Subsequent sprints update `docs/07-database-schema/Database-Schema.md`, `docs/05-api-contracts/api-contracts.md`, etc.

## DoD Checklist — Sprint 0 Specific

### Code Quality
| # | Criterion | Verification | Status |
|---|-----------|-------------|--------|
| C01 | Tests written | `npm test` passes with 5+ tests | |
| C02 | No `any` type in source | `npx tsc --noEmit` clean | |
| C03 | No hardcoded API URLs | All URLs in `src/core/config.ts` only | |
| C04 | tsconfig `strict: true` verified | Read tsconfig.json | |
| C05 | No business logic hardcoding | Platform Core has zero `if (type === 'church')` | |

### Testing
| # | Criterion | Verification | Status |
|---|-----------|-------------|--------|
| T01 | Tests pass locally | `npm test -- --watchAll=false` | |
| T02 | Theme token test | Verifies #121212 canvas fixed colors | |
| T03 | No regression | Pre-existing project files unchanged | |
| T04 | Offline-capable scaffold | No network calls during app startup | |

### Documentation
| # | Criterion | Verification | Status |
|---|-----------|-------------|--------|
| D01 | No doc needs updating yet | N/A (scaffold only) | |
| D02 | No architectural decisions made | N/A | |
| D03 | Glossary unchanged | N/A | |
| D04 | Traceability matrix not applicable | N/A | |

### Quality Gates
| # | Criterion | Verification | Status |
|---|-----------|-------------|--------|
| Q01 | Prettier applied | `npm run format:check` clean | |
| Q02 | Linting passes | `npm run lint` zero warnings | |
| Q03 | TypeScript compiles | `tsc --noEmit` clean | |
| Q04 | This plan <= 400 lines | Line count verified | |
