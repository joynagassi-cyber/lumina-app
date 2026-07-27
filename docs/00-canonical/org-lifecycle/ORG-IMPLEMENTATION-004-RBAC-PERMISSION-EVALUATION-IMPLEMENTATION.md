# ORG-IMPLEMENTATION-004 — RBAC & Permission Evaluation Implementation

## MARQUAGE IGS-v1

| Element | Source Canonique | Statut Validation |
|---------|-----------------|------------------|
| Three-layer separation (membership/role/permission) | ORG-004 §1, DOC-012 IdentityAggregate + RelationshipAggregate | Validate |
| UserRole enum | DOC-012 IdentityAggregate Value Objects | Validate |
| PermissionGrant VO | DOC-012 IdentityAggregate (VO) | Validate |
| PermissionResolver domain service | DOC-012 IdentityAggregate (§2.2) Domain Services | Validate |
| RbacAuthorizationAdapter | PAS-001 Port-004 (IAuthorizationPort) | Validate |
| Audit port & adapter | DOC-015 AUD-001/002/033, DOC-023 §6.1/6.2 | Validate |
| Custom role management | DOC-012 ConfigurationAggregate + DOC-001 | LACUNE |
| Permission evaluation algorithm (7-step) | ORG-004 §4.1 | LACUNE |

---

## 1. SEPARATION CONCEPTUELLE VERIFIEE

**ORG-004 §1 stipule : Membership ≠ Role Assignment ≠ Permission Evaluation**

### 1.1 Memberships (RelationshipAggregate)

| Fichier | Rôle |
|---------|------|
| `src/safe-boot/backend/src/domains/member/domain/entities/group-membership.entity.ts` | Entity N:M avec `memberUuid`, `groupOrgUnitUuid`, `membershipRole` |
| `src/safe-boot/backend/src/domains/member/ports/group-membership.port.ts` | Port `IGroupMembershipRepository` (`findByMemberId`, `exists`, `create`, `update`) |
| `src/safe-boot/backend/src/domains/member/infrastructure/adapters/prisma-group-membership.repository.ts` | Prisma adapter for GroupMembership persistence |
| `src/safe-boot/backend/src/domains/member/application/member.service.ts` | Orchestrates membership commands with MultiMembershipPolicy |

**Résultat : [PASS]** — Membership layer is cleanly separated in the `member` domain aggregate with its own entities, ports, and application service.

### 1.2 Role Assignments (IdentityAggregate)

| Fichier | Rôle |
|---------|------|
| `src/safe-boot/backend/src/domains/user/domain/value-objects/user-role.ts` | UserRole VO with `RoleName` type `'superadmin' \| 'admin' \| 'treasurer' \| 'pastor' \| 'staff'`. ROLE_HIERARCHY map: `[0] superadmin > [1] admin > [2] treasurer > [3] pastor > [4] staff`. ADMIN_CREATEABLE_ROLES set = `{treasurer, pastor, staff}`. |
| `src/safe-boot/backend/src/domains/user/application/identity-service.ts` | `changeRole()` method (UC-ID-03), `enforceRoleCreationPermission()` guard |
| `src/safe-boot/backend/src/domains/organization/infrastructure/auth/rbac.adapter.ts` | Infrastructure implementation of `IAuthorizationPort.hasRole()` with hierarchy comparison |

**Résultat : [PASS]** — Role assignments are properly modeled. BR-ID-004 (superadmin can assign all roles) and BR-ID-005 (admin restricted to treasurer/pastor/staff) are enforced via `enforceRoleCreationPermission()` at line 333-340.

### 1.3 Permission Evaluation (Domain Service)

| Fichier | Rôle |
|---------|------|
| `src/safe-boot/backend/src/domains/user/domain/services/permission-resolver.ts` | `resolvePermissions()`, `hasPermission()`, `canCreateRole()`, `hasHigherOrEqualPrivilege()` |
| `src/safe-boot/backend/src/domains/user/domain/value-objects/permission-grant.ts` | Resource:action:level parsing, wildcard detection, matching |

