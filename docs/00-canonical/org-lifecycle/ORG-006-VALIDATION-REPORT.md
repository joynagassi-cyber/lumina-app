# ORG-006 — Validation Report

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| **Doc ID** | ORG-006 |
| **Version** | 1.0 |
| **Statut** | CANONIQUE — RAPPORT DE VALIDATION CROISEE |
| **Date** | 2026-07-24 |
| **Dépendances** | ORG-001, ORG-002, ORG-003, ORG-004, ORG-005 (source de validation), DOC-012, DOC-013, DOC-014, DOC-015, DOC-023 |
| **Source canonique** | DOC-012 (Canonical Domain Model), DOC-013 (Aggregate Boundaries), DOC-014 (Command-Event Registry), DOC-015 (Invariant Registry), DOC-023 (Canonical Relational Rules), API-CONTRACT-001 à 006, ASS-001 à 006, PAS-001 à 006, RTS-v1 |
| **Transformation rule** | org-validation-specifier v1.0 |
| **Architecture version** | v1.0 (DOC-000-DOC-024 + ARA-v1) |
| **Compliance status** | ACCEPTÉ AVEC RÉSERVES — tensions listées en §3 |

---

## 1. COHÉRENCE AVEC LE CANON

Chaque document ORG-xxx est vérifié contre les documents canoniques.

### 1.1 Vérification ORG-001 (Organization Lifecycle Model)

| Check | Source | Résultat | Détail |
|-------|--------|----------|--------|
| States match DOC-012 | DOC-012 §2.1 OrganizationStatus enum | CONFORME | active/suspended/archived correspondent exactement |
| Commands match DOC-014 | DOC-014 CreateOrganization, SuspendOrganization, ArchiveOrganization | CONFORME | 3 commandes couvertes |
| Events match DOC-014 | DOC-014 OrganizationCreated, OrganizationSuspended, OrganizationArchived | CONFORME | 3 events couverts |
| Persistence strategy | DOC-017 §2.1 + DOC-019 | CONFORME | Referenced + Embedded Collection + Embedded VO |
| NeverBreak rules | DOC-023 §8, NB-MT-001 à 004 | CONFORME | _org_id injection respectée |
| BR-ORG-001 à 006 | DOC-012 §1 | CONFORME | 6 business rules toutes tracées |
| INV-ORG-001 à 004 | DOC-015 | **RÉSERVE** | Section ORGANIZATION INVARIANTS N'EXISTE PAS dans DOC-015. Les INV-ORG-xxx sont des formalisations non-validées. |
| LifecycleAggregate interaction | DOC-012 §2.11 + DOC-015 LIF-* | CONFORME | Archived → TRASHED → PURGED suit LifecycleAggregate states |

### 1.2 Vérification ORG-002 (Membership, Invitation & Access Model)

| Check | Source | Résultat | Détail |
|-------|--------|----------|--------|
| User ≠ Member distinction | DOC-012 IdentityAggregate vs ResourceAggregate | CONFORME | Distinction correcte entre User (IdentityAggregate) et Member (ResourceAggregate.MemberRecord) |
| Membership via GroupMembership | DOC-012 RelationshipAggregate + DOC-023 §3.3 | CONFORME | Junction object correctement identifié |
| Multi-org bascule JWT | DOC-012 IdentityAggregate §2.2 | **RÉSERVE** | Tension majeure : DOC-012 definit une relation N:1 stricte (un user → UNE org). Le multi-org nécessite un amendement. |
| Invitation concept | DOC-012, DOC-014 | **INVENTION** | Aucun concept d'invitation n'existe dans le canon. Tables, commands, events nouveaux proposés. |
| INV-ORG-001 à 005 | DOC-015 | **RÉSERVE** | Invariants non-valides dans DOC-015 |
| Email unique par org | DOC-015 EMAIL-001 | CONFORME | Tracé vers invariant existant |
| STATUS-010 states | DOC-015 | CONFORME | active/inactive/deceased/transferred correspondent |
| BR-MEM-001 à 007 | DOC-015 MULTI-020, HISTORY-022, TRANS-012, DISABLE-011 | CONFORME | Toutes traces existantes |
| Invite invitation schema | PG-Schema-v1, DOC-021 | **INVENTION** | Table `invitations` n'existe pas dans PG-Schema-v1 |

