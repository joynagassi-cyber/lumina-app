# Scénarios Utilisateurs — Lumina v2

> **Document : PHASE 3 — Scénarios**  
> Créé le 2026-07-22 par Freya (WDS Designer)  
> Projet : Lumina — Plateforme Universelle d'Organisation

---

## Contexte Stratégique

Lumina n'est PAS une application de gestion financière. C'est un **système d'exploitation organisationnel** dont la première implémentation cible les églises MFE-JC. Les scénarios ci-dessous sont conçus pour les **leaders** (pasteurs, trésoriers, administrateurs), pas pour les membres finaux.

**Personas Primaires :**
| Persona | Rôle | Priorité |
|---------|------|----------|
| **Pasteur Jean** | Leader spirituel + admin global | Primary |
| **Trésorière Ama** | Responsable finances | Primary |
| **Administrateur District** | Niveau supérieur hiérarchique | Secondary |

**Principes UX Lumina :**
- Dark Canvas (fond #121212 universel fixe)
- Accent configurable par type d'organisation (#FF6B00 église par défaut, voir ADR-011)
- Navigation sidebar 80px
- Espacement généreux, typographie bold
- Offline-first absolu

---

## SCÉNARIO #01 — Connexion & Entrée

**Transaction :** Authentification et entrée dans l'espace de travail de l'organisation
**Business Goal :** Accéder rapidement à son espace de travail personnel depuis n'importe quel appareil
**Persona :** Pasteur Jean (Primary)
**Situation :** Le pasteur est debout, probablement dans son bureau le matin, prête son téléphone avant de commencer sa journée
**Hope :** "Je veux voir immédiatement ce qui nécessite mon attention aujourd'hui"
**Worry :** "Je ne vais pas perdre de temps à naviguer si je me trompe d'organisation"
**Device :** Mobile (iPhone)
**Entry :** Écran de connexion → Dashboard principal

**Meilleur Résultat :**
- Utilisateur : Connecté en moins de 5 secondes, voit le dashboard avec un résumé clair de sa journée
- Business : Réduction du temps de connexion par session de travail

**Chemin le Plus Court :**
1. **[Login]** — Formulaire email + mot de passe, logo circulaire avec accent org au centre, fond sombre
2. **[Org Selector]** — Si multiple orgs, liste courte des organisations actives
3. **[Dashboard]** — Solde principal en hero card avec accent org, quick actions pill, feed transactions récentes ✓

---

## SCÉNARIO #02 — Dashboard Principal (Vue d'Ensemble)

**Transaction :** Prise de conscience immédiate de l'état de l'organisation
**Business Goal :** Donner une vision instantanée de la santé financière et organisationnelle
**Persona :** Pasteur Jean (Primary)
**Situation :** Premières minutes après connexion, veut comprendre d'un coup d'œil la situation de son org
**Hope :** "Je veux comprendre en 5 secondes si tout va bien"
**Worry :** "Et si quelque chose cloche que je ne vois pas ?"
**Device :** Mobile
**Entry :** Login → Dashboard

**Meilleur Résultat :**
- Utilisateur : Compréhension immédiate du solde, des tendances, et des actions urgentes
- Business : Confiance dans le système → adoption accélérée des leaders

**Chemin le Plus Court :**
1. **[Dashboard Home]** — Hero card solde (montant en accent org, ex: orange fire par défaut pour église), stats grid 2x2 (recettes/dépenses), quick actions row (4 pill buttons), feed transactions récentes, chart activité hebdo
2. **[Quick Action]** — Tap sur action pill → ouvre modal bottom sheet (ajout rapide transaction ou membre) ✓

---

## SCÉNARIO #03 — Grand Livre (Transaction CRUD)

**Transaction :** Enregistrer une nouvelle transaction financière
**Business Goal :** Saisie rapide et précise d'une transaction valide selon INV-001
**Persona :** Trésorière Ama (Primary)
**Situation :** Après un culte du dimanche, récolte de dîmes et offrandes à comptabiliser
**Hope :** "Je veux saisir ces 3 donations rapidement sans erreur"
**Worry :** "Que se passe-t-il si je me trompe de montant ? La transaction est immuable !"
**Device :** Mobile
**Entry :** Dashboard → Finance → Grand Livre

**Meilleur Résultat :**
- Utilisateur : 3 transactions saisies en moins de 2 minutes avec validation formulaire dynamique
- Business : Zéro erreur de saisie, données fiables pour le bilan

**Chemin le Plus Court :**
1. **[Grand Livre List]** — Liste chronologique transactions filtrable, header avec balance summary
2. **[FAB]** — Tap bouton accent org "+" → ouvre Bottom Sheet de création
3. **[Create Transaction Modal]** — Formulaire dynamique (Forms Engine JSON → RN components), montant en accent org, categories issues du Vocab Engine, validation en temps réel
4. **[Confirm Transaction]** — Preview de la transaction + boutons "Draft / Submit for Approval" ✓
5. **[Grand Livre List]** — Transaction apparaît dans le feed avec status badge (draft/pending/approved) + immutable seal doré

---

## SCÉNARIO #04 — Approbation de Transaction

**Transaction :** Approuver ou rejeter une transaction en attente
**Business Goal :** Workflow d'approbation conforme aux règles BR-FIN-010/011
**Persona :** Pasteur Jean (Secondary — approuve les grosses dépenses)
**Situation :** Reçoit notification qu'une transaction ≥ seuil requiert double approbation
**Hope :** "Je veux comprendre rapidement la transaction et prendre une décision éclairée"
**Worry :** "Et si j'approuve quelque chose qui n'est pas juste ?"
**Device :** Mobile (notification push)
**Entry :** Notification → Pending Approvals

**Meilleur Résultat :**
- Utilisateur : Décision prise en moins de 10 secondes avec contexte complet
- Business : Traçabilité complète du workflow d'approbation

**Chemin le Plus Court :**
1. **[Notification Toast]** — Banner "Transaction nécessite votre approbation" → tap
2. **[Pending Approvals List]** — Feed de transactions en attente avec status badges colorés
3. **[Transaction Detail]** — Vue complète : montant, catégorie, description, historique, workflow chain
4. **[Approve Decision]** — Modal confirmation avec champ commentaire obligatoire (BR-FIN-013) + boutons "Approve" ([ORG_ACCENT]) / "Reject" ✓
5. **[Approval Confirmation]** — Feedback animé : transaction devient approved (vert) ou rejected (rouge) ✓

---

## SCÉNARIO #05 — Bilan Financier

**Transaction :** Générer et visualiser le bilan d'une période
**Business Goal :** Rapport équilibré (Actif = Passif + Résultat) exigé par BR-FIN-020
**Persona :** Trésorière Ama (Primary)
**Situation :** Fin de mois, doit préparer le rapport mensuel pour le conseil pastoral
**Hope :** "Je veux vérifier que tout s'équilibre avant d'imprimer"
**Worry :** "Si le bilan ne balance pas, je perds confiance dans le système"
**Device :** Tablet ou Mobile
**Entry :** Dashboard → Finance → Bilan

**Meilleur Résultat :**
- Utilisateur : Bilan généré, vérifié et exporté en moins de 1 minute
- Business : Conformité BR-FIN-020 garantie, export PDF avec horodatage et signature (BR-FIN-022)

**Chemin le Plus Court :**
1. **[Rapport Financier Page]** — Hero card résultat net (+2 510 000 F), stats grid 3 colonnes (recettes/dépenses/taux épargne), bar chart activités hebdo, catégorie breakdown list
2. **[Period Selector]** — Dropdown sélection période (mensuel/trimestriel/annuel)
3. **[Bilan Generation]** — Calcul automatique bilan-calculator.tsx affiché en cards détaillées
4. **[Export]** — Bouton "Télécharger PDF" ([ORG_ACCENT]) → preview PDF → confirmation ✓

---

## SCÉNARIO #06 — Gestion des Membres

**Transaction :** Ajouter un nouveau membre à l'organisation
**Business Goal :** Enregistrement rapide d'un nouveau membre (BR-MEM-001 à 005)
**Persona :** Pasteur Jean (Primary) — accueille officiellement un nouveau membre lors du culte
**Situation :** Pendant ou après le culte, on présente un nouveau baptisé au registre d'appartenance
**Hope :** "Je veux l'enregistrer maintenant pendant qu'il est là"
**Worry :** "Est-ce que toutes les informations obligatoires sont remplies ?"
**Device :** Mobile
**Entry :** Dashboard → Membres

**Meilleur Résultat :**
- Utilisateur : Nouveau membre enregistré en moins de 30 secondes
- Business : Données complètes et validées dès l'enregistrement

**Chemin le Plus Court :**
1. **[Members List]** — Liste espacée membres avec avatars circulaires colorés, recherche pill, filtres pills (tous/leaders/trésoriers/groupes)
2. **[Add Member FAB]** — Tap bouton accent org "+" → Bottom Sheet formulaire
3. **[Create Member Form]** — Champs prénom/nom obligatoires (BR-MEM-001), email optionnel (BR-MEM-002), téléphone auto-formaté (BR-MEM-003), departments dropdown (Multi-select)
4. **[Ministry Assignment]** — Sélection ministries (BR-MEM-020: multi-membership), validation responsable ministry (BR-MEM-021)
5. **[Member Profile Card]** — Card profil nouvel membre créé avec avatar + badges role ✓

---

## SCÉNARIO #07 — Configuration Organisation Setup

**Transaction :** Configurer une nouvelle organisation (Wizard Setup)
**Business Goal :** Initialisation complète de l'org via manifest YAML/JSON (INV-005: Manifest > Code Dur)
**Persona :** Admin Système (Primary)
**Situation :** Premier déploiement de Lumina pour une nouvelle organisation (église, NGO, école...)
**Hope :** "Un wizard guidé pas-à-pas sans me noyer dans la tech"
**Worry :** "Et si je me trompe de type d'organisation ? Ça se change ?"
**Device :** Desktop ou Mobile
**Entry :** Login (1ère fois) → Onboarding

**Meilleur Résultat :**
- Utilisateur : Organisation configurée en étapes simples avec prévisualisation en temps réel
- Business : Manifest valide dès la création, compatible avec tous les autres modules

**Chemin le Plus Court :**
1. **[Welcome Screen]** — Écran onboarding simple : "Quel type d'organisation créez-vous ?"
2. **[Type Selector]** — Cartes cliquables (Église/École/Entreprise/ONG/Custom)
3. **[Color Picker]** — Sélection de l'accent de marque : 5 presets suggérés selon type + champ hex libre (validation contraste WCAG auto). Aperçu live en temps réel sur l'écran mockup
4. **[Info Entry]** — Nom, ID auto-généré, pays/région
5. **[Capability Toggle]** — Modules activables (finance/membres/calendar/notifications/forms)
6. **[Manifest Preview]** — Aperçu YAML du manifest généré + bouton "Terminer Configuration" ✓

---

## SCÉNARIO #08 — Hiérarchie Organisationnelle

**Transaction :** Visualiser et gérer la structure d'organisation parent/enfant
**Business Goal :** Explorer le graphe d'organisations (Organisation-Graph-Spec)
**Persona :** Admin District/National (Primary)
**Situation :** Besoin de comprendre la hiérarchie des églises sous sa juridiction
**Hope :** "Voir d'un coup d'œil toute ma chaîne organisationnelle"
**Worry :** "Et si un enfant a une config incompatible avec son parent ?"
**Device :** Mobile ou Desktop
**Entry :** Dashboard → Organisation

**Meilleur Résultat :**
- Utilisateur : Comprend l'entier de la hiérarchie d'un seul coup d'œil
- Business : Détection précoce des conflits de configuration entre niveaux

**Chemin le Plus Court :**
1. **[Org Hierarchy]** — Tree View vertical avec expand/collapse sur chaque nœud
2. **[Org Node]** — Chaque nœud montre nom + type badge + état (active/pending/archived) + indicateur couleur accent
3. **[Transfer Action]** — Drag-and-drop ou dropdown pour changer parent d'un nœud
4. **[Inheritance Indicator]** — Badge "inherits from [parent]" sur chaque nœud ✓

---

## SCÉNARIO #09 — Mode Hors-Ligne & Sync

**Transaction :** Fonctionner 100% offline puis syncer automatiquement au retour du réseau
**Business Goal :** Garantir INV-003 (Offline-Absolu) — aucune opération utilisateur ne dépend d'un appel API synchrone
**Persona :** Tous les personas (Primary — critique pour zones rurales)
**Situation :** Le trésorier saisit des transactions pendant un culte en zone rurale sans réseau
**Hope :** "Je peux travailler même sans internet"
**Worry :** "Mes données sont-elles en sécurité hors-ligne ? Qu'est-ce qui se passe quand je me reconnecte ?"
**Device :** Mobile
**Entry :** N'importe quel écran avec offline capability

**Meilleur Résultat :**
- Utilisateur : Transitions transparentes online/offline avec indicateur visible
- Business : Zéro perte de données, sync automatique sans intervention

**Chemin le Plus Court :**
1. **[Normal Flow]** — Saisie transaction pendant culte → sauvegardé localement (WatermelonDB)
2. **[Offline Indicator]** — Petit badge "Hors-ligne" visible discrètement en bas de l'écran
3. **[Network Restored]** — Indicateur redevient "Connecté" → sync queue s'exécute automatiquement
4. **[Sync Confirmation]** — Toast ou mini-banner "X transactions synchronisées ✓" ✓

---

## SCÉNARIO #10 — Conflict Resolver

**Transaction :** Résoudre un conflit de données détecté pendant la sync
**Business Goal :** Appliquer stratégies de résolution (Last-Writer-Wins pour membres, Immutable pour finance)
**Persona :** Admin System (Primary)
**Situation :** Deux appareils ont modifié le même membre en offline → conflit détecté
**Hope :** "Je veux voir les deux versions côte à côte et choisir rapidement"
**Worry :** "Et si je choisis la mauvaise version et que des données sont perdues ?"
**Device :** Mobile
**Entry :** Sync Queue View → Conflict Detected

**Meilleur Résultat :**
- Utilisateur : Conflit résolu en voyant clairement les deux versions et leurs diffs
- Business : Intégrité préservée, audit trail conservé (INV-007)

**Chemin le Plus Court :**
1. **[Conflict Detected Toast]** — Notification "1 conflit détecté" → tap
2. **[Conflict Resolver List]** — Liste des conflits avec indicator couleurs
3. **[Diff View]** — Side-by-side comparison deux versions (Local vs Remote)
4. **[Resolve Action]** — Boutons "Keep Local" / "Keep Remote" / "Merge" ✓

---

## Summary — Couverture Complète

| # | Scénario | Pages Impliquées | Personas | Features Affected |
|---|----------|-----------------|----------|------------------|
| 01 | Connexion & Entrée | Login, Org Selector, Dashboard | Pasteur Jean | Auth, Org Graph |
| 02 | Dashboard Principal | Dashboard Home, Quick Action Modal | Pasteur Jean | Dashboard, All quick access |
| 03 | Grand Livre (Saisie) | Ledger → FAB → Create Modal → Confirm | Trésorière Ama | Finance, Forms Engine |
| 04 | Approbations | Notifications → Approval List → Detail → Decision | Pasteur Jean | Workflow Engine, Approvals |
| 05 | Bilan Financier | Rapports → Period Selector → Generation → Export | Trésorière Ama | Finance Reports, PDF Export |
| 06 | Ajout Membre | Members List → Add FAB → Create Form → Ministry | Pasteur Jean | Members, Ministry Rules |
| 07 | Setup Organisation | Welcome → Type → Color Picker → Info → Capability → Manifest | Admin Sys | Manifest Engine, Theme Setup |
| 08 | Hiérarchie Org | Org Hierarchy → Tree → Transfer → Inheritance | Admin District | Org Graph Spec |
| 09 | Mode Offline | Normal → Offline Indicator → Restore → Sync OK | TOUS | Offline-First, WatermelonDB |
| 10 | Conflict Resolver | Sync Queue → Conflict List → Diff → Resolve | Admin Sys | Offline-First, Conflict Strategy |

### Règles métier couvertes par ces scénarios :
- ✅ INV-001 (Immutable transactions) — Scénarios #03, #04
- ✅ INV-003 (Offline-absolute) — Scénarios #09, #10
- ✅ INV-005 (Manifest > code dur) — Scénario #07
- ✅ INV-007 (Audit trail immuable) — Scénario #10
- ✅ BR-FIN-010/011 (Workflow approbation) — Scénario #04
- ✅ BR-FIN-020 (Bilan équilibré) — Scénario #05
- ✅ BR-MEM-001/002 (Règles membre) — Scénario #06
- ✅ NB-RULE-06 (Offline sync order) — Scénario #09
- ✅ NeverBreak (90% test coverage finance) — Scénarios #03, #04, #05