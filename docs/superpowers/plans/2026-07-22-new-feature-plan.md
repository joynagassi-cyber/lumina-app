# IMPLEMENTATION PLAN -- NEW-FEATURE

**Doc ID:** DOC-PLAN-NEW-FEATURE  
**Version:** 1.0  
**Statut:** PLAN  
**Creation Date:** 2026-07-22  
**Langue:** fr (descriptions) / en (IDs et codes)  
**Spec Reference:** DOC-SPEC-NEW-FEATURE (2026-07-22-new-feature-design.md)  
**Effort Total Estime:** 14 jours (2 développeurs en parallel)

---

## 1. RESUME EXECUTIF

Implémentation complète d'une nouvelle capability native TypeScript `new-feature` dans le Platform Core de Lumina v2. La feature couvre l'enregistrement, la persistance offline-first, l'API REST, les formulaires dynamiques, le workflow de transitions d'état, les permissions RBAC, et l'interface utilisateur via Expo Router.

**Principes directeurs:**
- Tests échouants en premier (TDD) -- aucune implémentation sans test qui echoue
- Tout passe par Platform Core -- pas de CRUD direct base de donnees
- Offline-first avec WatermelonDB -- pas de latence percue
- NeverBreak Rules jamais violées -- verification CI/CD automatique

**Dépendances externes avant démarrage:**
- AUCUNE -- toutes les dépendances sont internes au projet
- Les docs existantes (DOC-DATABASE-SCHEMA, DOC-OFFLINE-FIRST, etc.) servent de référence

---

## 2. DEPENDANCES TACHES ET PARALLELISATION

```
Task 1: Types        --> Task 2 (Model), Task 5 (Edge Funcs), Task 7 (Components)
Task 2: Model WMD    --> Task 3 (Migration DB)
Task 3: Migration DB --> Task 4 (Server DB Tables)
Task 4: Server DB    --> Task 5 (Edge Functions)
Task 5: Edge Funcs   --> Task 6 (API Adapter)
Task 6: API Adapter  --> Task 7 (UI Components)
Task 7: UI Components --> Task 8 (Navigation), Task 9 (Hooks + Sync)
Task 8: Navigation   --> Task 9 (Hooks + Sync)
Task 9: Hooks + Sync --> Task 10 (Integration Tests)
Task 10: Integration Tests --> DoD Check
```

**Parallelisation possible:**
- Tasks 1-3 peuvent être parallèles avec Tasks 4-5 (client vs serveur)
- Task 7 peut débuter dès que Task 1 (types) est valide, meme si Task 6 (API) n'est pas termine

---

## 3. DESCRIPTION DES TACHES

### TASK 1: Definition des Types TypeScript stricts

**Fichier cible:** `src/features/new-feature/types/new-feature.types.ts`

**Interface (consomme):**
- Aucune -- types definis depuis zero

**Interface (produit):**
```typescript
// Types exportés utilisables par toutes les autres tâches
export interface NewFeatureBase {
  id: string;
  orgId: string;
  title: string;
  description?: string;
  status: string;
  version: number;
  createdBy: string;
  metadata: Record<string, unknown>;
}

export interface NewFeatureListItem extends NewFeatureBase {
  createdAt: string;
  updatedAt: string;
  _synced: 0 | 1 | 2;
}

export interface NewFeatureDetail extends NewFeatureBase {
  createdAt: string;
  updatedAt: string;
}
```

**Code:** Fourni ci-dessus + type guards + factory functions.

**Tests faillants avant implémentation:**
```typescript
// tests/unit/new-feature-types.test.ts (initial -- echoue)
import { createNewFeature, isValidStatus } from '../../../src/features/new-feature/types/new-feature.types';

describe('NewFeature Types', () => {
  it('createNewFeature should construct a valid object', () => { ... });
  it('isValidStatus should return true for valid statuses', () => { ... });
  it('TypeScript should reject any types', () => { ... });
});
```

**Commandes:**
```bash
npx tsc --noEmit src/features/new-feature/types/new-feature.types.ts
cd tests && npm run test -- new-feature-types
```

