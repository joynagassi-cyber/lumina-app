# SPECIFICATION TECHNIQUE -- NEW-FEATURE

**Doc ID:** DOC-SPEC-NEW-FEATURE  
**Version:** 1.0  
**Statut:** SPECIFICATION  
**Creation Date:** 2026-07-22  
**Langue:** fr (descriptions) / en (IDs et codes)  
**Dependances:** ADR-001, ADR-003, ADR-004, ADR-005, ADR-006, ADR-013, ADR-014, DOC-INvariants, DOC-NEVERBREAK, DOC-API-CONTRACTS, DOC-OFFLINE-FIRST, DOC-DATABASE-SCHEMA, DOC-TESTING, DOC-BUSINESS-RULES-FINANCE, DOC-BUSINESS-RULES-MEMBERS, DOC-DEPENDENCY-CONTRACT

---

## 1. SCOPE FONCTIONNEL

### 1.1 Ce que la feature FAIT (User Stories avec Acceptance Criteria)

La feature "new-feature" est une **nouvelle capability native TypeScript** du Platform Core. Elle doit respecter l'arbre de decision (DOC-DECISION-TREES, Section 1) : si une nouvelle fonctionnalite ne peut pas etre configuree via Manifest/Vocabulary/Forms/Workflow, elle DOIT etre implementee comme capability.

**US-001: Registration de la capability**  
L'administrateur peut enregistrer "new-feature" dans le Capability Engine.  
**AC-001:** `capability-engine.isCapabilityActive('new-feature')` retourne `true` apres registration.  
**AC-002:** La capability apparait dans `capability-engine.listCapabilities()` avec statut `active`.  
**AC-003:** Le manifest de l'org peut activer/desactiver la feature via `feature_toggles.new_feature.enabled: true`.  
**Ref:** ADR-001 (Section 3 -- tout moteur supplementaire = capability native TypeScript), ENG-CAPABILITY (DOC-PLATFORM-CAPABILITY)

**US-002: Affichage UI via Forms Engine**  
L'interface de la feature est generee dynamiquement, jamais en dur.  
**AC-001:** Aucun composant JSX de formulaire n'est code manuellement pour cette feature.  
**AC-002:** Un fichier de definition YAML charge par `forms-engine.loadForm('new-feature-form')` rend tous les champs.  
**AC-003:** Les labels viennent du Vocabulary Engine (`vocabulary-engine.translate('new-feature:field_name', 'fr')`).  
**AC-004:** Validation client et serveur via `forms-engine.validateFormData(schema, payload)` et edge function InsForge.  
**Ref:** INV-009 (Formulaire = JSON -> UI), DOC-PLATFORM-FORMS, NB-RULE-01 (max 400 lignes par doc)

**US-003: Workflow de la feature**  
Toute transition d'etat passe par le Workflow Engine.  
**AC-001:** Les etapes du workflow sont definies en YAML/JSON, pas en code TypeScript.  
**AC-002:** Chaque etape a un `step_type` valide: `auto`, `approval`, `notification`, `conditional`, `delay`, `parallel`.  
**AC-003:** Timeout max 30 jours, escalade obligatoire (DOC-PLATFORM-WORKFLOW).  
**AC-004:** Approval chain max 5 niveaux.  
**Ref:** ADR-007 (K1 features), ENG-WORKFLOW (DOC-PLATFORM-WORKFLOW), INV-007 (Audit Trail)

