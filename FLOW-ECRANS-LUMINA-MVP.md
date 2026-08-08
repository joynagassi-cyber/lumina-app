# Flow d'écrans — Lumina MVP (Église MFE-JC)

| | |
|---|---|
| **Version** | 1.1 (Jour 1) — maquettes ASCII E1–E8 ajoutées |
| **Statut** | Prêt pour génération IA (Google Stitch / AI Studio) |
| **Lien** | PRD : `PRD-LUMINA-MVP.md` (règles R1–R6, périmètre, critères) |
| **Références canoniques** | UI-SPEC-003 (registre), UI-SPEC-002 (navigation), UI-SPEC-004 (formulaires), EXPERIENCE.md (UX), DESIGN.md (thème sombre) |

> Ce document décrit **chaque écran du MVP** : objectif, accès, champs, actions, états, données, règles. L'agent IA doit suivre ce document écran par écran et ne rien construire hors liste.
> **Chaque écran du §3 est accompagné d'une maquette ASCII** qui fixe la mise en page (structure, ordre, regroupements) sans ambiguïté pour le rendu visuel de Stitch.

---

## 1. Carte de navigation

```
                        ┌──────────────┐
                        │   E1 Login   │  ← seul écran public
                        └──────┬───────┘
                               │ session valide
                               ▼
                        ┌──────────────┐
                        │  E2 Accueil  │  (Dashboard)
                        └──────┬───────┘
                               │ bottom nav (5 onglets)
        ┌──────────┬───────────┼───────────┬────────────┐
        ▼          ▼           ▼           ▼            ▼
   ┌─────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐ ┌──────────┐
   │ Accueil │ │E3 Grand │ │E7 Group│ │ Place-  │ │ Réglages │
   │  (E2)   │ │  livre  │ │  es    │ │ holders │ │ (E8-c)   │
   └─────────┘ └────┬────┘ └────────┘ └─────────┘ └──────────┘
                    │
        ┌───────────┼───────────┐
        ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌────────┐
   │E5 Nou-  │ │E4 Détail│ │E6 Bilan│
   │velle tx │ │  tx     │ │        │
   └─────────┘ └─────────┘ └────────┘
```

- **Bottom nav fixe** (5 onglets) : Accueil · Finance (Grand livre) · Groupes · Membres (placeholder) · Réglages (placeholder).
- **Écrans pleine hauteur (modal/sheet)** pour : E5 Nouvelle transaction, E6 Bilan (optionnel), détails d'approbation.
- **Retour** : geste natif retour iOS/Android ; bouton « Annuler » dans les formulaires.
- Accès direct depuis l'Accueil (E2) : solde, raccourcis « Nouvelle entrée », « Nouvelle sortie », « Bilan ».

## 2. Parcours utilisateur (scénarios)

### P1 — Premier lancement (trésorier)
```
E1 Login → E2 Accueil (solde = 0, état vide avec CTA « Enregistrer la première entrée »)
```

### P2 — Saisie et approbation d'une entrée (moins de 2 min)
```
E2 Accueil → bouton « + » / « Nouvelle entrée » → E5 (montant, catégorie Dîme, date du jour, org)
→ [Enregistrer] → E4 Détail (statut draft) → [Soumettre] → [Approuver]
→ toast succès → retour E3 Grand livre (la transaction est en tête, badge « Approuvé »)
```

### P3 — Saisie d'une sortie rattachée à un groupe
```
E3 Grand livre → [Nouvelle transaction] → E5 : type Sortie, montant 8000, catégorie Transport,
Groupe = Jeunesse, description « Transport jeunesse » → Soumettre → Approuver
→ E6 Bilan : filtre Groupe = Jeunesse → la sortie apparaît ; filtre org → elle apparaît aussi
```

### P4 — Correction d'une erreur sur une transaction approuvée
```
E4 Détail (transaction approved) → bouton [Corriger] → E5 pré-rempli (montant opposé,
même catégorie, mention « Correction de … ») → Soumettre → Approuver
→ E4 montre le lien « corrige la transaction X » ; le journal d'audit trace les deux écritures
```