**Critere d'acceptation:** Compilation TypeScript sans erreur, tests unitaires passent.

**Estimation:** 2h

---

### TASK 2: WatermelonDB Model + Adapter

**Fichiers cibles:**
- `src/models/NewFeatureModel.ts`
- `src/features/new-feature/adapters/new-feature-db-adapter.ts`

**Interface (consomme):**
- Task 1 types (`NewFeatureBase`, `NewFeatureListItem`)

**Interface (produit):**
```typescript
// src/models/NewFeatureModel.ts
import { Table, prop, column, Model } from '@nozbe/watermelondb/decorators';

@Table('new_features')
export class NewFeatureModel extends Model {
  @prop() id!: string;
  @column('synced') _synced!: 0 | 1 | 2;
  @column('created_at') createdAt!: string;
  @column('updated_at') updatedAt!: string;
  @column('org_id') orgId!: string;
  @column('title') title!: string;
  @column('description') description!: string | null;
  @column('status') status!: string;
  @column('version') version!: number;
  @column('created_by') createdBy!: string;
  @column('metadata') metadata!: string; // JSON string
}

// src/features/new-feature/adapters/new-feature-db-adapter.ts
import type { NewFeatureBase, NewFeatureListItem } from '../types/new-feature.types';
import type { NewFeatureModel } from '../../../../models/NewFeatureModel';

export function adaptServerToDB(server: NewFeatureBase): Partial<NewFeatureModel> {
  return { ...snakeCaseKeys(server), _synced: 1 };
}

export function adaptDBToServer(db: NewFeatureModel): NewFeatureBase {
  return camelCaseKeys(db.toPlain());
}
```

**Tests faillants avant implémentation:**
```typescript
// tests/unit/new-feature-db-adapter.test.ts (initial -- echoue)
import { adaptServerToDB, adaptDBToServer } from '../../../src/features/new-feature/adapters/new-feature-db-adapter';

describe('DB Adapter', () => {
  it('should convert server snake_case to DB camelCase', () => { ... });
  it('should set _synced=1 when adapting from server', () => { ... });
  it('should round-trip adapt correctly', () => { ... });
});
```

**Commandes:**
```bash
npm run test -- new-feature-db-adapter
```

**Critere d'acceptation:** Model conforme DOC-DATABASE-SCHEMA Section 2, adapters passent round-trip test.

**Estimation:** 3h

---

### TASK 3: WatermelonDB Migration

**Fichiers cibles:**
- `src/db/migrations.ts` (modification)

**Interface (consomme):**
- Task 2 WatermelonDB model

**Code migration:**
```typescript
// Modification de src/db/migrations.ts
export const MIGRATIONS = [
  // ... existing migrations ...
  {
    version: CURRENT_DB_VERSION + 1,
    up: async (db: any) => {
      await db.schema.createTableIfNotExists('new_features', (table: any) => {
        tableincrements().primary();
        // Colonnes correspondant au model
      });
      await db.schema.createIndex('idx_nf_org', ['org_id']);
      await db.schema.createIndex('idx_nf_status', ['status']);
      await db.schema.createIndex('idx_nf_synced', ['synced']);
    },
  },
];
```

**Tests faillants:**
```typescript
// tests/unit/new-feature-migration.test.ts
it('migration should create new_features table with correct schema', () => { ... });
```

**Commandes:**
```bash
npm run test -- new-feature-migration
```

**Critere d'acceptation:** Migration appliquee sans erreur, table cree avec tous indexes.

**Estimation:** 2h

---

### TASK 4: PostgreSQL Server Tables + RLS

**Fichiers cibles:**
- `src/server/migrations/YYYYMMDDHHmmss_create_new_features.sql`
- SQL contient CREATE TABLE, INDEXES, RLS POLICIES, CHECK constraints

**Interface (consomme):**
- Spec Section 2.4 (DDL complet)

