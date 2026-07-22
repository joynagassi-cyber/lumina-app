# Spécifications UX — Lumina v2

> **Document : PHASE 4 — Specifications**  
> Créé le 2026-07-22 par Freya (WDS Designer)  
> Projet : Lumina — Plateforme Universelle d'Organisation  
> Design System : Spotify style (#121212 + orange #FF6B00)

---

## 1. Règles Générales d'UX

### 1.1 Palette & Typographie

| Token | Valeur | Usage |
|-------|--------|-------|
| `bg-primary` | `#121212` | Fond principal |
| `bg-surface` | `#181818` | Cards, panels |
| `bg-elevated` | `#282828` | Hover, inputs, active states |
| `accent-fire` | `#FF6B00` | CTA, highlights, liens, icons actives |
| `text-primary` | `#FFFFFF` | Titres |
| `text-secondary` | `#B3B3B3` | Body text |
| `text-muted` | `#808080` | Labels, metadata, placeholders |
| `data-positive` | `#1DB954` | Recettes, soldes positifs |
| `data-negative` | `#E51332` | Dépenses, alertes |
| `data-warning` | `#FFB800` | En attente, warnings |

**Font Family :** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`

### 1.2 Espacements

| Token | Valeur | Usage |
|-------|--------|-------|
| `space-xs` | 4px | Icônes compactes |
| `space-sm` | 8px | Padding interne cards |
| `space-md` | 16px | Padding standard |
| `space-lg` | 24px | Sections, gaps entre cards |
| `space-xl` | 32px | Marges externes |
| `space-2xl` | 48px | Espacements hero |

### 1.3 Rayons

| Token | Valeur | Usage |
|-------|--------|-------|
| `radius-card` | 8px | Cards, inputs |
| `radius-pill` | 100px | Boutons, pills, avatars |
| `radius-icon` | 12px | Boutons icônes |

### 1.4 Animations Globales

| Action | Animation | Durée | Easing |
|--------|-----------|-------|--------|
| Tap bouton | Scale 0.97 → 1.0 | 120ms total | ease-out |
| Page slide right | TranslateX(100%) → 0% | 250ms | ease-in-out |
| Bottom sheet up | TranslateY(100%) → 0% | 300ms | spring(0.6, 30) |
| Skeleton shimmer | Gradient pulse left→right | 1.2s infinite | linear |
| Fade in card | Opacity 0 → 1, Y 8px → 0 | 200ms | ease-out |
| Loading spinner | Rotate 360° | 800ms | linear infinite |

---

## 2. Layout Global Applicatif

### 2.1 Sidebar (Navigation Verticale)

```
Position : Fixed, left: 0, top: 0, bottom: 0
Largeur : 80px
Fond : #000000
```

**Éléments :**
```
┌──────────┐
│   L      │ ← Logo circulaire orange 40×40px (centered, top: 24px)
├──────────┤
│ 🏠       │ ← Dashboard link (active highlight orange if current)
│ 💰       │ ← Finance
│ 👥       │ ← Members
│ 📅       │ ← Calendar
├──────────┤
│          │ ← Spacer
├──────────┤
│ [Avatar] │ ← Avatar utilisateur, 32×32px (bottom)
└──────────┘
```

**Comportement :**
- Logo : hover scale 1.08, shadow-orange glow subtil
- Navigation items : 
  - Inactif : couleur #B3B3B3, hover devient #FFFFFF
  - Actif : couleur #FF6B00 avec fond #282828 et border-radius 8px
  - Active indicator : barre verticale orange à gauche 4×24px
- Avatar : hover outline #FF6B00, click ouvre dropdown menu

### 2.2 Top Bar (Header Sticky)

```
Position : Sticky, top: 0, left: 80px, right: 0
Fond : rgba(18,18,18, 0.95) avec backdrop-filter blur(8px)
Height : auto, padding vertical 16px
```

**Contenu typique :**
```
┌─────────────────────────────────────────────┐
│ Lumina                          🔍 [i]     │ ← Top bar simple
└─────────────────────────────────────────────┘
```

OU

```
┌─────────────────────────────────────────────┐
│ ← Grand Livre            [Export] [Filtre]  │ ← Top bar avec actions
└─────────────────────────────────────────────┘
```

---

## 3. Spécifications Page par Page

### PAGE : Login (`/auth/login`)

**Layout :**
- Fond : `#121212`
- Contenu centré verticalement et horizontalement
- Max-width : 420px

**Éléments (de haut en bas) :**

```
┌─────────────────────────────────────┐
│                                     │
│         [ O ]                       │ ← Logo circulaire orange 64×64px
│         L                           │    avec animation pulse (scale 1 → 1.05)
│                                     │
│    Lumina                           │ ← Titre H1 28px bold, #FFF
│  Plateforme Organisationnelle       │ ← Sous-titre 14px #808080
│                                     │
│  Email                              │
│  ┌─────────────────────────────┐    │ ← Input pill shape, fond #181818
│  │ vous@mfejc.org              │    │    border #282828, focus #FF6B00
│  └─────────────────────────────┘    │
│                                     │
│  Mot de passe                       │
│  ┌─────────────────────────────┐    │ ← Input pill shape
│  │ ••••••••                    │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌─────────────────────────────┐    │
│  │     Se connecter            │    │ ← Bouton primary pill, fond #FF6B00
│  └─────────────────────────────┘    │    texte #000, hover #FF8533
│                                     │
│  ┌─────────────────────────────┐    │
│  │ Demander un accès admin     │    │ ← Lien secondaire pill outline
│  └─────────────────────────────┘    │    border #282828, hover orange
│                                     │
│  [●] Fonctionne hors-ligne          │ ← Badge discretpill, #181818 fond
│                                     │
└─────────────────────────────────────┘
```

**États :**
| État | Description |
|------|-------------|
| Default | Inputs vide, bordure #282828 |
| Focus | Input actif : border devient `#FF6B00`, glow subtil |
| Error | Border rouge #E51332, message erreur en dessous |
| Loading | Bouton désactivé, spinner blanc dans le bouton |
| Disabled | Fond input #0a0a0a, texte #535353 |

**Interactions :**
- Taper sur input : focus border orange, clavier muncul
- Taper "Se connecter" (disabled si email ou mot de passe vide) : spinner loading
- Après authentification réussie : slide-right transition vers Dashboard
- Erreur auth : shake animation sur le formulaire + message rouge sous le champ concerné

### PAGE : Dashboard Principal (`/main/dashboard`)

**Layout :**
- Padding global : 32px
- Sidebar 80px fixe à gauche
- Contenu principal : max-width 1100px

**Structure (de haut en bas) :**

```
┌─────────────────────────────────────────────────────────────────┐
│ Bonjour, Pasteur Jean                                            │ ← Salutation H2 32px bold
│ MFE-JC • Commun centrale                                         │ ← Meta #808080 14px
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   Solde Disponible                     +2 510 000 F              │ ← Hero Card bg #181818
│                                                   ce mois       │    border #282828
│                                                   ✓ +12.4%       │    padding 32px
│                                                   vs juin        │
│                                                 [↑ Trend badge]   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌──────────────────────┐ ┌──────────────────────┐
│ Recettes             │ │ Dépenses             │
│ +4 850 000 F         │ │ -2 340 000 F         │
│ 24 transactions      │ │ 18 transactions      │
└──────────────────────┘ └──────────────────────┘  ← Stats Grid 2x2
                                                        bg #181818, border #282828

Actions Rapides                                                          ← Section label 14px #FFFFFF bold 700
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ [+]          │ │ [👤]         │ │ [📅]         │ │ [📄]         │
│ Transaction  │ │ Membres      │ │ Événement    │ │ Rapport      │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  ← Action Pills
       Orange                         Outline                      bg #181818
       border #282828                  hover #282828                 full width mobile

Récemment                                                                 ← Section label
┌─────────────────────────────────────────────────────────────────────┐
│ Récemment                                        Tout voir →          │
├─────────────────────────────────────────────────────────────────────┤
│ ● Dîme — Groupe Anoungui        09:32  +850 000 F                   │
│   Recette • Dîme                             ✓ Immutable           │
│ ● Fournitures pastorales        14:18  -125 000 F                   │
│   Dépense                                                   ● 21 juil│
└─────────────────────────────────────────────────────────────────────┘  ← Feed Card
                                                                         bg #181818, border #282828
                                                                         item hover bg #282828
```

**Éléments clés du Hero Card :**
- Fond : `#181818` (sur bg `#121212`)
- Border : `#282828`
- Label "Solde Disponible" : 12px uppercase letter-spacing 1.5px `#808080`
- Montant `+2 510 000 F` : 56px font-weight 800 `#FF6B00` letter-spacing -1.5px
- Trend "+12.4%" : badge vert `#1DB954` 14px

**Éléments du Feed Transactions :**
- Chaque item = flex row (dot + info + amount + time)
- Dot color : vert `#1DB954` pour income, rouge `#E51332` pour expense, jaune `#FFB800` pour pending
- Nombre à gauche de chaque ligne : gris `#808080`, devient orange au hover
- Nom transaction : 14px font-weight 500 `#FFF`, truncated avec ellipsis
- Meta : 12px `#808080`
- Montant : 14px font-weight 700 aligné à droite
- Immutable badge : petit badge doré `#B3B3B3` bg `#282828` 10px uppercase

**Interactions :**
- Tap Hero Card → navigation vers page Bilan Financier
- Tap Stats Card → navigation vers rapport détaillé
- Tap Action Pill Primary (orange) → ouvre Bottom Sheet quick-create transaction
- Tap Action Pill Secondary (outline) → navigation vers la feature respective
- Tap Feed Item → Master-Detail slide-in depuis la droite (Transaction Detail)
- Swipe Left sur feed item → reveal Actions (Delete/Hold/Delete All)
- Pull-to-refresh → reload dashboard data

### PAGE : Grand Livre (`/main/finance/ledger`)

**Structure :**
```
┌─────────────────────────────────────────────────────────┐
│ ← Grand Livre                            [Exporter]     │ ← Topbar
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ 🔍 Rechercher une transaction, un membre...             │ ← Search bar pill
└─────────────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ +4 850 000 F │ │ -2 340 000 F │ │ +2 510 000 F │
│ Recettes     │ │ Dépenses     │ │ Solde        │
│ 24 tx        │ │ 18 tx        │ │ Excédentaire │
└──────────────┘ └──────────────┘ └──────────────┘  ← Summary cards

[Dîmes] [Offrandes] [Dépenses] [En attente] [Dons]  ← Filter chips

Aujourd'hui                                                                         ← Date separator
─────────────────────────────────────

● Dîme — Groupe Anoungui     +850 000 F        09:32
  Recette • Dîme • ✓ Immutable
● Fournitures pastorales      -125 000 F        14:18
  Dépense • Supplies

Hier — 21 Juillet 2026
─────────────────────────────────────

● Offrande — Culte Dimanche   +1 240 000 F      11:45
  Recette • Offrande • ✓ Immutable
⏳ Rénovation salle             ⏳ 350 000 F      En attente
  Dépense • En cours d'approbation

[INV-001 banner] Transaction validée = immuable
```

**Composants clés :**

**Search Bar :**
- Forme : pill (border-radius 100px)
- Fond : `#181818`, border `#282828`
- Focus : border `#FF6B00`
- Icône search à gauche : 16px `#808080`

**Filter Chips :**
- Style : pills, bg `#181818`, border `#282828`, texte `#B3B3B3`
- Actif : bg `#FF6B00`, texte `#000`, border `#FF6B00`
- Scrollable horizontal
- Tap inactive chip → devient active, autres devenues inactives

**Summary Cards :**
- Grille 3 colonnes
- Card : bg `#181818`, border `#282828`, padding 20px
- Label : 11px uppercase 600 `#808080`
- Montant : 22px font-weight 800 `#FF6B00` (solde), `#1DB954` (recettes), `#E51332` (dépenses)

**Date Separator :**
- Position : au-dessus du premier item de cette date
- Texte : 11px uppercase 700 `#808080` letter-spacing 1px
- Ligne horizontale s'étendant après le texte

**FAB (Floating Action Button) :**
- Position : fixed bottom-right 28px
- Cercle plein 56px, fond `#FF6B00`
- Icone "+" blanche 24px, stroke-width 3
- Shadow-orange : 0 8px 24px rgba(255,107,0,0.3)
- Hover : scale 1.06 + shadow plus grand
- Tap : ouvre Bottom Sheet "Nouvelle Transaction"

---

### PAGE : Transaction Detail (`/main/finance/transactions/:id`)

**Layout :** Master-Detail slide-in depuis la droite

```
┌──────────────────────────────────────────────────┐
│ ← Détails Transaction                             │
└──────────────────────────────────────────────────┘

Montant : +850 000 F              14px #1DB954 bold

Type : Recette                      14px #808080
Date : 22 Juillet 2026, 09:32     14px #808080
Catégorie : Dîmes                 14px #808080
Description : Dîme groupe...      14px #808080
Statut : ✓ Approuvée              14px green badge
Immutable : ✓ Oui                 14px gold badge

Historique des Approbations
────────────────────────────────────────────────────
Créée par Ama le 22/07 à 09:32
Approuvée par Jean le 22/07 à 10:15
Commentaire : "Valide ✓"

Compensations : (aucune)
```

**Éléments :**
- Header : back button 32px, titre
- Montant : très gros 32px font-weight 800
- Sections séparées par espacement 24px
- Status badges : small pills 10px

**Interactions :**
- Back swipe → retour Grand Livre
- Tap "Approbations" → expand section
- Disponible seulement si status 'pending' : boutons Approve/Reject en bas

---

### PAGE : Members List (`/main/members/list`)

**Structure :**
```
┌──────────────────────────────────────────────────┐
│ Membres                                    [+Ajouter] │
└──────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ 247          │ │ 12           │ │ 8            │ │ 5            │
│ Total        │ │ Nouveaux     │ │ Groupes      │ │ Rôles        │
│ membres      │ │ ce mois      │ │              │ │ actifs       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘

[🔍 Rechercher un membre...]      [Tous] [Leaders] [Trésoriers] [Groupes]

● JK — Jean Konan                          Leader
  Pasteur • Leader
● AT — Ama Toure                           Trésorier
  Trésorière • Finance
● BK — Bruno Koffi                         Membre
  Diacre • Groupe Anoungui
● MK — Marie Yao                           Membre
  Médiatrice • Chant
```

**Composants clés :**

**Stats Cards 4 colonnes :**
- Chacune : bg `#181818`, border `#282828`
- Valeur : 28px font-weight 800 `#FF6B00`

**Member Row :**
- Avatar circulaire 40×40px avec initiales ou photo
- Couleur avatar varie selon rôle (orange, vert, rouge...)
- Nom : 14px font-weight 500 `#FFF`
- Rôle : 12px font-weight 500 `#808080`
- Status badge aligné à droite

**Recherche :**
- Search bar pill avec debounce 300ms
- Résultats filtrés en temps réel

**Interactions :**
- Tap member row → Profile Card detail slide-in
- Swipe left → Edit/Delete actions
- Long press member → quick-action menu (View Profile / Edit / Remove)
- Pull-to-refresh → update list

---

### PAGE : Calendar (`/main/events/calendar`)

**Structure :**
```
┌──────────────────────────────────────────────────┐
│ Calendrier                              [+Événement] │
└──────────────────────────────────────────────────┘

[‹] [22 – 28 Juillet 2026] [›]     [Aujourd'hui]

Lun    Mar    Mer    Jeu    Ven    Sam    Dim
 22      23     24     25     26     27*     28

08h  │ [Prière]  │           │
     │ 10:00     │           │
     ├───────────┼───────────┤
10h  │[Culte]    │[Culte]    │
     │ 09:00     │ 10:00     │
     ├───────────┼───────────┤
15h  │           │[Formation] │
     │           │ 15:00     │
```

**Interactions :**
- Navigation semaines : flèches ‹ ›
- Tap date → view day events
- Pull-to-refresh
- Event chips : couleurs selon type (worship=#FF6B00, prayer=#8B5CF6, meeting=#E51332)
- Long press event → quick action

---

## 4. States Unifiés

### 4.1 États de Transaction

| État | Badge | Couleur | Signification |
|------|-------|---------|---------------|
| Draft | Brouillon | `#808080` | Enregistrée localement, pas envoyée |
| Pending | En attente | `#FFB800` | Soumise à approbation |
| Approved | ✓ Approuvée | `#1DB954` | Validée, immutable (INV-001) |
| Rejected | ✕ Rejetée | `#E51332` | Rejetée, retour en draft |
| Archived | Archivée | `#6B7280` | Conserver pour audit |

### 4.2 États de Sync

| État | Indicateur | Couleur | Comportement |
|------|-----------|---------|--------------|
| Online | Point vert pulsant | `#1DB954` | Sync automatique actif |
| Offline | Barre grise | `#808080` | Operations locales uniquement |
| Syncing | Spinner + compteur | `#FF6B00` | En cours de sync |
| Conflict | Triangle orange | `#FFB800` | Requiert résolution manuelle |

### 4.3 États d'Auth

| État | Visual | Comportement |
|------|--------|-------------|
| Logged out | Login screen | Écran connexion |
| Logging in | Spinner overlay | Bouton disable |
| Authenticated | Dashboard | Sidebar + content |
| Session expired | Login + toast | Message "Session expirée" |

---

## 5. Transitions & Navigation

### 5.1 Navigation Principale

| Transition | Direction | Durée | Type |
|------------|-----------|-------|------|
| Tab bar change | Horizontal slide | 250ms | iOS push |
| Modal open | Vertical slide-up | 300ms | Spring |
| Bottom sheet | Vertical slide-up | 300ms | Spring + dim background |
| Back (gesture) | Right to left | 250ms | Finger-driven |
| Page refresh | Pull-down | 200ms | Content fade |

### 5.2 Micro-interactions

**Tap Feedback :**
- Les éléments interactifs réduisent légèrement (scale 0.98) puis reviennent à 1.0
- Si élément est un bouton principal (orange) : léger boost de brillance au tap

**Pull-to-Refresh :**
- Icône de refresh tourne 180° pendant le pull
- Relâchement → reset avec animation elastic

**Empty State :**
- Pas de liste = pas d'écran vide !
- Si liste vide → message simple centré : "Aucune donnée trouvée" + bouton d'action

### PAGE : Rapport Financier (`/main/finance/report`)

**Layout :**
- Fond : `#121212`
- Padding : 32px

```
┌──────────────────────────────────────────────────┐
│ ← Rapport Financier    [Juillet ▾]              │ ← Top bar
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│                                                  │
│   Résultat Net                     +2 510 000 F  │ ← Hero huge number
│                                                  │    64px #FF6B00 800
│          Excédentaire • 51.9% taux épargne       │    sous-titre #B3B3B3
│                                                  │
└──────────────────────────────────────────────────┘

┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ Recettes     │ │ Dépenses     │ │ Taux Épargne │
│ 4 850 000 F  │ │ 2 340 000 F  │ │ 51.9%        │
│ 24 tx        │ │ 18 tx        │ │ Santé ✓      │
└──────────────┘ └──────────────┘ └──────────────┘  ← Stats Row 3 cols

Activité Hebdomadaire                                              ← Section title
─────────────────────────────────────────────────────────────
Lun    Mar    Mer    Jeu    Ven    Sam    Dim                  ← X axis labels
███    █      ███████  ██     ████   ████████   █              ← Bars
███    █      ███████  ██     ████   ████████   █              │ #1DB954=income
███████████████████████████████████████████████████            │ #E51332=expense

[█] Recettes   [█] Dépenses                                   ← Legend

Répartition des Dépenses                                       ← Section title
─────────────────────────────────────────────────────────────
Salaires & Rémunérations                 ████░░░░░░ 45%  1 053k
Factures & Charges                         ██░░░░░░░░ 20%   468k
Projets & Rénovation                        █░░░░░░░░░ 15%   351k
Événements                                  █░░░░░░░░░ 10%   234k
Autres                                      █░░░░░░░░░ 10%   234k
─────────────────────────────────────────────────────────────
[██████████████████████████████████████████████████████]   ← ProgressBar total

─────────────────────────────────────────────────────────────
  📥 Télécharger PDF           [CSV]                           ← Export CTA
─────────────────────────────────────────────────────────────
  Bouton primary : pill shape bg #FF6B00 texte #000
  Bouton secondary : outline #808080 hover #FF6B00
```

**Composants clés :**

**Hero Result Card :**
- Fond : `#181818` (sur `#121212`)
- Border : `#282828`
- Padding : 36px
- Label "Résultat Net" : 12px uppercase 600 `#808080` letter-spacing 1.2px
- Valeur : 64px font-weight 800 `#FF6B00` letter-spacing -2px
- Sous-titre : 14px font-weight 500 `#B3B3B3`
- Le chiffre peut être négatif → devient rouge `#E51332`

**Stats Row :**
- 3 colonnes égales (recettes / dépenses / taux)
- Chaque card : `bg #181818`, border `#282828`, padding 24px
- Label : 11px uppercase 600 `#808080`
- Valeur : 24px font-weight 800, couleur selon type
- Sous-valeur : 11px `#808080`

**Bar Chart :**
- Height fixe 120px pour les bars
- 2 bars par jour côte à côte (income + expense)
- Bar income : `#1DB954`, rounded top 4px
- Bar expense : `#E51332`, rounded top 4px
- Gap entre pairs 8px, gap jours 16px
- Labels jour : 10px font-weight 600 `#808080`

**Category Breakdown :**
- Chaque ligne = name + percentage + amount
- Barre de progression horizontale
- Remplissage orange `#FF6B00` pour le premier item, vert `#1DB954` pour le second
- Montant aligné à droite : 14px font-weight 700 `#E51332`

**Interactions :**
- Tap sur Stats Card → navigation vers rapport détaillé de cette catégorie
- Tap sur label de bar chart → show tooltip avec valeur exacte
- Period Selector → dropdown modal (mensuel/trimestriel/annuel)
- Swipe sur category items → reveal options (export individual)
- Pull-to-refresh → re-calculate bilan from server

---

### PAGE : Approvals Pending (`/main/approvals/pending`)

**Layout :**
- Fond : `#121212`
- Titre page : "Mes Approbations"

```
┌──────────────────────────────────────────────────┐
│ Mes Approbations                    [3 en attente]│
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 🔍 Filtrer les approbations...                   │
└──────────────────────────────────────────────────┘

[Dîmes] [Dépenses] [Toutes les catégories]         ← Filter chips

Transaction nécessite votre approbation             ← Alert banner
─────────────────────────────────────────────────────
┌──────────────────────────────────────────────────┐ │
│ ● Rénovation salle                               │ │
│   Projet de rénovation de la chapelle principale │ │
│                                                  │ │
│  Catégorie : Projets                             │ │
│  Montant : 350 000 F                             │ │ ← Orange bold
│  Date proposée : 21 Juillet 2026                 │ │
│  Proposé par : Ama Toure                         │ │
│  Seuils requis : Double approbation              │ │
│                                                  │ │
│  ┌──────────────────┐ ┌──────────────────┐      │ │
│  │   Approuver      │ │    Rejeter       │      │ │
│  └──────────────────┘ └──────────────────┘      │ │
│                                              ✓    │ │
└──────────────────────────────────────────────────┘ │
─────────────────────────────────────────────────────

┌──────────────────────────────────────────────────┐
│ ● Achat matériel audiovisuel                     │
│   Projecteur et système son                      │
│  280 000 F | 22 juil. | Par Bruno Koffi          │
│  ┌──────────────────┐ ┌──────────────────┐      │
│  │   Approuver      │ │    Rejeter       │      │
│  └──────────────────┘ └──────────────────┘      │
└──────────────────────────────────────────────────┘
```

**Composants clés :**

**Approval Card :**
- Fond : `#181818`, border `#282828`
- Border-left : 4px orange si urgent, gris si standard
- Padding : 20px
- Header : dot color + titre transaction + montant
- Body : meta info en 12px `#808080`
- Footer : boutons d'action (primary/secondary)

**Boutons d'action :**
- Approve : pill orange fond `#FF6B00`, texte `#000`
- Reject : pill outline, fond transparent, border `#808080`, texte `#B3B3B3`
- Hover approve : fond `#FF8533`
- Hover reject : border `#FF6B00`, texte `#FF6B00`

**Modal Commentaire (obligatoire BR-FIN-013) :**
- Quand on tappe Approve ou Reject → bottom sheet slide-up
- Champ texte obligatoire : "Raison de la décision"
- Boutons : "Confirmer" / "Annuler"

**Interactions :**
- Tap sur card → ouvre detail view complet de la transaction
- Tap Approve → ouvre Modal Commentaire
- Tap Reject → ouvre Modal Commentaire avec option "Return to Draft"
- Confirmation après action : toast "Transaction approuvée ✓" ou "Transaction rejetée ✕"
- Swipe left sur card → quick action (Approve without comment)
- Pull-to-refresh → fetch new pending approvals

---

### PAGE : Profile Membre (`/main/members/:id`)

**Layout :** Master-detail slide-in depuis la droite

```
┌──────────────────────────────────────────────────┐
│ ← Profil Membre            [✎ Modifier] [⋮]      │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│                                                  │
│        [Avatar circulaire 72x72px]               │
│             JK                                   │
│                                                  │
│    Jean Konan                                    │ ← 24px bold
│    Pasteur • Leader                              │
│    Pasteur depuis Jan 2020                       │
│                                                  │
│    ✉ jean@mfejc.org    📱 +225 07 01 02 03       │
│                                                  │
└──────────────────────────────────────────────────┘

Ministères                                                  ← Section
─────────────────────────────────────────────────────────────
• Conseil Pastoral         Active    Depuis 2023
• Chorale                  Active    Depuis 2018
• Comité Finance           Assignée   En attente validation

Historique des Transactions                                 ← Section
─────────────────────────────────────────────────────────────
● Dîme — Groupe Anoungui    +850 000 F  22 juil.  ✓
● Don personnel             +200 000 F  20 juil. ✓
● Fournitures pastorales    -125 000 F  18 juil.
─────────────────────────────────────────────────────────────

Événements associés                                         ← Section
─────────────────────────────────────────────────────────────
● Culte du Dimanche         22/07 • Pasteur principal
● Réunion elders            21/07 • Participant
──
```

**Interactions :**
- Back swipe → retour Members List
- Tap "[✎ Modifier]" → Edit Profile Bottom Sheet
- Tap "[⋮]" → Context menu (View All / Share / Remove)
- Tap ministry item → ministry detail expand
- Tap transaction row → Transaction Detail
- Tap event row → Event Detail
- Pull-to-refresh → update profile data

---

### PAGE : Edit Profile (`/main/members/:id/edit`)

**Layout :** Full-screen form in bottom sheet

```
┌──────────────────────────────────────────────────┐
│ Modifier                                         │
├──────────────────────────────────────────────────┤
│ Prénom                                           │
│ ┌──────────────────────────────────────────────┐ │
│ │ Jean                                         │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Nom                                              │
│ ┌──────────────────────────────────────────────┐ │
│ │ Konan                                        │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Email (optionnel)                                │
│ ┌──────────────────────────────────────────────┐ │
│ │ jean@mfejc.org                               │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ Téléphone                                        │
│ ┌──────────────────────────────────────────────┐ │
│ │ +225 07 01 02 03                             │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│ État                                             │
│ ┌──────────────────────────────────────────────┐ │
│ │ ● Actif  ○ Inactif  ○ Transféré  ○ Décédé    │ │
│ └──────────────────────────────────────────────┘ │
│                                                  │
│  ┌──────────────────────────────────────────────┐ │
│  │           Sauvegarder                        │ │
│  └──────────────────────────────────────────────┘ │
│                                                  │
│  [Annuler]                                       │
└──────────────────────────────────────────────────┘
```

---

### PAGE : Configuration Organisation Setup (`/main/org/setup`)

**Layout :** Wizard multi-étapes avec progress bar

```
┌──────────────────────────────────────────────────┐
│ Configuration Organisation                       │
├──────────────────────────────────────────────────┤
│ ━━━━━━━━━━━━●━━━━━━━━━━━ 2/4                   │ ← Progress bar
└──────────────────────────────────────────────────┘

Étape 2 sur 4 : Informations Principales

Nom de l'organisation                    ← Label 13px #B3B3B3
┌──────────────────────────────────────────────┐
│ MFE-JC — Commun centrale                     │ ← Input bg #181818 border #282828
└──────────────────────────────────────────────┘
                                               ← Field hint: généré automatiquement
ID unique: org-mfejc-central-001

Pays / Région
┌──────────────────────────────────────────────┐
│ Côte d'Ivoire                                │
└──────────────────────────────────────────────┘

Types d'organisation disponibles               ← Section
┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐
│ ⛪ Église  │ │ 🏫 École   │ │ 🏢 Entreprise│ │ 🌍 ONG     │
└────────────┘ └────────────┘ └────────────┘ └────────────┘
    [sélectionné]   outline          outline          outline

  ┌──────────────────────────────────────────┐
  │   Suivant →                              │
  └──────────────────────────────────────────┘
  
  [← Retour]         [Terminer]
```

**Étapes du wizard :**
1. **Type d'organisation** — Sélectionner église/école/entreprise/NGO/custom
2. **Informations principales** — Nom, ID auto-généré, pays/région
3. **Modules actifs** — Toggles pour chaque capability engine
4. **Aperçu Manifest** — Preview YAML du manifest généré + bouton "Terminer"

**Composants clés :**

**Progress Bar :**
- Barre en haut de la page, hauteur 4px, bg #282828
- Fill dynamique avec gradient #FF6B00→#1DB954
- Indicateur circulaire sur chaque étape complétée

**Type Selector Cards :**
- Grille 2×2 ou 2×4
- Card : bg `#181818`, border `#282828`, padding 16px, centered text
- Sélectionnée : border `#FF6B00`, bg `rgba(255,107,0,0.08)`
- Icone emoji au-dessus du nom du type

**Manifest Preview :**
- Card sombre fond `#1A1A2E`
- Texte monospace blanc avec syntax highlighting orange/violet
- Scrollable vertical
- Bouton "Copier le Manifest"

**Interactions :**
- Navigation étapes : boutons Suivant/Retour en bas
- Swipe horizontal entre étapes
- Étape finale affiche manifest YAML + bouton "Terminer"
- Validation champs obligatoires avant d'activer "Suivant"
- Annuler → confirmation dialog "Perdre les modifications ?"

---

### PAGE : Org Hierarchy (`/main/org/hierarchy`)

**Layout :** Tree View vertical avec indentation

```
┌──────────────────────────────────────────────────┐
│ Hiérarchie Organisation    [➕ Créer enfant] [⋮] │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ 🔍 Rechercher une organisation...                │
└──────────────────────────────────────────────────┘

[🏛️] Union Nationale des Eglises MFE-JC          ← Root node (expanded)
     │  Status: active  |  3 organisations enfants
     ├─ [🏢] Fédération Est                       ← Child
     │   │  Status: active | 2 enfants
     │   ├─ [🏛️] District Nord                    |— Child
     │   │  │  Status: active | 2 enfants          |— Child
     │   │  │  MFE-JC Commun centrale            |— Leaf
     │   │  └─ [🏛️] MFE-JC Commun sud            |— Child
     │   └─ [🏛️] District Sud                     |— Child
     │      │  Status: pending (incomplete config)|— Child
     └─ [🏢] Fédération Ouest                      |— Child
         │  Status: active | 1 enfant              |— Child
         └─ [🏛️] District West                    |— Child
            │  Status: archived                    |— Leaf
```

**Composants clés :**

**Tree Node :**
- Structure flex (indent × depth + icon + name + status badge + actions)
- Icone préfixe : différente selon type d'orga
- Nom : 14px font-weight 500 `#FFF`
- Status badge : petit pill (active=#1DB954, pending=#FFB800, archived=#6B7280)
- Chevron rotation : rotate 0° quand collapsed, 90° quand expanded

**Indentation :**
- Chaque niveau d'imbrication ajoute 16px de padding gauche
- Ligne verticale connectrice entre parent/enfant (color `#282828`)

**Context Actions (⋮) :**
- Menu déroulant : Edit Name / Transfer Parent / Merge / Archive / Delete
- Confirmation requise pour Delete (2 steps)

**Interactions :**
- Tap chevron → expand/collapse cette branche
- Tap node → navigate to org config/detail
- Drag-and-drop node → changeparent (requires admin permission)
- Long press → context menu
- Search → highlight matching nodes + auto-expand parents

---

### PAGE : Sync Queue (`/main/offline/sync-queue`)

**Layout :** Liste des opérations en attente

```
┌──────────────────────────────────────────────────┐
│ Synchronisation                            [↻]   │
├──────────────────────────────────────────────────┤
│ 3 opération(s) en attente de synchronisation     │
│ Connexion détectée · Démarrage...                │
├──────────────────────────────────────────────────┤

● Envoyer transaction #abc123       │ Processing
  ─────────────────────────────────────────────────
  Réception de confirmation...       │ ⏳ 45%

● Mettre à jour membre AT-004        │ Queued
  En file d'attente...               │ ⏸️

● Confirmer suppression événement EV │ Failed
  Erreur: conflict_detected          │ 🔴 Retry
```

**Composants clés :**

**Status Header:**
- Message dynamique selon état réseau :
  - "Connexion détectée · Démarrage..." (syncing)
  - "Hors-ligne · Opérations locales" (offline)
  - "Synchronisé · 0 opération en attente" (done)
- Refresh button à droite

**Sync Operation Item:**
- Fond : `#181818`, border `#282828`
- Left : description de l'opération (type + ID)
- Middle : progress bar ou spinner
- Right : status indicator (spinner/queued/failed/success)

**States :**
| État | Comportement |
|------|-------------|
| Processing | Spinner tourne, progress bar avance |
| Queued | Icône pause, en attente des précédents |
| Failed | Rouge, bouton Retry visible, message d'erreur court |
| Success | Vert, disparait automatiquement après 2s |

**Interactions :**
- Tap item failed → détail de l'erreur + option retry
- Tap Retry → ré-exécute l'opération individuelle
- Tap "[↻]" refresh → force sync manuel
- Swipe item → Retry/Dismiss options

---

### PAGE : Settings (`/main/settings/profile`)

**Layout :** Groupes de préférences en cartes séparées

```
┌──────────────────────────────────────────────────┐
│ Paramètres                                      │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Profil                                           │
│ ┌────────────┐                                   │
│ │  [Avatar]  │  Jean Konan                       │
│ │    JP      │  pasteur@mfejc.org                │
│ │            │  [Modifier]                       │
│ └────────────┘                                   │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Sécurité                                         │
│ Mot de passe ........................ [Changer]   │
│ Sessions actives ......... 1 appareil connecté   │
│ └─────────────────────────────────────────────── │
│   iPhone 15 Pro · Abidjan · Depuis 2h · [X]      │
│   [Déconnexion de toutes les sessions]            │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ Préférences                                     │
│ Langue ............ Français    [▼]              │
│ Thème ............. Sombre (fixe)                │
│Notifications ..... [Switch ON/OFF]              │
│ └─────────────────────────────────────────────── │
│ Son ............... [Switch ON]                  │
│ Haptiques .......... [Switch OFF]                │
└──────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────┐
│ À propos                                        │
│ Version ........... 2.0.0                        │
│ Licence ........... MIT                          │
│ └─────────────────────────────────────────────── │
│ Platform Core v2.0                               │
│ Offline-First Architecture                       │
│ WatermelonDB + InsForge                          │
│ © 2026 Lumina                                    │
└──────────────────────────────────────────────────┘
```

**Composants clés :**

**Settings Group :**
- Fond `#181818`, border `#282828`, border-radius 8px
- Sections séparées par espacement 16px

**Setting Row :**
- Layout : label (left) | value (right) | chevron far right
- Hauteur minimum 44px tap target
- Separator bottom : 1px `#282828`
- Last row of group : no separator

**Toggle Switch :**
- Style pill 48×26px
- OFF : fond `#282828` (slate), thumb blanc à gauche
- ON : fond `#FF6B00` (orange fire), thumb blanc à droite
- Animation slide smooth

**Interactions :**
- Tap setting row → opens sub-page or bottom sheet
- Tap toggle → instant switch with haptic feedback
- Tap avatar → camera/gallery picker
- Pull-to-refresh → reload settings

---

## 6. Spécifications des Modals & Overlays

### 6.1 Bottom Sheet

```
Position : fixed bottom, full width
Slide-up animation : 300ms spring
Background dim : rgba(0,0,0,0.7)
Handle : line 24px x 4px centered top (draggable for resize)
```

**Utilisations :**
- Create Transaction Quick Form (partial height ~60%)
- Edit Profile Form (medium height ~70%)
- Confirmation Dialogs (small height ~30%)
- Ministry Assignment Multi-select (medium ~50%)

**Gestures :**
- Swipe down → close sheet (with dismiss animation)
- Swipe up → resize to next preset height

### 6.2 Master-Detail Slide

```
Position : fixed right, full height
Width : ~85% mobile, ~400px desktop
Slide-from-right animation : 250ms ease-out
Back gesture : swipe left to right
```

**Utilisations :**
- Transaction Detail (depuis Grand Livre)
- Member Profile Card (depuis Members List)
- Event Detail (depuis Calendar)

### 6.3 Dialog / Confirmation

```
Position : center screen
Size : max-width 320px
Rounded corners : 16px
Overlay : darkened background with blur
Animation : scale-in + fade-in 200ms
```

**Utilisations :**
- "Confirm delete this transaction?"
- "Confirm change organization?"
- "Confirm remove member?"

---

## 7. Accessibility & Performance Rules

### 7.1 Touch Targets
- Minimum 44×44px sur tous les éléments interactifs (Apple HIG / Material 3 floor)
- Étendre hit areas beyond visual bounds si nécessaire

### 7.2 Contrast Requirements
- Texte principal sur fond sombre : contraste ≥ 4.5:1 (WCAG AA)
- Texte secondaire : contraste ≥ 3:1 (large text)
- Orange `#FF6B00` sur `#121212` : ~5.8:1 ✓
- Orange `#FF6B00` sur `#181818` : ~5.2:1 ✓

### 7.3 Keyboard/Accessibility
- Focus ring visible sur tous les éléments interactifs
- Touch targets ≥ 44×44px
- Support VoiceOver / TalkBack labels sur tous les éléments

### 7.4 Loading States
- Skeleton screens pour toutes les cartes qui chargent
- Shimmer animation orange subtil : `linear-gradient(90deg, #282828, rgba(255,107,0,0.05), #282828)`
- Pas de spinner sur les petites actions (utiliser inline skeleton)

---

*Spécifications UX complètes créées le 2026-07-22 — Lumina v2*