**US-004: Persistance WatermelonDB + Sync**  
Les donnees persistees en local via WatermelonDB, sync async vers InsForge.  
**AC-001:** ModelWatermelonDB avec colonnes obligatoires: `id`, `_synced` (0=pending, 1=synced, 2=conflict), `createdAt`, `updatedAt`.  
**AC-002:** `_synced=0` indique operation non synchronisee (en file d'attente).  
**AC-003:** Operation enfilee dans `pending_operations` table avant push au serveur.  
**AC-004:** Reponse serveur confirme: `pending_operations.syncStatus` passe a `confirmed`.  
**Ref:** DOC-OFFLINE-FIRST (Section 4), DOC-DATABASE-SCHEMA (Section 2), NB-RULE-06 (Sync Offline First)

**US-005: Persistance serveur InsForge/PostgreSQL**  
Cote serveur, chaque entite a une table avec org_id, RLS, indexes.  
**AC-001:** Table SQL avec `id UUID PK`, `org_id UUID FK NOT NULL`, indexes composites sur `(org_id, ...)`.  
**AC-002:** RLS enabled avec policy `org_isolation` utilisant `current_setting('app.current_org_id')`.  
**AC-003:** Edge function pour validation metier cote serveur (INV-008: double validation).  
**Ref:** DOC-08-BACKEND-GUIDE, ADR-006 (Multi-Tenant), API-CONTRACTS (Section 3)

**US-006: Permissions RBAC**  
L'acces a la feature respecte le systeme de roles/permissions.  
**AC-001:** Permission requise declaree dans manifest: `new_feature.write` (exemple).  
**AC-002:** `manifest-engine.hasPermission(userId, 'new_feature:write')` bloque si permission absente.  
**AC-003:** Middleware InsForge rejette requete sans header `x-org-id` (NB-RULE-04).  
**Ref:** ADR-009 (Admin-Only Auth), DOC-PLATFORM-MANIFEST (Permissions composees)

### 1.2 Ce que la feature NE FAIT PAS (Out of Scope)

| Element | Raison | Reference |
|---------|--------|-----------|
| CRUD direct base de donnees | Doit passer par Platform Core | DOC-DEPENDENCY-CONTRACT (Module Metier != Database direct) |
| Formulaire code en dur JSX/TSX | Doit passer par Forms Engine | INV-009 |
| Enum/values en dur | Doivent venir du Vocab Engine | INV-006 |
| GraphQL | API REST uniquement | ADR-015 |
| Dependance circulaire avec Forms/Workflow | Moteurs independants | DOC-DEPENDENCY-CONTRACT (Section 3) |
| Hardcoded business logic | Tout passe par manifest/workflow | INV-005, INV-002 |
| URLs d'API en dur | Config singleton seul | NB-RULE-10 |
| Type `any` TypeScript | Strict typing requis | NB-RULE-07 |
| Couleurs non conformes Dark Canvas | Design System impose | ADR-011 |

---

## 2. IMPACT TECHNIQUE PRECIS

### 2.1 Modules Affectes (ref: Development-Handbook.md, Section 3.1)

| Module | Impact | Type |
|--------|--------|------|
| **Capability Engine** | Enregistrement nouvelle capability | Modification |
| **Manifest Engine** | Toggle feature + permissions | Configuration |
| **Vocabulary Engine** | Termes/metadonnees pour i18n | Ajout termes |
| **Forms Engine** | Definition formulaire YAML | Nouvelle config |
| **Workflow Engine** | Workflow etats/transitions | Nouvelle config |
| **Sync Engine** | Model WatermelonDB + migration | Nouvelle table |
| **Network** | Endpoints API pour nouvelle feature | Nouvelles routes |
| **Finance** | SI feature impacte finance | Affecte si regles financieres |
| **Dashboard** | KPIs ou widgets nouveaux | Optionnel |

### 2.2 Fichiers EXACTS a CREER

#### Core Engine Registration

```
src/core/capability/new-feature.ts          # Registration capability native TypeScript
src/core/vocabulary/namespaces/new-feature.yaml  # Termes i18n pour la feature
```

#### Feature Implementation

```
src/features/new-feature/
  index.ts                                  # Barrel export
  hooks/
    useNewFeatureData.ts                     # React Query hook pour server state
    useNewFeatureLocal.ts                    # WatermelonDB observer hook
  services/
    new-feature-service.ts                   # Service metier (aucun CRUD direct)
    new-feature-validator.ts                 # Validation client (reproduite serveur)
    new-feature-form-schema.ts               # Schema JSON pour Forms Engine
  adapters/
    new-feature-api-adapter.ts               # Convertisseur response InsForge -> model local
    new-feature-db-adapter.ts                # Convertisseur model -> WatermelonDB write
  components/
    NewFeatureCard.tsx                       # Composant presentation (reused)
    NewFeatureList.tsx                       # Liste des items
    NewFeatureDetail.tsx                     # Detail item push navigation
    NewFeatureCreateSheet.tsx                # Bottom sheet creation (formulaire Forms Engine)
    NewFeatureApprovalFlow.tsx               # Workflow approval (si applicable)
  types/
    new-feature.types.ts                     # Types TypeScript stricts (aucun 'any')
  constants/
    new-feature.constants.ts                 # Status enums, transitions (via Vocab Engine)
```

#### Navigation (Expo Router v4 -- ADR-012)

```
navigation/main/new-feature/
  _layout.tsx                               # Stack layout pour detail screens
  index.tsx                                 # Route: /main/new-feature (liste)
  [id].tsx                                  # Route: /main/new-feature/:id (detail)
  create.tsx                                # Route: /main/new-feature/create (bottom sheet)
```

#### Shared Components (SI nouveaux composants specifiques)

```
src/shared/components/
  NewFeatureItem.tsx                        # Item reused dans listes
  NewFeatureBadge.tsx                       # Badge status (via Vocab Engine labels)
  NewFeatureIcon.tsx                        # Icon lucide-react-native wrapper
```

#### Data Layer

```
src/models/
  NewFeatureModel.ts                        # WatermelonDB model avec @prop/@column
  NewFeatureOperation.ts                    # Pending operation spec
src/db/
  migrations.ts                             # Migration ajoutee (version+1)
```

#### Tests

```
tests/unit/
  new-feature-service.test.ts               # Tests service metier
  new-feature-validator.test.ts             # Tests validation client
  new-feature-form-schema.test.ts           # Tests schema JSON
  new-feature-api-adapter.test.ts           # Tests adaptation API->model
tests/component/
  NewFeatureCard.test.tsx                   # Etats: loading, empty, error, success, disabled, i18n FR/EN
  NewFeatureList.test.tsx                   # Render + interaction
  NewFeatureCreateSheet.test.tsx            # Submit flow
tests/integration/
  new-feature-flow.test.ts                  # Create -> workflow -> final state
tests/flows/
  new_feature_flow_test.ts                  # E2E user flow complet
```

### 2.3 Fichiers EXISTANTS a MODIFIER

| Fichier | Section a modifier | Changement |
|---------|-------------------|------------|
| `src/core/capability/index.ts` | Registry | Ajouter `registerCapability({ id: 'new-feature', name: '...' })` |
| `src/store/AppContext.tsx` | Permissions | Ajouter `new-feature:*` dans type permissions |
| `src/navigation/_layout.tsx` | Routes | Ajouter route `/main/new-feature` dans tab/navigation |
| `src/core/vocabulary/index.ts` | Namespaces | Import namespace `new-feature` |
| `src/core/network/client.ts` | API base URL | SI nouvelles routesInsForge |
| `src/db/migrations.ts` | Version N+1 | Ajouter migration WatermelonDB pour nouvelle table |
| `docs/01-platform-core/capability-engine/index.md` | Registry | Documenter nouvelle capability |
| `docs/05-api-contracts/api-contracts.md` | Endpoints | Ajouter nouveaux endpoints |
| `docs/09-testing-strategy/Testing-Strategy.md` | Matrice | Ajouter ligne new-feature dans matrice couverture |
| `docs/00-architecture/Traceability-Matrix.md` | Lignes PRD | Ajouter PRD pour nouvelle feature |
| `.claude/skills/` (SI custom) | Triggers | Ajouter trigger pour feature |

### 2.4 Tables DB Necessaires

#### Client (WatermelonDB/SQLite)

**Table: `new_features`**

| Colonne | Type Decorator | Description | Index |
|---------|---------------|-------------|-------|
| `id` | `@prop()` | PK auto-genere | PK |
| `_synced` | `@column('synced', 0)` | 0=pending, 1=synced, 2=conflict | `idx_nf_synced` |
| `createdAt` | `@column('created_at')` | Timestamp UTC | -- |
| `updatedAt` | `@column('updated_at')` | Timestamp UTC | -- |
| `orgId` | `@column('org_id')` | FK organizations | `idx_nf_org` |
| `title` | `@column('title')` | Titre/intitulé | -- |
| `description` | `@column('description')` | Nullable | -- |
| `status` | `@column('status')` | Enum workflow state | `idx_nf_status` |
| `version` | `@column('version', 1)` | Optimistic lock | -- |
| `createdBy` | `@column('created_by')` | User UUID | -- |
| `data` | `@column('data')` | JSON string (flexible) | -- |

Index SQLite:
```sql
CREATE INDEX idx_new_features_org ON new_features(org_id);
CREATE INDEX idx_new_features_status ON new_features(status);
CREATE INDEX idx_new_features_synced ON new_features(synced);
CREATE INDEX idx_new_features_org_status ON new_features(org_id, status);
```

#### Serveur (PostgreSQL/InsForge)

**Table: `new_features`**

| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| `id` | UUID | PK DEFAULT gen_random_uuid() | Identifiant unique |
| `org_id` | UUID | NOT NULL FK organizations CASCADE | Multi-tenant isolation |
| `title` | TEXT | NOT NULL | Titre/intitulé |
| `description` | TEXT | | Nullable |
| `status` | TEXT | CHECK IN (...) | Workflow states |
| `metadata` | JSONB | DEFAULT '{}' | Données flexibles |
| `created_by` | UUID | FK users | Créateur |
| `version` | INTEGER | DEFAULT 1 | Optimistic locking |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | Timestamp creation |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | Timestamp update |

Indexes:
```sql
CREATE INDEX idx_nf_org ON new_features(org_id);
CREATE INDEX idx_nf_org_status ON new_features(org_id, status);
ALTER TABLE new_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY nf_org_isolation ON new_features
  USING (org_id = current_setting('app.current_org_id')::uuid);
```

### 2.5 APIs REST Requises

| Methode | Chemin | Auth Required | Headers | Body Request | Reponse | Error Codes |
|---------|--------|--------------|---------|-------------|---------|-------------|
| GET | `/api/v1/new-feature` | Non* | `x-org-id: <uuid>` | Query: `{ page?, limit?, status?, search? }` | `{ items: NewFeature[], total: number }` | 400 (validation) |
| POST | `/api/v1/new-feature` | Oui | `Authorization Bearer`, `x-org-id: <uuid>` | `{ title, description?, data? }` | `{ item: NewFeature }` | 400, 401, 403 |
| GET | `/api/v1/new-feature/:id` | Non* | `x-org-id: <uuid>` | -- | `{ item: NewFeature }` | 404 |
| PUT | `/api/v1/new-feature/:id` | Oui | `Authorization Bearer`, `x-org-id: <uuid>` | `{ title?, description?, data?, version? }` | `{ item: NewFeature }` | 400, 403, 409 (conflit version) |
| PATCH | `/api/v1/new-feature/:id/status` | Oui | `Authorization Bearer`, `x-org-id: <uuid>` | `{ status, comment? }` | `{ item: NewFeature }` | 400 (transition invalide), 403 |
| DELETE | `/api/v1/new-feature/:id` | Oui (admin) | `Authorization Bearer`, `x-org-id: <uuid>` | -- | `{ success: true }` | 403, 409 (conflit sync) |

* GET endpoints: `x-org-id` necessaire mais pas d'authentification pour lectures publiques (SI feature publique).

**Reponse erreur standardisee (API-CONTRACTS Section 3):**
```typescript
{
  error: {
    code: 'STATUS_INVALID_TRANSITION',
    message: 'Cannot transition from draft to approved directly',
    details: { field: 'status', allowed: ['draft', 'pending'] },
    timestamp: '2026-07-22T10:00:00Z'
  }
}
```

### 2.6 Screens Expo Router (ADR-012)

| Route Expo Router | Compose | Description |
|------------------|---------|-------------|
| `/main/new-feature` | `NewFeatureList` | Liste paginee avec filtres |
| `/main/new-feature/[id]` | `NewFeatureDetail` | Vue detail avec actions |
| `/main/new-feature/create` | `NewFeatureCreateSheet` | Bottom sheet (modal fullscreen) |
| `/main/new-feature/[id]/edit` | `NewFeatureEditSheet` | Bottom sheet edition |
| `/main/new-feature/[id]/approve` | `NewFeatureApprovalFlow` | Workflow approval chain |
| `/feature/new-feature/:id` | Deep link handler | Universal deep link |

**Layout:**
```
navigation/main/new-feature/
  _layout.tsx    # Stack Navigator (push detail screens)
  index.tsx      # Route /main/new-feature
  [id].tsx       # Route /main/new-feature/:id
  create.tsx     # Route /main/new-feature/create
```

---

## 3. CONTRAINTES DE SECURITE

### 3.1 Authentification Requise

| Endpoint | JWT Required | x-org-id Header | RBAC Check |
|----------|-------------|-----------------|------------|
| GET /list | Non* | Oui | -- |
| POST create | Oui | Oui | `new-feature:create` |
| GET :id | Non* | Oui | -- |
| PUT :id | Oui | Oui | `new-feature:update` |
| PATCH :id/status | Oui | Oui | `new-feature:status-change` |
| DELETE :id | Oui | Oui | `new-feature:delete` (admin only) |

*\* Lectures publiques selon configuration manifest.*

**Token handling (ADR-005, ADR-009):**
- JWT HS256, expire configurable via `EXPO_PUBLIC_API_TIMEOUT_MS` (.env.local)
- Refresh token stocke dans `user_sessions.refresh_token` (chiffre)
- Token injecte automatiquement par `src/core/network/client.ts` middleware
- Requete sans token valide retourne 401 -> redirect vers login

### 3.2 RLS Policies (Multi-Tenant Isolation -- ADR-006, INV-004)

```sql
-- Policy: lecture isolee par org
CREATE POLICY nf_read_isolation ON new_features
  FOR SELECT
  USING (org_id = current_setting('app.current_org_id')::uuid);

-- Policy: creation isolee par org
CREATE POLICY nf_create_isolation ON new_features
  FOR INSERT
  WITH CHECK (org_id = current_setting('app.current_org_id')::uuid);

-- Policy: mise a jour isolee + version check
CREATE POLICY nf_update_isolation ON new_features
  FOR UPDATE
  USING (org_id = current_setting('app.current_org_id')::uuid AND version = EXCLUDED.version);

-- Policy: suppression isolee (admin seulement)
CREATE POLICY nf_delete_isolation ON new_features
  FOR DELETE
  USING (
    org_id = current_setting('app.current_org_id')::uuid
    AND EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.org_id = new_features.org_id
      AND users.role IN ('admin', 'superadmin')
    )
  );
```

**Verification (NB-RULE-04 + INV-004):**
- Middleware InsForge injecte `app.current_org_id` depuis header `x-org-id`
- Toute requete sans header valide retourne 400
- RLS est le dernier rempart (meme si middleware est bypass)
- Tests d'isolation obligatoires pour chaque endpoint (DOC-TESTING Section 2.3)

### 3.3 Matrice RBAC (Roles/Permissions)

| Permission | Admin | Treasurer | Staff | Member | Custom Role |
|-----------|-------|-----------|-------|--------|-------------|
| `new-feature:create` | X | X | X | | Via manifest |
| `new-feature:update` | X | X | X | | Via manifest |
| `new-feature:delete` | X | | | | Via manifest |
| `new-feature:status-change` | X | X | Via workflow | | Workflow config |
| `new-feature:read` | X | X | X | X | Via manifest |

**Configuration dans manifest (DOC-PLATFORM-MANIFEST):**
```yaml
roles:
  admin:
    permissions:
      - "new-feature:*"
  treasurer:
    permissions:
      - "new-feature:create"
      - "new-feature:update"
      - "new-feature:status-change"
```

### 3.4 Donnees Sensibles et Traitement

| Type de donnee | Traitement | Stockage local | Stockage serveur |
|---------------|-----------|----------------|------------------|
| `title` | Texte brut | SQLite text | PostgreSQL TEXT |
| `description` | Texte brut (sanitize) | SQLite text | PostgreSQL TEXT |
| `metadata` (JSON) | Validate schema | SQLite JSON string | PostgreSQL JSONB |
| `photoUrl` (SI present) | URL uniquement | Chemin local S3 | S3 bucket `documents` |
| `email` (SI present) | PII -- chiffree | Non stockee locale | Stockee, hash si possible |
| `createdBy` | UUID utilisateur | UUID | UUID FK |

**Regles de traitement:**
- Aucune donnée personnelle sensible stockee en clair sans chiffrement
- Emails: hashes cote serveur pour recherche, jamais exposes dans logs
- Logs d'audit: INV-007 -- chaque action public journalisee (qui, quoi, quand, old_value, new_value)
- Conservation logs minimum 7 ans (BR-FIN-031, SI feature finance)

---

## 4. OFFLINE-FIRST STRATEGY

### 4.1 Data a Sync (WatermelonDB Collections)

| Collection | Sync Strategy | Conflict Resolution | `_synced` default |
|-----------|--------------|-------------------|------------------|
| `new_features` | Delta sync (push + pull) | Optimistic locking (version column) | 0 (pending) |
| `new_feature_ops` (pending) | Push queue | FIFO order, confirmed via server ack | 1 (always synced) |

**Model WatermelonDB (reference: DOC-DATABASE-SCHEMA Section 2):**
```typescript
import { Table, props, column } from '@nozbe/watermelondb/decorators'

@Table('new_features')
export class NewFeature extends Model {
  id        = prop()
  _synced   = column('synced', 0)
  createdAt = column('created_at')
  updatedAt = column('updated_at')

  orgId      = column('org_id')
  title      = column('title')
  description = column('description')
  status     = column('status')
  version    = column('version', 1)
  createdBy  = column('created_by')
  metadata   = column('metadata')
}
```

**Relations enfant (SI hiérarchie nécessaire -- ADR-014):**
```typescript
// Dans le model parent:
children = relation(this, 'NewFeatureChildren')
// Dans le model enfant:
parent = relation(this, 'new_feature_id')
```

### 4.2 Strategie de Resolution de Conflits

| Scenario | Strategie | Reference |
|----------|-----------|-----------|
| Deux appareils modifient le meme item en offline | Optimistic Locking (champ `version`) | DOC-OFFLINE-FIRST Section 3.3 |
| Conflit detecte | `_synced=2` (conflict), ecран review utilisateur | DOC-OFFLINE-FIRST Section 3.3 |
| Données status workflow | Server-wins pour status (authorite finale) | DOC-OFFLINE-FIRST Section 3.2 |
| Metadata JSONB | Merge profond (clé par clé, server wins sur conflit) | DOC-OFFLINE-FIRST Section 3.1 |

**Règle critique (INV-003):** L'utilisateur ne subit JAMAIS de latence réseau. Toute opération est d'abord locale, puis sync async.

### 4.3 Cache Invalidation

| Evenement | Action Cache | Method |
|-----------|-------------|--------|
| Mutation locale (create/update/delete) | Invalidate React Query cache pour la route | `queryClient.invalidateQueries(['new-feature'])` |
| Confirmation sync serveur | Mark `_synced=1`, remove from pending_ops | WatermelonDB `afterCreate` hook |
| Conflit detecte | Mark `_synced=2`, show conflict screen | Sync engine error callback |
| Logout utilisateur | Clear ALL local cache for user's orgId | `queryClient.clear()` |
| Manifest change (toggle feature off) | Purge local data, show banner | Manifest event listener |

**Invalidation pattern (React Query -- ADR-013):**
```typescript
// Service layer:
await queryClient.invalidateQueries({ queryKey: ['new-feature', orgId] })
await db.write(async () => {
  await collection.create(doc => { ... })
})
```

### 4.4 Sync Pipeline (DOC-OFFLINE-FIRST Section 4)

```
1. Connectivity detected (NetInfo)
   |
2. Push local pending operations
   POST /api/operations/sync
   Body: { operations: [{ resourceType, resourceId, action, payload, timestampClient }] }
   |
3. Pull remote deltas
   GET /api/operations/sync?since=<lastSyncTimestamp>
   Response: { changes: [...], conflicts: [...] }
   |
4. Apply remote to WatermelonDB
   db.write(() => collection.update(...))
   |
5. Resolve conflicts
   If conflict: mark _synced=2, trigger conflict review UI
   |
6. Cleanup confirmed operations
   DELETE /api/operations/<id> + local delete
```

---

## 5. TEST STRATEGY PRECISE

### 5.1 Unit Tests (Jest + React Native Testing Library)

Couverture cible: >80% (comme Members/Groups dans DOC-TESTING Section 1).

| Fichier Test | Functions Testees | Assertions Clés |
|-------------|------------------|-----------------|
| `tests/unit/new-feature-service.test.ts` | `create()`, `update()`, `delete()`, `changeStatus()` | AC: create returns persisted object with correct orgId. AC: update applies optimistic lock. AC: delete requires admin permission. |
| `tests/unit/new-feature-validator.test.ts` | `validateCreateInput()`, `validateUpdateInput()`, `validateStatusTransition()` | AC: reject missing required fields. AC: reject invalid status transitions (per workflow YAML). AC: allow all valid transitions. |
| `tests/unit/new-feature-form-schema.test.ts` | `getVisibleFields(role)`, `validateFormData(formData)` | AC: conditional fields show/hide per capability flags. AC: i18n labels resolved from vocabulary. |
| `tests/unit/new-feature-api-adapter.test.ts` | `adaptServerToDB()`, `adaptDBToServer()` | AC: camelCase <-> snake_case mapping correct. AC: amount stored as cents/fractions if financial. |
| `tests/unit/new-feature-workflow.test.ts` | `canTransition(from, to)`, `getAllowedTransitions(status)` | AC: return all valid transitions from given status. AC: block invalid transitions with error code. |

**Invariant tests obligatoires (DOC-TESTING Section 3):**

| Invariant | Test | Count min |
|-----------|------|-----------|
| INV-001 (SI finance) | Tenter de modifier donnee financiere validated | 3 |
| INV-004 | Deux orgs meme donnee, verifier isolation | 3 |
| INV-006 | Enums viennent du vocab engine | 2 |
| INV-007 | Loguer action, verifier immutabilite log | 2 |
| INV-008 | Envoyer donnee invalide client->server, voir rejection | 2 |
| INV-010 | Modifier champ versionne, ancienne version conservee | 2 |

### 5.2 Component Tests

| Composant | Etats tests | Refrence Design |
|-----------|------------|----------------|
| `NewFeatureCard` | loading (skeleton 1500ms pulse), empty, error (retry), success, disabled | ADR-011 (Dark Canvas), DESIGN.md |
| `NewFeatureList` | empty state, populated, filtered, searched, paginated | `members.html` prototype pattern |
| `NewFeatureCreateSheet` | form validation errors, form success, form loading, dismiss | Forms Engine output |
| `NewFeatureBadge` | each status enum value | Vocab Engine labels |
| `NewFeatureDetail` | owned by user, not owned, editing mode, readonly | `ledger.html` pattern |

**Règle (DOC-TESTING Section 2.2):** Chaque composant testé dans TOUS ses états principaux: loading, empty, error, success, disabled, i18n FR + EN.

### 5.3 Integration Tests

| Test Suite | Modules Impliqués | Flow Testé |
|-----------|------------------|------------|
| `tests/integration/new-feature-flow.test.ts` | New Feature + Forms Engine + Workflow Engine + Vocabulary | Create item via Forms Engine form -> validate -> save locally -> status transition via workflow |
| `tests/integration/new-feature-sync.test.ts` | New Feature + Sync Engine + Network | Create offline -> go online -> verify push -> verify pull -> verify conflict resolution |
| `tests/integration/new-feature-rbac.test.ts` | New Feature + Capability Engine + Auth | User without permission tries create -> rejected. User with permission creates -> succeeds. |
| `tests/integration/new-feature-multitenant.test.ts` | New Feature + Sync + RLS simulation | Org A creates -> Org B cannot see -> Org A cannot modify Org B data |

### 5.4 E2E Flows (Playwright/Capacitor)

Fichier: `tests/flows/new_feature_flow_test.ts`

| Step | Action | Expectation |
|------|--------|-------------|
| 1 | Login as admin | Redirect to dashboard |
| 2 | Navigate to `/main/new-feature` | List loads, shows existing items |
| 3 | Tap FAB "+" or "Create" | Bottom sheet opens with Forms Engine form |
| 4 | Fill form, submit | Item created locally, `_synced=0` |
| 5 | Simulate network connection | Item synced, `_synced=1` |
| 6 | Open detail `[id]` | Full item data displayed |
| 7 | Change status via workflow | Status transitions, audit trail logged |
| 8 | Logout | Session cleared, tokens encrypted |

---

## 6. DOCUMENTATION A METTRE A JOUR

### 6.1 Docs Existantes a Modifier

| Document | Section | Changement Requis |
|----------|---------|------------------|
| `docs/01-platform-core/capability-engine/index.md` | Registry | Ajouter `new-feature` dans liste capabilities |
| `docs/05-api-contracts/api-contracts.md` | Endpoints | Ajouter section 1.X pour new-feature endpoints |
| `docs/07-database-schema/Database-Schema.md` | Modèles | Ajouter section 2.X pour WatermelonDB model, section 3 pour PostgreSQL table |
| `docs/09-testing-strategy/Testing-Strategy.md` | Matrice couverture | Ligne `new-feature` avec couverture >80% |
| `docs/00-architecture/Traceability-Matrix.md` | K1/K2/K3 | Nouvelle entree PRD-N linking new-feature |
| `docs/04-business-rules/*.md` | Regles metier | SI feature finance: BR-FIN-* regulations. SI feature membre: BR-MEMB-* |
| `docs/99-supporting/glossary.md` | Terminologie | Definitions termes specifiques new-feature |
| `docs/90-adrs/*.md` | Index | AUCUNE mise a jour necessaire (sauf si decision archi impacte) |

### 6.2 Nouvel ADR Potentiel

**ADR-016-new-feature-architecture** (SI decision architecturale significative):

Template requis (ADR-008 -- format modulaire <400 lignes):
```markdown
# ADR-016: [Titre de la Decision]

**Statut:** PROPOSE
**Décideurs: [Architecte Principal, CTO]
**Date: 2026-07-22

## Contexte
[Description du contexte et contrainte]

## Decision prise
[Decision precise]

## Conséquenses
- Positives: [...]
- Negatives: [...]
- Neutres: [...]

## Alternatives considerees
1. [Alternative A] -- rejettee car: [raison]
2. [Alternative B] -- rejettee car: [raison]
```

**Nouvel ADR necessaire SI:**
- Decision d'utiliser une strategie de conflit differente de celle existante
- Decision d'ajouter une nouvelle table WatermelonDB avec relation complexe
- Decision de modifier les dependances entre moteurs du Platform Core
- Decision de violer une NeverBreak Rule (dérrogation requise)

### 6.3 Documentation auto-generée (Non requis)

- `roadmap_dev.md`: Update phase/task if new-feature falls within a development phase
- `PRODUCT.md` / `prd-lumina.md`: Update only if new-feature changes product scope (not implementation spec)

---

## 7. CONVENTIONS DE QUALITE (DoD Checklist)

### C01-C05: Code Quality

| Check | Verifier par | Cible |
|-------|-------------|-------|
| C01: Tests unitaires ecrits | Jest coverage report | >80% |
| C02: Couverture minimale | `npm run test -- --coverage` | Seuil DOC-TESTING Section 1 |
| C03: Aucune violation NeverBreak | CI/CD pipeline + lint | 0 violation |
| C04: Aucun type `any` | ESLint `@typescript-eslint/no-explicit-any` | 0 occurrence |
| C05: Pas de business logic hardcode | Grep `if (type === 'church')` etc. | 0 occurrence |

### T01-T04: Test Execution

| Check | Description |
|-------|-------------|
| T01: Tests passent localement | `npm run test` sans erreur |
| T02: Test bug specifique | Test reproduisant le scenario de bug potentiel |
| T03: Test regression | Test couvrant cas deja vu dans features similares |
| T04: Test offline | Creation en mode avion -> verification local -> sync |

### D01-D04: Documentation

| Check | Description |
|-------|-------------|
| D01: Docs a jour | Tous docs references en Section 6 modifies |
| D02: ADR cree si decision archi | ADR-016 si decision architecturale majeure |
| D03: Glossaire mis a jour | Terms nouveaux dans `docs/99-supporting/glossary.md` |
| D04: Matrice traçabilité mise a jour | `docs/00-architecture/Traceability-Matrix.md` |

### Q01-Q04: Quality Gates

| Check | Description |
|-------|-------------|
| Q01: Prettier | `npm run format` sans difference |
| Q02: Linting sans erreur | `npm run lint` retourne 0 |
| Q03: Warning TS zero | `tsc --noEmit` zero warning |
| Q04: Doc <= 400 lignes | Chaque doc individuellement (<400 lignes) |

---

## 8. PLAN D'IMPLEMENTATION PAR PHASE

### Phase 1: Core Foundation (Jour 1-3)

1. Enregistrer capability dans `capability-engine`
2. Creer model WatermelonDB `NewFeatureModel.ts`
3. Créer migration WatermelonDB
4. Créer table PostgreSQL + RLS policies + indexes
5. Enregistrer termes vocabulary dans `vocabulary-engine`

### Phase 2: API Layer (Jour 4-5)

1. Définir endpoints dans `api-contracts.md`
2. Creer edge functions InsForge (validation, RLS)
3. Creer adapter API <-> DB
4. Tests unitaires services + validators

### Phase 3: Forms & UI (Jour 6-8)

1. Definition formulaire YAML pour Forms Engine
2. Implementer composants React Native (respect Design System)
3. Routes Expo Router navigation
4. Hook React Query + WatermelonDB observer

### Phase 4: Workflow & Permissions (Jour 9-10)

1. Workflow YAML definitions
2. Permissions dans manifest
3. Integration approval flow
4. Audit trail logging

### Phase 5: Sync & Offline (Jour 11-12)

1. Intégration sync engine (push/pull)
2. Resolution conflits (optimistic locking)
3. Tests offline-first complets
4. Conflict review UI

### Phase 6: Testing & Documentation (Jour 13-14)

1. Component tests (tous etats)
2. Integration tests (flows complets)
3. E2E flow tests
4. Documentation update + ADR SI besoin
5. DoD checklist verification

---

## 9. REFERENCES CROISEES

| Concept | Reference Primaires | References Secondaires |
|---------|-------------------|----------------------|
| Platform Core architecture | ADR-001, DOC-PLATFORM-CORE | DOC-DEPENDENCY-CONTRACT |
| Database schema | DOC-DATABASE-SCHEMA | ADR-003 (WatermelonDB) |
| Offline-first | DOC-OFFLINE-FIRST | ADR-003, INV-003 |
| Financial immutability | ADR-004, DOC-BUSINESS-RULES-FINANCE | INV-001, NB-RULE-03 |
| Multi-tenant | ADR-006 | INV-004, NB-RULE-04 |
| Navigation | ADR-012 | DOC-FRONTEND-GUIDE |
| State management | ADR-013 | Context + React Query |
| Design system | ADR-011, DESIGN.md | Color tokens, components |
| API contract | ADR-015 | DOC-API-CONTRACTS |
| Organization DAG | ADR-014 | DOC-ORGANIZATION-GRAPH |
| Testing | DOC-TESTING | DOC-DEFINITION-OF-DONE |
| NeverBreak rules | DOC-NEVERBREAK | CI/CD verification |
| Invariants | DOC-INVARIANTS | Verification matrix |

---

**Fin de la specification technique.**

Toutes les assertions de ce document sont referees a des documents/sources specifiques de Lumina v2. Toute deviation requiert un ADR approuve (DOC-NEVERBREAK Section 4).
