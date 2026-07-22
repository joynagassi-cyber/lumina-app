# Frontend Implementation Guide — Architecture React Native + Expo

**Doc ID:** DOC-FRONTEND-GUIDE  
**Version:** 2.1  
**Statut :** SPÉCIFICATION DE STRUCTURE

---

## 1. Stack Technique (ADR-005)

| Couche | Technologie | Version cible |
|---|---|---|
| Framework | Expo SDK | Dernière stable |
| Langage | TypeScript 5+ | strict: true |
| Navigation | Expo Router v4 | FileSystem routes |
| Local DB | WatermelonDB (@nozbe/watermelondb) | dernière stable |
| Sync | InsForge REST API + custom sync layer | — |
| State (local) | React Context + useReducer | Pas de Redux/MobX/Zustand |
| State (global auth/org) | AppContext singleton | Lecture seule |
| UI Components | react-native-reanimated + react-native-gesture-handler | — |
| Forms | @rjsf/core (JSON Schema → RN forms) | Via Forms Engine |
| Charts | react-native-chart-kit | Dashboard uniquement |
| Icons | lucide-react-native | Tous les modules |
| i18n | expo-localization + custom context | FR/EN minimum |
| Offline | NetInfo + React Query stale-while-revalidate | — |

**JAMAIS utiliser :** Redux, MobX, Zustand, GraphQL, Mongoose, TypeORM, Sequelize, supabase-js, firebase, react-native-paper, native-base.

---

## 2. Structure des Fichiers

```
src/
├── core/                    # Infrastructure commune (NE PAS modifier sans permission)
│   ├── app.tsx              # Root component (<App />)
│   ├── bootstrap.tsx        # Init WatermelonDB, InsForge client, theme
│   └── config.ts            # Constants: API URL, version, feature flags
│
├── core/auth/               # Propriétaire: Auth module
│   ├── AuthProvider.tsx     # Context auth, login/logout, session
│   ├── AuthService.ts       # Login flow, token refresh, OAuth
│   ├── AuthValidator.ts     # Email validation, password rules
│   └── AuthGuard.tsx        # Route guard component
│
├── core/sync/               # Propriétaire: Sync Engine module
│   ├── SyncManager.ts       # Central orchestration (connectivity, queue, conflicts)
│   ├── Database.ts          # WatermelonDB init, migrations, model registration
│   ├── adapters/            # ORM adapter layer (WatermelonDB ↔ Models)
│   │   ├── TransactionAdapter.ts
│   │   ├── MemberAdapter.ts
│   │   └── ...
│   └── strategies/          # Conflict resolution policies
│       ├── LWWStrategy.ts   # Last Write Wins (members, settings)
│       ├── ImmutableStrategy.ts  # Finance (compensatory only)
│       └── MergeStrategy.ts # Groups, events (combine changes)
│
├── core/network/            # Propriétaire: Network module
│   ├── InsForgeClient.ts    # SDK wrapper with retry, timeout, error mapping
│   ├── Interceptors.ts      # Auth header injection, org_id header, error handling
│   └── types.ts             # Shared network types
│
├── core/storage/            # Propriété: Storage module
│   ├── FileStorage.ts       # Local file save (receipts, photos)
│   ├── ImageCache.ts        # Cached images with expiration
│   └── LocalPreferences.ts  # App settings persisted locally
│
├── features/                # Business modules (chaque module ici)
│   ├── finance/             # Propriétaire: Finance module
│   ├── members/             # Propriétaire: Members module
│   ├── groups/              # Propriétaire: Groups module
│   ├── events/              # Propriétaire: Events module
│   ├── celebrations/        # Propriétaire: Celebrations module
│   ├── dashboard/           # Propriétaire: Dashboard module
│   ├── social/              # Propriétaire: Social module
│   └── settings/            # Propriétaire: Settings module
│
├── shared/                  # Partagé entre features
│   ├── components/          # Réutilisable: Buttons, Cards, Lists, Modals
│   ├── hooks/               # Custom hooks: useOffline, useOrg, usePermission
│   ├── utils/               # Helpers: formatDate, formatCurrency, validateEmail
│   └── constants/           # Static values: currencies, statuses, enums
│
├── navigation/              # Routes (Expo Router compatible)
│   ├── _layout.tsx          # Root layout (tabs, headers)
│   ├── _index.tsx           # Redirect logic (auth check → correct route)
│   ├── auth/                # Login, forgot password, onboarding
│   ├── main/                # Tab bar layout, main screens
│   └── feature/             # Deep links per feature
│
├── models/                  # WatermelonDB models (uniquement Sync Engine écrit)
│   ├── Transaction.ts       # @Table('transactions') class
│   ├── Member.ts            # @Table('members') class
│   ├── Category.ts          # @Table('categories') class
│   ├── Department.ts        # @Table('departments') class
│   ├── PendingOperation.ts  # @Table('pending_operations') class
│   └── UserSession.ts       # @Table('user_sessions') class
│
└── store/                   # State management global
    └── AppContext.tsx       # Current user, current org, permissions, loading state
```

---

## 3. Contrat d'Interface par Feature

Chaque feature expose UNE fonction entry-point que les autres modules appellent. Aucune feature ne touche directement aux données d'une autre.

### 3.1 Contract Signature Pattern

Toutes les services suivent cette signature :

