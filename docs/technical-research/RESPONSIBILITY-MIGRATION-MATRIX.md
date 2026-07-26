# Matrice de Migration des Responsabilités

**Doc ID:** DOC-RESPONSIBILITY-MIGRATION  
**Version:** 1.0  
**Date:** 2026-07-24

---

## Légende Colonne

| Colonne | Signification |
|---------|--------------|
| Élément actuel | Ce qui existe aujourd'hui dans les docs |
| Couche actuelle | La couche où il est MAL PLACÉ |
| Couche correcte | La couche où IL APPARTIENT |
| Justification | Pourquoi ce déplacement |
| Action | Ce qu'il faut faire |
| Risque | Niveau de risque du changement |
| Impact | Effet sur la plateforme |
| Dépendances | Docs/adr/autres éléments concernés |

---

## Groupe A: Moteurs → Services Runtime (Critique)

| Élément | Couche Actuelle | Couche Correcte | Justification | Action | Risque | Impact | Dépendances |
|---------|-----------------|-----------------|--------------|--------|--------|--------|-------------|
| Manifest Engine | Platform Capability | Runtime Service | Il LIT et COMPILE la config manifest. La Capacité "manifest" est le concept. Le moteur n'est que l'exécution. | Séparer en 2 specs: capability + executor | Moyen | Le runtime sait comment interpréter | manifest-engine/index.md, ADR-001 |
| Vocabulary Engine | Platform Capability | Runtime Service | Il RÉSOLV les labels depuis le vocabulaire. La Capacité "vocabulary" est le catalogue. Le moteur n'est que l'exécution. | Séparer en 2 specs | Moyen | Les Formulairse lisent depuis Vocabulary Engine au lieu de hardcode | vocabulary-engine/index.md |
| Forms Engine | Platform Capability | Runtime Service | Il REND les formulaires dynamiques. La Capacité "forms" définit LA GÉNÉRATION DYNAMIQUE. Le moteur n'est que l'exécution. | Séparer en 2 specs | Moyen | L'UI ne voit plus de "moteur forms" | forms-engine/index.md |
| Workflow Engine | Platform Capability | Runtime Service | Il EXÉCUTE les workflows. La Capacité "workflow" est ORCHESTRATION. Le moteur n'est que l'exécution. | Séparer en 2 specs | Moyen | Les workflows se déclenchent comme avant | workflow-engine/index.md |
| Capability Engine | Platform Capability | Runtime Service | Il ENREGISTRE et VALIDÉ le registre. La Capacité "capability-registry" EST le registre. | Séparer en 2 specs + nettoyer §4 | Moyen | Le Capability Engine devient un executor | capability-engine/index.md |

## Groupe B: Features → Capacities (Critique)

| Élément | Couche Actuelle | Couche Correcte | Justification | Action | Risque | Impact | Dépendances |
|---------|-----------------|-----------------|--------------|--------|--------|--------|-------------|
| Feature "finance" | Capability | Décomposition en 6 Capacities | Ce n'est pas une Capacité atomique. C'est Resource+Workflow+Policy+Forms+Reporting+Audit | Remplacer liste §4 par 6 Capacities réelles | Élevé | Toutes les refs "feature finance" deviennent refs composites | PRD, Capability Engine |
| Feature "membership" | Capability | Décomposition en 8 Capacities | Idem. Composition d'Identity+Resource+Relationship+... | Remplacer liste §4 par composition | Élevé | Refs "feature membership" nécessitent mise à jour | PRD, Capability Engine |
| Feature "events" | Capability | Décomposition en 5 Capacities | Resource+Activity+Forms+Search+Notification | Remplacer liste §4 | Moyen | Refs "feature events" | PRD, Capability Engine |
| Feature "notifications" | Capability | Promouvoir au rang Capacité | La notification EST une capacité universelle. Elle existait déjà comme feature — lui donner le statut capability légitime. | Promouvoir dans le catalogue officiel | Faible | Consistance terminologique | Glossary, Capability Engine |
| Feature "reports" | Capability | Promouvoir au rang Capacité | Le reporting configurables EST une capacité universelle. Export configurable de TOUTE ressource. | Promouvoir dans le catalogue officiel | Faible | Consistance terminologique | Glossary, Capability Engine |

## Groupe C: Concepts Manquants (Sévère)

| Élément | Couche Actuelle | Couche Correcte | Justification | Action | Risque | Impact | Dépendances |
|---------|-----------------|-----------------|--------------|--------|--------|--------|-------------|
| Resource | ❌ Absent | Conceptual Model + Platform Capability | TOUS les entités manipulées sont des Resources. Absence de ce concept = chaque entité traitée séparément. | Ajouter au Conceptual Model v1 + créer resource-capability spec | Élevé | Fondamental pour toute la plateforme | Conceptual Model, Database Schema |
| Relationship | ❌ Absent | Conceptual Model + Platform Capability | group_memberships, org_unit hierarchy, member→org — tout est une Relationship | Ajouter au Conceptual Model + créer relationship-capability spec | Élevé | Fondamental pour le DAG organizationnel | ADR-014, Conceptual Model |
| Policy | ❌ Absent | Conceptual Model + Platform Capability | approval_thresholds, retention_periods, rate_limits sont tous des Policies | Créer policy-capability spec | Moyen | Centralise toutes les règles configurables | Runtime Modeling Gaps |
| Lifecycle | ❌ Absent | Platform Capability | Archive entries avec states (draft→active→archived→trashed→purged) — cycle de vie configurable | Créer lifecycle-capability spec | Moyen | Généralise le pattern archive | BACKEND-PG-SCHEMA, BACKEND-COMPREHENSIVE |
| Search | ❌ Absent | Platform Capability | Full-text search sur archive_entries, members, events — besoin détecté | Créer search-capability spec | Faible | Réduit la recherche à une capacité reusable | BACKEND-RLS-EDGE-FUNCTIONS |
| Branding | ❌ Absent | Platform Capability | Design tokens (couleur, logo, police, thème) — besoin détecté mais mélangé avec DESIGN.md | Déplacer branding de DESIGN.md vers capability spec | Faible | Centralise le theming | DESIGN.md, ADR-011 |

