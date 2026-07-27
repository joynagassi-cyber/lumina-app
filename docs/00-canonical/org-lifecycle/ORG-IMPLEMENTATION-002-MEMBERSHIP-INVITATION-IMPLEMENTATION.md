# ORG-IMPLEMENTATION-002 — Membership & Invitation Implementation

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| generation_id | ORG-IMP-002-v1.0-2026-07-24 |
| source_canonical | ORG-002 (Membership, Invitation & Access), DOC-012 (Canonical Domain Model), DOC-014 (Domain Commands/Events) |
| transformation_rule | IGS-v1 pipeline — step: implementation verification report |
| compliance_status | DOCUMENTARY — verifie le code EXISTANT contre les specifications canoniques |
| generated_date | 2026-07-24 |

---

## 1. DISTINCTIONS CONCEPTUELLES VERIFIEES

### 1.1 User vs Member vs Invite

| Concept | Documente dans | Implémente dans | Verdict |
|---------|---------------|-----------------|---------|
| **User** (IdentityAggregate) | ORG-002 §1, DOC-012 §2.2 | `src/domains/user/domain/entities/user.ts` — User entity | [PASS] |
| **Account** (Credentials) | ORG-002 §1 | `src/domains/user/domain/value-objects/password-hash.ts`, CredentialRepository port | [PASS] |
| **Member** (ResourceAggregate → MemberRecord) | ORG-002 §1, DOC-012 §3.2 | `src/domains/member/domain/entities/group-membership.entity.ts` — GroupMembership | [PASS — GroupMembership joue le role de junction member→org_unit] |
| **Invite** (ORG-002 concept NOUVEAU) | ORG-002 §2 | AUCUN FICHIER TROUVE | [LACUNE — voir section 2] |
| **Membership** (RelationshipAggregate) | ORG-002 §3, DOC-012 §2.4 | `src/domains/member/` entire domain layer | [PASS] |

### 1.2 Role Attribution : User vs Member

- ORG-002 §1.2 dit : "Le role RBAC (UserRole) appartient au User (IdentityAggregate). Le role metier (MembershipRole) appartient a la Membership."
- **Verification :**
  - UserRole defini dans `user/domain/value-objects/user-role.ts` — lie au User entity via `_role` field
  - MembershipRole defini dans `member/domain/value-objects/membership-role.vo.ts` — lie au GroupMembership via `membershipRole` field
  - Deux namespaces separes, deux aggregates distincts.

[PASS]

---

## 2. INVITATION — VERIFICATION CRITIQUE

ORG-002 §2.1 definit un flux complet d'invitation :

```
Created → Sent → Pending → Accepted/Rejected/Expired/Cancelled
```

### 2.1 Checklist d'Existence

| Element ORG-002 §2 | Existe en code? | Fichier |
|-------------------|-----------------|---------|
| Table `invitations` dans schema DB | NON | N/A — table n'existe pas dans PG-Schema-v1 |
| InviteEntity / Invite aggregate | NON | Aucun fichier invite trouvé |
| Inviter Service (application layer) | NON | `src/domains/*/application/*` — aucun invite handler |
| CreateInvitation command | NON | DOC-014 ne liste pas cette commande |
| AcceptInvitation command | NON | Inexistant |
| RejectInvitation command | NON | Inexistant |
| RevokeInvitation command | NON | Inexistant |
| DomainEvent InviteCreated | NON | AUCUN event trouvé avec "invite" dans nom |
| DomainEvent InviteAccepted | NON | — |
| DomainEvent InviteRejected | NON | — |
| DomainEvent InviteRevoked | NON | — |
| DomainEvent InviteExpired | NON | — |
| Field accept_token_hash (bcrypt) | NON | — |
| Field expires_at | NON | — |
| Field status {pending, accepted, rejected, expired, cancelled} | NON | — |
| Field role_suggéré | NON | — |
| Function accept() | NON | — |
| Function reject() | NON | — |
| Function expire() | NON | — |
| Function cancel()/revoke() | NON | — |

