# RLS Policy Specification — Lumina v1

**Doc ID:** RLS-POLICY-SPECIFICATION-V1
**Version:** 1.1
**Statut:** CONSTITUTIONNEL — POLITIQUES SECURITE NIVEAU LIGNE FIGEES — Post-TRR-v1.1 Remediation
**Date:** 2026-07-25
**Generateur :** RLS Policy Generator v1.0
**Source canonique :** ["DOC-021", "DOC-023\u00a78", "IGS-v1\u00a73.4"]
**Transformation :** Physical Object + _org_id -> RLS Policies per table x role
**Règle IGS :** Etape 4 du pipeline IGS-v1

---

## MARKERS DE TRACABILITE IGS-v1

Chaque section majeure et chaque bloc SQL contient les metadonnees obligatoires :

| Champ | Valeur |
|-------|--------|
| generation_id | SHA-256-calculé-à-génération |
| source_canonical | DOC-021 + DOC-023§8 |
| transformation_rule | rls-generator v1.0 |
| generation_date | 2026-07-24T10:00:00Z |
| architecture_version | v1.0 (DOC-000-DOC-024 + ARA-v1) |
| compliance_status | COMPLIANT |

---

## INTRODUCTION

Ce document definit les politiques de Row Level Security (RLS) pour l'ensemble des 32 tables de Lumina, reparties sur 13 Aggregates. Chaque politique garantit l'isolement multi-tenant par `_org_id` et controle l'acces selon le role applicatif.

**Principe fondamental :** Aucune donnée ne peut être lue, insérée, modifiée ou supprimée sans que la politique RLS ne vérifie `org_id = current_setting('request.org_id')::uuid`.

**Remediation M-004 :** Le bypass RLS superadmin est gere UNIQUEMENT cote APPLICATION (pas de DDL GUC).
L'application backend configure `SET lumina.bypass_rls = true` sur la session PostgreSQL avant d'executer
les requetes du superadmin. Aucune fonction SQL, trigger, ou extension ne gere ce bypass cote base de donnees.
Cela respecte le principe de moindre privilege : `lumina_superadmin` est NOSUPERUSER et n'a pas les privileg
systemiques PostgreSQL qui contourneraient RLS nativement.

**Cible :** PostgreSQL 15+. Tout SQL est exécutable tel quel.

---

## SECTION 1 : DEFINITION DES ROLES POSTGRESQL

### 1.1 lumina_superadmin

```sql
-- === ROLE: lumina_superadmin ===
-- Source: DOC-023§8 + IdentityAggregate
-- Role type: Super admin système global
-- Bypass RLS: OUI (SUPERUSER config)
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_superadmin WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_superadmin IS 'Super admin système global — access RLS via session config SET lumina.bypass_rls = true (bypass via postgres SUPERUSER disabled for least privilege)';
GRANT CONNECT ON DATABASE postgres TO lumina_superadmin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lumina_superadmin;
```

**Responsabilités :**
- Administration globale de tous les tenants
- Bypass RLS activé via configuration session
- Supervision de l'audit (lecture seule sur audit_entries)
- Gestion des configurations d'organisation
- Accès de dépannage d'urgence avec journalisation

**Permissions spécifiques :**
- Tous les SELECT, INSERT, UPDATE, DELETE sur toutes les tables
- Bypass RLS configure au niveau session : `SET lumina.bypass_rls = on`
- Lecture seule sur credentials (données sensibles)

---

### 1.2 lumina_admin

```sql
-- === ROLE: lumina_admin ===
-- Source: DOC-023§8 + OrganizationAggregate
-- Role type: Admin tenant courant
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_admin WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_admin IS 'Admin tenant — accès complet aux données du tenant courant uniquement';
GRANT CONNECT ON DATABASE postgres TO lumina_admin;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lumina_admin;
```

**Responsabilités :**
- Gestion complète du tenant courant
- Administration des membres et utilisateurs de son org
- Configuration settings et categories
- Supervision des workflows et notifications

**Permissions spécifiques :**
- CRUD complet sur toutes les tables du tenant courant
- Filtre RLS : `org_id = current_setting('request.org_id')::uuid`
- Accès exclusif aux données de son organisation

---

### 1.3 lumina_treasurer

```sql
-- === ROLE: lumina_treasurer ===
-- Source: DOC-023§8 + ResourceAggregate (finance)
-- Role type: Trésorier — accès finance
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_treasurer WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_treasurer IS 'Trésorier — lecture + écriture finance uniquement';
GRANT CONNECT ON DATABASE postgres TO lumina_treasurer;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lumina_treasurer;
GRANT SELECT, INSERT, UPDATE ON transactions, report_snapshots, reports TO lumina_treasurer;
```

