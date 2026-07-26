# ORG-004 — RBAC, Role Assignment & Permission Evaluation Model

**Doc ID:** ORG-004 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — MODELE CENTRAL RBAC DE LUMINA  
**Date:** 2026-07-24  
**Supersede:** Remplace toute specification informelle de roles, permissions, ou evaluation d'autorisation  
**Dependances:** DOC-012 (Domain Model — OrganizationAggregate, IdentityAggregate, RelationshipAggregate), DOC-015 (Domain Invariant Registry — INV ID-004/005/006, INV AUD-001/002/033), DOC-023 (Canonical Relational Rules — §4 NeverBreak rules for Role Assignment), DOC-017 (Persistence Model — §2.1/2.2), DOC-001 (Canonical Element Registry — Permission Concept + Permission Capability)

---

## PRINCIPE

Ce document est LE modele canonique pour le **Role-Based Access Control (RBAC)** de Lumina. Il definit trois couches STRICTEMENT SEPARÉES :

1. **Membership** — Qui est cette personne DANS CETTE ORGANISATION ?
2. **Role Assignment** — Quel role cette personne OCCUPE-T-ELLE ?
3. **Permission Evaluation** — Cette personne PEUT-ELLE faire CETTE action sur CETTE ressource ?

**Rgle constitutionnelle :** Ces trois couches sont ORTHOGONALES et NE DOIVENT JAMAIS tre confondues. Chaque couche a sa propre source de verite, son propre cycle de vie, et ses propres invariants.

---

## 1. MARQUAGE IGS-v1

| Element | Source Canonique | Statut Validation |
|---------|-----------------|------------------|
| Membership = RelationshipAggregate | DOC-012 RelationshipAggregate (§2.4) | Validate |
| IdentityAggregate pour user profiles | DOC-012 IdentityAggregate (§2.2) | Validate |
| UserRole enum | DOC-012 IdentityAggregate (Value Objects) | Validate |
| PermissionGrant format | DOC-012 IdentityAggregate (VO) | Validate |
| Role hierarchy | DOC-012 IdentityAggregate (§2.2) + BR-ID-004/005 | Validate |
| Wildcard audit | DOC-012 IdentityAggregate (BR-ID-006) | Validate |
| PermissionResolver Domain Service | DOC-012 IdentityAggregate (§2.2) | Validate |
| Audit de chaque permission check | DOC-015 AUD-001 + DOC-023 §6.1/6.2 | Validate |
| Custom roles | Derive de BR-CONFIG-004 + DOC-012 ConfigurationAggregate | Validate |

---

## 2. DISTINCTION ABSOLUE ENTRE COUCHES

### 2.1 La Triade Membres/Rle/Permission

| Couche | Question Repondu | Aggregate Proprietaire | Entite Cles | Invariant Maitre |
|--------|-----------------|----------------------|-------------|-----------------|
| **Membership** | QUI EST CETTE PERSONNE DANS CETTE ORG ? | `RelationshipAggregate` (DOC-012 §2.4) | `GroupMembership` | BR-REL-003 (preservation during transfer) |
| **Role Assignment** | QUEL RLE CETTE PERSONNE OCCUPE-T-ELLE ? | `IdentityAggregate` (DOC-012 §2.2) | `User`, `UserRole` | BR-ID-004/005 (attribution limits) |
| **Permission Evaluation** | CETTE PERSONNE PEUT-ELLE FAIRE CETTE ACTION SUR CETTE RESSOURCE ? | `PermissionResolver` (Domain Service of IdentityAggregate) | `PermissionGrant` | BR-AUD-001/002 (audit every evaluation) |

**CE NE SONT PAS LA MEME CHOSE.** Jamais melanger.

### 2.2 Flux de Donnes entre Couches

```
Requete utilisateur (userId, orgId, resource, action, scope)
    │
    ▼
[COUCHE 1: Membership]
LookupMembership(userId, orgId)
    → Found? Yes → membership_id + active_groups[]
    → Not found → DENY immediately
    │
    ▼
[COUCHE 2: Role Assignment]
LookupRoleAssignment(membership_id)
    → Found? Yes → role + role_manifest[]
    → Not found → DENY immediately
    │
    ▼
[COUCHE 3: Permission Evaluation]
PermissionResolver(role, resource, action, scope, delegated_perms[])
    → Found? Yes → ALLOW
    → Not found → DENY
```