### 1.3 Vérification ORG-003 (Hierarchy, Division & Scope Model)

| Check | Source | Résultat | Détail |
|-------|--------|----------|--------|
| DAG structure | DOC-012 RelationshipAggregate + DOC-015 REL-001 | CONFORME | Kahn's algo, cycle detection, auto-reference OrgUnitParentLink |
| Depth max 5 | DOC-015 INV REL-002 (DEPTH-002) | CONFORME | depth_level ≤ 5 vérifié au domaine AVANT persistance |
| Scope triade (Role/Scope/Membership) | DOC-012 tri-aggregate interop | CONFORME | Dimensions orthogonales correspondent aux 3 aggregates distincts |
| Permission inheritance | DOC-012 InheritancePolicy | CONFORME | "child inherits parent, jamais soustrait" |
| Delegation algorithm | DOC-012 AssignPermissionGrant | CONFORME | Temporaire, audité, non-transitif |
| Soft-delete cascade | DOC-012 LifecycleAggregate + DOC-023 §7 | CONFORME | archived → trashed → purged pattern |
| NB-SCOPE-001 à 005 | DOC-023 §9 NeverBreak rules | CONFORME | Dérivées de NB-PERSIST-006 et NB-MT rules |
| Custom scope level | DOC-012 OrganizationSettings (JSONB) | **RÉSERVE** | "custom" scope n'est pas explicitement défini dans DOC-012 OrganizationType ou config. Derive de settings extensibles mais manque de précision. |

### 1.4 Vérification ORG-004 (RBAC, Role Assignment & Permission Evaluation Model)

| Check | Source | Résultat | Détail |
|-------|--------|----------|--------|
| 3 couches orthogonales | DOC-012 IdentityAggregate + RelationshipAggregate | CONFORME | Membership→RoleAssignment→PermissionEvaluation |
| UserRole enum | DOC-012 IdentityAggregate VO | CONFORME | superadmin/admin/treasurer/pastor/staff |
| Role hierarchy | DOC-012 BR-ID-004/005 | CONFORME | Superadmin > Admin > Treasurer > Pastor > Staff |
| Wildcard audit | DOC-012 BR-ID-006 | CONFORME | ["*"] auditées mais autorisées |
| Permission format | DOC-012 PermissionGrant VO | CONFORME | resource:action:level |
| PermissionResolver | DOC-012 IdentityAggregate Domain Service | CONFORME | ResolvePermissions(roleId) boundary method |
| Audit of permission checks | DOC-015 AUD-001, AUD-002, ACCESS-033 | CONFORME | Every evaluation logged |
| Custom roles constraints | DOC-012 ConfigurationAggregate + DOC-001 | CONFORME | Subset only, org-bound, no new capabilities |
| RBAC-001 à 006 NeverBreak | DOC-023 NeverBreak | CONFORME | Dérivées des règles relationnelles existantes |

### 1.5 Vérification ORG-005 (Notification, Audit & Event Flow Model)

