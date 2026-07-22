# Backend Implementation Guide — InsForge + PostgreSQL + WatermelonDB Sync

**Doc ID:** DOC-BACKEND-GUIDE  
**Version:** 2.0  
**Statut :** SPÉCIFICATION DE STRUCTURE

---

## 1. Stack Technique Backend (ADR-005)

| Couche | Technologie | Version cible |
|---|---|---|
| Runtime | InsForge Cloud | dernière stable |
| Base de données | PostgreSQL 16 | Via InsForge |
| ORM serveur | PostgREST (via InsForge) | géré par InsForge |
| Auth | JWT (InsForge managed) | HS256 |
| RLS | PostgreSQL Row-Level Security | native |
| Migrations | CLI `insforge db migrations` | timestamped .sql files |
| Functions | Deno/TypeScript edge functions | via `functions deploy` |
| Realtime | InsForge managed | channel-based |
| Storage | S3-compatible via InsForge | bucket-per-feature |

**JAMAIS utiliser :** Supabase SDK côté serveur, Prisma, TypeORM, Mongoose, Express.js standalone.

---

## 2. Structure du Backend

```
insforge-backend/
├── migrations/                    # Schema migrations (timestamped SQL)
│   ├── 00_init_platform.sql      # Tables core (orgs, users, org_members)
│   ├── 01_finance.sql            # Tables finance (transactions, categories, accounts)
│   ├── 02_members.sql            # Tables members (members, departments, families)
│   ├── 03_groups.sql             # Tables groups (groups, group_features, group_members)
│   ├── 04_events.sql             # Tables events (events, event_templates)
│   ├── 05_settings.sql           # Tables config (settings, user_preferences)
│   └── __pending__/              # Migrations en cours de développement
│       └── .gitkeep
│
├── functions/                     # Edge functions
│   ├── _shared/                  # Utils partagés entre functions
│   │   ├── auth.ts               # Token validation helpers
│   │   ├── org-scoping.ts        # org_id injection from JWT
│   │   └── response.ts           # Standardized error/success responses
│   ├── validate-transaction.ts    # Finance approval flow
│   ├── calculate-bilan.ts        # Bilan computation RPC
│   ├── send-notification.ts      # Push/email notifications
│   ├── sync-pending.ts           # Sync acknowledgment webhook
│   └── generate-report.ts        # PDF report generation (future)
│
├── policies/                      # RLS policy reference docs
│   ├── 00-org-isolation.md       # How each table isolates by org_id
│   ├── 01-user-access.md         # User role → permission mapping
│   └── function-access.md        # Which functions need which permissions
│
└── seeds/                         # Reference data
    ├── categories_fr.sql         # Financial categories FR
    ├── categories_en.sql         # Financial categories EN
    └── roles.sql                 # Default RBAC roles
```

---

## 3. Migration Protocol

### 3.1 Order of Operations (TOUJOURS dans cet ordre)

1. **Créer le fichier** : `npx @insforge/cli db migrations new nom_de_la_migration`
2. **Modifier le SQL** dans `migrations/YYYYMMDDHHmmSS_nom.sql`
3. **Tester sur branche** si modification de schema existant ou ajout de tables
4. **Appliquer** : `npx @insforge/cli db migrations up --all`
5. **Vérifier** : `npx @insforge/cli db tables` puis vérifier les nouvelles tables

### 3.2 Règles de Création SQL

Chaque table DOIT avoir :
```sql
CREATE TABLE ma_table (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ... autres colonnes ...,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Toujours** inclure :
- `id` UUID auto-generated
- `org_id` FK vers organizations (cascade delete)
- `created_at` / `updated_at` timestamps UTC
- Index composite pour les requêtes fréquentes (ex: `(org_id, status, date)`)
- CHECK constraints pour les enums (type TEXT NOT NULL CHECK (type IN (...)))

### 3.3 Jamais faire

- Jamais de `BEGIN` / `COMMIT` / `ROLLBACK` dans une migration (gestion automatique par InsForge)
- Jamais de DDL dans une function (séparer migration SQL et function TypeScript)
- Jamais de modification de schéma sans migration nouvelle (jamais de `db query` pour schéma)

---

## 4. RLS Policy Map — Tables Critiques

Cette section est lue AVANT d'écrire toute politique RLS.

### 4.1 organizations

```sql
-- Toute lecture nécessite org_id valide
CREATE POLICY org_select ON organizations FOR SELECT
    USING (auth.uid() IN (SELECT user_id FROM org_members WHERE org_id = organizations.id));

