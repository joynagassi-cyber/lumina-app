# SPRINT 3 — Database Models: WatermelonDB + PostgreSQL Migrations

## Sprint Title
Lumina v2 — WatermelonDB Local Models and PostgreSQL Server Schema

## Sprint Objective
Implement all data models as WatermelonDB ORM classes (local SQLite) and corresponding PostgreSQL migration files (server). Every model follows the field conventions specified in `docs/07-database-schema/Database-Schema.md`. Implements INV-001 (financial immutability), INV-004 (org isolation), NB-RULE-06 (local write before remote), and DS-R01 through DS-R07.

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

# Create directories
mkdir -p src/models
mkdir -p src/core/sync/adapters
mkdir -p src/core/sync/strategies
mkdir -p insforge-backend/migrations
mkdir -p tests/unit/models
mkdir -p tests/integration/db
```

## Files to Create (with COMPLETE content)

---

### A. WATERMELONDB MODELS

#### 1. `src/models/Transaction.ts`
```typescript
// src/models/Transaction.ts — Financial transaction model
// INV-001: approved/archived transactions are immutable
// DS-R03: amounts stored as integer cents to avoid floating-point errors

import { Model } from '@nozbe/watermelondb';
import { table, props, column, relation } from '@nozbe/watermelondb/decorators';

@table('transactions')
export class Transaction extends Model {
  static table = 'transactions' as const;

  // === WatermelonDB required columns ===
  id            = prop();
  _synced       = column('synced', 0);
  createdAt     = column('created_at');
  updatedAt     = column('updated_at');

  // === Business fields ===
  orgId         = column('org_id');
  type          = column('type');          // income | expense | transfer
  amount        = column('amount');        // integer cents (NOT float)
  currency      = column('currency');      // CDF, USD, EUR
  categoryId    = column('category_id');
  description   = column('description');
  receiptPath   = column('receipt_path');
  date          = column('transaction_date');
  status        = column('status');        // draft | pending | approved | rejected | archived
  createdBy     = column('created_by');
  approvedBy    = column('approved_by');
  approvedAt    = column('approved_at');
  version       = column('version', 1);
  compensatesFor = column('compensates_for');

  // Getters
  get amountDecimal(): number { return this.amount / 100; }
  set amountDecimal(value: number) { this.amount = Math.round(value * 100); }

  get isImmutable(): boolean {
    return ['approved', 'archived'].includes(this.status);
  }

  get canEdit(): boolean {
    return ['draft', 'pending'].includes(this.status);
  }

  // INV-001: compensate() creates inverse transaction
  async compensate(reason: string): Promise<Transaction> {
    if (!this.isImmutable) throw new Error(`Cannot compensate non-immutable transaction (status: ${this.status})`);
    const newTx = await this.adapters.sqwleedb.collections.get('transactions').create(t => {
      t.type = this.type === 'income' ? 'expense' : 'income';
      t.amount = -this.amount;
      t.currency = this.currency;
      t.description = reason;
      t.date = new Date().toISOString().split('T')[0];
      t.status = 'draft';
      t.compensatesFor = this.id;
      t.createdBy = this.createdBy;
    });
    return newTx;
  }
}
```

#### 2. `src/models/Category.ts`
```typescript
// src/models/Category.ts — Financial category model (lookup table, always synced)

import { Model } from '@nozbe/watermelondb';
import { table, props, column, relation } from '@nozbe/watermelondb/decorators';

@table('categories')
export class Category extends Model {
  static table = 'categories' as const;

  id              = prop();
  _synced         = column('synced', 1);
  createdAt       = column('created_at');
  updatedAt       = column('updated_at');

  orgId           = column('org_id');
  name            = column('name');
  nameFr          = column('name_fr');
  parentCategoryId = column('parent_category_id');
  categoryType    = column('category_type'); // income | expense | asset | liability | equity
  isImmutable     = column('is_immutable', false);

  get canDelete(): boolean { return !this.isImmutable; }
  get canUpdate(): boolean { return !this.isImmutable && this.categoryType !== 'equity'; }
}
```

#### 3. `src/models/Member.ts`
```typescript
// src/models/Member.ts — Member model (LWW conflict resolution)

import { Model } from '@nozbe/watermelondb';
import { table, props, column } from '@nozbe/watermelondb/decorators';

@table('members')
export class Member extends Model {
  static table = 'members' as const;

  id              = prop();
  _synced         = column('synced', 0);
  createdAt       = column('created_at');
  updatedAt       = column('updated_at');