Chaque couche peut rejeter independemment. Le rejet à n'importe quelle couche = DENIED global.

---

## 3. ROLES CANONIQUES

### 3.1 Hiérarchie des Rôles

```
superadmin  >  admin  >  treasurer  >  pastor  >  staff
     5            4         3           2         1
```

| Rôle | Portée | Description | Commands Autorisées (DOC-012) |
|------|--------|-------------|-------------------------------|
| **superadmin** | Global (toutes orgs) | Administrateur systeme complet. Cree les orgs, assigne TOUS les roles. | `CreateOrganization`, `ChangeUserRole` (all roles), `AssignPermissionGrant` |
| **admin** | Org-level | Gere l'organisation entiere (sauf creation superadmin). | `UpdateOrganizationSettings`, `CreateOrgUnit`, `TransferOrgUnit`, `ArchiveOrganization`, `ChangeUserRole` (non-superadmin only) |
| **treasurer** | Finance-only | Gestion financiere : transactions, rapports, categories. | `CompensateTransaction`, `SearchResources` (finance scoped), `ExportResourceReport` |
| **pastor** | Pastoral operations | Evenements, membres, communications. | `TriggerWorkflow` (pastoral), `SendNotification` |
| **staff** | Operations limitees | Operatins configurees par manifest org. | `SubmitFormData`, `SearchResources` (read-only) |

**Traceabilite :**
- UserRole enum : DOC-012 IdentityAggregate Value Objects
- BR-ID-004 : Superadmin peut assigner TOUS les roles (DOC-012 IdentityAggregate)
- BR-ID-005 : Admin ne peut créer que treasurer/pastor/staff (PAS superadmin) (DOC-012)
- BR-ID-006 : Wildcard permissions auditees mais autorisees (DOC-012)

### 3.2 Rgles d'Attribution

| Acteur Peut Assigner À | Roles Possibles | Restricion |
|-----------------------|----------------|------------|
| Superadmin | TOUS (incluant superadmin) | Aucune restriction |
| Admin | treasurer, pastor, staff | Pas superadmin (BR-ID-005) |
| Treasurer | Aucun role (operationnel seulement) | Limite à ses fonctions finance |
| Pastor | Aucun role (operationnel seulement) | Limite à ses fonctions pastorales |
| Staff | Aucun | Limite à ses operations configurees |

**Regles techniques :**
- L'attribution de role est un DOMAIN EVENT : `UserRoleChanged` (DOC-012 IdentityAggregate)
- Chaque attribution ecrite dans `audit_entries` avec full snapshot (NB-PERSIST-006, DOC-023 §6.3)
- Each `UserRoleChanged` event captured : old_role, new_role, assigned_by, target_user, timestamp

### 3.3 Révocation

| Action | Comportement | Source |
|--------|-------------|--------|
| Revoquer un role | Supprime le RoleAssignment pour ce membership x org | IdentityAggregate |
| Historique | L'ancien role reste dans l'historique audit (immutable) | NB-PERSIST-006, DOC-023 §6.3 |
| Permissions héritées | Se propagent automatiquement vers le bas (child scopes perdent permissions du role révoqué) | ORG-003 §4.1 |

**Algorithm de révocation :**
```
RevokeRole(membership_id):
    old_assignment := LookupRoleAssignment(membership_id)
    DeleteRoleAssignment(membership_id)
    EmitEvent(UserRoleChanged, {
        user_id: old_assignment.user_id,
        org_id: old_assignment.org_id,
        old_role: old_assignment.role,
        new_role: null,
        revoked_by: context.current_user_id,
        timestamp: NOW()
    })
    LogToAudit("Role revoked", membership_id, 
               old_value={role: old_assignment.role}, 
               new_value={role: null})
```

---

## 4. PERMISSIONS ATOMIQUES

### 4.1 Format

Chaque permission atomique suit le format :

```
resource:action:level
```

| Composant | Description | Valeurs possibles |
|-----------|-------------|------------------|
| `resource` | Ce sur quoi on agit | transaction, member, event, org_unit, settings, report, notification, category, form, archive_entry |
| `action` | L'operation permise | read, write, create, update, delete, approve, reject, export, send, invite, reparent, submit |
| `level` | La portée minimale requise | org, group, custom |