**SQL fourni en entier:**
```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS new_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  metadata JSONB NOT NULL DEFAULT '{}',
  created_by UUID NOT NULL REFERENCES users(id),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nf_org ON new_features(org_id);
CREATE INDEX idx_nf_org_status ON new_features(org_id, status);
CREATE INDEX idx_nf_created_by ON new_features(created_by);

ALTER TABLE new_features ENABLE ROW LEVEL SECURITY;

CREATE POLICY nf_read_isolation ON new_features
  FOR SELECT USING (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY nf_create_isolation ON new_features
  FOR INSERT WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

CREATE POLICY nf_update_isolation ON new_features
  FOR UPDATE USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND version = EXCLUDED.version
  );

CREATE POLICY nf_delete_isolation ON new_features
  FOR DELETE USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.id = auth.uid()
      AND u.org_id = new_features.org_id
      AND u.role IN ('admin', 'superadmin')
    )
  );

-- Audit trail
CREATE TABLE IF NOT EXISTS new_feature_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_feature_id UUID REFERENCES new_features(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  old_values JSONB,
  new_values JSONB,
  changed_by UUID NOT NULL REFERENCES users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_nfal_feature ON new_feature_audit_logs(new_feature_id);
CREATE INDEX idx_nfal_changed_by ON new_feature_audit_logs(changed_by);
```

**Tests faillants:**
```typescript
// tests/unit/server-migration.test.ts
it('should create all tables and policies from migration SQL', () => { ... });
it('RLS policies should isolate orgs correctly', () => { ... });
```

**Commandes:**
```bash
npx pgcli -h localhost -U postgres -d lumina_v2 -f src/server/migrations/YYYYMMDDHHmmss_create_new_features.sql
npm run test -- server-migration
```

**Critere d'acceptation:** Migration appliquee sur base locale, toutes les politiques RLS生效.

**Estimation:** 3h

---

### TASK 5: Edge Functions InsForge (API Layer)

**Fichiers cibles:**
- `src/server/edge-functions/new-feature/index.ts`
- `src/server/edge-functions/new-feature/create.ts`
- `src/server/edge-functions/new-feature/update.ts`
- `src/server/edge-functions/new-feature/status.ts`
- `src/server/edge-functions/new-feature/delete.ts`
- `src/server/edge-functions/new-feature/list.ts`
- `src/server/edge-functions/new-feature/get.ts`

**Interface (consomme):**
- Task 4 (tables DB creees)
- Task 1 (types TypeScript)

**Interface (produit):**
```typescript
// src/server/edge-functions/new-feature/create.ts -- skeleton
import { defineEdgeFunction } from '@insforge/edge-functions';
import { validateCreateInput } from '../../validators/new-feature-validator';

export default defineEdgeFunction({
  method: 'POST',
  path: '/api/v1/new-feature',
  handler: async (request, context) => {
    // 1. Verify x-org-id header (NB-RULE-04)
    const orgId = request.headers.get('x-org-id');
    if (!orgId || !uuidRegex.test(orgId)) {
      return Response.json({ error: { code: 'INVALID_HEADER', message: 'Missing x-org-id' } }, { status: 400 });
    }

    // 2. Set session org context for RLS
    context.setAppContext('app.current_org_id', orgId);

    // 3. Validate input
    const body = await request.json();
    const validation = validateCreateInput(body);
    if (!validation.valid) {
      return Response.json({ error: { code: 'VALIDATION_ERROR', details: validation.errors } }, { status: 400 });
    }

    // 4. Insert via PostgreSQL client
    const result = await context.db.query(
      'INSERT INTO new_features (org_id, title, description, status, metadata, created_by, version) VALUES ($1, $2, $3, $4, $5, $6, 1) RETURNING *',
      [orgId, body.title, body.description, 'draft', JSON.stringify(body.metadata || {}), context.userId]
    );

    // 5. Log audit (INV-007)
    await logAudit(context.db, 'new_feature', result.id, 'CREATE', null, result);

    return Response.json({ item: result }, { status: 201 });
  },
});
```