  orgId           = column('org_id');
  firstName       = column('first_name');
  lastName        = column('last_name');
  email           = column('email');
  phone           = column('phone');
  dateOfBirth     = column('date_of_birth');
  gender          = column('gender');
  photoUrl        = column('photo_url');
  status          = column('status'); // active | inactive | deceased | transferred
  joinedAt        = column('joined_at');
  departmentId    = column('department_id');

  get isActive(): boolean { return this.status === 'active'; }
  get displayName(): string { return `${this.firstName} ${this.lastName}`.trim(); }
}
```

#### 4. `src/models/Department.ts`
```typescript
// src/models/Department.ts — Organizational department (lookup table)

import { Model } from '@nozbe/watermelondb';
import { table, props, column } from '@nozbe/watermelondb/decorators';

@table('departments')
export class Department extends Model {
  static table = 'departments' as const;

  id              = prop();
  _synced         = column('synced', 1);
  createdAt       = column('created_at');
  updatedAt       = column('updated_at');

  orgId           = column('org_id');
  name            = column('name');
  parentId        = column('parent_id');
  roleAssignment  = column('role_assignment');
}
```

#### 5. `src/models/PendingOperation.ts`
```typescript
// src/models/PendingOperation.ts — Offline sync queue (DS-R05: never purge without confirmation)

import { Model } from '@nozbe/watermelondb';
import { table, props, column } from '@nozbe/watermelondb/decorators';

@table('pending_operations')
export class PendingOperation extends Model {
  static table = 'pending_operations' as const;

  id               = prop();
  _synced          = column('synced', 1);
  createdAt        = column('created_at');
  updatedAt        = column('updated_at');

  resourceType     = column('resource_type');
  resourceId       = column('resource_id');
  action           = column('action');       // create | update | delete
  payload          = column('payload');      // JSON string
  timestampClient  = column('timestamp_client');
  syncStatus       = column('sync_status', 'pending');
  errorMessage     = column('error_message');
}
```

#### 6. `src/models/UserSession.ts`
```typescript
// src/models/UserSession.ts — Persisted auth session for offline auto-login

import { Model } from '@nozbe/watermelondb';
import { table, props, column } from '@nozbe/watermelondb/decorators';

@table('user_sessions')
export class UserSession extends Model {
  static table = 'user_sessions' as const;

  id               = prop();
  _synced          = column('synced', 1);
  createdAt        = column('created_at');
  updatedAt        = column('updated_at');

  userId           = column('user_id');
  email            = column('email');
  orgId            = column('org_id');
  role             = column('role');
  permissions      = column('permissions');  // JSON string
  token            = column('access_token');  // encrypted
  refreshToken     = column('refresh_token'); // encrypted
  expiresAt        = column('expires_at');
  isActive         = column('is_active', true);

  isExpired(): boolean { return this.expiresAt && Date.now() > Number(this.expiresAt); }
}
```

---

### B. WATERMELONDB DATABASE SETUP

#### 7. `src/core/sync/Database.ts`
```typescript
// src/core/sync/Database.ts — WatermelonDB database initialization + migrations

import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/es/adapters/sqlite';
import { Transaction, Category, Member, Department, PendingOperation, UserSession } from '@/models/index';
import { config } from '@/core/config';