| Check | Source | Résultat | Détail |
|-------|--------|----------|--------|
| Event inventory exhaustif | DOC-014 Event Registry (67 events) | CONFORME | Tous les 67 events de DOC-014 catalogués avec notification + audit mapping |
| Notification algorithm | DOC-012 NotificationAggregate + DOC-015 NOT-* | CONFORME | Algorithm de routing trace vers NOT-001, RATE-002, CHANNEL-003, QUIET-004 |
| No spontaneous notifications | DOC-015 NOT-001 | CONFORME | trigger_source always required (NB-NEF-002) |
| Critical bypasses quiet hours | DOC-015 QUIET-004 + BR-NOT-005 | CONFORME | Only critical severity bypasses |
| In-app always delivered offline | DOC-015 BR-NOT-003 + SYNC-004 | CONFORME | WatermelonDB local queue, no network dependency |
| Push/email optional graceful fail | DOC-015 BR-NOT-004 | CONFORME | Fail gracefully |
| Audit old+new values | DOC-015 OLDNEW-002 + BR-AUD-002 | CONFORME | FullSnapshotPolicy applied to every entry |
| Audit append-only | DOC-015 AUD-001 + NB-PERSIST-006 | CONFORME | Zero mutation paths |
| Audit access restricted | DOC-015 ACCESS-033 | CONFORME | Admin/auditor only |
| Cross-aggregate flow matrix | DOC-014 + DOC-012 relations | CONFORME | Workflow→Notification, Notification→Audit, OfflineSync→Notification all traced |
| Mapping matrix 25 events with notification | DOC-014 event list × DOC-012 NotificationAggregate | CONFORME | 25 des 67 events génèrent une notification (37.5%) |
| Audit covers ALL state changes | DOC-014 commands producing events | CONFORME | 63 des 67 events audités (BR-AUD-001 immediate logging) |
| Port-010 AuditPort | PAS-001 §Port-010 | CONFORME | Contract matches §4.2 audit entry schema |
| Port-011 NotificationPort | PAS-001 §Port-011 | CONFORME | send(), queueForOffline(), markAsRead() all covered |
| Port-002/003 EventPublication/Subscription | PAS-001 §Port-002/003 | CONFORME | Fire-and-forget publish, subscription handlers |
| Operations interdictions respectées | DOC-013 Boundaries | CONFORME | NotificationAggregate Interdit: spontaneous, override preferences, etc. |
| No self-audit | DOC-023 §6.3 + NB-PERSIST-007 | CONFORME | AuditAggregate does not audit itself (NB-NEF-008) |
| Sync notification offline-first | DOC-017 §2.13 + DOC-015 SYNC-004 | CONFORME | NotificationQueued → PendingOperation → push on reconnect |

---

## 2. CONTRAINTES DE VALIDATION

### NC-001 : Aucune invention non tracée

| Document | Inventions détectées | Source Canonique Absente |
|----------|---------------------|-------------------------|
| ORG-001 | Aucune | Toutes traces vers DOC-012, DOC-014, DOC-015 |
| ORG-002 | **Invitation concept** — table invitations, CreateInvitation, AcceptInvitation, InviteCreated/Accepted/Rejected/Expired events | NON EXISTS in DOC-012, DOC-014, DOC-021, PG-Schema-v1 |
| ORG-003 | Aucune (le scope "custom" est dérivé de JSONB settings mais non-expliqué explicitement) | Marginally imprecise |
| ORG-004 | Aucune | Tout tracé vers DOC-012 IdentityAggregate, DOC-015 |
| ORG-005 | **OrganisationActivated** comme event — liste en §2.1 | Ce n'est pas un domaine event DOC-014. Documenté comme tel (§5 note), mais la confusion reste possible. |

**Résultat NC-001 :** PARTIELLEMENT RESPECTÉ. ORG-002 introduit le concept d'Invitation qui est une invention canonique nécessaire (gap identification) mais non-couverte par le canon actuel.

### NC-002 : Confusion identité/membership/role/permission évitée

| Document | Vérification |
|----------|-------------|
| ORG-001 | Ne touche pas ce sujet directement — OK |
| ORG-002 | **EXCELLENT.** §1 Distinctions Fondamentales sépare clairement User/Account/Member/Invite/Membership. §1.2 explique que Role appartient au User (IdentityAggregate) et MembershipRole appartient à la Membership (RelationshipAggregate). |
| ORG-003 | Triade Role/Scope/Membership bien distinguée §2.2 |
| ORG-004 | **EXCELLENT.** Triade Membership/RoleAssignment/PermissionEvaluation explicitement définie §2.1 avec table comparative. 3 couches jamais confondues. |
| ORG-005 | Map UserRoleChanged vers l'audit correctement. Pas de confusion. |

**Résultat NC-002 :** RESPECTÉ. Les 5 documents maintiennent des frontières conceptuelles claires.

### NC-003 : Pas de fuite de persistance dans specs

| Document | Vérification |
|----------|-------------|
| ORG-001 | Utilise termes persistants (org_id, statut) mais les présente comme états du domaine, pas colonnes DB. OK |
| ORG-002 | §2.3 table invitations — présente des champs DB (`id uuid`, `org_id uuid FK`, `accept_token_hash varchar(60)`). **Ceci est acceptable** car ORG-002 introduit une nouvelle entité qui doit être stockée. Mais le niveau de détail DB sort du périmètre "spécification canonique uniquement". |
| ORG-003 | Aucune référence table/column. OK |
| ORG-004 | Aucuno reference table/column. Utilisation de structures conceptuelles. OK |
| ORG-005 | Schéma d'AuditEntry §4.2 présente des types de données (`uuid`, `jsonb`, `timestamptz`). **Ceci est acceptable** car c'est un schéma conceptuel d'audit entry, pas du DDL. |