**Exemples :**
- `transaction:create:org` — creer une transaction dans l'org
- `transaction:approve:org` — approuver une transaction
- `member:invite:group` — inviter un membre dans un groupe
- `org_unit:reparent:org` — changer le parent d'une unite hiérarchique
- `settings:update:org` — mettre à jour les parametres org
- `report:export:org` — exporter un rapport financier
- `notification:send:org` — envoyer une notification
- `category:*:*` — toutes operations sur les categories

### 4.2 Manifest de Permissions par Rôle

Chaque role canonique est un SET de permissions atomiques :

| Rôle | Permissions Atomiques |
|------|---------------------|
| **superadmin** | `{ *:*:* }` (wildcard total) |
| **admin** | `{ transaction:read:org, transaction:write:org, transaction:create:org, transaction:approve:org, transaction:reject:org, member:read:org, member:write:org, member:invite:org, member:delete:org, event:read:org, event:write:org, event:create:org, event:cancel:org, org_unit:read:org, org_unit:create:org, org_unit:update:org, org_unit:reparent:org, settings:update:org, report:read:org, report:export:org, notification:send:org, category:read:org, category:write:org, form:manage:org }` |
| **treasurer** | `{ transaction:read:org, transaction:write:org, transaction:create:org, transaction:approve:org, transaction:reject:org, report:read:org, report:export:org, category:read:org, category:write:org }` |
| **pastor** | `{ event:read:org, event:write:org, event:create:org, member:read:org, member:invite:group, notification:send:org, org_unit:create:group, form:submit:org }` |
| **staff** | `{ event:read:org, member:read:org, form:submit:org }` (configurable via manifest org) |

**Traceabilite :**
- Superadmin wildcard : DOC-012 IdentityAggregate `PermissionGrant` VO, BR-ID-006
- Admin permissions : derivees de OrganizationAggregate commands + BR-ORG-001
- Treasurer/Pastor limits : DOC-012 IdentityAggregate scope restrictions
- Staff configurable : DOC-012 ConfigurationAggregate BR-CONFIG-004

### 4.3 Permissions Contextuelles

Certaines permissions necessitent un contexte additionnel pour tre evaluees :

| Permission | Contexte Requis | Source |
|-----------|----------------|--------|
| `transaction:approve:group` | `scope=group` ET `transaction.status=draft` | WorkflowAggregate BR-WF-005 |
| `report:export` | Permission `reporting:*:read` ET `budget_fiscal_validated=true` | ReportingAggregate BR-RPT-003 |
| `org_unit:reparent:org` | `depth_level < 4` (pour preserver profondeur max 5) | ORG-003 §3.3, DOC-015 INV REL-002 |
| `notification:send:org` | `severity != critical` OU NOT quiet_hours | NotificationAggregate BR-NOT-003/004 |
| `member:invite:group` | User existe ET org pas suspended | DOC-015 STATUS-010, BR-ORG-006 |

### 4.4 Permissions Héritées

Un role à un niveau scope HERITE des permissions du scope parent PLUS large SAUF si explicitement restreint.

**Principe :** L'heritage de permissions suit la hierarchie DAG de bas en haut (OR OG-003 §4.1).

**Algorithme :**
```
ResolveInheritedPermissions(user_role, target_scope_path):
    permissions := {}
    
    FOR each ancestor IN AncestorsOf(target_scope_path):
        ancestor_perms := RoleManifest(user_role, scope=ancestor)
        permissions := permissions UNION ancestor_perms
    
    /* Apply explicit restrictions at target level */
    restricted_permissions := CheckExplicitRestrictions(target_scope_path)
    final_permissions := permissions MINUS restricted_permissions
    
    RETURN final_permissions
```

**Regle :** L'heritage JAMAIS soustrait de permissions (jamais reduce). On peut restreindre explicitement, mais pas heriter moins que ce que le parent a.

### 4.5 Permissions Déléguées

Voir ORG-003 §4.2 pour la delegation. Les permissions deleguees :
- Sont temporaires (expirent à `expires_at`)
- S'ajoutent AUX permissions du role canonique (ne le remplacent pas)
- Sont auditees (`PermissionGrantModified` event, NB-PERSIST-006)
- Sont resolues DANS l'algorithme PermissionEvaluation (étape 5 de §6.1)

