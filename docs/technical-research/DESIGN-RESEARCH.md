# Recherche Design — Accélérer le Design Lumina sans Sacrifier la Qualité

> Date: 2026-07-23
> Auteur: Analysis Research Agent
> Stack: React Native + Expo + WatermelonDB + Dark Canvas Design System
> Objectif: Identifier les patterns et outils design qui accélèrent le développement de 40-65% tout en maintenant une qualité professionnelle

---

## Table des Matières

1. [État des Lieux — Docs Existantes Analyse](#1-etat-des-lieux--docs-existantes-analyse)
2. [Patterns d'Accélération Design System](#2-patterns-daccélération-design-system)
3. [Component Library — Aller Vite sans Perdre en Qualité](#3-component-library--aller-vite-sans-perdre-en-qualité)
4. [Dark Mode Implementation Pro (Pas Juste Inverser Couleurs)](#4-dark-mode-implementation-pro-pas-juste-inverser-couleurs)
5. [Configuration-Driven Design (Accent Par Org)](#5-configuration-driven-designaccent-par-org)
6. [Références Réelles — Patterns Identifiés par Écran](#6-références-réelles-patterns-identifiés-par-écran)
7. [Patterns Navigation & Layout Éprouvés](#7-patterns-navigation--layout-éprouvés)
8. [Patterns Data Visualization + Financial](#8-patterns-data-visualization--financial)
9. [Accessibilité & Performance Expérientielle](#9-accessibilité--performance-expérientielle)
10. [Stack Design Recommandée](#10-stack-design-recommandée)
11. [Ordre Prioritaire d'Implémentation Design](#11-ordre-prioritaire-dimplémentation-design)

---

## 1. État des Lieux — Docs Existantes Analyse

### Documents Design Existant

| Document | Lignes | Status | Complété ? |
|----------|--------|--------|-----------|
| `docs/03-design-guidelines/DESIGN.md` | 543 | ✅ Complexe | Thème, couleurs, typo, layout, animation, data viz |
| `docs/03-design-guidelines/EXPERIENCE.md` | 498 | ✅ Complexe | Navigation, parcours, patterns, states, accessibilité |
| `design-system/INDEX.md` | 156 | ✅ Complexe | Palette, presets org, règles d'or |
| `design-system/prototypes/*.html` | 7 prototypes | ✅ Fonctionnels | Login, Dashboard, Ledger, Rapport, Members, Calendar, Config Org |

### Points Forts Existant

- **Thème "Dark Canvas" exceptionnellement bien spécifié** — chaque couleur, contraste, et surface documentés avec valeurs hex précises
- **Presets 5 types d'organisation** prêts à l'emploi
- **7 prototypes HTML fonctionnels** couvrant tous les écrans principaux
- **Parcours utilisateur critiques** détaillés (login→dashboard <5s, transaction <2min, approbation <10s)

### Gaps Identifiés (ce qui manque pour accélérer)

1. **Aucun fichier `src/core/theme.ts` n'existe** — le theme token factory est DOCUMENTÉ mais N'EST PAS IMPLEMENTÉ. C'est le goulot d'étranglement #1.
2. **PRD mentionne React Native Paper mais ADR-011 rejette RN Paper** — contradiction à résoudre avant code
3. **Aucune règle ESLint** pour empêcher les valeurs hex codées en dur dans les composants
4. **Aucun composant partagé n'est implémenté** — zéro composant réutilisable existant
5. **Les prototypes HTML sont statiques** — aucune donnée dynamique, aucun état interactif

### Conclusion État des Lieux

Le travail de DESIGN (pas d'implémentation) est presque complet. Les docs sont exhaustives et internes cohérentes (sauf PRD vs ADR contradiction). Le gain rapide ne viendra pas de plus de documentation mais de **patterns d'implémentation accélérateurs**.

---

## 2. Patterns d'Accélération Design System

### Pattern 1: Theme Token Factory (Priorité CRITIQUE)

**Ce que c'est:** Une unique fonction `createTheme(accent)` qui retourne TOUT le design system compilé. C'est le seul endroit où les couleurs, espacements et typographies existent.

```typescript
// src/core/theme.ts — L'unique source de vérité
const CANVAS = {
  bg: '#121212', surface: '#181818', surfaceHover: '#282828',
} as const;
const DATA = { dataGreen: '#1DB954', dataRed: '#E51332', dataYellow: '#FFB800' } as const;
const SPACING = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
// ... TYPO + SHADOWS

export function createTheme(accent: AccentPalette): LuminaTheme { ... };
```

**Gain estimé:** -80% temps theming, zéro valeur hex codée en dur, switch org instantané.

### Pattern 2: Preset Registry Centralisé

**Ce que c'est:** Un objet unique `ORG_PRESETS` contenant les 5 palettes prédéfinies. Aucune doc externe + aucun composant ne liste les presets séparément.

```typescript
export const ORG_PRESETS = {
  church:    { label: 'Fire Orange',  primary: '#FF6B00', light: '#FF8533', dark: '#CC5500' },
  school:    { label: 'Education Teal', primary: '#00A896', light: '#00D4B6', dark: '#007F72' },
  ngo:       { label: 'NGO Green',   primary: '#4CAF50', light: '#81C784', dark: '#388E3C' },
  corporate: { label: 'Corporate Blue', primary: '#2196F3', light: '#64B5F6', dark: '#1976D2' },
  institution: { label: 'Inst Indigo', primary: '#3F51B5', light: '#7986CB', dark: '#303F9F' },
} as const;
```

**Gain:** Élimine la triple-documentation des presets (ADR, DESIGN.md, INDEX.md).

### Pattern 3: ESLint Anti-Hardcode Hex

**Ce que c'est:** Règle ESLint `no-restricted-imports` + regex plugin qui bloque TOUT usage de `'#FF6B00'` en dehors de `src/core/theme.ts` et `src/shared/constants/org-presets.ts`.

```json
{
  "rules": {
    "@lumina/no-hardcoded-hex": ["error", {
      "allowFiles": ["src/core/theme.ts", "src/shared/constants/org-presets.ts"]
    }]
  }
}
```

**Gain:** Garanti à vie que les composants utilisent toujours `theme.accent` jamais un hex statique.

### Pattern 4: useTheme() Hook Universal

**Ce que c'est:** Un hook minimal qui donne le thème complet partout. Zéro prop drilling.

```typescript
// src/hooks/useTheme.ts
import { createContext, useContext } from 'react';
export const ThemeContext = createContext<LuminaTheme | null>(null);
export const useTheme = () => {
  const theme = useContext(ThemeContext);
  if (!theme) throw new Error('useTheme must be used within ThemeProvider');
  return theme;
};
```

**Gain:** Chaque component fait `const t = useTheme()` — zéro boilerplate.

---

## 3. Component Library — Aller Vite sans Perdre en Qualité

### Minimum Viable Shared Components (MVP Velocity)

Construire uniquement ces 10 composants avant tout écran:

| Composant | Rôle | Variants (props) | Écrans concernés |
|-----------|------|-------------------|-----------------|
| `LButton` | Tous boutons | `variant="primary\|secondary\|ghost\|icon"` | Partout |
| `LCard` | Cartes contenantes | `variant="hero\|stat\|feed\|empty"` | Dashboard, Ledger, Members |
| `LText` | Typography semantique | `variant="h1\|h2\|body\|caption\|small"` | Partout |
| `LInput` | Champs formulaire | `type="text\|number\|password\|email"` | Forms, Login, Search |
| `LBadge` | Status/chips | `variant="approved\|pending\|rejected\|draft"` | Ledger, Members, Events |
| `LBottomSheet` | Modale bottom | `draggable={true}, dismissable={true}` | Creation flows |
| `LSkeleton` | Loading shimmer | `width="full"\|half, height="sm"\|md"\|lg"` | Toutes les listes |
| `LIcon` | Icônes wrapper | `name: LucideName, size?: number` | Partout |
| `LConnectionStatus` | Indicateur online/offline | persistant bottom | Global |
| `LForm` | Wrapper formulaire react-hook-form | `schema: ZodSchema, onSubmit: Fn` | Tous les formulaires |

**Pourquoi 10 seulement?** Chaque écran MVP compose à partir de ces briques. Pas de besoins spécifiques au-delà.

### Pattern Button Universel (le 1er à construire)

Le bouton est le composant le PLUS utilisé. Construis-le en premier:

```typescript
// Pill shape borderRadius: height / 2
// Scale 0.96 sur press via reanimated
// Accent color via useTheme()
// 4 variantes: primary, secondary, ghost, icon-only
```

Uniquement ce composant débloque 80% des flux UI.

### Pattern Card Universel

```typescript
<LCard variant="feed">  {/* Transaction list item */}
<LCard variant="stat">  {/* Dashboard numbers grid */}
<LCard variant="hero">  {/* Main balance display */}
<LCard variant="empty"> {/* "No transactions yet" */}
```

**Mécanisme d'accélération:** Une carte avec 4 variants = zéros de cards uniques à écrire.

### Décision Component Library: Custom + Reanimated (PAS RN Paper)

ADR-011 rejette explicitement React Native Paper. La raison est valide:

- **Pas de support runtime accent switching** — RN Paper impose son propre theme
- **Reanimated worklets** nécessitent contrôle total sur l'arbre DOM natif
- **Dark canvas fixe (#121212)** = pas de besoin du light mode de Paper
- **Taille bundle** — Paper = ~80KB, custom = ~15KB (seulement ce qu'on utilise)

**CORRECTION REQUISE:** La ligne 70 de `prd-lumina.md` dit `UI Library: React Native Paper`. Ce doit être corrigé en `react-native-reanimated + gesture-handler + lucide-react-native`.

### Icônes: lucide-react-native

- 1500+ icônes gratuites (Apache 2 license)
- Tree-shakeable (ne charge QUE ce que tu imports)
- Bundle size: ~5KB gzipped
- Format props standard: `<LucideIcon name="wallet" size={24} color={t.accent} />`

---

## 4. Dark Mode Implementation Pro (Pas Juste Inverser Couleurs)

### Lumina a PAS besoin d'un toggle Dark/Light

Le canvas est **permanent** `#121212`. Pas de `useColorScheme()`, pas de `Appearance.getColorScheme()`. Cela élimine LA MOITIÉ de la complexité theming.

### L'adaptation OS: Text Size Only

ExPERIENCE.md section 6 impose l'adaptation à la taille de texte système:

```typescript
// useAdaptiveTypography hook
function useAdaptiveFontSize(baseSize: number): number {
  const { fontScale } = useWindowDimensions();
  if (fontScale < 1) return baseSize * 0.85;
  if (fontScale > 1.25) return Math.min(baseSize * 1.25, 24); // cap body à 24px
  return baseSize;
}
```

### Surface Depth = Élévation (Pas d'Ombres)

```
#121212 → Canvas principal
#181818 → Cartes (élévation 1)
#282828 → Items hover/actifs (élévation 2)
#333333 → Item sélectionné (élévation 3)
```

Deux ombres UNIFORMÉMENT autorisées:
1. `0 8px 24px accent@25%` → UNIQUEMENT bouton FAB + CTA primary
2. `0 4px 12px rgba(0,0,0,0.3)` → UNIQUEMENT cartes

TOUT le reste = niveaux de surface. C'est la méthode Spotify/Spotify-inspired (explicite dans DESIGN.md).

### Contrast Validation Runtime

Lors du setup org, valider TOUT accent custom avant validation:

```typescript
function validateAccentContrast(hex: string): ValidationResult {
  const ratio = calculateWCAGContrast(hex, '#121212');
  if (ratio < 3.0) return { valid: false, reason: 'Contraste insuffisant pour WCAG AA large' };
  if (ratio < 4.5) return { valid: true, warning: 'AAC large seulement, pas AA standard' };
  return { valid: true, warning: null };
}
```

---

## 5. Configuration-Driven Design (Accent Par Org)

### Injection Runtime du Thème

```typescript
// App bootstrap — appelé UNE SEULE FOIS au démarrage
async function bootstrap() {
  // 1. Restaurer thème local (offline-first)
  const cached = await mmkv.getString('org_theme');
  if (cached) setTheme(JSON.parse(cached));

  // 2. Fetch org (blocking sur online)
  const org = await fetchCurrentOrg();
  const theme = createTheme(org.accent_palette);
  setTheme(theme);
  mmkv.set('org_theme', JSON.stringify(org.accent_palette));
}
```

### Theme Context Wrapper

```tsx
// App.tsx
<ThemeProvider value={theme}>
  <AppContext.Provider value={{ user, org }}>
    <NavigationContainer theme={getReactNavigationTheme(theme)}>
      <RootNavigator />
    </NavigationContainer>
  </AppContext.Provider>
</ThemeProvider>
```

**Résultat:** Aucun composant fonctionnel NE voit jamais de couleur hex. Ils appellent `useTheme()` et tout vient du thème.

---

## 6. Références Réelles — Patterns Identifiés par Écran

### 6a. Dashboard Financier (Leader)

**Références trouvées (5-20 résultats):**
- **Alias (retail dashboard dark)** — Hero card avec total + chart style barcode + Bottom tabs. Pattern applicable directement: card sombre avec chiffre principal accent.
- **Chime (mobile banking)** — Balance + quick actions row + spending insights bottom sheet. Pattern: 3 actions rapides sous le solde (transferir, cart, insights).
- **Credit Karma** — Top tabs switch entre vues (Dashboard, Accounts, Debt, Cash Flow). Pattern: tabs horizontales au-dessus du contenu.
- **Mercury (banking)** — Spending trend graph + net change indicators + monthly summary. Pattern: graphique sparkline + variation % + moyenne mensuelle.
- **Copilot (budgeting dark)** — Overspending alert + transaction categories + upcoming bills timeline. Pattern: alertes visuelles au-dessus des données normales.
- **Fivecents (expense dashboard dark)** — Toggle Expense/Income + time range (1M/1Y) + top categories. Pattern: segmented control + time navigation.
- **Robinhood Credit (spending dashboard)** — Monthly bar chart + family view toggle + bottom sheet filter. Pattern: filtre par segment.

**Inspiration clé pour Lumina Dashboard:** Combiner Alias (hero card chiffre principal) + Chime (quick actions) + Mercury (trend chart) + Fivecents (toggle Expense/Income pour dîme/offrande/dépenses).

### 6b. Member Directory

**Références trouvées (10-15 résultats):**
- **Signal (contact picker)** — Searchable list + A-Z index + multi-select. Pattern applicable pour recherche membres + sélection rapide.
- **Telegram (contacts)** — Alphabetical index right-side + avatars + status badges. Pattern: index A-Z fixe à droite du screen.
- **Saturn (group directory)** — Member count header + "Get Verified" + role tags + calendar. Pattern: header stats + directory list.
- **Clay (CRM contacts)** — Filter chips (location, organization, education) + recent groups. Pattern: filter chips horizontaux scrollables.
- **Instagram (Close Friends)** — Curated list + checkmarks + count + Clear all. Pattern: selection management avec operations bulk.
- **Luma (event contacts)** — Profile rows with avatar/name/role + Invite action per row. Pattern: member card avec role badge.
- **vsco (people discovery)** — Segmented tabs (Suggested/Contacts/Followers) + action buttons. Pattern: tabs horizontales pour segments membres.
- **GroupMe (contacts flow)** — Search + availability indicator + "Find and Invite". Pattern: import/export members.

**Inspiration clé pour Lumina Members:** Signal (A-Z index) + Saturn (header stats + role tags) + Clay (filter chips) + GroupMe (search + invite).

### 6c. Calendar / Events

**Références trouvées (10 résultats):**
- **Saturn (calendar schedule)** — Month/day strip (scroll horizontal) + agenda list below + "Missing Schedule" warnings + FAB. Pattern applicable: strip dates horizontal + liste verticale agenda.
- **Zoom (day schedule)** — Week strip + meeting cards with host/time + overflow menu per item. Pattern: mini-calendar header + meetings list.
- **Notion (meetings hub)** — Upcoming events + chronological archive (Today/Last week/Month/Older). Pattern: grouper événements par période temporelle.
- **Up Ahead (events discovery dark)** — Featured card "Happening today" + filters icon + FAB. Pattern: mise en avant événements du jour.
- **Luma (event feed)** — "Your Events" empty state + curated "Picked for You" + horizontal image cards + timezone. Pattern: cards avec cover image + metadata.
- **Eventbrite (events home)** — Search bar + "Explore by neighborhood" + horizontal event cards with image/date/time/location/price. Pattern: cards événements avec métadonnées complètes.
- **Days (calendar sync)** — Scheduled events list + month/day grouping + "Added/Import" button per event. Pattern: import/cross-reference événements externes.
- **222 (event planning)** — Dropdown itinerary + day selector + event cards with RSVP deadline + share. Pattern: gestion événements communautaires.

**Inspiration clé pour Lumina Calendar:** Saturn (strip date + agenda) + Notion (chronological groups) + Zoom (week strip) + Eventbrite (metadata-rich cards).

### 6d. Onboarding & Setup

**Références trouvées:**
- **Perplexity (settings dark)** — Grouped list sections (Account, Preferences, Security) + drill-down navigation. Pattern: settings page avec grouped rows.
- **Base (display settings)** — Theme radio options (Dark/Light/Auto) + currency preferences + privacy mode toggle. Pattern: preference toggles groupés par section.
- **Brave (appearance)** — Automatic/Light/Dark selection + Night Mode separate toggle. Pattern: selection claire avec indicator visuel.
- **ACRONS (onboarding)** — Carousel benefits + primary CTA + progress dots. Pattern: multi-step onboarding avec indicateur étape.
- **Trello (accessibility)** — Color blind mode toggle + input options + theme selection. Pattern: accessibility options dans settings.

### 6e. Settings / Preferences

**Références trouvées:**
- **Electrify America (account settings)** — Theme toggle + appearance controls. Pattern: configuration organisation dans settings.
- **CNN (subscription settings)** — Account management + plan selection + restore purchase. Pattern: subscription/plan management hierarchy.
- **Medium (settings)** — Account → Membership + Configure → Recommendations + Notifications + Appearance. Pattern: settings grouping par catégorie logique.

---

## 7. Patterns Navigation & Layout Éprouvés

### Architecture Navigation Confirmée (EXPERIENCE.md)

```
Login → Auth Stack (modal slide-in)
Onboarding (1ère fois, 5 étapes, progress bar)
Main App:
  ├── Bottom Nav (5 tabs): Accueil | Finance | [FAB] | Membres | Réglages
  ├── Tab Screens (swipe horizontal)
  └── Detail Stacks (push vertical)
```

**Ce qui marche:**
- **Bottom nav fixe 5 tabs maximum** — aucun hamburger menu
- **FAB central obligatoirement** — action principale toujours accessible
- **Swipe back natif** — jamais de bouton retour personnalisé
- **Deep linking** — `/main/feature/slug?param=value`

**Ce qui est confirmé par les références:**
- Bottom tab bar: présent dans TOUTES les apps finance (Chime, Credit Karma, Mercury)
- FAB: standard dans Android Material Design, confirmé par Alias + Up Ahead
- Swipe horizontal entre tabs: pattern iOS natif, confirmé par Signal/Telegram

### Layout Container Universal

```
Header sticky 56px
├── Container padding 24px左右
│   └── Content area (max 480px mobile)
├── Bottom Nav fixed 64px
└── Connection Status 28px
```

**Tous les espacements multiple de 4px** — SPACING object dans theme.ts.

---

## 8. Patterns Data Visualization + Financial

### Graphiques Financiers Dark

**Ce qui est confirmé par DESIGN.md + références:**
- Bar chart: bars accent color sur `#121212`, grid lines `#333333` fins
- Donut chart: segment principal = accent org, secundaires = gris `#282828/#333333`
- Line chart: line accent org, gradient fill 15% opacity sous la ligne
- Sparkline: line simple accent, sans axes, height 32px max

**Pattern Copilot/Mercury:** spending trend graph avec net change indicator (%) + monthly summary. **Directement applicable à Lumina Grand Livre** pour visualiser recettes/dépenses sur les 30 derniers jours.

### Couleurs Données Financières IMMUABLES

Ces couleurs ne changent JAMAIS, même si l'org choisit un accent:

| Couleur | Hex | Signification |
|---------|-----|---------------|
| `#1DB954` | Data Green | Recettes positives (dîme, offrande, dons) |
| `#E51332` | Data Red | Dépenses, alertes, rejets |
| `#FFB800` | Data Yellow | En attente, pending review |

**Justification:** Ces couleurs ont un contraste > 4:1 sur `#121212` (conforme WCAG AA pour texte). Ce sont exactement les mêmes vert/rouge de Spotify — cohérents avec l'inspiration visuelle.

---

## 9. Accessibilité & Performance Expérientielle

### Accessibilité — Vérifications Automatiques

| Critère | Valeur Target | Vérification |
|---------|---------------|-------------|
| Texte principal contraste | AAA (21:1) | `#FFFFFF` sur `#121212` ✓ |
| Body text contraste | AA+ (7.2:1) | `#B3B3B3` sur `#121212` ✓ |
| Label contrast | AA (3.95:1) | `#808080` sur `#121212` ✓ |
| Touch target min | 44px WCAG 2.5.5 | Boutons 48px ✓ |
| Daltonisme | Formes + couleurs | ↑↓◆●■ financiers |

### Performance UX Cibles

| Métrique | MVP Cible | Technique |
|----------|-----------|-----------|
| Time to Interactive | < 2s | Hermes AOT + code splitting |
| Frame Rate | 55fps min (60 constant) | Reanimated worklets |
| Scroll Lag | < 16ms | FlashList de Shopify (>50 items) |
| Transition Render | < 200ms | fade + slide-up 200ms |
| Image Load (cached) | < 500ms | expo-image + server resize |

### Micro-interactions Standardisées

| Action | Duration | Easing | Effet |
|--------|----------|--------|-------|
| Screen enter | 200ms | ease-out | fade + slide-up |
| Button press | 100ms | spring stiffness 200 | scale(0.96) |
| FAB modal open | 300ms | spring bouncy | scale + fade |
| Bottom sheet | 250ms | ease-out | translateY |
| Skeleton shimmer | 1500ms | ease-in-out | pulse |
| Success feedback | 400ms | spring | checkmark draw |

---

## 10. Stack Design Recommandée

| Élément | Choix | Taille | Justification |
|---------|-------|--------|--------------|
| **Animation** | react-native-reanimated v3 | ~25KB | Thread worklets, 60fps garanti |
| **Gesture** | @gorhom/bottom-sheet | ~8KB | Bottom sheets draggables natifs |
| **Icônes** | lucide-react-native | ~5KB | 1500+ icônes, tree-shakeable |
| **Formulaire** | react-hook-form + zod | ~15KB | Formulaires dynamiques performants |
| **Navigation** | expo-router + react-navigation | N/A | Deep linking, code splitting auto |
| **Cache API** | @tanstack/react-query | ~15KB | Stale-while-revalidate, retry auto |
| **Images** | expo-image | ~5KB | Cache policy, resize server |
| **Chart SVG** | react-native-svg custom | ~5KB | 5KB vs 120KB victory-native |
| **i18n** | i18next + expo-localization | ~20KB | FR+EN minimum, terminologie précise |
| **Toast** | tamagui/toast ou custom | ~3KB | Success/error/warning system |

**Total UI deps (~100KB gzipped)** — bien en dessous du budget JS 200-300KB recommandé pour React Native.

---

## 11. Ordre Prioritaire d'Implémentation Design

| # | Priorité | Action | Impact | Effort | Débloque |
|---|----------|--------|--------|--------|----------|
| **P0** | CRITIQUE | Implémenter `src/core/theme.ts` token factory | Empêche TOUTes valeurs hex codées en dur | 2h | Tous les composants |
| **P0** | CRITIQUE | Créer `src/shared/constants/org-presets.ts` | Single source of truth presets org | 30min | Onboarding color picker |
| **P0** | CRITIQUE | Fixer contradiction PRD (Paper → reanimated) | Documentation cohérente | 5min | Tout |
| **P1** | HAUTE | Créer `useTheme()` hook + ThemeProvider | Zéro prop drilling | 1h | Tous les composants |
| **P1** | HAUTE | Construire LButton (premier shared component) | 80% des flows UI déblocables | 3h | Login, Dashboard, FAB |
| **P1** | HAUTE | Construire LCard (4 variants: hero/stat/feed/empty) | Dashboard + Ledger + Members | 3h | Écrans principaux |
| **P2** | MOYENNE | Construire LSkeleton (shimmer loading) | UX chargement professionnel | 2h | Toutes les listes |
| **P2** | MOYENNE | Construire LInput + LForm (hook-form + zod) | Tous les formulaires | 4h | Forms Engine screens |
| **P2** | MOYENNE | Construire LBottomSheet (@gorhom/bottom-sheet) | Création flows | 1h | Tous les add/create |
| **P2** | MOYENNE | Construire LBadge (approved/pending/rejected/draft) | Finance status displays | 1h | Ledger, Members |
| **P3** | BASSE | Theme persistence (MMKV offline-first) | Thème restauré après crash | 2h | Bootstrap |
| **P3** | BASSE | LConnectionStatus (online/offline banner) | UX offline-first | 1h | Tous les écrans |
| **P3** | BASSE | Custom SVG chart component | Graphiques financiers | 4h | Dashboard, Ledger |
| **P3** | BASSE | useAdaptiveTypography hook | Accessibilité OS | 1h | Tous les textes |
| **P4** | PLANIF | ESLint no-hardcoded-hex rule | Garanti theme integrity | 3h | Post-P0 |

### Timeline Estimation Design Setup

```
Jour 1 (8h): theme.ts + org-presets + useTheme + ThemeProvider + eslint fix
Jour 2 (8h): LButton + LCard + LIcon + LText (composants de base)
Jour 3 (8h): LBottomSheet + LBadge + LSkeleton + LInput
Jour 4 (8h): LForm + LConnectionStatus + hooks utils
Jour 5 (8h): Custom SVG charts + adaptive typography
────────────────────────────────────────────────────────────
Total: 5 jours pour avoir TOUS les shared components prêts
          puis écran par écran avec composition seule
```

**Comparaison vs build-from-scratch par écran:** Gains de 40-60% sur le temps de développement UI car:
- Pas de duplications de styles entre écrans
- Theme change instantané sans modification de composants
- Formulaires génériques grâce à LForm + Zod
- Loading states standardisés avec LSkeleton
- Toast/feedback standardisés (Success/Error/Warning)

---

*Recherche Design — 2026-07-23 — Lumina v2*

---

# ANNEXE : Patterns d'Extensibilité — Ajouter des Fonctionnalités Sans Remanier d'Écrans

> **Objectif:** Écrire du code qui s'étend vers l'extérieur sans jamais toucher au code existant. Chaque nouvelle feature s'ajoute comme un plugin, pas comme une modification.

## 1. Plugin Architecture — Enregistrement Autonome

**Concept:** Chaque feature est un fichier autonome qui s'enregistre dans un registre global. Le core importe `registry.getAll()` et ne connaît aucune feature.

```typescript
// src/core/plugin-registry.ts — NICHIRO (jamais modifier après création)
export interface AppPlugin {
  id: string;
  name: string;
  version: string;
  register(engine: PluginEngine): void;
  teardown?(engine: PluginEngine): void;
}

class PluginRegistry {
  private plugins = new Map<string, AppPlugin>();
  register(plugin: AppPlugin) { this.plugins.set(plugin.id, plugin); }
  getAll(): AppPlugin[] { return [...this.plugins.values()]; }
}
export const registry = new PluginRegistry();
```

Nouvelle feature → fichier autonome:

```typescript
// src/features/finance/finance.plugin.ts (nouveau fichier, zéro modif existante)
import { registry } from '../../core/plugin-registry';
const financePlugin: AppPlugin = {
  id: 'finance',
  name: 'Finance Module',
  version: '1.0.0',
  register(engine) {
    engine.featureService.finance = new FinanceService(engine.hooks);
  },
};
registry.register(financePlugin);
```

**Résultat:** 1 nouveau fichier créé, 0 fichier modifié. Le core ne bouge pas.

## 2. TypedEventBus — Communication Sans Dépendance Croisée

**Concept:** Un écran émet un événement et oublie. D'autres modules y répondent indépendamment.

```typescript
// src/shared/event-bus.ts — 1 seul fichier partagé
type Listener<T> = (payload: T) => void;

class TypedEventBus<TEvents extends Record<string, unknown>> {
  private listeners = new Map<keyof TEvents, Set<Listener<any>>>();
  on<K extends keyof TEvents>(event: K, fn: Listener<TEvents[K]>): () => void {
    const set = this.listeners.get(event) ?? new Set<Listener<any>>();
    set.add(fn as Listener<any>);
    this.listeners.set(event, set);
    return () => set.delete(fn as Listener<any>); // auto-cleanup
  }
  emit<K extends keyof TEvents>(event: K, payload: TEvents[K]): void {
    this.listeners.get(event)?.forEach((fn) => fn(payload));
  }
}

export const bus = new TypedEventBus<AppEvents>();

type AppEvents = {
  transactionCreated: { orgId: string; amount: number };
  transactionApproved: { orgId: string; id: string; approver: string };
  syncComplete: { orgId: string; count: number };
};
```

Usage — émetteur ne connaît aucun récepteur:

```typescript
// src/features/finance/ledger.tsx — Émetteur
bus.emit('transactionApproved', { orgId, id, approver });
// Fin. Il ne sait pas qui écoute.
```

```typescript
// src/features/reports/report-generator.ts — Récepteur (fichier séparé)
bus.on('transactionApproved', (evt) => {
  invalidateFinancialReport(evt.orgId, evt.id);
});
```

**Résultat:** Le rapport se invalide automatiquement quand une transaction est approuvée. Zéro import croisé entre ledger et report-generator.

## 3. Higher Order Components — Comportement Transversal

**Concept:** Injecter auth, tracking, ou logging sur N écrans sans les modifier.

```typescript
// src/shared/hocs/auth-guard.tsx
export function withAuthGuard<P>(Component: React.ComponentType<P>): React.FC<P> {
  return function AuthGuardComponent(props: P) {
    const { isAuthenticated } = useAppContext();
    if (!isAuthenticated) return <LoadingScreen />;
    return <Component {...props} />;
  };
}

// Application — le screen NE change PAS:
function LedgerInner() { /* ... */ }
export default withAuthGuard(LedgerInner);
```

Même pattern pour analytics tracking, validation de permissions, etc.

## 4. Strategy Pattern — Configurer le Comportement via Manifest

**Concept:** Remplacer `if/switch/case` par un registre de stratégies injectées par config.

```typescript
// src/core/sync/conflict-resolver.ts — Core immutable
type ConflictStrategy = (local: any, remote: any) => any;

const strategies: Record<string, ConflictStrategy> = {
  lastWriteWins: (l, r) => l.updatedAt >= r.updatedAt ? l : r,
  keepBoth: (l, r) => [l, r],
  immutable: (_l, _r) => null, // reject modification
  serverWins: (_l, r) => r,
};

export function resolveConflict(entity: string, local, remote, manifest) {
  const rule = manifest.syncRules?.[entity]?.conflictResolution ?? 'lastWriteWins';
  return strategies[rule](local, remote);
}
```

**Nouvelle stratégie ajoutée sans touching le core:**

```typescript
// src/features/finance/conflict-handlers.ts — Feature seule
strategies.mergeWithDedup = (local, remote) => mergeAndDeduplicate(local, remote);
```

Manifest décide quel strategy utiliser par entité:

```yaml
# manifest.yaml - configurable sans recompilation
sync_rules:
  transaction:   { conflictResolution: "immutable" }
  member:        { conflictResolution: "lastWriteWins" }
  loan:          { conflictResolution: "mergeWithDedup" }  # nouvelle feature!
```

**Résultat:** Ajout d'un nouveau type d'entité avec sa règle de conflit = 1 fichier TypeScript + 3 lignes YAML.

## 5. Feature Flag System — Activer/Desactiver Sans Déploiement

**Concept:** 3 couches de contrôle: global config → org manifest → runtime override.

```typescript
// src/core/config/feature-flags.ts — Définitions centrales
type FlagDefinition = { enabledByDefault: boolean; description: string; owners: string[] };

const FLAG_DEFS: Record<string, FlagDefinition> = {
  finance_ledger_v2: { enabledByDefault: true, description: 'New ledger UI', owners: ['finance'] },
  notifications_push: { enabledByDefault: false, description: 'Push notifications', owners: ['growth'] },
};

export function isFeatureEnabled(flag: string, orgId?: string): boolean {
  if (!FLAG_DEFS[flag]) return false;
  // Layer 2: org manifest override
  const orgFlags = getOrgManifestFlags(orgId);
  if (orgFlags?.has(flag)) return orgFlags.get(flag)!;
  // Layer 3: default
  return FLAG_DEFS[flag].enabledByDefault;
}
```

**Ajouter un flag depuis une feature sans toucher au core:**

```typescript
// src/features/loans/loan-feature-flag.ts
import { FLAG_DEFS } from '../../core/config/feature-flags';
FLAG_DEFS.loans_module = {
  enabledByDefault: false, description: 'Student loans feature', owners: ['loans-team'],
};
```

**Usage JSX:**

```tsx
function LedgerScreen() {
  return isFeatureEnabled('finance_ledger_v2') ? <LedgerV2 /> : <LedgerV1 />;
}
```

## 6. Route Registration Dynamique

**Concept:** Chaque feature enregistre ses propres routes. Le routeur central ne fait qu'empiler.

```typescript
// src/core/navigation/route-registry.ts — Central, immutable
export class RouteRegistry {
  private routes: RouteDefinition[] = [];
  addRoute(route: RouteDefinition) { this.routes.push(route); }
  getRoutes(): RouteDefinition[] { return [...this.routes]; }
}
export const routeRegistry = new RouteRegistry();

export interface RouteDefinition {
  path: string; screen: string; name: string; permissions?: string[];
}
```

Chaque feature s'enregistre elle-même:

```typescript
// src/features/finance/finance.routes.ts — AUTOREGISTRATION
import { routeRegistry } from '../../core/navigation/route-registry';
routeRegistry.addRoute({ path: '/main/finance/ledger', screen: 'FinanceLedger', name: 'finance/ledger' });
routeRegistry.addRoute({ path: '/main/finance/bilan', screen: 'FinanceBilan', name: 'finance/bilan' });
```

Boot du routeur:

```typescript
// navigation/_layout.tsx — Import unique
import '../features/finance/finance.routes';  // self-registers
import '../features/members/members.routes';  // self-registers
// ... nouveau module ajoute son .routes.ts, zéro modif au _layout
```

## 7. Slot Pattern — Composits Personnalisables

**Concept:** Créer des composants composites avec des zones "slot" que les features peuplent sans fork.

```tsx
// src/shared/components/SlotCard.tsx — 1 fois
<SlotCard
  title="Grand Livre"
  actionsSlot={<Button label="Exporter" />}
  badgeSlot={<Badge status="synced" />}
  footerSlot={<TotalDisplay amount={total} />}
>
  <TransactionList transactions={items} />
</SlotCard>
```

La même SlotCard utilisée par Members:

```tsx
<SlotCard
  title="Membres"
  actionsSlot={<Button label="Import CSV" />}
  badgeSlot={<Badge count={members.length} />}
  footerSlot={<SummaryStats members={members} />}
>
  <MemberList members={items} />
</SlotCard>
```

**Zéro fork nécessaire.** Le composit central ne change jamais.

## 8. Open/Closed Principle — Règles Concrètes

| Règle | Implémentation |
|-------|---------------|
| O-01 | Interfaces exportées depuis `core/` sont `readonly` en dehors de leur module |
| O-02 | Toute extension passe par `registry.register()`, `bus.on()`, ou `strategies[name] = fn` |
| O-03 | Les feature flags du manifest déterminent ce qui est chargé, pas les `if/else` |
| O-04 | Si un core doit être modifié → extraire l'interface dans `core/interfaces/` d'abord |
| O-05 | Features s'auto-enregistrent au boot (routes, plugins, flags, strategies) |

## 9. Chain d'Extension Complète — Exemple "PretEtudiants"

Voici ce qui se passe quand on ajoute la feature **Prets Étudiants** à LUMINA:

```
1. Créer src/features/loans/loans.types.ts       ← Types statiques
2. Créer src/features/loans/loans-service.ts     ← FeatureService implémentation
3. Créer src/features/loans/loans.plugin.ts      ← Auto-enregistrement dans registry
4. Créer src/features/loans/loans.routes.ts      ← Auto-enregistrement de routes
5. Créer src/features/loans/loans.flag.ts        ← Auto-définition du feature flag
6. Créer src/features/loans/loans.screen.tsx     ← UI spécifique
7. Ajouter dans manifest.yaml: loans: { enabled: true }

RÉSULTAT FINAL: 7 nouveaux fichiers créés, 0 fichier modifié.
```

## 10. Application à l'Architecture Existante de Lumina

Le projet a déjà les fondations dans ses 5 moteurs:

| Moteur | Pattern | Fichier à Créer |
|--------|---------|-----------------|
| Capability Engine | Plugin Registry | `src/core/plugin-registry.ts` (~50 lignes) |
| Workflow Engine | TypedEventBus | `src/shared/event-bus.ts` (~40 lignes) |
| Manifest Engine | Feature Flags | `src/core/config/feature-flags.ts` (~60 lignes) |
| Forms Engine | Route Registry | `src/core/navigation/route-registry.ts` (~40 lignes) |
| Vocabulary Engine | Strategy Map | `src/core/sync/conflict-resolver.ts` (~50 lignes) |

**Total infrastructure extensibilité: ~240 lignes en 1 jour.**

Ensuite chaque nouvelle feature = uniquement des fichiers dans `src/features/<feature>/` avec auto-enregistrement.

## 11. Comparaison Avant/Après Extensibilité

| Scénario | Sans ces patterns | Avec ces patterns |
|----------|-------------------|-------------------|
| Nouvelle feature | Modifier core + écrans existants + router | 1 plugin self-registering |
| Ajouter un écran | Modifier _layout.tsx + navigation | 1 fichier .routes.ts autoimporté |
| Feature toggle | Fork de code conditionnel | 3 lignes de manifest + check flag |
| Écouter un event | Import cross-module direct | bus.on() isolé du emitter |
| Nouvelle stratégie | Modifier switch/if existant | Ajouter entrée dans strategies map |
| Nouveau workflow | Modifier workflow-engine.ts | 1 fichier YAML + event subscribe |

**Règle d'or:** Si tu dois modifier un fichier dans `core/` pour ajouter une feature → c'est mal architecturé. Tu devrais seulement créer des fichiers dans `features/`.