```typescript
interface FeatureService {
  // READ — toujours avec org_id injecté automatiquement par intercepteur
  list(filters?: Filter): Promise<Entity[]>;
  get(id: string): Promise<Entity | null>;
  search(query: string, filters?: Filter): Promise<Entity[]>;

  // CREATE — écrit locale d'abord (WatermelonDB), sync async ensuite
  create(data: CreateData): Promise<string>; // returns ID
  
  // UPDATE — same pattern
  update(id: string, data: UpdateData): Promise<boolean>;
  
  // DELETE — soft delete via pending_operations
  delete(id: string): Promise<boolean>;
}
```

### 3.2 Exemples de Contracts par Feature

**Finance Service:**
```typescript
// Appels autorisés depuis n'importe quel module (READ ONLY)
finance.list({ dateFrom, dateTo, type, status });
finance.create({ amount, category, description, type, date });
finance.getBilan(year, period); // calcule income - expense
finance.approve(id, userId);   // transition draft→pending→approved
```

**Members Service:**
```typescript
members.list(orgId, filters);
members.create(data);          // auto-org_id from context
members.search(query);
members.linkToGroup(memberId, groupId);
```

**Groups Service:**
```typescript
groups.list(orgId);
groups.create(data);           // requires member requester has admin role
groups.addMember(groupId, memberId);
groups.removeMember(groupId, memberId);
```

### 3.3 Règles de Consommation

1. **Lecture** : Toujours via le service, jamais accès direct au DB
2. **Écriture** : Toujours via le service, jamais mutation directe
3. **Cross-feature** : Un module A qui a besoin des données du module B appelle `BService.list()`, ne fait pas de requête SQL ni DB directe
4. **Event-driven** : Pour les effets de bord cross-module, utiliser des événements (notifier Sync Manager)

---

## 4. WatermelonDB Adapter Pattern

Les adapters transforment les requêtes HTTP InsForge en opérations WatermelonDB et vice-versa. C'est LA couche à connaître pour ajouter/modifier des modèles.

```typescript
// Adapter structure générale
class TransactionAdapter {
  static fromCloud(json: object): Partial<TransactionAttrs> { /* mapping */ }
  static toCloud(model: Transaction): object { /* mapping */ }
  static async syncNew(model: Transaction): Promise<void> { /* POST/PUT to InsForge */ }
  static async handleConflict(model: Transaction, serverData: object): void { /* resolve */ }
}
```

Règles :
- Jamais de logique métier dans l'adapter (seulement mapping)
- Chaque modèle doit avoir son adapter
- Les adapters ne font PAS de requêtes HTTP — délèguent à InsForgeClient
- Les migrations DB sont centralisées dans `core/sync/Database.ts`

---

## 5. Navigation Rules

Se conformer à la configuration Expo Router :
- Fichiers dans `navigation/feature/nom-du-fichier.tsx` = routes `/feature/nom-du-fichier`
- Layouts imbriqués possible : `_layout.tsx` dans chaque sous-dossier
- Guards (AuthGuard) s'appliquent dans les layouts
- Deep linking activé pour : `/feature/nom?param=valeur`

---

## 6. Theming & Design Tokens

**RÉFÉRENCE OBLIGATOIRE :** [ADR-011 — Design System Dark Canvas](../90-adrs/ADR-011-design-system-spotify-style.md) | [`design-system/INDEX.md`](../../design-system/INDEX.md)

Tous les styles passent par le thème central (`src/core/theme.ts`) :

```typescript
const colors = {
  // ===== COUCHE FIXE (Canvas) — JAMAIS MODIFIÉE =====
  // Backgrounds — Spotify Dark
  bg: '#121212',
  surface: '#181818',
  surfaceHover: '#282828',
  surfaceActive: '#333333',

  // Données financières — TOUJOURS CONSTANTS
  dataGreen: '#1DB954',
  dataRed: '#E51332',
  dataYellow: '#FFB800',

  // Texte — TOUJOURS CONSTANTS
  textPrimary: '#FFFFFF',
  textSecondary: '#B3B3B3',
  textTertiary: '#808080',
  textPlaceholder: '#535353',

  // ===== COUCHE CONFIGURABLE (Accent par org) =====
  // Ces valeurs sont injectées au runtime depuis la config de l'org
  accent: '#FF6B00',   // preset org ou custom (default: Église → Fire Orange)
  accentLight: '#FF8533',
  accentDark: '#CC5500',
};

const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

const typography = {
  heroNumber: { size: 48, weight: '800' },
  h1: { size: 32, weight: '700' },
  h2: { size: 24, weight: '700' },
  h3: { size: 18, weight: '700' },
  body: { size: 14, weight: '400' },
  small: { size: 12, weight: '400' },
  caption: { size: 11, weight: '500' },
};
```

### Règles de Thème (non-négociables)

1. **Jamais de blanc sur noir pur** — utiliser `#121212` + `#181818`
2. **Un seul accent** — la couleur d'accent est choisie dans l'écran de configuration org (ADR-011)
3. **Pas de gradients** — couleurs solides uniquement
4. **Pas de bordures colorées** — séparateurs par espacement uniquement
5. **Pas de couleurs codées en dur dans les composants** — toujours via `colors.*`
6. **Pas de styles inline avec valeurs arbitraires** — toujours via theme tokens
7. **Boutons pill shape, cards arrondies 4px**
8. **Les couleurs données financières ne changent jamais**, même si l'org change d'accent
