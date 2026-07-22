# SPRINT 6 — Members Module (K2)

## Sprint Title
Lumina v2 — Member CRUD, Search, Department Assignment, Status Management

## Sprint Objective
Implement the complete members module: create/list/search/update members, manage statuses (active/inactive/deceased/transferred), assign to departments. Per BR-MEM rules, GDPR-like data handling, member lifecycle management. Integration with Vocabulary Engine for status enums.

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

mkdir -p src/features/members/src
mkdir -p src/features/members/components
mkdir -p tests/unit/features/members
```

## Files to Create (with COMPLETE content)

---

### A. MEMBERS SERVICES

#### 1. `src/features/members/src/MemberService.ts`
```typescript
// src/features/members/src/MemberService.ts
// BR-MEM-001: first_name + last_name required
// BR-MEM-002: email validated if provided
// BR-MEM-003: phone formatted
// BR-MEM-004: date of birth age 0-120
// BR-MEM-005: duplicate email detection
// BR-MEM-010: statuses active/inactive/deceased/transferred

import { database } from '@/core/sync/Database';
import { SyncManager } from '@/core/sync/SyncManager';

export type MemberStatus = 'active' | 'inactive' | 'deceased' | 'transferred';

export interface MemberCreateInput {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  departmentId?: string;
}

export interface MemberUpdateInput {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string;
  dateOfBirth?: string;
  gender?: string;
  status?: MemberStatus;
  departmentId?: string;
}

export class MemberService {
  constructor(private syncManager: SyncManager) {}

  async list(orgId: string, filters?: { search?: string; status?: string; departmentId?: string }) {
    let query = database.get('members').query();
    if (filters?.status) query = query.unsafeGetWhere('status', filters.status);
    return query.fetch();
  }

  async create(orgId: string, input: MemberCreateInput, createdBy: string): Promise<string> {
    this.validateCreate(input);

    // BR-MEM-005: duplicate email check
    if (input.email) {
      const existing = await database.get('members').query(
        database.get('members').queryBuilder().unsafeGetWhere('email', input.email)
      ).fetch();
      if (existing.length > 0) throw new Error(`Email ${input.email} already exists`);
    }

    const id = crypto.randomUUID();
    await database.write(async () => {
      await database.get('members').create(m => {
        m._raw = {
          id, org_id: orgId, first_name: input.firstName, last_name: input.lastName,
          email: input.email ?? null, phone: input.phone ?? null,
          date_of_birth: input.dateOfBirth ?? null, gender: input.gender ?? null,
          status: 'active' as const, joined_at: new Date().toISOString().split('T')[0],
          department_id: input.departmentId ?? null,
        };
      });
    });
    this.syncManager.registerOperation({ id: `op-mem-${id}`, resourceType: 'member', resourceId: id, action: 'create', payload: input });
    return id;
  }

  async update(id: string, input: MemberUpdateInput): Promise<boolean> {
    const member = await this.getById(id);
    if (!member) return false;

    await database.write(async () => {
      await member.prepareUpdate(m => {
        if (input.firstName) m.firstName = input.firstName;
        if (input.lastName) m.lastName = input.lastName;
        if (input.email !== undefined) m.email = input.email;
        if (input.phone !== undefined) m.phone = input.phone;
        if (input.dateOfBirth) m.dateOfBirth = input.dateOfBirth;
        if (input.gender) m.gender = input.gender;
        if (input.status) m.status = input.status;
        if (input.departmentId !== undefined) m.departmentId = input.departmentId;
      });
    });

    this.syncManager.registerOperation({ id: `op-upd-mem-${id}`, resourceType: 'member', resourceId: id, action: 'update', payload: input });
    return true;
  }

  async search(orgId: string, query: string): Promise<any[]> {
    // Case-insensitive search on name fields
    const results = await database.get('members').query(
      database.get('members').queryBuilder().unsafeGetWhere('_text', query)
    ).fetch();
    return results;
  }