**Résultat : [PARTIAL PASS]** — Core permission mechanics exist (resolve from manifest, check resource:action). The full 7-step evaluation algorithm (ORG-004 §5.1) is NOT implemented (see T-RBAC-001).

---

## 2. ROLES CANONIQUES VERIFICATION

Source : ORG-004 §3.1, DOC-012 §2

**`user-role.ts` ligne 11** defines exactly 5 canonical roles:
```typescript
export type RoleName = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';
```

**`user-role.ts` ligne 17-23** defines the hierarchy map matching the canonical ordering:
| superadmin (0) > admin (1) > treasurer (2) > pastor (3) > staff (4) |

**`rbac.adapter.ts` ligne 45** defines a parallel hierarchy array (ascending order):
```typescript
const hierarchy: RoleType[] = ['staff', 'pastor', 'treasurer', 'admin', 'superadmin'];
```
Note: Index direction is opposite of `ROLE_HIERARCHY` map (lower index = higher privilege in ROLE_HIERARCHY; higher index = higher privilege in hierarchy array). Both resolve to the same comparison result but use inverted logic (`actualIndex >= minIndex` vs `priority() <= other.priority()`).

### Permission Manifests Comparison

| Rôle | Spécification ORG-004 | Implémenté dans `permission-resolver.ts` line 22-49 | Conformance |
|------|----------------------|-----------------------------------------------------|-------------|
| **superadmin** | `{ *:*:* }` (wildcard total) | `['*:*:*']` | PASS |
| **admin** | ~23 granular permissions (transaction:read:org, member:write:org, org_unit:create:org, settings:update:org, etc.) | `['user:create', 'user:read', 'user:update', 'user:delete', 'org:read', 'org:update', 'finance:read', 'finance:write', 'workflow:approve', 'workflow:reject', 'reporting:generate', 'reporting:export', 'vocab:manage', 'settings:manage']` | **FAIL** — The implementation uses only 14 high-level permissions instead of 23 granular ones. Also uses different resource/action naming (`user:` vs `member:`, `org:` vs `org_unit:`). Resource types do NOT match the canonical list. |
| **treasurer** | `transaction:read/write/create/approve/reject:org`, `report:read/export:org`, `category:read/write:org` | `['finance:read', 'finance:write', 'reporting:generate', 'reporting:export']` | **PARTIAL PASS** — Covers core financial functions but lacks `transaction:create`, `transaction:approve`, `transaction:reject` explicitly. Uses `finance:` namespace instead of `transaction:`. |
| **pastor** | `event:read/write/create:org`, `member:read:org`, `member:invite:group`, `notification:send:org`, `org_unit:create:group`, `form:submit:org` | `['user:read', 'user:update', 'finance:read', 'reporting:generate', 'event:manage', 'membership:manage']` | **FAIL** — Uses different verbs (`manage` vs `read/create/send`). Missing explicit `notification:send` and `member:invite:group` permissions. |
| **staff** | `{ event:read:org, member:read:org, form:submit:org }` (configurable via manifest org) | `['finance:read', 'reporting:generate', 'event:read']` | **FAIL** — Staff manifest includes `finance:read` and `reporting:generate` which are NOT in the canonical spec. Missing `member:read` and `form:submit`. |

**Root cause**: The `ROLE_MANIFEST` in `permission-resolver.ts` lines 22-49 was defined independently from the canonical specification (ORG-004 §3.2 table). The two diverge on:
1. Resource names (`user` vs `member`, `finance` vs `transaction`, `org` vs `org_unit`)
2. Action granularity (high-level `manage` vs specific `read/write/create/send`)
3. Scope level information is completely absent from the manifest strings (no `:org` / `:group` / `:custom` suffixes)

---

## 3. PERMISSION ATOMIQUE FORMAT VERIFIE

Source : ORG-004 §3.1

