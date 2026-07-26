# Architecture Alignment Report — Corrigé

**Date:** 2026-07-24  
**Statut:** VALIDÉ  
**Basé sur:** Conceptual Model v1, Constitution Lumina, Audit précédent

---

## 1. Hiérarchie Officielle (Vérifiée)

```
Conceptual Model      ← SOURCE DE VÉRITÉ ABSOLUE (DOC-CONCEPTUAL-MODEL)
  ↓
Architecture          ← Frontières entre couches (DOC-ARCHITECTURE-MAP)
  ↓
Foundation            ← Services fondamentaux (9 services)
  ↓
Platform Capabilities ← Capacités composables (catalogue officiel)
  ↓
Runtime               ← Orchestrateur minimal (chargement, résolution, activation)
  ↓
Domain Model          ← Instanciation des concepts pour un usage concret
  ↓
Data Model            ← Stockage uniquement (tables, index, contraintes)
  ↓
Applications          ← Consomment les capacités exposées
```

## 2. Règles de Flux de Responsabilité

```
Concept ──→ Capability ──→ Runtime Service ──→ Domain Object ──→ Data Model ──→ API ──→ UI
```

Règle impérative: une responsabilité peut DESCENDRE la hiérarchie mais jamais la remonter.
Un Data Model ne peut jamais IMPOSER un concept. Un Runtime ne peut jamais DÉFINIR une capacité.

---

## 3. Écarts Détectés et Corrections

### E-C01: Runtime traitée comme centre du système

**Localisé dans:** ADR-001 titre "Platform Core (Lightweight Runtime)" et section 2 "Questions"

**Problème:** L'ADR-001 place le Runtime au centre de la décision architecturale (« choisir entre Runtime complet vs Runtime léger »). Le Runtime est LE CHOIX technologique, pas le CHOIX conceptuel.

**Correction:** Ce n'est pas le Runtime qu'il fallait choisir léger ou complet. C'est le nombre de Capacities. Le Runtime n'est qu'un orchestrateur. Le choix réel était:
- Beaucoup de fonctionnalités codées en dur VS
- Few capabilities composables + Manifest interprété

**Action:** Titre et texte intérieur mis à jour.

---

### E-C02: Moteurs présentés comme concepts

**Localisé dans:** Tous les specs moteurs (Manifest Engine, Vocabulary Engine, Forms Engine, Workflow Engine, Capability Engine)

**Problème:** Les 5 moteurs sont présentés comme des "capacités" alors qu'ils sont des SERVICES DU RUNTIME. Ils exécutent, lisent, interprètent — c'est du comportement runtime, pas du concept.

**Correction par moteur:**
| Moteur | Est | Devient |
|--------|-----|---------|
| Manifest Engine | Runtime | Runtime Service de lecture manifest |
| Vocabulary Engine | Runtime | Runtime Service de résolution vocabulary |
| Forms Engine | Runtime | Runtime Service de rendu formulaire |
| Workflow Engine | Runtime | Runtime Service d'exécution workflow |
| Capability Engine | Runtime | Runtime Service de registry capabilities |

Les Capacities réelles sont: `manifest`, `vocabulary`, `forms`, `workflow`, `capability-registry`.
Les Moteurs sont: comment le Runtime les interprète.

---

### E-C03: Feature list masquée comme capability list

**Localisé dans:** `capability-engine/index.md` §4, PRD §4

**Problème:** `membership`, `finance`, `events`, `notifications`, `reports` listés comme capacités.

**Correction:** Transformations:
- `membership` → Identity + Resource + Relationship + Forms + Workflow + Search + Notification + Reporting
- `finance` → Resource + Workflow + Policy + Forms + Reporting + Audit
- `events` → Resource + Activity + Forms + Search + Notification

---

### E-C04: Foundation non-spécifiée

**Localisé dans:** Absence totale de docs/10-foundation/

**Problème:** La Constitution définit 9 services de Foundation. Aucun document ne les existe.

**Action:** Créer `docs/10-foundation/` avec 9 specs (Identity, Security, Permissions, Storage, Configuration, Localization, Logging, Offline, Audit).

---

### E-C05: Business Packs manquants

**Localisé dans:** Constitution mentione Business Packs. Aucune doc `docs/business-packs/` n'existe.

**Action:** Créer structure business-packs/ avec church/, school/, ngo/, company/.

---

### E-C06: Templates confondus avec Manifests

