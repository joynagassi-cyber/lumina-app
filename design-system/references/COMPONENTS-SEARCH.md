# Composants Prêts à l'Emploi pour Lumina

> **Composants trouvés via 21st.dev + Drabble (Lazyweb), adaptés au style Spotify de Lumina.**

## Mapping : Composant → Écran Lumina

| # | Composant 21st.dev | Écran Lumina | Rôle |
|---|-------------------|-------------|------|
| 1 | `Wallet Card 2` (beratberkayg) | Dashboard hero | Solde principal |
| 2 | `Financial Dashboard` (ravikatiyar162) | Dashboard | Quick actions grid |
| 3 | `Card-10` (ravikatiyar162) | Dashboard stats | Stat card avec % change animé |
| 4 | `Stats Card-1` (ravikatiyar162) | Dashboard stats | Key metric with icon |
| 5 | `Weekly KPI Chart` (isaiahbjork) | Dashboard / Rapport | Activité bar chart |
| 6 | `Finance Chart` (airbnb-visx) | Rapport | Graphique tendances |
| 7 | `Animated Sparkline` (larsen66) | Transaction list | Mini trend par ligne |
| 8 | `Transaction List` (hari) | Grand Livre | Liste transactions |
| 9 | `The Item One / Activity Feed` (felipemenezes098) | Grand Livre | Feed item pattern |
| 10 | `Flexi Filter Table` (ruixen.ui) | Grand Livre / Members | Filtre search+dropdown |
| 11 | `Chip` (hero_ui / preetsuthar17) | Tous écrans | Status badges (Immutable, pending, etc.) |
| 12 | `Badge Tag` (prebuiltui) | Tous écrans | Badges categories |
| 13 | `Modern Stunning Sign In` (preetsuthar17) | Login | Formulaire auth sombre |
| 14 | `Bottom Nav Bar` (arunachalam0606) | Tous écrans | Navigation tab bar |
| 15 | `Drawer` (coss.com) | Quick create forms | Bottom sheet modal |
| 16 | `Astryx Avatar` (Astryxdesign) | Membres | Avatars membres colorés |
| 17 | `Profile Card` (waleedkibhen / ravikatiyar162) | Profil membre | Membre detail card |
| 18 | `Stats Card` (kavikatiyar) | Members dashboard | Stats membres rapides |
| 19 | `Calendar [React Day Picker]` (originui) | Calendrier | Date picker minimal |
| 20 | `Tree View` (preetsuthar17) | Org hierarchy | Hiérarchie org graphe |
| 21 | `JSON Config Viewer` (samsiavoshian2009) | Config manifest | Vue YAML/JSON manifest |
| 22 | `Code Editor Sheet` (bankkroll) | Vocab editor | Éditeur vocabulaire |
| 23 | `Pending` (diceui) | Approvals | State boutons approve/reject |
| 24 | `Status Button` (ruixen.ui) | Offline queue | État sync indicator |
| 25 | `Progress` (sean0205) | Setup wizard | Barre progression config |
| 26 | `Skeleton` (shugar / shadcn) | Tous écrans | Loading states |
| 27 | `Dialog` (originui) | Tous écrans | Confirmation modals |
| 28 | `Context Menu` (shadcn) | Transaction row | Actions dropdown |
| 29 | `Vertical Tabs` (0xUrvish) | Rapport financier | Période selector tabs |
| 30 | `Health Stat Card` (ruhith369) | Dashboard advanced | Animated mini chart card |

---

## Composants par Pattern d'Affichage

### Hero Card (Grand Chiffre en Haut)
```
Écrans concernés : Dashboard balance, Bilan résultat net
Composant : Wallet Card 2 + Card-10 (ravikatiyar162)
Adaptation :
  - Remplacer la carte bancaire par un solde +X 000 F
  - Garder le layout : label petit → nombre GIGANTHE → sous-trend
  - Couleurs : fond #121212, chiffres en #FF6B00
```

### Stats Grid (2x2 ou 2x3)
```
Écrans concernés : Dashboard stats, Members overview
Composant : Card-10 (ravikatiyar162) + Stats Card-1 (ravikatiyar162)
Adaptation :
  - Chaque petite carte = 1 métrique simple
  - Icône Lucide à gauche, chiffre à droite
  - Fond #181818, bordure #282828, hover #3D3D3D
```

### Quick Actions (Pill Buttons Ronds)
```
Écrans concernés : Dashboard top, Transaction quick create
Composant : Financial Dashboard (ravikatiyar162) pattern
Adaptation :
  - Boutons pill shape (border-radius 100px)
  - Premier bouton = PRIMARY #FF6B00 texte #000
  - Boutons secondaires = outline #282828, hover #FF6B00
```