**Tests faillants:**
```typescript
// tests/unit/server-edge-functions.test.ts
it('POST /api/v1/new-feature should reject missing x-org-id', () => { ... });
it('POST should validate input and return 400 on invalid data', () => { ... });
it('POST should insert into database and return created item', () => { ... });
it('PATCH /status should reject invalid state transition', () => { ... });
```

**Commandes:**
```bash
npm run test -- server-edge-functions
insforge deploy --env=local --test-only
```

**Critere d'acceptation:** Tous endpoints retournent les bons codes HTTP, RLS bloque requetes cross-org, validation fonctionne.

**Estimation:** 6h (7 fichiers edge functions)

---

### TASK 6: API Client + React Query Service

**Fichiers cibles:**
- `src/features/new-feature/services/new-feature-service.ts`
- `src/features/new-feature/adapters/new-feature-api-adapter.ts`

**Interface (consomme):**
- Task 5 (API endpoints operatifs)
- Task 2 (DB adapters)

**Interface (produit):**
```typescript
// src/features/new-feature/services/new-feature-service.ts
import { queryClient } from '../../../../src/core/network/react-query';
import { api } from '../../../../src/core/network/client';
import type { NewFeatureBase, NewFeatureListItem } from '../types/new-feature.types';
import { adaptServerToDB } from '../adapters/new-feature-db-adapter';

const QUERY_KEY = ['new-feature'];

export async function fetchNewFeatures(params?: { status?: string; search?: string }) {
  const response = await api.get<NewFeatureListItem[]>('/api/v1/new-feature', { params });
  return response.data.items;
}

export async function createNewFeature(data: { title: string; description?: string }) {
  const response = await api.post<{ item: NewFeatureBase }>('/api/v1/new-feature', data);
  // Invalidate cache
  await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  return response.data.item;
}

export async function updateNewFeature(id: string, data: Partial<NewFeatureBase>) {
  const response = await api.put<{ item: NewFeatureBase }>(`/api/v1/new-feature/${id}`, data);
  await queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, id] });
  return response.data.item;
}

export async function changeStatus(id: string, status: string, comment?: string) {
  const response = await api.patch<{ item: NewFeatureBase }>(`/api/v1/new-feature/${id}/status`, { status, comment });
  await queryClient.invalidateQueries({ queryKey: [...QUERY_KEY, id] });
  return response.data.item;
}

export async function deleteNewFeature(id: string) {
  await api.delete(`/api/v1/new-feature/${id}`);
  await queryClient.invalidateQueries({ queryKey: QUERY_KEY });
}
```

**Tests faillants:**
```typescript
// tests/unit/new-feature-service.test.ts
it('should fetch features with correct query params', () => { ... });
it('create should invalidate React Query cache after mutation', () => { ... });
it('changeStatus should call PATCH endpoint with correct payload', () => { ... });
```

**Commandes:**
```bash
npm run test -- new-feature-service
```

**Critere d'acceptation:** Service appelle endpoints correctement, cache React Query invalide apres mutations.

**Estimation:** 3h

---

### TASK 7: UI Components

**Fichiers cibles:**
- `src/features/new-feature/components/NewFeatureCard.tsx`
- `src/features/new-feature/components/NewFeatureList.tsx`
- `src/features/new-feature/components/NewFeatureDetail.tsx`
- `src/features/new-feature/components/NewFeatureCreateSheet.tsx`
- `src/features/new-feature/components/NewFeatureBadge.tsx`
- `src/shared/components/NewFeatureItem.tsx`

**Interface (consomme):**
- Task 1 (types)
- Task 6 (service hooks/data)
- Design System tokens (ADR-011, Dark Canvas theme)

