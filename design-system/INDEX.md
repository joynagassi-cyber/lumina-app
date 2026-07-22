# 🎵 Lumina Design System — "Dark Canvas" Thème Configurable

> **Fond sombre profond universel + Accent personnalisable par organisation.**
> Le canvas est fixe (#121212). L'accent change selon l'org — chaque type d'org a des palettes secundaires alignées.

## Philosophie

Lumina suit un principe de **"Toile Sombre"** (Dark Canvas) :
- **Le fond est universel** — `#121212` comme base, jamais de blanc, jamais de gradients
- **L'accent est personnalisable** — chaque organisation choisit sa couleur(s) secondaire(s) lors de la configuration (écran `/main/org/setup`)
- **La hiérarchie est typographique** — espacement + bold, pas de décorations inutiles
- **Minimalisme intentionnel** — chaque élément a un but

### Catégories de Couleurs

Chaque org reçoit automatiquement une palette suggérée selon son type, mais peut personnaliser :

| Élément | Fixe ? | Valeur par défaut |
|---------|--------|-------------------|
| **Background principal** | ✅ OUI | `#121212` (toujours) |
| **Surfaces** | ✅ OUI | `#181818`, `#282828`, `#333333` |
| **Texte** | ✅ OUI | `#FFFFFF`, `#B3B3B3`, `#808080`, `#535353` |
| **Accent primaire** | ❌ NON | Suggestions par type d'org (voir ci-dessous) |
| **Couleurs données** | ⚠️ Partiel | Green/Red/Yellow restent constants pour lisibilité financière |
| **Couleurs données secondaires** | ❌ NON | Peuvent suivre l'accent de l'org |

---

## Palettes par Type d'Organisation

### 🏛️ Église (Défaut — "Fire Orange")

Palette conservée par défaut. Identité Lumina originale.

| Nom | Hex | Usage |
|-----|-----|-------|
| **Fire Orange** | `#FF6B00` | CTA, liens, highlights, icônes actives |
| **Fire Light** | `#FF8533` | Hover |
| **Fire Dark** | `#CC5500` | States pressés |

### 🎓 École / Université (Teal éducatif)

| Nom | Hex | Usage |
|-----|-----|-------|
| **Education Teal** | `#00A896` | CTA, liens, highlights |
| **Teal Light** | `#00D4B6` | Hover |
| **Teal Dark** | `#007F72` | Pressed states |

### 🌍 ONG / Association (Vert terrestre)

| Nom | Hex | Usage |
|-----|-----|-------|
| **NGO Green** | `#4CAF50` | CTA, liens, highlights |
| **Green Light** | `#81C784` | Hover |
| **Green Dark** | `#388E3C` | Pressed states |

### 🏢 Entreprise / Corporate (Bleu professionnel)

| Nom | Hex | Usage |
|-----|-----|-------|
| **Corporate Blue** | `#2196F3` | CTA, liens, highlights |
| **Blue Light** | `#64B5F6` | Hover |
| **Blue Dark** | `#1976D2` | Pressed states |

### ⚖️ Gouvernement / Institutionnel (Indigo solennel)

| Nom | Hex | Usage |
|-----|-----|-------|
| **Institution Indigo** | `#3F51B5` | CTA, liens, highlights |
| **Indigo Light** | `#7986CB` | Hover |
| **Indigo Dark** | `#303F9F` | Pressed states |

### ✨ Personnalisation Libre (Couleur utilisateur)

L'utilisateur saisit une couleur hex. Le système génère automatiquement light/dark :
```
light = original + luminance boost (+30%)
dark  = original   - luminance dim (-30%)
```

---

## Couleurs Fixes (Toujours Utilisées)

### Backgrounds (noir profond — universel)

| Nom | Hex | Usage |
|-----|-----|-------|
| **Spotify Black** | `#121212` | Background principal |
| **Deep Gray** | `#181818` | Cartes, surfaces élevées |
| **Elevated Gray** | `#282828` | Hover states |
| **Active State** | `#333333` | Sélection active |

### Données financières (toujours constantes)

| Nom | Hex | Usage |
|-----|-----|-------|
| **Data Green** | `#1DB954` | Recettes positives |
| **Data Red** | `#E51332` | Dépenses/alertes |
| **Data Yellow** | `#FFB800` | En attente |

> ⚠️ **Les couleurs de données financières ne changent jamais**, même si l'org personnalise son accent. La lisibilité financière est plus importante que la personnalisation.

### Texte (toujours constants)

| Nom | Hex | Usage |
|-----|-----|-------|
| **White** | `#FFFFFF` | Titres, texte principal |
| **Gray 1** | `#B3B3B3` | Body text |
| **Gray 2** | `#808080` | Labels, metadata |
| **Gray 3** | `#535353` | Placeholders, disabled |

### Shadows

```css
/* Ombre UNIQUEMENT pour le bouton/élément fire */
--shadow-fire: 0 8px 24px rgba(255,107,0,0.25);

/* Pas d'ombres colorées pour les cartes — juste des niveaux de gris */
--shadow-card: 0 4px 12px rgba(0,0,0,0.3);
```

---

## Typographie "Spotify Bold"

| Rôle | Size | Weight | Usage |
|------|------|--------|-------|
| **Hero Number** | 48px | 800 (Bold) | Solde principal |
| **H1** | 32px | 700 (Bold) | Titres de page |
| **H2** | 24px | 700 (Bold) | Sections |
| **H3** | 18px | 700 (Bold) | Cartes titre |
| **Body** | 14px | 400 (Regular) | Texte courant |
| **Small** | 12px | 400 (Regular) | Metadata |
| **Caption** | 11px | 500 (Medium) | Labels |

**Font Family :** `'Circular', 'Inter', -apple-system, sans-serif`

---

## Règles d'Or

1. **Jamais de blanc sur noir pur** — toujours utiliser `#121212` et `#181818`
2. **Accent configurable par org** — la couleur primaire est choisie dans l'écran de configuration (DR-011), mais **une seule à la fois**
3. **Pas de gradients** — couleurs solides uniquement
4. **Pas de bordures colorées** — séparés par espacement, pas par lignes
5. **Rond vs Carré** — boutons ronds (pill shape), cards carrées ou légèrement arrondies (4px)
6. **Espacement généreux** — jamais de contenu tassé
7. **Typographie heavy** — les titres en bold 700-800, jamais light
8. **Données financières toujours stables** — green/red/yellow constants pour lisibilité
9. **L'accent ne peut jamais être trop proche du fond** — minimum contraste 3:1 (WCAG AA large text)

---

*Design System v2 "Dark Canvas" — Créé le 2026-07-22*