**`permission-grant.ts` lignes 10-46** :
- Constructor accepts `resource: string, action: string, level: string` — matches canonical format.
- Line 18-19: All three components normalized to lowercase.
- Line 38-44: `static create(permissionString)` parses `"resource:action:level"` by splitting on `:` and throwing error if not 3 parts.
- Line 22-24: `isFullWildcard()` checks if all three components equal `'*'`.
- Line 27-31: `matches(resource, action, level)` supports wildcards in each component.
- Line 35: `toString()` outputs `"resource:action:level"`.

**Tension détectée** : While `PermissionGrant.create()` correctly parses the 3-part format, the canonical spec says level must be one of `{org, group, custom}`. The `matches()` method treats `*` as "any level", but the level field is NOT validated against the canonical enum at construction time.

Also, the `ROLE_MANIFEST` entries use a 2-part format like `user:create` (only resource:action, no level) in many cases. When `PermissionGrant.create()` is called with `'user:create'`, it throws an error because the split produces only 2 parts. This code path will fail at runtime.

**Résultat : [FAIL]** — `PermissionGrant` class correctly implements the parser and wildcard support. However, the manifest data does not conform to the 3-part format, causing a runtime error when `resolvePermissions()` calls `PermissionGrant.create(key)` with 2-part strings like `'user:create'`.

---

## 4. ALGORITHME PERMISSIONCHECK VERIFIE

Source : ORG-004 §4.1 — Algorithme à 7 étapes (labeled 8 steps in ORG-004 itself)

Expected algorithm flow:
```
Step 1: LookupMembership(user_id, target_org_id)
Step 2: If no membership → DENIED
Step 3: LookupRoleAssignment(membership_id)
Step 4: Build PermissionSet from RoleManifest
Step 5: Add Delegated Permissions (within duration)
Step 6: Check {resource:action} ∈ All_Permissions
Step 7: Check denial policies
Step 8: Audit the evaluation
```

Actual code in **`permission-resolver.ts`** :

The current `PermissionResolver` has these methods:
- `resolvePermissions(role)` (line 56): Resolves manifest → PermissionGrant[]. Matches Step 4 only.
- `hasPermission(role, resource, action, level)` (line 62): Checks grant match. Matches Step 6 only.
- `canCreateRole(actorRole, targetRole)` (line 72): Role creation gate.

**Missing entirely from code:**
- Step 1-2: No `LookupMembership(user_id, target_org_id)` — there is no method that takes a `userId` to look up their membership.
- Step 3: No `LookupRoleAssignment(membership_id)` — the resolver takes a `UserRole` object directly, not a `membership_id`.
- Step 5: No delegation logic (`LookupActiveDelegations`, duration checking, scope overlap).
- Step 7: No `AnyDenyPolicy()` check — deny-before-grant principle not enforced.
- Step 8: No audit logging of permission evaluations — `PermissionResolver` has zero interaction with `IAuditPort`.

**Résultat : [FAIL]** — Only Steps 4 and 6 are partially implemented (manifest resolution + grant matching). Steps 1-3 (membership lookup chain), 5 (delegation), 7 (deny-before-grant), and 8 (audit) are entirely absent.

---

## 5. PRIORITE DES CONFLITS VERIFIEE

Source : ORG-004 §4.2

Priority rules specified:
1. Refuse > Grant
2. Specific > General
3. Explicit > Implicit
4. Time-bound > Permanent

Code analysis:

**`dag-policy.ts`** — Only handles DAG cycle prevention. Does NOT implement permission conflict resolution.

**`multi-membership-policy.ts`** — Only caps concurrent memberships. Does NOT implement priority ordering for conflicting permissions across memberships.

**`permission-resolver.ts`** — No conflict resolution logic. `hasPermission()` returns first match via `.some()`. No deny-before-grant evaluation. No specific-over-general comparison.

**`rbac.adapter.ts`** — `isRoleEqualOrAbove()` (line 44-48) compares role hierarchy levels but does NOT implement the multi-rule priority system.

**Résultat : [FAIL]** — None of the four conflict priority rules are implemented. When a user has multiple memberships with different permissions (including deny policies), the system cannot resolve conflicts.

---

## 6. DELÉGATION VERIFIEE

