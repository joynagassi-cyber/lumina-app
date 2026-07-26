# ORG-003 — Hierarchy, Division & Scope Model

**Doc ID:** ORG-003 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — SCOPE = LIMIT D'ACTION D'UN RLE OU D'UNE OPERATION  
**Date:** 2026-07-24  
**Supersede:** Remplace toute specification informelle de scope ou hierarchie organisationnelle  
**Dependances:** DOC-012 (Domain Model — OrganizationAggregate, RelationshipAggregate, IdentityAggregate), DOC-015 (Domain Invariant Registry — INV REL-001, INV REL-002), DOC-023 (Canonical Relational Rules — §3.4 Auto-Referenced Relations, §9 NeverBreak rules), DOC-017 (Persistence Model — §2.1 OrganizationAggregate, §2.4 RelationshipAggregate)

---

## PRINCIPE

Ce document definit le modele canonique pour la **hierarchie organisationnelle**, la **division en unitees structurelles (OrgUnit)**, et le **scope** qui determine la portee d'une action ou d'un role.

Le scope n'est PAS un role. Le scope n'est PAS une permission. Le scope est une dimension orthogonale au role qui fixe LA PORTEE GEOGRAPHIQUE/STRUCTURELLE sur laquelle une action s'applique.

**Rgle constitutionnelle :** Si un element de ce document ne peut pas tre trace vers un Aggregate DOC-012 + un invariant DOC-015 + une rgle relationnelle DOC-023 → SIGNALER comme invention interdite.

---

## 1. MARQUAGE IGS-v1

| Element | Source Canonique | Statut Validation |
|---------|----------------|------------------|
| OrgUnit comme DAG | DOC-012 OrganizationAggregate (§2.1) + RelationshipAggregate (§2.4) | Validate |
| Profondeur max 5 | DOC-015 INV REL-002 (DEPTH-002) + DOC-023 §3.4 | Validate |
| Detection cycles Kahn's algo | DOC-015 INV REL-001 (REL-001) + DOC-023 §3.4 | Validate |
| Multi-tenant isolation (_org_id) | DOC-023 §8 + NB-MT-001 | Validate |
| Soft-delete cascade | DOC-012 LifecycleAggregate (§2.11) + DOC-023 §7 | Validate |
| Immutabilite des transactions | DOC-015 FIN-001 (INV-001) | Validate |

---

## 2. NOTION DE SCOPE

Le SCOPE determine LA PORTEE D'UNE ACTION OU D'UN ROLE.

### 2.1 Niveaux de Scope

| Scope Level | Portee | Exemple Operationnel |
|-------------|--------|---------------------|
| `org` | Toute l'organisation | Admin globale : voir toutes les transactions de l'org |
| `group` | Un sous-groupe/org_unit donne | Responsable de chorale : voir transactions de sa chorale uniquement |
| `custom` | Une portee personnalisee via settings org | Defini dynamiquement par l'admin (ex: "secteur Nord") |

### 2.2 Regle Fondamentale : Distinction Triade

```
ROLE      →  "Que peux-tu faire ?"         (perms atomiques : resource:action)
SCOPE     →  "Sur quelle etendue peux-tu le faire ?"  (org / group / custom)
MEMBERSHIP  →  "Qui es-tu dans cette org ?"  (ton appartenance structurelle)
```

**Ces trois dimensions sont orthogonales et se combinent ainsi :**

```
Autorisation(user, action, resource) =
    Membership(user, org)          →  identifie qui est l'utilisateur
    × RoleAssignment(membership)   →  identifie quel role il detient
    × PermissionManifest(role)     →  identifie quelles actions sont possibles
    × ScopeResolution(request)     →  identifie sur quelle etendue
```

Si l'une des quatre composantes manque → DENIED.

### 2.3 Scope Resolution

Le scope est resolve à chaque demande d'autorisation via l'algorithme (§4.1). Il est injecte par le Context Manager (DOC-001 Runtime Services) comme contexte de requete.

---

## 3. HIERARCHIE ORGANISATIONNELLE

### 3.1 Structure en DAG

L'organisation interne est modelisee comme un DAG (Directed Acyclic Graph). Cette structure correspond à la relation auto-referencee `OrgUnitParentLink` definie dans RelationshipAggregate (DOC-012, §2.4).

```
Niveaux max : 5 (BR-ORG-002, INV REL-002)

Org Root (depth_level = 0)
├── Departement A (depth_level = 1)
│   ├── Section A1 (depth_level = 2)
│   └── Section A2 (depth_level = 2)
│       └── Groupe A2a (depth_level = 3)
└── Departement B (depth_level = 1)
    └── Section B1 (depth_level = 2)
```

