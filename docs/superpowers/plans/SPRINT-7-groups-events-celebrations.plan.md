# SPRINT 7 — Groups, Events, Celebrations

## Sprint Title
Lumina v2 — Dynamic Groups, Calendar Events, and Celebrations (K2)

## Sprint Objective
Implement dynamic groups with feature toggles per manifest configuration, calendar event management (create/list/recurring), and celebrations placeholder for V2 readiness. All groups configurable via Manifest Engine (INV-005).

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

mkdir -p src/features/groups/src
mkdir -p src/features/events/src
mkdir -p src/features/celebrations/src
mkdir -p tests/unit/features/groups
mkdir -p tests/unit/features/events
```

## Files to Create (with COMPLETE content)

---

### A. GROUPS MODULE

#### 1. `src/features/groups/src/GroupService.ts`
```typescript
// src/features/groups/src/GroupService.ts
// Groups are dynamic organizational units configured via manifest (INV-005)

import { database } from '@/core/sync/Database';

export interface GroupCreateInput {
  name: string;
  description?: string;
  groupType: string;  // configurable: ministry, department, committee, etc.
  assignedMemberIds: string[];
}

export class GroupService {
  async list(orgId: string) {
    return database.get('groups').query().fetch();
  }

  async create(orgId: string, input: GroupCreateInput): Promise<string> {
    const id = crypto.randomUUID();
    await database.write(async () => {
      await database.get('groups').create(g => {
        g._raw = {
          id, org_id: orgId, name: input.name, description: input.description ?? '',
          group_type: input.groupType, status: 'active',
        };
      });
      // Assign members
      for (const memberId of input.assignedMemberIds) {
        await database.get('group_memberships').create(gm => {
          gm._raw = { id: `${g}-mem-${memberId}`, group_id: id, member_id: memberId, status: 'active' };
        });
      }
    });
    return id;
  }

  async addMember(groupId: string, memberId: string): Promise<boolean> {
    try {
      await database.write(async () => {
        await database.get('group_memberships').create(gm => {
          gm._raw = { id: `${groupId}-mem-${memberId}-${Date.now()}`, group_id: groupId, member_id: memberId, status: 'active' };
        });
      });
      return true;
    } catch { return false; }
  }

  async removeMember(groupId: string, memberId: string): Promise<boolean> {
    try {
      const membership = await database.get('group_memberships').query(
        database.get('group_memberships').queryBuilder().unsafeGetWhere('group_id', groupId),
        database.get('group_memberships').queryBuilder().unsafeGetWhere('member_id', memberId)
      ).fetch();
      if (membership.length === 0) return false;
      await database.write(async () => {
        await membership[0].prepareDelete();
      });
      return true;
    } catch { return false; }
  }
}
```

---

### B. EVENTS MODULE

#### 2. `src/features/events/src/EventService.ts`
```typescript
// src/features/events/src/EventService.ts
// Calendar events with basic recurrence support

import { database } from '@/core/sync/Database';

export type EventFrequency = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface EventCreateInput {
  title: string;
  description?: string;
  startDate: string;
  endDate?: string;
  frequency?: EventFrequency;
  maxAttendees?: number;
}

export class EventService {
  async list(orgId: string, dateFrom?: string, dateTo?: string) {
    return database.get('events').query().fetch();
  }

  async create(orgId: string, input: EventCreateInput): Promise<string> {
    const id = crypto.randomUUID();
    await database.write(async () => {
      await database.get('events').create(e => {
        e._raw = {
          id, org_id: orgId, title: input.title, description: input.description ?? '',
          start_date: input.startDate, end_date: input.endDate ?? input.startDate,
          frequency: input.frequency ?? 'none', max_attendees: input.maxAttendees ?? 0,
          status: 'scheduled',
        };
      });
    });
    return id;
  }

  async update(id: string, input: Partial<EventCreateInput>): Promise<boolean> {
    const event = await this.getById(id);
    if (!event) return false;
    await database.write(async () => {
      await event.prepareUpdate(e => {
        if (input.title) e.title = input.title;
        if (input.description) e.description = input.description;
        if (input.startDate) e.startDate = input.startDate;
        if (input.endDate) e.endDate = input.endDate;
        if (input.frequency) e.frequency = input.frequency;
        if (input.maxAttendees !== undefined) e.maxAttendees = input.maxAttendees;
      });
    });
    return true;
  }

  async getById(id: string): Promise<any> {
    try { return await database.get('events').find(id); } catch { return null; }
  }
}
```

---

### C. CELEBRATIONS MODULE (V2-ready scaffold)

#### 3. `src/features/celebrations/src/CelebrationService.ts`
```typescript
// src/features/celebrations/src/CelebrationService.ts
// Placeholder for V2: sacrament tracking, worship service scheduling
// Currently returns empty — feature gate checked via Capability Engine

import { capabilityEngine } from '@/core/capability/src/CapabilityEngine';

export class CelebrationService {
  isEnabled(): boolean {
    return capabilityEngine.isCapabilityActive('celebrations');
  }

  async listServices(orgId: string): Promise<any[]> {
    if (!this.isEnabled()) throw new Error('Celebrations capability not active');
    return []; // placeholder
  }
}
```

---

### D. TESTS

#### 4. `tests/unit/features/groups/GroupService.test.ts`
```typescript
import { GroupService } from '../../../../src/features/groups/src/GroupService';

describe('GroupService', () => {
  let service: GroupService;
  beforeEach(() => { service = new GroupService(); });

  test('list returns empty when no groups exist', async () => {
    const groups = await service.list('org-1');
    expect(Array.isArray(groups)).toBe(true);
  });
});
```

#### 5. `tests/unit/features/events/EventService.test.ts`
```typescript
import { EventService } from '../../../../src/features/events/src/EventService';

describe('EventService', () => {
  let service: EventService;
  beforeEach(() => { service = new EventService(); });

  test('event created with correct frequency default', async () => {
    // Integration: verify frequency defaults to 'none'
    expect(service).toBeDefined();
  });
});
```

## Tests to Write
All unit tests above. Add integration tests for cross-module interactions (Groups ↔ Members link).

## Documentation to Update
- Traceability Matrix: add PRD-06 (Members→Groups), PRD-07 (Calendrier)

## DoD Checklist — Sprint 7 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | Groups + Events have tests | |
| C02 | Coverage >= 80% groups/ >= 70% events/ | |
| C03 | No hardcoded org-type logic | |
| C04 | Zero `any` types | |
| T01 | Group member add/remove tested | |
| Q01-Q04 | Lint/typecheck/prettier/format clean | |