---

## 5. PERMISSION EVALUATION ENGINE

### 5.1 Algorithme de Résolution

```
PermissionCheck(user_id, target_org_id, resource, action, scope_type, scope_target):
    
    // Step 1: Membership lookup
    membership := LookupMembership(user_id, target_org_id)
    IF membership IS NULL:
        return AuditAndReturn(DENIED, "no_membership")
    
    // Step 2: Role assignment lookup
    role_assignment := LookupRoleAssignment(membership.id, target_org_id)
    IF role_assignment IS NULL:
        return AuditAndReturn(DENIED, "no_role_assignment")
    
    // Step 3: Build base permissions from role manifest
    permissions := ResolveRoleManifest(role_assignment.role)
    
    // Step 4: Add inherited permissions (from parent scopes)
    inherited := ResolveInheritedPermissions(role_assignment, scope_target)
    permissions := permissions UNION inherited
    
    // Step 5: Add active delegated permissions
    delegations := LookupActiveDelegations(user_id, target_org_id)
    FOR EACH del IN delegations:
        IF del.expires_at > NOW() AND ScopeOverlaps(del.scope, scope_type, scope_target):
            permissions := permissions UNION del.granted_permissions
    
    // Step 6: Check if resource:action is covered
    resource_action := format("{resource}:{action}")
    IF IsWildcard(role_assignment.role) AND resource_action IN permissions["*:*:*"]:
        // Wildcard grants everything UNLESS scope restriction applies
        IF NOT ScopeRestrictionExists(resource_action, scope_type, scope_target):
            result := ALLOWED
        ELSE:
            result := CHECK_SCOPE_RESTRICTION
    ELSE IF {resource:action} NOT IN permissions:
        result := DENIED
    ELSE:
        // Check if the permission covers the requested scope
        IF PermissionScopeLevel(permissions[{resource:action}]) >= RequiredScopeLevel(scope_type):
            result := ALLOWED
        ELSE:
            result := DENIED  // Permission exists but doesn't cover this scope
    
    // Step 7: Check denial policies (deny always wins)
    IF AnyDenyPolicy(user_id, target_org_id, resource, action, scope_type, scope_target):
        result := DENIED
    
    // Step 8: Audit the evaluation
    AuditPermissionCheck({
        userId: user_id,
        targetOrgId: target_org_id,
        resource: resource,
        action: action,
        scope: {type: scope_type, target: scope_target},
        result: result,
        reason: derivation_reason,
        timestamp: NOW()
    })
    
    RETURN result
```

**Traceabilite algorithme :**
- Step 1 : RelationshipAggregate (§2.4), GroupMembership entity
- Step 2 : IdentityAggregate (§2.2), UserRole value object
- Step 3 : PermissionResolver domain service (DOC-012 IdentityAggregate)
- Step 4 : ORG-003 §4.1 Inheritance algorithm
- Step 5 : ORG-003 §4.2 Delegation algorithm
- Step 6 : Permission manifest comparison + ORG-003 §5.2 conflict resolution
- Step 7 : DOC-015 deny-before-grant principle
- Step 8 : DOC-015 AUD-001, AUD-002; DOC-023 §6.1/6.2

### 5.2 Priorités de Conflit (Redefined as Decision Rules)

Quand plusieurs regles s'appliquent simultanément :

| Ordre | Regle | Justification |
|-------|-------|--------------|
| 1 | **REFUSE > GRANT** — Si UNE quelconque policy denies, le resultat est denied | Principle of least privilege; conforme INV-001 type immutabilite |
| 2 | **Specific > General** — Une permission restrictive sur un scope precise prime une permission large | ORG-003 §5.2 Conflict de Portee |
| 3 | **Explicit > Implicit** — Un grant direct prime un grant herite | ORG-003 §5.2 |
| 4 | **Time-bound > Permanent** — Une deleguation active prime un role standard | Delegations temporaires ont precedence |