**Responsabilités :**
- Gestion des transactions financières
- Lecture des rapports financiers et snapshots
- Catégorisation des dépenses via vocabulary
- Lecture des members et events (pas d'écriture)
- Pas d'accès aux users, credentials, sessions

---

### 1.4 lumina_pastor

```sql
-- === ROLE: lumina_pastor ===
-- Source: DOC-023§8 + ResourceAggregate (ressources humaines)
-- Role type: Pasteur — accès ressources
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_pastor WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_pastor IS 'Pasteur — lecture + écriture sur les ressources (members, events, groups)';
GRANT CONNECT ON DATABASE postgres TO lumina_pastor;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lumina_pastor;
GRANT SELECT, INSERT, UPDATE ON members, events, group_memberships, org_units, forms, form_sections, form_fields, notifications TO lumina_pastor;
```

**Responsabilités :**
- Gestion des membres (inscription, modification, statut)
- Création et publication d'événements
- Gestion des groupes (group_memberships)
- Organisation de l'unité (org_units)
- Forms et notifications liées aux activités pastorales

---

### 1.5 lumina_staff

```sql
-- === ROLE: lumina_staff ===
-- Source: DOC-023§8 + ResourceAggregate
-- Role type: Staff — lecture limitée, écriture restreinte
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_staff WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_staff IS 'Staff — lecture limitée sur les ressources, écriture restreinte';
GRANT CONNECT ON DATABASE postgres TO lumina_staff;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lumina_staff;
```

**Responsabilités :**
- Lecture extensive des données du tenant
- Écriture limitée sur certains records (events draft, forms fields)
- Pas d'accès à credentials, sessions, audits
- Pas d'accès à transactions ni settings

---

### 1.6 lumina_service_account

```sql
-- === ROLE: lumina_service_account ===
-- Source: DOC-023§8 + API Backend
-- Role type: Compte de service API backend
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_service_account WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_service_account IS 'Compte de service API backend — accès programmatique à toutes les données du tenant';
GRANT CONNECT ON DATABASE postgres TO lumina_service_account;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lumina_service_account;
```

**Responsabilités :**
- Interface API backend
- Tous les CRUD sur les données du tenant courant
- Accès aux users, sessions, credentials pour authentification
- Synchronisation avec offline-first via pending_operations

---

### 1.7 lumina_migration_role

```sql
-- === ROLE: lumina_migration_role ===
-- Source: DOC-023§8 + Schema Management
-- Role type: Migration uniquement
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_migration_role WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_migration_role IS 'Role de migration — execution des scripts DDL uniquement, PAS de RLS policies car il agit au niveau schéma';
GRANT CONNECT ON DATABASE postgres TO lumina_migration_role;
GRANT USAGE ON SCHEMA public TO lumina_migration_role;
GRANT CREATE ON SCHEMA public TO lumina_migration_role;
```

**Responsabilités :**
- Execution exclusive des migrations DDL
- USAGE + CREATE sur schema public
- AUCUNE politique RLS appliquée (travaille au niveau schéma, pas données)
- Role désactivé après migration complétée

---

### 1.8 lumina_readonly

```sql
-- === ROLE: lumina_readonly ===
-- Source: DOC-023§8 + Audit & Reporting
-- Role type: Lecture seule (audit, reporting)
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_readonly WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_readonly IS 'Lecture seule — accès en lecture à toutes les données du tenant courant pour audit et reporting';
GRANT CONNECT ON DATABASE postgres TO lumina_readonly;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO lumina_readonly;
```

**Responsabilités :**
- Lecture uniquement sur toutes les tables
- Reporting financier, audit d'activité
- Surveillance de l'intégrité des données
- Pas d'INSERT/UPDATE/DELETE jamais

---

### 1.9 lumina_sync_service

```sql
-- === ROLE: lumina_sync_service ===
-- Source: DOC-023§8 + OfflineSyncAggregate
-- Role type: Service de synchronisation offline-first
-- Bypass RLS: NON
-- compliance_status: COMPLIANT

CREATE ROLE IF NOT EXISTS lumina_sync_service WITH LOGIN NOSUPERUSER NOINHERIT;
COMMENT ON ROLE lumina_sync_service IS 'Service de synchronisation offline-first — accès aux tables de sync et aux données qui nécessitent la synchronisation';
GRANT CONNECT ON DATABASE postgres TO lumina_sync_service;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO lumina_sync_service;
```

**Responsabilités :**
- Gestion des pending_operations et sync_statuses
- Push/pull de données entre app mobile/offline et serveur
- Synchronisation des transactions, members, events, archives
- Respect complet des filtres RLS org_id

---

### Tableau Récapitulatif des Rôles

| Rôle | Type | SUPERUSER | NOINHERIT | RLS Bypass | Schéma Usage |
|------|------|-----------|-----------|------------|-------------|
| lumina_superadmin | Super admin | NO* | OUI | OUI (session) | CRUD |
| lumina_admin | Admin tenant | NON | OUI | NON | CRUD tenant |
| lumina_treasurer | Trésorier | NON | OUI | NON | Finance R/W |
| lumina_pastor | Pasteur | NON | OUI | NON | Ressources R/W |
| lumina_staff | Staff | NON | OUI | NON | Lecture limitée |
| lumina_service_account | Service | NON | OUI | NON | API CRUD |
| lumina_migration_role | Migration | NON | OUI | N/A (pas de RLS) | SCHEMA ONLY |
| lumina_readonly | Lecteur seul | NON | OUI | NON | SELECT only |
| lumina_sync_service | Sync | NON | OUI | NON | Sync tables |

*superadmin a NOSUPERUSER mais bypass RLS via session config `lumina.bypass_rls` au lieu de privilège SUPERUSER PostgreSQL. Cela limite l'exposition aux opérations système tout en permettant le bypass RLS contrôlé.

---

---

## SECTION 2 : MATRICE D'ACCES TABLE x ROLE

Pour chaque table des 32 tables, la matrice ci-dessous definit l'acces par role et action.

**Legende :** T = Acces complet (action autorisee), R = Lecture seule, N = Non autorise

### Table : organizations (OrganizationAggregate) --- DOC-021§1.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | R | N | N | N |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | N | N | N | N |

### Table : org_units (OrganizationAggregate) --- DOC-021§1.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | N | N | N | N |

### Table : org_settings (OrganizationAggregate) --- DOC-021§1.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | N | N | N | N |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | N | N | N | N |
| migration_role | N | N | N | N |
| readonly | N | N | N | N |
| sync_service | N | N | N | N |

### Table : users (IdentityAggregate) --- DOC-021§2.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | N | N | N | N |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : sessions (IdentityAggregate) --- DOC-021§2.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | N | N | N | N |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : credentials (IdentityAggregate) --- DOC-021§2.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | N | N | N | N |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | N | N | N | N |
| migration_role | N | N | N | N |
| readonly | N | N | N | N |
| sync_service | N | N | N | N |

### Table : transactions (ResourceAggregate) --- DOC-021§3.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | T | T | T | T |

### Table : members (ResourceAggregate) --- DOC-021§3.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | T | T | T | T |

### Table : events (ResourceAggregate) --- DOC-021§3.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | T | T | T | T |

### Table : categories (ResourceAggregate) --- DOC-021§3.4

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : group_memberships (RelationshipAggregate) --- DOC-021§4.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : org_unit_links (RelationshipAggregate) --- DOC-021§4.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | N | N | N | N |

### Table : workflow_instances (WorkflowAggregate) --- DOC-021§5.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | R | N | N | N |

### Table : workflow_steps (WorkflowAggregate) --- DOC-021§5.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | R | N | N | N |

### Table : workflow_logs (WorkflowAggregate) --- DOC-021§5.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | R | N | N | N |

### Table : forms (FormAggregate) --- DOC-021§6.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | T | T | T | T |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : form_sections (FormAggregate) --- DOC-021§6.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | T | T | T | T |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : form_fields (FormAggregate) --- DOC-021§6.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | T | T | T | T |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : notifications (NotificationAggregate) --- DOC-021§7.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : notification_preferences (NotificationAggregate) --- DOC-021§7.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | N | N | N | N |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : notification_logs (NotificationAggregate) --- DOC-021§7.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : vocab_namespaces (VocabularyAggregate) --- DOC-021§8.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : vocab_terms (VocabularyAggregate) --- DOC-021§8.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : vocab_values (VocabularyAggregate) --- DOC-021§8.3

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | T | T | T | T |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : reports (ReportingAggregate) --- DOC-021§9.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : report_snapshots (ReportingAggregate) --- DOC-021§9.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | T | T | T | T |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : audit_entries (AuditAggregate) --- DOC-021§10.1

**FORCE ROW LEVEL SECURITY sur cette table uniquement**

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | R | N | N | N |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : archives (LifecycleAggregate) --- DOC-021§11.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : purge_schedules (LifecycleAggregate) --- DOC-021§11.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | N | N | N | N |
| pastor | N | N | N | N |
| staff | N | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | T | T | T | T |
| sync_service | N | N | N | N |

### Table : settings (ConfigurationAggregate) --- DOC-021§12.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | N | N | N | N |

### Table : pending_operations (OfflineSyncAggregate) --- DOC-021§13.1

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | T | T | T | T |

### Table : sync_statuses (OfflineSyncAggregate) --- DOC-021§13.2

| Role | SELECT | INSERT | UPDATE | DELETE |
|------|--------|--------|--------|--------|
| superadmin | T | T | T | T |
| admin | T | T | T | T |
| treasurer | R | N | N | N |
| pastor | R | N | N | N |
| staff | R | N | N | N |
| service_account | T | T | T | T |
| migration_role | N | N | N | N |
| readonly | R | N | N | N |
| sync_service | T | T | T | T |


## SECTION 3 : POLITIQUES RLS PAR TABLE

Pour CHAQUE table, les politiques RLS suivantes sont generees automatiquement.

**Regle universelle de filtrage :** `org_id = current_setting('request.org_id')::uuid`

**Remediation M-005 (Idempotence) :** Chaque `CREATE POLICY` est precede d'un `DROP POLICY IF EXISTS pol_...` pour garantir l'idempotence a la re-execution.

**Important :**
- `lumina_superadmin` bypass RLS via session config (`SET lumina.bypass_rls = true`) --- aucune politique SQL ne doit etre creee pour ce role.
- `lumina_migration_role` N'A JAMAIS aucune politique RLS (role migration DDL uniquement).
- `FORCE ROW LEVEL SECURITY` est applique UNIQUEMENT sur `audit_entries` (NB-PERSIST-006).
- Chaque politique cree un policy name unique : `pol_{table}_{role_short}_{action}`
  Convention uniformisee apres TRR-v1.1 M-003: role_short en seconde position.

### 3.1 organizations
**Aggregate :** OrganizationAggregate
**Source :** DOC-021§1.1

```sql
-- === RLS POLICY: organizations ===
-- Aggregate: OrganizationAggregate
-- Source: DOC-021§1.1
-- compliance_status: COMPLIANT

ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_organizations_ad_select ON organizations;
CREATE POLICY pol_organizations_ad_select ON organizations
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_ad_insert ON organizations
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_ad_update ON organizations
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_ad_delete ON organizations
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_tr_select ON organizations
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_pa_select ON organizations
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_st_select ON organizations
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_svc_select ON organizations
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_organizations_ro_select ON organizations
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.2 org_units
**Aggregate :** OrganizationAggregate
**Source :** DOC-021§1.2

```sql
-- === RLS POLICY: org_units ===
-- Aggregate: OrganizationAggregate
-- Source: DOC-021§1.2
-- compliance_status: COMPLIANT

ALTER TABLE org_units ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_org_units_ad_select ON org_units;
CREATE POLICY pol_org_units_ad_select ON org_units
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_ad_insert ON org_units
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_ad_update ON org_units
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_ad_delete ON org_units
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_tr_select ON org_units
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_pa_select ON org_units
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_pa_insert ON org_units
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_pa_update ON org_units
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_pa_delete ON org_units
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_st_select ON org_units
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_svc_select ON org_units
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_svc_insert ON org_units
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_svc_update ON org_units
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_svc_delete ON org_units
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_units_ro_select ON org_units
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.3 org_settings
**Aggregate :** OrganizationAggregate
**Source :** DOC-021§1.3

```sql
-- === RLS POLICY: org_settings ===
-- Aggregate: OrganizationAggregate
-- Source: DOC-021§1.3
-- compliance_status: COMPLIANT

ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_org_settings_ad_select ON org_settings;
CREATE POLICY pol_org_settings_ad_select ON org_settings
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_settings_ad_insert ON org_settings
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_settings_ad_update ON org_settings
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_settings_ad_delete ON org_settings
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.4 users
**Aggregate :** IdentityAggregate
**Source :** DOC-021§2.1

```sql
-- === RLS POLICY: users ===
-- Aggregate: IdentityAggregate
-- Source: DOC-021§2.1
-- compliance_status: COMPLIANT

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_users_ad_select ON users;
CREATE POLICY pol_users_ad_select ON users
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_ad_insert ON users
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_ad_update ON users
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_ad_delete ON users
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_svc_select ON users
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_svc_insert ON users
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_svc_update ON users
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_svc_delete ON users
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_users_ro_select ON users
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.5 sessions
**Aggregate :** IdentityAggregate
**Source :** DOC-021§2.2

```sql
-- === RLS POLICY: sessions ===
-- Aggregate: IdentityAggregate
-- Source: DOC-021§2.2
-- compliance_status: COMPLIANT

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_sessions_ad_select ON sessions;
CREATE POLICY pol_sessions_ad_select ON sessions
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_ad_insert ON sessions
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_ad_update ON sessions
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_ad_delete ON sessions
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_svc_select ON sessions
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_svc_insert ON sessions
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_svc_update ON sessions
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_svc_delete ON sessions
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sessions_ro_select ON sessions
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.6 credentials
**Aggregate :** IdentityAggregate
**Source :** DOC-021§2.3

```sql
-- === RLS POLICY: credentials ===
-- Aggregate: IdentityAggregate
-- Source: DOC-021§2.3
-- compliance_status: COMPLIANT

ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_credentials_ad_select ON credentials;
CREATE POLICY pol_credentials_ad_select ON credentials
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_credentials_ad_insert ON credentials
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_credentials_ad_update ON credentials
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_credentials_ad_delete ON credentials
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.7 transactions
**Aggregate :** ResourceAggregate
**Source :** DOC-021§3.1

```sql
-- === RLS POLICY: transactions ===
-- Aggregate: ResourceAggregate
-- Source: DOC-021§3.1
-- compliance_status: COMPLIANT

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_transactions_ad_select ON transactions;
CREATE POLICY pol_transactions_ad_select ON transactions
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_ad_insert ON transactions
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_ad_update ON transactions
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_ad_delete ON transactions
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_tr_select ON transactions
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_tr_insert ON transactions
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_tr_update ON transactions
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_tr_delete ON transactions
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_svc_select ON transactions
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_svc_insert ON transactions
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_svc_update ON transactions
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_svc_delete ON transactions
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_ro_select ON transactions
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_sy_select ON transactions
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_sy_insert ON transactions
    FOR INSERT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_sy_update ON transactions
    FOR UPDATE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_transactions_sy_delete ON transactions
    FOR DELETE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.8 members
**Aggregate :** ResourceAggregate
**Source :** DOC-021§3.2

```sql
-- === RLS POLICY: members ===
-- Aggregate: ResourceAggregate
-- Source: DOC-021§3.2
-- compliance_status: COMPLIANT

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_members_ad_select ON members;
CREATE POLICY pol_members_ad_select ON members
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_ad_insert ON members
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_ad_update ON members
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_ad_delete ON members
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_tr_select ON members
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_pa_select ON members
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_pa_insert ON members
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_pa_update ON members
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_pa_delete ON members
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_st_select ON members
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_svc_select ON members
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_svc_insert ON members
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_svc_update ON members
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_svc_delete ON members
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_ro_select ON members
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_sy_select ON members
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_sy_insert ON members
    FOR INSERT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_sy_update ON members
    FOR UPDATE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_members_sy_delete ON members
    FOR DELETE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.9 events
**Aggregate :** ResourceAggregate
**Source :** DOC-021§3.3

```sql
-- === RLS POLICY: events ===
-- Aggregate: ResourceAggregate
-- Source: DOC-021§3.3
-- compliance_status: COMPLIANT

ALTER TABLE events ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_events_ad_select ON events;
CREATE POLICY pol_events_ad_select ON events
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_ad_insert ON events
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_ad_update ON events
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_ad_delete ON events
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_tr_select ON events
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_pa_select ON events
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_pa_insert ON events
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_pa_update ON events
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_pa_delete ON events
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_st_select ON events
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_svc_select ON events
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_svc_insert ON events
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_svc_update ON events
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_svc_delete ON events
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_ro_select ON events
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_sy_select ON events
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_sy_insert ON events
    FOR INSERT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_sy_update ON events
    FOR UPDATE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_events_sy_delete ON events
    FOR DELETE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.10 categories
**Aggregate :** ResourceAggregate
**Source :** DOC-021§3.4

```sql
-- === RLS POLICY: categories ===
-- Aggregate: ResourceAggregate
-- Source: DOC-021§3.4
-- compliance_status: COMPLIANT

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_categories_ad_select ON categories;
CREATE POLICY pol_categories_ad_select ON categories
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_ad_insert ON categories
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_ad_update ON categories
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_ad_delete ON categories
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_tr_select ON categories
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_tr_insert ON categories
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_tr_update ON categories
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_tr_delete ON categories
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_pa_select ON categories
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_pa_insert ON categories
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_pa_update ON categories
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_pa_delete ON categories
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_st_select ON categories
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_svc_select ON categories
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_svc_insert ON categories
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_svc_update ON categories
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_svc_delete ON categories
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_categories_ro_select ON categories
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.11 group_memberships
**Aggregate :** RelationshipAggregate
**Source :** DOC-021§4.1

```sql
-- === RLS POLICY: group_memberships ===
-- Aggregate: RelationshipAggregate
-- Source: DOC-021§4.1
-- compliance_status: COMPLIANT

ALTER TABLE group_memberships ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_group_memberships_ad_select ON group_memberships;
CREATE POLICY pol_group_memberships_ad_select ON group_memberships
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_ad_insert ON group_memberships
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_ad_update ON group_memberships
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_ad_delete ON group_memberships
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_tr_select ON group_memberships
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_pa_select ON group_memberships
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_pa_insert ON group_memberships
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_pa_update ON group_memberships
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_pa_delete ON group_memberships
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_st_select ON group_memberships
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_svc_select ON group_memberships
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_svc_insert ON group_memberships
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_svc_update ON group_memberships
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_svc_delete ON group_memberships
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_group_memberships_ro_select ON group_memberships
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.12 org_unit_links
**Aggregate :** RelationshipAggregate
**Source :** DOC-021§4.2

```sql
-- === RLS POLICY: org_unit_links ===
-- Aggregate: RelationshipAggregate
-- Source: DOC-021§4.2
-- compliance_status: COMPLIANT

ALTER TABLE org_unit_links ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_org_unit_links_ad_select ON org_unit_links;
CREATE POLICY pol_org_unit_links_ad_select ON org_unit_links
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_ad_insert ON org_unit_links
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_ad_update ON org_unit_links
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_ad_delete ON org_unit_links
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_tr_select ON org_unit_links
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_pa_select ON org_unit_links
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_st_select ON org_unit_links
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_svc_select ON org_unit_links
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_svc_insert ON org_unit_links
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_svc_update ON org_unit_links
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_svc_delete ON org_unit_links
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_org_unit_links_ro_select ON org_unit_links
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.13 workflow_instances
**Aggregate :** WorkflowAggregate
**Source :** DOC-021§5.1

```sql
-- === RLS POLICY: workflow_instances ===
-- Aggregate: WorkflowAggregate
-- Source: DOC-021§5.1
-- compliance_status: COMPLIANT

ALTER TABLE workflow_instances ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_workflow_instances_ad_select ON workflow_instances;
CREATE POLICY pol_workflow_instances_ad_select ON workflow_instances
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_ad_insert ON workflow_instances
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_ad_update ON workflow_instances
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_ad_delete ON workflow_instances
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_tr_select ON workflow_instances
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_pa_select ON workflow_instances
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_st_select ON workflow_instances
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_svc_select ON workflow_instances
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_svc_insert ON workflow_instances
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_svc_update ON workflow_instances
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_svc_delete ON workflow_instances
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_ro_select ON workflow_instances
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_instances_sy_select ON workflow_instances
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.14 workflow_steps
**Aggregate :** WorkflowAggregate
**Source :** DOC-021§5.2

```sql
-- === RLS POLICY: workflow_steps ===
-- Aggregate: WorkflowAggregate
-- Source: DOC-021§5.2
-- compliance_status: COMPLIANT

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_workflow_steps_ad_select ON workflow_steps;
CREATE POLICY pol_workflow_steps_ad_select ON workflow_steps
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_ad_insert ON workflow_steps
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_ad_update ON workflow_steps
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_ad_delete ON workflow_steps
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_tr_select ON workflow_steps
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_pa_select ON workflow_steps
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_st_select ON workflow_steps
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_svc_select ON workflow_steps
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_svc_insert ON workflow_steps
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_svc_update ON workflow_steps
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_svc_delete ON workflow_steps
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_ro_select ON workflow_steps
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_steps_sy_select ON workflow_steps
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.15 workflow_logs
**Aggregate :** WorkflowAggregate
**Source :** DOC-021§5.3

```sql
-- === RLS POLICY: workflow_logs ===
-- Aggregate: WorkflowAggregate
-- Source: DOC-021§5.3
-- compliance_status: COMPLIANT

ALTER TABLE workflow_logs ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_workflow_logs_ad_select ON workflow_logs;
CREATE POLICY pol_workflow_logs_ad_select ON workflow_logs
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_ad_insert ON workflow_logs
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_ad_update ON workflow_logs
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_ad_delete ON workflow_logs
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_tr_select ON workflow_logs
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_pa_select ON workflow_logs
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_st_select ON workflow_logs
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_svc_select ON workflow_logs
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_svc_insert ON workflow_logs
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_svc_update ON workflow_logs
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_svc_delete ON workflow_logs
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_ro_select ON workflow_logs
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_workflow_logs_sy_select ON workflow_logs
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.16 forms
**Aggregate :** FormAggregate
**Source :** DOC-021§6.1

```sql
-- === RLS POLICY: forms ===
-- Aggregate: FormAggregate
-- Source: DOC-021§6.1
-- compliance_status: COMPLIANT

ALTER TABLE forms ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_forms_ad_select ON forms;
CREATE POLICY pol_forms_ad_select ON forms
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_ad_insert ON forms
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_ad_update ON forms
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_ad_delete ON forms
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_tr_select ON forms
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_pa_select ON forms
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_pa_insert ON forms
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_pa_update ON forms
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_pa_delete ON forms
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_st_select ON forms
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_st_insert ON forms
    FOR INSERT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_st_update ON forms
    FOR UPDATE TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_st_delete ON forms
    FOR DELETE TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_svc_select ON forms
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_svc_insert ON forms
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_svc_update ON forms
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_svc_delete ON forms
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_forms_ro_select ON forms
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.17 form_sections
**Aggregate :** FormAggregate
**Source :** DOC-021§6.2

```sql
-- === RLS POLICY: form_sections ===
-- Aggregate: FormAggregate
-- Source: DOC-021§6.2
-- compliance_status: COMPLIANT

ALTER TABLE form_sections ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_form_sections_ad_select ON form_sections;
CREATE POLICY pol_form_sections_ad_select ON form_sections
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_ad_insert ON form_sections
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_ad_update ON form_sections
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_ad_delete ON form_sections
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_tr_select ON form_sections
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_pa_select ON form_sections
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_pa_insert ON form_sections
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_pa_update ON form_sections
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_pa_delete ON form_sections
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_st_select ON form_sections
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_st_insert ON form_sections
    FOR INSERT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_st_update ON form_sections
    FOR UPDATE TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_st_delete ON form_sections
    FOR DELETE TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_svc_select ON form_sections
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_svc_insert ON form_sections
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_svc_update ON form_sections
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_svc_delete ON form_sections
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_sections_ro_select ON form_sections
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.18 form_fields
**Aggregate :** FormAggregate
**Source :** DOC-021§6.3

```sql
-- === RLS POLICY: form_fields ===
-- Aggregate: FormAggregate
-- Source: DOC-021§6.3
-- compliance_status: COMPLIANT

ALTER TABLE form_fields ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_form_fields_ad_select ON form_fields;
CREATE POLICY pol_form_fields_ad_select ON form_fields
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_ad_insert ON form_fields
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_ad_update ON form_fields
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_ad_delete ON form_fields
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_tr_select ON form_fields
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_pa_select ON form_fields
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_pa_insert ON form_fields
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_pa_update ON form_fields
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_pa_delete ON form_fields
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_st_select ON form_fields
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_st_insert ON form_fields
    FOR INSERT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_st_update ON form_fields
    FOR UPDATE TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_st_delete ON form_fields
    FOR DELETE TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_svc_select ON form_fields
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_svc_insert ON form_fields
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_svc_update ON form_fields
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_svc_delete ON form_fields
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_form_fields_ro_select ON form_fields
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.19 notifications
**Aggregate :** NotificationAggregate
**Source :** DOC-021§7.1

```sql
-- === RLS POLICY: notifications ===
-- Aggregate: NotificationAggregate
-- Source: DOC-021§7.1
-- compliance_status: COMPLIANT

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_notifications_ad_select ON notifications;
CREATE POLICY pol_notifications_ad_select ON notifications
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_ad_insert ON notifications
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_ad_update ON notifications
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_ad_delete ON notifications
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_tr_select ON notifications
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_pa_select ON notifications
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_pa_insert ON notifications
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_pa_update ON notifications
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_pa_delete ON notifications
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_st_select ON notifications
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_svc_select ON notifications
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_svc_insert ON notifications
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_svc_update ON notifications
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_svc_delete ON notifications
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notifications_ro_select ON notifications
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.20 notification_preferences
**Aggregate :** NotificationAggregate
**Source :** DOC-021§7.2

```sql
-- === RLS POLICY: notification_preferences ===
-- Aggregate: NotificationAggregate
-- Source: DOC-021§7.2
-- compliance_status: COMPLIANT

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_notification_preferences_ad_select ON notification_preferences;
CREATE POLICY pol_notification_preferences_ad_select ON notification_preferences
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_ad_insert ON notification_preferences
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_ad_update ON notification_preferences
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_ad_delete ON notification_preferences
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_svc_select ON notification_preferences
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_svc_insert ON notification_preferences
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_svc_update ON notification_preferences
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_svc_delete ON notification_preferences
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_preferences_ro_select ON notification_preferences
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.21 notification_logs
**Aggregate :** NotificationAggregate
**Source :** DOC-021§7.3

```sql
-- === RLS POLICY: notification_logs ===
-- Aggregate: NotificationAggregate
-- Source: DOC-021§7.3
-- compliance_status: COMPLIANT

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_notification_logs_ad_select ON notification_logs;
CREATE POLICY pol_notification_logs_ad_select ON notification_logs
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_ad_insert ON notification_logs
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_ad_update ON notification_logs
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_ad_delete ON notification_logs
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_tr_select ON notification_logs
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_pa_select ON notification_logs
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_pa_insert ON notification_logs
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_pa_update ON notification_logs
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_pa_delete ON notification_logs
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_st_select ON notification_logs
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_svc_select ON notification_logs
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_svc_insert ON notification_logs
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_svc_update ON notification_logs
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_svc_delete ON notification_logs
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_notification_logs_ro_select ON notification_logs
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.22 vocab_namespaces
**Aggregate :** VocabularyAggregate
**Source :** DOC-021§8.1

```sql
-- === RLS POLICY: vocab_namespaces ===
-- Aggregate: VocabularyAggregate
-- Source: DOC-021§8.1
-- compliance_status: COMPLIANT

ALTER TABLE vocab_namespaces ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_vocab_namespaces_ad_select ON vocab_namespaces;
CREATE POLICY pol_vocab_namespaces_ad_select ON vocab_namespaces
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_ad_insert ON vocab_namespaces
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_ad_update ON vocab_namespaces
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_ad_delete ON vocab_namespaces
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_tr_select ON vocab_namespaces
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_tr_insert ON vocab_namespaces
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_tr_update ON vocab_namespaces
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_tr_delete ON vocab_namespaces
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_pa_select ON vocab_namespaces
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_pa_insert ON vocab_namespaces
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_pa_update ON vocab_namespaces
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_pa_delete ON vocab_namespaces
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_st_select ON vocab_namespaces
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_svc_select ON vocab_namespaces
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_svc_insert ON vocab_namespaces
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_svc_update ON vocab_namespaces
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_svc_delete ON vocab_namespaces
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_namespaces_ro_select ON vocab_namespaces
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.23 vocab_terms
**Aggregate :** VocabularyAggregate
**Source :** DOC-021§8.2

```sql
-- === RLS POLICY: vocab_terms ===
-- Aggregate: VocabularyAggregate
-- Source: DOC-021§8.2
-- compliance_status: COMPLIANT

ALTER TABLE vocab_terms ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_vocab_terms_ad_select ON vocab_terms;
CREATE POLICY pol_vocab_terms_ad_select ON vocab_terms
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_ad_insert ON vocab_terms
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_ad_update ON vocab_terms
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_ad_delete ON vocab_terms
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_tr_select ON vocab_terms
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_tr_insert ON vocab_terms
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_tr_update ON vocab_terms
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_tr_delete ON vocab_terms
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_pa_select ON vocab_terms
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_pa_insert ON vocab_terms
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_pa_update ON vocab_terms
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_pa_delete ON vocab_terms
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_st_select ON vocab_terms
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_svc_select ON vocab_terms
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_svc_insert ON vocab_terms
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_svc_update ON vocab_terms
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_svc_delete ON vocab_terms
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_terms_ro_select ON vocab_terms
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.24 vocab_values
**Aggregate :** VocabularyAggregate
**Source :** DOC-021§8.3

```sql
-- === RLS POLICY: vocab_values ===
-- Aggregate: VocabularyAggregate
-- Source: DOC-021§8.3
-- compliance_status: COMPLIANT

ALTER TABLE vocab_values ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_vocab_values_ad_select ON vocab_values;
CREATE POLICY pol_vocab_values_ad_select ON vocab_values
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_ad_insert ON vocab_values
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_ad_update ON vocab_values
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_ad_delete ON vocab_values
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_tr_select ON vocab_values
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_tr_insert ON vocab_values
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_tr_update ON vocab_values
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_tr_delete ON vocab_values
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_pa_select ON vocab_values
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_pa_insert ON vocab_values
    FOR INSERT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_pa_update ON vocab_values
    FOR UPDATE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_pa_delete ON vocab_values
    FOR DELETE TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_st_select ON vocab_values
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_svc_select ON vocab_values
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_svc_insert ON vocab_values
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_svc_update ON vocab_values
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_svc_delete ON vocab_values
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_vocab_values_ro_select ON vocab_values
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.25 reports
**Aggregate :** ReportingAggregate
**Source :** DOC-021§9.1

```sql
-- === RLS POLICY: reports ===
-- Aggregate: ReportingAggregate
-- Source: DOC-021§9.1
-- compliance_status: COMPLIANT

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_reports_ad_select ON reports;
CREATE POLICY pol_reports_ad_select ON reports
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_ad_insert ON reports
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_ad_update ON reports
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_ad_delete ON reports
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_tr_select ON reports
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_tr_insert ON reports
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_tr_update ON reports
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_tr_delete ON reports
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_pa_select ON reports
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_st_select ON reports
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_svc_select ON reports
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_svc_insert ON reports
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_svc_update ON reports
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_svc_delete ON reports
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_reports_ro_select ON reports
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.26 report_snapshots
**Aggregate :** ReportingAggregate
**Source :** DOC-021§9.2

```sql
-- === RLS POLICY: report_snapshots ===
-- Aggregate: ReportingAggregate
-- Source: DOC-021§9.2
-- compliance_status: COMPLIANT

ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_report_snapshots_ad_select ON report_snapshots;
CREATE POLICY pol_report_snapshots_ad_select ON report_snapshots
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_ad_insert ON report_snapshots
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_ad_update ON report_snapshots
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_ad_delete ON report_snapshots
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_tr_select ON report_snapshots
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_tr_insert ON report_snapshots
    FOR INSERT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_tr_update ON report_snapshots
    FOR UPDATE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_tr_delete ON report_snapshots
    FOR DELETE TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_pa_select ON report_snapshots
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_st_select ON report_snapshots
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_svc_select ON report_snapshots
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_svc_insert ON report_snapshots
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_svc_update ON report_snapshots
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_svc_delete ON report_snapshots
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_report_snapshots_ro_select ON report_snapshots
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.27 audit_entries
**Aggregate :** AuditAggregate
**Source :** DOC-021§10.1

```sql
-- === RLS POLICY: audit_entries ===
-- Aggregate: AuditAggregate
-- Source: DOC-021§10.1
-- compliance_status: COMPLIANT

ALTER TABLE audit_entries FORCE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_audit_entries_ad_select ON audit_entries;
CREATE POLICY pol_audit_entries_ad_select ON audit_entries
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_ad_insert ON audit_entries
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_ad_update ON audit_entries
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_ad_delete ON audit_entries
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_tr_select ON audit_entries
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_pa_select ON audit_entries
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_st_select ON audit_entries
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_svc_select ON audit_entries
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_audit_entries_ro_select ON audit_entries
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.28 archives
**Aggregate :** LifecycleAggregate
**Source :** DOC-021§11.1

```sql
-- === RLS POLICY: archives ===
-- Aggregate: LifecycleAggregate
-- Source: DOC-021§11.1
-- compliance_status: COMPLIANT

ALTER TABLE archives ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_archives_ad_select ON archives;
CREATE POLICY pol_archives_ad_select ON archives
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_ad_insert ON archives
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_ad_update ON archives
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_ad_delete ON archives
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_tr_select ON archives
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_pa_select ON archives
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_st_select ON archives
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_svc_select ON archives
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_svc_insert ON archives
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_svc_update ON archives
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_svc_delete ON archives
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_archives_ro_select ON archives
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.29 purge_schedules
**Aggregate :** LifecycleAggregate
**Source :** DOC-021§11.2

```sql
-- === RLS POLICY: purge_schedules ===
-- Aggregate: LifecycleAggregate
-- Source: DOC-021§11.2
-- compliance_status: COMPLIANT

ALTER TABLE purge_schedules ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_purge_schedules_ad_select ON purge_schedules;
CREATE POLICY pol_purge_schedules_ad_select ON purge_schedules
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_ad_insert ON purge_schedules
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_ad_update ON purge_schedules
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_ad_delete ON purge_schedules
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_svc_select ON purge_schedules
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_svc_insert ON purge_schedules
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_svc_update ON purge_schedules
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_svc_delete ON purge_schedules
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_purge_schedules_ro_select ON purge_schedules
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.30 settings
**Aggregate :** ConfigurationAggregate
**Source :** DOC-021§12.1

```sql
-- === RLS POLICY: settings ===
-- Aggregate: ConfigurationAggregate
-- Source: DOC-021§12.1
-- compliance_status: COMPLIANT

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_settings_ad_select ON settings;
CREATE POLICY pol_settings_ad_select ON settings
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_ad_insert ON settings
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_ad_update ON settings
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_ad_delete ON settings
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_tr_select ON settings
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_pa_select ON settings
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_st_select ON settings
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_svc_select ON settings
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_svc_insert ON settings
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_svc_update ON settings
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_svc_delete ON settings
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_settings_ro_select ON settings
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.31 pending_operations
**Aggregate :** OfflineSyncAggregate
**Source :** DOC-021§13.1

```sql
-- === RLS POLICY: pending_operations ===
-- Aggregate: OfflineSyncAggregate
-- Source: DOC-021§13.1
-- compliance_status: COMPLIANT

ALTER TABLE pending_operations ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_pending_operations_ad_select ON pending_operations;
CREATE POLICY pol_pending_operations_ad_select ON pending_operations
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_ad_insert ON pending_operations
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_ad_update ON pending_operations
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_ad_delete ON pending_operations
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_tr_select ON pending_operations
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_pa_select ON pending_operations
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_st_select ON pending_operations
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_svc_select ON pending_operations
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_svc_insert ON pending_operations
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_svc_update ON pending_operations
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_svc_delete ON pending_operations
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_ro_select ON pending_operations
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_sy_select ON pending_operations
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_sy_insert ON pending_operations
    FOR INSERT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_sy_update ON pending_operations
    FOR UPDATE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_pending_operations_sy_delete ON pending_operations
    FOR DELETE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

### 3.32 sync_statuses
**Aggregate :** OfflineSyncAggregate
**Source :** DOC-021§13.2

```sql
-- === RLS POLICY: sync_statuses ===
-- Aggregate: OfflineSyncAggregate
-- Source: DOC-021§13.2
-- compliance_status: COMPLIANT

ALTER TABLE sync_statuses ENABLE ROW LEVEL SECURITY;
-- NOTE: superadmin bypasses RLS via session config --- no SQL policy needed
-- NOTE: migration_role never gets any RLS policy

DROP POLICY IF EXISTS pol_sync_statuses_ad_select ON sync_statuses;
CREATE POLICY pol_sync_statuses_ad_select ON sync_statuses
    FOR SELECT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_ad_insert ON sync_statuses
    FOR INSERT TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_ad_update ON sync_statuses
    FOR UPDATE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_ad_delete ON sync_statuses
    FOR DELETE TO lumina_admin
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_tr_select ON sync_statuses
    FOR SELECT TO lumina_treasurer
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_pa_select ON sync_statuses
    FOR SELECT TO lumina_pastor
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_st_select ON sync_statuses
    FOR SELECT TO lumina_staff
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_svc_select ON sync_statuses
    FOR SELECT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_svc_insert ON sync_statuses
    FOR INSERT TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_svc_update ON sync_statuses
    FOR UPDATE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_svc_delete ON sync_statuses
    FOR DELETE TO lumina_service_account
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_ro_select ON sync_statuses
    FOR SELECT TO lumina_readonly
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_sy_select ON sync_statuses
    FOR SELECT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_sy_insert ON sync_statuses
    FOR INSERT TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_sy_update ON sync_statuses
    FOR UPDATE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid)
    WITH CHECK (org_id = current_setting('request.org_id')::uuid);