**Traceabilite :**
- `OrganizationAggregate` racine : DOC-012 §2.1
- `OrgUnit` entite : DOC-012 §2.1
- `OrgUnitParentLink` relation auto-referencee : DOC-012 §2.4, DOC-023 §3.4
- Profondeur max 5 : DOC-015 INV REL-002, DOC-023 §3.4 Contraintes de Profondeur
- Detection cycles : DOC-015 INV REL-001, DOC-023 §3.4 DAG Et Detection De Cycles

### 3.2 Regles de Creation

| Acteur | Peut Creer Au Niveau De | Source |
|--------|------------------------|--------|
| Superadmin | TOUS les org_units de TOUTES les orgs | DOC-012 IdentityAggregate, BR-ID-004 |
| Admin | Tout org_unit enfant des org_units qu'il administre (scope = org ou parent direct) | DOC-012 OrganizationAggregate, BR-ORG-001 |
| Treasurer | SEULEMENT au niveau de leur scope actuel (finance only) | DOC-012 IdentityAggregate |
| Pastor | SEULEMENT au niveau de leur scope actuel (pastoral operations) | DOC-012 IdentityAggregate |
| Staff | Selon configuration org (limite par manifest) | DOC-012 ConfigurationAggregate, BR-CONFIG-004 |

**Regles techniques :**
- Qui peut creer un org_unit : roles ayant permission `org_unit:create` au niveau parent direct
- La creation est un Domain Event : `OrgUnitCreated` (DOC-012, §2.1)
- Chaque creation ecrite dans `audit_entries` avec old_value=null + new_value=OrgUnit snapshot (NB-PERSIST-006, DOC-023 §6.3)

### 3.3 Regles de Mouvement