Source : ORG-003 §4.2, ORG-004 §3.4

**Required:** Temporary explicit delegation with expiry, within-user-permission bounds, audited, per-role per-scope granularity.

**Code search results** :
- No delegation-related files found anywhere in `src/safe-boot/backend/src/domains/`.
- No `DelegationEntry`, `DelegationRepository`, or similar entities.
- No `expires_at`, `delegated_permissions`, or delegation-scoped fields in any entity.
- `identity-service.ts` line 323: `assignPermissionGrant(_userId, _permissionString)` is an empty stub with comment "Grants derived from role via PermissionResolver".

**Résultat : [LACUNE]** — Delegation is a complete gap. The `PermissionResolver` has no concept of delegated permissions, temporal bounds, or permission escalation validation. `assignPermissionGrant` is a no-op placeholder.

---

## 7. CUSTOM ROLES VERIFICATION

Source : ORG-004 §6

**Constraints requiring implementation:**
1. Custom roles CANNOT create new capabilities
2. Must be subsets of existing capabilities
3. Org-bound (single org)
4. Audited
5. Superadmin-only creation

**Code analysis** :
- **`identity-service.ts`** — No `createCustomRole`, `updateCustomRole`, or `deleteCustomRole` methods.
- No `CustomRole` entity or value object exists.
- No capability manifest validation.
- No custom role assignment in `PermissionResolver`.
- No `CustomRoleCreated` domain event.

**Résultat : [LACUNE]** — Custom roles feature is entirely unimplemented. The code only supports the 5 canonical roles with no extension mechanism.

---

## 8. AUDIT DE PERMISSION VERIFIE

Source : ORG-005 §4

**Required** for every permission evaluation: `userId, targetOrgId, resource, action, scope, result(granted/denied), reason, timestamp`. Written via `IAuditPort` with immutability.

**Evidence found :**
- **`audit.port.ts`** — Interface `log(payload: AuditPayload)` where payload has `entityType, entityId, action, userId, before?, after?`. Does NOT have dedicated `resource, action, scope, result, reason` fields for permission evaluation auditing.
- **`audit-log.adapter.ts`** — Writes `entite_type, entite_id, action_effectuee, utilisateur_id, valeur_avant, valeur_apres` to DB. No `scope_target` or `result` field.
- **No calls to audit port from `permission-resolver.ts`** — The resolver never logs permission evaluation results.

The organization service (`organization.service.ts`) calls `this.audit.log()` for organizational operations (create org, update settings, create org unit, archive org). But this is entity-change auditing, NOT permission-evaluation auditing.

**Résultat : [FAIL]** — Permission evaluation auditing per ORG-005 §4 is not implemented. The audit infrastructure exists for entity CRUD changes but has no integration with the permission resolver.

---

## 9. TABLEAU DE CORRESPONDANCE FINAL

| Fonctionnalité | Spécification | Implémentation | Statut |
|---------------|---------------|----------------|--------|
| Superadmin role (`*:*:*`) | ORG-004 §3.2 | `ROLE_MANIFEST[superadmin] = ['*:*:*']` — permission-resolver.ts:23 | PASS |
| Admin role | ORG-004 §3.2 (~23 granular perms) | 14 high-level perms, wrong resource naming | FAIL |
| Treasurer role | ORG-004 §3.2 (8 transaction/report/category perms) | 4 finance/reporting perms, wrong resource naming | PARTIAL |
| Pastor role | ORG-004 §3.2 (7 event/member/notification/form perms) | 6 event/membership/reporting perms, wrong naming | FAIL |
| Staff role | ORG-004 §3.2 (3 event/read, member/read, form/submit) | 3 event/finance/reporting perms, extras added | FAIL |
| Permission format `resource:action:level` | ORG-004 §3.1 | `PermissionGrant.create()` parses 3 parts; manifest entries are 2-part → crash at runtime | FAIL |
| Permission algorithm (7-8 steps) | ORG-004 §4.1 | Only steps 4+6 implemented; missing steps 1-3, 5, 7, 8 | FAIL |
| Conflict priority (deny > grant, specific > general, explicit > implicit, time-bound > permanent) | ORG-004 §4.2 | Not implemented anywhere | FAIL |
| Delegation (temporary, audited, expiring) | ORG-004 §3.4 / ORG-003 §4.2 | Not implemented; stub `assignPermissionGrant` | LACUNE |
| Custom roles (subset-only, org-bound, audited) | ORG-004 §6 | Not implemented; no custom role types | LACUNE |
| Permission audit | ORG-005 §4 | Entity CRUD auditing exists; permission evaluation auditing absent | FAIL |
| RBAC port interface | PAS-001 Port-004 | `IAuthorizationPort` with `hasRole`, `hasRoleHierarchy`, `hasPermission` | PASS |
| RbacAuthorizationAdapter | PAS-001 Port-004 | `rbac.adapter.ts` implements hierarchy comparison | PASS |