### P5 — Rejet d'une transaction
```
E3 Grand livre → filtre état = pending → ouvrir E4 → [Rejeter] → motif obligatoire
→ statut rejected → [Réviser] ramène en draft pour correction → resoumission possible
```

## 3. Détail des écrans

> **Conventions ASCII des maquettes** (source de vérité visuelle pour Stitch) :
>
> - Cadre = écran ; `├──┤` = barre de statut ; la hauteur est indicative, le contenu défile.
> - `[ Texte ]` = bouton pill (accent église pour le primaire) · `(x)` = case cochée.
> - `● Onglet` = onglet actif (accent église) · `○ Onglet` = onglet inactif (gris `#808080`).
> - `▸` = ligne cliquable · `▾` = dropdown · `‹` = retour · `⇄` = rafraîchir · `⋯` = menu overflow.
> - Couleurs data (immuables) : montants `+` vert `#1DB954` (entrée) / `−` rouge `#E51332` (sortie) ; badges : `[Approuvé]` vert · `[En att.]` jaune `#FFB800` · `[Draft]` gris · `[Rejeté]` rouge.
> - Fond `#121212`, surfaces `#181818`, cartes radius 4px, inputs 8px, boutons pill, montants en tabular-nums — cf. DESIGN.md. Les espaces ASCII sont indicatifs : la grille 4px fait foi dans le rendu réel.

### E1 — Login

**Maquette ASCII** (écran public, sans bottom nav) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│                                                        │
│                    ╭───────────╮                       │
│                    │   LOGO    │   ← rond 56px, accent │
│                    ╰───────────╯                       │
│                 MISSION FÊTE DE                        │
│                JÉSUS-CHRIST (MFE-JC)                   │
│                                                        │
│  E-MAIL                                                │
│  ┌────────────────────────────────────────────────┐    │
│  │ tresorier@mfe-jc.org                          │    │
│  └────────────────────────────────────────────────┘    │
│  MOT DE PASSE                                          │
│  ┌────────────────────────────────────────────────┐    │
│  │ •••••••••••••••••                        ◉    │    │
│  └────────────────────────────────────────────────┘    │
│  (x) Se souvenir de moi                                │
│                                                        │
│  [              Se connecter              ]            │
│                                                        │
│                Mot de passe oublié ?                   │
│                ‹ Retour                                │
└────────────────────────────────────────────────────────┘
```

- **Objectif** : authentifier un leader (admin/trésorier).
- **Accès** : public (seul écran accessible sans session).
- **Champs** : email, mot de passe (+ case « Se souvenir de moi »).
- **Actions** : [Se connecter] ; liens [Mot de passe oublié] (affiche message « contactez l'administrateur » en MVP), [Retour].
- **Validation** : email format valide, mot de passe non vide. Erreur générique « Email ou mot de passe incorrect » (ne pas révéler lequel est faux).
- **États** : chargement (spinner sur le bouton), erreur (bannière + message clair), succès (→ E2).
- **Données** : POST /auth/login → { accessToken, refreshToken, user { id, orgId, role } } ; token stocké en SecureStore (mobile) / localStorage (web) ; header `x-org-id` envoyé ensuite sur chaque requête.
- **Design** : fond `#121212`, logo + nom de l'église, accent de l'église, contraste WCAG AA.

### E2 — Accueil (Dashboard)