**Localisé dans:** Glossaire, INDEX.md

**Problème:** Template et Manifest sont décrits comme la même chose.

**Distinction officielle:**
- **Template** = Collection de configuration prédéfinie (réutilisable, domaine neutre)
- **Manifest** = Instance configurée d'un Template pour une Organization spécifique

Analogie: Template = classe / Manifest = instance. Template = blueprint / Manifest = build.

---

## 4. Matrice de Responsabilités Corrigée

| Élément | Couche Actuelle | Couche Correcte | Justification |
|---------|-----------------|-----------------|---------------|
| 5 Moteurs | Platform Capabilities | Runtime | Ils exécutent, lisent, interprètent — comportement d'orchestration |
| Manifest | Runtime | Platform Capability (manifest) | C'est une Capacité + un Concept |
| Vocabulary | Runtime | Platform Capability (vocabulary) | Catalogue centralisé — capacité universelle |
| Forms | Runtime | Platform Capability (forms) | Génération dynamique de formulaires — capacité universelle |
| Workflow | Runtime | Platform Capability (workflow) | Séquences d'étapes événementielles — capacité universelle |
| Capability Registry | Runtime | Platform Capability (capability-registry) | Registre — capacité universelle |
| Resource | ❌ Absent | Conceptual Model + Platform Capability | Concept fondamental manquant |
| Relationship | ❌ Absent | Conceptual Model + Platform Capability | Concept fondamental manquant |
| Policy | ❌ Absent | Conceptual Model + Platform Capability | Règles configurables — concept fondamental manquant |
| Lifecycle | ❌ Absent | Platform Capability | Cycle de vie configurable — besoin détecté dans Audit précédent |
| Search | ❌ Absent | Platform Capability | Recherche plein texte + GIN — besoin détecté |
| Reporting | ❌ Absent | Platform Capability | Export configurable PDF/CSV/JSON |
| Branding | ❌ Absent | Platform Capability | Tokens visuels configurables |
| notification | Runtime (feature) | Platform Capability | Déjà existant sous forme feature — remonter au rang de capacité |
| Audit | Runtime (feature) | Foundation + Platform Capability | Immutable logging — FOUNDATION service ET plateforme capability |
| offline Sync | Runtime (feature) | Foundation + Platform Capability | Offline-first absolu — FOUNDATION service ET capacité plateforme |
| Permission | Capability Registry | Platform Capability + Foundation | Droit fin — FOUNDATION security service ET plateforme capability |
| Identity | Capability Registry | Platform Capability + Foundation | Profil unique — FOUNDATION identity service ET capacité plateforme |
| Organization | Capability Registry | Conceptual Model + Platform Capability | Structure administrative autonome |
| Template | Runtime | Platform Capability (template-management) | Gestion de templates — capacité de configuration |
| Business Packs | ❌ Absent | Architecture Layer | Niveaux au-dessus des Capacities |
| SQL Tables | Data Model | Data Model | Stockage — rien d'autre |
| WatermelonDB Models | Data Model | Data Model | ORM local — rien d'autre |
| Edge Functions | Runtime | Runtime Service | Logique serveur side — traitement runtime |
| RLS Policies | Data Model | Data Model | Contrainte de sécurité au niveau DB |
| Design System | Runtime | Platform Capability (branding) | Tokens visuels — capacité de présentation |

---

## 5. Règles de Contrôle Futur

Toute proposition de nouvelle caractéristique ou de modification doit passer le test :

1. **Ce concept existe-t-il déjà dans Conceptual Model v1 ?**
   - OUI → Déterminer si c'est un nouveau concept ou un sous-type d'un concept existant
   - NON → Rejeter ou transférer vers Conceptual Model

2. **Cette capacité liste-t-elle des fonctionnalités métier ?**
   - OUI → Décomposer en capacités atomiques
   - NON → Valider comme capability légitime

3. **Cette fonctionnalité appartient-elle au Runtime ou est-ce une Capability ?**
   - Si elle ORCHESTRE → Runtime
   - Si elle EST la logique → Platform Capability
   - Si elle STOCKE → Data Model

4. **Une table SQL définie-t-elle une Capacité ?**
   - Jamais. Une table stocke. Elle sert des Capacities mais ne les définit pas.

5. **Un moteur est-il un Concept ?**
   - Jamais. Un moteur exécute. Il n'est pas un concept — il est une implémentation Runtime d'une Capacité.