  async getById(id: string): Promise<any> {
    try { return await database.get('members').find(id); } catch { return null; }
  }

  async linkToDepartment(memberId: string, departmentId: string): Promise<boolean> {
    return this.update(memberId, { departmentId });
  }

  private validateCreate(input: MemberCreateInput): void {
    // BR-MEM-001
    if (!input.firstName.trim()) throw new Error('Prénom obligatoire');
    if (!input.lastName.trim()) throw new Error('Nom obligatoire');
    // BR-MEM-002
    if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) throw new Error('Email invalide');
    // BR-MEM-004: age 0-120
    if (input.dateOfBirth) {
      const age = Math.floor((Date.now() - new Date(input.dateOfBirth).getTime()) / 31557600000);
      if (age < 0 || age > 120) throw new Error('Date de naissance invalide (age 0-120)');
    }
  }
}
```

#### 2. `src/features/members/components/MemberCard.tsx`
```typescript
// src/features/members/components/MemberCard.tsx
import React from 'react';
import { Text, View, TouchableOpacity } from 'react-native';
import { Card } from '@/shared/components/Card';
import { Badge } from '@/shared/components/Badge';
import { DEFAULT_THEME } from '@/core/theme';

interface Props { id: string; firstName: string; lastName: string; status: string; onPress: () => void; }

export function MemberCard({ firstName, lastName, status, onPress }: Props) {
  return (
    <TouchableOpacity onPress={onPress}>
      <Card variant="feed">
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ color: DEFAULT_THEME.textPrimary, fontSize: 14, fontWeight: '700' }}>{firstName} {lastName}</Text>
          <Badge label={status} status={status === 'active' ? 'approved' : status === 'deceased' ? 'rejected' : 'draft'} />
        </View>
      </Card>
    </TouchableOpacity>
  );
}
```

---

### B. TESTS

#### 3. `tests/unit/features/members/MemberService.test.ts`
```typescript
import { MemberService } from '../../../../src/features/members/src/MemberService';
import { SyncManager } from '../../../../src/core/sync/SyncManager';

describe('MemberService', () => {
  let service: MemberService;
  beforeEach(() => { service = new MemberService(new SyncManager()); });

  test('create requires first_name + last_name (BR-MEM-001)', () => {
    expect(() => service['validateCreate']({ firstName: '', lastName: 'X' })).toThrow('Prénom');
    expect(() => service['validateCreate']({ firstName: 'X', lastName: '' })).toThrow('Nom');
  });

  test('rejects invalid email (BR-MEM-002)', () => {
    expect(() => service['validateCreate']({ firstName: 'A', lastName: 'B', email: 'not-an-email' })).toThrow();
    expect(() => service['validateCreate']({ firstName: 'A', lastName: 'B', email: 'valid@test.com' })).not.toThrow();
  });

  test('rejects age outside 0-120 (BR-MEM-004)', () => {
    const futureDob = new Date(Date.now() + 86400000 * 365).toISOString().split('T')[0]; // tomorrow
    expect(() => service['validateCreate']({ firstName: 'A', lastName: 'B', dateOfBirth: futureDob })).toThrow();

    const ancientDob = new Date(Date.now() - 86400000 * 365 * 200).toISOString().split('T')[0]; // 200 years ago
    expect(() => service['validateCreate']({ firstName: 'A', lastName: 'B', dateOfBirth: ancientDob })).toThrow();
  });
});
```

## Tests to Write
All unit tests above. Add component tests for MemberCard rendering states.

## Documentation to Update
- Traceability Matrix: add PRD-06 (Gestion Membres) entries

## DoD Checklist — Sprint 6 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | Member CRUD tested | |
| C02 | Coverage >= 80% members/ | |
| C03 | No hardcoded church terms in model | |
| C04 | Zero `any` types | |
| T01 | All tests pass | |
| D01 | Business rules documented in BR-MEM refs | |
| Q01-Q04 | Lint/typecheck/prettier/format clean | |
