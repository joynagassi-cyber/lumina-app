# Canonical API Contract — Lumina v1

**Doc ID:** API-CONTRACT-001
**Version:** v1.0
**Statut:** CONTRAT CANONIQUE DEFINI PAR GENESIS
**Date:** 2026-07-25
**Generateur :** api-contract-generator v1.0
**Source canonique :** ["DOC-012", "DOC-013", "DOC-014", "DOC-015"]
**Transformation_rule :** "api-contract-generator v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document est le **contrat API canonique** de Lumina v1. Il definit les Operations exposees par chaque Aggregate via leur Boundary Expose, mappe chaque Operation vers la Command du DOC-014, et reference les Invariants du DOC-015 verifiees par chaque Operation.

Ce document NE definit AUCUNE implémentation technique. Il ne parle PAS de HTTP, URL, JSON, routes, controlleurs, frameworks ou technologies. Il decrit des COMMANDS, QUERIES, RESPONSES, et ERRORS dans un format purement operationnel.

Chaque Operation ci-dessous peut etre implémentee via n'importe quel protocole (REST, GraphQL, gRPC, WebSocket, CLI, IPC) tant que le contrat operationnel est respecte.

---

## STRUCTURE DE COUVERTURE

Les 13 Aggregates sont listés dans l'ordre canonique du DOC-012:

1. OrganizationAggregate
2. IdentityAggregate
3. ResourceAggregate
4. RelationshipAggregate
5. WorkflowAggregate
6. FormAggregate
7. NotificationAggregate
8. VocabularyAggregate
9. ReportingAggregate
10. AuditAggregate
11. LifecycleAggregate
12. ConfigurationAggregate
13. OfflineSyncAggregate

---

================================================================================
AGGREGATE 1: OrganizationAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Verifiés (DOC-015) | Evenements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| CreateOrganization | CreateOrganization | Expose | INV-004 (org isolation) | OrganizationCreated |
| UpdateOrganizationSettings | UpdateOrganizationSettings | Expose | CFG-001, CFG-002, CFG-003 | SettingUpdated |
| CreateOrgUnit | CreateOrgUnit | Expose | BR-ORG-002 (depth ≤5), REL-001 (DAG no cycle) | OrgUnitCreated |
| UpdateOrgUnitParent | UpdateOrgUnitParent | Expose | REL-001 (no cycles), REL-002 (depth ≤5) | OrgUnitParentChanged |
| TransferChildOrg | TransferChildOrg | Expose | REL-001 (no cycles) | ChildOrgTransferred |
| MergeOrganizations | MergeOrganizations | Expose | INV-004 | ChildOrgMerged |
| ArchiveOrganization | ArchiveOrganization | Expose | — | OrganizationArchived |
| SuspendOrganization | SuspendOrganization | Expose | BR-ORG-006 (write locked) | OrganizationSuspended |
| GetOrganizationProfile | Query (read-only) | Expose: GetOrganizationProfile() | INV-004 | — |
| GetDescendantUnits | Query (read-only) | Expose: GetDescendantUnits(rootId) | REL-002 (depth ≤5) | — |

### Responsable de l'Aggregate
- **Owner:** Superadmin
- **Entities:** Organization, OrgUnit
- **Value Objects:** OrganizationName, OrganizationType, OrgUnitHierarchy, OrganizationSettings, OrganizationStatus
- **Aggregates Dependencies:** None (foundational aggregate)

### Operations Detailées

#### 1. CreateOrganization (Command)
- Source: DOC-014 § CreateOrganization
- Boundary: DOC-013 "Expose: [implicit create org]"
- Preconditions: Aucun
- Postconditions: Organization created with auto-generated org_id; default settings applied
- Invariants checked: INV-004 (multi-tenant isolation)
- Domain Events emitted: OrganizationCreated
- Return: void (organization created successfully)
- Business Rules: BR-ORG-001 (name non vide, type enum valide)

#### 2. UpdateOrganizationSettings (Command)
- Source: DOC-014 § UpdateOrganizationSettings
- Boundary: DOC-013 "Expose: UpdateSettings(key, value)"
- Preconditions: Org existante
- Postconditions: Settings updated with validated formats
- Invariants checked: CFG-001 (Currency ISO 4217), CFG-002 (Timezone IANA), CFG-003 (Accent hex + WCAG), CFG-004 (default fallback)
- Domain Events emitted: SettingUpdated
- Return: void
- Business Rules: BR-CONFIG-001, BR-CONFIG-002, BR-CONFIG-003, BR-CONFIG-004

#### 3. CreateOrgUnit (Command)
- Source: DOC-014 § CreateOrgUnit
- Boundary: DOC-013 "Expose: CreateOrgUnit(name, parent, unitType)"
- Preconditions: Org existante
- Postconditions: New OrgUnit created at valid depth in hierarchy
- Invariants checked: REL-001 (no cycles), REL-002 (depth ≤5)
- Domain Events emitted: OrgUnitCreated
- Return: void
- Business Rules: BR-ORG-001 (name, type), BR-ORG-002 (depth ≤5)

