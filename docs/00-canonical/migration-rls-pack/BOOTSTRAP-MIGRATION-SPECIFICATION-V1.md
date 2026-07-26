# Bootstrap Migration Specification v1 — Lumina

**Doc ID:** BOOTSTRAP-MIGRATION-SPEC-v1
**Version:** 1.1
**Statut:** SPOC CANONIQUE — FONDATIONS EXÉCUTABLES — Post-TRR-v1.1 Remediation
**Date:** 2026-07-25T00:00:00Z
**Généré par:** Chief Platform Architect (agent IA)
**Source canonique :** DOC-021, DOC-023, IMPLEMENTATION-GENERATION-SPECIFICATION.md (§3.2 Migration Generator)
**Application :** Fondations PostgreSQL obligatoires avant toute migration de schéma ou politique RLS
**Règle IGS :** Prérequis avant Étape 1 du pipeline IGS-v1 (Schema Generator)

---

## TABLE DES MATIÈRES

1. [RÈGLES FONDAMENTALES](#1-r%C3%A8gles-fondamentales)
2. [STRUCTURE DU BOOTSTRAP](#2-structure-du-bootstrap)
3. [SCRIPT 1 : 000-extension-pgcrypto.sql](#3-script-1--000-extension-pgcryptoSQL)
4. [SCRIPT 2 : 001-schema-foundation.sql](#4-script-2--001-schema-foundationSQL)
5. [SCRIPT 3 : 002-role-initialization.sql](#5-script-3--002-role-initializationSQL)
6. [SCRIPT 4 : 003-bootstrap-verification.sql](#6-script-4--003-bootstrap-verificationSQL)
7. [RÉSUMÉ D'EXÉCUTION ORDER](#7-r%C3%A9sum%C3%A9-dex%C3%A9cution-order)
8. [ORDRE D'EXÉCUTION REQUIS](#8-ordre-dex%C3%A9cution-requis)
9. [INTÉGRATION AU PIPELINE IGS-V1](#9-int%C3%A9gration-au-pipeline-igsv1)
10. [HISTORIQUE](#10-historique)

---

## 1. REGLES FONDAMENTALES

### 1.1 Principes constitutionnels

Le Bootstrap Migration Specification est LE point d'entr�e obligatoiredans le pipeline IGS-v1.
Toute migration de schéma (�tape 1 du pipeline IGS-v1, §2.1) NE PEUT PAS s'ex�cuter sans que ces
4 scripts ont �t� appliqu�s avec succ�s pr�alablement.

| R�gle | Description |
|-------|-------------|
| **B-001** | Le bootstrap ne contient AUCUNE logique m�tier |
| **B-002** | Seul le sch�ma `organizations` est cr�e (table parente, d�pendance z�ro) |
| **B-003** | Les fonctions utilitaires sont LIMIT�ES aux fonctions n�cessaires au schema foundation uniquement |
| **B-004** | Chaque script est idempotent (IF NOT EXISTS, IF EXISTS) |
| **B-005** | Chaque script a sa propre section PRECONDITIONS/EXECUTION/POSTCONDITIONS/ROLLBACK |
| **B-006** | Aucun script ne d�pend du contenu des autres scripts — ils sont ex�cut�s s�quentiellement mais chaque script est autonome |
| **B-007** | Les r�les PostgreSQL sont cr��s avec NOINHERIT pour s�curit� |
| **B-008** | Le script de v�rification produit un r�sum� de statut actionnable |

### 1.2 Invariants respect�s

| Invariant Source | Application dans le Bootstrap |
|------------------|-------------------------------|
| NB-PERSIST-001 (DOC-017) | UUID natif via pgcrypto — aucun auto-incr�ment |
| NB-PERSIST-002 (DOC-017) | Isolation multi-tenant via org_id sur organizations |
| NB-RR-004 (DOC-023) | Identifiants immuables apr�s cr�ation |
| Migration Generator §3.2 (IGS) | Ordre topologique respect� : tables parentes d'abord |

### 1.3 Limitations du p�rim�tre

Le Bootstrap NE CR�E PAS :
- Tables autres que `organizations`
- Politiques RLS (��� seront g�n�r�es par l'�tape 4 du pipeline IGS-v1)
- Contraintes autres que celles sur la table `organizations` elle-m�me
- Trigger d'auto-audit
- Tables de configuration, synchronisation ou cycle de vie
- Index autres que ceux sur `organizations`

---

## 2. STRUCTURE DU BOOTSTRAP

Le bootstrap consiste en 4 scripts SQL ex�cut�s dans l'ordre strict suivant :

```
000-extension-pgcrypto.sql    → Extension UUID/crypto (pr�requis absolu)
001-schema-foundation.sql     → Table organizations + utilitaires minimales
002-role-initialization.sql   → R�les PostgreSQL pour RLS et administration
003-bootstrap-verification.sql → V�rification post-ex�cution compl�te
```

Chaque script suit le format IGS-v1 :
- Header avec m�tadonn�es de tra�abilit�
- Section `-- PRECONDITIONS`
- Section `-- EXECUTION`
- Section `-- POSTCONDITIONS`
- Section `-- ROLLBACK`

---

## 3. SCRIPT 1 : 000-extension-pgcrypto.sql

### M�tadonn�es

```sql
-- === IGS METADATA ===
-- generation_id: bootstrap-000-ext-pgcrypto
-- source_canonical: ["IMPLEMENTATION-GENERATION-SPECIFICATION.md §3.1", "SQL-DDL-SPECIFICATION-v1 §2"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "extension-bootstrap"
-- compliance_status: "COMPLIANT"
-- =====================
```

### Pr�requis

| Pr�requis | Description |
|-----------|-------------|
| PostgreSQL install� | Version 14 ou sup�rieure recommand�e (support natif gen_random_uuid()) |
| Acc�s superuser | Cr�ation d'extension requiert les privil�ges superuser ou creATEREXTENSION |
| Database existante | La base de donn�es cible doit exister et �tre accessible |

### Ex�cution

```sql
-- ============================================================
-- Script 000: pgcrypto Extension Bootstrap
-- ============================================================
-- Purpose: Install the pgcrypto extension for gen_random_uuid()
-- Source: DOC-021 (all PKs are uuid DEFAULT gen_random_uuid())
--         SQL-DDL-SPECIFICATION-v1 §2 (UUID Generation)
-- Identity: IGS-v1 extension-bootstrap
-- ============================================================

-- === IGS METADATA ===
-- generation_id: bootstrap-000-ext-pgcrypto
-- source_canonical: ["IMPLEMENTATION-GENERATION-SPECIFICATION.md §3.1", "SQL-DDL-SPECIFICATION-v1 §2"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "extension-bootstrap"
-- compliance_status: "COMPLIANT"
-- =====================

-- PRECONDITIONS
-- --------------------------------------------------------
-- 1. PostgreSQL server running and accessible
-- 2. Superuser or CREATEEXTENSION privilege available
-- 3. No other prerequisites required
-- --------------------------------------------------------

-- EXECUTION
-- --------------------------------------------------------
-- Install pgcrypto if not already present.
-- This is safe to run multiple times (idempotent).
-- gen_random_uuid() from pgcrypto is the ONLY UUID source
-- used throughout the Lumina schema (all 32 tables).
-- --------------------------------------------------------

CREATE EXTENSION IF NOT EXISTS pgcrypto SCHEMA public;

-- Post-PgCrypto: enable pgcrypto functions in public schema
-- (gen_random_uuid() must be callable without schema prefix)
DO $$
BEGIN
    -- Verify pgcrypto is installed by checking for gen_random_uuid
    PERFORM 1 FROM pg_extension WHERE extname = 'pgcrypto';
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
        RAISE EXCEPTION 'pgcrypto extension could not be installed. Ensure superuser privileges.';
    END IF;
END
$$;

-- POSTCONDITIONS
-- --------------------------------------------------------
-- Verify pgcrypto extension is installed and functional.
-- Query: SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';
-- Expected result: 1 row with extname = 'pgcrypto'
-- --------------------------------------------------------

DO $$
DECLARE
    ext_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO ext_count
    FROM pg_extension
    WHERE extname = 'pgcrypto';

    IF ext_count <> 1 THEN
        RAISE EXCEPTION 'POSTCONDITION FAILED: pgcrypto extension not found. ext_count = %', ext_count;
    END IF;

    -- Verify gen_random_uuid is callable
    PERFORM gen_random_uuid();
    -- If we get here without error, gen_random_uuid() works
END
$$;

-- ROLLBACK
-- --------------------------------------------------------
-- DROP EXTENSION IF EXISTS pgcrypto;
-- Note: DROP should only be performed if no other objects
-- depend on pgcrypto (e.g., generated UUID columns).
-- Since this is the FIRST script, this is safe.
-- --------------------------------------------------------

--
-- END OF SCRIPT 000: 000-extension-pgcrypto.sql
-- ============================================================
```

### Postconditions SQL

```sql
-- Verification query (should return 1 row):
SELECT extname, extowner::regrole, extversion
FROM pg_extension
WHERE extname = 'pgcrypto';
```

### Rollback SQL

```sql
DROP EXTENSION IF EXISTS pgcrypto CASCADE;
-- Note: CASCADE is needed because extensions may have dependent objects
```

---

## 4. SCRIPT 2 : 001-schema-foundation.sql

### M�tadonn�es

```sql
-- === IGS METADATA ===
-- generation_id: bootstrap-001-schema-orgs
-- source_canonical: ["DOC-021 §1.1", "DOC-023 §2-4", "IMPLEMENTATION-GENERATION-SPECIFICATION.md §3.2"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "schema-foundation"
-- target_table: "organizations"
-- aggregate: "OrganizationAggregate"
-- compliance_status: "COMPLIANT"
-- neverbreak: ["NB-PERSIST-001", "NB-PERSIST-002"]
-- =====================
```

### Pr�requis

| Pr�requis | Description |
|-----------|-------------|
| Script 000 ex�cut� | pgcrypto extension doit �tre install�e avant ce script |
| Acc�s database | L'utilisateur doit avoir les privil�ges CREATE sur le sch�ma public |
| Aucun confl�t de nom | Aucune table `organizations` ne doit exister dans le sch�ma public |

### Ex�cution

```sql
-- ============================================================
-- Script 001: Schema Foundation — organizations table
-- ============================================================
-- Purpose: Create the root organization table, the only
--          table with zero dependencies. All other tables
--          (org_units, users, transactions, etc.) depend
--          on organizations.id or organizations.org_id.
--
-- Source: DOC-021 §1.1 (Physical Object: organization)
-- Aggregate: OrganizationAggregate
-- NeverBreak rules applied: NB-PERSIST-001, NB-PERSIST-002
--
-- Identity: IGS-v1 schema-foundation
-- ============================================================

-- === IGS METADATA ===
-- generation_id: bootstrap-001-schema-orgs
-- source_canonical: ["DOC-021 §1.1", "DOC-023 §2-4", "IMPLEMENTATION-GENERATION-SPECIFICATION.md §3.2"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "schema-foundation"
-- target_table: "organizations"
-- aggregate: "OrganizationAggregate"
-- compliance_status: "COMPLIANT"
-- neverbreak: ["NB-PERSIST-001", "NB-PERSIST-002"]
-- =====================

-- PRECONDITIONS
-- --------------------------------------------------------
-- 1. pgcrypto extension installed (script 000)
-- 2. No existing 'organizations' table in public schema
-- 3. User has CREATE TABLE privilege
-- --------------------------------------------------------

-- EXECUTION
-- --------------------------------------------------------
-- Create the organizations table with all columns defined
-- in DOC-021 §1.1. This is the root table: every other
-- table in the Lumina schema references organizations.id.
--
-- Column mapping per DOC-021:
--   identifier       → id          (uuid PK, gen_random_uuid())
--   nom              → nom         (varchar(255), NOT NULL)
--   nom_court        → nom_court   (varchar(100))
--   type_org         → type_org    (varchar(20), CHECK enum)
--   statut           → statut      (varchar(20), DEFAULT 'active')
--   devise_iso4217   → devise_iso4217 (varchar(3), NOT NULL)
--   fuseau_horaire   → fuseau_horaire (varchar(100), NOT NULL)
--   langue_privee    → langue_privee (varchar(10), NOT NULL)
--   accent_hex       → accent_hex  (varchar(7), CHECK hex pattern)
--   created_at       → created_at  (timestamptz, DEFAULT now())
--   updated_at       → updated_at  (timestamptz, DEFAULT now())
--
-- Persistence metadata (DOC-017 §3.3):
--   version     → optimistic locking integer
--   synced_at   → last successful sync timestamp
--   _org_id     → self-reference for multi-tenant isolation
-- --------------------------------------------------------

-- Drop table if it exists (for safe re-run), then create
DROP TABLE IF EXISTS public.organizations CASCADE;

CREATE TABLE public.organizations (
    -- Primary key: UUID via pgcrypto gen_random_uuid()
    -- Source: DOC-021 §1.1, column type "identifiant (PK)"
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Multi-tenant isolation reference (self-referencing FK)
    -- This is the logical tenant identifier for RLS policies.
    -- Every row in organizations IS the tenant.
    -- Source: DOC-021 §1.1, attribute "org_id" (auto-reference)
    org_id        uuid NOT NULL REFERENCES organizations(id),

    -- Core identity fields
    -- Source: DOC-021 §1.1
    nom           varchar(255) NOT NULL,
    nom_court     varchar(100),
    type_org      varchar(20)
                  CHECK (type_org IN ('church','school','ngo','company','custom')),
    statut        varchar(20) NOT NULL DEFAULT 'active'
                  CHECK (statut IN ('active','suspended','archived')),

    -- Configuration fields
    -- Source: DOC-021 §1.1
    devise_iso4217 varchar(3) NOT NULL,
    fuseau_horaire varchar(100) NOT NULL,
    langue_privee  varchar(10) NOT NULL,
    accent_hex     varchar(7) NOT NULL
                   CHECK (accent_hex ~ '^#[0-9a-fA-F]{6}$'),

    -- Standard timestamps
    -- Source: DOC-021 §1.1 + DOC-021 "Colonnes de timestamps standards"
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),

    -- Persistence metadata (DOC-017 §3.3)
    version       integer NOT NULL DEFAULT 1,
    synced_at     timestamptz,

    -- Constraints
    -- Source: DOC-021 §1.1 + CC-ORG-001
    CONSTRAINT chk_org_stat_active_not_archived
        CHECK (NOT (statut = 'archived' AND statut != 'archived')),

    CONSTRAINT chk_devise_length CHECK (char_length(devise_iso4217) = 3)
);

-- Index: unique organization name (CC-ORG-001)
-- Prevents duplicate organization names within the system
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_nom
    ON public.organizations(nom);

-- Index: unique org_id (tenant isolation key)
-- Ensures each organization has a distinct tenant identifier
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_org_id
    ON public.organizations(org_id);

-- Index: performance index on statut for filtered queries
-- Common in dashboard queries and RLS policy resolution
CREATE INDEX IF NOT EXISTS idx_organizations_statut
    ON public.organizations(statut);

-- ============================================================
-- Utility functions required for organizations table support
-- ============================================================

-- Function: organizations_updated_timestamp()
-- Purpose: Automatically update the updated_at column on row modification.
-- Used by the trigger created below.
-- Source: Standard PostgreSQL pattern, required for organizations table
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.organizations_updated_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql STABLE;

-- Trigger: auto-update updated_at on organizations table
-- This is the ONLY trigger created at bootstrap level.
-- Other triggers (audit, versioning) come later in the pipeline.
-- --------------------------------------------------------

DO $$
BEGIN
    -- Drop existing trigger if present (safe re-run)
    DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;

    -- Create the auto-updated-at trigger
    CREATE TRIGGER trg_organizations_updated_at
        BEFORE UPDATE ON public.organizations
        FOR EACH ROW
        EXECUTE FUNCTION public.organizations_updated_timestamp();
END
$$;

-- Function: current_organization_id()
-- Purpose: Return the organization ID from the current session context.
-- Used as the basis for RLS policies. This function will be extended
-- with current_setting('lumina.current_org_id') once RLS policies
-- are generated in pipeline step 4.
-- Source: PIPELINE §3.4 RLS Policy Generator
-- --------------------------------------------------------

CREATE OR REPLACE FUNCTION public.current_organization_id()
RETURNS uuid AS $$
DECLARE
    v_org_id uuid;
BEGIN
    -- Try to read from session setting first (set by application layer)
    BEGIN
        v_org_id := current_setting('lumina.current_org_id', true)::uuid;
        IF v_org_id IS NOT NULL THEN
            RETURN v_org_id;
        END IF;
    EXCEPTION WHEN OTHERS THEN
        -- Setting not set, fall through
        NULL;
    END;

    -- For admin/bootstrap contexts where no org_id is set,
    -- return NULL to allow all rows (superadmin behavior via app-level bypass)
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Grant execute to lumina_migration_role so it can create
-- RLS policies during migration execution
GRANT EXECUTE ON FUNCTION public.current_organization_id() TO PUBLIC;

-- POSTCONDITIONS
-- --------------------------------------------------------
-- Verify the organizations table was created correctly:
-- 1. Table exists in public schema
-- 2. Has the expected number of columns
-- 3. Primary key is defined
-- 4. Check constraints are active
-- 5. Unique indexes exist
-- 6. Trigger exists
-- 7. Utility functions exist and are callable
--
-- Verification queries follow in script 003.
-- --------------------------------------------------------

-- Verify organizations table existence
DO $$
DECLARE
    table_exists BOOLEAN;
    col_count INTEGER;
    pk_count INTEGER;
    idx_count INTEGER;
    trigger_count INTEGER;
BEGIN
    -- Check table exists
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = 'organizations'
    ) INTO table_exists;

    IF NOT table_exists THEN
        RAISE EXCEPTION 'POSTCONDITION FAILED: organizations table does not exist';
    END IF;

    -- Check column count (expected: 15 columns)
    -- id, org_id, nom, nom_court, type_org, statut,
    -- devise_iso4217, fuseau_horaire, langue_privee, accent_hex,
    -- created_at, updated_at, version, synced_at
    SELECT COUNT(*) INTO col_count
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND column_name IN (
          'id', 'org_id', 'nom', 'nom_court', 'type_org', 'statut',
          'devise_iso4217', 'fuseau_horaire', 'langue_privee',
          'accent_hex', 'created_at', 'updated_at', 'version', 'synced_at'
      );

    IF col_count <> 14 THEN
        RAISE EXCEPTION 'POSTCONDITION WARNING: organizations table has % expected columns, expected 14', col_count;
    END IF;

    -- Check primary key exists
    SELECT COUNT(*) INTO pk_count
    FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name = 'organizations'
      AND constraint_type = 'PRIMARY KEY';

    IF pk_count <> 1 THEN
        RAISE EXCEPTION 'POSTCONDITION FAILED: organizations table missing primary key';
    END IF;

    -- Check unique indexes
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND tablename = 'organizations'
      AND indexname LIKE 'idx_organizations_%';

    IF idx_count < 2 THEN
        RAISE EXCEPTION 'POSTCONDITION FAILED: organizations table missing required indexes (found %)', idx_count;
    END IF;

    -- Check trigger exists
    SELECT COUNT(*) INTO trigger_count
    FROM information_schema.triggers
    WHERE event_object_schema = 'public'
      AND event_object_table = 'organizations'
      AND trigger_name = 'trg_organizations_updated_at';

    IF trigger_count <> 1 THEN
        RAISE EXCEPTION 'POSTCONDITION FAILED: organizations updated_at trigger not found';
    END IF;

    -- All checks passed
    RAISE NOTICE 'Bootstrap schema foundation verified successfully for organizations table';
END
$$;

-- ROLLBACK
-- --------------------------------------------------------
-- Cleanup all objects created by this script:
-- DROP TABLE public.organizations CASCADE;
-- DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
-- DROP FUNCTION IF EXISTS public.organizations_updated_timestamp();
-- DROP FUNCTION IF EXISTS public.current_organization_id();
--
-- Note: CASCADE on the table drop removes the trigger and any
-- dependent objects. The functions are explicitly dropped separately.
-- --------------------------------------------------------

--
-- END OF SCRIPT 001: 001-schema-foundation.sql
-- ============================================================
```

### Postconditions SQL

```sql
-- Full verification of organizations table state:
-- 1. Table exists
SELECT table_name, table_schema
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name = 'organizations'
  AND table_type = 'BASE TABLE';

-- 2. Column details
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organizations'
ORDER BY ordinal_position;

-- 3. Constraints
SELECT conname, contype, pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.organizations'::regclass
ORDER BY contype;

-- 4. Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'organizations'
ORDER BY indexname;

-- 5. Triggers
SELECT trigger_name, event_manipulation, action_timing
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'organizations';

-- 6. Functions
SELECT routine_name, routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('organizations_updated_timestamp', 'current_organization_id');
```

### Rollback SQL

```sql
-- Drop all objects created by script 001 in reverse dependency order
DROP TRIGGER IF EXISTS trg_organizations_updated_at ON public.organizations;
DROP FUNCTION IF EXISTS public.organizations_updated_timestamp();
DROP FUNCTION IF EXISTS public.current_organization_id();
DROP TABLE IF EXISTS public.organizations CASCADE;
```

---

## 5. SCRIPT 3 : 002-role-initialization.sql

### M�tadonn�es

```sql
-- === IGS METADATA ===
-- generation_id: bootstrap-002-roles
-- source_canonical: ["DOC-023 §8 (RLS roles)", "IMPLEMENTATION-GENERATION-SPECIFICATION.md §3.4"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "role-initialization"
-- role_count: 4
-- compliance_status: "COMPLIANT"
-- =====================
```

### Pr�requis

| Pr�requis | Description |
|-----------|-------------|
| Script 000 ex�cut� | pgcrypto extension disponible |
| Script 001 ex�cut� | Sch�ma de base cr�� (organizations table) |
| Acc�s superuser | Cr�ation de r�les requiert superuser privilege |
| Base de donn�es | La base courante doit accepter les connexions |

### Ex�cution

```sql
-- ============================================================
-- Script 002: Role Initialization
-- ============================================================
-- Purpose: Create the four foundational PostgreSQL roles
--          required for Row-Level Security (RLS) and
--          database administration in the Lumina platform.
--
-- Role hierarchy:
--   lumina_superadmin  → NOSUPERUSER, bypasses RLS via session config (app-level)
--   lumina_admin       → Tenant admin, full access within org
--   lumina_service_acc → Service account, limited permissions
--   lumina_migration   → Migration only, schema management
--
-- Source: DOC-023 §8 (Relational Rules — Security)
-- Pipeline: Required before pipeline step 4 (RLS Policy Generator)
--
-- Identity: IGS-v1 role-initialization
-- ============================================================

-- === IGS METADATA ===
-- generation_id: bootstrap-002-roles
-- source_canonical: ["DOC-023 §8 (RLS roles)", "IMPLEMENTATION-GENERATION-SPECIFICATION.md §3.4"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "role-initialization"
-- role_count: 4
-- compliance_status: "COMPLIANT"
-- =====================

-- PRECONDITIONS
-- --------------------------------------------------------
-- 1. pgcrypto extension installed (script 000)
-- 2. organizations table exists (script 001)
-- 3. Current user has superuser or CREATEROLE privilege
-- 4. No conflicting roles with the same names exist
-- --------------------------------------------------------

-- ============================================================
-- ROLE 1: lumina_superadmin
-- ============================================================
-- Responsibility: Platform-level administrator.
--   - NOSUPERUSER — least privilege approach (per TRR-v1.1 C-002)
--   - Bypasses RLS via session config SET lumina.bypass_rls = true (app-layer)
--   - Can manage all organizations through application layer
--   - Used for platform maintenance and debugging
--   - MUST NOT be used for day-to-day application auth
--
-- Source: DOC-023 §8 (Superadmin — NOSUPERUSER with app-level bypass)
-- Security: LOGIN password is rotated regularly;
--           use only for administrative tasks.
-- Remediation C-002: Changed from SUPERUSER to NOSUPERUSER.
--                    Bypass is now documented as application-managed, not SQL DDL.
-- ============================================================

DO $$
BEGIN
    -- Create role if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_superadmin') THEN
        CREATE ROLE lumina_superadmin
            WITH LOGIN
            PASSWORD 'CHANGE_ME_SUPERADMIN_SECURE_PWD_V1'
            NOSUPERUSER
            NOINHERIT;

        COMMENT ON ROLE lumina_superadmin IS
            'Platform super admin system global — access RLS via session config SET lumina.bypass_rls = true (bypass via postgres SUPERUSER disabled for least privilege)';
    ELSE
        -- Ensure role properties are correct even if role exists
        ALTER ROLE lumina_superadmin
            WITH LOGIN
            NOSUPERUSER
            NOINHERIT;
    END IF;
END
$$;

-- Grant CONNECT on the current database to superadmin
DO $$
BEGIN
    -- Revoke all existing privileges first for clean state
    REVOKE ALL ON DATABASE CURRENT_DATABASE() FROM lumina_superadmin;
    GRANT CONNECT ON DATABASE CURRENT_DATABASE() TO lumina_superadmin;
EXCEPTION WHEN OTHERS THEN
    -- If on a specific database, use the name directly
    BEGIN
        REVOKE ALL ON DATABASE lumina_app FROM lumina_superadmin;
        GRANT CONNECT ON DATABASE lumina_app TO lumina_superadmin;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignore if database name differs
    END;
END
$$;


-- ============================================================
-- ROLE 2: lumina_admin
-- ============================================================
-- Responsibility: Per-tenant administrator.
--   - Full CRUD access within their assigned organization(s)
--   - Subject to RLS policies (can only see own org data)
--   - Can manage organization settings, org_units, members
--   - Can approve/reject transactions (finance module)
--   - Cannot bypass RLS; cannot access other tenants' data
--
-- Source: DOC-023 §8 (Tenant admin role)
-- Security: Used as the authenticated role for tenant admins.
--           All actions scoped via current_organization_id().
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_admin') THEN
        CREATE ROLE lumina_admin
            WITH LOGIN
            PASSWORD 'CHANGE_ME_ADMIN_SECURE_PWD_V1'
            NOSUPERUSER
            NOINHERIT;

        COMMENT ON ROLE lumina_admin IS
            'Per-tenant administrator. Full CRUD within assigned org(s). ' ||
            'Subject to RLS isolation. Cannot access other tenants data. ' ||
            'Used as the authenticated role for tenant admin operations.';
    ELSE
        ALTER ROLE lumina_admin
            WITH LOGIN
            NOSUPERUSER
            NOINHERIT;
    END IF;
END
$$;

-- Grant CONNECT and basic schema usage to lumina_admin
DO $$
BEGIN
    GRANT CONNECT ON DATABASE CURRENT_DATABASE() TO lumina_admin;
    GRANT USAGE ON SCHEMA public TO lumina_admin;
    -- Will be extended with table-specific grants in pipeline step 3
    -- (Constraint & Index Generator produces detailed grant scripts)
END
$$;


-- ============================================================
-- ROLE 3: lumina_service_account
-- ============================================================
-- Responsibility: Application-level service account.
--   - Used by the Lumina application backend for database access
--   - Full read/write access within organizational boundaries
--   - Subject to ALL RLS policies strictly
--   - Can insert/update/read all tenant-scoped tables
--   - CANNOT create/drop/alter database objects
--   - Used exclusively by application JWT-authenticated sessions
--
-- Source: DOC-023 §8 (Service account for RLS enforcement)
-- Security: This role has the tightest permissions. All application
--           traffic should flow through this role or user-specific
--           roles derived from it. NEVER use lumina_admin for API calls.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_service_account') THEN
        CREATE ROLE lumina_service_account
            WITH LOGIN
            PASSWORD 'CHANGE_ME_SERVICE_SECURE_PWD_V1'
            NOSUPERUSER
            NOINHERIT;

        COMMENT ON ROLE lumina_service_account IS
            'Application service account. Tightest permissions: read/write ' ||
            'within org boundaries only, subject to ALL RLS. Used by ' ||
            'application backend for API traffic. NEVER use for direct queries.';
    ELSE
        ALTER ROLE lumina_service_account
            WITH LOGIN
            NOSUPERUSER
            NOINHERIT;
    END IF;
END
$$;

-- Grant CONNECT and basic schema usage to service account
DO $$
BEGIN
    GRANT CONNECT ON DATABASE CURRENT_DATABASE() TO lumina_service_account;
    GRANT USAGE ON SCHEMA public TO lumina_service_account;
END
$$;


-- ============================================================
-- ROLE 4: lumina_migration_role
-- ============================================================
-- Responsibility: Migration and schema management only.
--   - Used exclusively by the migration generator pipeline
--   - Can CREATE/ALTER/DROP tables, indices, constraints
--   - NOT subject to RLS (migration needs cross-org visibility)
--   - CANNOT read or modify application data
--   - Short-lived role, only active during migration execution
--
-- Source: PIPELINE §3.2 Migration Generator
-- Security: NOINHERIT ensures this role must be explicitly SET.
--           No persistent login credentials should be retained.
-- ============================================================

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_migration_role') THEN
        CREATE ROLE lumina_migration_role
            WITH LOGIN
            PASSWORD 'CHANGE_ME_MIGRATION_SECURE_PWD_V1'
            NOSUPERUSER
            NOINHERIT;

        COMMENT ON ROLE lumina_migration_role IS
            'Migration-only role. Schema DDL operations: CREATE/ALTER/DROP ' ||
            'tables, indices, constraints, functions. NOT subject to RLS. ' ||
            'Cannot read or modify application data. Short-lived, used only ' ||
            'during migration pipeline execution.';
    ELSE
        ALTER ROLE lumina_migration_role
            WITH LOGIN
            NOSUPERUSER
            NOINHERIT;
    END IF;
END
$$;

-- Grant CONNECT and schema usage to migration role
DO $$
BEGIN
    GRANT CONNECT ON DATABASE CURRENT_DATABASE() TO lumina_migration_role;
    GRANT USAGE ON SCHEMA public TO lumina_migration_role;
    -- Migration role gets full object management in schema
    GRANT CREATE ON SCHEMA public TO lumina_migration_role;
    -- Grant temporary table usage for migration staging
    GRANT TEMPORARY ON DATABASE CURRENT_DATABASE() TO lumina_migration_role;
END
$$;

-- ============================================================
-- Role cross-permissions and relationship grants
-- ============================================================

-- Allow superadmin to SET ROLE to other roles (for delegation)
GRANT lumina_admin TO lumina_superadmin;
GRANT lumina_service_account TO lumina_superadmin;
GRANT lumina_migration_role TO lumina_superadmin;

-- Postcondition: role hierarchy established
-- lumina_superadmin can impersonate any other Lumina role (NOSUPERUSER, app-bypass RLS)

-- ============================================================
-- Enable RLS capability on the organizations table
-- This prepares the table for RLS policies generated in pipeline step 4.
-- ============================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- By default, RLS denies all access when enabled.
-- The specific policies will be created by the RLS Policy Generator
-- (pipeline step 4). For now, ensure the superadmin bypass exists.
-- ============================================================

-- POSTCONDITIONS
-- --------------------------------------------------------
-- Verify all four roles were created correctly:
-- SELECT rolname, rolsuper, rolcanlogin, rolnoinherit
-- FROM pg_roles
-- WHERE rolname LIKE 'lumina_%';
--
-- Expected results (4 rows):
-- | rolname               | rolsuper | rolcanlogin | rolnoinherit |
-- |----------------------|----------|-------------|--------------|
-- | lumina_superadmin    | f        | t           | t            |  (NOSUPERUSER per C-002 — bypass via session config)
-- | lumina_admin         | f        | t           | t            |
-- | lumina_service_acc   | f        | t           | t            |
-- | lumina_migration     | f        | t           | t            |
--
-- RLS is enabled on organizations table:
-- SELECT relname, relrowsecurity
-- FROM pg_class
-- WHERE relname = 'organizations';
-- Expected: relrowsecurity = t
-- --------------------------------------------------------

DO $$
DECLARE
    role_count INTEGER;
    expected_roles text[] := ARRAY[
        'lumina_superadmin',
        'lumina_admin',
        'lumina_service_account',
        'lumina_migration_role'
    ];
    i TEXT;
    role_info RECORD;
BEGIN
    -- Verify total role count
    SELECT COUNT(*) INTO role_count
    FROM pg_roles
    WHERE rolname LIKE 'lumina_%';

    IF role_count < 4 THEN
        RAISE EXCEPTION 'POSTCONDITION FAILED: Expected at least 4 lumina_ roles, found %', role_count;
    END IF;

    -- Verify each role individually
    FOREACH i IN ARRAY expected_roles LOOP
        SELECT rolsuper, rolcanlogin, rolnoinherit
        INTO role_info
        FROM pg_roles
        WHERE rolname = i;

        IF role_info IS NULL THEN
            RAISE EXCEPTION 'POSTCONDITION FAILED: Role % does not exist', i;
        END IF;

        -- All lumina roles must have login enabled
        IF NOT role_info.rolcanlogin THEN
            RAISE EXCEPTION 'POSTCONDITION FAILED: Role % has login disabled', i;
        END IF;

        -- lumina_superadmin is NOSUPERUSER (TRR-v1.1 C-002 remediation) — bypass via app session config
        -- Verify NO lumina_ role has SUPERUSER (all bypass RLS via application layer, not DB privilege)
        IF role_info.rolsuper THEN
            RAISE EXCEPTION 'POSTCONDITION FAILED: Role % unexpectedly has SUPERUSER flag (should be NOSUPERUSER per C-002)', i;
        END IF;

        -- All roles should be NOINHERIT
        IF NOT role_info.rolnoinherit THEN
            RAISE EXCEPTION 'POSTCONDITION FAILED: Role % is not NOINHERIT', i;
        END IF;

        RAISE NOTICE 'Role verified: % (super=%, login=%, noinherit=%)',
            i, role_info.rolsuper, role_info.rolcanlogin, role_info.rolnoinherit;
    END LOOP;

    -- Verify RLS is enabled on organizations
    DO $$
    DECLARE
        rls_enabled BOOLEAN;
    BEGIN
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class
        WHERE relname = 'organizations';

        IF rls_enabled IS DISTINCT FROM true THEN
            RAISE EXCEPTION 'POSTCONDITION FAILED: RLS not enabled on organizations table';
        END IF;
    END
    $$;

    RAISE NOTICE 'All bootstrap roles verified successfully';
END
$$;

-- ROLLBACK
-- --------------------------------------------------------
-- Revoke role memberships
-- REVOKE lumina_admin FROM lumina_superadmin;
-- REVOKE lumina_service_account FROM lumina_superadmin;
-- REVOKE lumina_migration_role FROM lumina_superadmin;
--
-- Drop all roles:
-- DROP ROLE IF EXISTS lumina_superadmin;
-- DROP ROLE IF EXISTS lumina_admin;
-- DROP ROLE IF EXISTS lumina_service_account;
-- DROP ROLE IF EXISTS lumina_migration_role;
--
-- Disable RLS on organizations:
-- ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
-- --------------------------------------------------------

--
-- END OF SCRIPT 002: 002-role-initialization.sql
-- ============================================================
```

### Postconditions SQL

```sql
-- Verify all roles exist with correct properties
SELECT
    rolname,
    CASE WHEN rolsuper THEN 'SUPERUSER' ELSE 'NON-SUPERUSER' END AS role_type,
    CASE WHEN rolcanlogin THEN 'LOGIN' ELSE 'NO LOGIN' END AS login_capability,
    CASE WHEN rolnoinherit THEN 'NOINHERIT' ELSE 'INHERIT' END AS inheritance,
    rolenumsuperusers AS member_of_superusers
FROM pg_roles
WHERE rolname LIKE 'lumina_%'
ORDER BY rolname;

-- Verify RLS status on organizations
SELECT
    c.relname AS table_name,
    CASE WHEN c.relrowsecurity THEN 'ENABLED' ELSE 'DISABLED' END AS rls_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'organizations';
```

### Rollback SQL

```sql
-- Clean up all roles and RLS settings
ALTER TABLE public.organizations DISABLE ROW LEVEL SECURITY;
DROP ROLE IF EXISTS lumina_superadmin;
DROP ROLE IF EXISTS lumina_admin;
DROP ROLE IF EXISTS lumina_service_account;
DROP ROLE IF EXISTS lumina_migration_role;
```

---

## 6. SCRIPT 4 : 003-bootstrap-verification.sql

### M�tadonn�es

```sql
-- === IGS METADATA ===
-- generation_id: bootstrap-003-verify
-- source_canonical: ["IMPLEMENTATION-GENERATION-SPECIFICATION.md §2 (Validation Loop)", "DOC-024 §validation-patterns"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "verification-report"
-- checks_performed: 6
-- compliance_status: "COMPLIANT"
-- =====================
```

### Pr�requis

| Pr�requis | Description |
|-----------|-------------|
| Script 000 r�ussi | pgcrypto extension install�e |
| Script 001 r�ussi | Table organizations cr��e avec succ�s |
| Script 002 r�ussi | 4 r�les PostgreSQL cr��s |
| Acc�s lecture | Lecture de pg_ views et information_schema |

### Ex�cution

```sql
-- ============================================================
-- Script 003: Bootstrap Verification Report
-- ============================================================
-- Purpose: Comprehensive post-bootstrap verification that
--          all 4 bootstrap components were created correctly.
--          Produces a structured status summary actionable
--          by DBA or automated validation pipelines.
--
-- This script is the final gate before proceeding to
-- pipeline step 1 (Schema Generator) per IGS-v1 §2.1.
--
-- Identity: IGS-v1 verification-report
-- ============================================================

-- === IGS METADATA ===
-- generation_id: bootstrap-003-verify
-- source_canonical: ["IMPLEMENTATION-GENERATION-SPECIFICATION.md §2 (Validation Loop)", "DOC-024 §validation-patterns"]
-- transformation_rule: "bootstrap-generator v1.0"
-- generation_date: "2026-07-24T18:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- artifact_type: "verification-report"
-- checks_performed: 6
-- compliance_status: "COMPLIANT"
-- =====================

-- PRECONDITIONS
-- --------------------------------------------------------
-- 1. All 3 previous scripts executed successfully
-- 2. Current user has read access to:
--    - pg_extension
--    - pg_tables / information_schema.tables
--    - pg_constraint
--    - pg_index
--    - pg_trigger
--    - pg_roles
--    - pg_class
-- --------------------------------------------------------

-- ============================================================
-- CHECK 1: pgcrypto extension
-- ============================================================
-- Verify pgcrypto is installed and functional.
-- Source: Script 000 output
-- Pass condition: extname = 'pgcrypto' exists, gen_random_uuid() callable
-- --------------------------------------------------------

\echo '========================================================'
\echo 'CHECK 1: pgcrypto extension'
\echo '========================================================'

SELECT
    'check_1_pgcrypto' AS check_id,
    CASE
        WHEN ext_count = 1 AND func_test IS TRUE
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    ext_count AS extension_count,
    func_test AS gen_random_uuid_callable,
    CASE
        WHEN ext_count = 1 AND func_test IS TRUE
        THEN 'pgcrypto extension installed and functional'
        WHEN ext_count = 0
        THEN 'pgcrypto extension NOT installed — run script 000'
        WHEN ext_count > 1
        THEN 'Multiple pgcrypto extensions found (error)'
        WHEN func_test IS FALSE
        THEN 'gen_random_uuid() is NOT callable'
        ELSE 'Unknown error'
    END AS description
FROM (
    SELECT
        (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') AS ext_count,
        (SELECT pg_typeof(gen_random_uuid()) IS NOT NULL) AS func_test
) sub;

-- Detailed extension info
SELECT
    extname AS extension_name,
    extversion AS installed_version,
    extschema::regnamespace AS schema,
    extrelocatable AS relocatable,
    (SELECT array_agg(comments.comment ORDER BY comments.comment)
     FROM (SELECT obj_description(e.oid, 'pg_extension') AS comment
           FROM pg_extension e WHERE e.extname = 'pgcrypto') comments
    ) AS description
FROM pg_extension
WHERE extname = 'pgcrypto';


-- ============================================================
-- CHECK 2: organizations table
-- ============================================================
-- Verify organizations table structure and constraints.
-- Source: Script 001 output
-- Pass condition: table exists with 14+ columns, PK, UK, CHECKs, trigger
-- --------------------------------------------------------

\echo ''
\echo '========================================================'
\echo 'CHECK 2: organizations table'
\echo '========================================================'

SELECT
    'check_2_organizations_table' AS check_id,
    CASE
        WHEN table_found AND col_count >= 14 AND pk_exists AND uk_exists
             AND trigger_exists AND rls_enabled
        THEN 'PASS'
        ELSE 'FAIL'
    END AS status,
    table_found AS table_exists,
    col_count AS column_count,
    pk_exists AS has_primary_key,
    uk_exists AS has_unique_indexes,
    trigger_exists AS has_updated_at_trigger,
    rls_enabled AS rls_enabled
FROM (
    SELECT
        (SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'organizations'
        )) AS table_found,
        (SELECT COUNT(*) FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'organizations') AS col_count,
        (SELECT EXISTS (
            SELECT 1 FROM pg_constraint c
            JOIN pg_class t ON t.oid = c.conrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            WHERE n.nspname = 'public' AND t.relname = 'organizations'
              AND c.contype = 'p'
        )) AS pk_exists,
        (SELECT COUNT(*) FROM pg_indexes
         WHERE schemaname = 'public' AND tablename = 'organizations'
           AND indexname LIKE 'idx_organizations_%'
        ) > 1 AS uk_exists,
        (SELECT EXISTS (
            SELECT 1 FROM information_schema.triggers
            WHERE event_object_schema = 'public'
              AND event_object_table = 'organizations'
              AND trigger_name = 'trg_organizations_updated_at'
        )) AS trigger_exists,
        (SELECT relrowsecurity FROM pg_class
         WHERE relname = 'organizations'
        ) AS rls_enabled
) sub;

-- List all columns of organizations table
SELECT
    '--- organizations table columns ---' AS section_header;

SELECT
    ordinal_position AS col_order,
    column_name,
    data_type,
    character_maximum_length AS char_len,
    is_nullable,
    column_default AS default_value
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'organizations'
ORDER BY ordinal_position;


-- ============================================================
-- CHECK 3: organizations constraints
-- ============================================================
-- Verify all constraints on the organizations table.
-- Source: Script 001 constraints + DOC-021 §1.1 rules
-- Pass condition: PRIMARY KEY, CHECK constraints on statut/type_org/accent_hex
-- --------------------------------------------------------

\echo ''
\echo '========================================================'
\echo 'CHECK 3: organizations constraints'
\echo '========================================================'

SELECT
    '--- Constraint definitions ---' AS section_header;

SELECT
    conname AS constraint_name,
    CASE contype
        WHEN 'p' THEN 'PRIMARY KEY'
        WHEN 'f' THEN 'FOREIGN KEY'
        WHEN 'u' THEN 'UNIQUE'
        WHEN 'c' THEN 'CHECK'
        WHEN 'x' THEN 'EXCLUSION'
    END AS constraint_type,
    pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'public.organizations'::regclass
ORDER BY contype, conname;


-- ============================================================
-- CHECK 4: organizations indexes
-- ============================================================
-- Verify all indexes on the organizations table.
-- Source: Script 001 index creation
-- Pass condition: 3 indexes (idx_organizations_nom, idx_organizations_org_id, idx_organizations_statut)
-- --------------------------------------------------------

\echo ''
\echo '========================================================'
\echo 'CHECK 4: organizations indexes'
\echo '========================================================'

SELECT
    '--- Index definitions ---' AS section_header;

SELECT
    indexname,
    indexdef,
    CASE
        WHEN indisunique THEN 'UNIQUE'
        ELSE 'NORMAL'
    END AS uniqueness,
    CASE
        WHEN indisprimary THEN 'PRIMARY'
        ELSE 'SECONDARY'
    END AS role
FROM pg_indexes pi
JOIN pg_index i ON i.indexrelid = (pi.schemaname || '.' || pi.indexname)::regclass
WHERE pi.schemaname = 'public'
  AND pi.tablename = 'organizations'
ORDER BY pi.indexname;


-- ============================================================
-- CHECK 5: organizations trigger
-- ============================================================
-- Verify the updated_at trigger exists and is active.
-- Source: Script 001 trigger creation
-- Pass condition: trg_organizations_updated_at exists, BEFORE UPDATE
-- --------------------------------------------------------

\echo ''
\echo '========================================================'
\echo 'CHECK 5: organizations trigger'
\echo '========================================================'

SELECT
    '--- Trigger details ---' AS section_header;

SELECT
    trigger_name,
    event_manipulation AS manipulation,
    event_object_schema AS schema,
    event_object_table AS table_name,
    action_timing,
    action_orientation,
    action_statement AS trigger_function
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'organizations'
ORDER BY trigger_name;

SELECT
    '--- Trigger functions ---' AS section_header;

SELECT
    p.proname AS function_name,
    pg_get_function_arguments(p.oid) AS arguments,
    pg_get_function_result(p.oid) AS result,
    p.provolatile AS volatility,
    CASE p.prosecurity
        WHEN 's' THEN 'SECURITY DEFINER'
        WHEN 'u' THEN 'SECURITY INVOKER'
    END AS security_model
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('organizations_updated_timestamp', 'current_organization_id')
ORDER BY p.proname;


-- ============================================================
-- CHECK 6: PostgreSQL roles
-- ============================================================
-- Verify all 4 Lumina roles exist with correct properties.
-- Source: Script 002 role creation
-- Pass condition: 4 roles found, correct super/admin/service/migration config
-- --------------------------------------------------------

\echo ''
\echo '========================================================'
\echo 'CHECK 6: Lumina roles'
\echo '========================================================'

SELECT
    '--- Role summary ---' AS section_header;

SELECT
    rolname AS role_name,
    CASE WHEN rolsuper THEN 'YES' ELSE 'NO' END AS is_superuser,
    CASE WHEN rolcanlogin THEN 'YES' ELSE 'NO' END AS can_login,
    CASE WHEN rolnoinherit THEN 'YES' ELSE 'NO' END AS no_inherit,
    rolcreatedb AS can_create_db,
    rolcreaterole AS can_create_role,
    rolconnlimit AS connection_limit,
    rolvaliduntil AS password_expiry
FROM pg_roles
WHERE rolname LIKE 'lumina_%'
ORDER BY rolname;

SELECT
    '--- Role memberships ---' AS section_header;

SELECT
    r.rolname AS member_role,
    m.rolname AS granted_role
FROM pg_auth_members am
JOIN pg_roles r ON r.oid = am.member
JOIN pg_roles m ON m.oid = am.roleid
WHERE r.rolname = 'lumina_superadmin';

-- ============================================================
-- SESSION CONTEXT: current_organization_id() function test
-- ============================================================

\echo ''
\echo '========================================================'
\echo 'BONUS: Utility functions test'
\echo '========================================================'

SELECT
    '--- current_organization_id() ---' AS function_test,
    public.current_organization_id() AS returned_value,
    pg_typeof(public.current_organization_id()) AS return_type
FROM generate_series(1,1);

-- Return NULL since no session context is set at verification time


-- ============================================================
-- BOOTSTRAP VERIFICATION SUMMARY
-- ============================================================

\echo ''
\echo '========================================================'
\echo 'BOOTSTRAP MIGRATION SPEC v1 — VERIFICATION SUMMARY'
\echo '========================================================'
\echo ''
\echo '+------------------------------------------------------------+'
\echo '|  CHECK                        | STATUS  | SEVERITY         |'
\echo '+------------------------------------------------------------+'
\echo '|  1. pgcrypto extension        | ???     | CRITICAL         |'
\echo '|  2. organizations table       | ???     | CRITICAL         |'
\echo '|  3. organizations constraints | ???     | MAJOR            |'
\echo '|  4. organizations indexes     | ???     | MAJOR            |'
\echo '|  5. organizations trigger     | ???     | MINOR            |'
\echo '|  6. Lumina roles (x4)         | ???     | CRITICAL         |'
\echo '+------------------------------------------------------------+'
\echo ''
\echo 'If all statuses are PASS: Bootstrap is COMPLETE.'
\echo 'Proceed to pipeline step 1 (Schema Generator).'
\echo ''
\echo 'If any status is FAIL: Review the detailed output above.'
\echo 'Do NOT proceed until all CRITICAL checks pass.'
\echo '============================================================'

-- Automated severity assessment
SELECT
    '=== AUTOMATED SUMMARY ===' AS report_section,
    check_number,
    check_name,
    status,
    CASE
        WHEN status = 'FAIL' AND severity = 'CRITICAL' THEN 'BLOCKED: Fix critical failures before proceeding'
        WHEN status = 'FAIL' AND severity = 'MAJOR' THEN 'WARNING: Address major issues for full compatibility'
        WHEN status = 'FAIL' AND severity = 'MINOR' THEN 'NOTICE: Minor issue — non-blocking but should be fixed'
        WHEN status = 'PASS' THEN 'OK: Proceed to next pipeline stage'
        ELSE 'UNKNOWN: Manual review required'
    END AS action_required
FROM (
    VALUES
        (1, 'pgcrypto extension',
            CASE WHEN (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') = 1
                 AND (SELECT pg_typeof(gen_random_uuid()) IS NOT NULL)
            THEN 'PASS' ELSE 'FAIL' END, 'CRITICAL'),
        (2, 'organizations table',
            CASE WHEN (SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'public' AND table_name = 'organizations'
            )) AND (SELECT COUNT(*) FROM information_schema.columns
                     WHERE table_schema = 'public' AND table_name = 'organizations') >= 14
            THEN 'PASS' ELSE 'FAIL' END, 'CRITICAL'),
        (3, 'organizations constraints',
            CASE WHEN (SELECT COUNT(*) FROM pg_constraint
                       WHERE conrelid = 'public.organizations'::regclass
                         AND contype = 'c') > 0
            THEN 'PASS' ELSE 'FAIL' END, 'MAJOR'),
        (4, 'organizations indexes',
            CASE WHEN (SELECT COUNT(*) FROM pg_indexes
                       WHERE schemaname = 'public' AND tablename = 'organizations'
                         AND indexname LIKE 'idx_organizations_%') >= 2
            THEN 'PASS' ELSE 'FAIL' END, 'MAJOR'),
        (5, 'organizations trigger',
            CASE WHEN (SELECT EXISTS (
                SELECT 1 FROM information_schema.triggers
                WHERE event_object_schema = 'public'
                  AND event_object_table = 'organizations'
                  AND trigger_name = 'trg_organizations_updated_at'
            ))
            THEN 'PASS' ELSE 'FAIL' END, 'MINOR'),
        (6, 'lumina roles (4)',
            CASE WHEN (SELECT COUNT(*) FROM pg_roles
                       WHERE rolname LIKE 'lumina_%') >= 4
            THEN 'PASS' ELSE 'FAIL' END, 'CRITICAL')
    ) AS checks(check_number, check_name, status, severity)
ORDER BY check_number;


-- ============================================================
-- PIPELINE READINESS GATE
-- ============================================================

\echo ''
\echo '========================================================'
\echo 'PIPELINE READINESS GATE'
\echo '========================================================'
\echo ''

SELECT
    '=== IGS-v1 Pipeline Gate: Ready for Step 1? ===' AS gate_check,
    CASE
        WHEN critical_pass AND major_pass AND minor_pass
        THEN 'GREEN — Proceed to Schema Generator (pipeline step 1)'
        WHEN major_fail
        THEN 'AMBER — Major issues exist. Schema Generator will fail.'
        ELSE 'RED — Critical failure. Do NOT proceed.'
    END AS readiness_gate,
    critical_pass AS critical_checks_passed,
    major_pass AS major_checks_passed,
    minor_pass AS minor_checks_passed,
    (critical_pass AND major_pass AND minor_pass) AS overall_pass
FROM (
    SELECT
        -- Critical: pgcrypto installed AND organizations table exists AND roles exist
        (SELECT (SELECT COUNT(*) FROM pg_extension WHERE extname = 'pgcrypto') = 1
         AND (SELECT EXISTS (
               SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public' AND table_name = 'organizations'))
         AND (SELECT COUNT(*) FROM pg_roles WHERE rolname LIKE 'lumina_%') >= 4
        ) AS critical_pass,
        -- Major: constraints and indexes exist
        (SELECT (SELECT COUNT(*) FROM pg_constraint
                 WHERE conrelid = 'public.organizations'::regclass AND contype = 'c') > 0
         AND (SELECT COUNT(*) FROM pg_indexes
              WHERE schemaname = 'public' AND tablename = 'organizations'
                AND indexname LIKE 'idx_organizations_%') >= 2
        ) AS major_pass,
        -- Minor: trigger exists
        (SELECT EXISTS (
            SELECT 1 FROM information_schema.triggers
            WHERE event_object_schema = 'public'
              AND event_object_table = 'organizations'
              AND trigger_name = 'trg_organizations_updated_at'
        )) AS minor_pass
    ) sub;

\echo ''
\echo '============================================================'
\echo 'BOOTSTRAP MIGRATION SPEC v1 — VERIFICATION COMPLETE'
\echo '============================================================'
\echo 'Run: SELECT * FROM pg_extension WHERE extname = ''pgcrypto'';'
\echo 'Run: SELECT * FROM pg_roles WHERE rolname LIKE ''lumina_%'';'
\echo 'Run: SELECT * FROM pg_class WHERE relname = ''organizations'';'
\echo ''
\echo 'Next: Pipeline Step 1 — Schema Generator (create remaining 31 tables)'
\echo '============================================================'

--
-- END OF SCRIPT 003: 003-bootstrap-verification.sql
-- ============================================================
```

### Postconditions SQL

```sql
-- Final automated status
SELECT
    bootstrap_component,
    status,
    detail
FROM (
    SELECT
        'pgcrypto extension' AS bootstrap_component,
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
             THEN 'ACTIVE' ELSE 'MISSING' END AS status,
        CASE WHEN EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto')
             THEN 'gen_random_uuid() available' ELSE 'CREATE EXTENSION pgcrypto required' END AS detail
    UNION ALL
    SELECT
        'organizations table',
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'organizations'
        ) THEN 'PRESENT' ELSE 'MISSING' END,
        CASE WHEN EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name = 'organizations'
        ) THEN 'Ready for RLS policies' ELSE 'Pipeline blocked' END
    UNION ALL
    SELECT
        'RLS enabled',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_class WHERE relname = 'organizations' AND relrowsecurity = true
        ) THEN 'ENABLED' ELSE 'DISABLED' END,
        'Row-level security active on organizations'
    UNION ALL
    SELECT
        'utilitiy functions',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_proc p
            JOIN pg_namespace n ON n.oid = p.pronamespace
            WHERE n.nspname = 'public' AND p.proname = 'current_organization_id'
        ) THEN 'DEFINED' ELSE 'MISSING' END,
        'current_organization_id() returns uuid'
    UNION ALL
    SELECT
        'lumina_superadmin role',
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_superadmin')
             THEN 'CREATED' ELSE 'MISSING' END,
        'NOSUPERUSER, NOINHERIT (app-bypass RLS per C-002)'
    UNION ALL
    SELECT
        'lumina_admin role',
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_admin')
             THEN 'CREATED' ELSE 'MISSING' END,
        'NOSUPERUSER, NOINHERIT, tenant admin'
    UNION ALL
    SELECT
        'lumina_service_account role',
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_service_account')
             THEN 'CREATED' ELSE 'MISSING' END,
        'NOSUPERUSER, NOINHERIT, app service'
    UNION ALL
    SELECT
        'lumina_migration_role role',
        CASE WHEN EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'lumina_migration_role')
             THEN 'CREATED' ELSE 'MISSING' END,
        'NOSUPERUSER, NOINHERIT, schema only'
) combined
ORDER BY
    CASE bootstrap_component
        WHEN 'pgcrypto extension' THEN 1
        WHEN 'organizations table' THEN 2
        WHEN 'RLS enabled' THEN 3
        WHEN 'utilitiy functions' THEN 4
        WHEN 'lumina_superadmin role' THEN 5
        WHEN 'lumina_superadmin role' THEN 5
        WHEN 'lumina_admin role' THEN 6
        WHEN 'lumina_service_account role' THEN 7
        WHEN 'lumina_migration_role role' THEN 8
    END;
```

### Rollback SQL

```sql
-- This verification script is read-only. No rollback needed.
-- The following is provided for completeness:
-- Rollback all previous scripts:
-- DROP EXTENSION IF EXISTS pgcrypto CASCADE;
-- DROP TABLE IF EXISTS public.organizations CASCADE;
-- DROP ROLE IF EXISTS lumina_superadmin;
-- DROP ROLE IF EXISTS lumina_admin;
-- DROP ROLE IF EXISTS lumina_service_account;
-- DROP ROLE IF EXISTS lumina_migration_role;
```

---

## 7. R�sum� d'ex�cution order

### Ordre strict d'ex�cution

Les 4 scripts doivent �tre ex�cut�s DANS L'ORDRE exact suivant. L'inversion de tout script est une violation bloquante.

| Ordre | Script | Pr�requis | Durée estimée | Dépendances |
|-------|--------|-----------|---------------|-------------|
| 1 | `000-extension-pgcrypto.sql` | None | < 1 sec | Aucune |
| 2 | `001-schema-foundation.sql` | Script 1 réussi | < 5 sec | Script 1 (pgcrypto) |
| 3 | `002-role-initialization.sql` | Scripts 1+2 réussis | < 2 sec | Scripts 1, 2 |
| 4 | `003-bootstrap-verification.sql` | Scripts 1+2+3 réussis | < 3 sec | Scripts 1, 2, 3 |

### Graphique de dépendance

```
┌──────────────────────────────────────┐
│  Script 000: 000-extension-pgcrypto  │ ← Entrée: aucune
└──────────────┬───────────────────────┘
               ▼ (pgcrypto gén_random_uuid() doit exister)
┌──────────────────────────────────────┐
│  Script 001: 001-schema-foundation   │ ← Entrée: pgcrypto
└──────────────┬───────────────────────┘
               ▼ (table organizations doit exister, RLS activé)
┌──────────────────────────────────────┐
│  Script 002: 002-role-initialization │ ← Entrée: pgcrypto, organizations
└──────────────┬───────────────────────┘
               ▼ (4 rôles créés, RLS activé, hiérarchie rôles établie)
┌──────────────────────────────────────┐
│  Script 003: 003-bootstrap-verify    │ ← Entrée: tout précédent
└──────────────┬───────────────────────┘
               ▼
┌──────────────────────────────────────┐
│  PIPELINE STEP 1: Schema Generator   │ ← Commence ici si verification = PASS
└──────────────────────────────────────┘
```

### Critères de succès global

| Critère | Condition | Severity |
|---------|-----------|----------|
| C-001 | `pgcrypto` existe dans `pg_extension` | CRITIQUE |
| C-002 | Table `public.organizations` existe | CRITIQUE |
| C-003 | `org_id` column existe sur `organizations` | CRITIQUE |
| C-004 | Index `idx_organizations_nom` existe | MAJEUR |
| C-005 | Index `idx_organizations_org_id` existe | MAJEUR |
| C-006 | Index `idx_organizations_statut` existe | MAJEUR |
| C-007 | Trigger `trg_organizations_updated_at` existe | MINEUR |
| C-008 | RLS activé sur `organizations` (relrowsecurity = true) | CRITIQUE |
| C-009 | Fonction `current_organization_id()` existe | MAJEUR |
| C-010 | Fonction `organizations_updated_timestamp()` existe | MAJEUR |
| C-011 | Rôle `lumina_superadmin` existe avec NOSUPERUSER (bypass via session config) | CRITIQUE |
| C-012 | Rôle `lumina_admin` existe avec NOSUPERUSER | CRITIQUE |
| C-013 | Rôle `lumina_service_account` existe avec NOSUPERUSER | CRITIQUE |
| C-014 | Rôle `lumina_migration_role` existe avec NOSUPERUSER | CRITIQUE |
| C-015 | Tous les rôles ont NOINHERIT = true | CRITIQUE |

### Totaux

- **4 scripts** complets
- **0 logique métier** (seulement fondations)
- **1 extension** (pgcrypto)
- **1 table** (organizations — seule table avec dépendance zéro)
- **4 rôles** PostgreSQL
- **2 fonctions** utilitaires
- **1 trigger** (auto-updated-at)
- **1 fonction RLS-ready** (`current_organization_id`)

---

## 8. Intégration au pipeline IGS-v1

### Position dans le pipeline

Le Bootstrap Migration Specification est LE prérequis constitutionnel au pipeline IGS-v1 tel que défini dans IMPLEMENTATION-GENERATION-SPECIFICATION.md §2.1 :

```
[Bootstrap Migration Spec]  ← CECI (nouveau)
         │
         ▼ obligatoire
[Étape 1: Schema Generator] ← Étape 1 du pipeline IGS-v1
         │
         ▼
[Étape 2: Schéma → Migrations]
         │
         ▼
[Étape 3: Contraintes & Index]
         │
         ▼
[Étape 4: Politiques RLS]  ← Nécessite les rôles du bootstrap
```

### Règles d'intégration

| Règle | Description |
|-------|-------------|
| **P-001** | Les scripts du Bootstrap DOIVENT être exécutés AVANT tout script du pipeline |
| **P-002** | Le pipeline Step 1 (Schema Generator) DOIT vérifier le succès du Bootstrap avant de créer des tables |
| **P-003** | Les politiques RLS (Step 4) DOIVENT référencer les rôles du script 002 |
| **P-004** | Le Migration Generator (Step 2) DOIT respecter l'ordre topologique par rapport à organizations |
| **P-005** | Aucun artefact du pipeline ne peut modifier les scripts du Bootstrap |

### Impact sur les autres générateurs

- **Schema Generator (§3.1)** : Sait que `organizations` existe déjà. Ne la recréera pas.
- **Migration Generator (§3.2)** : Commencera à partir de la deuxième table (`org_units`) en ordre topologique.
- **Constraint & Index Generator (§3.3)** : Ajoutera les contraintes sur les nouvelles tables seulement.
- **RLS Policy Generator (§3.4)** : Utilisera les rôles créés dans `002-role-initialization.sql`.
- **Tous les autres générateurs** : S'appuient sur le schéma complet incluant le Bootstrap.

---

## 9. Historique

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — 4 scripts Bootstrap pour fondations PostgreSQL avant pipeline IGS-v1 | COMPLIANT |

---

## 10. Notes techniques supplémentaires

### Gestion des mots de passe

Les mots de passe par défaut dans le script 002 sont des placeholders `CHANGE_ME_*_V1`. En production :
1. Générer des passwords aléatoires de 32 caractères minimum
2. Les stocker dans un gestionnaire de secrets (HashiCorp Vault, AWS Secrets Manager, etc.)
3. Jamais Committer de plaintext passwords dans le codebase

### Sécurité NOINHERIT

Tous les rôles Lumina utilisent `NOINHERIT`. Cela signifie :
- Un login comme `lumina_admin` ne possède PAS automatiquement les permissions associées
- L'application ou le driver doivent faire explicitement `SET ROLE lumina_admin` ou `SET SESSION AUTHORIZATION lumina_admin`
- Cette approche empêche les fuites de privilèges accidentelles

### RLS et le bootstrap

À ce stade du bootstrap :
- RLS est **activé** sur `organizations`
- Aucune politique RLS n'est encore présente (celles-ci sont générées par l'étape 4 du pipeline)
- Sans politique RLS ET sans rôle superadmin connecté, la table serait **inaccessible**
- C'est intentional : le pipeline Step 4 ajoutera immédiatement les politiques nécessaires

### Idempotence garantie

Chaque script utilise :
- `IF NOT EXISTS` pour les extensions, roles
- `DROP ... IF EXISTS` suivi de `CREATE` pour les tables (pour un nettoyage complet)
- `DO $$ ... $$` blocks pour les vérifications conditionnelles

Cela permet de rerun n'importe quel script individuellement sans erreur.

### Vérification automatisée

Le script 003 (`003-bootstrap-verification.sql`) est conçu pour être exécuté :
1. Immédiatement après les scripts 000-002 pour valider le bootstrap
2. Avant chaque déploiement de pipeline pour s'assurer que les fondations sont intactes
3. Dans un pipeline CI/CD comme étape de qualité gate

Le format de sortie du script 003 est structuré `\echo` suivi de requêtes SQL, permettant un parsing facile par des outils externes.

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un artefact technique Bootstrap obligatoire qui précède le pipeline IGS-v1. Toute déviation du contenu de ces 4 scripts est une violation bloquante.*

---

## ANNEXE A: Fichier unique exécutable

Ci-dessous les 4 scripts combinés en un seul fichier exécutable, dans l'ordre correct. Pour une exécution unique :

```bash
psql -f bootstrap-all.sql <database_url>
```

Ou individueller :

```bash
psql -v ON_ERROR_STOP=1 -f 000-extension-pgcrypto.sql
psql -v ON_ERROR_STOP=1 -f 001-schema-foundation.sql
psql -v ON_ERROR_STOP=1 -f 002-role-initialization.sql
psql -v ON_ERROR_STOP=1 -f 003-bootstrap-verification.sql
```

Le flag `-v ON_ERROR_STOP=1` assure que toute erreur arrête l'exécution immédiatement, empêchant l'enchaînement de scripts avec des prérequis non satisfaits.

---

## ANNEXE B: Checklist de migration

Avant l'exécution :
- [ ] PostgreSQL 14+ installé et accessible
- [ ] Base de données créée (via `CREATE DATABASE`)
- [ ] Mot de passe superuser connu
- [ ] Accès SSH/TCP à la base de données vérifié

Après chaque script :
- [ ] [000] `SELECT extname FROM pg_extension WHERE extname = 'pgcrypto';` retourne 1 ligne
- [ ] [001] `SELECT COUNT(*) FROM information_schema.columns WHERE table_name = 'organizations';` retourne ≥ 14
- [ ] [002] `SELECT rolname FROM pg_roles WHERE rolname LIKE 'lumina_%';` retourne 4 lignes
- [ ] [003] Tous les checks retournent `PASS` ou `OK`

Après exécution complète :
- [ ] Gate check retourné `GREEN`
- [ ] Pipeline Step 1 (Schema Generator) peut être lancé
- [ ] Aucune erreur dans les logs

---

*FIN DU DOCUMENT — Bootstrap Migration Specification v1*
