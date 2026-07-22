# DESIGN

> **Document : Visual System Reference**  
> Projet : Lumina — Plateforme Universelle d'Organisation v2  
> Créé par `impeccable init` — 2026-07-22  
> Inspiré par : Spotify (canvas sombre immersif), Notion (clarté fonctionnelle), Figma (flux intuitifs)

---

## 1. Brand introduction and aesthetic direction

Lumina est une plateforme universelle d'organisation dont la première implémentation cible les églises, ONG, écoles et entreprises. Le design doit être **moderne, audacieux et rigoureux** — loin des templates SaaS cream/beige que l'on voit partout en 2026.

**Le concept central : "Dark Canvas, Accent Vivant"**

Le fond noir profond (#121212) est universel et immuable — c'est la toile commune à toutes les organisations du monde. L'accent change selon le type d'organisation (église = orange fire, école = teal éducatif, entreprise = bleu corporate). Cette approche crée une identité cohérente au sein d'une organisation tout en permettant une différenciation entre organisations.

**Ce que nous ne sommes pas** : un template SaaS beige, une application institutionnelle austère, ou un dashboard technique froid. Nous sommes un outil vibrant, moderne et audacieux qui sert des leaders dans des contextes réels (debout, téléphone portable, zones rurales, urgences financières).

---

## 2. Palette definitions

### Canvas Colors (Fixed — Never Change)

| Token | Value | Usage | Contrast on #121212 |
|-------|-------|-------|---------------------|
| `--color-bg-canvas` | `#121212` | Background principal | N/A (is the background) |
| `--color-bg-surface` | `#181818` | Cards, elevated surfaces | — |
| `--color-bg-surface-hover` | `#282828` | Hover states | — |
| `--color-bg-surface-active` | `#333333` | Selected/active elements | — |

Les surfaces diffèrent par 0.3–0.5 log unités de luminosité, créant de la profondeur sans ombres ni bordures.

### Ink / Text Colors (Fixed)

| Token | Value | Contrast | Usage |
|-------|-------|----------|-------|
| `--color-text-primary` | `#FFFFFF` | 21:1 (AAA) | Headings, key numbers |
| `--color-text-secondary` | `#B3B3B3` | 7.2:1 (AA+) | Body text |
| `--color-text-tertiary` | `#808080` | 3.95:1 (AA) | Labels, metadata |
| `--color-text-placeholder` | `#535353` | 1.95:1 (N/A) | Placeholders, disabled |

### Financial Data Colors (Fixed — Always Constant)

These never change regardless of organization accent — financial readability always trumps branding.

| Token | Value | Meaning | Contrast |
|-------|-------|---------|----------|
| `--color-data-income` | `#1DB954` | Income, positive | ≥4:1 ✓ |
| `--color-data-expense` | `#E51332` | Expense, alerts | ≥4:1 ✓ |
| `--color-data-pending` | `#FFB800` | Pending, review | ≥3:1 ✓ |

### Organization Accent Presets

Each organization type gets a suggested palette. The primary accent drives buttons, CTA, active tabs, and FAB — but only one accent at a time.

#### Church / Default — "Fire Orange"

| Role | Token | Value |
|------|-------|-------|
| Primary | `--color-accent-primary` | `#FF6B00` |
| Light | `--color-accent-light` | `#FF8533` |
| Dark | `--color-accent-dark` | `#CC5500` |

Contrast on #121212: 4.6:1 (AA Large ✓)

#### School / University — "Education Teal"

| Role | Token | Value |
|------|-------|-------|
| Primary | `--color-accent-primary` | `#00A896` |
| Light | `--color-accent-light` | `#00D4B6` |
| Dark | `--color-accent-dark` | `#007F72` |

#### NGO / Association — "Earth Green"

| Role | Token | Value |
|------|-------|-------|
| Primary | `--color-accent-primary` | `#4CAF50` |
| Light | `--color-accent-light` | `#81C784` |
| Dark | `--color-accent-dark` | `#388E3C` |

#### Corporate / Business — "Professional Blue"

| Role | Token | Value |
|------|-------|-------|
| Primary | `--color-accent-primary` | `#2196F3` |
| Light | `--color-accent-light` | `#64B5F6` |
| Dark | `--color-accent-dark` | `#1976D2` |

#### Government / Institution — "Solemn Indigo"

| Role | Token | Value |
|------|-------|-------|
| Primary | `--color-accent-primary` | `#3F51B5` |
| Light | `--color-accent-light` | `#7986CB` |
| Dark | `--color-accent-dark` | `#303F9F` |

#### Custom — User Defined

When the user picks any custom hex, variants are calculated automatically:
```
light  = original  + luminance boost (+30%)
dark   = original   - luminance dim (-30%)
```
Validation: minimum contrast ≥ 3:1 on `#121212` (WCAG AA Large Text). Saturation < 20% is also rejected.

### Shadows

Only two shadows exist in the system.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-card` | `0 4px 12px rgba(0,0,0,0.3)` | Cards — always black |
| `--shadow-accent-glow` | `0 8px 24px rgba(--color-accent-primary, 0.25)` | FAB / primary actions only |

No colored shadows for anything other than the accent button/element.

---

## 3. Font specifications

| Token | Value |
|-------|-------|
| `--font-family` | `'Circular', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif` |

Circular is Spotify's premium font; Inter is the open-source fallback. For React Native, replace with the closest platform-native equivalent.

### Type Scale

| Role | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Hero Number | 48px | 800 (Bold) | 1.1 | Balance, KPIs |
| H1 | 32px | 700 (Bold) | 1.2 | Page titles |
| H2 | 24px | 700 (Bold) | 1.3 | Section headers |
| H3 | 18px | 700 (Bold) | 1.4 | Card titles |
| Body | 14px | 400 (Regular) | 1.6 | Paragraph text |
| Small | 12px | 400 (Regular) | 1.5 | Metadata, timestamps |
| Caption | 11px | 500 (Medium) | 1.4 | Button labels, badges |

### Typography Rules

- No title case — use sentence case for all text
- Tabular numbers for columns: `font-variant-numeric: tabular-nums`
- Minimum body size 14px (12px metadata only)
- Headings always weight 700 minimum
- `text-wrap: balance` on headings, `text-wrap: pretty` on long prose
- Display heading ceiling: clamp max ≤ 6rem (~96px)
- Letter spacing floor for display headings: ≥ -0.04em

---

## 4. Spatial arrangement

### Spacing Scale (4px Grid)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Badge internal padding |
| `--space-sm` | 8px | Card internal padding |
| `--space-md` | 16px | Standard component padding, list gaps |
| `--space-lg` | 24px | Large section gaps |
| `--space-xl` | 32px | Major section spacing |
| `--space-2xl` | 48px | External margins |
| `--space-3xl` | 64px | Strong visual dividers |

### Screen Layout Template

All screens follow this structure:

```
HEADER (sticky, 56px height)
┌─────────────────────┐
│   Header Bar        │ ← h=56px
├─────────────────────┤
│                     │
│  PADDING 24px       │ ← horizontal screen padding
│  CONTAINER          │ ← max-width mobile: fit-content
│  CONTENT AREA       │
│                     │
│  SECTION GAPS 32px  │
│                     │
├─────────────────────┤
│   Bottom Nav        │ ← h=64px fixed
└─────────────────────┘
```

### Zone Padding

| Zone | Horizontal | Vertical |
|------|-----------|----------|
| Full screen | 24px | 16px |
| Card content | 16px | 16px |
| Modal / Sheet | 24px | 24px |
| Feed list item | 16px | 12px |
| Navigation bar | 8px | 0px |

---

## 5. Layering techniques

Semantic z-index scale for consistent stacking:

| Level | Name | Value | Context |
|-------|------|-------|---------|
| `layer-0` | Content | base | Default documents |
| `layer-1` | Dropdown | z-1 | Navigation dropdowns |
| `layer-2` | Sticky header | z-10 | Top navigation bar |
| `layer-3` | Modal backdrop | z-40 | Overlay behind modal |
| `layer-4` | Modal/dialog | z-50 | Dialog content |
| `layer-5` | Toast/badge | z-60 | Success/error messages |
| `layer-6` | Tooltip | z-70 | Hover hints |

Never use arbitrary values like 999 or 9999.

---

## 6. Geometric forms

### Border Radius

| Element | Radius | Example |
|---------|--------|---------|
| Buttons | pill shape (height/2) | height 48px → radius 24px |
| Cards | 4px | Flat, intentional corners |
| Badges / Chips | full pill (14px) | status chips, category filters |
| Input fields | 8px | Form controls |
| Modals | 12px (modal), 16px top (bottom sheet) | Overlays |
| Icons / Avatars | 50% (circle) | Profile pictures |

### Shape Philosophy

- Rounded buttons = pill, no square buttons ever
- Cards = slightly rounded (4px), intentional not soft
- Badges = full pill shape
- Forms = moderate round (8px)
- No decorative shapes, no circular cards, no asymmetric radii

---

## 7. Interface elements

### Buttons

| Variant | Height | Padding | Text | Weight | Background |
|---------|--------|---------|------|--------|------------|
| Primary | 48px | 24px | 14px caption | 500 | `--color-accent-primary` solid |
| Secondary | 48px | 24px | 14px caption | 500 | transparent + border |
| Ghost | 40px | 12px | 14px caption | 500 | transparent |
| Icon-only | 40px | 12px | — | — | transparent |

Interactive effects: hover uses `accentLight` (+15% luminance), pressed uses `accentDark` (-15%, scale 0.96), disabled uses opacity 0.4.

### Cards

| Property | Value |
|----------|-------|
| Background | `--color-bg-surface` (#181818) |
| Border-radius | 4px |
| Shadow | `--shadow-card` |
| Padding | 16px |
| Border | none (spacing creates separation, not lines) |

Card types: Hero Card (large number), Stat Card (icon + value), Feed Card (horizontal list item), Empty Card (no data state).

### Badges / Status Chips

| Property | Value |
|----------|-------|
| Height | 28px |
| Padding | 6px 12px |
| Border-radius | 14px (full pill) |
| Font | 11px, weight 500 |

State colors: approved = `dataGreen`, pending = `dataYellow` + text inverted (#121212), rejected = `dataRed`, draft = surfaceActive + textTertiary.

### Navigation

Bottom tab bar: fixed, height 64px, 5 tabs max (home, finance, members, settings + FAB center). Active tab icon+label in `--color-accent-primary`. Inactive in gray. Central FAB: circle accent 56px with "+", shadow accent@25%.

### Forms

| Property | Value |
|----------|-------|
| Input height | 48px |
| Default border | 2px solid `surfaceHover` (#282828) |
| Focus border | 2px solid `accent-primary` |
| Error border | 2px solid `dataRed` (#E51332) |
| Label | 12px, textTertiary, uppercase, tracking +1px |
| Helper | 11px, textTertiary |
| Error message | 12px, dataRed |

### Modals / Bottom Sheets

| Property | Bottom Sheet | Modal |
|----------|-------------|-------|
| Width | 100% | max 480px centered |
| Height | Auto-expand (up to 90vh) | Auto-expand (up to 90vh) |
| Background | Surface (#181818) | Surface (#18182818) |
| Border-radius | 16px 16px 0 0 | 12px |
| Close | Top-right icon 40px | Top-right icon 40px |
| Backdrop | rgba(0,0,0,0.7) | rgba(0,0,0,0.7) |

---

## 8. Best practices and restrictions

### Must Follow

- **Canvas is sacred** — always #121212. Never white. Never light mode toggle.
- **One accent only** — the organization's chosen color. Never mix two accents.
- **Financial data colors are immutable** — green/red/yellow never change. They are the language of money.
- **Token-only styling** — components reference `colors.bg`, not '#121212'. Hardcoded hex in components is a bug.
- **4px grid spacing** — every spacing value must be a multiple of 4.
- **Typography heavy** — headings weight 700+, body 400. Never light for headings.
- **Pill buttons** — all interactive buttons are rounded (border-radius = height/2).
- **Touch targets ≥ 44px** — WCAG 2.5.5 compliance minimum.
- **Skeleton over spinner** — initial load always shows skeleton screens, never empty loading spinners.
- **Sentence case** — no title case anywhere. "Transaction approved" not "Transaction Approved".

### Must NOT Do

- ❌ Gradient text or gradient backgrounds on cards
- ❌ Side-stripe borders (colored left/right border > 1px as decoration)
- ❌ Glassmorphism as default (blurs are rare and purposeful, never decorative)
- ❌ Identical card grids (same-sized cards repeated endlessly)
- ❌ Tiny uppercase tracked eyebrow above every section ("ABOUT", "PROCESS")
- ❌ Numbered section markers as default scaffolding ("01 About / 02 Process / 03 Pricing")
- ❌ Text overflowing container (test heading copy at every breakpoint)
- ❌ Cream/sand/beige body background (the saturated AI default of 2026)
- ❌ Neon/fluorescent colors (no #00FF00, #FF00FF on dark bg)
- ❌ Hamburger menus for primary navigation (always bottom bar visible)

### Motion Guidelines

- Duration: 150-300ms maximum
- Easing: exponential ease-out curves (ease-out-quart/quint/expo) or spring
- Never animate scroll position, long text content, or images
- Always respect `prefers-reduced-motion` (crossfade or instant transition alternative)
- Staggering within one group is legitimate; uniform reflex on every section is not
- Premium motion materials: blur, backdrop-filter, clip-path — not just transform/opacity
- Reveal animations must not gate content visibility