| Action | Permission Requise | Validation |
|--------|-------------------|------------|
| Deplacer un org_unit enfant | `org_unit:update` au niveau parent | Cycle detection pre-mouvement (Kahn's algo) |
| Transférer un enfant vers un autre parent | Validation des DEUX parents (ancien + nouveau) | `BR-REL-003` : transfert preservetous memberships existants |
| Fusionner deux branches | Action superadmin uniquement | `BR-ORG-005` : fusion necessite validation superadmin |
| Cycle detecte | Rejet instantane | Topological sort + DB trigger (DOC-023 §3.4) |

**Domain Events produits :**
- `OrgUnitParentChanged` : khi reparent succeed
- `ChildOrgTransferred` : khi transfer completed
- `ChildOrgMerged` : khi merge completed (superadmin only)

### 3.4 Regles de Suppression

| Action | Comportement | Justification |
|--------|-------------|---------------|
| Supprimer un org_unit | Archive tous les membres associes (cascade soft-delete) | DOC-023 §7 + LifecycleAggregate BR-LIF-001 |
| Transactions liees | Restent intactes (INV-001 immutabilite) | DOC-015 FIN-001 |
| Notifications associees | Passent en lecture seule | NotificationAggregate BR-NOT-001 |
| Memberships sous-jacentes | Preserves (BR-REL-003) | RelationshipAggregate preserve toute relation existante |

**Soft-delete cascade algorithm :**
```
ArchiveOrgUnit(org_unit_id):
    FOR each descendant_org_unit IN DescendantEnumerator(org_unit_id):
        SetStatus(descendant_org_unit, "archived")
    FOR each membership IN GroupMembership WHERE scope_target = org_unit_id:
        InvalidateActive(membership)  /* soft-inactivate */
    LogToAudit("OrgUnit archived", org_unit_id, old_status="active", new_status="archived")
```

---

## 4. HÉRITAGE & DELÉGATION

### 4.1 Heritage des Permissions

Un responsable d'un org_unit herite implicitement des permissions de son parent sur cet org_unit ET sur tous ses descendants.

**Principe :** L'heritage suit la structure DAG vers le bas (parent → enfants), jamais vers le haut.

**Algorithme :**
```
InheritPermissions(scope_owner_role, target_org_unit):
    current_unit := target_org_unit
    permissions := {}
    
    WHILE current_unit IS NOT NULL AND depth(current_unit) >= 0:
        permissions := permissions UNION RoleManifest(current_unit.parent_role_at_this_level)
        current_unit := parent(current_unit)
    
    RETURN ExcludeExplicitRestrictions(permissions, target_org_unit)
```

**Exception :** L'heritage est bloque si une restriction explicite existe au niveau cible (`ExcludeExplicitRestrictions`).

**Traceabilite :** `InheritancePolicy` (DOC-012 IdentityAggregate, §2.2); `BR-REL-003` preservation relations (DOC-012 RelationshipAggregate).

### 4.2 Delegations

La delegation est EXPLICITE, jamais implicite.

**Signature domaine :**
```
Deleguer(FromUser, ToUser, PermissionGrant, Scope, Duration)
```

**Comportement :**
1. Crée un GrantEntry temporaire lie à un membership specifique
2. Lie la permission deleguee au membre cible
3. Bound par une duree expiree (`expires_at`)
4. Revoquable à tout moment par le delegant (before expiration)

**Proprietes :**
- `Delegation ≠ changement de role permanent`
- Les delegations expirees sont automatickement supprimees (nettoyage par PurgeScheduler, DOC-012 LifecycleAggregate)
- Chaque delegation ecrite dans audit_entries (NB-PERSIST-006, DOC-023 §6.3)
- Domain Event : `PermissionGrantModified` (via IdentityAggregate)

**Limites :**
- On ne peut deleguer que des permissions que l'on detient soi-meme (pas de delegation transitive au-dela de son propre scope)
- Une delegation ne peut pas accorder plus de permissions que le role source (no permission escalation beyond original role)
- Wildcard `["*"]` delegables mais audites explicitement (BR-ID-006, DOC-012 IdentityAggregate)

---

## 5. LIMITES DE PORTEE

### 5.1 Algorithme de Resolution de Scope

Lors d'une demande d'autorisation, le systeme resout le scope valide via cet algorithme :

```
ResolveScope(user_id, target_org_id, requested_scope_type, requested_scope_target):
    // Step 1: Find active membership
    membership := LookupMembership(user_id, target_org_id)
    IF membership IS NULL:
        RETURN {authorized: false, reason: "no_membership"}
    
    // Step 2: Get role from membership
    role_assignment := LookupRoleAssignment(membership.id)
    IF role_assignment IS NULL:
        RETURN {authorized: false, reason: "no_role"}
    
    // Step 3: Get permissions from role manifest
    permissions := PermissionResolver(role_assignment.role)
    
    // Step 4: Resolve inheritance chain
    inherited_permissions := InheritPermissions(role_assignment, requested_scope_target)
    all_permissions := permissions UNION inherited_permissions
    
    // Step 5: Add delegated permissions (if within duration)
    active_delegations := LookupActiveDelegations(user_id)
    FOR EACH delegation IN active_delegations:
        IF delegation.expires_at > NOW() AND delegation.scope CONTAINS requested_scope_target:
            all_permissions := all_permissions UNION delegation.permissions
    
    // Step 6: Check if action is covered by any permission at the requested scope
    IF NOT PermissionCoversScope(all_permissions, requested_scope):
        RETURN {authorized: false, reason: "scope_not_covered"}
    
    // Step 7: Verify no denial policy applies
    IF AnyDenyPolicy(user_id, requested_scope):
        RETURN {authorized: false, reason: "explicit_denial"}
    
    RETURN {authorized: true, permissions: all_permissions}
```

**Traceabilite :** Algorithme composite :
- Step 1-2 : IdentityAggregate (§2.2), DOC-012
- Step 3 : PermissionResolver, DOC-012 IdentityAggregate Domain Service
- Step 4 : InheritPermissions, ORG-003 §4.1
- Step 5 : Delegations, ORG-003 §4.2
- Step 6-7 : Conflict resolution, ORG-003 §5.2

### 5.2 Conflits de Portee

Si plusieurs regles s'appliquent au meme scope :

| Priorite | Regle | Exemple |
|----------|-------|---------|
| 1 (haute) | **Denied > Allowed** | Meme si admin a `transaction:read`, un deny policy explicite bloque |
| 2 | **Plus specifique > Plus general** | `transaction:read:group/chorale-soprano` prime sur `transaction:read:org` |
| 3 | **Explicit > Implicit** | Grant direct prime grant herite |
| 4 | **Time-bound > Permanent** | Deleguation active prime role standard |

**Justification :** Ces priorites sont derivees des principes RBAC standards (NIST 2004, BPD model) adaptes au contexte Lumina multi-tenant.

### 5.3 Immutabilite du Scope

Une fois qu'une action est realisee avec un certain scope :

- L'audit entry contient l'EXACT scope applicable au moment de l'action (DOC-023 §6.2 Before/Apres)
- Il est IMPOSSIBLE de modifier le scope a posteriori (le scope fait partie de la preuve)
- Le scope est stocke dans le champ `scope_target` de l'audit entry (DOC-023 §6.1)

**Rgle NeverBreak :**
```
SCOPE-IS-AUDITED = SI toute action utilisateur est capturee dans AuditAggregate
                     avec l'exact scope applicable au moment de l'action,
                     ET qu'il est impossible de modifier ce scope retroactivement.
```
Cette regle herite de NB-PERSIST-006 (DOC-017 §6) et BR-AUD-001/002 (DOC-015 AUD-001, AUD-002).

---

## 6. MATRICE DES PERMISSIONS PAR NIVEAU SCOPE

| Operation | org | group | custom |
|-----------|-----|-------|--------|
| Create org_unit | Yes (superadmin/admin) | Limited (admin/pastor) | Configurable |
| Reparent org_unit | Yes (superadmin) | No (requires org-level) | No |
| Read transactions | All scopes | Own scope only | Configurable |
| Approve transaction | Full org | Own scope only | Configurable |
| Export report | Full org | Own scope only | Configurable |
| Manage vocabulary | Full org (admin only) | No | No |
| Invite members | Full org | Own scope only | Configurable |
| Send notifications | Full org | Own scope only | Configurable |
| Update org settings | Superadmin/Admin only | No | No |

---

## 7. TRACABILITE CROISEE

| Section ORG-003 | Document Source | Reference |
|----------------|-----------------|-----------|
| Scope notion (regle triade) | DOC-012 IdentityAggregate + RelationshipAggregate + ConfigurationAggregate | 3 couches orthogonales |
| DAG structure | DOC-012 RelationshipAggregate (§2.4, BR-REL-001, BR-REL-002) | OrgUnitParentLink |
| Depth max 5 | DOC-015 INV REL-002 (DEPTH-002) | CRITIQUE |
| Cycle detection | DOC-015 INV REL-001 (REL-001) | CRITIQUE |
| Heritage permissions | DOC-012 IdentityAggregate (§2.2, InheritancePolicy) | BR-ID-004 |
| Delegations | DOC-012 IdentityAggregate (§2.2, AssignPermissionGrant command) | AUD-001 audit |
| Soft-delete cascade | DOC-012 LifecycleAggregate (§2.11) + DOC-023 §7 | BR-LIF-001 |
| Transaction immutability | DOC-015 FIN-001 (INV-001) | CRITIQUE |
| Multi-tenant _org_id | DOC-023 §8 | NB-MT-001 |
| Creation rules | DOC-012 OrganizationAggregate (BR-ORG-001 à BR-ORG-006) | Commands autorisees |
| Movement rules | DOC-012 RelationshipAggregate (BR-REL-003) | ChangeOrgUnitParent command |
| Membership query | DOC-012 RelationshipAggregate (§2.4) | GroupMembership |
| Role hierarchy | DOC-012 IdentityAggregate (§2.2, UserRole enum) | superadmin > admin > treasurer > pastor > staff |
| Wildcard audit | DOC-012 IdentityAggregate (BR-ID-006) | Audite mais autorise |

---

## 8. REGLES JAMAISMODIFIER DERIVEES

| # | Regle | Description | Violation |
|---|-------|-------------|-----------|
| NB-SCOPE-001 | JamaisModifier-ScopeOrthogonal | Le scope est une dimension orthogonale au role. Jamais fusionne ni substitue. | Remplacer scope par role dans une decision d'autorisation |
| NB-SCOPE-002 | JamaisModifier-DAGAcyclique | La hierarchie org_unit est TOUJOURS un DAG. Aucun cycle n'est toler. | Permettre qu'un org_unit devienne son propre ancetre indirectement |
| NB-SCOPE-003 | JamaisModifier-ProfondeurMax5 | Aucun org_unit ne peut depasser depth_level=4 (5 niveaux incluant root=0). | Creer un org_unit au niveau 6 |
| NB-SCOPE-004 | JamaisModifier-DelegationExterne | La delegation est TOUJOURS explicite, temporaire, et auditee. | Deleguer implicitement par l'heritage structurel |
| NB-SCOPE-005 | JamaisModifier-ScopeAudit | Le scope d'une action est PARTIE INTEGRANTE de l'audit entry et IMmodifiable. | Modifier scope_target d'une entry d'audit existante |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Canonical Architect | Creation — Modele hierarchie/division/scope pour Lumina v2 | CTO + Arch Principal |
