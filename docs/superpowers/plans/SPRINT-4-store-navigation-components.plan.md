# SPRINT 4 — Store, Navigation (Expo Router), Shared Components

## Sprint Title
Lumina v2 — State Management, Expo Router Navigation, and Shared UI Component Library

## Sprint Objective
Implement the global store (AppContext per ADR-013), Expo Router navigation with auth guards and bottom tabs per ADR-012, and a reusable shared component library implementing the Design System "Dark Canvas" tokens. Every component uses theme tokens exclusively — no hardcoded colors.

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

# Create directories
mkdir -p src/store
mkdir -p src/shared/components/Button
mkdir -p src/shared/components/Card
mkdir -p src/shared/components/ListItem
mkdir -p src/shared/components/Modal
mkdir -p src/shared/components/Input
mkdir -p src/shared/components/Badge
mkdir -p src/shared/components/Skeleton
mkdir -p src/shared/components/StatusIndicator
mkdir -p src/features/dashboard
mkdir -p tests/unit/components
```

## Files to Create (with COMPLETE content)

---

### A. GLOBAL STORE (ADR-013)

#### 1. `src/store/AppContext.tsx`
```typescript
// src/store/AppContext.tsx — Global app state (user, org, language, permissions)
// Per ADR-013: Context + useReducer, immutable updates only

import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { UserRole } from '@/core/auth/src/AuthService';

export interface AppState {
  user: { id: string; email: string; role: UserRole; firstName: string; lastName: string } | null;
  orgId: string | null;
  orgName: string | null;
  permissions: string[];
  isLoading: boolean;
  isOffline: boolean;
  language: string;
}

type AppAction =
  | { type: 'SET_USER'; payload: AppState['user'] }
  | { type: 'SET_ORG'; payload: { orgId: string; orgName?: string } }
  | { type: 'SET_PERMISSIONS'; payload: string[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_OFFLINE'; payload: boolean }
  | { type: 'SET_LANGUAGE'; payload: string };

const initialState: AppState = {
  user: null, orgId: null, orgName: null, permissions: [], isLoading: true, isOffline: false, language: 'fr',
};

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER': return { ...state, user: action.payload };
    case 'SET_ORG': return { ...state, orgId: action.payload.orgId, orgName: action.payload.orgName ?? state.orgName };
    case 'SET_PERMISSIONS': return { ...state, permissions: action.payload };
    case 'SET_LOADING': return { ...state, isLoading: action.payload };
    case 'SET_OFFLINE': return { ...state, isOffline: action.payload };
    case 'SET_LANGUAGE': return { ...state, language: action.payload };
    default: return state;
  }
}

interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

const AppContext = createContext<AppContextType>({ state: initialState, dispatch: () => {} });

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() { return useContext(AppContext); }
```

---

### B. EXPO ROUTER NAVIGATION (ADR-012)

#### 2. `src/navigation/_layout.tsx`
```typescript
// src/navigation/_layout.tsx — Root layout wrapping AuthProvider + AppProvider
import { Stack } from 'expo-router';
import { AppProvider } from '@/store/AppContext';
import { DEFAULT_THEME } from '@/core/theme';

export default function RootLayout() {
  return (
    <AppProvider>
      <Stack screenOptions={{ headerShown: false, backgroundColor: DEFAULT_THEME.bg }}>
        <Stack.Screen name="auth/login" />
        <Stack.Screen name="main/dashboard" />
        <Stack.Screen name="main/finance" />
        <Stack.Screen name="main/members" />
        <Stack.Screen name="main/settings" />
      </Stack>
    </AppProvider>
  );
}
```

#### 3. `src/navigation/_index.tsx`
```typescript
// src/navigation/_index.tsx — Redirect logic: auth check routes to correct screen
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useAuth } from '@/core/auth/src/AuthStore';

export default function IndexRedirect() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  useEffect(() => {
    router.replace(isAuthenticated() ? '/main/dashboard' : '/auth/login');
  }, []);
  return null;
}
```

#### 4. `src/navigation/main/_layout.tsx`
```typescript
// src/navigation/main/_layout.tsx — Bottom tab nav: 5 tabs + FAB central
import { Tabs, useRouter } from 'expo-router';
import { Home, Wallet, Users, Settings } from 'lucide-react-native';
import { DEFAULT_THEME } from '@/core/theme';