**Code complet NewFeatureCard.tsx:**
```typescript
// src/features/new-feature/components/NewFeatureCard.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../../../src/core/theme/use-theme';
import { NewFeatureBadge } from './NewFeatureBadge';
import type { NewFeatureListItem } from '../types/new-feature.types';

interface Props {
  item: NewFeatureListItem;
  onPress: (id: string) => void;
}

export function NewFeatureCard({ item, onPress }: Props) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.colors.surface }]}
      onPress={() => onPress(item.id)}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.onSurface }]} numberOfLines={1}>
          {item.title}
        </Text>
        <NewFeatureBadge status={item.status} />
      </View>
      {item.description ? (
        <Text style={[styles.description, { color: theme.colors.onSurfaceVariant }]} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <Text style={[styles.timestamp, { color: theme.colors.onSurfaceVariant }]}>
        {new Date(item.updatedAt).toLocaleDateString()}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginHorizontal: 16, marginVertical: 4, borderRadius: 12 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 16, fontWeight: '600', flex: 1, marginRight: 8 },
  description: { fontSize: 14, marginTop: 4 },
  timestamp: { fontSize: 12, marginTop: 8, opacity: 0.7 },
});
```

**Etats tests pour chaque composant:**
- `NewFeatureCard`: loading (skeleton pulse 1500ms), empty, error, success, disabled
- `NewFeatureList`: empty state, populated, filtered, searched, paginated
- `NewFeatureCreateSheet`: validation errors, success, loading, dismiss
- `NewFeatureBadge`: chaque valeur d'enum status

**Tests faillants:**
```typescript
// tests/component/NewFeatureCard.test.tsx (initial -- echoue)
import { render, screen, act } from '@testing-library/react-native';
import { NewFeatureCard } from '../../../src/features/new-feature/components/NewFeatureCard';

it('renders title and badge', () => { ... });
it('shows skeleton while loading', () => { ... });
it('calls onPress with correct id', () => { ... });
```

**Commandes:**
```bash
npm run test -- NewFeatureCard --watchAll=false
npm run test -- NewFeatureList --watchAll=false
```

**Critere d'acceptation:** Composants affichent correct theme tokens, tous etats testes.

**Estimation:** 6h

---

### TASK 8: Navigation Routes (Expo Router v4)

**Fichiers cibles:**
- `navigation/main/new-feature/_layout.tsx`
- `navigation/main/new-feature/index.tsx`
- `navigation/main/new-feature/[id].tsx`
- `navigation/main/new-feature/create.tsx`

**Interface (consomme):**
- Task 7 (composants UI)

**Code `_layout.tsx`:**
```typescript
// navigation/main/new-feature/_layout.tsx
import { Stack } from 'expo-router';
import { useTheme } from '../../../src/core/theme/use-theme';

export default function NewFeatureLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: theme.colors.surfaceContainerHighest },
        headerTintColor: theme.colors.onSurface,
        contentStyle: { backgroundColor: theme.colors.surfaceContainerLowest },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'New Features' }} />
      <Stack.Screen name="[id]" options={{ presentation: 'modal', title: 'Detail' }} />
      <Stack.Screen name="create" options={{ presentation: 'modal', title: 'Create' }} />
    </Stack>
  );
}
```

**Code `index.tsx` (liste):**
```typescript
// navigation/main/new-feature/index.tsx
import { useRouter } from 'expo-router';
import { useNewFeatureList } from '../../../src/features/new-feature/hooks/useNewFeatureData';
import { NewFeatureList } from '../../../src/features/new-feature/components/NewFeatureList';

export default function NewFeatureScreen() {
  const router = useRouter();
  const { items, loading, error } = useNewFeatureList();

  return (
    <NewFeatureList
      items={items}
      loading={loading}
      error={error}
      onItemPress={(id) => router.push(`/main/new-feature/${id}`)}
      onCreatePress={() => router.push('/main/new-feature/create')}
    />
  );
}
```

**Tests faillants:**
```typescript
// tests/component/navigation-test.tsx
it('should navigate to detail screen on item press', () => { ... });
it('should open create bottom sheet on FAB press', () => { ... });
```

**Commandes:**
```bash
npx expo lint --fix
```

**Critere d'acceptation:** Routes naviguent correctement, Stack Navigator config conformement ADR-012.

**Estimation:** 3h

---

### TASK 9: React Hooks + WatermelonDB Sync Observer

