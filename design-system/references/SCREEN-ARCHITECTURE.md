# Architecture des Écrans Lumina v2

> **Cartographie complète de tous les écrans, leur navigation, et leur relation métier.**

## 1. Vision Globale — Ce Qu'est Lumina

Lumina n'est **PAS** une application de gestion financière ni une app d'église.  
C'est une **Plateforme Universelle d'Organisation** (Universal Organization Platform) dont le **cœur technique** est un **Runtime interprété par manifest**.

- **Première implémentation cible :** MFE-JC (église)
- **Mais techniquement :** peut gérer NGO, école, entreprise, ou tout type `custom`
- **Pas de logic métier dans le Core** — tout passe par le Manifest Engine

---

## 2. Flux Utilisateur Global

```
┌─────────────────────────────────────────────────────┐
│                    UTILISATEUR                        │
│              (Leader, Trésorier, Admin)               │
└────────────────┬────────────────────────────────────┘
                 │
                 ▼
┌──────────────  LOGIN ───────────────────────────┐
│  - Email + Mot de passe                          │
│  - Session auth-only (ADR-009)                   │
│  - Auto-sélection org active                     │
└────────────────┬─────────────────────────────────┘
                 │ AUTHENTIFIÉ
                 ▼
┌──────────────  DASHBOARD (ACCUEIL) ──────────────┐
│  - Vue par rôle : dashboard personnalisé          │
│  - Solde global de l'org (si finance activée)     │
│  - Navigation vers toutes les features            │
│  - Dépend du manifest → quelles capacités actives │
│  - Dépend du vocab engine → labels dynamiques     │
└──────┬──────┬──────┬──────┬──────┬────────────────┘
       │      │      │      │      │
       ▼      ▼      ▼      ▼      ▼
    FINANCE  MEMBRES CALENDRIER CONFIGURATION REGLAGES
       │      │      │      │           │
       ▼      ▼      ▼      ▼           ▼
   Grand    Gérer   Liste   Crée ta     Profil
   Livre    Membres événements   org +   + Sécurité
   + Bilan   + CRUD  + Events  manifests
   + Rapports        + Approvals
   + Transfert
```

---

## 3. Écrans Détaillés

### A. AUTHENTICATION FLOW

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Login | `/auth/login` | Email + password, bouton "Demander Accès" | Aucun |
| Onboarding | `/auth/onboarding` | Premier setup : choisir type org, créer org | Post-login, première fois |

### B. DASHBOARD PRINCIPAL

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Dashboard Home | `/main/dashboard` | Page d'accueil personnalisée par rôle | Capability + Manifest + Vocab |
| Org Selector | `/main/org-select` | Si user membre de plusieurs orgs, switcher | Auth session |

### C. MODULE FINANCE (Capability: finance)

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Grand Livre | `/main/finance/ledger` | Liste chronologique transactions filtrable | Finance service |
| Ajouter Transaction | `/main/finance/transactions/create` | Formulaire dynamique (Forms Engine) | Forms Engine + Vocab |
| Voir Transaction | `/main/finance/transactions/:id` | Détail + boutons approve/reject/compensate | Finance service |
| Bilan Financier | `/main/finance/balance-sheet` | Actif = Passif + Résultat | Finance bilan-calculator |
| Rapport Mensuel | `/main/finance/report/:period` | PDF/CSV export, filtre par période | Finance report service |
| Catégories | `/main/finance/categories` | Gérer catégories vocabulaire | Finance + Vocab Engine |

### D. MODULE MEMBRES (Capability: members)

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Liste Membres | `/main/members/list` | Grille liste CRUD membres | Members service |
| Profil Membre | `/main/members/:id` | Dossier complet : infos, ministries, historique | Members service |
| Ajouter Membre | `/main/members/create` | Formulaire dynamique (Forms Engine) | Forms Engine |
| Départements | `/main/members/departments` | Hiérarchie unités org | Org Graph spec |
| Ministères | `/main/members/ministries` | Attribution membres aux ministères | Membership rules |

### E. MODULE ÉVÉNEMENTS (Capability: events/calendar)

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Calendrier | `/main/events/calendar` | Vue mensuelle/hebdomadaire événements | Events service |
| Créer Événement | `/main/events/create` | Formulaire dynamique (Forms Engine) | Forms Engine |
| Détails Event | `/main/events/:id` | Détails + notifications associées | Events service |

### F. MODULE WORKFLOW/APPROVALS

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Mes Approbations | `/main/approvals/pending` | Transactions en attente de validation | Workflow Engine |
| Historique Approvals | `/main/approvals/history` | Chaine d'approbations complètes | Audit Trail |

### G. MODULE ORGANISATION (Capability: manifest)

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Setup Organisation | `/main/org/setup` | Wizard création org (type, nom, config) | Manifest Engine |
| Config Manifest | `/main/org/config` | Éditeur YAML/JSON du manifest | Manifest Engine |
| Hiérarchie Org | `/main/org/hierarchy` | Graph org structure (parent/enfant) | Org Graph Spec |
| Vocabulary Editor | `/main/org/vocabulary` | Gérer termes/catégories/dictionnaire | Vocab Engine |