## Groupe D: Foundation Services (Sévère)

| Élément | Couche Actuelle | Couche Correcte | Justification | Action | Risque | Impact | Dépendances |
|---------|-----------------|-----------------|--------------|--------|--------|--------|-------------|
| Identity Service | ❌ Absent | Foundation | Users, profiles, sessions — service fondamental | Créer docs/10-foundation/identity.md | Moyen | Clarifie où vit l'auth | ADR-009 |
| Security Service | ❌ Absent | Foundation | Auth, JWT, password_hash — service fondamental | Créer docs/10-foundation/security.md | Faible | Isolate security concerns | ADR-005, ADR-009 |
| Permissions Service | ❌ Partiel (Capability Registry) | Foundation | RBAC, JWT injection, policy evaluation — service fondamental de sécurité | Créer docs/10-foundation/permissions.md | Moyen | Sépare permissions concept de permissions execution | RBAC research |
| Audit Service | ❌ Absent | Foundation + Platform Capability | Audit trail immutable — FOUNDATION service ET Capability | Créer docs/10-foundation/audit.md | Faible | Clarifie invariant INV-007 | Invariants, BACKEND-PG-SCHEMA |
| Configuration Service | ❌ Absent | Foundation | Org settings, i18n, settings par org — service fondamental | Créer docs/10-foundation/configuration.md | Faible | Centralise la config | Runtime Modeling Gaps |
| Offline Service | ❌ Absent | Foundation | Synchronization strategy, conflict resolution — service fondamental | Créer docs/10-foundation/offline.md | Moyen | Clarifie que offline-first est un service fondamental, pas une implémentation | ADR-003, offline-first/index.md |
| Localization Service | ❌ Absent | Foundation | i18n, date formats, number formats, currency display — service fondamental | Créer docs/10-foundation/localization.md | Faible | Sépare i18n technique de i18n business | Runtime Modeling Gaps |
| Storage Service | ❌ Absent | Foundation | Photos, receipts, attachments — gestion stockage local et distant | Créer docs/10-foundation/storage.md | Faible | Clarifie séparation storage technique / storage business | PRD |
| Logging Service | ❌ Absent | Foundation | Application logs, diagnostic logs, performance metrics | Créer docs/10-foundation/logging.md | Faible | Sépare audit (INV-007) de logging technique | PRD |

## Groupe E: Business Packs & Templates (Modéré)

| Élément | Couche Actuelle | Couche Correcte | Justification | Action | Risque | Impact | Dépendances |
|---------|-----------------|-----------------|--------------|--------|--------|--------|-------------|
| Business Packs | ❌ Absent | Architecture Layer | Church Pack, School Pack, NGO Pack, Company Pack — composition de Capacities | Créer docs/business-packs/ avec 4 subfolders | Faible | Permet de voir explicitement comment les Capacities composent des domaines | Constitution, PRD |
| Template ↔ Manifest confusion | Glossaire, INDEX.md | Clarifier: Template ≠ Manifest | Template = blueprint configurables / Manifest = instance de template compilée pour une org | Mettre à jour glossary.md avec distinction claire | Faible | Évite confusion documentation | Glossary, INDEX.md |
| Organization Templates | Engineering declarative analysis | Architecture Layer → Templates layer | Church/Ngo/School/Company templates = configuration pure, pas code | Déplacer dans docs/business-packs/ au niveau Template | Faible | Alignement Architecture | engineered-declarative-analysis.md |

## Groupe F: Terminologie PRD (Mineur)

| Élément | Couche Actuelle | Couche Correcte | Justification | Action | Risque | Impact | Dépendances |
|---------|-----------------|-----------------|--------------|--------|--------|--------|-------------|
| "Gestion Membres" PRD §4 | Fonctionnalité métier | Composition de Capacities | PRD utilise terme fonctionnel | Remplacer par "Identity + Resource + Relationship + Forms + Workflow" | Faible | Terminologie alignée | PRD |
| "Configuration Organisation" PRD §4 | Fonctionnalité métier | Manifest Capability + Forms Capability + Policy Capability | Setup wizard = composition de Manifest + Forms + Policy | Remplacer dans le PRD | Faible | Terminologie alignée | PRD |
| "Gestion Rôles/Permissions" PRD §4 | Feature | Permission Capability + Policy Capability + Manifest Capability | Roles sont des compositions de Permissions évaluées via Policy Engine | Remplacer dans le PRD | Faible | Terminologie alignée | PRD, RBAC research |
| "Notifications" PRD §4 | Feature | Notification Capability | Déjà une Capacité (voir E-B1) | Mettre à jour PRD §4 pour dire "Notification capability" | Faible | Terminologie alignée | PRD |

---

## Résumé de Priorisation

### CRITIQUE — Avant tout codage
1. Groupe B: Remplacer features par Capacities dans Capability Engine
2. Groupe C: Ajouter Resource + Relationship au Conceptual Model
3. Groupe A: Séparer chaque Moteur en Capacité + Executor

### IMPORTANT — Avant Sprint 1
4. Groupe D: Documenter les 9 services Foundation
5. Groupe E: Structurer Business Packs + Templates

### RAPIDE — En cours de migration
6. Groupe F: Nettoyer terminologie PRD
