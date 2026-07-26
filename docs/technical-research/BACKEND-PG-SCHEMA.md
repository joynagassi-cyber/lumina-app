# Schéma PostgreSQL Complet — Lumina v2

**Doc ID:** DOC-BACKEND-PG-SCHEMA  
**Version:** 2.0  
**Statut:** SPÉCIFICATION COMPLÈTE  
**Dépendances:** ADR-006, ADR-010, ADR-014, ADR-017-financial-consolidation, BACKEND-COMPREHENSIVE

---

## 1. Règles Générales

| Règle | Détail |
|---|---|
| **DB-R01** | Toutes les tables ont `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| **DB-R02** | Toutes les tables de données ont `org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE` |
| **DB-R03** | Tous les amounts en BIGINT (fractions/cents) |
| **DB-R04** | Timestamps UTC: `TIMESTAMPTZ DEFAULT NOW()` |
| **DB-R05** | Profondeur hiérarchie ≤ 5 (CHECK constraint) |
| **DB-R06** | Enums PostgreSQL pour valeurs fixes |
| **DB-R07** | RLS activé sur TOUTES les tables avec `org_id` |

---

## 2. Migrations Séquentielles

### Migration 00 — Capabilities Foundation

```sql
-- =============================================
-- Migration 00: Organizations, Users, Sessions
-- =============================================

CREATE TYPE organization_type AS ENUM ('church', 'school', 'ngo', 'company', 'custom');
CREATE TYPE user_role AS ENUM ('superadmin', 'admin', 'treasurer', 'pastor', 'staff');

CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type organization_type NOT NULL,
    settings JSONB DEFAULT '{}',           -- currency, fiscal_year, timezone, branding
    manifest_json JSONB DEFAULT '{}',       -- manifest compilé runtime
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'staff',
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_org_email UNIQUE(org_id, email)
);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    refresh_token TEXT NOT NULL,              -- jamais en clair (chiffré par edge function)
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexs:**
```sql
CREATE INDEX idx_organizations_status ON organizations(status);
CREATE INDEX idx_users_org ON users(org_id);
CREATE INDEX idx_user_sessions_user ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_org ON user_sessions(org_id);
```

### Migration 01 — Finance

```sql
-- =============================================
-- Migration 01: Transactions, Categories
-- =============================================

CREATE TYPE transaction_scope_type AS ENUM ('org', 'group');
CREATE TYPE transaction_status AS ENUM ('draft', 'pending', 'approved', 'rejected');

CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    name_fr TEXT,
    category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'asset', 'liability', 'equity')),
    color TEXT CHECK (color ~ '^#[0-9a-fA-F]{6}$'),
    is_immutable BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'CDF',
    category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    description TEXT,
    receipt_path TEXT,
    transaction_date DATE NOT NULL CHECK (transaction_date <= CURRENT_DATE),
    status transaction_status NOT NULL DEFAULT 'draft',
    scope_type transaction_scope_type NOT NULL DEFAULT 'org',
    scope_target UUID REFERENCES org_units(id) ON DELETE SET NULL,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    approved_at TIMESTAMPTZ,
    compensates_for UUID REFERENCES transactions(id),  -- INV-001: correction compensatoire
    version INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexs:**
```sql
CREATE INDEX idx_categories_org ON categories(org_id);
CREATE INDEX idx_categories_parent ON categories(parent_category_id);
CREATE INDEX idx_categories_type ON categories(category_type);
CREATE INDEX idx_categories_composite ON categories(org_id, category_type);

CREATE INDEX idx_transactions_org ON transactions(org_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_scope ON transactions(org_id, scope_type, scope_target, transaction_date, status);
CREATE INDEX idx_transactions_compensates ON transactions(compensates_for);
```

### Migration 02 — Membres

```sql
-- =============================================
-- Migration 02: Members
-- =============================================

CREATE TYPE member_status AS ENUM ('active', 'inactive', 'deceased', 'transferred');
CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE,                       -- unique par org (checked via constraint composite)
    phone TEXT,
    date_of_birth DATE,
    gender gender_enum,
    photo_url TEXT,
    status member_status NOT NULL DEFAULT 'active',
    joined_at DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT uk_org_email_members UNIQUE(org_id, email)
);