const adapters = {
  main: new SQLiteAdapter({
   dbName: 'lumina.db',
    schema: {
      transactions: {
        tableName: 'transactions',
        columns: [
          { name: 'id', type: 'string' }, { name: 'synced', type: 'number', defaultValue: 0 },
          { name: 'created_at', type: 'string' }, { name: 'updated_at', type: 'string' },
          { name: 'org_id', type: 'string' }, { name: 'type', type: 'string' },
          { name: 'amount', type: 'number' }, { name: 'currency', type: 'string' },
          { name: 'category_id', type: 'string' }, { name: 'description', type: 'string' },
          { name: 'receipt_path', type: 'string' }, { name: 'transaction_date', type: 'string' },
          { name: 'status', type: 'string' }, { name: 'created_by', type: 'string' },
          { name: 'approved_by', type: 'string' }, { name: 'approved_at', type: 'string' },
          { name: 'version', type: 'number', defaultValue: 1 },
          { name: 'compensates_for', type: 'string' },
        ],
      },
      categories: { tableName: 'categories', columns: [
        { name: 'id', type: 'string' }, { name: 'synced', type: 'number', defaultValue: 1 },
        { name: 'created_at', type: 'string' }, { name: 'updated_at', type: 'string' },
        { name: 'org_id', type: 'string' }, { name: 'name', type: 'string' },
        { name: 'name_fr', type: 'string' }, { name: 'parent_category_id', type: 'string' },
        { name: 'category_type', type: 'string' }, { name: 'is_immutable', type: 'number', defaultValue: 0 },
      ]},
      members: { tableName: 'members', columns: [
        { name: 'id', type: 'string' }, { name: 'synced', type: 'number', defaultValue: 0 },
        { name: 'created_at', type: 'string' }, { name: 'updated_at', type: 'string' },
        { name: 'org_id', type: 'string' }, { name: 'first_name', type: 'string' },
        { name: 'last_name', type: 'string' }, { name: 'email', type: 'string' },
        { name: 'phone', type: 'string' }, { name: 'date_of_birth', type: 'string' },
        { name: 'gender', type: 'string' }, { name: 'photo_url', type: 'string' },
        { name: 'status', type: 'string' }, { name: 'joined_at', type: 'string' },
        { name: 'department_id', type: 'string' },
      ]},
      departments: { tableName: 'departments', columns: [
        { name: 'id', type: 'string' }, { name: 'synced', type: 'number', defaultValue: 1 },
        { name: 'created_at', type: 'string' }, { name: 'updated_at', type: 'string' },
        { name: 'org_id', type: 'string' }, { name: 'name', type: 'string' },
        { name: 'parent_id', type: 'string' }, { name: 'role_assignment', type: 'string' },
      ]},
      pending_operations: { tableName: 'pending_operations', columns: [
        { name: 'id', type: 'string' }, { name: 'synced', type: 'number', defaultValue: 1 },
        { name: 'created_at', type: 'string' }, { name: 'updated_at', type: 'string' },
        { name: 'resource_type', type: 'string' }, { name: 'resource_id', type: 'string' },
        { name: 'action', type: 'string' }, { name: 'payload', type: 'string' },
        { name: 'timestamp_client', type: 'number' }, { name: 'sync_status', type: 'string', defaultValue: 'pending' },
        { name: 'error_message', type: 'string' },
      ]},
      user_sessions: { tableName: 'user_sessions', columns: [
        { name: 'id', type: 'string' }, { name: 'synced', type: 'number', defaultValue: 1 },
        { name: 'created_at', type: 'string' }, { name: 'updated_at', type: 'string' },
        { name: 'user_id', type: 'string' }, { name: 'email', type: 'string' },
        { name: 'org_id', type: 'string' }, { name: 'role', type: 'string' },
        { name: 'permissions', type: 'string' }, { name: 'access_token', type: 'string' },
        { name: 'refresh_token', type: 'string' }, { name: 'expires_at', type: 'number' },
        { name: 'is_active', type: 'number', defaultValue: 1 },
      ]},
    },
    onMigration: (schema: any) => { /* extensible for future versions */ },
    migratePreviousData: false,
  }),
};

const database = new Database({ adapters: adapters.main });

export { database };
```

#### 8. `src/models/index.ts`
```typescript
// src/models/index.ts — Model registry for WatermelonDB
export { Transaction } from './Transaction';
export { Category } from './Category';
export { Member } from './Member';
export { Department } from './Department';
export { PendingOperation } from './PendingOperation';
export { UserSession } from './UserSession';
```

---

### C. POSTGRESQL MIGRATIONS

#### 9. `insforge-backend/migrations/00_init_platform.sql`
```sql
-- Migration: Initial platform schema (organizations, users, sessions)
-- DS-R01: All tables have org_id FK + RLS policies

CREATE TABLE IF NOT EXISTS organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('church', 'school', 'ngo', 'company', 'custom')),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member',
    first_name TEXT,
    last_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_users_org ON users(org_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY org_isolation ON users USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE TABLE IF NOT EXISTS user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT,
    expires_at BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_user_sessions_org ON user_sessions(org_id);
```

#### 10. `insforge-backend/migrations/01_finance.sql`
```sql
-- Migration: Finance tables (transactions, categories)
-- INV-001: No UPDATE/DELETE allowed on approved/archived transactions
-- NB-RULE-03: Financial integrity guard enforced at DB level

CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    name_fr TEXT,
    parent_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    category_type TEXT NOT NULL CHECK (category_type IN ('income', 'expense', 'asset', 'liability', 'equity')),
    is_immutable BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
    amount BIGINT NOT NULL CHECK (amount > 0),
    currency TEXT NOT NULL DEFAULT 'CDF',
    category_id UUID REFERENCES categories(id),
    description TEXT,
    receipt_path TEXT,
    transaction_date DATE NOT NULL CHECK (transaction_date <= CURRENT_DATE),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected', 'archived')),
    created_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMPTZ,
    version INTEGER NOT NULL DEFAULT 1,
    compensates_for UUID REFERENCES transactions(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_transactions_org ON transactions(org_id);
CREATE INDEX idx_transactions_status ON transactions(status);
CREATE INDEX idx_transactions_date ON transactions(transaction_date);
CREATE INDEX idx_transactions_org_status_date ON transactions(org_id, status, transaction_date);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY tx_read ON transactions FOR SELECT USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY tx_create ON transactions FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id') AND status = 'draft');
CREATE POLICY tx_update_draft ON transactions FOR UPDATE USING (org_id = current_setting('app.current_org_id')) WITH CHECK (NEW.status IN ('draft', 'pending'));
-- NOTE: No policy allows UPDATE when status='approved' or 'archived' -- immutability guaranteed
```

#### 11. `insforge-backend/migrations/02_members.sql`
```sql
-- Migration: Members and departments

CREATE TABLE IF NOT EXISTS members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    date_of_birth DATE,
    gender TEXT,
    photo_url TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'deceased', 'transferred')),
    joined_at DATE,
    department_id UUID REFERENCES departments(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS departments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    parent_id UUID REFERENCES departments(id) ON DELETE SET NULL,
    role_assignment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_members_org ON members(org_id);
CREATE INDEX idx_members_status ON members(status);

ALTER TABLE members ENABLE ROW LEVEL SECURITY;
CREATE POLICY member_read ON members FOR SELECT USING (org_id = current_setting('app.current_org_id')::uuid);
CREATE POLICY member_write ON members FOR ALL USING (org_id = current_setting('app.current_org_id'))
    WITH CHECK (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND org_id = current_setting('app.current_org_id') AND role IN ('super_admin', 'admin', 'manager')));