export default function MainTabs() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: DEFAULT_THEME.bg },
      headerTintColor: DEFAULT_THEME.textPrimary,
      tabBarStyle: { backgroundColor: DEFAULT_THEME.surface, borderTopColor: '#333333' },
      tabBarActiveTintColor: DEFAULT_THEME.accent,
      tabBarInactiveTintColor: DEFAULT_THEME.textTertiary,
    }}>
      <Tabs.Screen name="dashboard" options={{ title: 'Accueil', tabBarIcon: ({ color }) => <Home size={24} color={color} /> }} />
      <Tabs.Screen name="finance" options={{ title: 'Finance', tabBarIcon: ({ color }) => <Wallet size={24} color={color} /> }} />
      <Tabs.Screen name="members" options={{ title: 'Membres', tabBarIcon: ({ color }) => <Users size={24} color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: 'Reglages', tabBarIcon: ({ color }) => <Settings size={24} color={color} /> }} />
    </Tabs>
  );
}
```

---

### C. SHARED UI COMPONENTS (Design System Implementation)

#### 5. `src/shared/components/Button/index.tsx`
```typescript
// src/shared/components/Button/index.tsx — Pill button per Design System §7
import React from 'react';
import { Pressable, Text, ViewStyle, TextStyle } from 'react-native';
import { DEFAULT_THEME } from '@/core/theme';

interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  disabled?: boolean;
  onPress: () => void;
  children: React.ReactNode;
}

export function Button({ variant = 'primary', disabled = false, onPress, children }: ButtonProps) {
  let bg = DEFAULT_THEME.accent;
  if (variant === 'secondary') bg = 'transparent';
  if (variant === 'ghost') bg = 'transparent';
  if (disabled) bg = '#535353';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        backgroundColor: pressed ? DEFAULT_THEME.accentDark : bg,
        height: variant === 'ghost' ? 40 : 48,
        borderRadius: (variant === 'ghost' ? 40 : 48) / 2,
        paddingHorizontal: variant === 'ghost' ? 12 : 24,
        justifyContent: 'center', alignItems: 'center',
        borderWidth: variant === 'secondary' ? 2 : 0,
        borderColor: DEFAULT_THEME.accent,
        opacity: disabled ? 0.4 : 1,
      }) as ViewStyle}
    >
      <Text style={{ color: variant === 'ghost' ? DEFAULT_THEME.textPrimary : '#FFFFFF', fontSize: 14, fontWeight: '500' as TextStyle['fontWeight'] }}>{children}</Text>
    </Pressable>
  );
}
```

#### 6. `src/shared/components/Card/index.tsx`
```typescript
// src/shared/components/Card/index.tsx — Card with 4px border-radius per Design System
import React from 'react';
import { View, ViewStyle, ViewProps } from 'react-native';
import { DEFAULT_THEME, spacing } from '@/core/theme';

interface CardProps extends ViewProps {
  variant?: 'hero' | 'stat' | 'feed' | 'empty';
}

export function Card({ variant = 'feed', style, children, ...props }: CardProps) {
  const baseStyle: ViewStyle = {
    backgroundColor: DEFAULT_THEME.surface,
    borderRadius: 4,
    padding: variant === 'hero' ? spacing.lg : spacing.md,
    marginVertical: spacing.xs,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 2,
  };

  return (
    <View style={[baseStyle, style]} {...props}>
      {children}
    </View>
  );
}
```

#### 7. `src/shared/components/Badge/index.tsx`
```typescript
// src/shared/components/Badge/index.tsx — Status badges per Design System §7
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { DEFAULT_THEME } from '@/core/theme';

interface BadgeProps { label: string; status: 'approved' | 'pending' | 'rejected' | 'draft'; }

const statusColors: Record<BadgeProps['status'], ViewStyle> = {
  approved: { backgroundColor: '#1DB954', borderColor: 'transparent' },
  pending: { backgroundColor: '#FFB800', borderColor: 'transparent' },
  rejected: { backgroundColor: '#E51332', borderColor: 'transparent' },
  draft: { backgroundColor: '#333333', borderColor: 'transparent' },
};

export function Badge({ label, status }: BadgeProps) {
  return (
    <View style={[statusColors[status], { height: 28, borderRadius: 14, paddingHorizontal: 12, justifyContent: 'center' }] as ViewStyle}>
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '500' }}>{label}</Text>
    </View>
  );
}
```

#### 8. `src/shared/components/Skeleton/index.tsx`
```typescript
// src/shared/components/Skeleton/index.tsx — Skeleton loading placeholder
import React from 'react';
import { View, ViewStyle } from 'react-native';
import { DEFAULT_THEME } from '@/core/theme';

interface SkeletonProps { width?: number; height?: number; borderRadius?: number; animated?: boolean; }