**Recherche exhaustive realisee :**
```
grep -r "invite" src/safe-boot/backend/src/domains/ → 0 resultat
```

### 2.2 Classification

**CECI EST UNE LACUNE D'IMPLEMENTATION, PAS UNE CONTRADICTION CANONIQUE.**

Les specifications ORG-002 sont CLAIRES, COMPLETEMENT TRACEES, et PRÊTES pour l'implementation. Le manque reside uniquement dans la couche code — toutes les sources canoniques (DOC-012, DOC-014, DOC-021) seront amendees par des ADRs pour ajouter le concept d'Invitation.

---

## 3. MEMBERSHIP — VERIFICATION

### 3.1 GroupMembership Entity

**Fichier :** `src/safe-boot/backend/src/domains/member/domain/entities/group-membership.entity.ts`

```typescript
interface GroupMembershipData {
  id: string;
  orgId: string;              // _org_id multi-tenant (NB-MT-001)
  memberUuid: string;          // FK vers members
  groupOrgUnitUuid: string;    // FK vers org_units
  joinTimestamp: JoinTimestamp; // date_adhesion
  membershipRole: MembershipRole | null; // role_groupe
  departureDate: Date | null;  // date_depart
  createdAt: Date;
  updatedAt: Date;
}
```

Methodes domaine :
- `isActive()` — ligne 58-60 : retourne true si departureDate === null
- `leave()` — ligne 76-82 : marquer departureDate = new Date()
- `withRole(role)` — ligne 65-71 : update membershipRole (immutability pattern)
- `toRelationshipKey()` — ligne 47-53 : RelationshipKey composite (memberUuid + groupOrgUnitUuid + BELONGS_TO type)

**Verdict sur BR-MEM-002 (pas de duplication) :**
- La verification d'absence de doublon est faite dans MemberService.addMemberToGroup() ligne 58-61 via `groupMembershipRepo.exists(memberUuid, groupOrgUnitUuid, orgId)`
- [PASS]

### 3.2 MemberService — Verification des Commandes

**Fichier :** `src/safe-boot/backend/src/domains/member/application/member.service.ts`

#### 3.2.1 AddMemberToGroup

- Lignes 47-78 : `addMemberToGroup(memberUuid, groupOrgUnitUuid, orgId, role)`
- Verifications :
  - Multi-membership policy check : `MultiMembershipPolicy.assertCanJoin(currentCount, ...)` — line 55
  - Duplicate check : `exists` query — line 58-61
  - Creates membership with JoinTimestamp.now() — line 63-72
  - Emits `MemberJoinedGroup` event — line 74-75
  - Returns created GroupMembership
- **Acteur autorise :** La method ne verifie PAS le role de l'appelant. L'autorisation est deléguee au presentation layer. Analogous au pattern observe dans OrganizationService.

[PARTIEL — autorisation deléguee, conforme au pattern CQRS mais non enforce dans la couche application]

#### 3.2.2 RemoveMemberFromGroup

- Lignes 84-107 : `removeMemberFromGroup(memberUuid, groupOrgUnitUuid)`
- Verifications :
  - Finds active membership for member in group — line 89-91
  - Calls `toRemove.leave()` which sets departureDate — line 97
  - Persists the update — line 98-101
  - Emits `MemberLeftGroup` event — line 103-104
- **BR-MEM-006 (historie conserve) :** Le membership n'est PAS supprime de la DB — only departureDate est set. C'est correct per spec ORG-002 §3.2.
- [PASS]

#### 3.2.3 ChangeOrgUnitParent

- Lignes 113-148 : `changeOrgUnitParent(childOrgUnitUuid, newParentUuid, orgId)`
- Verifications :
  - DAG cycle check via `DagPolicy.assertNoCycle(...)` — line 121
  - Depth check via `MaxDepthPolicy.computeChildDepth(...)` — line 128
  - Updates parent link — line 136
  - Emits `OrgUnitReparented` event — line 138-145