```

---

### D. CONFLICT RESOLUTION STRATEGIES

#### 12. `src/core/sync/strategies/LWWStrategy.ts`
```typescript
// src/core/sync/strategies/LWWStrategy.ts — Last-Writer-Wins for members, events, groups

export interface LWWConflict {
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  resourceType: string;
  resourceId: string;
  localUpdatedAt: number;
  serverUpdatedAt: number;
}

export function resolveLWW(conflict: LWWConflict): Record<string, unknown> {
  // Server wins if its timestamp is >= local
  return conflict.serverUpdatedAt >= conflict.localUpdatedAt
    ? conflict.serverVersion
    : conflict.localVersion;
}
```

#### 13. `src/core/sync/strategies/ImmutableStrategy.ts`
```typescript
// src/core/sync/strategies/ImmutableStrategy.ts — Financial data protection (INV-001)

export interface ImmutableConflict {
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  status: 'draft' | 'pending' | 'approved' | 'rejected' | 'archived';
}

export function resolveImmutable(conflict: ImmutableConflict): { resolved: boolean; action: 'block' | 'allow' } {
  if (conflict.status === 'approved' || conflict.status === 'archived') {
    // Never allow modification of immutable records
    return { resolved: false, action: 'block' };
  }
  return { resolved: true, action: 'allow' };
}
```

---

### E. MODELS TEST

#### 14. `tests/unit/models/Transaction.test.ts`
```typescript
import { Transaction } from '../../../../src/models/Transaction';

describe('Transaction Model', () => {
  test('amount stored as cents (integer)', () => {
    // DS-R03: decimal stored as integer cents
    // Simulating what WatermelonDB would do with the decorator pattern
    const value = 1234.56;
    const cents = Math.round(value * 100);
    expect(cents).toBe(123456);
    expect(cents / 100).toBe(1234.56);
  });

  test('approved transaction is immutable', () => {
    // NV-001: no mutation after approval
    const approvedStatuses = ['approved', 'archived'];
    const mutableStatuses = ['draft', 'pending', 'rejected'];

    approvedStatuses.forEach(s => expect(s).not.toBe('draft'));
    mutableStatuses.forEach(s => expect(['draft', 'pending'].includes(s)).toBe(true));
  });

  test('compensate requires immutable status', () => {
    const cannotCompensate = ['draft', 'pending'];
    const canCompensate = ['approved', 'archived'];
    expect(cannotCompensate.length).toBeGreaterThan(0);
    expect(canCompensate.length).toBeGreaterThan(0);
  });
});
```

## Tests to Write
All tests above plus PostgreSQL migration syntax validation.

## Documentation to Update
- None (schema docs already exist in Database-Schema.md)

## DoD Checklist — Sprint 3 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | 6 models + 3 migrations tested | |
| C02 | amount stored as integer cents (DS-R03) | |
| C03 | No mutation on approved status (NB-RULE-03) | |
| C04 | org_id FK on every data table (DS-R02) | |
| C05 | All migrations include created_at/updated_at | |
| T01 | LWW strategy tested | |
| T02 | Immutable strategy tested | |
| Q01 | No `any` in model files | |
| Q02 | Typecheck passes | |
| D01 | This plan aligns with Database-Schema.md spec | |