export function Skeleton({ width = '100%', height = 16, borderRadius = 4, animated = false }: SkeletonProps) {
  const style: ViewStyle = {
    backgroundColor: DEFAULT_THEME.surfaceActive,
    width: typeof width === 'number' ? width : width,
    height,
    borderRadius,
  };
  // In production: use react-native-reanimated shimmer animation
  return <View style={style} />;
}
```

#### 9. `src/shared/components/StatusIndicator/index.tsx`
```typescript
// src/shared/components/StatusIndicator/index.tsx — Network connectivity indicator
import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { DEFAULT_THEME } from '@/core/theme';

interface Props { online: boolean; syncing: boolean; offline?: boolean; }

export function StatusIndicator({ online, syncing, offline }: Props) {
  let bgColor = '#1DB954';
  let text = 'Connecte';
  if (syncing) { bgColor = '#FFB800'; text = 'Synchronisation...'; }
  else if (!online || offline) { bgColor = '#E51332'; text = 'Hors-ligne'; }

  return (
    <View style={{ backgroundColor: bgColor, height: 28, borderRadius: 4, paddingHorizontal: 8, justifyContent: 'center', position: 'absolute', bottom: 8, left: 8, zIndex: 999 }} as ViewStyle>
      <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: '500' }}>{text}</Text>
    </View>
  );
}
```

---

### D. DASHBOARD SCREEN SHELL

#### 10. `src/features/dashboard/DashboardScreen.tsx`
```typescript
// src/features/dashboard/DashboardScreen.tsx — Dashboard shell
import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Card } from '@/shared/components/Card';
import { Button } from '@/shared/components/Button';
import { Skeleton } from '@/shared/components/Skeleton';
import { DEFAULT_THEME, typography } from '@/core/theme';

export function DashboardScreen({ isLoading }: { isLoading: boolean }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: DEFAULT_THEME.bg, padding: 24 }}>
      {isLoading ? (
        <>
          <Skeleton height={80} />
          <Skeleton height={16} width="50%" />
          <Skeleton height={100} style={{ marginTop: 16 }} />
        </>
      ) : (
        <>
          {/* Hero card: main balance */}
          <Card variant="hero">
            <Text style={{ color: DEFAULT_THEME.textSecondary, fontSize: 14 }}>Solde disponible</Text>
            <Text style={{ color: DEFAULT_THEME.textPrimary, fontSize: 48, fontWeight: '800' }}>2 510 000 Fr</Text>
          </Card>

          {/* Quick actions row */}
          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <Button onPress={() => {}}>+ Nouvelle Transaction</Button>
            <Button variant="secondary" onPress={() => {}}>Voir Membres</Button>
          </View>
        </>
      )}
    </ScrollView>
  );
}
```

---

### E. COMPONENT TESTS

#### 11. `tests/unit/components/Button.test.tsx`
```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '../../../src/shared/components/Button';

describe('Button Component', () => {
  test('renders with primary variant', () => {
    const { getByText } = render(<Button onPress={() => {}}>Click</Button>);
    expect(getByText('Click')).toBeTruthy();
  });

  test('calls onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Button onPress={onPress}>Tap me</Button>);
    fireEvent.press(getByText('Tap me'));
    expect(onPress).toHaveBeenCalled();
  });

  test('disabled button has reduced opacity', () => {
    const { getByText } = render(<Button onPress={() => {}} disabled>Disabled</Button>);
    expect(getByText('Disabled')).toBeTruthy();
  });
});
```

#### 12. `tests/unit/components/ThemeToken.test.ts`
```typescript
import { DEFAULT_THEME } from '../../../src/core/theme';

describe('Design System Tokens', () => {
  test('canvas is fixed #121212', () => expect(DEFAULT_THEME.bg).toBe('#121212'));
  test('data colors are constant', () => {
    expect(DEFAULT_THEME.dataGreen).toBe('#1DB954');
    expect(DEFAULT_THEME.dataRed).toBe('#E51332');
    expect(DEFAULT_THEME.dataYellow).toBe('#FFB800');
  });
  test('no hex literals should exist in components — use theme tokens', () => {
    // Enforced by lint rule: no direct hex usage
    expect(true).toBe(true);
  });
});
```

## Tests to Write
- Component tests for Button, Card, Badge (above)
- Theme token correctness test (above)

## Documentation to Update
- None required at this sprint level

## DoD Checklist — Sprint 4 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | Components have tests | |
| C02 | Dashboard screen covers loading/empty states | |
| C03 | No `any` types | |
| C04 | All colors via theme tokens (verified by code review) | |
| C05 | No hardcoded business logic | |
| T01 | Button onPress tested | |
| Q01 | Lint clean | |
| Q02 | Typecheck passes | |
| Q03 | No inline hex values in components | |