---

## 10. TENSIONS IDENTIFIEES

### T-RBAC-001: Permission evaluation algorithm incomplete — CRITICAL GAP
- Specification ORG-004 §5.1 mandates an 8-step algorithm including membership lookup, delegation handling, scope resolution, deny-before-grant enforcement, and audit logging.
- The current `PermissionResolver` only implements role manifest resolution and a simple grant-matching check.
- Impact : MAJEUR — authorization decisions are made without considering membership scope, delegation status, deny policies, or being audited. This is a security gap.
- Recommandation : Implement the full 8-step algorithm in a unified `PermissionCheck` method that calls through membership repository, resolves role assignments, evaluates delegations, applies deny policies, and logs to audit port.

### T-RBAC-002: Resource/action naming mismatch between spec and implementation — CRITICAL
- Canonical spec uses resource names like `transaction`, `member`, `event`, `org_unit`, `report`, `notification`, `category`, `form`, `settings`.
- Implementation uses `user`, `org`, `finance`, `reporting`, `event`, `membership`, `workflow`, `vocab`, `settings`.
- Critical mismatch examples: `member` vs `user` (different aggregates), `transaction` vs `finance` (different domains), `org_unit` missing entirely, `org` vs `org_unit` confusion.
- Impact : MAJEUR — Any caller using canonical resource names against the implementation will find no matching permissions. Conversely, the canonical permission check will never find granted permissions.
- Recommandation : Align `ROLE_MANIFEST` resource/action names to the canonical specification in ORG-004 §3.2. Update `PermissionGrant` parsing to enforce canonical resource/action enums.

### T-RBAC-003: PermissionGrant format violation — CRITICAL
- Canonical spec requires `resource:action:level` (3-part format).
- `ROLE_MANIFEST` entries include 2-part strings like `'user:create'` and 3-part strings like `'*:*:*'`.
- `PermissionGrant.create()` splits on `:` and throws error if result !== 3. 2-part strings will crash at runtime.
- Impact : CRITIQUE — Application will throw on first permission check against non-wildcard roles (admin, treasurer, pastor, staff).
- Recommandation : Fix all manifest entries to use 3-part format with scope level suffix (e.g., `user:create:org`, `finance:read:org`).

### T-RBAC-004: No level/scope enforcement in PermissionGrant
- Canonical spec says level must be `org`, `group`, or `custom`.
- `PermissionGrant` constructor accepts any string for `level` without validation.
- Impact : MODERE — No boundary checking prevents semantic misuse, but core evaluation still functions.
- Recommandation : Add enum validation in `PermissionGrant` constructor for level field.

### T-RBAC-005: Custom roles and delegation are complete lacs
- Both features are marked as required in ORG-004 specifications (§3.4 delegation, §6 custom roles).
- Zero code exists for either feature.
- Impact : MODERE for delegation (admin users can manage temporary access); MAJEUR for custom roles (organizational flexibility requirement).
- Recommandation : Prioritize custom roles implementation (subset-enforcement constraint is a security invariant per NB-RBAC-002) and delegation implementation (temporal bounded access for emergencies).
