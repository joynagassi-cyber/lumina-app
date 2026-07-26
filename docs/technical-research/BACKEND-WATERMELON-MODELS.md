# WatermelonDB Models — Lumina v2

**Doc ID:** DOC-BACKEND-WM-MODELS  
**Version:** 2.0  
**Statut:** SPÉCIFICATION COMPLÈTE  
**Dépendances:** BACKEND-PG-SCHEMA, ADR-003 (offline-first), ADR-016 (draft concurrency)

---

## 1. Règles WatermelonDB

| Règle | Détail |
|---|---|
| **WM-R01** | Toujours `@Table()`, `@prop()`, `@column()`, `@relation()` |
| **WM-R02** | Colonnes obligatoires: `id`, `_synced`, `createdAt`, `updatedAt` |
| **WM-R03** | `_synced = 0`: pending, `1`: synced, `2`: conflict |
| **WM-R04** | Les lookup tables (categories, events) ont `_synced = 1` par défaut |
| **WM-R05** | Dates stockées en ISO string (`YYYY-MM-DD`) ou epoch integer |
| **WM-R06** | Relations parent/enfant via `.relation()` WatermelonDB |
| **WM-R07** | JSONB → `column('json_field', { default: {} })` avec type custom |
| **WM-R08** | Les amounts restent BIGINT × 100 (fractions/cents) |

---

## 2. Modèle Organization

```typescript
@Table('organizations')
export class Organization extends Model {
  static table = 'organizations' as const

  id            = prop()
  _synced       = column('synced', 1)   // lookup/table master
  createdAt     = column('created_at')
  updatedAt     = column('updated_at')

  name          = column('name')
  type          = column('type')         // church, school, ngo, company, custom
  settings      = column('settings', {})  // JSONB → object literal
  status        = column('status', 'active')
}
```

---

## 3. Modèle User

```typescript
@Table('users')
export class User extends Model {
  static table = 'users' as const

  id            = prop()
  _synced       = column('synced', 1)   // lookup (pas de sync utilisateur)
  createdAt     = column('created_at')
  updatedAt     = column('updated_at')

  orgId         = column('org_id')
  email         = column('email')
  role          = column('role')
  firstName     = column('first_name')
  lastName      = column('last_name')
}
```

---

## 4. Modèle Transaction (avec scope)

```typescript
@Table('transactions')
export class Transaction extends Model {
  static table = 'transactions' as const

  id            = prop()
  _synced       = column('synced', 0)
  createdAt     = column('created_at')
  updatedAt     = column('updated_at')

  orgId         = column('org_id')
  type          = column('type')                    // income, expense, transfer
  amount        = column('amount')                  // cents
  currency      = column('currency', 'CDF')
  categoryId    = column('category_id')
  description   = column('description')
  receiptPath   = column('receipt_path')
  date          = column('transaction_date')
  status        = column('status', 'draft')
  scopeType     = column('scope_type', 'org')       // org, group
  scopeTarget   = column('scope_target')
  createdBy     = column('created_by')
  approvedBy    = column('approved_by')
  approvedAt    = column('approved_at')
  compensatesFor= column('compensates_for')
  version       = column('version', 1)

  // Relation
  category = relation(
    'categories',
    'category_id',
    'id'
  )
}
```

---

## 5. Modèle Category

```typescript
@Table('categories')
export class Category extends Model {
  static table = 'categories' as const

  id              = prop()
  _synced         = column('synced', 1)   // lookup (sync rare)
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  orgId           = column('org_id')
  name            = column('name')
  nameFr          = column('name_fr')
  parentCategoryId = column('parent_category_id')
  categoryType    = column('category_type')
  color           = column('color')
  isImmutable     = column('is_immutable', false)
  version         = column('version', 1)

  // Self-referencing relation
  children = relation(
    'categories',
    'parent_category_id',
    'id'
  )
  parent = relation(
    'categories',
    'parent_category_id',
    'id'
  )
}
```

---

## 6. Modèle Member

```typescript
@Table('members')
export class Member extends Model {
  static table = 'members' as const

  id            = prop()
  _synced       = column('synced', 0)
  createdAt     = column('created_at')
  updatedAt     = column('updated_at')

  orgId         = column('org_id')
  firstName     = column('first_name')
  lastName      = column('last_name')
  email         = column('email')
  phone         = column('phone')
  dateOfBirth   = column('date_of_birth')
  gender        = column('gender')
  photoUrl      = column('photo_url')
  status        = column('status', 'active')
  joinedAt      = column('joined_at')
  version       = column('version', 1)
}
```