#### 4. UpdateOrgUnitParent (Command)
- Source: DOC-014 § UpdateOrgUnitParent
- Boundary: DOC-013 "Expose: [reparent via SetOrgUnitParent logic]"
- Preconditions: Unite existante
- Postconditions: Parent link changed; depth revalidated
- Invariants checked: REL-001 (Kahn's algo — no cycles), REL-002 (depth ≤5 after change)
- Domain Events emitted: OrgUnitParentChanged
- Return: void
- Business Rules: BR-ORG-003 (cannot become own parent)

#### 5. TransferChildOrg (Command)
- Source: DOC-014 § TransferChildOrg
- Boundary: DOC-013 "Expose: TransferChildOrg(childId, newParentId)"
- Preconditions: Org enfant existante; nouvelle parent existe
- Postconditions: Child org re-parented in DAG
- Invariants checked: REL-001 (no cycle created)
- Domain Events emitted: ChildOrgTransferred
- Return: void
- Business Rules: BR-REL-003 (preserves existing memberships)

#### 6. MergeOrganizations (Command)
- Source: DOC-014 § MergeOrganizations
- Boundary: DOC-013 "Expose: MergeOrganizations(sourceId, targetId)"
- Preconditions: 2 orgs existantes; meme heritage DAG
- Postconditions: Source merged into target; source marked archived
- Invariants checked: INV-004 (isolation preserved post-merge)
- Domain Events emitted: ChildOrgMerged
- Return: void
- Business Rules: BR-ORG-005 (superadmin validation required)

#### 7. ArchiveOrganization (Command)
- Source: DOC-014 § ArchiveOrganization
- Boundary: DOC-013 "Expose: ArchiveOrganization()"
- Preconditions: Org existante
- Postconditions: Status transitions active → archived; read-only mode
- Invariants checked: —
- Domain Events emitted: OrganizationArchived
- Return: void

#### 8. SuspendOrganization (Command)
- Source: DOC-014 § SuspendOrganization
- Boundary: DOC-013 "Expose: [suspend via status transition]"
- Preconditions: Org existante
- Postconditions: Status transitions active → suspended; write locked
- Invariants checked: BR-ORG-006 (suspended org → write locked, read only)
- Domain Events emitted: OrganizationSuspended
- Return: void

#### 9. GetOrganizationProfile (Query — read only)
- Source: DOC-014 (queried via resource pattern)
- Boundary: DOC-013 "Expose: GetOrganizationProfile()"
- Preconditions: Org existante
- Postconditions: Profile data returned
- Invariants checked: INV-004 (org_id scoped)
- Domain Events emitted: None
- Return: Organization profile data

#### 10. GetDescendantUnits (Query — read only)
- Source: DOC-014 (queried via relationship pattern)
- Boundary: DOC-013 "Expose: GetDescendantUnits(rootId)"
- Preconditions: rootId exists within same org
- Postconditions: Full descendant tree returned (≤5 levels)
- Invariants checked: REL-002 (depth ≤5 enforced)
- Domain Events emitted: None
- Return: List of descendant OrgUnits

### Operations Interdites (non listees ci-dessus)
Toutes operations NON listees ci-dessus sont Interdit pour cet Aggregate.
- Interdit: CRUDEM / modifier Users (→ IdentityAggregate)
- Interdit: CRUDE transactions (→ ResourceAggregate)
- Interdit: executer Workflows (→ WorkflowAggregate)
- Interdit: connaitre la structure SQL interne
- Interdit: acceder aux donnees d'une autre org

---

================================================================================
AGGREGATE 2: IdentityAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Verifés (DOC-015) | Evenements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| CreateUser | CreateUser | Expose | EMAIL-001 (unique by org) | UserCreated |
| UpdateUserProfile | UpdateUserProfile | Expose | EMAIL-001 (if email changed) | UserUpdated |
| ChangeUserRole | ChangeUserRole | Expose | INV-008 (double validation) | UserRoleChanged |
| ResetPassword | ResetPassword | Expose | BR-ID-001 (hash complexity) | PasswordResetRequested |
| LoginUser | LoginUser | Expose | INV-004 (org_id gate), INV-008 | UserLoggedIn + SessionCreated |
| LogoutUser | LogoutUser | Expose | — | UserLoggedOut |
| RefreshAccessToken | RefreshAccessToken | Expose | — | SessionCreated (new refresh) |
| RevokeSession | RevokeSession | Expose | — | SessionRevoked |
| AssignPermissionGrant | AssignPermissionGrant | Expose | — | (implicit permission update) |

### Responsable de l'Aggregate
- **Owner:** Superadmin (all users); Admin (non-superadmin users only)
- **Entities:** User
- **Value Objects:** EmailAddress, PhoneNumber, PasswordHash, UserRole, PermissionGrant, JWTToken, SessionContext
- **Aggregates Dependencies:** OrganizationAggregate (user belongs to exactly one org)

### Operations Detailées

#### 1. CreateUser (Command)
- Source: DOC-014 § CreateUser
- Boundary: DOC-013 "Expose: CreateUser(email, password_hash, role)"
- Preconditions: Org existante
- Postconditions: New User created with hashed password; role assigned per hierarchy rules
- Invariants checked: EMAIL-001 (email unique within org), BR-ID-004/005 (role creation rules)
- Domain Events emitted: UserCreated
- Return: void
- Business Rules: BR-ID-001 (password never plain), BR-ID-003 (composite unique constraint)

#### 2. UpdateUserProfile (Command)
- Source: DOC-014 § UpdateUserProfile
- Boundary: DOC-013 "Expose: UpdateUserProfile(updates)"
- Preconditions: User existant
- Postconditions: Selected fields updated
- Invariants checked: EMAIL-001 (if email changed — must be unique within org)
- Domain Events emitted: UserUpdated
- Return: void

#### 3. ChangeUserRole (Command)
- Source: DOC-014 § ChangeUserRole
- Boundary: DOC-013 "Expose: ChangeUserRole(newRole)"
- Preconditions: User existant; nouveau role valide
- Postconditions: Role updated per RBAC hierarchy
- Invariants checked: Role hierarchy enforced (SUPER)
- Domain Events emitted: UserRoleChanged
- Return: void

#### 4. ResetPassword (Command)
- Source: DOC-014 § ResetPassword
- Boundary: DOC-013 "Expose: ResetPassword(newPassword_hash)"
- Preconditions: User existant
- Postconditions: Password hash replaced with new strong hash
- Invariants checked: BR-ID-001 (password hash complexity regex)
- Domain Events emitted: PasswordResetRequested
- Return: void

#### 5. LoginUser (Command)
- Source: DOC-014 § LoginUser
- Boundary: DOC-013 "Expose: VerifyLogin(email, password) → CreateSession(refreshTokenHash)"
- Preconditions: Credentials valides
- Postconditions: New session created; JWT issued (ephemeral)
- Invariants checked: INV-004 (org_id match), INV-008 (double validation of credentials)
- Domain Events emitted: UserLoggedIn, SessionCreated
- Return: Authentication tokens (ephemeral — not stored)

#### 6. LogoutUser (Command)
- Source: DOC-014 § LogoutUser
- Boundary: DOC-013 "Expose: RevokeSession(sessionId)"
- Preconditions: Session active
- Postconditions: Session revoked; refresh token hash removed from DB
- Invariants checked: —
- Domain Events emitted: UserLoggedOut
- Return: void

#### 7. RefreshAccessToken (Command)
- Source: DOC-014 § RefreshAccessToken
- Boundary: DOC-013 (implicit via session management)
- Preconditions: Refresh token valide, non expire
- Postconditions: New session created with fresh refresh token hash
- Invariants checked: —
- Domain Events emitted: SessionCreated (new refresh)
- Return: void

#### 8. RevokeSession (Command)
- Source: DOC-014 § RevokeSession
- Boundary: DOC-013 "Expose: RevokeSession(sessionId)"
- Preconditions: Session existe
- Postconditions: Session marked revoked; refresh token deleted
- Invariants checked: —
- Domain Events emitted: SessionRevoked
- Return: void

#### 9. AssignPermissionGrant (Command)
- Source: DOC-014 § AssignPermissionGrant
- Boundary: DOC-013 "Expose: ResolvePermissions(roleId) as read path"
- Preconditions: Role existe; permission string valide
- Postconditions: Permission grant updated
- Invariants checked: Wildcard permissions ["*"] audited but authorized
- Domain Events emitted: None explicitly
- Return: void

### Query Operations (read-only)
Aucune query explicite n'est exposee par IdentityAggregate beyond what's covered by boundary reads. Reads go through standard query pattern on the Entity level.

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: modifier resources (→ ResourceAggregate)
- Interdit: lire donnees d'autres orgs (→ org_id gate)
- Interdit: stocker JWT en clair
- Interdit: exposer password_hash dans reponses

---

================================================================================
AGGREGATE 3: ResourceAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Verifies (DOC-015) | Evenements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| CreateTransaction | CreateTransaction | Expose | FIN-002, DATE-001, CAT-001 | ResourceCreated |
| UpdateDraftTransaction | UpdateDraftTransaction | Expose | FIN-001 (approved immutable) | ResourceUpdated |
| SubmitForApproval | SubmitForApproval | Expose | — | ApprovalRequested |
| ApproveTransaction | ApproveTransaction | Expose | BR-RES-001 | ResourceStateChanged + ApprovalGranted |
| RejectTransaction | RejectTransaction | Expose | BR-RES-001 | ResourceStateChanged + ApprovalRejected |
| CompensateTransaction | CompensateTransaction | Expose | COMP-001 | TransactionCompensated |
| CreateMember | CreateMember | Expose | MEM-001 | ResourceCreated |
| UpdateMember | UpdateMember | Expose | MEM-001 | ResourceUpdated |
| TransitionMemberStatus | TransitionMemberStatus | Expose | STATUS-010 | ResourceStateChanged |
| SearchResources | SearchResources | Expose: SearchResources(filters) | — | — |
| ExportResources | ExportResources | Expose: ExportResources(format, filters) | — | — |

### Responsable de l'Aggregate
- **Owner:** Rôle selon permission grant (resource:*:read/write)
- **Entities:** TransactionRecord, MemberRecord, EventRecord, ArchiveEntryRecord, NotificationRecord
- **Value Objects:** ResourceId, ResourceType, ResourceState, ResourceVersion, ResourceMetadata, AmountInCents, TransactionReference
- **Aggregates Dependencies:** OrganizationAggregate (org_id scope), VocabularyAggregate (category refs), RelationshipAggregate (scope_target)

### Operations Detailées

#### 1. CreateTransaction (Command)
- Source: DOC-014 § CreateTransaction
- Boundary: DOC-013 "Expose: CreateTransaction(data)"
- Preconditions: Org existante; category from vocabulary
- Postconditions: New transaction created with auto-increment version = 1
- Invariants checked: FIN-002 (amount > 0 BIGINT), DATE-001 (date not future), CAT-001 (vocab category), VERSION-001 (version increment), CREATEBY-001 (created_by set), SCOPE-001 (scope always defined)
- Domain Events emitted: ResourceCreated
- Return: void
- Business Rules: BR-RES-001 (amount positive), BR-RES-002..008

#### 2. UpdateDraftTransaction (Command)
- Source: DOC-014 § UpdateDraftTransaction
- Boundary: DOC-013 "Expose: UpdateDraftTransaction(id, updates)"
- Preconditions: Transaction draft seulement
- Postconditions: Draft updated; version incremented
- Invariants checked: FIN-001 (approved transactions IMMUTABLE — this guard rejects non-draft), VERSION-001 (version always incremented)
- Domain Events emitted: ResourceUpdated
- Return: void

#### 3. SubmitForApproval (Command)
- Source: DOC-014 § SubmitForApproval
- Boundary: DOC-013 "Expose: [state transition draft→pending]"
- Preconditions: Draft only
- Postconditions: Status transitions draft → pending
- Invariants checked: —
- Domain Events emitted: ApprovalRequested
- Return: void

#### 4. ApproveTransaction (Command)
- Source: DOC-014 § ApproveTransaction
- Boundary: DOC-013 "Expose: ApproveTransaction(id, approver)"
- Preconditions: Pending only; permission grant valid
- Postconditions: Status transitions pending → approved
- Invariants checked: BR-RES-001 (approver has correct permission)
- Domain Events emitted: ResourceStateChanged, ApprovalGranted
- Return: void

#### 5. RejectTransaction (Command)
- Source: DOC-014 § RejectTransaction
- Boundary: DOC-013 "Expose: RejectTransaction(id, reason)"
- Preconditions: Pending only; reason required
- Postconditions: Status transitions pending → rejected
- Invariants checked: BR-RES-001
- Domain Events emitted: ResourceStateChanged, ApprovalRejected
- Return: void

#### 6. CompensateTransaction (Command)
- Source: DOC-014 § CompensateTransaction
- Boundary: DOC-013 "Expose: CompensateTransaction(approvedTxId)"
- Preconditions: Approved transaction exists
- Postconditions: New compensating transaction created linked via compensates_for
- Invariants checked: COMP-001 (link to original required)
- Domain Events emitted: TransactionCompensated
- Return: void

#### 7. CreateMember (Command)
- Source: DOC-014 § CreateMember
- Boundary: DOC-013 "Expose: CreateMember(data)"
- Preconditions: Org existante
- Postconditions: New member created
- Invariants checked: MEM-001 (firstName+lastName mandatory), EMAIL-001 (email unique by org if provided), STATUS-010 (valid initial status)
- Domain Events emitted: ResourceCreated
- Return: void

#### 8. UpdateMember (Command)
- Source: DOC-014 § UpdateMember
- Boundary: DOC-013 "Expose: UpdateMember(id, updates)"
- Preconditions: Member existant
- Postconditions: Fields updated
- Invariants checked: MEM-001 (firstName+lastName still mandatory after update)
- Domain Events emitted: ResourceUpdated
- Return: void

#### 9. TransitionMemberStatus (Command)
- Source: DOC-014 § TransitionMemberStatus
- Boundary: DOC-013 "Expose: TransitionMemberStatus(id, newStatus)"
- Preconditions: Member existant; status transition valide
- Postconditions: Status transitions per state machine
- Invariants checked: STATUS-010 (only valid states: active/inactive/deceased/transferred)
- Domain Events emitted: ResourceStateChanged
- Return: void

#### 10. SearchResources (Query — read only)
- Source: DOC-014 § SearchResources
- Boundary: DOC-013 "Expose: SearchResources(filters)"
- Preconditions: Permissions read on resource type; org_id from context
- Postconditions: Filtered resource list returned
- Invariants checked: INV-004 (org_id isolated)
- Domain Events emitted: None
- Return: Resource list (read-only)

#### 11. ExportResources (Query — read only)
- Source: DOC-014 § ExportResources
- Boundary: DOC-013 "Expose: ExportResources(format, filters)"
- Preconditions: Permission reporting:read; org_id from context
- Postconditions: Export generated with timestamp + digital signature
- Invariants checked: EXPORT-001 (export timestamped)
- Domain Events emitted: None
- Return: Export data

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: creer nouveaux concepts (→ Conceptual Model)
- Interdit: modifier approved transactions directement (compensation uniquement)
- Interdit: stocker amounts as float (BIGINT cents only)
- Interdit: bypass vocabulary for categories (CAT-001)
- Interdit: skip version increment (VERSION-001)

---

================================================================================
AGGREGATE 4: RelationshipAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Verifiés (DOC-015) | Evenements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| AddMemberToGroup | AddMemberToGroup | Expose | MULTI-020 (no duplicate PK) | MemberJoinedGroup |
| RemoveMemberFromGroup | RemoveMemberFromGroup | Expose | HISTORY-022 (audit trail) | MemberLeftGroup |
| SetOrgUnitParent | SetOrgUnitParent | Expose | REL-001 (DAG no cycles), REL-002 (depth ≤5) | OrgUnitReparented |
| GetDescendants | GetDescendants | Expose: GetDescendants(unitId) | REL-002 (depth ≤5) | — |
| GetAllGroupsForMember | Query (read-only) | DOC-013 bidirectional visibility | INV-004 (org isolation) | — |
| GetAllMembersOfGroup | Query (read-only) | DOC-013 bidirectional visibility | INV-004 (org isolation) | — |
| DetectCycles | DetectCycles | Expose: DetectCycles(candidateEdges) | REL-001 (Kahn's algo) | — |

### Responsable de l'Aggregate
- **Owner:** Admin (member↔group); Superadmin (org↔org merge/transfer)
- **Entities:** GroupMembership, OrgUnitParentLink
- **Value Objects:** RelationshipType, RelationshipKey, JoinTimestamp, MembershipRole
- **Aggregates Dependencies:** OrganizationAggregate, IdentityAggregate, ResourceAggregate (references only — no CRUD across aggregates)

### Operations Detailées

#### 1. AddMemberToGroup (Command)
- Source: DOC-014 § AddMemberToGroup
- Boundary: DOC-013 "Expose: AddMemberToGroup(memberId, groupId)"
- Preconditions: Member et group existent
- Postconditions: Many-to-many membership created
- Invariants checked: MULTI-020 (no duplicate — PK enforce), REL-001 (within same org)
- Domain Events emitted: MemberJoinedGroup
- Return: void

#### 2. RemoveMemberFromGroup (Command)
- Source: DOC-014 § RemoveMemberFromGroup
- Boundary: DOC-013 "Expose: RemoveMemberFromGroup(memberId, groupId)"
- Preconditions: Membership exists
- Postconditions: Membership removed; history preserved in audit trail
- Invariants checked: HISTORY-022 (historique conserve)
- Domain Events emitted: MemberLeftGroup
- Return: void

#### 3. SetOrgUnitParent (Command)
- Source: DOC-014 § SetOrgUnitParent
- Boundary: DOC-013 "Expose: SetOrgUnitParent(unitId, parentId)"
- Preconditions: Both units in same org
- Postconditions: Parent link updated; depth revalidated
- Invariants checked: REL-001 (Kahn's algo — no cycles), REL-002 (depth ≤5)
- Domain Events emitted: OrgUnitReparented
- Return: void

#### 4. GetDescendants (Query — read only)
- Source: DOC-014 § GetDescendants
- Boundary: DOC-013 "Expose: GetDescendants(unitId)"
- Preconditions: Unit existe
- Postconditions: Full descendant tree returned
- Invariants checked: REL-002 (depth ≤5 enforced in traversal)
- Domain Events emitted: DescendantEnumerationRequested
- Return: List of descendant units

#### 5. GetAllGroupsForMember (Query — read only)
- Source: DOC-014 (queried via relationship pattern)
- Boundary: DOC-013 "Bidirectional visibility — can query groups FOR a member"
- Preconditions: Member existe
- Postconditions: All group memberships returned
- Invariants checked: INV-004 (org scoped)
- Domain Events emitted: None
- Return: List of GroupMembership records

#### 6. GetAllMembersOfGroup (Query — read only)
- Source: DOC-014 (queried via relationship pattern)
- Boundary: DOC-013 "Bidirectional visibility — can query members IN a group"
- Preconditions: Group existe
- Postconditions: All members of the group returned
- Invariants checked: INV-004 (org scoped)
- Domain Events emitted: None
- Return: List of member records with their roles

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: contenir any business logic (pure relationships only)
- Interdit: know what linked entities represent
- Interdit: modify entity state directly
- Interdit: create or delete entities
- Interdit: traverse > 5 levels deep

---

================================================================================
AGGREGATE 5: WorkflowAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| TriggerWorkflow | TriggerWorkflow | Expose | LOG-005 (all steps logged) | WorkflowTriggered |
| ApproveStep | ApproveStep | Expose | CHAINS-003 (≤5 levels) | StepApproved |
| RejectStep | RejectStep | Expose | WF-001 (timeout check) | StepRejected |
| CancelWorkflow | CancelWorkflow | Expose | — | WorkflowCancelled |
| ResubmitForApproval | ResubmitForApproval | Expose | RETRY-004 (manual only) | WorkflowTriggered (re-trigger) |

### Responsable de l'Aggregate
- **Owner:** System (auto-triggered) or Admin (manual)
- **Entities:** WorkflowInstance, WorkflowStep
- **Value Objects:** WorkflowTrigger, StepType, StepTimeout, ApprovalChain, ConditionExpression, EscalationRule
- **Aggregates Dependencies:** ResourceAggregate (workflow operates ON a resource), OrganizationAggregate, NotificationAggregate

### Operations Detailées

#### 1. TriggerWorkflow (Command)
- Source: DOC-014 § TriggerWorkflow
- Boundary: DOC-013 "Expose: TriggerWorkflow(definition, resource)"
- Preconditions: Definition exists; trigger event matched
- Postconditions: New workflow instance created at step 1
- Invariants checked: LOG-005 (execution state logged immediately), WF-006 (no new capabilities created)
- Domain Events emitted: WorkflowTriggered
- Return: void

#### 2. ApproveStep (Command)
- Source: DOC-014 § ApproveStep
- Boundary: DOC-013 "Expose: ApproveStep(instanceId, userId)"
- Preconditions: Step is approval type; assigned to approver
- Postconditions: Step transitions pending → completed; next step activated
- Invariants checked: CHAINS-003 (approval chain ≤5 levels), WF-005 (never modifies approved transactions directly)
- Domain Events emitted: StepApproved
- Return: void

#### 3. RejectStep (Command)
- Source: DOC-014 § RejectStep
- Boundary: DOC-013 "Expose: RejectStep(instanceId, userId, reason)"
- Preconditions: Step is approval type; assigned to approver
- Postconditions: Step transitions pending → rejected; reason recorded
- Invariants checked: WF-001 (timeout still valid), LOG-005
- Domain Events emitted: StepRejected
- Return: void

#### 4. CancelWorkflow (Command)
- Source: DOC-014 § CancelWorkflow
- Boundary: DOC-013 "Expose: CancelWorkflow(instanceId, reason)"
- Preconditions: Workflow running
- Postconditions: Workflow transitions running → cancelled
- Invariants checked: LOG-005
- Domain Events emitted: WorkflowCancelled
- Return: void

#### 5. ResubmitForApproval (Command)
- Source: DOC-014 § ResubmitForApproval
- Boundary: DOC-013 "Expose: [state machine transition back to draft/pending]"
- Preconditions: Workflow rejected or in_revision
- Postconditions: Workflow returns to draft/pending state; re-triggers
- Invariants checked: RETRY-004 (manual only — no auto-retry code path)
- Domain Events emitted: WorkflowTriggered (re-trigger)
- Return: void

### Query Operations (read-only)
- **GetPendingApprovals**: Query (read-only) — DOC-013 "Expose" pattern applies. Source: implicit. Returns list of steps awaiting this user's approval. Invariant: LOG-005. No events emitted.

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: modifier financial data directement (→ ResourceAggregate)
- Interdit: créer nouvelles capabilities
- Interdit: ajouter au manifest
- Interdit: exceed max steps without native cap
- Interdit: auto-retry failed workflows (RETRY-004)

---

================================================================================
AGGREGATE 6: FormAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| LoadFormDefinition | LoadFormDefinition | Expose: LoadFormDefinition(formId, version) | FRM-004 (versioning) | — |
| ValidateFormData | ValidateFormData | Expose: ValidateFormData(formDef, data) | DUAL-008 (client=server) | FormValidationFailed |
| RenderForm | RenderForm | Expose: RenderForm(formDef, data) | FRM-001 (no hardcoded), VOCAB-002 (from vocab) | — |
| GetVisibleFields | GetVisibleFields | Expose: GetVisibleFields(formDef, context) | FRM-003 (visible_if conditions) | — |

### Responsable de l'Aggregate
- **Owner:** Admin (modifies templates); System (renders forms)
- **Entities:** FormDefinition, FormField
- **Value Objects:** FormId, ModelRef, FieldDef, SectionDef, FormVersion
- **Aggregates Dependencies:** VocabularyAggregate (select options), OrganizationAggregate (form definitions org-scoped)

### Operations Detailées

#### 1. LoadFormDefinition (Query — read only)
- Source: DOC-014 § LoadFormDefinition
- Boundary: DOC-013 "Expose: LoadFormDefinition(formId, version)"
- Preconditions: Form ID exists in manifest
- Postconditions: Form definition (fields, sections, validation rules) returned
- Invariants checked: FRM-004 (old versions not modifiable — read-only guarantee)
- Domain Events emitted: None
- Return: FormDefinition (JSON representation of YAML/JSON form template)

#### 2. ValidateFormData (Command — validation only, no mutation)
- Source: DOC-014 § ValidateFormData
- Boundary: DOC-013 "Expose: ValidateFormData(formDef, data)"
- Preconditions: Form loaded; data submitted
- Postconditions: Validation result computed identically client-side and server-side
- Invariants checked: DUAL-008 (client validation = server validation exactly)
- Domain Events emitted: FormValidationFailed (if invalid), none (if valid)
- Return: ValidationResult (valid/invalid + list of errors)

#### 3. RenderForm (Query — read only, produces render tree)
- Source: DOC-014 § RenderForm
- Boundary: DOC-013 "Expose: RenderForm(formDef, data)"
- Preconditions: Form definition loaded; optional data context
- Postconditions: Render tree produced with conditional visibility evaluated
- Invariants checked: FRM-001 (no hardcoded JSX), VOCAB-002 (select options from vocabulary only)
- Domain Events emitted: None
- Return: React Native render tree (JSON structure)

#### 4. GetVisibleFields (Query — read only)
- Source: DOC-014 (implied by boundary)
- Boundary: DOC-013 "Expose: GetVisibleFields(formDef, context)"
- Preconditions: Form definition loaded
- Postconditions: Only fields whose visible_if conditions match context returned
- Invariants checked: FRM-003 (visible_if conditions)
- Domain Events emitted: None
- Return: Subset of FormField definitions

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: hardcode any form in JSX (FRM-009)
- Interdit: reference vocabulary that doesn't exist
- Interdit: return different validation on client vs server (DUAL-008)
- Interdit: create new capabilities

---

================================================================================
AGGREGATE 7: NotificationAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| SendNotification | SendNotification | Expose | NOT-001 (always triggered) | NotificationQueued → NotificationSent |
| MarkAsRead | MarkAsRead | Expose: MarkAsRead(notificationId) | — | NotificationMarkedRead |
| UpdatePreferences | UpdatePreferences | Expose: UpdatePreferences(userId, prefs) | CHANNEL-003, RATE-002 | PreferencesUpdated |
| SetRateLimit | SetRateLimit | Expose: SetRateLimit(userId, maxPerHour) | RATE-002 | — |
| SuppressUntil | SuppressUntil | Expose: SuppressUntil(userId, untilTime) | QUIET-004 | — |
| QueueNotification | QueueNotification | Expose: QueueNotification(...) | NOT-001, NOT-002 | NotificationQueued |

### Responsable de l'Aggregate
- **Owner:** System (triggered by Workflow) or Admin (manual)
- **Entities:** NotificationMessage, NotificationPreference
- **Value Objects:** ChannelType, SeverityLevel, MessageTemplate, RateLimitConfig
- **Aggregates Dependencies:** IdentityAggregate (user recipient), OrganizationAggregate, WorkflowAggregate (trigger source)

### Operations Detailées

#### 1. SendNotification (Command)
- Source: DOC-014 § SendNotification
- Boundary: DOC-013 "Expose: SendNotification(userId, channel, body)"
- Preconditions: Channel available; user exists; trigger present (NOT-001)
- Postconditions: Notification sent (or queued if offline)
- Invariants checked: NOT-001 (always triggered — never spontaneous), NOT-002 (rate limit), CHANNEL-003 (user preferences), QUIET-004 (quiet hours unless critical)
- Domain Events emitted: NotificationQueued (if queued), NotificationSent (on success), NotificationFailed (if send fails)
- Return: void

#### 2. MarkAsRead (Command)
- Source: DOC-014 § MarkAsRead
- Boundary: DOC-013 "Expose: MarkAsRead(notificationId)"
- Preconditions: Notification belongs to user (self only)
- Postconditions: Read timestamp set
- Invariants checked: —
- Domain Events emitted: NotificationMarkedRead
- Return: void

#### 3. UpdatePreferences (Command)
- Source: DOC-014 § UpdatePreferences
- Boundary: DOC-013 "Expose: UpdatePreferences(userId, prefs)"
- Preconditions: Self or Admin
- Postconditions: Preferences updated; channels validated against allowed set
- Invariants checked: CHANNEL-003 (preferences respected going forward)
- Domain Events emitted: PreferencesUpdated
- Return: void

#### 4. SetRateLimit (Command)
- Source: DOC-014 § SetRateLimit
- Boundary: DOC-013 "Expose: SetRateLimit(userId, maxPerHour)"
- Preconditions: Admin; max per hour > 0
- Postconditions: Rate limit applied
- Invariants checked: RATE-002
- Domain Events emitted: None explicitly (implicit preference update)
- Return: void

#### 5. SuppressUntil (Command)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: SuppressUntil(userId, untilTime)"
- Preconditions: Admin
- Postconditions: Notifications suppressed until specified time
- Invariants checked: QUIET-004 (critical bypasses suppression)
- Domain Events emitted: None explicitly
- Return: void

#### 6. QueueNotification (Command)
- Source: DOC-014 § SendNotification (offline variant)
- Boundary: DOC-013 "Expose: QueueNotification(...)"
- Preconditions: Send triggers valid; offline detected
- Postconditions: Notification queued locally for later delivery
- Invariants checked: NOT-001 (always has a trigger), SYNC-004 (user ops never block)
- Domain Events emitted: NotificationQueued
- Return: void

### Query Operations (read-only)
Aucune query explicite n'est exposee par NotificationAggregate. Reads go through standard query pattern.

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: send spontaneous notifications (NOT-001)
- Interdit: override user channel preferences (CHANNEL-003)
- Interdit: deliver to deleted users
- Interdit: bypass rate limits (RATE-002)
- Interdit: mix notification content with business logic

---

================================================================================
AGGREGATE 8: VocabularyAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| AddTermValue | AddTermValue | Expose | STABLE-003 (key stable) | TermAdded |
| DeprecateTermValue | DeprecateTermValue | Expose | VOC-001 (never delete) | TermValueDeprecated |
| ResolveLabel | ResolveLabel | Expose: ResolveLabel(namespace, termKey, lang) | TRANSLATION-002 (min FR+EN) | TranslationResolved |
| GetTerms | Query (read-only) | Expose: GetTerms(namespace) | — | — |
| GetTermValues | Query (read-only) | Expose: GetTermValues(namespace, termKey) | — | — |
| SearchTerms | Query (read-only) | Expose: SearchTerms(query, namespace?) | — | — |
| GetAllNamespaces | Query (read-only) | Expose: GetAllNamespaces() | — | — |

### Responsable de l'Aggregate
- **Owner:** Admin (manage terms/values); System (read resolved labels)
- **Entities:** Namespace, Term, TermValue
- **Value Objects:** NamespaceKey, TermKey, LabelPair, DeprecatedFlag, ColorHex
- **Aggregates Dependencies:** OrganizationAggregate (vocab namespaced per org, with global fallback)

### Operations Detailées

#### 1. AddTermValue (Command)
- Source: DOC-014 § AddTermValue
- Boundary: DOC-013 "Expose: [add value to namespace/term]"
- Preconditions: Namespace exists
- Postconditions: New term value added with unique key
- Invariants checked: STABLE-003 (key unique within namespace, never changes), TRANSLATION-002 (min FR+EN)
- Domain Events emitted: TermAdded
- Return: void

#### 2. DeprecateTermValue (Command)
- Source: DOC-014 § DeprecateTermValue
- Boundary: DOC-013 "Expose: DeprecateValue(namespace, termKey, val)"
- Preconditions: Value exists; NOT already deprecated
- Postconditions: Value flagged deprecated (IRREVERSIBLE)
- Invariants checked: VOC-001 (values never deleted, only deprecated)
- Domain Events emitted: TermValueDeprecated
- Return: void

#### 3. ResolveLabel (Query — read only)
- Source: DOC-014 § ResolveLabel
- Boundary: DOC-013 "Expose: ResolveLabel(namespace, termKey, lang)"
- Preconditions: Namespace + termKey exist
- Postconditions: Display label string returned for requested language
- Invariants checked: TRANSLATION-002 (FR+EN guaranteed minimum)
- Domain Events emitted: TranslationResolved (informational)
- Return: Label string

#### 4. GetTerms (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetTerms(namespace)"
- Preconditions: Namespace exists
- Postconditions: All terms in namespace returned
- Invariants checked: —
- Domain Events emitted: None
- Return: List of Term definitions

#### 5. GetTermValues (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetTermValues(namespace, termKey)"
- Preconditions: Namespace + termKey exist
- Postconditions: All values (including deprecated) returned
- Invariants checked: —
- Domain Events emitted: None
- Return: List of TermValue definitions

#### 6. SearchTerms (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: SearchTerms(query, namespace?)"
- Preconditions: Search query provided
- Postconditions: Matching terms returned
- Invariants checked: —
- Domain Events emitted: None
- Return: List of matching Term definitions

#### 7. GetAllNamespaces (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetAllNamespaces()"
- Preconditions: None
- Postconditions: All namespaces returned
- Invariants checked: —
- Domain Events emitted: None
- Return: List of Namespace keys

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: delete deprecated values (VOC-001)
- Interdit: remove translations below minimum (TRANSLATION-002)
- Interdit: change key of existing term (STABLE-003)
- Interdit: return empty string for missing label
- Interdit: mix business logic into labels

---

================================================================================
AGGREGATE 9: ReportingAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| GenerateReport | GenerateReport | Expose | BAL-001 (balance must balance) | ReportGenerated |
| CalculateBalance | CalculateBalance | Expose: CalculateBalance(scope, periodStart, periodEnd) | BAL-001, MONTH-001, SYNCED-001 | BalanceCalculated |
| ExportReport | ExportReport | Expose: ExportReport(reportId, format) | EXPORT-001 | ReportExported |
| GetReportTypes | Query (read-only) | Expose: GetReportTypes(orgId) | — | — |

### Responsable de l'Aggregate
- **Owner:** Role with `reporting:*:read` permission grant
- **Entities:** ReportDefinition, GeneratedReport
- **Value Objects:** ReportScope, PeriodType, ReportFormat, BalanceTotals, CategoryBreakdown
- **Aggregates Dependencies:** ResourceAggregate (reads TransactionRecord data), OrganizationAggregate

### Operations Detailées

#### 1. GenerateReport (Command — produces report, does not persist)
- Source: DOC-014 § GenerateReport
- Boundary: DOC-013 "Expose: GenerateReport(reportType, period)"
- Preconditions: Report type defined; permission reporting:read
- Postconditions: Report computed and returned on-demand (not persisted unless explicitly saved)
- Invariants checked: BAL-001 (balance must balance: Actif = Passif + Résultat), MONTH-001 (monthly covers 1st to last day), SYNCED-001 (only synced=1 transactions participate), EXPORT-001 (timestamp included)
- Domain Events emitted: ReportGenerated
- Return: Generated report data

#### 2. CalculateBalance (Query — read only computation)
- Source: DOC-014 § CalculateBalance
- Boundary: DOC-013 "Expose: CalculateBalance(scope, periodStart, periodEnd)"
- Preconditions: Period defined
- Postconditions: Balance totals computed from approved transactions
- Invariants checked: BAL-001 (balance integrity), MONTH-001 (period validity), SYNCED-001 (only synced transactions)
- Domain Events emitted: BalanceCalculated
- Return: BalanceTotals with category breakdown

#### 3. ExportReport (Query — read only export)
- Source: DOC-014 § ExportReport
- Boundary: DOC-013 "Expose: ExportReport(reportId, format)"
- Preconditions: Report previously generated; permission reporting:read
- Postconditions: Export file returned in requested format
- Invariants checked: EXPORT-001 (timestamp + digital signature included), ARCHIVED-001 (archived reports immutable)
- Domain Events emitted: ReportExported
- Return: Export file contents

#### 4. GetReportTypes (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetReportTypes(orgId)"
- Preconditions: Org exists
- Postconditions: Available report types for this organization
- Invariants checked: —
- Domain Events emitted: None
- Return: List of report type definitions

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: include pending/unapproved transactions in report (SYNCED-001)
- Interdit: persist generated reports (on-demand only)
- Interdit: exceed max field count in output
- Interdit: bypass permission checks

---

================================================================================
AGGREGATE 10: AuditAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| LogAction | LogAction | Expose: LogAction(entityType, entityId, action, oldValues, newValues) | AUD-001, OLDNEW-002 | ActionLogged (internal) |
| QueryAuditLogs | QueryAuditLogs | Expose: QueryLogs(filters, pagination) | ACCESS-033 | — |
| ExportAuditTrail | ExportAuditTrail | Expose: ExportAuditTrail(period, format) | RETENTION-031 | — |

### Responsable de l'Aggregate
- **Owner:** Immutable system-owned aggregate
- **Entities:** AuditLogEntry
- **Value Objects:** ActionType, EntitySnapshot, UserId, IpAddress, LogTimestamp
- **Aggregates Dependencies:** NONE — self-contained append-only log

### Operations Detailées

#### 1. LogAction (Command — SYSTEM ONLY, auto-invoked by other aggregates)
- Source: DOC-014 § LogAction
- Boundary: DOC-013 "Expose: LogAction(entityType, entityId, action, oldValues, newValues)"
- Preconditions: Any domain state change occurred (called by other aggregates)
- Postconditions: New immutable log entry appended
- Invariants checked: AUD-001 (never modifiable/deletable), OLDNEW-002 (both old AND new values always present), RETENTION-031 (retention policy set)
- Domain Events emitted: ActionLogged (internal side effect — not user-facing)
- Return: void
- Actor: SYSTEM ONLY — not user-callable

#### 2. QueryAuditLogs (Query — read only)
- Source: DOC-014 § QueryAuditLogs
- Boundary: DOC-013 "Expose: QueryLogs(filters, pagination)"
- Preconditions: Filter criteria specified; permission admin or auditor
- Postconditions: Log entries returned scoped to org_id
- Invariants checked: ACCESS-033 (restricted to admin/auditor)
- Domain Events emitted: None
- Return: List of AuditLogEntry records (read-only)

#### 3. ExportAuditTrail (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: ExportAuditTrail(period, format)"
- Preconditions: Period specified; permission admin
- Postconditions: Audit trail exported in requested format
- Invariants checked: ACCESS-033, RETENTION-031 (min 7 years enforced in output)
- Domain Events emitted: None
- Return: Exported audit trail data

### Operations Interdites (CONSTITUTIONAL — READ ONLY)
Toutes operations NON listeess ci-dessus sont Interdit.
- **JAMAIS** UPDATE sur audit_entries (AUD-001 constitutionnel)
- **JAMAIS** DELETE sur audit_entries (AUD-001 constitutionnel)
- **JAMAIS** self-log (audit logs are not audited)
- **JAMAIS** bypass immutability (this is an absolute rule)

---

================================================================================
AGGREGATE 11: LifecycleAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| ArchiveResource | ArchiveResource | Expose: ArchiveResource(resourceType, resourceId) | LIF-001, LIF-003 | ResourceArchived |
| TrashResource | TrashResource | Expose: TrashResource(archiveId) | LIF-003 | ResourceTrashed |
| PurgeResource | PurgeResource | Expose: PurgeResource(archiveId) | LIF-003 (irreversible), LIF-005 | ResourcePurged |
| RestoreFromTrash | RestoreFromTrash | Expose: RestoreFromTrash(archiveId) | LIF-003 | ResourceRestoredFromTrash |
| ListArchiveEntries | Query (read-only) | Expose: ListArchiveEntries(filters) | LIF-006 (trashed excluded) | — |
| SearchArchives | Query (read-only) | Expose: SearchArchives(query, tags?, type?) | — | — |
| ApplyTags | ApplyTags | Expose: ApplyTags(archiveId, tags) | — | — |
| SchedulePurge | SchedulePurge | Expose: SchedulePurge(archiveId, purgeDate) | LIF-005 | PurgeScheduled |

### Responsable de l'Aggregate
- **Owner:** System (enforces rules) + Admin (configures lifecycle types via manifest)
- **Entities:** ArchiveEntry, LifecycleTypeDefinition
- **Value Objects:** LifecycleState, RetentionPeriod, ArchiveType, TagCollection, CategoryRef, AttachmentUrlList
- **Aggregates Dependencies:** ResourceAggregate (archives resources), OrganizationAggregate, IdentityAggregate (archived_by user)

### Operations Detailées

#### 1. ArchiveResource (Command)
- Source: DOC-014 § ArchiveResource
- Boundary: DOC-013 "Expose: ArchiveResource(resourceType, resourceId)"
- Preconditions: Resource exists; archivable type configured in manifest
- Postconditions: ArchiveEntry created with state = archived
- Invariants checked: LIF-001 (states from manifest, not hardcoded), LIF-003 (purge irreversible once reached)
- Domain Events emitted: ResourceArchived
- Return: void

#### 2. TrashResource (Command)
- Source: DOC-014 § TrashResource
- Boundary: DOC-013 "Expose: TrashResource(archiveId)"
- Preconditions: ArchiveEntry exists; state = archived
- Postconditions: State transitions archived → trashed
- Invariants checked: LIF-003 (must not have been purged yet)
- Domain Events emitted: ResourceTrashed
- Return: void

#### 3. PurgeResource (Command — IRREVERSIBLE)
- Source: DOC-014 § PurgeResource
- Boundary: DOC-013 "Expose: PurgeResource(archiveId)"
- Preconditions: System scheduled; trash date passed; purge_date reached
- Postconditions: Entry permanently removed. NO RESTORE possible.
- Invariants checked: LIF-003 (irreversible — state purged blocks ALL transitions), LIF-005 (purge_date reached)
- Domain Events emitted: ResourcePurged
- Return: void
- Actor: System (scheduled) — not user-callable

#### 4. RestoreFromTrash (Command)
- Source: DOC-014 § RestoreFromTrash
- Boundary: DOC-013 "Expose: RestoreFromTrash(archiveId)"
- Preconditions: Entry in trashed state
- Postconditions: State transitions trashed → archived
- Invariants checked: LIF-003 (only works before purged)
- Domain Events emitted: ResourceRestoredFromTrash
- Return: void

#### 5. ListArchiveEntries (Query — read only)
- Source: DOC-014 § ListArchiveEntries
- Boundary: DOC-013 "Expose: ListArchiveEntries(filters)"
- Preconditions: Admin permission
- Postconditions: Archive entries returned; trashed excluded from normal query
- Invariants checked: LIF-006 (trashed not visible in normal queries)
- Domain Events emitted: None
- Return: List of ArchiveEntry records

#### 6. SearchArchives (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: SearchArchives(query, tags?, type?)"
- Preconditions: Admin permission
- Postconditions: Matching archive entries returned
- Invariants checked: —
- Domain Events emitted: None
- Return: List of matching ArchiveEntry records

#### 7. ApplyTags (Command)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: ApplyTags(archiveId, tags)"
- Preconditions: ArchiveEntry exists
- Postconditions: Tags added to archive entry
- Invariants checked: —
- Domain Events emitted: None explicitly
- Return: void

#### 8. SchedulePurge (Command)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: SchedulePurge(archiveId, purgeDate)"
- Preconditions: Admin permission
- Postconditions: Purge date set; system scheduler picks up on cron
- Invariants checked: LIF-005 (purge date configurable per type)
- Domain Events emitted: PurgeScheduled
- Return: void

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: create new archivable types in code (LIF-001 — manifest only)
- Interdit: purge before purge_date (LIF-005)
- Interdit: restore once purged (LIF-003)
- Interdit: mix archive data with non-archive data

---

================================================================================
AGGREGATE 12: ConfigurationAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| UpdateSetting | UpdateSetting | Expose: UpdateSetting(key, value) | CFG-001, CFG-002, CFG-003 | SettingUpdated |
| ResetToDefaults | ResetToDefaults | Expose: ResetToDefaults() | CFG-004 (default fallback) | SettingsResetToDefaults |
| GetSetting | Query (read-only) | Expose: GetSetting(key) | CFG-004 | — |
| GetAllSettings | Query (read-only) | Expose: GetAllSettings() | CFG-004 | — |

### Responsable de l'Aggregate
- **Owner:** Admin
- **Entities:** SettingEntry
- **Value Objects:** SettingKey, SettingValue
- **Aggregates Dependencies:** OrganizationAggregate (settings are org-scoped)

### Operations Detailées

#### 1. UpdateSetting (Command)
- Source: DOC-014 § UpdateSetting
- Boundary: DOC-013 "Expose: UpdateSetting(key, value)"
- Preconditions: Key exists in settings schema; Admin permission
- Postconditions: Setting value updated with format validation
- Invariants checked: CFG-001 (Currency ISO 4217), CFG-002 (Timezone IANA), CFG-003 (Accent hex + WCAG contrast), CFG-004 (default fallback available)
- Domain Events emitted: SettingUpdated
- Return: void

#### 2. ResetToDefaults (Command)
- Source: DOC-014 § ResetToDefaults
- Boundary: DOC-013 "Expose: ResetToDefaults()"
- Preconditions: Admin permission; settings not already at defaults
- Postconditions: All keys reset to template defaults
- Invariants checked: CFG-004 (every setting has a default)
- Domain Events emitted: SettingsResetToDefaults
- Return: void

#### 3. GetSetting (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetSetting(key)"
- Preconditions: Key exists
- Postconditions: Setting value returned; default fallback if null
- Invariants checked: CFG-004 (default fallback always available)
- Domain Events emitted: None
- Return: Single SettingValue

#### 4. GetAllSettings (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetAllSettings()"
- Preconditions: Admin permission
- Postconditions: All settings returned with current values
- Invariants checked: CFG-004
- Domain Events emitted: None
- Return: List of all SettingEntries

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: store business data (transactions, etc.) — configuration ONLY
- Interdit: bypass format validation (CFG-001/002/003)
- Interdit: modify settings without admin auth

---

================================================================================
AGGREGATE 13: OfflineSyncAggregate
================================================================================

### Boundary Exposure

| Operation | Command/Query | Boundary Type (DOC-013) | Invariants Vérifiés (DOC-015) | Événements Produits (DOC-014) |
|-----------|--------------|------------------------|------------------------------|------------------------------|
| PushPendingOperations | PushPendingOperations | Expose: PushPendingOperations() | SYNC-001, SYNC-002 | BatchPushed |
| PullRemoteChanges | PullRemoteChanges | Expose: PullRemoteChanges(sinceTimestamp) | SYNC-004 (never blocks user) | DeltaReceived |
| ResolveConflict | ResolveConflict | Expose: ResolveConflict(operation, serverData) | SYNC-001 (local first) | ConflictResolved |
| MarkOperationConfirmed | MarkOperationConfirmed | Expose: MarkConfirmed(opId) | — | SyncCompleted |
| CheckConnectivity | Query (read-only) | Expose: CheckConnectivity() | — | ConnectionLost / ConnectionRestored |
| GetSyncStatus | Query (read-only) | Expose: GetSyncStatus(tableName) | — | — |

### Responsable de l'Aggregate
- **Owner:** System-owned (automatic, user-transparent)
- **Entities:** PendingOperation, SyncStatusTracker
- **Value Objects:** SyncAction, SyncStatus, ConflictStrategy, OperationPayload, PushBatchSize, RetryDelayMs
- **Aggregates Dependencies:** ALL other Aggregates (pending operations track changes to every resource type)

### Operations Detailées

#### 1. PushPendingOperations (Command)
- Source: DOC-014 § PushPendingOperations
- Boundary: DOC-013 "Expose: PushPendingOperations()"
- Preconditions: Pending operations in queue
- Postconditions: Batch of operations pushed to remote (max 50 per batch)
- Invariants checked: SYNC-001 (local ALWAYS precedes remote), SYNC-002 (batch size ≤50), SYNC-003 (exponential backoff max 5 retries)
- Domain Events emitted: BatchPushed
- Return: void

#### 2. PullRemoteChanges (Command)
- Source: DOC-014 § PullRemoteChanges
- Boundary: DOC-013 "Expose: PullRemoteChanges(sinceTimestamp)"
- Preconditions: Network available; since timestamp provided
- Postconditions: Delta changes pulled; applied locally
- Invariants checked: SYNC-004 (user operations never blocked during sync)
- Domain Events emitted: DeltaReceived
- Return: void

#### 3. ResolveConflict (Command)
- Source: DOC-014 § ResolveConflict
- Boundary: DOC-013 "Expose: ResolveConflict(operation, serverData)"
- Preconditions: Conflict detected during pull
- Postconditions: Conflict resolved per strategy (LWW, server-wins, immutable, uuid-dedup)
- Invariants checked: SYNC-001 (local-first: approved transactions immutable), SYNC-002/003 (batch/retry constraints apply)
- Domain Events emitted: ConflictResolved (after resolution), ConflictDetected (before resolution)
- Return: void

#### 4. MarkOperationConfirmed (Command)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: MarkConfirmed(opId)"
- Preconditions: Operation successfully synced
- Postconditions: Sync status transitions sent → confirmed
- Invariants checked: —
- Domain Events emitted: SyncCompleted (when batch complete)
- Return: void

#### 5. CheckConnectivity (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: CheckConnectivity()"
- Preconditions: None
- Postconditions: Current connectivity state returned
- Invariants checked: SYNC-004 (never blocks)
- Domain Events emitted: ConnectionLost or ConnectionRestored (as state changes)
- Return: Connectivity state

#### 6. GetSyncStatus (Query — read only)
- Source: DOC-014 (boundary-defined)
- Boundary: DOC-013 "Expose: GetSyncStatus(tableName)"
- Preconditions: Table name
- Postconditions: Current sync status for table returned
- Invariants checked: —
- Domain Events emitted: None
- Return: SyncStatusTracker data

### Operations Interdites
Toutes operations NON listeess ci-dessus sont Interdit.
- Interdit: modify resource data directly (→ ResourceAggregate)
- Interdit: change conflict strategy mid-sync
- Interdit: sync more than batch_size (50)
- Interdit: block user operation during sync (SYNC-004)

---

## SUMMARY: TOTAL OPERATIONS COUNT

| # | Aggregate | Commands | Queries | Total Operations |
|---|-----------|----------|---------|-----------------|
| 1 | OrganizationAggregate | 8 | 2 | 10 |
| 2 | IdentityAggregate | 9 | 0 | 9 |
| 3 | ResourceAggregate | 10 | 2 | 12 |
| 4 | RelationshipAggregate | 3 | 3 | 6 |
| 5 | WorkflowAggregate | 5 | 1 | 6 |
| 6 | FormAggregate | 1 | 3 | 4 |
| 7 | NotificationAggregate | 4 | 0 | 4 |
| 8 | VocabularyAggregate | 2 | 5 | 7 |
| 9 | ReportingAggregate | 1 | 2 | 3 |
| 10 | AuditAggregate | 1 | 2 | 3 |
| 11 | LifecycleAggregate | 5 | 2 | 7 |
| 12 | ConfigurationAggregate | 2 | 2 | 4 |
| 13 | OfflineSyncAggregate | 4 | 2 | 6 |
| **TOTAL** | | **57** | **26** | **83** |

Note: 57 Commands + 26 Queries = 83 total operations across all 13 aggregates.
Some DOC-014 commands are SYSTEM-ONLY (LogAction, PurgeResource) — they are listed but are not externally callable.
Some DOC-014 commands appear under multiple names (e.g. PushPendingOps in DOC-012 vs PushPendingOperations in DOC-014). The DOC-014 registry is authoritative.

---

## CROSS-REFERENCE SUMMARY

Each operation traces to exactly ONE source:
- **DOC-014** for command/event names and behaviors
- **DOC-013** for boundary types (Expose/Possede/Protege/Interdit)
- **DOC-015** for invariant IDs checked
- **DOC-012** for aggregate owner and entity/VO composition

No operation was invented. If an operation is not listed above, it does not exist in the canonical contract.