**Maquette ASCII** (bottom nav, onglet **Accueil** actif) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│  Bonjour, David                            [⇄]        │
│  Solde de l'église                                    │
│  ┌────────────────────────────────────────────────┐   │
│  │  Solde                            ▲           │   │
│  │  2 450 000 FCFA                               │   │
│  │  +45 000 ce mois              (48px, tabular) │   │
│  └────────────────────────────────────────────────┘   │
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ │
│  │ Entrées mois  │ │ Sorties mois  │ │ Net mois      │ │
│  │  +250 000     │ │  −205 000     │ │  +45 000      │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ │
│  Derniers mouvements                  [Tout voir →]   │
│  ┌────────────────────────────────────────────────┐   │
│  │ ▸ Dîme — dimanche           +50 000  [Approuvé]│   │
│  │   Entrée · org · 12/07                         │   │
│  │ ▸ Transport jeunesse         −8 000   [Approuvé]│   │
│  │   Sortie · Jeunesse · 11/07                    │   │
│  │ ▸ Offrande culte             +20 000  [En att.]│   │
│  │   Entrée · org · 10/07                        │   │
│  └────────────────────────────────────────────────┘   │
│  Raccourcis                                           │
│  [ Nouvelle entrée ]    [ Nouvelle sortie ]           │
│  [ Bilan ]              [ Grand livre ]               │
│                                                        │
│  ● Accueil  ○ Finance  ○ Groupes  ○ Membres  ○ Réglages│
└────────────────────────────────────────────────────────┘
```

- **Objectif** : vue d'ensemble immédiate (moins de 5 s) : « combien avons-nous ? ».
- **Accès** : tout utilisateur connecté (accueil par défaut).
- **Contenu** :
  - Carte héro : **solde** (entrées − sorties cumulées), en gros chiffres, couleurs données (vert/région).
  - Cartes stat : entrées du mois, sorties du mois, résultat net du mois.
  - Derniers mouvements (5 derniers, liste compacte : libellé, catégorie, montant, badge état).
  - Raccourcis : [Nouvelle entrée] [Nouvelle sortie] [Bilan] [Grand livre].
- **États** : vide (« Aucune transaction — commencez par enregistrer la première entrée » + CTA), chargement (skeletons), erreur (retry).
- **Données** : GET /transactions?limit=5 + GET /transactions/balance (org). Rafraîchissement pull-to-refresh.
- **Règles** : le solde affiché ne compte que les transactions **approuvées**.

### E3 — Grand livre (liste des transactions)

**Maquette ASCII** (bottom nav, onglet **Finance** actif) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│  ‹ Grand livre                            [⇄]        │
│  [ + Nouvelle transaction ]  [ Exporter CSV ]         │
│  [ Bilan ]                                            │
│  Filtres :                                            │
│  [État ▾ (3)]  [Type ▾]  [Catégorie ▾]                │
│  [Groupe ▾]    [Période ▾]                            │
│  ┌────────────────────────────────────────────────┐   │
│  │ ▸ Dîme — dimanche           +50 000  [Approuvé]│   │
│  │   Entrée · org · 12/07                         │   │
│  │ ▸ Transport jeunesse         −8 000   [Approuvé]│   │
│  │   Sortie · Jeunesse · 11/07                    │   │
│  │ ▸ Offrande culte             +20 000  [En att.]│   │
│  │   Entrée · org · 10/07                         │   │
│  │ ▸ Achat fournitures          −3 500   [Draft]  │   │
│  │   Sortie · org · 09/07                         │   │
│  │ ▸ Don frère A.               +15 000  [Rejeté] │   │
│  │   Entrée · org · 08/07                         │   │
│  └────────────────────────────────────────────────┘   │
│  (scroll infini — 20 lignes / lot, plus récent 1er)   │
│                                                        │
│  ○ Accueil  ● Finance  ○ Groupes  ○ Membres  ○ Réglages│
└────────────────────────────────────────────────────────┘
```

- **Objectif** : voir, filtrer et rechercher toutes les transactions ; point d'entrée des actions.
- **Accès** : admin, trésorier (lecture) ; écriture selon rôle.
- **Contenu** :
  - Filtres (chips/dropdowns) : **état** (tous / draft / pending / approved / rejected), **type** (tous / entrée / sortie), **catégorie**, **groupe** (org ou groupe spécifique), **période** (mois / année / personnalisé).
  - Liste chronologique (plus récent en premier) : chaque ligne = libellé, catégorie, groupe (si porté), date, montant (vert si entrée, rouge si sortie), **badge d'état** (Draft / En attente / Approuvé / Rejeté), montant cliquable → E4.
  - Barre d'actions : [Nouvelle transaction] (bouton principal), [Exporter CSV], [Bilan].
  - Badge compteur « en attente » sur le filtre état.