- [PASS — conforme BR-ORG-003 et BR-REL-001]

#### 3.2.4 TransferChildOrg

- Lignes 154-195 : `transferChildOrg(childOrgUnitUuid, newSiblingOrgUnitUuid, orgId)`
- Verifications :
  - DAG cycle check — line 166
  - BR-REL-003 preservation memberships : `listByGroup(sourceOrgUnitUuid)` — line 169
  - Reparents under sibling's parent — line 172
  - Recalculates depth — lines 175-180
  - Enumerates descendants and preserves memberships — line 183
  - Emits `ChildOrgTransferred` event — lines 186-193
- [PASS — preserve memberships correctly]

#### 3.2.5 MergeChildOrg

- Lignes 201-221 : `mergeChildOrg(sourceOrgUnitUuid, targetOrgUnitUuid, orgId)`
- Verifications :
  - DAG cycle check — line 209
  - Transfer memberships from source to target — line 212
  - Reparents source under target — line 215
  - Emits `ChildOrgMerged` event — lines 217-218
- [PASS]

#### 3.2.6 EnumerateDescendants

- Lignes 227-239 : `enumerateDescendants(ancestorUuid, requesterId, orgId)`
- Uses DescendantEnumerator DFS traversal — line 233
- Emits `DescendantEnumerationRequested` event — line 235
- [PASS]

### 3.3 Multi-org Support

**Specification ORG-002 §4.1 :** Basculer d'une org a l'autre change le JWT claim org_id.

**Verification :**

- **Fichier :** `src/safe-boot/backend/src/domains/user/domain/value-objects/session-context.ts`
  - SessionContext bundles refreshTokenHash, expiresAt, isActive, deviceInfo
  - **Mais contient PAS de champ orgId ou organizationId explicitement.**

- **Fichier :** `src/safe-boot/backend/src/domains/user/application/identity-service.ts`
  - Ligne 247-253 : `signAccessToken({ sub: user.id, org_id: orgId, role: user.role.toString() })`
  - Ligne 251-254 : `signRefreshToken({ sub: user.id, org_id: orgId })`
  - **Le org_id EST inclus dans le JWT**, mais il vient de l'entree de la commande LoginCommand (`command.orgId`).
  - Il n'y a PAS de commande "switch org" decrite. La bascule depend du caller de passer un orgId different.

- **Fichier :** `src/safe-boot/backend/src/domains/user/domain/entities/user.ts`
  - Ligne 19 : `private readonly _orgId: string` — user EST lie a UNE organisation unique au niveau entity
  - Ligne 31-32 : `orgId` requis dans le constructeur — c'est une relation N:1 stricte, pas N:M

**Verdict sur BR-MULTI-010 (Per-org role variance) :**

Le systeme actuel supporte un user AVEC un seul orgId dans son entite User. Pour le multi-org :
1. Un utilisateur peut avoir PLUSIEURS entries User (une par org) — non documente mais possible via la DB
2. OU le model doit etre change vers N:M via une table UserOrgBinding
3. **Le JWT contient bien `org_id` comme claim** (ligne 248) — ce qui est LA source de verite pour l'isolement session