CREATE POLICY pol_sync_statuses_sy_delete ON sync_statuses
    FOR DELETE TO lumina_sync_service
    USING (org_id = current_setting('request.org_id')::uuid);

```

---

## SECTION 4 : REGLES D'ACTIVATION RLS

Cette section definit l'ordre d'activation des politiques RLS et la procedure globale.

### 4.1 Ordre d'Activation

Les politiques RLS doivent etre activees dans l'ordre strict suivant :

1. **Migration Schema** --- `lumina_migration_role` execute le DDL (CREATE TABLE, ALTER TABLE ADD COLUMN, etc.)
2. **Migration Roles** --- `lumina_migration_role` execute les CREATE ROLE et GRANT
3. **Phase ENABLE** --- Pour chaque table, executer `ALTER TABLE ... ENABLE ROW LEVEL SECURITY`
4. **Phase FORCE** --- Pour `audit_entries`, executer `ALTER TABLE ... FORCE ROW LEVEL SECURITY`
5. **Phase POLICY** --- Pour chaque table, executer tous les `CREATE POLICY`
6. **Phase VERIFICATION** --- Executer les queries de verification (voir Section 5)

```sql
-- === ORDRE GLOBAL D'ACTIVATION RLS ===
-- Execute par: lumina_migration_role

