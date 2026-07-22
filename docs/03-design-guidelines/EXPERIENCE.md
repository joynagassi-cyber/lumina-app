# EXPERIENCE — Plateforme Universelle d'Organisation Lumina v2

> **Document : USER EXPERIENCE FRAMEWORK**  
> Créé le 2026-07-22 par WDS Designer (Freya)  
> Projet : Lumina — Plateforme Universelle d'Organisation  
> Aligné avec ADR-011 (Design System), SCENARIOS-UX.md, SCHEMAS-5W1H.md

---

## Table des Matières

1. [Principes Fondamentaux d'Expérience](#1-principes-fondamentauxdexperience)
2. [Architectures de Navigation](#2-architectures-de-navigation)
3. [Parcours Utilisateur Critiques](#3-parcours-utilisateur-critiques)
4. [Patterns d'Interaction](#4-patterns-dinteraction)
5. [Gestion des États](#5-gestion-des-etats)
6. [Accessibilité & Inclusivité](#6-accessibilité--inclusivité)
7. [Feedback & Communication Système](#7-feedback--communication-système)
8. [Offline-First Experience](#8-offline-first-experience)
9. [Performance Expérientielle](#9-performance-expérientielle)
10. [Validation Expérience](#10-validation-experience)

---

## 1. Principes Fondamentaux d'Expérience

### Vision Centrée : "Leader, Pas Technicien"

Lumina est conçue pour les **leaders** — pasteurs, trésoriers, administrateurs — pas pour les techniciens IT ni les membres finaux. Chaque décision d'UX doit répondre à cette question : *"Est-ce que cela aide un leader à prendre une meilleure décision en moins de temps ?"*

### Les 5 Piliers de l'Expérience Lumina

| Pilier | Principe | Manifestation Concrète |
|--------|----------|----------------------|
| **Rapidité** | Moins de 5 secondes pour voir la valeur | Dashboard visible immédiatement au login |
| **Clarté** | Un écran = un message principal | Hero card + max 3 zones d'action |
| **Confiance** | Transparence absolue sur chaque action | Audit trail visible, confirmation animée, immutabilité garantie |
| **Simplicité** | Le chemin le plus court toujours visible | FAB "+" central, quick actions sur le dashboard |
| **Fidélité** | L'app se souvient de tout | État conservé, données persistées offline, pas de state loss |

### Contexte Utilisateur Réel

Les leaders utilisent Lumina dans des conditions exigeantes :
- **Debout** — Pendant ou après un culte, saisie rapide
- **Téléphone portable** — Écran petit, attention fragmentée
- **Zones rurales** — Réseau faible ou inexistant, offline-first absolu
- **Urgence** — Décisions financières rapides pendant les cérémonies
- **Multi-tâches** — Conversation en cours, besoin de glanceability

> **Conséquence :** Les interfaces doivent être lisibles d'un coup d'œil, utilisables d'une main, et fonctionner sans réseau.

---

## 2. Architectures de Navigation

### Structure Globale

```
Login
 └── Auth Stack (modale slide-in)
      ├── Login Screen
      └── Forgot Password

Onboarding (1ère fois uniquement)
 └── 5 étapes linéaires
      ├── Type Org Selection
      ├── Color Picker (prévisualisation live)
      ├── Info Entry
      ├── Capability Toggle
      └── Manifest Preview → Done!

Main App
 ├── Bottom Nav (5 tabs)
 │    ├── 🏠 Accueil (Dashboard)  ← Actif par défaut
 │    ├── 💰 Finance (Grand Livre)
 │    ├── ➕ FAB Central (Quick Action)
 │    ├── 👥 Membres
 │    └── ⚙️ Réglages
 │
 ├── Tab Screens (swipe horizontal entre tabs)
 │    ├── Dashboard
 │    ├── Grand Livre
 │    ├── Members List
 │    └── Settings
 │
 └── Detail Stacks (push navigation verticale)
      ├── Transaction Detail (depuis Grand Livre)
      ├── Member Profile (depuis Members List)
      ├── Event Detail (depuis Calendar)
      └── Category Editor (depuis Grand Livre filters)
```

### Principes de Navigation

1. **Bottom Navigation Fixe** — 5 tabs maximum, FAB central obligatoire (add primary action)
2. **Pas de Menu Hamburger** — La navigation principale est toujours visible
3. **Swipe Back Natif** — iOS et Android natif, jamais de bouton retour personnalisé
4. **Breadcrumb implicite** — Le header stack affiche `Section > Écran` avec l'accent de l'org
5. **Deep Linking** — Chaque écran atteignable via URL profonde `/main/feature/slug?param=value`

### Exception à la Navigation Standard

Quand un workflow nécessite **focus total**, utiliser une Bottom Sheet ou Modal Full-Screen :
- Création transaction
- Création membre
- Approbation/rejet transaction
- Configuration org (Wizard Setup)

Ces écrans remplacent la bottom nav par : `[Bouton Annuler]  [Titre]  [...]`

---

## 3. Parcours Utilisateur Critiques

### Parcours #1 : Connexion → Dashboard (Moins de 5 secondes)

```
Écran     │ Action                     │ Résultat
──────────│────────────────────────────│─────────────────
Login     │ Tape email + mot de passe  │ Focus auto sur champ sollicité
          │ Appuie "Se connecter"      │
Loading   │ Spinner accent org         │ Fade in du Dashboard
Dashboard │ Voit solde + quick actions │ Première vue en < 500ms après loading
```

**Règles critiques :**
- Session persistée 30 jours (pas de re-login nécessaire)
- Dernière org active restaurée automatiquement
- Si multiple orgs → mini selector overlay (3 taps max)
- Écran de chargement affiche le logo Lumina + hint utile (pas un spinner vide)

### Parcours #2 : Saisie Transaction (Moins de 2 minutes)

```
Dashboard │ Tap FAB "+"                    │ Bottom Sheet s'ouvre
          │ Tape "Ajouter Transaction"     │
Transaction │ Entrez montant (format auto)  │ Montant en accent org, taille 32px
            │ Sélectionnez catégorie        │ Catégories filtrables par type
            │ Ajoutez description (optionnel) |
            │ Choisissez Date                │ Date by défaut = aujourd'hui
Confirm     │ Preview complète               │ "Résumé de votre transaction"
            │ [Enregistrer] / [Draft]        │
            │ [Soumettre Approbation] si ≥ seuil
Liste       │ Transaction apparaît             │ Avec badge status + seal doré
```

**Règles critiques :**
- Auto-formatage du montant (espaces entre milliers, virgule décimale)
- Catégories par défaut = celles les plus utilisées récemment
- Validation en temps réel (pas d'erreur en-submit, prévenez avant)
- Draft optionnel mais visible clairement

### Parcours #3 : Approbation Transaction (Moins de 10 secondes)

```
Push notif  │ Banner "Transaction requiert approbation" │
            │ [Voir] [Ignorer]                           │
Detail      │ Montant, catégorie, demandé par          │
            │ Date + contexte                           │
Decision    │ [✅ Approuver] [❌ Rejeter]              │
            │ Champ commentaire obligatoire si rejet   │
Confirmation  │ Checkmark animé vert (si approuvé)     │
              │ X animé rouge (si rejeté)              │
              │ Toast "Transaction mise à jour ✓"      │
```

**Règles critiques :**
- Notification push dès qu'une transaction atteint le seuil défini
- Contexte minimal mais suffisant (montant + category + requester)
- Decision irreversible une fois confirmée (audit trail)
- Animations de feedback immédiat (checkmark/X)

### Parcours #4 : Onboarding Premier Setup (Moins de 3 minutes)

```
Welcome     │ "Bienvenue chez Lumina"                  │
            │ Votre plateforme universelle d'organisation
Type        │ "Quel type d'organisation créez-vous ?"  │
            │ Église / École / Entreprise / ONG / Custom
Color       │ Choisissez votre couleur d'identité      │
            │ 5 presets + custom hex                   │
            │ Aperçu LIVE sur mockup écran              │
Info        │ Nom, ID auto, pays/région                │
Capabilities│ Activate modules                         │
            │ ☑ Finance  ☑ Members  ☑ Events           │
            │ ☑ Notifications  ☑ Forms                 │
Review      │ Résumé de configuration                  │
            │ Bouton "Démarrer" → Dashboard
```

**Règles critiques :**
- Progress bar visible (étape N/5)
- Possibilité de revenir en arrière à tout moment
- Preview live de la couleur au step Color Picker
- Pas d'étape obligatoire inutile
- Option "Configurer plus tard" partout

---

## 4. Patterns d'Interaction

### Actions Primaires : FAB et Quick Actions

Le bouton flottant central (FAB) est **l'action la plus importante** de l'app. Il doit toujours ouvrir un menu de quick actions contextuel :

| Écran | FAB Quick Actions |
|-------|------------------|
| Dashboard | "Nouvelle Transaction", "Ajouter Membre" |
| Grand Livre | "Nouvelle Transaction", "Filtrer", "Exporter" |
| Members List | "Ajouter Membre", "Import CSV", "Filtres" |
| Calendar | "Nouvel Événement", "Vue Liste", "Invite" |

### Confirmation d'Action Irréversible

Toute action irréversible (suppression, approbation finale) suit ce pattern :

```
1. [TAP] L'utilisateur appuie sur "Supprimer"
2. [CONFIRM] Modal "Êtes-vous sûr ?" avec raison détaillée
3. [COMMENTAIRE] Champ texte optionnel (obligatoire si reject)
4. [EXECUTE] Action exécutée
5. [FEEDBACK] Animations de confirmation + toast
6. [UNDO] 3 secondes pour annuler (slide-back animation)
```

### Pull to Refresh

Sur tous les écrans de liste :
- Gesture native RN (ScrollView refresh)
- Indicateur visuel : spinner accent color
- Feedback : "Données synchronisées ✓" toast
- Auto-refresh quand le réseau revient (offline-first)

### Swipe Actions

Sur les items de liste (transaction, membre) :
- **Swipe Left** → Action destructive (delete/archive) en rouge
- **Swipe Right** → Action positive (approve/view) en vert
- Distance minimale : 60% de la largeur de l'item avant trigger
- Feedback haptique au trigger (si disponible)

### Drag & Drop

Sur les écrans de hiérarchie (Org Hierarchy, Group Membership) :
- Drag long press (150ms hold)
- Drop zone highlight en accent color
- Snap-to-grid au relâchement
- Haptic feedback au snap

---

## 5. Gestion des États

### États Visibles de l'Utilisateur

Chaque écran peut être dans l'un de ces états :

| État | Appearance | Comportement |
|------|-----------|-------------|
| **Loading Initial** | Skeleton screens animés | Pas de contenu affiché, spinner accent, pas de touch |
| **Empty** | Icône + texte descriptif | CTA primaire visible ("Commencer", "Ajouter") |
| **Populated** | Contenu normal | Interactions normales |
| **Offline** | Badge discret "Hors-ligne" + icône cloud barré | Données locales visibles, sync disabled |
| **Syncing** | Badge "Synchronisation..." | Données locales + spinner sync |
| **Error** | Banner rouge en haut de l'écran | Retry button, message clair |
| **Conflict** | Banner jaune + icône ⚠️ | Resolve button → Conflict Resolver |

### Skeleton Screens vs Spinners

Utiliser **TOUJOURS** skeleton screens pour le chargement initial de contenu :

```
┌─────────────────────┐
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │ ← shimmer animé accent@10%
│ ░░░░░░░░░░░░░░░░░░  │
│ ▓▓▓▓▓▓▓▓            │
│ ░░░░                │
└─────────────────────┘
```

**Jamais de spinner vide** sur le chargement initial. Le spinner n'est réservé qu'à :
- Les actions bouton submit
- Les requêtes en arrière-plan
- Les calculs longs (> 3 secondes)

### Optimistic Updates

Pour les actions UI immédiates :

```
[TAP] User adds transaction
→ [IMMEDIATE] Transaction apparaît dans la liste (optimiste)
→ [BACKEND] Requête InsForge envoyée
→ [SUCCESS] ✓ Checkmark sur l'item
→ [FAIL] → Retour à l'état précédent avec toast erreur
```

**Règle :** Si l'action n'a pas de validation serveur immédiate → optimistic. Si elle nécessite validation (approve, delete) → attendre confirmation.

---

## 6. Accessibilité & Inclusivité

### Design For All

Lumina est utilisée par des personnes dans des conditions variées :

| Condition | Adaptation |
|-----------|-----------|
| Vision réduite | Support paramètres système taille texte |
| Daltonisme | Formes + couleurs pour données (↑↓◆●■) |
| Trouble moteur | Touch targets ≥ 44px,gestes simples |
| Trouble cognitif | Language simple, messages clairs, pas de jargon |
| Environnement lumineux | Contraste élevé par défaut (déjà garanti par thème sombre) |
| Environnement bruyant | Pas de feedback sonore obligatoire (tout visuel) |

### Textes Alternatifs

Toujours fournir des textes alternatifs significatifs :

```
Icone "📊" → Label: "Données financières"
Icone "👥" → Label: "Membres de l'organisation"
Icone "📅" → Label: "Calendrier des événements"
```

N'utiliser `aria-label` vide que pour les icônes purement décoratives (séparateurs, dividers).

### Screen Reader Support

- Tous les boutons interactifs ont un `accessibilityLabel` clair
- Les transactions ont `accessibilityHint`: "Appuyer pour voir les détails"
- Les badges de status ont `accessibilityLabel` complet: "Status: En attente"
- Les listes de transactions lisent: "Transaction de [nom], [montant], [date], [status]"

---

## 7. Feedback & Communication Système

### Système de Notifications

| Type | Duration | Couleur | Position | Exemple |
|------|----------|---------|----------|---------|
| **Success** | 3 sec | dataGreen | Top banner toast | "Transaction sauvegardée ✓" |
| **Info** | 2 sec | accent | Top banner toast | "2 transactions synchronisées" |
| **Warning** | 4 sec | dataYellow | Top banner toast | "Connexion instable" |
| **Error** | 5 sec | dataRed | Center modal | "Impossible de synchro: réessayez" |
| **Offline** | Persistante | gray | Bottom fixed | "Mode hors-ligne actif" |
| **Conflict** | Persistante | amber | Bottom fixed | "1 conflit à résoudre" |

### Micro-copy Guidelines

- **Toujours en français** (primary language), prêt à switcher EN
- **Sentence case** : "Transaction approved", jamais "Transaction Approved"
- **Actif plutôt que passif** : "Nous avons sauvegardé" non "Sauvegarde effectuée"
- **Orienté action** : "Télécharger PDF" plutôt que "Export PDF"
- **Positif plutôt que négatif** : "Compte créé" plutôt que "Erreur: compte non existant"
- **Clair sur l'état** : "En attente d'approbation" plutôt que "Pending"

### Messages d'Erreur

Structure standard :

```
[ICÔNE DANGER]
Titre court et clair

Description détaillée de ce qui s'est passé

[BOUTON ACTION] [BOUTON SECONDARI]
```

Exemple :
```
⚠️
Connexion échouée

Email ou mot de passe incorrect. Vérifiez vos identifiants ou utilisez « Mot de passe oublié ».

[Se reconnecter] [Mot de passe oublié]
```

**Jamais de :** code d'erreur technique, stack trace, "Internal server error", ou message vague "Oops".

---

## 8. Offline-First Experience

### Indicateur de Connectivité

Toujours visible, jamais intrusif :

```
┌──────────────────────────────────────┐
│ 🔵 Connecté                        │ ← Green when online
│ 🟡 Synchronisation...              │ ← Yellow when syncing
│ 🔴 Hors-ligne  (sync en file)      │ ← Red when offline
└──────────────────────────────────────┘
Position: bottom-left, height 28px, opacity 0.85
```

### Comportement Offline

Quand le réseau est absent :

1. **Toutes les opérations locales continuent** — CRUD complet via WatermelonDB
2. **Les données affichées sont locales** — Jamais de placeholder "Chargement"
3. **La sync se fait en arrière-plan** — Dès que le réseau revient
4. **Les conflits sont signalés clairement** — Side-by-side diff view
5. **L'utilisateur sait toujours son statut** — Indicateur toujours visible

### Priorité de Sync

```
1. Transactions créées/modifiedes en offline    ← IMMEDIAT
2. Demandes d'approbation                       ← HIGH
3. Modifications membre                         ← MEDIUM
4. Nouvelles catégories                         ← LOW
5. Metadata/settings                            ← DEFERRED
```

### Data Strategy Offline

- **Modèles fréquemment consultés** sont syncés en premier (transactions récentes, membres actifs)
- **Données statiques** (catégories, vocabulaire) mises en cache durablement
- **Historique > 90 jours** accessible en lazy-loading (pas en cache local par défaut)

---

## 9. Performance Expérientielle

### Mesures de Performance UX

| Métrique | Cible MVP | Cible V2+ | Justification |
|----------|-----------|-----------|---------------|
| **Time to Interactive (TTI)** | < 2s | < 1s | Premier écran utilisable |
| **Frame Rate** | 55fps min | 60fps constant | Fluidité perçue |
| **Scroll Lag** | < 16ms | < 8ms | Scrolling fluide |
| **Transition Render** | < 200ms | < 100ms | Navigation instantanée |
| **Offline Read Latency** | 0ms (local) | 0ms | Aucune dépendance réseau |
| **Image Load** | 500ms (cached) | 200ms (CDN/Waterfall) | Photos receipts, avatars |

### Techniques de Performance

1. **Lazy Loading des écrans** — Expo Router code-split automatique
2. **Memoization des listes** — `FlashList` de Shopify pour les grandes listes (> 50 items)
3. **Image dimensionnées** — Pas de chargement full-res, resize côté server (InsForge)
4. **WatermelonDB Query batching** — Regrouper les lectures fréquentes
5. **React Query stale-while-revalidate** — Cache HTTP intelligent

### Perception de Performance

Quand une opération prend > 300ms, l'utilisateur DOIT voir du feedback :
- Skeleton loading pendant le fetch initial
- Spinner sur le bouton pendant la soumission
- Progress bar pour les opérations > 1 seconde
- Count-up animation pour les nombres (solde change de 0 → 2510000 en 300ms)

---

## 10. Validation Expérience

### Checklist Pre-Release UX

Avant chaque release, vérifier :

- [ ] Toutes les routes navigables depuis le Dashboard en ≤ 3 taps
- [ ] Aucun écran ne nécessite de scroll horizontal (vertical uniquement)
- [ ] Tous les boutons ont un feedback visuel au tap (scale + color change)
- [ ] Les textes d'erreur sont lisibles et orientés solution
- [ ] Les skeleton screens apparaissent au lieu des spinners
- [ ] L'accessibilité label existe sur tous les éléments interactifs
- [ ] Le contraste de chaque accent custom respecte WCAG AA
- [ ] Les états empty sont conçus (pas de liste vide avec "No items")
- [ ] La transition online/offline est perceptible
- [ ] Le FAB et ses quick actions sont testés sur tous les écrans

### Heuristiques de Revue UX

Après chaque développement d'écran nouveau, évaluer contre :

1. **Visibilité de l'état système** — L'utilisateur sait-il toujours où il en est ?
2. **Correspondance avec le monde réel** — Le language est-il familier pour un leader ?
3. **Contrôle et liberté** — L'utilisateur peut-il annuler/retourner facilement ?
4. **Cohérence** — Les mêmes patterns sont-ils utilisés partout ?
5. **Prévention d'erreurs** — Peut-on empêcher l'erreur AVANT qu'elle arrive ?
6. **Reconnaissance plutôt que rappel** — Les options sont-elles visibles ?
7. **Flexibilité et efficacité** — Les utilisateurs experts sont-ils servis ?
8. **Design esthétique et minimaliste** — Rien de superflu à l'écran ?
9. **Aide à la reconnaissance des erreurs** — Les messages d'erreur clairs ?
10. **Aide et documentation** — Faut-il une doc externe pour comprendre l'UX ?

Si l'écran échoue 2+ critères → refactor required avant merge.

---

*Experience Framework v1.0 — 2026-07-22 — Lumina v2*
