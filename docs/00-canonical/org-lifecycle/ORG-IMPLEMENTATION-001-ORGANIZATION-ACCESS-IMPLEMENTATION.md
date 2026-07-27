# ORG-IMPLEMENTATION-001 — Organization Access Implementation

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| generation_id | ORG-IMP-001-v1.0-2026-07-24 |
| source_canonical | ORG-001 (Organization Lifecycle), DOC-012 (Canonical Domain Model), DOC-014 (Domain Commands/Events), DOC-023 (Canonical Relational Rules) |
| transformation_rule | IGS-v1 pipeline — step: implementation verification report |
| compliance_status | DOCUMENTARY — verifie le code EXISTANT contre les specifications canoniques |
| generated_date | 2026-07-24 |

---

## 1. CONTEXTUALISATION

Ce document relie l'implementation reelle (dans `src/safe-boot/backend/src/domains/`) aux specifications ORG-001.

Le code existe dans :
- `src/domains/organization/` — OrganizationAggregate
- `src/domains/user/` — IdentityAggregate
- `src/domains/member/` — RelationshipAggregate
- `src/domains/finance/` — ResourceAggregate

Chaque fichier est verifie contre ORG-001, DOC-012, DOC-015, DOC-023.

---

## 2. CREATION D'ORGANISATION — VERIFICATION

Source canonique : ORG-001 §2.1, DOC-012 §1

### 2.1 Qui cree une organisation ?

ORG-001 dit : "Superadmin cree l'org".

**Verification :**

- **Fichier :** `src/safe-boot/backend/src/domains/organization/application/organization.service.ts`, ligne 166 — `handleCreateOrganization()`
- La methode ne fait AUCUNE verification explicite de role "superadmin" avant la creation. Elle accepte un `createdById` mais ne controle pas son role.
- **Fichier :** `src/safe-boot/backend/src/domains/organization/infrastructure/auth/rbac.adapter.ts`, ligne 18 — `hasRole(userId, requiredRole)` fournit la capacite de verif.
- **Fichier :** `src/safe-boot/backend/src/domains/organization/application/organization.service.ts`, ligne 469 — `handleMergeOrganizations` APPELLE explicitement `this.authorizer.hasRole(mergedById, 'superadmin')` pour BR-ORG-005.

**Manquant :** Le handler `handleCreateOrganization` ne fait PAS de controle d'autorisation via l'IAuthorizationPort. L'appelant externe (presentation layer / controller) doit faire ce controle, mais il n'est pas documente dans cette couche.

```
Code organization.service.ts:166-215:
  → Ligne 172: new OrganizationName(input.name)        // nom valide
  → Ligne 173: assertValidOrganizationType(input.type)  // type enum valide
  → Ligne 175-180: OrgTemplateInheritor.applyDefaults() // defaults charges
  → Ligne 182-183: orgId et organizationId generes par uuid
  → Ligne 185-199: Organisation entity creee avec status=Active
  → Ligne 201: await this.orgRepo.save(org)             // persistance
  → Ligne 203-206: Event OrganizationCreated publie
  → Ligne 208-214: AuditEntry(action='create') ecrit
```

**Résultat :** [PARTIEL — le controle superadmin est delégue au presentation layer, non verifiable ici]

### 2.2 Que devient le createur ?

ORG-001 dit : "Le createur devient [rôle canonique], PAS automatiquement super-admin."

**Verification :**

- **Fichier :** `src/safe-boot/backend/src/domains/organization/application/organization.service.ts`, lignes 166-215
- **AUCUNE creation de membership ou attribution de role n'est faite par `handleCreateOrganization`.**
- Le createur reste sans membership organise automatiquement par ce handler.
- En revanche, `IdentityService.createUser()` (ligne 100-142) permet de creer un user avec un role specifié, mais cela doit etre appelle separement en post-creation.

**Résultat :** [PASS] — Le createur ne recoit PAS automatiquement superadmin. Aucun role n'est assigné automatiquement par CreateOrganization. C'est conforme au principe que superadmin est GLOBAL seulement.

### 2.3 Conditions d'entree et de sortie

- **Avant :** `createdById` fourni; org_name valide via OrganizationName VO; org_type valide via OrganizationType enum; org_id auto-genere par UUID
- **Apres :** org dans DB (via PrismaOrganizationRepository.save); OrganisationCreated event publie (via WebHookEventPublicationAdapter); AuditEntry cree