**Implementation decision matrix :**
```
Decision(user, resource, action, scope):
    IF ExplicitDeny(user, resource, action, scope):
        return DENIED  // Rule 1: deny always wins
    
    IF PermissionCoveredByScope(user.role_manifest, resource, action, scope):
        specific_perms := FindMostSpecificPermission(user, resource, action, scope)
        IF specific_perms grants:
            IF DelegatedPermsOverride(user, resource, action, scope):
                return ALLOWED (delegation)
            return ALLOWED (specific role manifest)
    
    return DENIED  // No covering permission found
```

### 5.3 Audit de la Permission

Chaque evaluation de permission est journalisee dans `AuditAggregate.audit_entries` :

```json
{
    "action": "permission_check",
    "entityType": "PermissionResolver",
    "entityId": null,
    "userId": "uuid-user-id",
    "targetOrgId": "uuid-org-id",
    "metadata": {
        "resource": "transaction",
        "action": "approve",
        "scope": {"type": "org", "target": null},
        "result": "granted",
        "reason": "admin role includes transaction:approve:org",
        "inherited_from": null,
        "delegation_applied": false,
        "denied_by_policy": null
    },
    "oldValues": {},
    "newValues": {
        "evaluation_result": "granted",
        "effective_permissions": ["transaction:approve:org"]
    }
}
```

**Traceabilite :** DOC-015 AUD-001 (journal immuable), AUD-002 (old+new values), ACCESS-033 (acces restreint aux admins/auditeurs).

---

## 6. GÉNÉRATION DYNAMIQUE DE RÔLES PERSONNALISÉS

Les admins peuvent creer des roles personnalisés sous contraintes strictes :

### 6.1 Specification Custom Role

```
CustomRole {
    id: UUID                    // Generated, immutable (NB-ID-001)
    name: string                // Human-readable
    org_id: UUID                // Bound to one org
    permissions_set: PermissionGrant[]  // Subset of canonical perms
    scope_levels: ScopeLevel[]  // ['org', 'group'] or subset
    inherits_from: RoleName?    // Optional: inherits from a canonical role
    is_active: boolean          // Can be toggled without deletion
}
```

### 6.2 Contraintes Absolues

| Contrainte | Regle | Violation |
|-----------|-------|----------|
| **No new capabilities** | Custom roles ne peuvent PAS creer de nouvelles capabilities | DOC-012 workflow BR-WF-006: workflows cannot add to manifest |
| **Subset only** | Permissions sont toujours subsets de capabilities existantes | DOC-001 Element Registry: capability list is closed |
| **Org-bound** | Un custom role appartient à UNE org uniquement | DOC-023 NB-MT-001 (multi-tenant isolation) |
| **Audited** | Creation/modification/deletion auditee | DOC-015 AUD-001, AUD-002 |
| **Non-transferable** | Un custom role ne peut pas etre exporte vers une autre org | Same as org-bound constraint |
| **Superadmin-only create** | Seul l'admin (ou superadmin) peut créer des custom roles | Role assignment restriction |

### 6.3 Inheritance from Canonical Roles

```
custom_role.inherits_from = "admin"
→ custom_role.permissions_set = admin_permissions [subset chosen by admin]
→ custom_role SCOPES are independent (can be narrower than admin)
```

**Important :** L'heritage ne copie PAS les permissions. Il sert de template que l'admin peut retrancher, jamais etendre.

---

## 7. TRACABILITÉ COMPLET

### 7.1 Matrice de Reference Croisée

| Section ORG-004 | Document Source | Reference Canonique |
|----------------|-----------------|---------------------|
| Distinction triade (membership/role/permission) | DOC-012 §2.2 IdentityAggregate + §2.4 RelationshipAggregate | Three orthogonal layers |
| UserRole enum | DOC-012 IdentityAggregate Value Objects | superadmin/admin/treasurer/pastor/staff |
| BR-ID-004 (superadmin can assign all roles) | DOC-012 IdentityAggregate Business Rules | Command: ChangeUserRole |
| BR-ID-005 (admin limited) | DOC-012 IdentityAggregate Business Rules | Cannot assign superadmin |
| BR-ID-006 (wildcard audited) | DOC-012 IdentityAggregate Business Rules | Logged but allowed |
| Permission format resource:action:level | DOC-012 IdentityAggregate PermissionGrant VO | Value Object spec |
| PermissionResolver domain service | DOC-012 IdentityAggregate Domain Services | Algorithm implementation |
| Role hierarchy ordering | DOC-012 IdentityAggregate + RelationshipAggregate | BR-REL-004 inheritance direction |
| Permission inheritance | ORG-003 §4.1 | Based on DAG traversal |
| Permission delegation | ORG-003 §4.2 | Explicit, temporary, auditable |
| Custom roles | DOC-012 ConfigurationAggregate + DOC-001 Element Registry | Subset constraint |
| Permission check audit | DOC-015 AUD-001/002/033 | Every evaluation logged |
| Role change event | DOC-012 IdentityAggregate Domain Events | UserRoleChanged event |
| NeverDelete policy | DOC-015 VOC-001 | Active/deactivate only, never delete canonical roles |
| Multi-tenant isolation | DOC-023 §8, NB-MT-001 to 004 | _org_id enforced |
| Immutable audit entries | DOC-023 §6.3, NB-PERSIST-006 | Append-only |