### H. PARAMÈTRES

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Profil Utilisateur | `/main/settings/profile` | Info user, changement mot de passe | Auth service |
| Sécurité | `/main/settings/security` | Sessions actives, 2FA (future) | Auth service |
| Thème/Préférences | `/main/settings/preferences` | Langue FR/EN, thème (dark fixe) | Local prefs |
| À Propos | `/main/settings/about` | Version app, licences | Config |

### I. OFFLINE-ONLY ÉCRANS

| Écran | Route | Description | Dépend de |
|-------|-------|-------------|-----------|
| Sync Queue View | `/main/offline/sync-queue` | File sync pending + erreurs | Sync Manager |
| Conflict Resolver | `/main/offline/conflicts` | Resolution conflits LWW vs Immutable | Offline-first spec |

---

## 4. Arbre de Navigation (Relation entre Écrans)

```
Login
  └─▶ [Onboarding] (1ère connexion uniquement)
         │
         ▼
      Dashboard
         │
         ├── Finance
         │    ├── Grand Livre ──▶ [Ajouter Transaction] ──▶ [Voir Transaction]
         │    │                                          ├─ Approve
         │    │                                          ├─ Reject
         │    │                                          └─ Compensate
         │    ├── Bilan Financier
         │    ├── Rapport Mensuel ──▶ [Export PDF/CSV]
         │    └── Catégories
         │
         ├── Membres
         │    ├── Liste Membres ──▶ [Profil Membre] ──▶ [Ministères]
         │    ├── [Ajouter Membre]
         │    ├── Départements
         │    └── Ministères
         │
         ├── Événements
         │    ├── Calendrier ──▶ [Créer Événement] ──▶ [Détails Event]
         │    └── Approbations en attente ←─[Workflow]
         │
         ├── Organisation
         │    ├── Setup (1ère fois)
         │    ├── Config Manifest
         │    ├── Hiérarchie Org ──▶ [Transfert/Merge]
         │    └── Vocabulaire
         │
         └── Paramètres
              ├── Profil
              ├── Sécurité
              ├── Préférences
              └── About
```

---

## 5. Relations Métier vs Écrans

| Entité Métier | Tables DB | Écrans Affichant Cette Données |
|---------------|-----------|-------------------------------|
| **Transaction** | `transactions` | Grand Livre, Voir Transaction, Bilan, Rapport, Approvals |
| **Category** | `categories` | Catégories, Ajouter Transaction (select category), Grand Livre |
| **Member** | `members` | Liste Membres, Profil Membre, Ministères |
| **Department** | `departments` | Départements, Profil Membre (department link) |
| **Event** | *(non défini dans DB)* | Calendrier, Créér Événement |
| **Org** | `organizations` | Hiérarchie Org, Org Selector, Config Manifest |
| **UserSession** | `user_sessions` | Sécurité (sessions actives) |
| **PendingOp** | `pending_operations` | Sync Queue View |
| **OrgUnit** | `org_units` | Départements, Ministères |

---

## 6. Règles de Permissibilité Par Rôle

| Permission | Admin | Pasteur | Trésorier | Membre |
|------------|-------|---------|-----------|--------|
| `finance:*:read` | ✅ | ✅ | ✅ | ✅ |
| `finance:*:write` | ✅ | ❌ | ✅ | ❌ |
| `finance:bilan` | ✅ | ✅ | ✅ | ❌ |
| `members:*` | ✅ | ✅ | ❌ | ✅ |
| `events:*` | ✅ | ✅ | ❌ | ❌ |
| `org:*` | ✅ | ✅ | ❌ | ❌ |
| `settings:*` | ✅ | ✅ | ✅ | ✅ |

---

## 7. Formes d'affichage (Layout Strategy)

Chaque écran aura un des layouts suivants :

### 7a. Feed Layout (comme Spotify library)
**Utilisé pour :** Grand Livre, Transaction list, Member list
- Contenu empilé verticalement, espacé
- Items cliquables → ouvre detail screen
- Filtre + recherche en haut
- Date separators horizontaux

### 7b. Hero Card Layout
**Utilisé pour :** Dashboard balance, Bilan résultat net
- Un chiffre principal GIGANTHE en gradient/orange
- Sous-stats plus petites en dessous
- Graphique tendance sous le hero

### 7c. Grid Layout (2x2 ou 2x3)
**Utilisé pour :** Quick actions, Stats rapides
- Cartes carrées avec icône + label
- Espacement généreux entre cartes

### 7d. Master-Detail
**Utilisé pour :** List → Detail (Grand Livre → Transaction detail, Members → Profile)
- Swipe ou tap pour entrer dans le détail
- Back button natif

### 7e. Sheet Modal (bottom sheet)
**Utilisé pour :** Quick create (nouvelle transaction, nouveau membre rapide)
- Slide up depuis le bas
- Partial height → full screen depending on content

---

*Document créé le 2026-07-22 — Architecture d'écrans Lumina v2*