**Fichiers cibles:**
- `src/features/new-feature/hooks/useNewFeatureData.ts`
- `src/features/new-feature/hooks/useNewFeatureLocal.ts`
- `src/core/sync/pipeline.ts` (modification -- ajouter new-feature collection au pipeline)

**Interface (consomme):**
- Task 2 (WatermelonDB model)
- Task 6 (service API)
- Task 8 (navigation routes)

**Code `useNewFeatureData.ts`:**
```typescript
// src/features/new-feature/hooks/useNewFeatureData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as service from '../services/new-feature-service';
import type { NewFeatureBase, NewFeatureListItem } from '../types/new-feature.types';

export function useNewFeatureList(params?: { status?: string; search?: string }) {
  return useQuery({
    queryKey: ['new-feature', params],
    queryFn: () => service.fetchNewFeatures(params),
  });
}

export function useCreateNewFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: service.createNewFeature,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['new-feature'] }),
  });
}

export function useUpdateNewFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<NewFeatureBase> }) =>
      service.updateNewFeature(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['new-feature'] }),
  });
}
```

**Code `useNewFeatureLocal.ts`:**
```typescript
// src/features/new-feature/hooks/useNewFeatureLocal.ts
import { useObservable } from '@nozbe/watermelondb/useObservable';
import { collection, prepareNewFeatureModel } from '../../../../src/models/NewFeatureModel';

export function useNewFeatureLocal(orgId: string) {
  const featuresCollection = collection('new_features');
  const featuresQuery = featuresCollection.where('org_id', orgId);
  const features$ = featuresQuery.observe();
  const observable = useObservable(features$);

  return { features: observable?.map(prepareNewFeatureModel) ?? [], refresh };
}
```

**Tests faillants:**
```typescript
// tests/unit/new-feature-hooks.test.tsx
it('useNewFeatureList should fetch and cache data', () => { ... });
it('useCreateNewFeature should invalidate list cache after mutation', () => { ... });
it('useNewFeatureLocal should observe WatermelonDB changes', () => { ... });
```

**Commandes:**
```bash
npm run test -- new-feature-hooks
```

**Critere d'acceptation:** Hooks retournent donnees correctement, observables WatermelonDB observent changements en temps reel.

**Estimation:** 4h

---

### TASK 10: Integration & E2E Tests + DoD

**Fichiers cibles:**
- `tests/integration/new-feature-flow.test.ts`
- `tests/integration/new-feature-sync.test.ts`
- `tests/integration/new-feature-rbac.test.ts`
- `tests/integration/new-feature-multitenant.test.ts`
- `tests/flows/new_feature_flow_test.ts`

**Interface (consomme):**
- Toutes les tasks precedentes (1-9)

**Interface (produit):**
- Suite de tests integration couvrant flows complets
- Verification DoD checklist (C01-C05, T01-T04, D01-D04, Q01-Q04)

**Test flow integration (exemple complet):**
```typescript
// tests/integration/new-feature-flow.test.ts
import { createNewFeature, changeStatus, updateNewFeature } from '../../src/features/new-feature/services/new-feature-service';
import { validateStatusTransition } from '../../src/features/new-feature/services/new-feature-validator';

describe('New Feature Integration Flow', () => {
  beforeEach(async () => { setupTestOrgAndUser(); });

  it('full lifecycle: create -> update -> status change -> delete', async () => {
    // 1. Create
    const created = await createNewFeature({ title: 'Test Item', description: 'A test' });
    expect(created.id).toBeDefined();
    expect(created.status).toBe('draft');

    // 2. Update
    const updated = await updateNewFeature(created.id, { title: 'Updated Title' });
    expect(updated.title).toBe('Updated Title');
    expect(updated.version).toBe(2);

    // 3. Status transition
    expect(validateStatusTransition('draft', 'pending')).toBe(true);
    const statusChanged = await changeStatus(created.id, 'pending', 'Ready for review');
    expect(statusChanged.status).toBe('pending');

    // 4. Invalid transition blocked
    expect(validateStatusTransition('approved', 'draft')).toBe(false);

    // 5. Delete requires admin
    // (test en RBAC separat)
  });

  it('should handle offline-first: create locally then sync', async () => {
    // Simulate offline create
    const localId = await createLocally({ title: 'Offline Item' });
    expect(localId._synced).toBe(0);

    // Simulate network back online
    await syncPendingOperations();
    const synced = await findItem(localId.id);
    expect(synced._synced).toBe(1);
  });
});
```