- **États** : vide (état vide avec CTA), chargement (skeleton lignes), erreur (retry), hors-ligne (bannière discrète).
- **Données** : GET /transactions?org_id&state&type&categoryRef&dateFrom&dateTo&page&limit ; pagination ou scroll infini (20/lot).
- **Règles** : montants en centimes convertis pour affichage (`12 500 FCFA`) ; filtre par défaut = tous états (le bilan, lui, est limité aux approuvées).

### E4 — Détail d'une transaction

**Maquette ASCII** (pleine hauteur, sans bottom nav ; la barre d'actions change selon l'état) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│  ‹ Transaction                            [⋯]         │
│  ┌────────────────────────────────────────────────┐   │
│  │  Entrée · org · Draft                         │   │
│  │  +50 000 FCFA                                  │   │
│  │  Dîme · 12/07/2026 · TX-2026-0142              │   │
│  └────────────────────────────────────────────────┘   │
│  Détails                                              │
│  Libellé        Dîme — dimanche 12                    │
│  Type           Entrée                                │
│  Catégorie      Dîme                                  │
│  Portée         Église entière (org)                  │
│  Groupe         —                                     │
│  Date           12/07/2026                            │
│  Description    Offrande du culte du dimanche         │
│  Référence      TX-2026-0142                          │
│  Créé par       David K. · 12/07 09:14                │
│  Version        1                                     │
│  ▸ Voir le journal d'audit    (admin uniquement)      │
│                                                        │
│  [ Modifier ]   [ Soumettre ]                         │
│  [ Supprimer ]                                        │
│  (exemple : état DRAFT — cf. tableau actions ci-dessous) │
└────────────────────────────────────────────────────────┘
```

Barre d'actions selon l'état : draft → `[Modifier] [Soumettre] [Supprimer]` · pending → `[Approuver] [Rejeter]` · approved → `[Corriger]` (aucune modification directe) · rejected → `[Réviser] [Supprimer]`.

- **Objectif** : voir toutes les informations et exécuter les actions d'état.
- **Accès** : lecture admin/trésorier/pasteur ; actions selon état.
- **Contenu (champs en lecture)** : libellé, type (Entrée/Sortie), montant (grand, couleur data), catégorie, groupe (si portée groupe), date, description, référence, **état** (badge), **créé par**, **approuvé par + date**, version, « corrige la transaction X » (si compensation), lien « Voir le journal d'audit » (admin).
- **Actions selon état** :

| État | Actions |
|---|---|
| draft | [Modifier] (→ E5 pré-rempli), [Soumettre], [Supprimer] (avec confirmation) |
| pending | [Approuver] (confirmation), [Rejeter] (motif obligatoire) |
| approved | [Corriger] (→ E5 contre-transaction) — **aucune modification directe** |
| rejected | [Réviser] (→ draft, modifiable), [Supprimer] |

- **États** : chargement, introuvable (message + retour liste), erreur.
- **Données** : GET /transactions/:id ; mutations : PATCH /transactions/:id/transition { newState, comment? }, POST /transactions/:id/compensate.
- **Règles** : R1 (approuvé immuable), R2 (transitions valides seulement), R3 (chaque action audite). Confirmation explicite pour Approuver/Rejeter/Supprimer/Corriger ; **motif obligatoire pour rejeter**.

### E5 — Nouvelle / Modifier transaction (formulaire)

**Maquette ASCII** (bottom sheet pleine hauteur, sans bottom nav) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│  ‹ Annuler      Nouvelle transaction                  │
│  TYPE                                                 │
│  [ Entrée ]  [ Sortie ]    ← segments, accent église  │
│  MONTANT (FCFA)                                       │
│  ┌────────────────────────────────────────────────┐   │
│  │  50 000                                (48px)  │   │
│  └────────────────────────────────────────────────┘   │
│  CATÉGORIE                                            │
│  ┌────────────────────────────────────────────────┐   │
│  │  Dîme                                    ▾     │   │
│  └────────────────────────────────────────────────┘   │
│  DATE                                                │
│  ┌────────────────────────────────────────────────┐   │
│  │  12/07/2026                            ▦     │   │
│  └────────────────────────────────────────────────┘   │
│  À QUI RATTACHER ? (optionnel)                       │
│  ┌────────────────────────────────────────────────┐   │
│  │  Église entière (org)                   ▾     │   │
│  └────────────────────────────────────────────────┘   │
│  DESCRIPTION (optionnel)                             │
│  ┌────────────────────────────────────────────────┐   │
│  │  Transport jeunesse                            │   │
│  │  …                                             │   │
│  └────────────────────────────────────────────────┘   │
│  (validation temps réel : montant > 0, date ≤ ajd)    │
│  [ Enregistrer ]                                     │
│  [ Enregistrer et soumettre ]                        │
│  (Annuler = ‹ en haut à gauche, sans sauvegarde)      │
└────────────────────────────────────────────────────────┘
```