CREATE INDEX idx_members_org ON members(org_id);
CREATE INDEX idx_members_status ON members(status);
CREATE INDEX idx_members_last_name ON members(last_name);
```

### Migration 03 — Organisation Graph & Groups

```sql
-- =============================================
-- Migration 03: Org Units, Group Memberships
-- =============================================

CREATE TYPE unit_type AS ENUM ('department', 'ministry', 'committee', 'sub_group');
CREATE TYPE org_unit_status AS ENUM ('active', 'archived');

CREATE TABLE org_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_unit_id UUID REFERENCES org_units(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    unit_type unit_type NOT NULL DEFAULT 'department',
    description TEXT,
    has_financial_scope BOOLEAN NOT NULL DEFAULT false,
    financial_scope_id TEXT,                -- clé dans manifest pour resolution dynamique
    depth_level INTEGER NOT NULL DEFAULT 0, -- calculé par trigger pour perf
    status org_unit_status NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE group_memberships (
    group_id UUID NOT NULL REFERENCES org_units(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    joined_at DATE NOT NULL DEFAULT CURRENT_DATE,
    PRIMARY KEY (group_id, member_id)
);
```

**Trigger détection cycles + profondeur max 5:**
```sql
CREATE OR REPLACE FUNCTION check_org_unit_depth()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.depth_level >= 5 THEN
        RAISE EXCEPTION 'Max depth 5 reached for org_unit hierarchy';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_depth BEFORE INSERT OR UPDATE OF parent_unit_id
ON org_units FOR EACH ROW EXECUTE FUNCTION check_org_unit_depth();
```

**Indexs:**
```sql
CREATE INDEX idx_org_units_org ON org_units(org_id);
CREATE INDEX idx_org_units_parent ON org_units(org_id, parent_unit_id);
CREATE INDEX idx_org_units_type ON org_units(org_id, unit_type);
CREATE INDEX idx_org_units_has_finance ON org_units(org_id, has_financial_scope);
CREATE INDEX idx_org_units_status ON org_units(status);
CREATE INDEX idx_group_memberships_group ON group_memberships(group_id);
CREATE INDEX idx_group_memberships_member ON group_memberships(member_id);
```

### Migration 04 — Archive (Capacité Lifecycle)

```sql
-- =============================================
-- Migration 04: Archive Entries (Cycle de vie générique)
-- =============================================

CREATE TYPE lifecycle_state AS ENUM ('draft', 'active', 'archived', 'trashed', 'purged');
CREATE TYPE archive_type AS ENUM ('baptism', 'teaching', 'program', 'event', 'document', 'custom');

CREATE TABLE archive_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    archived_by UUID REFERENCES users(id) ON DELETE SET NULL,
    linked_member_id UUID REFERENCES members(id) ON DELETE SET NULL,
    resource_type TEXT NOT NULL,            -- type depuis manifest lifecycle.types[]
    resource_id TEXT NOT NULL,              -- ID de la ressource originale
    metadata JSONB NOT NULL DEFAULT '{}',   -- données spécifiques au type d'archive
    tags TEXT[],                            -- recherche par tags (PostgreSQL array)
    category TEXT,                          -- catégorie configurable
    attachment_urls TEXT[],                 -- URLs des pièces jointes (S3/stockage local)
    state lifecycle_state NOT NULL DEFAULT 'active',
    archived_at TIMESTAMPTZ,
    trash_date TIMESTAMPTZ,                 -- date de suppression temporaire
    purge_date TIMESTAMPTZ,                 -- date de purge programmée
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);
```

**Indexs:**
```sql
CREATE INDEX idx_archive_entries_org ON archive_entries(org_id);
CREATE INDEX idx_archive_entries_state ON archive_entries(state);
CREATE INDEX idx_archive_entries_resource ON archive_entries(resource_type, resource_id);
CREATE INDEX idx_archive_entries_linked_member ON archive_entries(linked_member_id);
CREATE INDEX idx_archive_entries_tags ON archive_entries USING GIN(tags);
CREATE INDEX idx_archive_entries_metadata ON archive_entries USING GIN(metadata);
CREATE INDEX idx_archive_entries_archived_at ON archive_entries(archived_at);
CREATE INDEX idx_archive_entries_purge ON archive_entries(org_id, purge_date) WHERE purge_date IS NOT NULL AND state = 'trashed';

-- Recherche plein texte sur metadata
ALTER TABLE archive_entries ADD COLUMN searchable_text TSVECTOR;

CREATE INDEX idx_archive_search ON archive_entries USING GIN(searchable_text);

CREATE OR REPLACE FUNCTION archive_searchable_trigger()
RETURNS TRIGGER AS $$
BEGIN
    NEW.searchable_text :=
        to_tsvector('french', COALESCE(NEW.metadata->>'title', '')) ||
        to_tsvector('french', COALESCE(NEW.metadata->>'description', '')) ||
        to_tsvector('french', COALESCE(NEW.category, ''));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_archive_searchable BEFORE INSERT OR UPDATE
ON archive_entries FOR EACH ROW EXECUTE FUNCTION archive_searchable_trigger();
```

### Migration 05 — Events

```sql
-- =============================================
-- Migration 05: Events & Templates
-- =============================================

CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE event_recurrence AS ENUM ('none', 'daily', 'weekly', 'monthly', 'yearly');

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    title_fr TEXT NOT NULL,
    description TEXT,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ,
    location TEXT,
    recurrence event_recurrence NOT NULL DEFAULT 'none',
    recurrence_rule TEXT,                  -- iCal RRULE format
    status event_status NOT NULL DEFAULT 'draft',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    version INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE event_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_fr TEXT NOT NULL,
    title_template TEXT NOT NULL,
    title_template_fr TEXT NOT NULL,
    description_template TEXT,
    start_hour TIME,                       -- heure de début récurrente
    duration_minutes INTEGER,              -- durée standard
    recurrence event_recurrence NOT NULL DEFAULT 'none',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexs:**
```sql
CREATE INDEX idx_events_org ON events(org_id);
CREATE INDEX idx_events_start ON events(start_time);
CREATE INDEX idx_events_status ON events(status);
CREATE INDEX idx_events_org_start ON events(org_id, start_time);
CREATE INDEX idx_event_templates_org ON event_templates(org_id);
```

### Migration 06 — Notifications & Settings

```sql
-- =============================================
-- Migration 06: Notifications, Preferences, Audit
-- =============================================

CREATE TYPE notification_channel AS ENUM ('in_app', 'push', 'email', 'sms');
CREATE TYPE notification_severity AS ENUM ('info', 'warning', 'critical');

CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    severity notification_severity NOT NULL DEFAULT 'info',
    channel notification_channel NOT NULL DEFAULT 'in_app',
    data_json JSONB DEFAULT '{}',          -- payload lié (ex: transaction_id)
    read_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_org ON notifications(org_id);
CREATE INDEX idx_notifications_unread ON notifications(org_id, user_id) WHERE read_at IS NULL;

-- Settings par organisation
CREATE TABLE org_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    setting_key TEXT NOT NULL,
    setting_value JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_org_setting UNIQUE(org_id, setting_key)
);

CREATE INDEX idx_org_settings_org ON org_settings(org_id);

-- Notification preferences utilisateur
CREATE TABLE notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    channels notification_channel[] NOT NULL DEFAULT '{in_app}',
    severity_min notification_severity NOT NULL DEFAULT 'info',
    rate_limit_h INTEGER NOT NULL DEFAULT 24, -- max notifications/24h
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uk_user_preference UNIQUE(user_id, org_id)
);

-- Audit Log — immuable INV-007
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    action TEXT NOT NULL,                  -- 'create', 'update', 'delete', 'approve', 'reject'
    entity_type TEXT NOT NULL,             -- 'transaction', 'member', etc.
    entity_id UUID NOT NULL,
    old_values JSONB,                      -- état avant
    new_values JSONB,                      -- état après
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Contraintes audit immuable:**
```sql
-- Impossible de modifier ou supprimer les logs d'audit
ALTER TABLE audit_logs ADD CONSTRAINT audit_immutable CHECK (true);
REVOKE DELETE, UPDATE ON audit_logs FROM public;

CREATE INDEX idx_audit_logs_org ON audit_logs(org_id);
CREATE INDEX idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_created ON audit_logs(created_at DESC);
```

### Migration 07 — Pending Operations (Sync Offline)

```sql
-- =============================================
-- Migration 07: Sync — Pending Operations
-- =============================================

CREATE TYPE sync_action AS ENUM ('create', 'update', 'delete');
CREATE TYPE sync_status AS ENUM ('pending', 'sent', 'confirmed', 'failed');

CREATE TABLE pending_operations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    resource_type TEXT NOT NULL,            -- 'transaction', 'member', 'event', 'archive'
    resource_id UUID NOT NULL,
    action sync_action NOT NULL,
    payload JSONB NOT NULL,                -- snapshot complet de la ressource
    timestamp_client TIMESTAMPTZ NOT NULL, -- horloge client (UTC)
    sync_status sync_status NOT NULL DEFAULT 'pending',
    error_message TEXT,
    version INTEGER NOT NULL DEFAULT 1,     -- optimistic lock
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pending_org ON pending_operations(org_id);
CREATE INDEX idx_pending_status ON pending_operations(sync_status);
CREATE INDEX idx_pending_resource ON pending_operations(resource_type, resource_id);
CREATE INDEX idx_pending_timestamp ON pending_operations(timestamp_client);

-- Lock pessimiste côté serveur: une opération ne peut être confirmée que si pas de conflict
CREATE OR REPLACE FUNCTION verify_version_and_lock(
    p_org_id UUID, p_resource_type TEXT, p_resource_id UUID, p_version INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
    current_version INTEGER;
BEGIN
    SELECT INTO current_version
        CASE resource_type
            WHEN 'transaction' THEN (SELECT version FROM transactions WHERE id = p_resource_id AND org_id = p_org_id)
            WHEN 'member' THEN (SELECT version FROM members WHERE id = p_resource_id AND org_id = p_org_id)
            WHEN 'event' THEN (SELECT version FROM events WHERE id = p_resource_id AND org_id = p_org_id)
            WHEN 'archive' THEN (SELECT version FROM archive_entries WHERE id = p_resource_id AND org_id = p_org_id)
        END
    FROM pending_operations WHERE org_id = p_org_id LIMIT 1;

    -- Si pas de version serveur existante, lock direct
    IF current_version IS NULL THEN
        RETURN true;
    END IF;

    -- LWW: si timestamp client du pending_operation est plus récent → on remplace
    RETURN (SELECT MAX(timestamp_client) FROM pending_operations
            WHERE resource_type = p_resource_type AND resource_id = p_resource_id AND sync_status != 'confirmed')
         >= (SELECT created_at FROM pending_operations
            WHERE org_id = p_org_id AND resource_type = p_resource_type AND resource_id = p_resource_id
            ORDER BY created_at DESC LIMIT 1);
END;
$$ LANGUAGE plpgsql;
```

---

## 3. Types Additionnels Définis

```sql
-- Types enums supplémentaires utilisés ci-dessus
CREATE TYPE archive_subtype AS ENUM ('ceremony', 'teaching', 'program_record', 'certificate', 'document', 'custom');
CREATE TYPE export_format AS ENUM ('csv', 'pdf', 'json');
CREATE TYPE retention_period AS ENUM ('1_year', '3_years', '7_years', 'permanent');
```

---

## 4. Résumé des Tables

| # | Table | Migration | Purpose |
|---|---|---|---|
| 1 | `organizations` | 00 | Entité multi-tenant |
| 2 | `users` | 00 | Utilisateurs avec rôle |
| 3 | `user_sessions` | 00 | Refresh tokens |
| 4 | `categories` | 01 | Catégories financières hiérarchiques |
| 5 | `transactions` | 01 | Transactions (scope_type/scope_target) |
| 6 | `members` | 02 | Membres avec statut |
| 7 | `org_units` | 03 | Hiérarchie organisationnelle DAG |
| 8 | `group_memberships` | 03 | Multi-appartenance membres→groupes |
| 9 | `events` | 05 | Événements avec récurrence |
| 10 | `event_templates` | 05 | Templates d'événements |
| 11 | `archive_entries` | 04 | Archive générique (JSONB + lifecycle) |
| 12 | `notifications` | 06 | Notifications push/in-app |
| 13 | `notification_preferences` | 06 | Préférences par user/org |
| 14 | `org_settings` | 06 | Paramètres configurables |
| 15 | `audit_logs` | 06 | Audit trail immuable |
| 16 | `pending_operations` | 07 | Queue sync offline |

Total: **16 tables**, 8 migrations.
