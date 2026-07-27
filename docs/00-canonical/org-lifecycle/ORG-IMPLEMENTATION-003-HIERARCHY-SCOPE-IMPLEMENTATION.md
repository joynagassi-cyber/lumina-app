# ORG-IMPLEMENTATION-003 — Hierarchy & Scope Implementation

## MARQUAGE IGS-v1

| Element | Source Canonique | Statut Validation |
|---------|-----------------|------------------|
| OrgUnitLink entity (self-referencing parent link) | DOC-012 RelationshipAggregate (§2.4) | Validate |
| GroupMembership entity (N:M junction) | DOC-012 RelationshipAggregate (§2.4) | Validate |
| CycleDetector service (Kahn's algorithm) | DOC-015 INV REL-001 + BR-REL-001 | Validate |
| DescendantEnumerator service (DFS traversal) | DOC-015 BR-REL-003 + BR-REL-004 | Validate |
| DagPolicy (no-cycles assertion) | DOC-015 INV REL-001 | Validate |
| MaxDepthPolicy (depth <= 5) | DOC-015 INV REL-002 (DEPTH-002) | Validate |
| MemberService application layer | ASS-001 Service 1 | Validate |
| OrganizationService application layer | ASS-001 Service 1 | Validate |
| OrgUnit entity with hierarchy path | DOC-012 OrganizationAggregate (§2.1) | Validate |
| OrgHierarchyResolver service | DOC-023 §4.2/§4.3 | Validate |

---

## 1. HIÉRARCHIE — VÉRIFICATION DU CODE EXISTANT

Source canonique : ORG-003, DOC-012 §4 (RelationshipAggregate)

### 1.1 Structure des fichiers liés à la hiérarchie

| Fichier | Rôle dans l'implémentation |
|---------|---------------------------|
| `src/safe-boot/backend/src/domains/member/domain/entities/org-unit-link.entity.ts` | Self-referencing parent link for hierarchy (entity domain avec `parentOrgUnitUuid`, `depthLevel`) |
| `src/safe-boot/backend/src/domains/member/domain/entities/group-membership.entity.ts` | N:M junction between member and org_unit (`memberUuid`, `groupOrgUnitUuid`, `membershipRole`) |
| `src/safe-boot/backend/src/domains/member/domain/services/cycle-detector.service.ts` | Kahn's algorithm + DFS-based cycle prevention before insert/update |
| `src/safe-boot/backend/src/domains/member/domain/services/descendant-enumerator.service.ts` | DFS traversal of hierarchical relationships for reporting/transfer |
| `src/safe-boot/backend/src/domains/member/domain/policies/dag-policy.ts` | No-cycles assertion delegating to CycleDetector |
| `src/safe-boot/backend/src/domains/member/domain/policies/max-depth-policy.ts` | Depth <= 5 enforcement with `MAX_DEPTH = 5` constant |
| `src/safe-boot/backend/src/domains/member/domain/policies/multi-membership-policy.ts` | Concurrency membership cap (MAX_CONCURRENT_MEMBERSHIPS = 50) |
| `src/safe-boot/backend/src/domains/member/application/member.service.ts` | ChangeOrgUnitParent, TransferChildOrg, MergeChildOrg — orchestration with policy gates |
| `src/safe-boot/backend/src/domains/organization/domain/entities/org-unit.entity.ts` | OrgUnit entity with hierarchy path (`hierarchyPath`, `depthLevel`, `MAX_DEPTH = 5`) |
| `src/safe-boot/backend/src/domains/organization/domain/services/org-hierarchy-resolver.service.ts` | Recursive DAG traversal via Kahn's algorithm (separate implementation from member domain) |
| `src/safe-boot/backend/src/domains/organization/domain/policies/hierarchy-policy.ts` | Composite policy delegating to OrgHierarchyResolver |
| `src/safe-boot/backend/src/domains/organization/domain/policies/max-depth-policy.ts` | Domain-level depth validation for organization.service.ts |
| `src/safe-boot/backend/src/domains/organization/domain/policies/visibility-policy.ts` | Multi-tenant isolation (NB-MT-001) enforced at all org queries |
| `src/safe-boot/backend/src/domains/organization/application/organization.service.ts` | handleCreateOrgUnit, handleUpdateOrgUnitParent, handleTransferChildOrg |

### 1.2 Règles de création vérifiées

**ORG-003 §3.2 : Qui peut créer un org_unit ?**

- **organization.service.ts ligne 274** : `handleCreateOrgUnit(input, requestOrgId, creatorId)` creates a new OrgUnit with validation.
- RBAC gate via `IAuthorizationPort` interface (`ports/auth.port.ts` line 13) implemented in `rbac.adapter.ts`. However, the `handleCreateOrgUnit` method does NOT call `this.authorizer.hasRole(creatorId, ...)` before creating — it trusts the caller (middleware/guard layer is responsible for this check).
- **organization.service.ts ligne 469** : `handleMergeOrganizations` correctly calls `await this.authorizer.hasRole(mergedById, 'superadmin')` enforcing BR-ORG-005.
- **member.service.ts lignes 47-55** : `addMemberToGroup` applies `MultiMembershipPolicy.assertCanJoin()` but does NOT check role permissions within the member domain itself (relies on composition root guards).

**Résultat : [PARTIAL PASS]** — Policies (DagPolicy, MaxDepthPolicy, MultiMembershipPolicy) are enforced at the domain layer. Role-based authorization gates exist but are applied at the composition/root layer rather than inside each service method. The merge operation (BR-ORG-005) explicitly checks superadmin. CreateOrgUnit and AddMemberToGroup rely on caller-side guards.

### 1.3 Cycle detection vérifié

**ORG-003 : "Un org_unit ne peut pas devenir son propre parent"**

Two parallel implementations exist:

1. **`cycle-detector.service.ts` lignes 25-125** :
   - `wouldCreateCycle(childUuid, parentUuid, existingLinks, orgId)` (line 31): DFS walk from child upward; if ancestor can reach parent, returning true → cycle blocked. Line 37 catches self-parent: `if (childUuid === parentUuid) return true`.
   - `validateDag(edges)` (line 49): Full Kahn's algorithm — O(V+E) topological sort. Returns true only if all nodes processed.

2. **`org-hierarchy-resolver.service.ts` lignes 55-120** :
   - `validateNoCycles(existingEdges, proposedEdges)` — alternative Kahn's implementation used by HierarchyPolicy.
   - `isDescendantOrSelf(candidateAncestorId, candidateDescendantId, lookupFn)` (line 157): direct ancestor check.

3. **DagPolicy** (`dag-policy.ts` lignes 33-42) wraps CycleDetector with typed error `DagCycleError`.

4. **DB constraint** : MIGRATION-PACK-V1.md MIG-015 (ligne 634-640) creates `org_unit_links` table with foreign keys to `org_units(id) CASCADE` but there is **NO database trigger** (`trg_dag_cycle_check`) defined. Cycle detection is purely at the domain layer. This is acceptable as defense-in-depth (domain validation + DB FK constraints), but it is not a second-line DB-level cycle check.

**Résultat : [PASS]** — Cycle detection is robustly implemented at the domain layer through two independent services. No DB trigger exists (gap noted below as tension T-HIER-002).

### 1.4 Max depth 5 vérifié

Three independent enforcement points:

1. **`max-depth-policy.ts` (member domain)** ligne 24 : `static readonly MAX_DEPTH = 5`. Line 30: `assertValidDepth(depth, orgUnitUuid)` throws `MaxDepthExceededError` if depth < 1 or > 5. Line 40: `computeChildDepth(parentDepth)` computes `parentDepth + 1` and validates.

2. **`max-depth-policy.ts` (organization domain)** ligne 22-42 : Parallel implementation. `validateDepth(unit)` checks `unit.depthLevel < 1` or `> OrgUnit.MAX_DEPTH`. `isChildDepthValid(parentDepth)` checks `parentDepth + 1 <= OrgUnit.MAX_DEPTH`.

3. **`org-unit.entity.ts`** ligne 74 : `static readonly MAX_DEPTH = 5` constant matches.

4. **DB CHECK constraint** : POSTGRESQL-SCHEMA-PACK-v1.md ligne 244 confirms `CHECK (niveau_profondeur BETWEEN 1 AND 5)`. CONSTRAINTS-INDEX-SPECIFICATION-v1 Line 177 mirrors this.

5. **`org-hierarchy-resolver.service.ts`** ligne 145: `computeDepth` throws `DepthExceededError` if `depth > OrgUnitHierarchyResolver.MAX_DEPTH`.

6. **`descendant-enumerator.service.ts`** ligne 27: Own `private static readonly MAX_DEPTH = 5` constant — **tension**: inconsistent depth source across files (see T-HIER-001).

**Résultat : [PASS]** — Five enforcement points at domain layer plus DB-level CHECK constraint. Defense-in-depth properly applied.

### 1.5 Transfert et suppression vérifiés

**Transferts :**
- **`member.service.ts` ligne 154** : `transferChildOrg(childOrgUnitUuid, newSiblingOrgUnitUuid, orgId)` — applies DagPolicy, reparents under sibling's parent, recalculates depth via MaxDepthPolicy.computeChildDepth(), enumerates descendants and preserves memberships.
- **`member.service.ts` ligne 201** : `mergeChildOrg(sourceOrgUnitUuid, targetOrgUnitUuid, orgId)` — validates no cycle, transfers memberships, reparents.
- **`organization.service.ts` ligne 443** : `handleTransferChildOrg` delegates to `handleUpdateOrgUnitParent` (shared logic).
- **Domain events emitted** : `ChildOrgTransferred` (line 186), `ChildOrgMerged` (line 217).

**Suppression :**
- No explicit `archiveOrgUnit` or `deleteOrgUnit` method found in `member.service.ts` or `organization.service.ts`.
- `lifecycle/service/purge-scheduler.service.ts` and `soft-delete-policy.ts` exist in lifecycle domain for general soft-delete semantics.
- `organization.service.ts` ligne 504: `handleArchiveOrganization` transitions status to archived and persists.
- **Soft-delete cascade for org_units** is NOT explicitly implemented in member.service.ts. The canonical spec (ORG-003 §3.4) defines `ArchiveOrgUnit(org_unit_id)` which archives all descendants and invalidates memberships. The current code handles organization-level archival but not org_unit cascade.

**Résultat : [PASS] for transfers, [LACUNE] for org_unit soft-delete cascade** — Transfers work correctly with preservation of memberships (BR-REL-003). Org unit cascade archive (per ORG-003 §3.4 spec) is not fully implemented.

### 1.6 Règles d'héritage vérifiées

**ORG-003 §3.1 : Un responsable d'un org_unit hérite implicitement des permissions du parent**

- **`permission-resolver.ts`** ligne 56 : `resolvePermissions(role)` resolves manifest-based permissions. No explicit DAG-traversal inheritance implementation found in PermissionResolver itself.
- **`permission-resolver.ts`** ligne 80 : `hasHigherOrEqualPrivilege(actorRole, subjectRole)` implements role hierarchy comparison.
- **`organization.service.ts`** does NOT implement permission inheritance during org_unit reparenting (the scope change does not recalculate effective permissions).
- **Tension noted** : Permission inheritance algorithm specified in ORG-003 §4.1 (InheritPermissions — walk from target unit upward collecting RoleManifests) has no direct code equivalent. The `PermissionResolver.resolvePermissions()` only looks at the role's own manifest, not its ancestors.

**Résultat : [FAIL]** — Role manifest resolution works for single-role lookups, but the DAG-based permission inheritance algorithm (walk ancestors, collect manifests, exclude explicit restrictions) described in ORG-003 §4.1 is NOT implemented in code. InheritancePolicy is referenced in comments but not coded as a separate traversable service.

### 1.7 Scope Resolution vérifié

**ORG-003 §5.1 : Algorithme de résolution en 7 étapes**

Expected steps: membership → role → permission set → delegated → wildcard → scope match → allowed/denied.

Actual code in **`permission-resolver.ts`** :
- Does NOT implement the 7-step algorithm as a unified `PermissionCheck(user_id, target_org_id, resource, action, scope_type, scope_target)` function.
- `hasPermission(role, resource, action, level)` (line 62) performs a simple role→manifest→grant check without membership lookup, delegation handling, or scope matching.
- `canCreateRole(actorRole, targetRole)` (line 72) handles only role-creation hierarchies.
- **Scope types** (`org_level`, `group_level`, `custom`) are NOT modeled in PermissionGrant or PermissionResolver. The `level` field exists as a string parameter but has no enforcement logic distinguishing org/group/custom scopes.

**Résultat : [LACUNE]** — The 7-step scope resolution algorithm is defined canonically but NOT implemented. Only basic permission manifest lookup exists.

---

## 2. SCOPE — VÉRIFICATION

### 2.1 Types de scope

| Type de scope | Définition | Implémenté dans |
|---------------|-----------|-----------------|
| org_level | Toute l'organisation | resources portées par org_id (visible via `orgId` property on entities, `VisibilityPolicy.filterByOrg()`) |
| group_level | Un org_unit donné | `group_org_unit_uuid` FK → `org_units.id` via GroupMembership.entity.ts line 16-17 |
| custom | Défini dynamiquement | NON IMPLEMENTE — no `scope_type` field in PermissionGrant, no dynamic scope configuration |

### 2.2 Règles de portée vérifiées

**ORG-003 §5.2 : Conflits de portée**

- **`multi-membership-policy.ts`** : Handles concurrent membership conflicts with a hard cap (50), but does NOT implement priority ordering for conflicting scope permissions.
- **`permission-check-policy.ts` (reporting)** : Stub implementation returning `true` for all checks. Not wired into the RBAC priority rules.
- **Conflicts resolution priority** (Denied > Specific > Explicit > Time-bound) is NOT coded. The `PermissionResolver` performs a simple set inclusion check without conflict resolution logic.

**Résultat : [LACUNE]** — Priority ordering rules (ORG-003 §5.2 / ORG-004 §4.2) are documented but not implemented in code.

---

## 3. TENSIONS IDENTIFIÉES

### T-HIER-001: Depth constant defined in 4 separate locations
- `member/domain/policies/max-depth-policy.ts` line 24: `MAX_DEPTH = 5`
- `member/domain/entities/org-unit-link.entity.ts` line 16: `const MAX_DEPTH = 5` (file-scoped constant)
- `member/domain/services/descendant-enumerator.service.ts` line 27: `MAX_DEPTH = 5`
- `organization/domain/policies/max-depth-policy.ts` line 40: references `OrgUnit.MAX_DEPTH = 5`
- `organization/domain/entities/org-unit.entity.ts` line 74: `MAX_DEPTH = 5`
- Impact : MODERE — risk of divergence if one constant changes
- Recommandation : Centralize to a single `OrganizationDomainConstants.MAX_DEPTH` imported everywhere.

### T-HIER-002: No database-level cycle detection trigger
- Canonical requirement (DOC-023 §3.4 DAG Et Detection De Cycles) mentions a DB trigger `trg_dag_cycle_check`.
- MIGRATION-PACK-V1.md MIG-015 does NOT define such a trigger. Cycle detection is purely at the application domain layer.
- Impact : FAIBLE — domain validation runs before every write, so protection exists. But loss of defense-in-depth means an app-layer bypass could introduce cycles.
- Recommandation : Add a PostgreSQL recursive function + trigger as second-line defense per DOC-023 §3.4.

### T-HIER-003: Permission inheritance algorithm NOT implemented
- ORG-003 §4.1 specifies walking the ancestor chain and collecting RoleManifests.
- `PermissionResolver.resolvePermissions()` only reads the role's own manifest.
- Impact : MAJEUR — the scope-resolution algorithm will NOT grant inherited permissions to users who belong to child org_units with broader parent permissions.
- Recommandation : Implement `InheritPermissions(user_role, target_scope_path)` as a separate service or method in PermissionResolver.

### T-HIER-004: Org unit cascade archive not implemented
- ORG-003 §3.4 defines `ArchiveOrgUnit(org_unit_id)` which cascades `SetStatus(descendant_org_unit, "archived")` for all descendants and invalidates memberships.
- Current code has `handleArchiveOrganization` for the top-level org aggregate only, no corresponding org_unit cascade.
- Impact : MODERE — deleting/reorganizing an org_unit may leave orphaned memberships.
- Recommandation : Implement `archiveOrgUnit` in member.service.ts mirroring ORG-003 §3.4 algorithm using DescendantEnumerator.