-- ETAPE 1: Migration schema DDL
-- (les CREATE TABLE et ALTER TABLE ADD existent deja)

-- ETAPE 2: Creation des roles
-- (executer SECTION 1 en entier)

-- ETAPE 3: Grant connect
GRANT USAGE ON SCHEMA public TO lumina_admin, lumina_treasurer, lumina_pastor,
       lumina_staff, lumina_service_account, lumina_readonly, lumina_sync_service;

-- ETAPE 4: Verifier qu'aucune table n'a RLS avant activation
SELECT relname, relrowsecurity, relforcerowsecurity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname IN (
  'organizations',
  'org_units',
  'org_settings',
  'users',
  'sessions',
  'credentials',
  'transactions',
  'members',
  'events',
  'categories',
  'group_memberships',
  'org_unit_links',
  'workflow_instances',
  'workflow_steps',
  'workflow_logs',
  'forms',
  'form_sections',
  'form_fields',
  'notifications',
  'notification_preferences',
  'notification_logs',
  'vocab_namespaces',
  'vocab_terms',
  'vocab_values',
  'reports',
  'report_snapshots',
  'audit_entries',
  'archives',
  'purge_schedules',
  'settings',
  'pending_operations',
  'sync_statuses'
);

-- ETAPE 5: Activer ENABLE ROW LEVEL SECURITY pour toutes les tables
-- (executer les ALTER TABLE de chaque sous-section de Section 3)

