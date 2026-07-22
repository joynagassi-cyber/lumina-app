# DESIGN — Plateforme Universelle d'Organisation Lumina v2

> **Document : DESIGN GUIDELINES**  
> Créé le 2026-07-22 par WDS Designer (Freya)  
> Projet : Lumina — Plateforme Universelle d'Organisation  
> Aligné avec ADR-005 (Stack), ADR-011 (Design System Dark Canvas), `design-system/INDEX.md`

---

## Table des Matières

1. [Philosophie Visuelle](#1-philosophie-visuelle)
2. [Thème : Toile Sombre "Dark Canvas"](#2-thème-toile-sombre-dark-canvas)
3. [Palette de Couleurs par Organisation](#3-palette-de-couleurs-par-organisation)
4. [Couleurs Universelles](#4-couleurs-universelles)
5. [Typographie](#5-typographie)
6. [Layout & Espacement](#6-layout--espacement)
7. [Composants UI](#7-composants-ui)
8. [Accessibilité & Contraste WCAG](#8-accessibilité--contraste-wcag)
9. [Responsive Design](#9-responsive-design)
10. [Animation & Micro-interactions](#10-animation--micro-interactions)
11. [Data Visualization](#11-data-visualization)
12. [Règles de Validation Design](#12-règles-de-validation-design)
13. [Implémentation Technique](#13-implémentation-technique)

---

## 1. Philosophie Visuelle

### Concept Central : "Toile Sombre, Accent Vif"

Lumina utilise un principe en trois couches :

```
TOILE   → Fond noir profond (#121212) — universel, immuable
PINTURE → Données financières — toujours vert/rouge/jaune, immuables
BRUSH → Accent organisation — configurable, vivant, identitaire
```

La toile sombre (#121212) est un canvas universel qui ne change jamais — c'est la base commune à toutes les organisations du monde. L'accent (la "peinture") se dépose dynamiquement selon l'identité de chaque org. Ce principe crée une expérience cohérente au sein d'une même org tout en permettant une forte personnalisation entre orgs différentes.

### Principes de Design Non-Négociables

1. **Noir profond jamais blanc** — Jamais de fond #FFFFFF ou de surfaces claires. Le canvas est `#121212`.
2. **Un seul accent** — Une seule couleur d'accent par org à la fois. Pas de mélange d'accents.
3. **Pas de gradients** — Couleurs solides uniquement. Pas de dégradés ni de lumières colorées.
4. **Espacement > Décoration** — La hiérarchie visuelle vient de l'espacement généreux, pas des bordures.
5. **Données financières stables** — Vert/Rouge/Jaune des données financières sont constants quel que soit l'accent de l'org.
6. **Typographie bold** — Les titres en weight 700 minimum. Jamais light ou regular pour les headings.

> **Référence :** Ces principes sont codifiés dans ADR-011 et `design-system/INDEX.md`.

---

## 2. Thème : Toile Sombre "Dark Canvas"

### Pourquoi un Fond Noir Profond ?

Le choix du fond `#121212` (pas #000000 pur) répond à plusieurs objectifs :

- **Confort visuel** : Le noir pur crée une vibration excessive avec le texte blanc sur OLED. `#121212` élimine ce phénomène (pratique de Spotify).
- **Profondeur par surfaces** : Les cartes (`#181818`) et éléments interactifs (`#282828`, `#333333`) créent de la profondeur sans ombres ni bordures.
- **Consommation batterie** : Sur écrans OLED, les pixels noirs sont éteints → économie d'énergie significative.
- **Concentration financière** : Un fond sombre réduit la fatigue visuelle lors de sessions prolongées de consultation de bilans.

### Palette de Base (Fixe)

| Nom | Hex | Surface | Usage |
|-----|-----|---------|-------|
| `bg` | `#121212` | Canvas | Background principal (toujours) |
| `surface` | `#181818` | Surface base | Cartes, zones de contenu |
| `surfaceHover` | `#282828` | Surface hover | Élément au survol |
| `surfaceActive` | `#333333` | Surface active | Élément sélectionné/actif |

Chaque niveau de surface diffère de 0.3-0.5 log unités de luminosité, créant une profondeur subtile mais perceptible.

### Ombres

Seulement deux ombres existent dans le système :

```css
.shadow-fire {
  box-shadow: 0 8px 24px rgba(ACCENT_HEX, 0.25);
}
/* Utilisée UNIQUEMENT pour l'accent primary */

.shadow-card {
  box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
/* Utilisée pour les cartes — toujours noire */
```

Pas d'ombres colorées pour autre chose que le bouton/élément avec l'accent de l'org.

---

## 3. Palette de Couleurs par Organisation

### Presets par Type d'Organisation

| Type | Preset | Accent Primary | Accent Light (+30%) | Accent Dark (-30%) | Psychologie |
|------|--------|----------------|--------------------|--------------------|-------------|
| 🏛️ Église | Fire Orange | `#FF6B00` | `#FF8533` | `#CC5500` | Chaleur, énergie spirituelle, action |
| 🎓 École | Education Teal | `#00A896` | `#00D4B6` | `#007F72` | Croissance, apprentissage, stabilité |
| 🌍 ONG | NGO Green | `#4CAF50` | `#81C784` | `#388E3C` | Nature, confiance, impact social |
| 🏢 Entreprise | Corporate Blue | `#2196F3` | `#64B5F6` | `#1976D2` | Professionnalisme, fiabilité, technologie |
| ⚖️ Institutionnel | Inst Indigo | `#3F51B5` | `#7986CB` | `#303F9F` | Autorité, solennité, gouvernance |
| ✨ Custom | Hex libre | Auto-calculé | Auto-calculé | Auto-calculé | Contrôle total utilisateur |

### Mécanisme de Calcul Dynamique

Quand l'utilisateur choisit une couleur custom via le Color Picker (`/main/org/setup`), le système calcule automatiquement les variants :

```typescript
function calculateAccentVariants(hex: string): AccentPalette {
  const hsl = hexToHSL(hex);

  // Light variant : augment luminance de 30%
  const light = HSLtoHex({ ...hsl, l: Math.min(85, hsl.l + 30) });

  // Dark variant : diminuer luminance de 30%
  const dark = HSLtoHex({ ...hsl, l: Math.max(15, hsl.l - 30) });

  return { primary: hex, light, dark };
}
```

### Validation de Couleur

Au moment du setup, chaque couleur d'accent est validée :
- **Ratio de contraste minimum** ≥ 3:1 sur `#121212` (WCAG AA large text)
- Si < 3:1 → l'utilisateur est alerté et doit choisir une couleur différente OU modifier la saturation/luminance
- Les accents avec saturation trop faible (< 20%) sont également rejetés (risque d'être imperceptibles)

> **Référence :** Scénario #07 dans `design-system/SCENARIOS-UX.md`.

---

## 4. Couleurs Universelles

### Données Financières (Toujours Constantes)

Ces couleurs ne changent JAMAIS, quel que soit l'accent de l'org :

| État | Hex | Signification |
|------|-----|---------------|
| `dataGreen` | `#1DB954` | Recettes positives, revenus |
| `dataRed` | `#E51332` | Dépenses, alertes, rejets |
| `dataYellow` | `#FFB800` | En attente, pending, review |

**Pourquoi ces valeurs précises ?**
- `#1DB954` et `#E51332` sont choisis pour leur visibilité optimale sur fond `#121212`
- Ces couleurs ont un contraste > 4:1 sur le fond noir (conforme WCAG AA pour texte normal)
- Ce sont aussi les verts/rouges de Spotify — cohérents avec l'inspiration visuelle

### Texte (Toujours Constant)

| Rôle | Hex | Ratio sur #121212 | Usage |
|------|-----|-------------------|-------|
| `textPrimary` | `#FFFFFF` | 21:1 (AAA) | Titres, nombres importants |
| `textSecondary` | `#B3B3B3` | 7.2:1 (AA+) | Body text, paragraphes |
| `textTertiary` | `#808080` | 3.95:1 (AA) | Labels, metadata |
| `textPlaceholder` | `#535353` | 1.95:1 (N/A) | Placeholders, disabled |

> Note : Le texte principal doit TOUJOURS être blanc pur pour un contraste maximal. Le gris `#B3B3B3` est le standard de confort pour le body text (réduit la fatigue visuelle vs blanc pur).

---

## 5. Typographie

### Hiérarchie (Fixe)

| Rôle | Taille | Weight | Line Height | Usage |
|------|--------|--------|-------------|-------|
| Hero Number | 48px | 800 (Bold) | 1.1 | Solde principal, chiffres clés |
| H1 | 32px | 700 (Bold) | 1.2 | Titres de page |
| H2 | 24px | 700 (Bold) | 1.3 | Sections de page |
| H3 | 18px | 700 (Bold) | 1.4 | Titres de carte, sections secondaires |
| Body | 14px | 400 (Regular) | 1.6 | Texte courant |
| Small | 12px | 400 (Regular) | 1.5 | Metadata, timestamps |
| Caption | 11px | 500 (Medium) | 1.4 | Labels de boutons, badges |

### Font Family

```css
font-family: 'Circular', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

- **Circular** : Police de Spotify (premium) — utilisée si disponible via license
- **Inter** : Fallback premium open-source — optimisé pour les écrans, lisibilité excellente en petit
- **-apple-system / Segoe UI** : Fallback natif OS

### Règles Typographiques

1. **Jamais de title case** — Utiliser sentence case pour tous les textes (ex: "Transaction approved" et non "Transaction Approved")
2. **Les chiffres utilisent Tabular Numbers** — `font-variant-numeric: tabular-nums` pour alignement parfait des colonnes de nombres
3. **Taille de corps minimum 14px** — Jamais de texte plus petit que 12px (metadata uniquement)
4. **Line height proportionnel** — Plus le texte est petit, plus le line-height augmente légèrement

---

## 6. Layout & Espacement

### Grille Universelle

Tous les espacements suivent un multiple de **4px** :

```typescript
const spacing = {
  xs: 4,    // 4px  — ultra-condensé (espacement interne badges)
  sm: 8,    // 8px  — condensé (espacement interne cartes)
  md: 16,   // 16px — standard (padding composants, gap items)
  lg: 24,   // 24px — grand (gap sections)
  xl: 32,   // 32px — extra (espacement entre sections majeures)
  '2xl': 48,// 48px — massif (margins externes)
  '3xl': 64,// 64px — très massif (séparateurs visuels forts)
};
```

### Structure Générale

Tous les écrans suivent ce pattern :

```
┌──────────────────────────────────┐
│ HEADER sticky                    │ ← height 56px
├──────────────────────────────────┤
│                                  │
│  CONTAINER                      │ ← padding 24px左右
│  max-width 480px (mobile)       │
│                                  │
│  ┌─────────┐ ┌─────────┐        │
│  │ CARD    │ │ CARD    │        │
│  │ content │ │ content │        │
│  └─────────┘ └─────────┘        │
│                                  │
│  SECTION gap 32px                │
│                                  │
├──────────────────────────────────┤
│ BOTTOM NAV fixed                 │ ← height 64px
└──────────────────────────────────┘
```

### Padding par Zone

| Zone | Horizontal | Vertical |
|------|-----------|----------|
| Écran global | 24px | 16px |
| Carte (Card) | 16px | 16px |
| Modal/Sheet | 24px | 24px |
| Feed/Liste item | 16px | 12px |
| Navigation | 8px | 0px |

---

## 7. Composants UI

### Boutons

Tous les boutons sont **pill shape** (border-radius = height/2) :

| Variante | Height | Padding | Text Size | Poids | Background |
|----------|--------|---------|-----------|-------|------------|
| Primary | 48px | 24px 24px | 14px (caption) | 500 | `accent` solid |
| Secondary | 48px | 24px 24px | 14px (caption) | 500 | transparent + border |
| Ghost | 40px | 12px 12px | 14px (caption) | 500 | transparent |
| Icon-only | 40px | 12px 12px | — | — | transparent |

Effet interactif :
- **Hover** : background `accentLight`, luminance +15%
- **Pressed** : background `accentDark`, luminance -15%, scale(0.96)
- **Disabled** : opacity 0.4, pointer-events none

### Cartes (Cards)

```
┌────────────────────────────┐
│  Card Content              │  background: #181818
│                            │  border-radius: 4px
│  ┌──────────────────────┐  │  shadow: 0 4px 12px rgba(0,0,0,0.3)
│  │  Inner Content       │  │  padding: 16px
│  └──────────────────────┘  │  margin: 8px
└────────────────────────────┘  border: none (pas de bordures colorées)
```

Types de cartes :
1. **Hero Card** — Grande carte avec chiffre principal (solde, résultat net)
2. **Stat Card** — Petite carte carrée avec icône + label + valeur (stats grid 2x2)
3. **Feed Card** — Carte horizontale pour items de liste (transaction, membre)
4. **Empty Card** — Cartes avec état vide quand aucune donnée

### Badges / Chips

```
┌──────────────┐
│ Label  ✓     │  height: 28px, padding: 6px 12px, 
│ Status Badge │  border-radius: 14px (full pill),
└──────────────┘  font-size: 11px, font-weight: 500
```

États de badge :
- `approved` → background `dataGreen` +10%, texte blanc
- `pending` → background `dataYellow` +20%, texte noir `#121212`
- `rejected` → background `dataRed` +10%, texte blanc
- `draft` → background `surfaceActive`, texte `textTertiary`

### Formulaire

- Input height : 48px
- Border : 2px solid `surfaceHover` par défaut
- Focus border : 2px solid `accent`
- Error border : 2px solid `dataRed`
- Label : 12px, `textTertiary`, en uppercase, tracking +1px
- Helper text : 11px, `textTertiary`
- Error message : 12px, `dataRed`

### Navigation

```
┌─────────────────────────────────────┐
│  [Icon] Home    [Icon]+[Icon] ...  │
│    Orange         Accent            │
│  Actif=Accent                           │
└─────────────────────────────────────┘
  height: 64px    fixed bottom
```

Tab items :
- **Actif** : icône + label en `accent`, height 48px
- **Inactif** : icône grise (`textTertiary`), label `textPlaceholder`
- **FAB central** : cercle accent 56px, icône "+", shadow `0 8px 24px accent@25%`

### Modal / Bottom Sheet

- Largeur : 100% (bottom sheet) ou max 480px centered (modal)
- Height : adaptative (auto-expand jusqu'à 90vh max)
- Background : `surface` `#181818`
- Border radius top : 16px 16px 0 0 (bottom sheet) ou 12px (modal)
- Close button : top-right, icon-only 40px
- Backdrop : `rgba(0,0,0,0.7)`

---

## 8. Accessibilité & Contraste WCAG

### Standards Applicables

Lumina respecte les normes suivantes :

| Critère | Niveau Requis | Détail |
|---------|--------------|--------|
| **Contraste texte principal** | AAA (≥7:1) | `#FFFFFF` sur `#121212` = 21:1 ✓ |
| **Contraste body text** | AA+ (≥4.5:1) | `#B3B3B3` sur `#121212` = 7.2:1 ✓ |
| **Contraste meta labels** | AA (≥3:1) | `#808080` sur `#121212` = 3.95:1 ✓ |
| **Contraste accent** | AA Large (≥3:1) | `#FF6B00` sur `#121212` = 4.6:1 ✓ |
| **Taille texte minimum** | N/A | 12px minimum, 14px pour body |
| **Touch target** | WCAG 2.5.5 | 44px minimum (nos boutons font 48px) |

### Contraste Dynamique par Accent

Quand l'utilisateur choisit un accent custom :

```typescript
function isValidAccent(hex: string): ValidationResult {
  const contrast = calculateContrast(hex, '#121212');

  if (contrast < 3.0) return { valid: false, reason: 'Contraste trop faible' };
  if (contrast >= 3.0 && contrast < 4.5) return { valid: true, warning: 'Contraste AA Large seulement' };
  return { valid: true, warning: null };
}
```

### Modes d'Accessibilité

Lumina supporte les adaptations suivantes :
- **Texte réduit** : Si l'utilisateur a activé "Texte plus petit" dans les paramètres OS, multiplier toutes les tailles par 0.85
- **Texte très grand** : Multiplier par 1.25 (jusqu'à max 24px pour body)
- **Fort contraste** : Augmenter tous les gris de 10% vers le blanc
- **Daltonisme** : Les données financières utilisent formes ET couleurs (ex: triangle ↑ pour recettes, ▼ pour dépenses)

> **Référence :** [WCAG 2.1 — Contraste Minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)

---

## 9. Responsive Design

### Breakpoints

| Breakpoint | Device | Max Width | Padding |
|------------|--------|-----------|---------|
| `mobile` | iPhone SE → Pro Max | 480px | 24px horizontal |
| `tablet` | iPad Mini → Pro | 1024px | 48px horizontal, centre contenu |
| `desktop` | Web full | ∞ | 120px horizontal, sidebar 280px |

### Mobile-First

Tous les designs sont pensés **mobile-first** (480px) puis étendus :
- Sur tablettes : les grids passent de 1 colonne à 2-3 colonnes
- Sur desktop : la navigation latérale remplace la bottom nav
- Les modales deviennent des panels latéraux (drawer)

### Espacement Adaptatif

Sur petits écrans (< 360px), tous les espacements sont réduits de 20%. Au-delà, ils restent constants.

---

## 10. Animation & Micro-interactions

### Principes

- **Toujours reanimated thread worklets** — Jamais de Animated API standard React Native
- **Durée courte** — 150-300ms max pour toute transition
- **Easing naturel** — Spring ou ease-out cubic
- **Subtilité** — Aucune animation ne doit distraire du contenu

### Animations Définies

| Action | Durée | Easing | Type |
|--------|-------|--------|------|
| Apparence écran | 200ms | ease-out | fade + slide-up |
| Swipe item | instant | — | pan gesture |
| Tap bouton | 100ms | spring stiffness 200 | scale(0.96) press |
| FAB open modal | 300ms | spring (bouncy) | scale + fade |
| Bottom sheet slide | 250ms | ease-out | translateY |
| Toggle switch | 200ms | spring | scaleX + color |
| Loading spinner | indéfini | linear 360° | rotation |
| Skeleton loader | 1500ms | ease-in-out | pulse shimmer |
| Transaction submit | 400ms | spring | checkmark draw + color change |
| Sync badge appear | 200ms | ease-out | fade + scale |
| Pull to refresh | indéfini | linear | spinner rotation |

### Never Animate

1. Scroll position
2. Contenu de texte long
3. Images/changements de média
4. Refresh de tableau de données complexes (sauf skeleton loading)

---

## 11. Data Visualization

### Graphiques

- **Bar chart** — Barres accent color, hauteur proportionnelle aux valeurs, fond `#121212`, grid lines en `#333333` très fins
- **Donut chart** — Segment principal = accent org, segments secondaires = gris (`#282828`, `#333333`), fond = transparent
- **Line chart** — Ligne accent org, gradient fill sous la ligne avec accent à 15% opacité
- **Sparkline** — Ligne simple accent, sans axes, hauteur 32px max

### Règles de Données

1. Les **chiffres financiers** utilisent toujours les couleurs constants : vert=recette, rouge=dépense, jaune=pending
2. Les **légendes** sont à côté des graphiques (pas en dessous) sur mobile
3. Les **unités** sont visibles sur les axes (FCFA, %, jours)
4. Les **tooltip** follow finger avec delay 150ms

---

## 12. Règles de Validation Design

### Avant Chaque Commit UI

Vérifier systématiquement :

- [ ] Fond principal = `#121212` (jamais `#000000` ni `#FFFFFF`)
- [ ] Aucun gradient présent dans aucun composant
- [ ] Couleurs data = constantes (`#1DB954`, `#E51332`, `#FFB800`)
- [ ] Accent actuel correspond au preset de l'org (vérifier table `organizations.theme_accent_hex`)
- [ ] Tous les boutons sont pill shape (border-radius = height/2)
- [ ] Cards ont border-radius 4px
- [ ] Titre utilise weight 700 minimum
- [ ] Espacement suit la grille 4px
- [ ] Contraste texte body ≥ 4.5:1
- [ ] Touch target ≥ 44px pour tous les éléments interactifs
- [ ] Aucun style inline avec valeur hex codée en dur

### Audit Automatique Possible

Le theme tokens system (`src/core/theme.ts`) doit être la source unique de vérité :

```typescript
// Si un composant référence directement '#FF6B00', c'est un bug !
// Il doit utiliser colors.accent
```

---

## 13. Implémentation Technique

### Theme Tokens

Tous les styles passent par le thème central :

```typescript
// src/core/theme.ts
import { AccentPalette } from './types';

const canvas = { /* constantes universelles */ };
const data = { /* constantes financières */ };

function createTheme(organizationAccent: AccentPalette) {
  return {
    ...canvas,
    ...data,
    accent: organizationAccent.primary,
    accentLight: organizationAccent.light,
    accentDark: organizationAccent.dark,
  };
}
```

### Injection Runtime

Le thème est injecté au démarrage via `AppContext` (ADR-013) :

```typescript
// bootstrap.tsx
const org = await fetchCurrentOrg();
const theme = createTheme(org.accent_palette);
// Injecté via ThemeProvider au sommet de l'arbre React
```

En mode offline-first, le thème est persisté localement dans `LocalPreferences.ts` et restauré au prochain lancement.

### Token Naming Convention

Toujours nommer les tokens par **rôle fonctionnel**, jamais par couleur :

```typescript
// ✅ CORRECT — rôle sémantique
backgroundColor: colors.bg
color: colors.accent

// ❌ INCORRECT — liée à une couleur spécifique
backgroundColor: '#121212'
color: '#FF6B00'
```

---

*Design Guidelines v1.0 — 2026-07-22 — Lumina v2*