[MAJEUR — Tension T-103 d'ORG-002 : model N:1 User→Org vs besoin multi-org]

### 3.4 OrgUnitLink — Hierarchie Entity

**Fichier :** `src/safe-boot/backend/src/domains/member/domain/entities/org-unit-link.entity.ts`

```typescript
interface OrgUnitLinkData {
  id: string;
  orgId: string;
  childOrgUnitUuid: string;
  parentOrgUnitUuid: string | null;  // self-reference (auto-référence)
  depthLevel: number;
  updatedAt: Date;
}
```

Methodes :
- `isRoot()` — parentOrgUnitUuid === null
- `isValidDepth(depth)` — depth entre 1 et MAX_DEPTH(5)
- `withParent(parentId, currentDepth)` — immutability pattern pour reparenting

[PASS]

### 3.5 Policies Verification

| Policy | Fichier | Regle | Verdict |
|--------|---------|-------|---------|
| DagPolicy | `member/domain/policies/dag-policy.ts` | BR-REL-001 (no cycles) | [PASS] — utilise CycleDetector |
| MaxDepthPolicy | `member/domain/policies/max-depth-policy.ts` | BR-REL-002 (depth ≤ 5) | [PASS] — validated at domain layer |
| MultiMembershipPolicy | `member/domain/policies/multi-membership-policy.ts` | BR-MEM-001 (multi-membership allowed) | [PASS] — cap a 50 concurrent |

---

## 4. RÈGLES D'ATTRIBUTION DE ROLE VERIFIÉES

Source : ORG-004 §2.2

### 4.1 BR-ID-004 : Superadmin peut assigner TOUS les roles

**Verification :**
- Fichier : `user/domain/value-objects/user-role.ts` lignes 26-30 — ADMIN_CREATEABLE_ROLES n'inclut PAS superadmin
- Fichier : `user/application/identity-service.ts` lignes 333-340 — `enforceRoleCreationPermission()` :
  - Si actorPriority === 0 (superadmin) → return immediate (no restriction)
  - Sinon → check targetRole dans ADMIN_CREATEABLE_ROLES
- **Observation importante :** Cette fonction est APPELEE UNIQUEMENT dans `createUser()` (ligne 111) avec `'superadmin'` hardcoded comme actorRole. Elle n'est PAS appelee dans `changeRole()` (ligne 171-185). Cela signifie que `changeRole` NE VERIFIE AUCUNE hierarchie RBAC.

[FAIL — changeRole permet qu'un utilisateur change son propre role sans verification d'autorisation]

### 4.2 BR-ID-005 : Admin ne peut créer que treasurer/pastor/staff

**Verification :**
- Fichier : `user-role.ts` lignes 26-30 — ADMIN_CREATEABLE_ROLES = Set(['treasurer', 'pastor', 'staff'])
- [PASS]

### 4.3 BR-ID-006 : Wildcard permissions auditées

**Verification :**
- Fichier : `permission-grant.ts` ligne 22-24 — `isFullWildcard()` detecte `*:*:*`
- Fichier : `permission-resolver.ts` ligne 23 — ROLE_MANIFEST superadmin: ['*:*:*']
- Fichier : `identity-service.ts` ligne 323-325 — `assignPermissionGrant()` est un STUB vide. Il ne fait ni audit ni assignment effectif.
- [MAJEUR — assignPermissionGrant est implémentée comme fonction vide]

---

## 5. TABLEAU DE CORRESPONDANCE

| Fonctionnalité ORG-002 | Statut implémentation | Code file | Lignes approx |
|------------------------|----------------------|-----------|--------------|
| Invitation sent | **NON IMPLÉMENTÉ** | — | — |
| Invitation accepted | **NON IMPLÉMENTÉ** | — | — |
| Invitation rejected | **NON IMPLÉMENTÉ** | — | — |
| Invitation expired | **NON IMPLÉMENTÉ** | — | — |
| Invitation cancelled | **NON IMPLÉMENTÉ** | — | — |
| Invitation created | **NON IMPLÉMENTÉ** | — | — |
| Membership created | IMPLÉMENTÉ | member.application.member.service.ts | ~47-78 |
| Membership removed | IMPLÉMENTÉ | member.application.member.service.ts | ~84-107 |
| Membership role changed | IMPLÉMENTÉ | member.domain.entities/group-membership.entity.ts → withRole() | ~65-71 |
| Multi-org discovery | PARTIEL | JWT org_id present (identity-service.ts ~248) | 1 entry per user |
| Multi-org session switch | PARTIEL | LoginCommand.orgId controle org_id JWT, mais pas de "switch org" dedicated endpoint | — |
| Multi-org role variance | EN BLOC | User.entity lié a UNE org via _orgId (N:1) | ~19 |
| Role assignment (superadmin gate) | PARTIEL | changeRole() n'a AUCUNE verification d'autorisation | ~171-185 |
| Permission grant (wildcard audit) | NON EFFECTIF | assignPermissionGrant() = function vide | ~323-325 |
| Hierarchie cycle detection | IMPLÉMENTÉ | cycle-detector.service.ts + dag-policy.ts | ~100 |
| Hierarchie depth check | IMPLÉMENTÉ | max-depth-policy.ts (membres + organization) | ~40 |
| Membership preserved on transfer | IMPLÉMENTÉ | member.service.ts transferChildOrg ~line 169 | — |
| Descendant enumeration | IMPLÉMENTÉ | descendant-enumerator.service.ts | ~34-122 |

---

## 6. TENSIONS IDENTIFIÉES

### T-IMP-002 : Invitation System Manquant

- **Specification canonique :** ORG-002 §2 specifie le FLUX INVITATION COMPLET
  - States: Created → Sent → Pending → Accepted/Rejected/Expired/Cancelled
  - Fields: accept_token_hash, expires_at, role_suggéré, group_id, target_email
  - Commands: CreateInvitation, AcceptInvitation, RejectInvitation, RevokeInvitation
  - Events: InvitationCreated, InvitationSent, InvitationAccepted, InvitationRejected, InvitationRevoked, InvitationExpired
- **Implémentation actuelle :** AUCUN fichier d'implémentation trouve dans src/domains/*/
- **Impact :** MINEUR — c'est une lacune d'implementation specifiée et traceable
- **Recommendation :** Genérer l'implémentation via invitation.next_step dans un commit séparé, en suivant exactement ORG-002 §2.3 (schema table invitations) et §2.4 (flux acceptation)

### T-IMP-003 : changeRole() sans vérification d'autorisation

- **Specification canonique :** ORG-004 §3.2 — Role assignment est gate par hierarchie RBAC (BR-ID-004, BR-ID-005)
- **Implémentation actuelle :** `identity-service.ts` ligne 171-185 — `changeRole()` charge le user et appelle `user.changeRole(newRole)` SANS verifier que l'appelant a le droit de changer le role.
- La methode `enforceRoleCreationPermission()` (ligne 333-340) n'est appellee QUE dans `createUser()`, pas dans `changeRole()`.
- **Impact :** MAJEUR — n'importe quel user connecte pourrait potentiellement changer le role d'un autre user si l'appelant externe ne fait pas le controle.
- **Recommendation :** Ajouter un controle RBAC dans `changeRole()` utilisant `this.permissionResolver.canCreateRole(actorRole, newRoleStr)` avant d'executer le changement.

### T-IMP-004 : assignPermissionGrant() est un stub vide

- **Specification canonique :** ORG-004 §6.1 — Custom roles via PermissionGrant[], org-bound, audité
- **Implémentation actuelle :** `identity-service.ts` ligne 323-325 — `assignPermissionGrant(_userId, _permissionString)` est un body vide.
- **Impact :** MAJEUR — les permissions derivees uniquement du role canonique; les grants personnalisés ne fonctionnent pas.
- **Recommendation :** Implémenter la persistance de PermissionGrant pour l'utilisateur cible et l'émission du domaine event correspondant.

### T-IMP-005 : Multi-org User entity limitation (T-103 d'ORG-002)

- **Specification canonique :** ORG-002 §4.1 dit qu'un utilisateur peut avoir des memberships actifs dans plusieurs organisations avec des roles differents.
- **Implémentation actuelle :** `user.ts` ligne 19 — `private readonly _orgId: string` — User entity lie a UNE seule org.
- **Impact :** ARCHITECTURAL — changement N:1→N:M necessaire dans le domain model.
- **Recommendation :** Option (a) : ajouter UserOrgBinding entity (N:M); Option (b) : permettre multiples entries User par email avec unique composite (email+org_id).

### T-IMP-006 : SuspendOrganization ne verifie pas le role de l'acteur

- **Specification canonique :** ORG-001 §3.2 — Acteur autorise: SuperAdmin OU Admin de l'organization
- **Implémentation actuelle :** `organization.service.ts` ligne 533-556 — `handleSuspendOrganization` ne fait AUCUNE verification de role via IAuthorizationPort.
- **Contraste :** `handleMergeOrganizations` (ligne 469) fait `await this.authorizer.hasRole(mergedById, 'superadmin')`, mais `handleSuspendOrganization` et `handleArchiveOrganization` ne font rien de tel.
- **Impact :** MAJEUR — toute personne authentifée peut suspendre/archiver n'importe quelle org.
- **Recommendation :** Ajouter des controles d'autorisation dans tous les handlers de modification d'etat d'org.

---

## 7. DOMAIN EVENTS RESTANTS — COUVERTURE

Events attendus par ORG-002 §7.2 (nouveaux, pas encore implémentés) :

| Event Attendu | Specifie dans ORG-002? | Present dans code? | Fichier |
|--------------|----------------------|-------------------|---------|
| InvitationCreated | ORG-002 §7.2 | NON | — |
| InvitationSent | ORG-002 §7.2 | NON | — |
| InvitationAccepted | ORG-002 §7.2 | NON | — |
| InvitationRejected | ORG-002 §7.2 | NON | — |
| InvitationRevoked | ORG-002 §7.2 | NON | — |
| InvitationExpired | ORG-002 §7.2 | NON | — |
| OnboardingStarted | ORG-002 §7.2 | NON | — |

Events existants implementes dans les codes verifiés :

| Event Present | Aggregate Source | Fichier |
|--------------|-----------------|---------|
| MemberJoinedGroup | RelationshipAggregate | `member/domain/events.ts` ligne 9 |
| MemberLeftGroup | RelationshipAggregate | `member/domain/events.ts` ligne 21 |
| OrgUnitReparented | RelationshipAggregate | `member/domain/events.ts` ligne 32 |
| ChildOrgTransferred | RelationshipAggregate | `member/domain/events.ts` ligne 45 |
| ChildOrgMerged | RelationshipAggregate | `member/domain/events.ts` ligne 57 |
| DescendantEnumerationRequested | RelationshipAggregate | `member/domain/events.ts` ligne 68 |
| UserCreated | IdentityAggregate | `user/domain/events/index.ts` ligne 16 |
| UserUpdated | IdentityAggregate | `user/domain/events/index.ts` ligne 28 |
| UserRoleChanged | IdentityAggregate | `user/domain/events/index.ts` ligne 38 |
| PasswordResetRequested | IdentityAggregate | `user/domain/events/index.ts` ligne 49 |
| UserLoggedIn | IdentityAggregate | `user/domain/events/index.ts` ligne 59 |
| UserLoggedOut | IdentityAggregate | `user/domain/events/index.ts` ligne 70 |
| SessionCreated | IdentityAggregate | `user/domain/events/index.ts` ligne 80 |
| SessionExpired | IdentityAggregate | `user/domain/events/index.ts` ligne 92 |
| SessionRevoked | IdentityAggregate | `user/domain/events/index.ts` ligne 102 |
| OrganizationCreated | OrganizationAggregate | `organization/domain/events.ts` ligne 21 |
| OrganizationSuspended | OrganizationAggregate | `organization/domain/events.ts` ligne 34 |
| OrganizationArchived | OrganizationAggregate | `organization/domain/events.ts` ligne 47 |
| OrgUnitCreated | OrganizationAggregate | `organization/domain/events.ts` ligne 62 |
| OrgUnitParentChanged | OrganizationAggregate | `organization/domain/events.ts` ligne 82 |
| OrganizationMerged | OrganizationAggregate | `organization/domain/events.ts` ligne 103 |

**Total events implémentés :** 21 sur ~27 attendus par les specifications ORG-001 a ORG-005. Les 6 manquant sont tous lies au systeme d'invitation.