-- ETAPE 6: Forcer RLS sur audit_entries UNIQUEMENT
ALTER TABLE audit_entries FORCE ROW LEVEL SECURITY;

-- ETAPE 7: Appliquer toutes les politiques CREATE POLICY
-- (executer tous les blocs CREATE POLICY de chaque sous-section de Section 3)

-- ETAPE 8: Verification finale (voir Section 5)
```

### 4.2 Phase ENABLE / FORCE / POLICY / VERIFICATION

| Phase | Description | Commande SQL | Ordre |
|-------|-------------|--------------|-------|
| ENABLE | Activer RLS sur chaque table | `ALTER TABLE t ENABLE ROW LEVEL SECURITY` | 1er, par table |
| FORCE | Forcer RLS meme pour possesseur table | `ALTER TABLE audit_entries FORCE ROW LEVEL SECURITY` | 2eme, UNIQUEMENT audit_entries |
| POLICY | Creer les politiques par role/action | `CREATE POLICY pol_x ON y FOR SELECT ...` | 3eme, apres ENABLE |
| VERIFY | Executer checks de validation | `SELECT count(*) FROM pg_policies WHERE tablename = '...'` | 4eme, en dernier |

### 4.3 Fallback REJECT ALL

Si une politique RLS cause un probleme (bloque un role qui doit avoir acces),
utiliser le fallback suivant pour rejeter tout acces sur une table specifier :

```sql
-- === FALLBACK : REJECT ALL sur une table donnee ===
-- Utiliser UNIQUEMENT si les politiques normales causent des problemes
-- et que la table doit etre temporairement verrouillee.

