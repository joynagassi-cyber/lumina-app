# Modèle de Modélisation Backend — Guide Complet Lumina v2

**Doc ID:** DOC-BACKEND-ARCHITECTURE  
**Version:** 2.0  
**Statut:** SPÉCIFICATION COMPLÈTE  
**Dépendances:** BACKEND-PG-SCHEMA, BACKEND-WATERMELON-MODELS, BACKEND-RLS-EDGE-FUNCTIONS

---

## 1. Vue d'Ensemble Architecture Data

```
┌─────────────────────────────────────────────────────────────────────┐
│                     LUMINA DATA ARCHITECTURE                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────────┐       ┌───────────────────┐                  │
│  │   React Native UI  │       │  Manifest Engine   │                  │
│  │                   │       │  (Config Runtime)   │                  │
│  │  - Reactive       │       │  - lifecycle.types[]│                  │
│    Subscriptions     │       │  - financial.rules[]│                  │
│  - Optimistic UX    │       │  - forms[].id        │                  │
│  - Offline First    │       │  - vocab[].ns       │                  │
│  └────────┬──────────┘       └───────────────────┘                  │
│           │                                                         │
│           ▼ WatermelonDB sync()                                      │
│  ┌───────────────────┐                                              │
│  │  SQLite (Local DB) │                                             │
│  │                    │                                              │
│  │  - Transaction     │                                              │
│  │  - Category        │                              Push/ Pull      │
│  │  - Member          │        ───────────────────────────▶          │
│  │  - OrgUnit         │        │                                     │
│  │  - Event           │        │                              ┌────▼─────┐│
│  │  - ArchiveEntry    │        │                              │ InsForge  ││
│  │  - PendingOp       │        │                              │ PostgreSQL││
│  │  - Notification    │        │                              │  (Server) ││
│  │                    │        │                              └────┬─────┘│
│  └────────────────────┘        │        ┌───────────────────────┘      │
│                                │        │                               │
│                                │   ┌────▼──────┐                        │
│                                │   │ Edge      │                        │
│                                │   │ Functions  │                       │
│                                │   │ (7 functions)│                     │
│                                │   │ validate-, │                       │
│                                │   │ calculate- │                       │
│                                │   │ sync-,     │                       │
│                                │   │ archive-,  │                       │
│                                │   │ generate-, │                       │
│                                │   │ authorize   │                      │
│                                │   └────────────┘                        │
│                                │                                        │
│                                │   ┌──────────────┐                      │
│                                │   │ RLS Policies │                      │
│                                │   │ (org_id only)│                      │
│                                │   └──────────────┘                      │
│                                └───────────────────────────────────────┘
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Capacités Platform → Tables

Chaque table sert une **capacité**, pas un métier:

| Capacité | Tables Supportées |
|---|---|
| **Identity** | `users`, `members` |
| **Resource** | `transactions`, `archive_entries`, `events`, `notifications` |
| **Relationship** | `org_units`, `group_memberships` |
| **Vocabulary** | `categories` (plus YAML dans manifest_json) |
| **Forms** | `org_settings` (définitions de formulaires configurables) |
| **Workflow** | `pending_operations` (état de workflow de sync) |
| **Lifecycle** | `archive_entries` (state machine configurable) |
| **Audit** | `audit_logs` |
| **Permission** | `users.role` + `user_sessions` |

---

## 3. Mapping Côté-À-Côté

### 3.1 Naming Convention

```
PostgreSQL (snake_case)     ↔     WatermelonDB (camelCase)
┌────────────────────────────┼─────────────────────────────┐
│ transaction_date           │ date = column('transaction_date')              │
│ parent_category_id         │ parentCategoryId = column('parent_category_id')│
│ financial_scope_id         │ financialScopeId = column('financial_scope_id')│
│ is_immutable               │ isImmutable = column('is_immutable', false)    │
│ attached_urls              │ attachmentUrls = column('attachment_urls', []) │
│ compensates_for            │ compensatesFor = column('compensates_for')     │
└────────────────────────────┴────────────────────────────────────────────────┘
```

**Règle stricte:** Les noms de colonnes PostgreSQL restent identiques entre le schéma local (SQLite) et distant (PostgreSQL). Seule la camelCase des propriétés TS diffère.

### 3.2 Types Mapping

| PostgreSQL Type | WatermelonDB Column | Notes |
|---|---|---|
| UUID | `prop()` | PK auto-generated |
| BIGINT | `column('name')` | Amount in cents |
| TEXT | `column('name')` | String field |
| DATE | `column('name')` | ISO string YYYY-MM-DD |
| TIMESTAMPTZ | `column('name')` | ISO string or epoch |
| BOOLEAN | `column('name', default)` | Boolean with default |
| JSONB | `column('name', {})` | Object literal default |
| TEXT[] | `column('name', [])` | Array literal default |
| INTEGER | `column('name', 1)` | Default value |

### 3.3 Enums → TypeScript Types

```typescript
// Mapped from PostgreSQL enums
type OrganizationType = 'church' | 'school' | 'ngo' | 'company' | 'custom';
type UserRole = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';
type TransactionStatus = 'draft' | 'pending' | 'approved' | 'rejected';
type TransactionScopeType = 'org' | 'group';
type MemberStatus = 'active' | 'inactive' | 'deceased' | 'transferred';
type UnitType = 'department' | 'ministry' | 'committee' | 'sub_group';
type LifecycleState = 'draft' | 'active' | 'archived' | 'trashed' | 'purged';
type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';
type SyncStatus = 'pending' | 'sent' | 'confirmed' | 'failed';
```

---

## 4. Stratégie de Sync Offline-First Complète

### 4.1 Architecture Sync

```
                    ┌─────────────────────────────┐
                    │     SyncManager (Singleton)   │
                    │                             │
                    │  - pushQueue (50 ops batch)  │
                    │  - pullScheduler (per-table) │
                    │  - conflictResolver          │
                    │  - networkMonitor            │
                    └───────────┬─────────────────┘
                    ┌───────────┼─────────────────┐
                    │ push()  │ pull()           │ connect()
                    ▼         ▼                   ▼
              ┌─────────┐ ┌──────────┐   ┌──────────────┐
              │ Push    │ │ Pull     │   │ Connectivity │
              │ Queue   │ │ Sched    │   │ Listener     │
              │         │ │          │   │ (NetworkInfo)│
              └────┬────┘ └────┬─────┘   └──────────────┘
                   │           │
              ┌────▼────┐ ┌───▼─────────────┐
              │POST /edge/sync-pending    │ │POST /api/v1/pull/{table}
              │body: operations[]         │ │params: since, org_id
              └───────────┘ └─────────────────┘