**Résultat NC-003 :** RESPECTÉ. Les quelques références de type de données sont dans des contextes conceptuels (schéma d'entrée, pas DDL).

### NC-004 : Respect des Aggregate boundaries (pas de contournement)

| Document | Boundary respectée | Vérification |
|----------|-------------------|-------------|
| ORG-001 | OrganizationAggregate | CreateOrganization/SuspendOrganization/ArchiveOrganization sont des commands OrganizationAggregate. OK |
| ORG-002 | Multi-aggregate coordination | AddMemberToGroup → RelationshipAggregate, CreateUser → IdentityAggregate, Invitation → OrganizationAggregate. Coordination via Application Service. OK |
| ORG-003 | OrganizationAggregate + RelationshipAggregate | Reparenting utilise SetOrgUnitParent (RelationshipAggregate), CreateOrgUnit (OrganizationAggregate). Boundary respected. OK |
| ORG-004 | IdentityAggregate (RBAC) + RelationshipAggregate (membership) | PermissionCheck flow suit exactement DOC-013 boundary methods: LookupMembership(Relationship), LookupRoleAssignment(Identity), PermissionResolver(Identity). OK |
| ORG-005 | Tous les aggregates | Notifications passent par NotificationAggregate boundary. Audit passe par AuditAggregate.LogAction. Events restent dans leur aggregate source. Cross-aggregate via EventPublicationPort/EventSubscriptionPort. OK |

**Résultat NC-004 :** RESPECTÉ. Aucun contournement de boundary identifié.

### NC-005 : Aucun nouveau Concept/Capability implicite

| Document | Nouveau concept détecté | Status canonique |
|----------|----------------------|-----------------|
| ORG-001 | Inv-ORG-xxx invariants | Non-existants dans DOC-015 — dérivés des BR-ORG-xx |
| ORG-002 | **Invitation (concept)** | N'existe PAS dans DOC-001 Element Registry, ni dans DOC-012. C'est un gap identification documenté. |
| ORG-003 | Custom scope | Implicit dans OrganizationSettings JSONB mais non-explicité |
| ORG-004 | Custom role | Dérivé de ConfigurationAggregate settings — concept implicite présent |
| ORG-005 | OrganisationActivated event | Documenté comme concept d'infrastructure, pas domaine event. OK. |

**Résultat NC-005 :** RESPECTÉ AVEC RÉSERVE. Invitation est le seul vrai nouveau concept. Il est identifié comme tel (T-101 dans ORG-002).

### NC-006 : Cohérence avec NeverBreak Rules

| Règle NeverBreak | Impact sur ORG-xxx | Statut |
|-----------------|-------------------|--------|
| NB-PERSIST-006 (Audit immutable exclusive) | ORG-005 §4 applique strictement. AuditEntry = append-only. Aucune mutation. | RESPECTÉ |
| NB-PERSIST-007 (No self-audit) | ORG-005 §4.4 confirme : AuditAggregate ne s'audite pas lui-même. | RESPECTÉ |
| NB-MT-001/002/003/004 (Multi-tenant isolation) | ORG-001 §7.3, ORG-002 §4.3, ORG-003 §3.1, ORG-005 §8.1 — tous respectent _org_id | RESPECTÉ |
| NB-RR-001 (Boundary integrity) | Aucun ORG-xxx ne contourne les boundaries. OK | RESPECTÉ |
| NB-RR-003 (No cross-tenant join) | ORG-002 §4.3 BR-MULTI-001 | RESPECTÉ |
| NB-RR-005 (Domain navigation direction) | ORG-003 §3.3 child→parent references corrects | RESPECTÉ |
| NOT-001 (Trigger always present) | ORG-005 §3.3 — toute notification a trigger_source | RESPECTÉ |
| BR-NOT-003 (In-app always delivered) | ORG-005 §3.3 — in_app uses local WatermelonDB queue | RESPECTÉ |
| BR-NOT-005 (Critical bypasses quiet hours) | ORG-005 §3.2 — clear table showing critical bypass | RESPECTÉ |

**Résultat NC-006 :** RESPECTÉ. Aucun NeverBreak rule violé.

### NC-007 : Cohérence entre les 5 documents ORG-xxx

| Paire | Conflit détecté | Résolution |
|-------|----------------|-----------|
| ORG-001 ↔ ORG-002 | ORG-001 §4 dit org_id is global UNIQUE name. ORG-002 §4.3 dit email unique PAR ORG. Ces deux uniques sont sur des entités différentes (org name vs user email). Pas de conflit réel. | Concordance |
| ORG-002 ↔ ORG-004 | ORG-002 §7.1 propose `CreateInvitation` accessible à admin/treasurer/pastor. ORG-004 §3.2 dit treasurer/pastor n'ont PAS de permissions de role assignment. L'invitation n'est PAS un role assignment — c'est une prédemande. Pas de conflit, mais clarification nécessaire. | Concordance avec note |
| ORG-003 ↔ ORG-004 | ORG-003 §4.1 dit inheritance goes parent→descendants. ORG-004 §4.4 dit inheritance follows DAG bottom-up. **Ces directions sont complémentaires, pas contradictoires** : inheritance se résout en remontant le DAG (de la cible vers la racine) pour collecter les permissions, puis les descendant scopes les héritent. | Concordance |
| ORG-004 ↔ ORG-005 | ORG-004 §5.3 documente l'audit de chaque permission check. ORG-005 §4.3 liste "PermissionCheck(granted/denied)" comme événement exclusivement audités. **Correspondance parfaite.** | Concordance |
| ORG-001 ↔ ORG-005 | ORG-001 §5 liste `OrganizationActivated` comme event. ORG-005 §2.1 note que ce n'est pas un domaine event DOC-014 mais un workflow trigger. ORG-005 est plus précis. **Compatibilité maintenue avec clarification ORG-005.** | Concordance avec précision ORG-005 |
| ORG-002 ↔ ORG-005 | ORG-002 §2.5 décrit le flux d'invitation (invite created → sent → accepted/rejected/expired/cancelled). ORG-005 §2.2 mappe ces états vers des events et notifications. **Correspondance exacte.** | Concordance |
| ORG-003 ↔ ORG-005 | ORG-003 §3.4 définit ArchiveOrgUnit avec cascade soft-delete. ORG-005 §2.1 mapme OrgUnit archivé à l'event OrganizationArchived → notification in_app+email severity high. **Consistent.** | Concordance |

**Résultat NC-007 :** RESPECTÉ. Aucune contradiction interne entre les 5 documents. Les différences identifiées sont des clarifications complémentaires, pas des conflits.

---

## 3. TENSIONS IDENTIFIÉES

### T-001 : Tension SuspendOrganization Actor

- **Documents** : DOC-014 definit SuspendOrganization comme SuperAdmin-only. ORG-001 §3.2 permet SuperAdmin OU Admin de suspendre l'org.
- **Impact** : Si l'Admin peut suspendre son org, cela contourne potentiellement la sécurité voulue (BR-ORG-006).
- **Recommandation** : Garder SuperAdmin-only pour SuspendOrganization (conformément à DOC-014). Modifier ORG-001 §3.2 pour retirer la capacité Admin.

### T-002 : Tension INV-ORG-xxx non-existants dans DOC-015

- **Documents** : ORG-001 cite INV-ORG-001 à INV-ORG-004. ORG-002 §6 propose INV-ORG-001 à INV-005. Aucun de ces invariants n'existe dans DOC-015.
- **Impact** : Les invariants ORG-xxx ne sont pas constitutionnels tant qu'ils ne figurent pas dans DOC-015. Ils sont des formalisations provisoires.
- **Recommandation** : Proposer l'ajout de ces invariants à DOC-015 via amendement ADR. Sans cela, ils restent des recommandations non-enforceables.

### T-003 : Gap Invitation — concept entièrement nouveau

- **Documents** : ORG-002 introduit un concept d'Invitation avec table, commands, et events non-existent dans DOC-012, DOC-014, PG-Schema-v1.
- **Impact** : BLOQuant pour l'implémentation. Aucune migration, aucun DDL, aucune commande API n'existe pour ce concept.
- **Recommandation** : Créer une série d'ADR pour formaliser l'invitation comme feature canonique :
  1. Ajouter InvitationEntity à DOC-012 OrganizationAggregate
  2. Ajouter CreateInvitation, AcceptInvitation, RejectInvitation, RevokeInvitation à DOC-014
  3. Ajouter InvitationCreated, InvitationAccepted, etc. à DOC-014 Events
  4. Ajouter table invitations à DOC-021 / PG-Schema-v1
  5. Ajouter permissions invitation:* à DOC-001 Element Registry
- **Priorité** : P0 — bloquant pour toute feature d'invitation.

### T-004 : Tension Multi-Org vs DOC-012 N:1

- **Documents** : DOC-012 §2.2 definit IdentityAggregate avec relation N:1 stricte vers OrganizationAggregate ("un user appartient à UNE org"). ORG-002 §4 et ORG-004 §3.1/§3.2 décrivent un utilisateur pouvant avoir des rôles différents dans différentes orgs (multi-org avec bascule JWT).
- **Impact** : TENSION ARCHITECTURALE MAJEURE. Le modèle N:1 ne supporte pas nativement le multi-org sans modification.
- **Recommandation** : Deux options :
  (a) Changer la relation IdentityAggregate→OrganizationAggregate en N:M via une table UserOrgBinding
  (b) Permettre plusieurs entrées User par org_id (unique composite sur org_id+email, pas unique global)
- **Priorité** : P0 — bloquant pour le multi-org.

### T-005 : Tension OrganizationActivated event

- **Documents** : ORG-001 §5 liste `OrganizationActivated` comme event. ORG-005 §2.1 note explicitement que ce n'est PAS un domaine event DOC-014 mais un concept d'infrastructure. DOC-014 ne liste pas cet event.
- **Impact** : Mineur. ORG-005 clarifie que c'est un workflow trigger, pas un domain event. La cohérence est maintenue.
- **Recommandation** : Retirer `OrganizationActivated` de la liste des DomainEvents dans ORG-001 §5 et le déplacer vers une section "Infrastructure triggers" explicite.

### T-006 : Tension Custom Scope dans ORG-003

- **Documents** : ORG-003 §2.1 definit 3 niveaux de scope : org, group, custom. DOC-012 ResourceAggregate.ResourceState mentionne `scope_type` enum dans les Value Objects. Si `scope_type` est un enum {org, group}, alors "custom" n'existe pas dans le canon.
- **Impact** : Si `scope_type` est effectivement énuméré à {org, group} dans DOC-012, ajouter "custom" est une invention.
- **Recommandation** : Vérifier si DOC-012 definit `scope_type` comme enum fermé. Si oui, soit supprimer "custom", soit amender DOC-012 pour inclure "custom" comme valeur d'enum.

---

## 4. RÉSUMÉ EXÉCUTIF

### Documents générés dans cette série

| Doc | Titre | Statut |
|-----|-------|--------|
| ORG-001 | Organization Lifecycle Model | ACCEPTÉ AVEC RÉSERVES (T-001, T-002) |
| ORG-002 | Membership, Invitation & Access Model | **REJETÉ AVEC GAP** (T-003, T-004 — concepts nouveaux non-canoniques) |
| ORG-003 | Hierarchy, Division & Scope Model | ACCEPTÉ AVEC RÉSERVE (T-006 — scope custom non-canonique) |
| ORG-004 | RBAC, Role Assignment & Permission Evaluation Model | ACCEPTÉ |
| ORG-005 | Notification, Audit & Event Flow Model | ACCEPTÉ |

### Contraintes de validation

| Check | Description | Statut |
|-------|------------|--------|
| NC-001 | Aucune invention non tracée | **PARTIELLEMENT RESPECTÉ** — Invitation (ORG-002) est une invention nécessaire mais non-tracée |
| NC-002 | Confusion identité/membership/role/permission évitée | **RESPECTÉ** |
| NC-003 | Pas de fuite de persistance dans specs | **RESPECTÉ** |
| NC-004 | Respect des Aggregate boundaries | **RESPECTÉ** |
| NC-005 | Aucun nouveau Concept/Capability implicite | **RESPECTÉ AVEC RÉSERVE** — Invitation explicitément identifiée |
| NC-006 | Cohérence avec NeverBreak Rules | **RESPECTÉ** |
| NC-007 | Cohérence entre les 5 documents ORG-xxx | **RESPECTÉ** |

### Synthèse des tensions

| # | Tension | Severity | Résolution requise avant |
|---|---------|----------|-------------------------|
| T-001 | SuspendOrganization actor mismatch | MINEUR | Merge ORG-001 avec DOC-014 |
| T-002 | INV-ORG-xxx non-validés dans DOC-015 | MAJEUR | Amendement DOC-015 |
| T-003 | Invitation concept entirely new | **CRITIQUE** | ADR + canon amendment (DOC-012, DOC-014, DOC-021) |
| T-004 | Multi-org vs N:1 identity relation | **CRITIQUE** | ADR + architecture change |
| T-005 | OrganizationActivated event classification | MINEUR | Move to infrastructure section |
| T-006 | Custom scope level not in canon enum | MAJEUR | Verify/modify scope_type enum |

### Total

- **Total documents générés :** 5 (ORG-001 à ORG-005)
- **Total documents validés :** ORG-006 (ce document)
- **Contradictions trouvées :** 0 (aucune contradiction directe entre documents — seulement tensions de gap)
- **Tensions mineures :** 2 (T-001, T-005)
- **Tensions majeures :** 2 (T-002, T-006)
- **Tensions critiques :** 2 (T-003, T-004)

### Recommendation finale : ACCEPTÉ AVEC RÉSERVES

**Les 5 documents ORG-xxx sont globalement cohérents avec le canon DOC-012/013/014/015/023.**

Cependant, leur statut d'intégration complète est conditionné à la résolution de :
1. **T-003 (Invitation)** — Doit être formalisée comme canon par amendement des docs sources
2. **T-004 (Multi-org N:1)** — Doit être résolue par ADR architectural

Sans résolution de ces deux tensions critiques, ORG-002 ne peut pas être intégré au canon. ORG-001, ORG-003, ORG-004, et ORG-005 peuvent être intégrés sous réserve des corrections mineures (T-001, T-002, T-005, T-006).

---

## ANNEXE : Matrice de Traceabilité Complète

| Assertion ORG-xxx | Source Canonique | Preuve de Trace |
|------------------|-----------------|----------------|
| Organization states (ORG-001) | DOC-012 §1 OrganizationStatus enum | exact match active/suspended/archived |
| OrgUnit DAG (ORG-003) | DOC-012 §2.4 RelationshipAggregate + DOC-015 REL-001/002 | Kahn's algo, depth ≤5 |
| Membership lifecycle (ORG-002) | DOC-012 ResourceAggregate MemberRecord + RelationshipAggregate GroupMembership | BR-REL-003, MULTI-020 |
| RBAC roles (ORG-004) | DOC-012 IdentityAggregate UserRole enum + BR-ID-004/005/006 | exact 5 canonical roles |
| Permission evaluation (ORG-004) | DOC-012 PermissionResolver Domain Service | 8-step algorithm traceable |
| Notification routing (ORG-005) | DOC-012 NotificationAggregate + DOC-015 NOT-*/BR-NOT-* | §3.1 algorithm |
| Audit immutability (ORG-005) | DOC-012 AuditAggregate + DOC-015 AUD-*/NB-PERSIST-006/007 | §4.1 rules |
| Event-to-notification mapping (ORG-005) | DOC-014 Event Registry × DOC-012 NotificationAggregate | §3.3 mapping matrix (67 events) |
| Event-to-audit mapping (ORG-005) | DOC-014 Event Registry × DOC-012 AuditAggregate | §4.3 mapping table (67 events) |
| Offline-sync notifications (ORG-005) | DOC-017 §2.13 + DOC-015 SYNC-004 | NotificationQueued → PendingOperation |
| No spontaneous notifications (ORG-005) | DOC-015 NOT-001 | trigger_source always required |
| Critical severity bypass (ORG-005) | DOC-015 QUIET-004 + BR-NOT-005 | Critical bypasses quiet hours |
| In-app always delivered (ORG-005) | DOC-015 BR-NOT-003 | WatermelonDB local queue |
| Push/email optional (ORG-005) | DOC-015 BR-NOT-004 | Fail gracefully |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Rapport de validation croisée 5 documents ORG-xxx | Tensions documentées, recommandation: ACCEPTÉ AVEC RÉSERVES |