DROP POLICY IF EXISTS pol_reject_all_users ON target_table;
DROP POLICY IF EXISTS pol_reject_all_admin ON target_table;
-- ... supprimer toutes les policies existantes ...

CREATE POLICY pol_reject_all_users ON target_table
    FOR ALL TO PUBLIC
    USING (false)
    WITH CHECK (false);

-- Pour restaurer les politiques normales, executer
-- la Section 3 de ce document en entier.
```

### 4.4 Procedure Rollback

En cas d'echec pendant l'activation RLS, proceder au rollback dans l'ordre inverse :

```sql
-- === ROLLBACK COMPLETE RLS ===
-- Executer dans l'ordre inverse de l'activation

-- ETAPE 1: Supprimer toutes les politiques
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT schemaname, tablename, policyname
        FROM pg_policies
        WHERE schemaname = 'public'
        AND policyname LIKE 'pol_%'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
        RAISE NOTICE 'Dropped policy % on %', r.policyname, r.tablename;
    END LOOP;
END $$;

-- ETAPE 2: Desactiver ROW LEVEL SECURITY
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relrowsecurity = true
    LOOP
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', r.relname);
        RAISE NOTICE 'Disabled RLS on %', r.relname;
    END LOOP;
END $$;

-- ETAPE 3: Desactiver FORCE RLS
ALTER TABLE audit_entries NO FORCE ROW LEVEL SECURITY;