CREATE POLICY org_insert ON organizations FOR INSERT
    WITH CHECK (EXISTS (SELECT 1 FROM superadmins WHERE user_id = auth.uid()));

-- Seuls les superadmins créent des organisations
```

### 4.2 transactions (CRITIQUE — INV-001)

```sql
-- Lecture : tous les membres de l'org peuvent lire
CREATE POLICY tx_read ON transactions FOR SELECT
    USING (org_id = current_setting('app.current_org_id'));

-- Création : draft uniquement
CREATE POLICY tx_create ON transactions FOR INSERT
    WITH CHECK (
        org_id = current_setting('app.current_org_id')
        AND status = 'draft'
    );

-- Update : uniquement creators pour status draft/pending
CREATE POLICY tx_update ON transactions FOR UPDATE
    USING (org_id = current_setting('app.current_org_id'))
    WITH CHECK (
        NEW.status IN ('draft', 'pending')
        AND OLD.status IN ('draft', 'pending')
    );

-- APPROVED = IMMUABLE. Aucune policy n'autorise UPDATE where status='approved'.
-- La seule façon de "corriger" est INSERT une nouvelle transaction avec compensates_for = old_id
```

### 4.3 users & profiles

```sql
-- Les utilisateurs ne voient QUE leur propre profile
CREATE POLICY user_profile_read ON users FOR SELECT
    USING (
        id = auth.uid() 
        OR EXISTS (SELECT 1 FROM org_members WHERE org_id = current_setting('app.current_org_id'))
    );
```

### 4.4 members

```sql
-- Members sont lus par tout membre de l'org mais écrits par admins seulement
CREATE POLICY member_read ON members FOR SELECT
    USING (org_id = current_setting('app.current_org_id'));

CREATE POLICY member_write ON members FOR ALL
    USING (org_id = current_setting('app.current_org_id'))
    WITH CHECK (EXISTS (
        SELECT 1 FROM org_members 
        WHERE user_id = auth.uid() AND org_id = current_setting('app.current_org_id') 
        AND role IN ('superadmin', 'admin', 'manager')
    ));
```

---

## 5. Edge Functions Contract

Chaque function suit ce contrat JSON :

```typescript
// Request body (POST)
{
  action: string;       // what operation to perform
  org_id?: string;      // always injected from JWT, but can be explicit
  payload: object;      // operation-specific data
}

// Success response
{
  success: true,
  data: any,
  meta?: { request_id: string, timestamp: number }
}

// Error response
{
  success: false,
  error: {
    code: string,      // VALIDATION_ERROR, AUTH_ERROR, CONFLICT, etc.
    message: string,
    details?: any      // structured error info for client handling
  }
}
```

### 5.1 Function Dependencies

| Function | Dépend de | Accessible à |
|---|---|---|
| `validate-transaction` | RLS policies, org_members | Role: treasurer, admin, superadmin |
| `calculate-bilan` | transactions table | Role: admin, superadmin, finance-viewer |
| `send-notification` | Realtime channels | Any authenticated user |
| `sync-pending` | pending_operations table | Internal webhook only |
| `generate-report` | transactions, categories, orgs | Admin-only (future) |

---

## 6. Storage Buckets Map

Chaque bucket a des règles RLS spécifiques :

| Bucket | Usage | Access | Policy |
|---|---|---|---|
| `receipts` | Invoice photos/PDF | Org members avec permission finance | Owner upload + org read |
| `profiles` | Profile photos | Self + org admin | Self write + org read |
| `documents` | General attachments | Per feature config | org_members read + creator write |
| `exports` | Generated reports | Creator only | Authenticated user owns |

---

## 7. Sync Contract (Frontend ↔ Backend)

Le frontend (WatermelonDB) sync avec le backend via ces endpoints :

```
POST /api/operations/sync     → Batch send pending operations
GET  /api/operations/sync?since=<timestamp> → Get remote changes since last sync
POST /api/operations/confirm  → Acknowledge server-side acceptance
DELETE /api/operations/<id>   → Remove confirmed operations from local queue
```

La sync est **event-driven** (connectivity change triggers sync) + **periodic** (every 5 minutes when connected).

Voir `02-offline-first/index.md` pour les détails du protocole de sync.