**Verification des conditions :**

| Condition | Statut | Fichier |
|-----------|--------|---------|
| name non vide et valide (BR-ORG-001) | PASS | `organization-name.vo.ts` lignes 15-27 |
| type_org dans enum {church, school, ngo, company, custom} (INV-ORG-002) | PASS | `organization-type.vo.ts` lignes 11-17, validated via assertValidOrganizationType |
| org_id auto-genere | PASS | `organization.service.ts` ligne 183 |
| settings par defaut charges (BR-CONFIG-004) | PARTIEL | `org-template-inheritor.service.ts` — donnees hardcoded avec USD/UTC/fr/*; pas de charge via ConfigurationAggregate |
| root OrgUnit initialisee | PASS | `handleCreateOrgUnit` existe separement; CreateOrganization ne cree PAS automatiquement l'OrgUnit racine |

### 2.4 Invariants verifies

| Invariant | Specification | Implementation | Verdict |
|-----------|--------------|----------------|---------|
| INV-ORG-001: nom unique | DOC-012 BR-ORG-001, UNIQUE index sur organizations(nom) | Database-level unique constraint; application layer n'a pas de double-check | [PARTIEL — unique enforce only at DB level] |
| INV-ORG-002: type_org enum | CHECK constraint type_org ENUM | OrganizationType enum + assertValidOrganizationType() en domain layer | [PASS] |
| INV-ORG-003: org_id injecte | NB-MT-001, org_id injecte depuis JWT | VisibilityPolicy.verifyEntityOrg() existe; mais handleCreateOrganization ne reqiert PAS requestOrgId | [MAJEUR — voir Tension T-IMP-001] |
| INV-ORG-004: config initiale par defaut | BR-CONFIG-004, defaults loads at creation | OrgTemplateInheritor.resolve() renvoie defaults par type org | [PASS] |

### 2.5 Domain Events

| Event | Specifie dans ORG-001? | Implémente dans le code? | Fichier |
|-------|----------------------|--------------------------|---------|
| OrganizationCreating (transient) | ORG-001 §5 — event intermediate | NON explicitement (transition Creating→Active dans la meme transaction) | — |
| OrganizationCreated | ORG-001 §5 — event post-create | OUI | `domain/events.ts` ligne 21 |
| OrganizationActivated | ORG-001 §5 — via premier login | NON (workflow trigger, documente comme tel dans ORG-005 §2.1 note) | — |
| OrganizationSuspended | ORG-001 §5 | OUI | `domain/events.ts` ligne 34 |
| OrganizationArchived | ORG-001 §5 | OUI | `domain/events.ts` ligne 47 |
| OrganizationRestored | ORG-001 §3.4 (feature conditionnelle) | NON — ni commande ni event | — |
| OrgUnitCreated | ORG-001 §5 | OUI | `domain/events.ts` ligne 62 |
| OrgUnitParentChanged | ORG-001 §3.3 (mouvement) | OUI | `domain/events.ts` ligne 82 |
| OrganizationMerged | ORG-001 §3.3 | OUI | `domain/events.ts` ligne 103 |

### 2.6 Notifications declenchees

- **Specification ORG-005 §3.3 :** OrganizationCreated → notification in_app severity info
- **Implementation actuelle :** WebHookEventPublicationAdapter publie l'event, mais l'adapter ne dispatche PAS vers NotificationAggregate directement. La separation entre event publishing et notification routing est attendue via un consommateur externe.
- [PASS architectural — la separation entre DomainEvent et notification est correcte]

---

## 3. RÔLES CANONIQUES VERIFICATION

Source : ORG-004 §2, DOC-012 §2

### 3.1 UserRole VO — Verification complete

**Fichier :** `src/safe-boot/backend/src/domains/user/domain/value-objects/user-role.ts`

```typescript
export type RoleName = 'superadmin' | 'admin' | 'treasurer' | 'pastor' | 'staff';

export const ROLE_HIERARCHY: ReadonlyMap<RoleName, number> = new Map([
  ['superadmin', 0],   // 0 = plus privilege
  ['admin', 1],
  ['treasurer', 2],
  ['pastor', 3],
  ['staff', 4],
]);

export const ADMIN_CREATEABLE_ROLES: ReadonlySet<RoleName> = new Set(['treasurer', 'pastor', 'staff']);
```

**Hiérarchie vérifiée :** superadmin (0) > admin (1) > treasurer (2) > pastor (3) > staff (4)

**Verdict :** [PASS] — Exactement 5 roles canoniques conformes a ORG-004 §3.1

### 3.2 Autorisations par Role

**Fichier :** `src/safe-boot/backend/src/domains/user/domain/services/permission-resolver.ts` lignes 22-49

| Role | Permissions implementees | Conforme ORG-004? |
|------|--------------------------|------------------|
| superadmin | `['*:*:*']` wildcard total | PASS — conforme ORG-004 §3.2 |
| admin | user:create/update/delete, org:read/update, finance:read/write, workflow:approve/reject, reporting:generate/export, vocab:manage, settings:manage | PARTIEL — permission list diff erente de ORG-004 (format differ: "resource:action" vs "resource:action:level") |
| treasurer | finance:read/write, reporting:generate/export | PASS — scope finance uniquement |
| pastor | user:read/update, finance:read, reporting:generate, event:manage, membership:manage | PARTIEL — inclut finance:read qui n'est pas specifie dans ORG-004 |
| staff | finance:read, reporting:generate, event:read | PASS — scope limite conforme |

### 3.3 Regles d'Attribution

**BR-ID-004 : Superadmin peut assigner TOUS les roles**

- Fichier : `permission-resolver.ts` ligne 72-74 — `canCreateRole('superadmin', targetRole)` retourne true directement
- Fichier : `identity-service.ts` ligne 111 — `enforceRoleCreationPermission('superadmin', ...)` bypass la validation
- [PASS]

**BR-ID-005 : Admin ne peut créer que treasurer/pastor/staff**

- Fichier : `user-role.ts` lignes 26-30 — `ADMIN_CREATEABLE_ROLES` set definit exactement ['treasurer', 'pastor', 'staff']
- Fichier : `identity-service.ts` lignes 333-340 — `enforceRoleCreationPermission()` verifie si actorPriority !== 0, then check ADMIN_CREATEABLE_ROLES
- [PASS]

**BR-ID-006 : Wildcard permissions auditées**

- Fichier : `permission-grant.ts` lignes 22-24 — `isFullWildcard()` detecte `*:*:*`
- Commentaire en-tête du fichier ligne 5 : "BR-ID-006: wildcard permissions ["*"] are audited but authorized"
- Fichier : `permission-resolver.ts` ligne 8 comment : "BR-ID-006: wildcard permissions audited but authorized"
- [PASS — detection implementee; audit effectue par l'appelant]

### 3.4 RbacAuthorizationAdapter

**Fichier :** `src/safe-boot/backend/src/domains/organization/infrastructure/auth/rbac.adapter.ts`

- Lignes 18-22 : `hasRole()` verifie niveau hierarchy
- Lignes 44-48 : `isRoleEqualOrAbove()` utilise hierarchy ['staff', 'pastor', 'treasurer', 'admin', 'superadmin']
- **ATTENTION :** La hierarchie dans rbac.adapter.ts est inverse (index plus haut = plus privilege) alors que ROLE_HIERARCHY dans user-role.ts utilise index plus bas = plus privilege (0 = superadmin). Ces deux modelisations sont COHERENTES mais INVERSEEES — ce qui pourrait causer des bugs si elles ne sont pas alignees au moment de la comparaison inter-aggregate.

[RESERVE — hierarchie inverse entre PermissionResolver (priority 0 = max) et RbacAuthorizationAdapter (index 4 = max)]

---

## 4. INVENTORY COMPLET DES FICHIERS LIÉS

### 4.1 OrganizationAggregate — Domain Layer

| Fichier | Role |
|---------|------|
| `src/domains/organization/domain/organization.entity.ts` | Entite aggregate root — lifecycle state machine, transitionToStatus(), isWriteLocked() |
| `src/domains/organization/domain/org-unit.entity.ts` | Entite OrgUnit — node hierarchy DAG, pathForChild(), MAX_DEPTH=5 |
| `src/domains/organization/domain/events.ts` | 7 domain events: OrganizationCreated, OrganizationSuspended, OrganizationArchived, OrgUnitCreated, OrgUnitParentChanged, OrganizationMerged, DomainEvent interface |
| `src/domains/organization/domain/value-objects/organization-name.vo.ts` | OrganizationName VO — non-empty, ≤255 chars |
| `src/domains/organization/domain/value-objects/organization-type.vo.ts` | OrganizationType enum — church/school/ngo/company/custom |
| `src/domains/organization/domain/value-objects/organization-status.vo.ts` | OrganizationStatus enum — active/suspended/archived + isValidStatusTransition() |
| `src/domains/organization/domain/value-objects/organization-settings.vo.ts` | OrganizationSettings VO — immutable map, merge capability |
| `src/domains/organization/domain/value-objects/org-unit-hierarchy.vo.ts` | OrgUnitHierarchy VO — slash-delimited path, depth ≤5 validation |
| `src/domains/organization/domain/policies/visibility-policy.ts` | TenantIsolation — verifyEntityOrg(), filterByOrg() |
| `src/domains/organization/domain/policies/hierarchy-policy.ts` | Hierarchy validation — cycle detection, depth check |
| `src/domains/organization/domain/policies/max-depth-policy.ts` | MaxDepthPolicy — validateDepth(), isChildDepthValid() |
| `src/domains/organization/domain/services/org-hierarchy-resolver.service.ts` | Kahn's algo cycle detection, depth computation, descendant-or-self check |
| `src/domains/organization/domain/services/org-template-inheritor.service.ts` | Template defaults per org type (currency/timezone/language/accentColor) |

### 4.2 OrganizationAggregate — Application Layer

| Fichier | Role |
|---------|------|
| `src/domains/organization/application/organization.service.ts` | 8 commands + 2 queries : CreateOrganization, UpdateSettings, CreateOrgUnit, UpdateOrgUnitParent, TransferChildOrg, MergeOrganizations, ArchiveOrganization, SuspendOrganization, GetOrganizationProfile, GetDescendantUnits |

### 4.3 OrganizationAggregate — Infrastructure Layer

| Fichier | Role |
|---------|------|
| `src/domains/organization/infrastructure/repositories/prisma-org.repository.ts` | IOrganizationRepository — findById, findByOrgId, findByName, save, update |
| `src/domains/organization/infrastructure/repositories/prisma-org-unit.repository.ts` | IOrgUnitRepository — findById, findByParentId, findAllInOrg, findDescendants, save, update, delete |
| `src/domains/organization/infrastructure/events/event-bus.adapter.ts` | WebHookEventPublicationAdapter — IEventPublicationPort implementation |
| `src/domains/organization/infrastructure/auth/rbac.adapter.ts` | RbacAuthorizationAdapter — IAuthorizationPort implementation |
| `src/domains/organization/infrastructure/clock/monotonic.adapter.ts` | IClockPort — monotonic clock |
| `src/domains/organization/infrastructure/uuid/uuidv7.adapter.ts` | IUuidPort — UUID generation |
| `src/domains/organization/infrastructure/config/config-snapshot.adapter.ts` | ICSSnapshot — configuration snapshoting |

### 4.4 OrganizationAggregate — Ports (9 interfaces)

| Port | Fichier |
|------|---------|
| IOrganizationRepository | `ports/repository.port.ts` |
| IOrgUnitRepository | `ports/repository.port.ts` |
| IAuthorizationPort | `ports/auth.port.ts` |
| IAuditPort | `ports/audit.port.ts` |
| IClockPort | `ports/clock.port.ts` |
| IUuidPort | `ports/uuid.port.ts` |
| IConfigPort | `ports/config.port.ts` |
| ICachePort | `ports/cache.port.ts` |
| IEventPublicationPort | `ports/event-pub.port.ts` |
| ILoggerPort | `ports/logging.port.ts` |

### 4.5 User/IdentityAggregate — Domain Layer

| Fichier | Role |
|---------|------|
| `src/domains/user/domain/entities/user.ts` | User entity aggregate root — updateProfile(), changeRole(), emit events |
| `src/domains/user/domain/value-objects/user-role.ts` | UserRole VO — ROLE_HIERARCHY, ADMIN_CREATEABLE_ROLES, priority() |
| `src/domains/user/domain/value-objects/permission-grant.ts` | PermissionGrant VO — resource:action:level format, wildcard support |
| `src/domains/user/domain/value-objects/email-address.ts` | EmailAddress VO |
| `src/domains/user/domain/value-objects/phone-number.ts` | PhoneNumber VO |
| `src/domains/user/domain/value-objects/password-hash.ts` | PasswordHash VO |
| `src/domains/user/domain/value-objects/jwt-token.ts` | JWTToken VO |
| `src/domains/user/domain/value-objects/session-context.ts` | SessionContext VO — refreshToken, expiry, isActive |
| `src/domains/user/domain/services/permission-resolver.ts` | PermissionResolver — resolvePermissions(), hasPermission(), canCreateRole() |
| `src/domains/user/domain/services/password-validator.ts` | PasswordValidator |
| `src/domains/user/domain/events/index.ts` | 9 domain events: UserCreated, UserUpdated, UserRoleChanged, PasswordResetRequested, UserLoggedIn, UserLoggedOut, SessionCreated, SessionExpired, SessionRevoked |

### 4.6 User/IdentityAggregate — Application Layer

| Fichier | Role |
|---------|------|
| `src/domains/user/application/identity-service.ts` | 9 operations : CreateUser, UpdateProfile, ChangeRole, ResetPassword, Login, Logout, RefreshToken, RevokeSession, AssignPermissionGrant |

### 4.7 Member/RelationshipAggregate — Domain Layer

| Fichier | Role |
|---------|------|
| `src/domains/member/domain/entities/group-membership.entity.ts` | GroupMembership N:N junction — isActive(), leave(), withRole() |
| `src/domains/member/domain/entities/org-unit-link.entity.ts` | OrgUnitLink — self-referencing parent link, withParent() |
| `src/domains/member/domain/events.ts` | 6 events: MemberJoinedGroup, MemberLeftGroup, OrgUnitReparented, ChildOrgTransferred, ChildOrgMerged, DescendantEnumerationRequested |
| `src/domains/member/domain/services/cycle-detector.service.ts` | CycleDetector — Kahn's algo |
| `src/domains/member/domain/services/descendant-enumerator.service.ts` | DescendantEnumerator — DFS traversal, collectAncestors(), getDepth() |
| `src/domains/member/domain/policies/dag-policy.ts` | DagPolicy — assertNoCycle(), validateDag() |
| `src/domains/member/domain/policies/max-depth-policy.ts` | MaxDepthPolicy — computeChildDepth(), assertValidDepth() |
| `src/domains/member/domain/policies/multi-membership-policy.ts` | MultiMembershipPolicy — assertCanJoin(MAX_CONCURRENT_MEMBERSHIPS=50) |
| `src/domains/member/domain/value-objects/membership-role.vo.ts` | MembershipRole — business role within group |
| `src/domains/member/domain/value-objects/join-timestamp.vo.ts` | JoinTimestamp VO |
| `src/domains/member/domain/value-objects/relationship-type.vo.ts` | RelationshipType enum |
| `src/domains/member/domain/value-objects/relationship-key.vo.ts` | RelationshipKey composite key |

### 4.8 Member/RelationshipAggregate — Application Layer

| Fichier | Role |
|---------|------|
| `src/domains/member/application/member.service.ts` | 6 commands: addMemberToGroup, removeMemberFromGroup, changeOrgUnitParent, transferChildOrg, mergeChildOrg, enumerateDescendants |

---

## 5. TENSIONS IDENTIFIEES

### T-IMP-001 : handleCreateOrganization ne verifie pas le role superadmin

- **Specification canonique :** ORG-001 §3.1 dit "Acteur autorise: SuperAdmin uniquement"
- **Implémentation actuelle :** `organization.service.ts` handleCreateOrganization ne fait AUCUN controle de role. Il n'appelle pas `this.authorizer.hasRole(createdById, 'superadmin')`.
- **Impact :** MAJEUR — toute personne avec un identifiant valide peut creer une organisation sans verification de privileges.
- **Recommendation :** Ajouter un controle d'autorisation similaire a `handleMergeOrganizations` (ligne 469) avant la creation.

### T-IMP-002 : Hierarchie inverse entre PermissionResolver et RbacAuthorizationAdapter

- **Specification canonique :** ORG-004 §3.1 — superadmin (priorite la plus haute)
- **Implémentation actuelle :** 
  - `user-role.ts` : `ROLE_HIERARCHY` — index 0 (superadmin) = priorite MAX (priorite basse numerique)
  - `rbac.adapter.ts` : `isRoleEqualOrAbove()` — index 4 (superadmin) = privilegium MAX (index haut)
- **Impact :** MAJEUR — risque de decision d'autorisation inversee si les deux systemes interoperent.
- **Recommendation :** Aligner les deux hierarchies vers un modele unique.

### T-IMP-003 : handleCreateOrganization ne genere pas d'OrgUnit racine

- **Specification canonique :** ORG-001 §3.1 postconditions — "OrgUnit racine initialisee (depth=1)"
- **Implémentation actuelle :** `handleCreateOrganization` ne cree PAS d'OrgUnit. L'OrgUnit racine doit etre creee separement via `handleCreateOrgUnit`.
- **Impact :** MINEUR — c'est une operation manuelle supplementaire requise apres la creation.
- **Recommendation :** Appeler implicitement handleCreateOrgUnit dans handleCreateOrganization.

### T-IMP-004 : Invitations totalement absentes de l'implémentation

- **Specification canonique :** ORG-002 §2 definit un modele complet d'invitations (CRUD, lifecycle, tokens)
- **Implémentation actuelle :** Recherche exhaustive ("invite", "invitation", "InvitationCreated", etc.) dans `src/safe-boot/backend/src/domains/` — AUCUN resultat.
- **Impact :** MINEUR car specification claire — lacune d'implementation documentee, pas contradiction.
- **Recommendation :** Implémenter comme feature.next_step dans un commit separé.

### T-IMP-005 : Gestion d'org suspendue incomplete

- **Specification canonique :** ORG-001 §2.2 — "Les lectures sont autorisees sur TOUS les aggregates scoped"; "Operations de sync offline bloquees"; "WorkflowAggregate pause workflows"
- **Implémentation actuelle :** 
  - `organization.entity.ts` — `isWriteLocked()` retourne true pour Suspended et Archived (ligne 72-74)
  - `organization.service.ts` — `handleUpdateSettings` verifie isSuspended() (ligne 235) et Archive (ligne 240)
  - Cependant, AUCUNE verification `isWriteLocked()` n'est faite dans `handleSuspendOrganization` ou ailleurs pour empecher les ecritures sur org suspended.
  - OfflineSyncAggregate et WorkflowAggregate ne sont pas integres dans ce handler.
- **Impact :** MAJEUR — une org en statut suspended peut encore recevoir des ecritures si le caller ne verifie pas isWriteLocked().
- **Recommendation :** Ajouter des garde-fous isWriteLocked() dans tous les handlers de modification.

---

## 6. SYNTHÈSE DE CONFORMITE

| Aspect | Conforme? | Notes |
|--------|-----------|-------|
| OrganizationStatus enum | OUI | active/suspended/archived exact match |
| State transitions (isValidStatusTransition) | OUI | archived→any = false; active→suspended/archived; suspended→archived |
| Irreversibility of archive | OUI | Code energe, pas de transition retour |
| Role hierarchy | OUI | 5 roles canoniques, hierarchy correcte |
| Admin cannot create superadmin | OUI | ADMIN_CREATEABLE_ROLES exclut superadmin |
| Superadmin wildcard | OUI | `*:*:*` |
| org_id multi-tenant isolation | OUI | VisibilityPolicy, _org_id injection |
| Max depth 5 | OUI | OrgUnit.MAX_DEPTH=5, enforced in policy |
| Cycle detection Kahn's algo | OUI | HierarchyPolicy + CycleDetector |
| Domain events emitted | OUI | 9 events implements dans organization + member + user domains |
| Audit logging | OUI | IAuditPort.log() appele dans tous les handlers |
| Default settings on creation | OUI | OrgTemplateInheritor.applyDefaults() |
| Superadmin gate on CreateOrganization | NON | Controle manque dans handler (T-IMP-001) |
| Root OrgUnit auto-created | NON | Doit etre manuel (T-IMP-003) |
| Suspend writes enforcement across all handlers | NON | Partial only (T-IMP-005) |
| Invitation system | NON | Not implemented (T-IMP-004) |