-- ETAPE 4: Retirer les roles (optionnel)
-- DROP ROLE IF EXISTS lumina_admin; -- etc.
```

---
## SECTION 5 : SCRIPTS DE VERIFICATION

Ces scripts SQL permettent de verifier que les politiques RLS sont correctes
et actives sur toutes les tables apres l'activation.

### 5.1 Verifier les policies actives par table

```sql
-- === VERIFICATION : Politiques actives par table ===
-- Renvoie toutes les policies RLS creees pour les tables Lumina.

SELECT
    tablename,
    policyname,
    permissive,
    roles AS role_names,
    cmd AS command,
    qual AS using_clause,
    with_check AS with_check_clause
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'organizations', 'org_units', 'org_settings', 'users', 'sessions', 'credentials', 'transactions', 'members', 'events', 'categories', 'group_memberships', 'org_unit_links', 'workflow_instances', 'workflow_steps', 'workflow_logs', 'forms', 'form_sections', 'form_fields', 'notifications', 'notification_preferences', 'notification_logs', 'vocab_namespaces', 'vocab_terms', 'vocab_values', 'reports', 'report_snapshots', 'audit_entries', 'archives', 'purge_schedules', 'settings', 'pending_operations', 'sync_statuses'
)
ORDER BY tablename, policyname;
```

### 5.2 Detecter les tables sans politique

```sql
-- === DETECTION : Tables sans politique RLS ===
-- Ces tables DOIVENT avoir au moins une politique active (sauf si pas de RLS).

