# ADR-011 : Design System — "Dark Canvas" Thème Universel + Accent Personnalisable

**Date :** 2026-07-22  
**Mise à jour :** 2026-07-22 (personnalisation par type d'organisation)  
**Statut :** ACCEPTÉ — INVARIABLE sur le canvas, CONFIGURABLE sur les accents  
**Décideurs :** CTO + Architecte Principal + Product Owner  
**Conséquences :** Fond `#121212` universel fixe. Accent principal configurable par organisation selon 5 presets + couleur libre. Contraste minimum WCAG AA garanti.

---

## 1. Contexte

L'application existante en Flutter utilise un style moderne avec gradients et couleurs multiples. L'utilisateur a demandé un design inspiré de Spotify : fond sombre profond uni, pas de gradients. Puis il a été ajouté que chaque organisation doit pouvoir choisir sa propre couleur d'accent lors de la configuration (`/main/org/setup`).

Ce design system est documenté dans [`design-system/INDEX.md`](../../design-system/INDEX.md).

**Contraintes impératives :**
- Fond noir profond (style Spotify), jamais de blanc
- Accent personnalisable selon le type d'organisation
- Hiérarchie par espacement + typography bold
- Données financières toujours lisibles (INV-001)

> **Voir aussi :** ADR-005 (stack technique exige animations performantes via reanimated), ADR-003 (offline-first = thème ne dépend pas de resources externes), ADR-006 (multi-tenant = theme_data stockée par org), ADR-007 (MVP 10 features — la config theme fait partie du Setup Org), ADR-014 (DAG organisationnel — héritage de theme possible enfant → parent).

## 2. Questions

Quel design system adopter pour Lumina ? Comment permettre à chaque org de se personnaliser tout en gardant une identité visuelle cohérente ?

## 3. Décision

**Design System "Dark Canvas" : toile sombre universelle `#121212` + accent configurable par org.**

### Principe de Séparation

Le design est décomposé en deux couches indépendantes :

```
┌─────────────────────────────────────────┐
│        COUCHE FIXE (canvas)             │
│                                         │
│  Background:    #121212 (toujours)      │
│  Surfaces:      #181818, #282828        │
│  Texte:         #FFFFFF, #B3B3B3...     │
│  Data fin:      #1DB954 (green)         │
│                  #E51332 (red)          │
│                  #FFB800 (yellow)       │
│  Typography:    Bold 700-800            │
│  Formes:        Pill buttons, 4px cards │
│  Pas gradients: Couleurs solides        │
│                                         │
├─────────────────────────────────────────┤
│     COUCHE CONFIGURABLE (accent)        │
│                                         │
│  Accent primaire (1 sur 6 presets)      │
│  ────────────────────────────────────   │
│  1. Église     → Fire Orange  #FF6B00   │
│  2. École       → Education Teal #00A896 │
│  3. ONG         → NGO Green  #4CAF50    │
│  4. Entreprise  → Corporate Blue #2196F3│
│  5. Institution → Inst Indigo #3F51B5   │
│  6. Custom      → Couleur utilisateur   │
│                                         │
│  + Light variant (+30% luminance)       │
│  + Dark variant (-30% luminance)        │
└─────────────────────────────────────────┘
```

### Presets par Type d'Organisation

| Type d'org | Preset | Hex |
|------------|--------|-----|
| Église | Fire Orange | `#FF6B00` |
| École / Université | Education Teal | `#00A896` |
| ONG / Association | NGO Green | `#4CAF50` |
| Entreprise / Corporate | Corporate Blue | `#2196F3` |
| Gouvernement / Institutionnel | Institution Indigo | `#3F51B5` |
| Tout autre | Custom | Input utilisateur |

### Données Financières Stables

Les couleurs de données financières (recettes/dépenses/en attente) **ne changent jamais**, quelle que soit la personnalisation de l'org. La lisibilité financière prime sur l'esthétique.

### Règles Non-Négociables

1. **Jamais de blanc sur noir pur** — `#121212` + `#181818` uniquement
2. **Un seul accent à la fois** — la couleur primaire est choisie dans l'écran de configuration, mais **une seule**
3. **Pas de gradients** — couleurs solides uniquement
4. **Pas de bordures colorées** — séparateurs par espacement uniquement
5. **Contraste minimum WCAG AA** — l'accent doit avoir un ratio ≥ 3:1 sur `#121212` (test automatique au setup)
6. **Boutons pill shape, cards arrondies 4px**
7. **Espacement généreux, typographie bold**

## 4. Alternatives Envisagées

### Alternative A : Thème Statique (Orange uniquement)
- **Avantages :** Plus simple à implémenter, identité visuelle forte et unique pour Lumina
- **Inconvénients :** Pas d'identité org propre, pas de différenciation entre églises/ONG/écoles, expérience utilisateur générique

### Alternative B : Thème Complet par Org (Background + Accent personnalisables)
- **Avantages :** Personnalisation totale, chaque org a son identité unique
- **Inconvénients :** Risque de violations de contraste, perte de cohérence entre orgs, complexité accrue, données financières potentiellement illisibles

### Alternative C : Dark Canvas + Accent Configurable (Choix Retenu)
- **Avantages :** Équilibre parfait — canvas stable garantit lisibilité + contraste WCAG, accent différencie les orgs, données financières stables, implémentation simple (changement juste l'accent en runtime), héritage DAG possible
- **Inconvénients :** Moins de liberté qu'un thème complet → **Mitigation :** Presets de qualités validés par type d'org + input custom avec validation contraste auto

## 5. Conséquences

### Positives
- ✅ Différenciation visuelle par organisation — chaque org se reconnaît
- ✅ Cohérence intra-org — l'accent est le même partout dans l'org
- ✅ Lisibilité financière garantie — couleurs data stables, fond noir constant
- ✅ Implémentation simple — changement d'une variable theme runtime
- ✅ Héritage DAG naturel — ADR-014: un enfant peut inherit l'accent de son parent ou choisir le sien
- ✅ Fidèle à la demande explicite de l'utilisateur

### Négatives (et mitigations)
- ⚠️ Risque que l'utilisateur choisisse une couleur illisible → **Mitigation :** Validation automatique au setup (WCAG AA contrast test ≥ 3:1 sur `#121212`) + presets suggérés
- ⚠️ La personnalisation peut créer des expériences incohérentes → **Mitigation :** Une seule couleur d'accent autorisée, règles strictes conservées

### Conséquence sur le Choix d'UI Library

Une UI library pré-fabriquée (React Native Paper, NativeBase, etc.) est **exclue** car :
- Thème par défaut clair incompatible avec `#121212`
- Limitations sur animations personnalisées (incompatibles avec reanimated thread worklets)
- Couleurs imposées par la library au détriment du design system
- Impossible de changer d'accent runtime selon l'org

→ **Solution retenue :** Composants custom construits avec `react-native-reanimated` + `gesture-handler`, entièrement conformes au design system. L'accent est injecté via theme tokens en runtime (ADR-013).

## 6. Critères de Vérification

Chaque écran nouveau ou modifié doit vérifier :
- [ ] Fond principal est `#121212` (ou `#181818` pour surfaces)
- [ ] Aucun gradient présent
- [ ] La couleur d'accent utilisée correspond au preset de l'org (tableau presets ci-dessus) OU est validée via WCAG AA contrast test ≥ 3:1 sur `#121212`
- [ ] Les couleurs de données financières sont `#1DB954`, `#E51332`, `#FFB800` (toujours constantes)
- [ ] Boutons sont pill shape
- [ ] Cards ont border-radius 4px
- [ ] Titre utilise weight 700 minimum
- [ ] Aucune couleur codée en dur dans les composants (toujours via theme tokens)

## 7. Références

- PRD Section "Design & UX"
- INV-001 (Invariant : Immuabilité Financière — nécessite lisibilité parfaite)
- NEVERBREAK-RULE-01 (Règle : Données financières toujours lisibles)
- DOC-FRONTEND-GUIDE (Section 6 — Theming & Design Tokens)
- [`design-system/INDEX.md`](../../design-system/INDEX.md) (Palette complète)
- [`design-system/SCREEN-ARCHITECTURE.md`](../../design-system/SCREEN-ARCHITECTURE.md) (Application par écran)