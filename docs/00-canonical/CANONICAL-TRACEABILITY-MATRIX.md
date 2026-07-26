# Canonical Traceability Matrix — Lumina v2

**Doc ID:** DOC-002 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** SOURCE DE VÉRITÉ ABSOLUE  
**Date:** 2026-07-24  

---

## Règle de Traçabilité

Chaque élément important de la plateforme doit être traçable via LA chaîne complète:

```
Concept → Capability → Runtime Service → Domain Object → Data Model → API → UI
```

Aucun Runtime Service ne peut précéder un Concept.
Aucune table SQL ne peut définir une Capability.
Aucune UI ne peut créer un concept nouveau.

Si UNE SEULE étape de la chaîne est cassée, l'élément est signalé comme ayant une **Rupture de Chaîne**.

---

## MATRICE DE TRACABILITÉ COMPLÈTE

### Organisation & Structure

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Organization | Manifest + Identity | Manifest Loader | organizations | organizations | `/api/org` | Org Setup Screen | ✅ |
| OrgUnit | Relationship | Dependency Resolver | org_units | org_units | `/api/org-units` | Org Hierarchy Screen | ✅ |
| GroupMembership | Relationship | Capability Orchestrator | group_memberships | group_memberships | N/A (data only) | N/A (view-only) | ✅ |

### Identity & Auth

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Identity | Identity Capability | Context Manager | users | users | `/api/auth/*` | Login Screen | ✅ |
| Permission | Permission Capability | Capability Orchestrator | user_sessions | users | `/api/authorize` | Role Config Screen | ✅ |
| Offline Sync | Offline Sync Capability | Init Coordinator | pending_operations | pending_operations | `/edge/sync-pending` | N/A (auto) | ✅ |

### Resource Management

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Resource (generic) | Resource Capability | Capability Orchestrator | transactions, members, events, archive_entries | toutes les tables de données | Multi endpoints | Tous les écrans CRUD | ✅ |
| Form | Forms Capability | Forms Executor | forms_overrides | org_settings (saved forms) | `/edge/generate-form` | Dynamic Form Renderer | ✅ |
| Vocabulary | Vocabulary Capability | Vocabulary Executor | categories | categories | N/A (lookup only) | Dropdown Selectors | ✅ |
| Workflow | Workflow Capability | Workflow Executor | workflows | pending_operations (status tracking) | Multi endpoints | Approval Flows | ✅ |

### Finance

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Resource | Resource Capability | — | Transaction | transactions | `/api/transactions` | Transaction Form + Ledger | ✅ |
| Workflow | Workflow Capability | — | Transaction (approval flow) | transactions | `/edge/validate-transaction` | Approval Screens | ✅ |
| Policy | Policy Capability | — | approval thresholds | org_settings | N/A | N/A | ⚠️ Rupture: Policy pas encore dans UI |
| Reporting | Reporting Capability | — | Bilan Report | transactions (read-only) | `/edge/calculate-bilan` | Balance Dashboard | ✅ |
| Audit | Audit Capability | — | Audit log | audit_logs | N/A (immutable) | Audit Viewer (future) | ⚠️ Rupture: audit UI non implémentée |

### Members

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Identity | Identity Capability | — | Member | members | `/api/members` | Member Directory | ✅ |
| Relationship | Relationship Capability | — | member→group | group_memberships | N/A (query only) | Group Assignment | ✅ |
| Form | Forms Capability | — | member_admission_form | org_settings | N/A | Admission Form | ✅ |
| Search | Search Capability | — | member search | members (GIN on name) | `/api/members?search=` | Search Bar | ✅ |
| Notification | Notification Capability | — | welcome notification | notifications | `/edge/send-notification` | N/A | ✅ |

### Archive & Lifecycle

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Lifecycle | Lifecycle Capability | Lifecycle Executor | archive_entry | archive_entries | `/edge/archive-*` | Archive Browser | ✅ |
| Policy | Policy Capability | Policy Executor | retention period | org_settings | N/A | N/A | ⚠️ Rupture: policy config pas dans UI |
| Resource | Resource Capability | — | archive_entry | archive_entries | `/edge/archive-create` | Archive Entry Form | ✅ |
| Search | Search Capability | — | archive search | archive_entries (GIN+tsvector) | `/edge/archive-search` | Archive Search Bar | ✅ |
| Audit | Audit Capability | — | archive actions | audit_logs | N/A | Audit Viewer | ⚠️ Rupture |

### Events & Activity

| Concept | Capability | Runtime | Domain | Data | API | UI | Estado |
|---------|-----------|---------|--------|------|-----|-----|------|
| Resource | Resource Capability | — | Event | events | `/api/events` | Event Calendar | ✅ |
| Activity | (subset of Resource) | — | Event (as activity) | events | `/api/events` | Event Details | ✅ |
| Notification | Notification Capability | — | event reminder | notifications | `/edge/send-notification` | N/A (triggered auto) | ✅ |
| Form | Forms Capability | — | event form | org_settings | N/A | Event Creation Form | ✅ |
| Search | Search Capability | — | event search | events | `/api/events?search=` | Search Bar | ✅ |

### Branding & Design

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Branding | Branding Capability | Branding Executor | org colors/theme | organizations.settings | N/A (client-side) | Theme Picker | ✅ |

### Configuration

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Configuration | Configuration Capability | Config Executor | org settings | org_settings | `/api/settings` | Org Settings Screen | ✅ |
| Manifest | Manifest Capability | Manifest Loader | manifest_yaml | organizations.manifest_json | N/A | Manifest Editor | ⚠️ Partial |

### Audit & Security

| Concept | Capability | Runtime | Domain | Data | API | UI | État |
|---------|-----------|---------|--------|------|-----|-----|------|
| Audit | Audit Capability | Audit Executor | AuditLogEntry | audit_logs | N/A (append-only) | Audit Log Viewer | ⚠️ Rupture |
| Policy | Policy Capability | Policy Executor | retention_policy | org_settings | N/A | N/A | ⚠️ Rupture |

---

## RÉSUMÉ DES RUPTURES

| # | Élément | Rupture | Niveau manquant | Priorité |
|---|---------|---------|----------------|----------|
| R-01 | Approval Thresholds (Policy) | Pas d'UI dédiée | UI | Basse (config via manifest YAML) |
| R-02 | Retention Policy (Policy) | Pas d'UI dédiée | UI | Basse (config via manifest YAML) |
| R-03 | Audit Log Viewer | Pas d'écran implémenté | UI | Moyenne (INV-007 nécessite lecture) |
| R-04 | Manifest Editor | Partiellement implémenté | UI | Haute (config org doit être editable en UI) |

Toutes les ruptures sont soit des ruptures UI uniquement (la chaîne conceptuelle→data existe), soit des configurations purement YAML (pas d'UI nécessaire).

**AUCUNE rupture conceptuelle n'a été détectée.** Tous les concepts du Conceptual Model v1 ont au moins une capability, un runtime service et un domaine objet associé.