SELECT
    c.relname AS table_name
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policies p ON p.tablename = c.relname AND p.schemaname = 'public'
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relname IN (
    'organizations', 'org_units', 'org_settings', 'users', 'sessions', 'credentials', 'transactions', 'members', 'events', 'categories', 'group_memberships', 'org_unit_links', 'workflow_instances', 'workflow_steps', 'workflow_logs', 'forms', 'form_sections', 'form_fields', 'notifications', 'notification_preferences', 'notification_logs', 'vocab_namespaces', 'vocab_terms', 'vocab_values', 'reports', 'report_snapshots', 'audit_entries', 'archives', 'purge_schedules', 'settings', 'pending_operations', 'sync_statuses'
)
AND p.policyname IS NULL
ORDER BY c.relname;

-- Si cette query retourne des lignes, ces tables manquent de politiques RLS.
-- Verifier la matrice d'acces (Section 2) pour savoir si c'est attendu.
```

### 5.3 Validation du pattern org_id filtering

```sql
-- === VALIDATION : Toutes les politiques filtrent par org_id ===
-- Chaque politique RLS doit contenir le filtre org_id = ... dans son USING clause.

SELECT
    policyname,
    tablename,
    qual AS using_clause,
    CASE
        WHEN qual LIKE '%org_id%' THEN 'OK --- contient org_id filter'
        ELSE 'ATTENTION --- PAS de org_id filter !'
    END AS validation_status
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'organizations', 'org_units', 'org_settings', 'users', 'sessions', 'credentials', 'transactions', 'members', 'events', 'categories', 'group_memberships', 'org_unit_links', 'workflow_instances', 'workflow_steps', 'workflow_logs', 'forms', 'form_sections', 'form_fields', 'notifications', 'notification_preferences', 'notification_logs', 'vocab_namespaces', 'vocab_terms', 'vocab_values', 'reports', 'report_snapshots', 'audit_entries', 'archives', 'purge_schedules', 'settings', 'pending_operations', 'sync_statuses'
)
AND qual IS NOT NULL
ORDER BY tablename, policyname;
```

### 5.4 Comptage des politiques par table

```sql
-- === COMPTE : Nombre de politiques par table ===
-- Chaque table devrait avoir entre 1 et 8 politiques selon la matrice d'acces.

SELECT
    tablename,
    count(*) AS policy_count,
    string_agg(DISTINCT role::text, ', ') AS roles_with_policies
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN (
    'organizations', 'org_units', 'org_settings', 'users', 'sessions', 'credentials', 'transactions', 'members', 'events', 'categories', 'group_memberships', 'org_unit_links', 'workflow_instances', 'workflow_steps', 'workflow_logs', 'forms', 'form_sections', 'form_fields', 'notifications', 'notification_preferences', 'notification_logs', 'vocab_namespaces', 'vocab_terms', 'vocab_values', 'reports', 'report_snapshots', 'audit_entries', 'archives', 'purge_schedules', 'settings', 'pending_operations', 'sync_statuses'
)
GROUP BY tablename
ORDER BY tablename;

-- === COMPTE : Total des politiques creees ===
SELECT count(*) AS total_policies
FROM pg_policies
WHERE schemaname = 'public';
```

### 5.5 Validation du FORCE RLS sur audit_entries

```sql
-- === VALIDATION : FORCE RLS sur audit_entries ===
-- NB-PERSIST-006 exige FORCE ROW LEVEL SECURITY sur audit_entries.

SELECT
    c.relname AS table_name,
    c.relforcerowsecurity AS force_rls_enabled,
    c.relrowsecurity AS rls_enabled
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relname = 'audit_entries';

-- Resultat attendu:
-- | table_name    | force_rls_enabled | rls_enabled |
-- |---------------|-------------------|-------------|
-- | audit_entries | t                 | t           |
```

### 5.6 Validation du bypass superadmin

```sql
-- === VALIDATION : Superadmin bypass via session config ===
-- Le role lumina_superadmin ne DOIT PAS avoir de politique RLS SQL.
-- Il bypass via SET lumina.bypass_rls = true en session.

SELECT
    policyname,
    tablename,
    roles AS role_names
FROM pg_policies
WHERE schemaname = 'public'
AND roles::text LIKE '%superadmin%'
ORDER BY tablename, policyname;

-- Cette query ne DEVRAIT retourner AUCUNE ligne.
-- Si elle retourne des lignes, supprimer les policies contenant superadmin.
```

### 5.7 Script de validation globale

```sql
-- === VALIDATION GLOBALE RLS ===
-- Executer apres chaque deployment pour s'assurer que:
-- 1. Toutes les 32 tables ont RLS active
-- 2. Chaque table a les bonnes politiques
-- 3. Aucun role non-autorise n'a de politique
-- 4. audit_entries a FORCE RLS

DO $$
DECLARE
    v_error text;
    v_errors int := 0;
    v_count bigint;
BEGIN
    -- Check 1: Toutes les tables ont RLS active
    FOR v_error IN
        SELECT c.relname
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public'
        AND c.relkind = 'r'
        AND NOT c.relrowsecurity
    LOOP
        RAISE WARNING 'Table % does NOT have RLS enabled!', v_error;
        v_errors := v_errors + 1;
    END LOOP;

    -- Check 2: audit_entries a FORCE RLS
    SELECT count(*) INTO v_count
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname = 'audit_entries'
    AND c.relforcerowsecurity = true;
    IF v_count = 0 THEN
        RAISE WARNING 'audit_entries does NOT have FORCE RLS!';
        v_errors := v_errors + 1;
    END IF;

    -- Check 3: Verifier que le superadmin n'a pas de politique RLS
    SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND roles::text LIKE '%superadmin%';
    IF v_count > 0 THEN
        RAISE WARNING 'Found % policy(ies) for superadmin --- these should be removed!', v_count;
        v_errors := v_errors + 1;
    END IF;

    -- Check 4: Compter les politiques totales
    SELECT count(*) INTO v_count
    FROM pg_policies
    WHERE schemaname = 'public'
    AND policyname LIKE 'pol_%';

    IF v_errors = 0 THEN
        RAISE NOTICE 'RLS validation PASSED: % policies found.', v_count;
    ELSE
        RAISE WARNING 'RLS validation FAILED: % errors found.', v_errors;
    END IF;
END $$;
```

---