**DoD Checklist execution:**
```bash
# C01-C05: Code Quality
npm run test -- --coverage src/features/new-feature/
# Verifier >80% coverage

# C03: NeverBreak check
grep -r "if (type === 'church')" src/features/new-feature/
# Should return nothing

# C04: No 'any' types
npm run lint src/features/new-feature/

# Q01-Q03: Formatting and type checks
npm run format
npm run lint
tsc --noEmit

# D01: Documentation updated
# Verify docs/01-platform-core/capability-engine/index.md mentions new-feature
# Verify docs/05-api-contracts/api-contracts.md has new-feature endpoints
```

**Critere d'acceptation:**
- Tous tests integration passent
- DoD checklist complete -- tous checks vert
- Coverage > 80% sur module new-feature
- Aucun warning TypeScript
- Lint sans erreur

**Estimation:** 4h

---

## 4. RESUME EFFORTS

| Tâche | Fichiers | Estim. | Parallelelisable |
|-------|----------|--------|-----------------|
| 1. Types | `types/new-feature.types.ts` | 2h | Oui (base) |
| 2. Model WMD + Adapter | `models/NewFeatureModel.ts`, `adapters/new-feature-db-adapter.ts` | 3h | Avec Task 4 |
| 3. Migration WMD | `db/migrations.ts` | 2h | Avec Task 1-2 |
| 4. Server DB + RLS | `server/migrations/*.sql` | 3h | Avec Task 2 |
| 5. Edge Functions | `server/edge-functions/new-feature/*` (7 fichiers) | 6h | Avec Task 4 |
| 6. API Service + Adapter | `services/new-feature-service.ts`, `adapters/new-feature-api-adapter.ts` | 3h | Apres Task 5 |
| 7. UI Components | `components/*` (6 fichiers) | 6h | Apres Task 1 (types) |
| 8. Navigation | `navigation/main/new-feature/*` (4 fichiers) | 3h | Apres Task 7 |
| 9. Hooks + Sync | `hooks/*`, `core/sync/pipeline.ts` | 4h | Apres Task 6-8 |
| 10. Integration + DoD | `tests/integration/*`, `tests/flows/*` | 4h | Apres tout |
| **TOTAL** | | **36h** | |

**Pour 2 développeurs:**
- Dev A: Tasks 1, 2, 3, 5, 6, 9 (Client + Server)
- Dev B: Tasks 4, 7, 8, 10 (DB Server + UI + Tests)
- Timeline reelle estimee: ~5 jours (parallelisation efficace)

---

## 5. ORDRE D EXECUTION

```bash
# Jour 1: Foundation
npm run test -- new-feature-types       # Task 1
npm run test -- new-feature-db-adapter  # Task 2
npx pgcli -f src/server/migrations/...  # Task 4

# Jour 2: API Layer
npm run test -- server-edge-functions   # Task 5
npm run test -- new-feature-service     # Task 6

# Jour 3: UI + Navigation
npm run test -- NewFeatureCard          # Task 7
npm run test -- navigation              # Task 8

# Jour 4: Integration + Sync
npm run test -- new-feature-hooks       # Task 9
npm run test -- new-feature-flow        # Task 10

# Jour 5: Finalisation + DoD
npm run test -- --coverage              # Verify >80%
npm run format && npm run lint && tsc --noEmit  # Q01-Q03
git commit -m "feat: add new-feature capability"
```

---

**Fin du plan d'implementation.**

Chaque tâche doit suivre la rule "failing test first": ecrire le test avant le code implémenté. Le test doit echouer clairement avant implementation, puis passer apres.