---

## 7. Modèle OrgUnit & GroupMembership

```typescript
@Table('org_units')
export class OrgUnit extends Model {
  static table = 'org_units' as const

  id              = prop()
  _synced         = column('synced', 1)   // config table
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  orgId           = column('org_id')
  parentUnitId    = column('parent_unit_id')
  name            = column('name')
  unitType        = column('unit_type', 'department')
  description     = column('description')
  hasFinancialScope = column('has_financial_scope', false)
  financialScopeId = column('financial_scope_id')
  depthLevel      = column('depth_level', 0)
  status          = column('status', 'active')

  // Self-referencing
  children = relation('org_units', 'parent_unit_id', 'id')
  parent = relation('org_units', 'parent_unit_id', 'id')
}

@Table('group_memberships')
export class GroupMembership extends Model {
  static table = 'group_memberships' as const

  id              = prop()
  _synced         = column('synced', 0)
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  groupId         = column('group_id')
  memberId        = column('member_id')
  joinedAt        = column('joined_at')
}
```

---

## 8. Modèle Event

```typescript
@Table('events')
export class Event extends Model {
  static table = 'events' as const

  id              = prop()
  _synced         = column('synced', 0)
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  orgId           = column('org_id')
  title           = column('title')
  titleFr         = column('title_fr')
  description     = column('description')
  startTime       = column('start_time')        // epoch ms
  endTime         = column('end_time')           // epoch ms
  location        = column('location')
  recurrence      = column('recurrence', 'none')
  recurrenceRule  = column('recurrence_rule')
  status          = column('status', 'draft')
  createdBy       = column('created_by')
  version         = column('version', 1)
}
```

---

## 9. Modèle ArchiveEntry (Lifecycle Capability)

```typescript
@Table('archive_entries')
export class ArchiveEntry extends Model {
  static table = 'archive_entries' as const

  id              = prop()
  _synced         = column('synced', 0)
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  orgId           = column('org_id')
  archivedBy      = column('archived_by')
  linkedMemberId  = column('linked_member_id')
  resourceType    = column('resource_type')      // baptism, teaching, program...
  resourceId      = column('resource_id')
  metadata        = column('metadata', {})       // JSONB
  tags            = column('tags', [])           // TEXT[]
  category        = column('category')
  attachmentUrls  = column('attachment_urls', [])
  state           = column('state', 'active')    // draft→active→archived→trashed→purged
  archivedAt      = column('archived_at')
  trashDate       = column('trash_date')
  purgeDate       = column('purge_date')
  version         = column('version', 1)

  member = relation(
    'members',
    'linked_member_id',
    'id'
  )
}
```

---

## 10. Modèle Notification & Preferences

```typescript
@Table('notifications')
export class Notification extends Model {
  static table = 'notifications' as const

  id              = prop()
  _synced         = column('synced', 0)
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  orgId           = column('org_id')
  userId          = column('user_id')
  title           = column('title')
  body            = column('body')
  severity        = column('severity', 'info')
  channel         = column('channel', 'in_app')
  dataJson        = column('data_json', {})
  readAt          = column('read_at')
  sentAt          = column('sent_at')
}

@Table('notification_preferences')
export class NotificationPreference extends Model {
  static table = 'notification_preferences' as const

  id              = prop()
  _synced         = column('synced', 1)
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  userId          = column('user_id')
  orgId           = column('org_id')
  channels        = column('channels', ['in_app'])
  severityMin     = column('severity_min', 'info')
  rateLimitH      = column('rate_limit_h', 24)
}
```

---

## 11. Modèle AuditLog

```typescript
@Table('audit_logs')
export class AuditLog extends Model {
  static table = 'audit_logs' as const

  id              = prop()
  _synced         = column('synced', 1)         // read-only, server→client
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  orgId           = column('org_id')
  userId          = column('user_id')
  action          = column('action')
  entityType      = column('entity_type')
  entityId        = column('entity_id')
  oldValues       = column('old_values', {})     // JSONB
  newValues       = column('new_values', {})     // JSONB
  ipAddress       = column('ip_address')
}
```

---

## 12. Modèle PendingOperation (Sync Queue)