- **Objectif** : saisir une entrée ou sortie en moins de 2 minutes.
- **Accès** : admin, trésorier (création) ; auteur (modification d'un draft).
- **Champs** :
  1. **Type** : segments [Entrée] [Sortie] (obligatoire ; détermine la couleur du montant).
  2. **Montant** : saisie numérique grand format, auto-formaté (milliers séparés, ex. `50 000`) ; obligatoire, > 0, entier (centimes internes).
  3. **Catégorie** : dropdown **depuis le vocabulaire** (Dîme, Offrande, Don, Budget groupe, Dépense culte, Transport, Fournitures, Autre) ; obligatoire.
  4. **Date** : date picker, défaut = aujourd'hui ; interdite dans le futur.
  5. **Groupe** (optionnel) : dropdown des groupes de l'église ; si vide → portée org (église entière). Libellé : « À qui rattacher ? » avec option « Église entière (org) ».
  6. **Description** : texte libre (recommandé si montant important).
- **Actions** : [Enregistrer] (→ draft), [Enregistrer et soumettre] (draft → pending), [Annuler] (retour sans sauver).
- **Validation temps réel** : montant > 0, catégorie requise, date ≤ aujourd'hui, description ≤ 500 caractères. Erreurs inline sous chaque champ.
- **États** : vide (nouvelle), pré-rempli (édition draft / correction : montant opposé pré-calculé, mention « Correction de [référence] », même catégorie).
- **Données** : POST /transactions ; PATCH /transactions/:id (draft seulement).
- **Règles** : R1 (impossible d'éditer une approuvée — l'UI ne propose même pas l'édition), R4 (montant centimes), R5 (catégories du vocabulaire, groupe = org_units).
- **Design** : formulaire pleine hauteur (bottom sheet / modal plein écran) ; montant en très grand (48px), bouton principal en accent de l'église.

### E6 — Bilan (rapport financier)

**Maquette ASCII** (modal pleine hauteur, sans bottom nav) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│  ‹ Bilan                                 [⇄]         │
│  Période : [Juillet 2026 ▾]   Portée : [Église ent. ▾]│
│  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐ │
│  │ Entrées       │ │ Sorties       │ │ Résultat net  │ │
│  │  +250 000     │ │  −205 000     │ │  +45 000      │ │
│  └───────────────┘ └───────────────┘ └───────────────┘ │
│  Par catégorie  (ordonné par montant décroissant)     │
│  ┌─────────────┬─────────┬─────────┬─────────┐        │
│  │ Catégorie   │ Entrées │ Sorties │   Net   │        │
│  ├─────────────┼─────────┼─────────┼─────────┤        │
│  │ Dîme        │ 120 000 │      0  │ +120 000│        │
│  │ Offrande    │  80 000 │      0  │  +80 000│        │
│  │ Transport   │       0 │ 60 000  │  −60 000│        │
│  │ Fournitures │       0 │ 45 000  │  −45 000│        │
│  └─────────────┴─────────┴─────────┴─────────┘        │
│  Par groupe  (si portée = église entière)             │
│  ┌─────────────┬─────────┬─────────┬─────────┐        │
│  │ Groupe      │ Entrées │ Sorties │   Net   │        │
│  ├─────────────┼─────────┼─────────┼─────────┤        │
│  │ Jeunesse    │       0 │  8 000  │  −8 000 │        │
│  │ Chorale     │  25 000 │ 10 000  │ +15 000 │        │
│  └─────────────┴─────────┴─────────┴─────────┘        │
│  [ Exporter CSV ]  [ Exporter PDF ]  [ Grand livre ]  │
│  (net = entrées − sorties · approuvées uniquement)    │
└────────────────────────────────────────────────────────┘
```

- **Objectif** : produire un bilan **propre et exemplaire** : « où en est l'église ? ».
- **Accès** : admin, trésorier.
- **Contenu** :
  - Sélecteurs : **période** (mois / trimestre / année / personnalisé), **portée** (Église entière / Groupe X).
  - **Totaux** (cartes) : Entrées, Sorties, **Résultat net** (avec signe et couleur : vert excédent, rouge déficit).
  - **Par catégorie** : tableau Entrées | Sorties | Net par catégorie (ordonné par montant décroissant).
  - **Par groupe** (si portée org) : tableau Entrées | Sorties | Net par groupe.
  - Actions : [Exporter CSV] [Exporter PDF] (facultatif), [Grand livre] (aller voir le détail).
- **États** : vide (« aucune transaction approuvée sur la période »), chargement, erreur.
- **Données** : GET /transactions/balance?org_id&dateFrom&dateTo (ou POST /reports/generate) → { totalIncome, totalExpense, netResult, byCategory, byGroup? } ; export : GET /transactions/export.
- **Règles** : R6 — uniquement les transactions **approuvées** et **synchronisées** ; `net = income − expense` vérifié ; les transferts sont exclus des totaux (neutres) ; cohérence garantie avec le grand livre filtré.
- **Design** : chiffres en tabular-nums ; vert `#1DB954` / rouge `#E51332` / jaune `#FFB800` constants.

### E7 — Groupes (liste + solde par groupe)

**Maquette ASCII** (bottom nav, onglet **Groupes** actif) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│  Groupes                                  [⇄]        │
│  Solde par groupe — transactions approuvées           │
│  ┌────────────────────────────────────────────────┐   │
│  │ ▸ Jeunesse · Ministère                         │   │
│  │   Entrées 12 000 · Sorties 8 000 · Net +4 000  │   │
│  │ ▸ Chorale · Service                            │   │
│  │   Entrées 25 000 · Sorties 10 000 · Net +15 000│   │
│  │ ▸ École du Sabbat · Ministère                  │   │
│  │   Entrées 0 · Sorties 0 · Net 0                │   │
│  └────────────────────────────────────────────────┘   │
│  (appui sur un groupe = Bilan filtré E6, portée grp)  │
│  Note : création de groupes via l'administrateur      │
│  (pas d'écran de gestion en Jour 1).                  │
│  ○ Accueil  ○ Finance  ● Groupes  ○ Membres  ○ Réglages│
└────────────────────────────────────────────────────────┘
```

- **Objectif** : voir les groupes de l'église et leur situation financière.
- **Accès** : admin, trésorier (lecture en MVP).
- **Contenu** :
  - Liste des groupes (nom, type — ex. ministère, service) avec pour chacun : **Entrées**, **Sorties**, **Net** (transactions approuvées portées sur ce groupe).
  - Appui sur un groupe → **Bilan filtré** (E6 avec portée = groupe) et/ou grand livre filtré.
  - Note : la **création de groupes** se fait via le seed / admin (pas d'écran de gestion en Jour 1).
- **États** : vide (« Aucun groupe — les groupes sont créés par l'administrateur »), chargement, erreur.
- **Données** : GET /org-units?org_id&type_unite=group (ou /groups) + solde par groupe (GET /transactions/balance?scope=group&scopeTarget=:id par groupe, ou un endpoint agrégé).
- **Règles** : R5 (une transaction = org OU groupe) ; un groupe vide affiche 0 (pas de message d'erreur).

### E8 — Placeholders (onglets non actifs)

**Maquette ASCII** (gabarit commun E8-a / E8-b / E8-c) :

```
┌────────────────────────────────────────────────────────┐
│  09:41                                     ▂▄▆  █  ▁▃▅▇ │
├────────────────────────────────────────────────────────┤
│                                                        │
│                        ◇                              │
│                     (icône 64px)                       │
│                   [TITRE DE L'ONGLET]                  │
│                  Disponible bientôt                    │
│                                                        │
│        Cette fonctionnalité arrive dans une            │
│              prochaine version.                        │
│                                                        │
│              [ Retour à l'accueil ]                    │
│                                                        │
│  ○ Accueil  ○ Finance  ○ Groupes  ● Membres  ○ Réglages│
└────────────────────────────────────────────────────────┘
```

Variantes : **E8-a Membres** (onglet actif = Membres) · **E8-b Événements** (pas d'onglet dédié dans le bottom nav J1 — même gabarit, nav d'origine conservée) · **E8-c Réglages** (onglet actif = Réglages). Seuls l'icône, le titre et l'onglet actif changent ; **ne pas construire** la fonctionnalité.

- **E8-a Membres**, **E8-b Événements**, **E8-c Réglages** : écran simple avec icône, titre, texte « Disponible bientôt » et bouton [Retour à l'accueil]. **Ne pas construire** la fonctionnalité (hors périmètre Jour 1).
- Ces onglets **existent** dans la navigation (pas de route cassée) mais ne contiennent aucune logique métier.

## 4. États transverses (tous les écrans)

| État | Comportement |
|---|---|
| Chargement initial | Skeletons (jamais de spinner vide) |
| Vide | Icône + message d'aide + CTA principal |
| Erreur | Bannière rouge + message clair + [Réessayer] |
| Hors-ligne | Badge discret « Hors-ligne » + données locales affichées si disponibles ; écritures mises en file (toast « Enregistré localement ») |
| Succès d'action | Toast vert court (« Transaction approuvée ✓ ») |
| Confirmation | Modal pour actions irréversibles (approuver, rejeter, supprimer, corriger) |

**Badges d'état (couleurs constantes)** : draft = gris · pending = jaune `#FFB800` · approved = vert `#1DB954` · rejected = rouge `#E51332`.

**Design système** : fond `#121212`, surfaces `#181818/#282828`, accent = couleur de l'église (ex. `#FF6B00`), boutons pill, cartes radius 4px, grille d'espacement multiple de 4px, textes FR par défaut. Chiffres en tabular-nums. Toujours ≥ 2:1 de contraste sur fond sombre.

## 5. Checklist finale pour l'agent IA

- [ ] Les 9 écrans du §3 existent et sont navigables depuis l'Accueil en ≤ 3 taps.
- [ ] Les maquettes ASCII E1–E8 du §3 ont guidé le rendu visuel (structure, ordre et regroupements conformes ; couleurs et tokens du DESIGN.md respectés).
- [ ] Aucun écran hors liste n'a été créé (les placeholders E8 ne cachent aucune logique métier).
- [ ] Règles R1–R6 du PRD implémentées et vérifiées par le parcours P1–P5.
- [ ] Toutes les listes gèrent vide/chargement/erreur ; les formulaires valident en temps réel.
- [ ] Montants en centimes internes, formatés en affichage ; jamais d'arrondi flottant.
- [ ] `x-org-id` présent sur chaque requête ; token de session protégé.
- [ ] Catégories et groupes chargés depuis les API (jamais de liste en dur).
- [ ] Le bilan ne compte que les transactions approuvées ; `net = entrées − sorties` toujours vérifié.
- [ ] Chaque action écrite dans le journal d'audit (avant/après).
- [ ] Test final : parcours complet P2 (entrée 50 000, sortie 8 000 sur groupe, bilan net 42 000).

---

*Flow d'écrans Lumina MVP v1.1 — prêt pour génération IA (maquettes ASCII E1–E8 incluses)*