```

### 4.2 Configuration Par Table

| Table | Push Interval | Pull Interval | Conflict Strategy |
|---|---|---|---|
| transactions | Immediate | 60s | Server-wins (version check) |
| members | Immediate | 300s | LWW (timestamp_client) |
| events | Immediate | 120s | LWW + notification |
| org_units | On change | 3600s | Server-wins |
| categories | On change | 3600s | Server-wins (lookup) |
| archive_entries | Immediate | 300s | LWW + notification |
| notifications | Server-only | 30s | N/A (server-created) |
| audit_logs | Server-only | N/A | N/A (read-only) |
| pending_operations | Local queue | N/A | N/A (self-managed) |

### 4.3 Push Conflict Resolution Detail

```typescript
/**
 * Résolution de conflit côté serveur pour les pushes.
 * Stratégie: optimistc lock avec fallback LWW.
 */
interface PushConflictResult {
  type: 'none' | 'version_conflict' | 'lww_winner' | 'side_by_side'
  details?: {
    serverVersion: number
    clientVersion: number
    winner?: 'server' | 'client'
    fields?: string[] // Champs en conflit pour side-by-side
  }
}

async function resolvePushConflict(
  table: string,
  recordId: string,
  clientVersion: number,
  serverRecord: Record<string, any>,
  clientPayload: Record<string, any>
): Promise<PushConflictResult> {
  switch (table) {
    case 'transactions':
      if (serverRecord.status === 'approved') {
        return { type: 'none' } // INV-001: immuable
      }
      if (clientVersion > serverRecord.version) {
        return { type: 'none' } // Client a version plus récente
      }
      return {
        type: 'version_conflict',
        details: {
          serverVersion: serverRecord.version,
          clientVersion,
          winner: 'server',
        }
      }

    case 'members':
    case 'events':
    case 'archive_entries':
      // LWW: last writer wins (compare timestamp_client vs created_at)
      if (serverRecord.updated_at < clientPayload.timestamp_client) {
        return { type: 'none' } // Client est plus récent
      }
      return {
        type: 'lww_winner',
        details: { serverVersion: serverRecord.version, clientVersion, winner: 'server' }
      }

    default:
      return { type: 'none' }
  }
}
```

---

## 5. Migrations Complètes

### Plan d'Exécution

| Étape | Migration | Tables Créées | Durée Estimée |
|---|---|---|---|
| 1 | `00_init_platform.sql` | organizations, users, user_sessions | ~5s |
| 2 | `01_finance.sql` | categories, transactions | ~10s |
| 3 | `02_members.sql` | members, org_units, group_memberships | ~15s |
| 4 | `03_archive.sql` | archive_entries (avec triggers) | ~10s |
| 5 | `04_events.sql` | events, event_templates | ~5s |
| 6 | `05_notifications.sql` | notifications, notification_preferences, org_settings | ~5s |
| 7 | `06_audit.sql` | audit_logs | ~3s |
| 8 | `07_sync.sql` | pending_operations (avec triggers) | ~8s |

### Migration par Migration

Toutes les scripts SQL sont dans `BACKEND-PG-SCHEMA.md`. Ce document sert de guide d'assemblage.

---

## 6. Checklist de Vérification Post-Modélisation

### Capacités vs Métier
- [ ] Chaque table correspond à une capacité (pas à un métier)
- [ ] Aucune table ne contient de termes Church/NGO/School (seulement dans manifest_json)
- [ ] Archive entries est générique → applyable à tous les types de ressources
- [ ] Lifecycle est une capacité universelle (state machine configurable)
- [ ] org_units supporte tout type d'unité organisationnelle (department, ministry, committee...)

### Invariants
- [x] INV-001: Transactions approved ≠ modifiables (CHECK constraint + RLS policy)
- [x] INV-002: Zéro硬code métier dans le schema
- [x] INV-004: org_id sur TOUTES les tables de données utilisateur
- [x] INV-007: Audit logs immuables (REVOKE DELETE/UPDATE)
- [x] INV-010: version sur TOUTES les tables modifiables

### NeverBreak Rules
- [x] NB-RULE-03: Financial immutability enforced at DB level
- [x] NB-RULE-04: x-org-id header required (middleware ins forge enforcement)
- [x] NB-RULE-05: manifest_json validated by Manifest Engine before persisting
- [x] NB-RULE-06: Local write before remote sync (PendingOperation pattern)
- [x] NB-RULE-07: Pas de `any` — tous les types TS définis

### Performance
- [x] Index composite sur (org_id, ...) pour chaque table de données
- [x] Index GIN sur tags + metadata de archive_entries
- [x] Index idx_transactions_scope pour consolidation financière multi-niveaux
- [x] Depth limit 5 sur org_units (trigger CHECK)
- [x] Full-text search sur archive_entries (tsvector trigger)