```typescript
@Table('pending_operations')
export class PendingOperation extends Model {
  static table = 'pending_operations' as const

  id              = prop()
  _synced         = column('synced', 1)         // read-only until confirmed
  createdAt       = column('created_at')
  updatedAt       = column('updated_at')

  resourceType    = column('resource_type')
  resourceId      = column('resource_id')
  action          = column('action')             // create, update, delete
  payload         = column('payload', '{}')      // JSON string
  timestampClient = column('timestamp_client')
  syncStatus      = column('sync_status', 'pending')  // pending→sent→confirmed→failed
  errorMessage    = column('error_message')
  version         = column('version', 1)
}
```

---

## 13. Sync Strategy Détaillée

### Push Queue (Local → Server)

```typescript
// src/db/sync/push-queue.ts
interface PushConfig {
  batch_size: number          // 50
  retry_base_delay_ms: number // 1000
  retry_max_delay_ms: number  // 60000
  retry_max_attempts: number  // 5
  concurrent_pushes: number   // 3 max
}

async function pushPendingOperations(db: Database): Promise<number> {
  const operations = await db.get('pending_operations').query(
    Q.where('sync_status', 'pending'),
    Q.limits(50)
  ).fetch()

  for (const op of operations) {
    try {
      await pushSingleOperation(op)
      await db.batch((txn) => {
        return txn.get('pending_operations').update(op.id, {
          synced: 1,
          _raw: JSON.stringify({ sync_status: 'sent' }),
        })
      })
    } catch (err) {
      // Exponential backoff: 1s, 2s, 4s, 8s, 16s
      await scheduleRetry(op, err)
    }
  }
  return operations.length
}
```

### Pull Strategy (Server → Local)

```typescript
// src/db/sync/pull-strategy.ts
/**
 * Delta pull depuis le dernier sync_timestamp.
 * Chaque table a son propre intervalle de sync:
 * - transactions: toutes les 60s
 * - members: toutes les 300s
 * - categories: toutes les 3600s (lookup rarement changé)
 * - events: toutes les 120s
 * - archive_entries: toutes les 300s
 */

interface PullConfig {
  [tableName: string]: {
    interval_seconds: number
    columns: string[]           // colonnes à puller
    filter_field: string        // toujours 'org_id'
    version_field: string       // pour optimistic lock
  }
}

const PULL_CONFIG: PullConfig = {
  transactions: { interval_seconds: 60, columns: [...], filter_field: 'org_id', version_field: 'version' },
  members:      { interval_seconds: 300, columns: [...], filter_field: 'org_id', version_field: 'version' },
  categories:   { interval_seconds: 3600, columns: [...], filter_field: 'org_id', version_field: 'version' },
  events:       { interval_seconds: 120, columns: [...], filter_field: 'org_id', version_field: 'version' },
  archive_entries: { interval_seconds: 300, columns: [...], filter_field: 'org_id', version_field: 'version' },
}

async function pullUpdates(table: string, since: Date): Promise<void> {
  const lastSync = await getLastSyncTimestamp(table)
  const response = await fetch(`/api/v1/pull/${table}?since=${since.toISOString()}`, {
    headers: { 'x-org-id': currentOrgId },
  })
  const records = await response.json() as Record<string, any>[]

  await db.batch(async (txn) => {
    for (const record of records) {
      // Optimistic lock check
      const existing = await db.get(table).find(record.id)
      if (existing && existing.version > record.version) {
        // Server a été écrasé → keep client's version
        continue
      }
      // Side-by-side diff si conflict détecté
      if (existing && existing.version === record.version && diffPayload(existing, record)) {
        // Créer notification de conflict
        await createConflictNotification(existing, record)
        continue
      }
      await syncRecordToTable(txn, table, record)
    }
  })
}
```

### Conflict Resolution Strategies Par Entité

| Entité | Stratégie | Détail |
|---|---|---|
| `transactions` (approved) | **Immutable** | Jamais de mise à jour (INV-001) |
| `transactions` (draft) | **UUID dedup + Side-by-Side** | Si même UUID → comparaison fields, notification conflit |
| `members` | **LWW** | Last Writer Wins (timestamp_client) |
| `events` | **LWW + Notif** | Last Writer Wins + notification push |
| `archive_entries` | **LWW + Notif** | Version field check + notification |
| `org_units` | **Server-Wins** | Si schema mismatch → force server state |
| `categories` | **Server-Wins** | Lookup table, serveur est source de vérité |
| `pending_operations` | **Queue dedup** | Même (resource_type, resource_id, action) → merge |