### Feed Layout (Feed Spotify-style)
```
Écrans concernés : Grand livre, Member list, Calendar upcoming
Composant : Transaction List (hari) + Activity Feed (felipemenezes098)
Adaptation :
  - Liste empilée verticalement, espacée
  - Chaque item : icône couleur + nom + meta + montant/date
  - Hover sur item = bg #282828
  - Date separators horizontaux
```

### Filter Bar (Search + Chips)
```
Écrans concernés : Grand livre, Members, Events
Composant : Flexi Filter Table (ruixen.ui) + Chip (hero_ui)
Adaptation :
  - Search bar arrondie #181818
  - Filter chips horizontaux scrollables
  - Chip actif = #FF6B00 texte noir
  - Chip inactif = #181818 texte #B3B3B3
```

### Detail Panel (Master-Detail)
```
Écrans concernés : Transaction detail, Member profile
Composant : Profile Card (waleedkibhen) + Dialog (originui)
Adaptation :
  - Slide-in depuis la droite (master-detail)
  - Ou bottom sheet (pour mobile)
  - Header : icône + titre + back button
  - Body : sections séparées par espacement
```

### Hierarchy Tree (Org Structure)
```
Écrans concernés : Organisation > Hierarchy
Composant : Tree View (preetsuthar17)
Adaptation :
  - Arbre expand/collapse
  - Chaque node = nom org + type badge
  - Indentation visuelle
  - Actions contextuelles sur chaque nœud
```

---

## Composants SPÉCIFIQUES aux Écrans Manquants

### Écran Approvals (`/main/approvals/pending`)

| Composant | Usage |
|-----------|-------|
| `Pending` (diceui) | Wrapper bouton approve/reject avec state loading |
| `Message Draft` (tool-ui) | Card récap transaction avec Send/Cancel/Undo |
| `Plan Tool` (serafimcloud) | Card avec Approve action footer |
| `Status Button` (ruixen.ui) | Indicateur status transaction |

### Écran Org Setup Wizard (`/main/org/setup`)

| Composant | Usage |
|-----------|-------|
| `Progress` (sean0205) | Barre de progression étapes du setup |
| `Edit Profile` (rayimanoj8) | Formulaire info organisation |
| `Dialog` (originui) | Confirmation étapes |

### Écran Sync Queue (`/main/offline/sync-queue`)

| Composant | Usage |
|-----------|-------|
| `System Status Block` (preetsuthar17) | Status connectivity indicator |
| `Sync Status Toast` (shadcnspace) | Notifications sync events |
| `Progress` (sean0205) | Progression sync items |

### Écran Conflict Resolver (`/main/offline/conflicts`)

| Composant | Usage |
|-----------|-------|
| `Code Editor Sheet` (bankkroll) | Vue diff side-by-side |
| `JSON Config Viewer` (samsiavoshian2009) | Comparaison données conflit |

---

## Priorisation d'Intégration

### Phase 1 — Fondamentaux (à implémenter en premier)
```
1. Auth Form → Login screen
2. Hero Card → Dashboard balance
3. Stats Grid → Dashboard quick stats
4. Transaction List → Grand Livre feed
5. Filter Bar → Search + chips filtres
6. Badge/Chip → Status indicators universels
7. Bottom Nav Bar → Navigation principale
8. Skeleton → Loading states
```

### Phase 2 — Richesse (features K1)
```
9. Transaction Detail → Master-detail slide
10. Balance Sheet Report → Weekly KPI Chart + Finance Chart
11. Member Profile → Profile Card pattern
12. Member List → Transaction List pattern (same code reuse!)
13. Org Setup Wizard → Progress bar + Edit Profile form
14. Event Calendar → React Day Picker
```

### Phase 3 — Avancé (features K2-K3)
```
15. Org Hierarchy → Tree View component
16. Manifest Editor → JSON Config Viewer
17. Vocab Editor → Code Editor Sheet
18. Approval Flow → Pending wrapper + Message Draft
19. Sync Queue → System Status Block
20. Config Dialog → Dialog + Context Menu
```

---

## Règles d'Adaptation vers Style Spotify

Pour TOUS ces composants, appliquer ces transformations :

| Composant Originel | → Devient Lumina |
|-------------------|------------------|
| Couleurs shadcn (slate/zinc) | Remplacer par `#121212` / `#181818` / `#282828` |
| Accents shadcn (violet/blue) | Remplacer par `#FF6B00` UNIQUEMENT |
| Bordures slate-700 | Bordures `#282828` |
| Textes slate-400/500 | Textes `#B3B3B3` / `#808080` |
| Animations framer-motion | Remplacer par `react-native-reanimated` |
| Rounded-xl (12px) | Border-radius 8px pour cards, 100px pour pills/boutons |
| Shadows colorées | OMBRES NOIRES uniquement (pas de glow orange) |
| Gradients | ABSOLUMENT AUCUN gradient — couleurs SOLIDES |

---

*Recherche complète le 2026-07-22 — 30 composants identifiés et mappés aux écrans Lumina*