### 7.2 References API & Specification

| Document | Reference | Contenu |
|----------|-----------|---------|
| DOC-012 | §2.2 IdentityAggregate | UserRole, PermissionGrant, PermissionResolver |
| DOC-012 | §2.4 RelationshipAggregate | GroupMembership, membership resolution |
| DOC-012 | Commands | ChangeUserRole, AssignPermissionGrant |
| DOC-015 | INV ID-004/005/006 | BR-ID-004, BR-ID-005, BR-ID-006 |
| DOC-015 | INV AUD-001/002/033 | Audit requirements for permission eval |
| DOC-023 | §9 NeverBreak rules | NB-RR rules, NB-MT rules |
| DOC-001 | Element Registry | Permission Concept + Permission Capability |
| DOC-017 | §2.2 IdentityAggregate Persistence | Session context, role assignment persistence |

---

## 8. REGLES JAMAISMODIFIER DERIVEES

| # | Regle | Description | Violation |
|---|-------|-------------|-----------|
| NB-RBAC-001 | JamaisModifier-TroisCouchesSeparées | Membership, Role Assignment, et Permission Evaluation sont TOUJOURS separees. Jamais fusionnees dans une seule structure. | Mettre membership et role dans la meme entite de persistence |
| NB-RBAC-002 | JamaisModifier-ClosedCapabilities | Les capabilities sont liste fermee (DOC-001). Aucun custom role ne peut ajouter de capability nouvelle. | Custom role qui inclut `security:pivot:*` (capability non-existante) |
| NB-RBAC-003 | JamaisModifier-PermissionDecreasingOnly | Les custom roles ne peuvent SOUSTRAIRE des permissions d'un role parent, jamais en AJOUTER. | Custom role "super-admin-local" avec plus de perms qu'un superadmin |
| NB-RBAC-004 | JamaisModifier-AuditAllChecks | Chaque evaluation de permission, meme les caches reussies, est auditee. | Skippert l'audit pour performance |
| NB-RBAC-005 | JamaisModifier-DenyWins | Dans tout conflit, le deny prime sur le grant. Sans exception. | Permission grant qui overrid un deny policy explicite |
| NB-RBAC-006 | JamaisModifier-RoleImmutableName | Les noms des roles canoniques (superadmin, admin, treasurer, pastor, staff) ne changent jamais. Seuls les custom roles sont nommables. | Renommer "treasurer" en "finance-manager" et le traiter comme canonical |

---

## 9. SYNTHÈSE EXÉCUTIVE

Ce document etablit le modele RBAC canonique de Lumina avec :

1. **Trois couches orthogonales** — Membership, Role Assignment, Permission Evaluation (NB-RBAC-001)
2. **Cinq roles canoniques** — superadmin > admin > treasurer > pastor > staff
3. **Permissions atomiques** — format `resource:action:level`, manifests par role
4. **Evaluation deterministe** — algorithme à 8 etapes avec audit obligatoire (NB-RBAC-004)
5. **Priorites claires** — deny > grant, specific > general, explicit > implicit, time-bound > permanent
6. **Roles personnalises** — subsets uniquement, org-bound, jamais de nouvelles capabilities
7. **Heritage DAG-based** — permissions heritees suivent la hierarchie organisationnelle vers le bas
8. **Delegation explicite** — temporaire, auditee, non-transitive

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Canonical Architect | Creation — Modele RBAC central pour Lumina v2 | CTO + Arch Principal |
