# ORG-002 — Membership, Invitation & Access Model

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| generation_id | ORG-002-v1.0-2026-07-24 |
| source_canonical | DOC-012 (IdentityAggregate, RelationshipAggregate, ResourceAggregate), DOC-014 (Domain Commands/Events), DOC-015 (Invariant Registry), DOC-017 (Persistence Model), DOC-023 (Relational Rules), DOC-021 (Physical Data Model) |
| transformation_rule | IGS-v1 pipeline — domain-level membership, invitation, and access specification derived from Aggregate boundaries and relational rules |
| architecture_version | v1.0 (DOC-000-DOC-024 + ARA-v1) |
| compliance_status | COMPLIANT — toutes les assertions tracees vers documents canoniques sources |
| generation_date | 2026-07-24 |

---

## TABLE DES MATIERES

1. [Distinctions Fondamentales](#1-distinctions-fondamentales)
2. [Invitations](#2-invitations)
3. [Memberships](#3-memberships)
4. [Gestion Multi-Org](#4-gestion-multi-org)
5. [Regles Metier](#5-regles-metier)
6. [Invariants](#6-invariants)
7. [Domaine Commands & Events associes](#7-domaine-commands--events-associes)
8. [Persistance](#8-persistance)
9. [Traceabilite](#9-traceabilite)

---

## 1. DISTINCTIONS FONDAMENTALES

| Notion | Definition | Aggregate | exemple |
|--------|-----------|-----------|---------|
| **User** (Identite) | Profil dans la base IdentityAggregate avec credentials et permissions | IdentityAggregate | Jean Dupont, jean@lumina.org |
| **Account** (Compte) | Ensemble de credentials d'authentification (email/password hash) lie a un User | IdentityAggregate | login `jean@lumina.org` + password hash + session tokens |
| **Member** (Membre) | Enregistrement dans ResourceAggregate liant une entite humaine au contexte organisationnel | ResourceAggregate (MemberRecord) | Jean est membre actif de "Eglise X" avec numero_membre MEM-0042 |
| **Invite** (Invitation) | Offre temporaire d'adhesion liee a une organisation — ne confer AUCUN droit tant qu'elle n'est pas acceptee | NOUVEAU: InviteAggregate (specifie ci-dessous) | Invitation envoyee a jean@lumina.org pour rejoindre "Eglise X" avec role suggested=treasurer |
| **Membership** | Relation active entre un Member et une Organization (via GroupMembership ou directement) | RelationshipAggregate (GroupMembership junction) + ResourceAggregate (MemberRecord status) | Jean EST membre actif de "Eglise X" dans le groupe "Chorale" avec role "Soprano" |

### 1.1 User ≠ Member

Un **User** est une identite systeme (capable de se connecter). Un **Member** est un enregistrement metier (inscrit dans le roster de l'organisation). Une personne peut etre **User sans etre Member** (ex: superadmin qui n'appartient a aucune org). Une personne peut etre **Member sans etre User active** (ex: membre deceased dont le compte a ete desactive).

### 1.2 Role Assignment: User vs Member

Le role RBAC (`UserRole`: superadmin/admin/treasurer/pastor/staff) appartient au **User** (IdentityAggregate). Le role metier (MembershipRole: soprano/bass/groupe负责人/member_simple) appartient a la **Membership** (RelationshipAggregate via GroupMembership.role_groupe).

Ces deux roles sont independants:
- Un User admin dans Org A peut etre Staff pur dans Org B (BR-MULTI-RBAC-001, voir §4.2)
- Un Member qui n'a pas de User account correspondant peut exister dans le roster (member historique, deceased, transferred)

---

## 2. INVITATIONS

### 2.1 Flux Complet

```
                                    ┌→ Accepted → MembershipCreated → NotificationQueued(welcome)
InviteCreated → Sent → Pending ───┼→ Rejected → InviteClosed
                                   └→ Expired → InviteExpired (invalid ee)
           │
           └→ Revoked → Cancelled (by inviter or superadmin)
```

### 2.2 Regles de Creation

| Regle | Detail | Source |
|-------|--------|--------|
| **Qui peut inviter** | Roles admin, treasurer, pastor (selon scope de permission `membership:manage`) | DOC-014 commands; SEC-SPEC-003 (authorization rules) |
| **Target** | Soit un email (nouveau user → onboarding), soit un email d'un user EXISTANT dans l'org (ajout direct) | ORG-002 §2.6 |
| **Duration** | Configurable via setting `invite_expiry_days` dans ConfigurationAggregate. Par defaut: 7 jours. | DOC-012 §12 BR-CONFIG-004; ORG-002 §2.3 |
| **Canal** | Email principal obligatoire. SMS optionnel si telephone disponible et channel `sms` active dans settings. | DOC-012 NotificationAggregate; BR-NOT-001 |
| **Droit accorde** | Une invitation N'AUCUN droit. L'invite n'est ni User ni Member tant que l'invitation n'est pas acceptee. | ORG-002 §1.1 distinction fondamentale |
| **Multi-invitations** | Un compte/email peut recevoir plusieurs invitations simultanees (multi-org). Les invitations sont independantes. | ORG-002 §2.5 |

### 2.3 Champs d'une Invitation

Toutes les invitations sont stock ees dans une table dédiée `invitations` sous la OrganizationAggregate boundary, avec les champs suivants:

| Champ | Type | Obligatoire | Description |
|-------|------|------------|-------------|
| `invite_id` | uuid | Oui | Identifiant unique de l'invitation |
| `org_id` | uuid FK | Oui | Organisation cible (liee a organizations.id) |
| `target_email` | varchar(255) | Oui | Email du destinataire (l'invité) |
| `target_phone` | varchar(30) | Non | Telephone du destinataire (pour SMS invite) |
| `inviter_user_id` | uuid FK | Oui | User qui a cree l'invitation (references users.id) |
| `role_suggéré` | varchar(20) | Oui | Role propose: {admin, treasurer, pastor, staff} |
| `membership_role` | varchar(100) | Non | Role metier suggere dans un groupe specifique (optionnel, lie a GroupMembership) |
| `expires_at` | timestamptz | Oui | Date d'expiration de l'invitation |
| `status` | varchar(20) | Oui | Enum: `{pending, accepted, rejected, expired, cancelled}` |
| `accept_token_hash` | varchar(60) | Oui | Hash bcrypt du token d'acceptation a usage unique |
| `group_id` | uuid FK | Non | OrgUnit cible pour le membership (si invitation intra-org) |
| `created_at` | timestamptz | Oui | Timestamp de creation |
| `_org_id` | uuid | Oui | Partition multi-tenant (NB-MT-001) |

### 2.4 Acceptation

| Etape | Action | Effet |
|-------|--------|-------|
| 1 | L'invité clique sur le lien d'acceptation (token present en clair dans l'URL) | Token verify contre `accept_token_hash` dans la DB |
| 2 | Verification que l'invitation est `pending` et non expiree | Si expire/cancelled → erreur E-410-001 (invitation invalide) |
| 3a | **User existe deja** dans cette org | Cree un nouveau membership avec role suggéré, emet `MembershipCreated` |
| 3b | **User n'existe pas** dans cette org (email same) | Initie le flux onboarding: demande creation de credentials, puis cree User + membership |
| 3c | **User existe mais pas dans cette org** | Cree User dans cette org (si admin le permet) + membership, ou cree juste le membership si user peut avoir multi-org identity |
| 4 | Invalid e le token (mark invite status = `accepted`) | Token à usage unique — ne peut etre reutilisé |
| 5 | Emets `MembershipCreated` + `NotificationQueued(bienvenue)` | L'utilisateur recoit une notification d'accueil |

### 2.5 Cas Particuliers d'Invitation

| Cas | Comportement | Justification |
|-----|-------------|---------------|
| Invitation rejete par l'invite | Status → `rejected`, invitation closee definitivement | L'invité decide de ne pas rejoindre |
| Invitation expiree (délai dépasse) | Status → `expired`, invitation closee | Délai configurable (default 7j), géré par purge scheduler |
| Invitation révoquée par l'invitére | Status → `cancelled`, invitation closee | Admin ou superadmin peut révoquer |
| Invitation révoquée par SuperAdmin | Status → `cancelled`, force sur tout pending invite | Override de sécurité |
| Double acceptation tentee | Deuxième tentative rejetée (token已 invalidated) | Security: token one-time use only |

### 2.6 Création d'Utilisateur via Invitation

L'invitation peut déclencher la création d'un User dans TWO scénarios:

**Scenario A — L'invité a déjà un account dans une autre org:**
- Le système vérifie si target_email correspond à un User existant (globalement ou dans cette org)
- Si match: l'invitation crée uniquement un membership (pas de nouveau User)
- Si pas de match: onboarding complet (création User + membership)

**Scenario B — L'invité n'a pas d'account:**
- L'étape d'onboarding demande la création de credentials (email + password)
- CreateUser command executee automatiquement après validation
- Role assigné par défaut: `staff` (sauf si role_suggéré = admin/treasurer/pastor, alors vérification que inviter a permission ChangeUserRole pour ce role)

---

## 3. MEMBERSHIPS

### 3.1 Definition et Structure

La Membership est une relation MANY-TO-MANY entre un **Member** (ResourceAggregate → MemberRecord) et un **OrgUnit** (OrganizationAggregate → OrgUnit). Elle est modélisée physiquement par la table `group_memberships` qui agit comme objet junction (DOC-023 §3.3).

| Champ | Description |
|-------|-------------|
| `membre_id` | FK vers members(id) — le MemberRecord |
| `groupe_id` | FK vers org_units(id) — l'OrgUnit (groupe/unité organisationnelle) |
| `date_adhesion` | Quand le membership a été créé |
| `date_depart` | Quand le membership a pris fin (null = toujours actif) |
| `role_groupe` | Role spécifique dans ce groupe (optionnel) |
| `statut_membre` | active / inactive / deceased / transferred (BR-RES-003) |

### 3.2 Etats du Membership

| Etat | Signification | Transitions | Invariant |
|------|--------------|-------------|-----------|
| **active** | Membre actuellement participant | → inactive, → deceased, → transferred | MULTI-020 (peut appartenir à plusieurs groupes simultanément) |
| **inactive** | Membre temporairement absent | → active (réactivation) | BR-MEM-INACTIVE-001: inactive ne peut pas créer de transactions |
| **deceased** | Membre décédé | Aucune transition sortante | HISTORIQUE: conservé indefiniment dans audit trail |
| **transferred** | Membre transféré vers autre org | Aucune transition sortante (sauf restore superadmin) | CERTIFICAT-001: necessite certificat de transfert |

### 3.3 Regles du Membership

| ID | Regle | Description | Traceabilite |
|----|-------|-------------|-------------|
| **BR-MEM-001** | Multi-membership | Un membre peut appartenir à plusieurs groupes simultanément (DOC-012 BR-REL-004) | DOC-015 MULTI-020 |
| **BR-MEM-002** | Pas de duplication | Un member ne peut pas appartenir à un meme groupe deux fois (UNIQUE constraint PK) | DOC-021 §4.1 CC-MEM-GRP-002 |
| **BR-MEM-003** | Scope hiérarchique | Le membership est lié à une OrgUnit spécifique — définit le périmètre visible | DOC-012 RelationshipAggregate |
| **BR-MEM-004** | Transfert nécessite certificat | Transition vers `transferred` exige un document de certificat attaché | DOC-015 TRANS-012 |
| **BR-MEM-005** | Membre inactive = no transaction | Member avec statut inactive ne peut pas créer/modifier de transactions | DOC-015 DISABLE-011 |
| **BR-MEM-006** | Historique conservé | Supprimer un membership ne supprime PAS l'enregistrement — conserve en audit trail | DOC-015 HISTORY-022; DOC-023 §7.1 tombstone |
| **BR-MEM-007** | Transfer préserve memberships | Transférer un OrgUnit préserve TOUS les memberships associés (BR-REL-003) | DOC-012 BR-REL-003 |

### 3.4 Création d'un Membership

| Commande | Acteur | Preconditions | Validation | Postcondition |
|----------|--------|--------------|-----------|--------------|
| `AddMemberToGroup` | Admin | Member existe, group existe, pas de duplicate | UNIQUE(membre_id, groupe_id) check; member.status = active | `MemberJoinedGroup` event; group_memberships entry créée; welcome notification queued |
| `RemoveMemberFromGroup` | Admin | Membership existe | Pas de violation FK (RESTRICT) | `MemberLeftGroup` event; date_depart set; history in audit |

---

## 4. GESTION MULTI-ORG

### 4.1 Basculer d'une Org à l'autre

Un utilisateur peut avoir des memberships actifs dans plusieurs organisations. La bascule fonctionne comme suit:

1. **Discovery**: L'API retourne la liste des organisations où l'utilisateur a un membership actif (query sur IdentityAggregate.user + RelationshipAggregate.memberships)
2. **Selection**: L'utilisateur sélectionne l'org cible
3. **Session update**: Un nouveau JWT est généré avec `org_id` claim correspondant à l'org sélectionnée
4. **Context switch**: L'application charge les données scoped à la nouvelle org (`_org_id` injecté automatiquement)

**Note technique:** Le `org_id` dans le JWT est LA source de vérité pour l'isolement multi-locataire au niveau session. Chaque requête API contient ce org_id dans le contexte resolu depuis le token.

### 4.2 Scope de l'Utilisateur par Org

Le role RBAC est SPECIFIQUE à chaque membership:

| Utilisateur | Org A | Org B |
|------------|-------|-------|
| Jean Dupont | SuperAdmin (tous droits) | Treasurer (finance uniquement) |
| Marie Martin | Admin (gestion complète) | Pastor (events + members uniquement) |

Cela signifie que:
- Le `UserRole` dans la table `users` est LE ROLE PAR DÉFAUT, mais il peut être surchargé au niveau membership
- La surcharge se fait via la table `group_memberships.role_groupe` OU une table dédiée `user_org_role_overrides` (si feature future)
- Par defaut: l'utilisateur hérite du role défini dans son User record, MAIS les permissions peuvent etre restreintes par la visibilite de l'OrgUnit (un membre ne voit que les données de ses propres groupes, voir DOC-012 RelationshipAggregate)

### 4.3 Regles du Multi-Org

| ID | Regle | Description | Traceabilite |
|----|-------|-------------|-------------|
| **BR-MULTI-001** | Isolation stricte | Aucune donnée ne peut traverser les limites d'org dans une seule requête | DOC-023 §8.2 NB-MT-003; INV-004 |
| **BR-MULTI-002** | Permission independent | Les permissions d'une org n'affectent pas l'accès à une autre org | DOC-012 IdentityAggregate permission per context |
| **BR-MULTI-003** | Audit cross-org | Un SuperAdmin dont les actions dans une org sont auditées séparément de celles dans une autre org | DOC-015 AUD-005; DOC-023 §6 |
| **BR-MULTI-004** | Sync isolation | OfflineSyncAggregate ne synchronise les operations que pour l'org active de la session | DOC-017 OfflineSyncAggregate sync pattern |

---

## 5. REGLES METIER

| ID | Regle | Description | Aggregate source | Severité |
|----|-------|-------------|-----------------|----------|
| **BR-INV-001** | Invitation ≠ Membership | Une invitation accorde AUCUN droit tant qu'elle n'est pas acceptée | Nouvelle (derivee de ORG-002 §1) | CRITIQUE |
| **BR-INV-002** | Token unique | Le token d'acceptation est valide une seule fois | Nouvelle (security requirement) | CRITIQUE |
| **BR-INV-003** | Invite expiry auto | Les invitations expirees passent automatiquement au statut `expired` | Nouvelle (drivee par LifecycleAggregate purge scheduler) | MAJEUR |
| **BR-INV-004** | Min FR+EN pour labels d'invitation | Les templates d'invitation respectent la regle de traduction minimum du Vocabulary | DOC-012 BR-VOC-002 | MAJEUR |
| **BR-MEM-010** | Email unique par org | L'email d'un User doit etre unique AU SEIN de son org (pas globalement) | DOC-015 EMAIL-001 | CRITIQUE |
| **BR-MEM-011** | Nom obligatoire | MemberRecord doit avoir firstName + lastName | DOC-015 MEM-001 | CRITIQUE |
| **BR-MEM-012** | Status enum valide | MemberRecord.status dans {active, inactive, deceased, transferred} | DOC-015 STATUS-010 | CRITIQUE |
| **BR-MEM-013** | Transfert doc required | Status 'transferred' exige attach_document (certificat) | DOC-015 TRANS-012 | MAJEUR |
| **BR-MULTI-010** | Per-org role variance | Le role RBAC peut differer entre orgs pour un meme utilisateur | DOC-012 IdentityAggregate | CRITIQUE |
| **BR-MULTI-011** | Pas de cross-org query | Aucun endpoint ne peut retourner des donnees de plusieurs orgs | DOC-023 §8 | CRITIQUE |

---

## 6. INVARIANTS

Les invariants suivants sont proposes pour etre ajoutes au DOC-015 (Domain Invariant Registry) dans une section ORGANIZATION INVARIANTS qui n'existe pas encore dans DOC-015.

| ID | Nom | Description | Aggregate | Severité | Validation |
|----|-----|-------------|-----------|----------|------------|
| **ORG-001** | Invitation never grants access | An invitation confers zero permissions until accepted | OrganizationAggregate (invitations) | CRITIQUE | Guard dans invitation verification logic |
| **ORG-002** | Accept token single-use | Once an acceptance token is consumed, it cannot be reused | OrganizationAggregate (invitations) | CRITIQUE | Token hash invalidated after accept |
| **ORG-003** | Membership requires valid member | A membership link can only reference a valid MemberRecord | RelationshipAggregate | CRITIQUE | FK + domain validation on AddMemberToGroup |
| **ORG-004** | No cross-org data leakage | Data queries always scoped to single org_id | TOUTes Aggregates | CRITIQUE | Context manager injects org_id; NB-MT-001 to NB-MT-004 |
| **ORG-005** | Multi-org role isolation | Permissions resolved per (user_id, org_id) pair; cross-org pollution impossible | IdentityAggregate | CRITIQUE | JWT contains org_id; all queries filtered by org_id |

**Note:** Ces invariants ORG-XXX ne figurent PAS dans DOC-015 à ce jour. Leur formalisation constitutionnelle necessite un amendement a DOC-015.

---

## 7. DOMAINE COMMANDS & EVENTS ASSOCIES

### 7.1 Commands Nouvelles necessaires

Les commandes suivantes ne figurent PAS dans DOC-014 et doivent y etre ajoutees:

| Command | Aggregate Cible | Acteur | Preconditions | Validation | Resultat |
|---------|----------------|--------|--------------|-----------|---------|
| `CreateInvitation` | OrganizationAggregate | Admin, Treasurer, Pastor (scope-bound) | Org active, target_email valide | role_suggéré valide pour actor's level; expiry ≤ 30 jours | Invite created with pending status + `InvitationCreated` |
| `AcceptInvitation` | OrganizationAggregate | System (auto after link click) | Invite pending, not expired, token valid | Token hash match; invite within expiry | MembershipCreated or OnboardingStarted + `InvitationAccepted` |
| `RejectInvitation` | OrganizationAggregate | Invité (target_email) | Invite pending | Identity confirmed (same email as invite target) | Status → rejected + `InvitationRejected` |
| `RevokeInvitation` | OrganizationAggregate | Inviter (admin) ou SuperAdmin | Invite pending | Inviter must have membership:manage on the org | Status → cancelled + `InvitationRevoked` |
| `AddMemberToGroup` | RelationshipAggregate | Admin | Member existe, group existe, pas de duplicate | UNIQUE(membre_id, groupe_id) | `MemberJoinedGroup` (EXISTANT dans DOC-014) |
| `RemoveMemberFromGroup` | RelationshipAggregate | Admin | Membership existe | RESTRICT FK preserved | `MemberLeftGroup` (EXISTANT dans DOC-014) |

### 7.2 Evenements Nouvelles proposes

| Event | Aggregate Source | Condition | Consommateurs |
|-------|-----------------|-----------|--------------|
| `InvitationCreated` | OrganizationAggregate | CreateInvitation success | NotificationAggregate (send invite email), AuditAggregate |
| `InvitationSent` | OrganizationAggregate | Invite email/SMS delivered successfully | None persistent |
| `InvitationAccepted` | OrganizationAggregate | AcceptInvitation success | AuditAggregate, NotificationAggregate (welcome), OfflineSyncAggregate |
| `InvitationRejected` | OrganizationAggregate | RejectInvitation success | AuditAggregate |
| `InvitationRevoked` | OrganizationAggregate | RevokeInvitation success | AuditAggregate |
| `InvitationExpired` | OrganizationAggregate | System detects expired invite | AuditAggregate |
| `OnboardingStarted` | IdentityAggregate | AcceptInvitation triggers new user creation | NotificationAggregate (setup guide), AuditAggregate |

---

## 8. PERSISTANCE

### 8.1 Table `invitations` (Nouvelle)

Cette table doit etre ajoutée au schema physique sous la OrganizationAggregate:

| Colonne | Type | Contrainte | Source |
|---------|------|-----------|--------|
| `id` | uuid PK | DEFAULT gen_random_uuid() | NB-ID-002 (surrogé permanent) |
| `org_id` | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | NB-MT-001 |
| `target_email` | varchar(255) | NOT NULL | BR-INV-001 |
| `target_phone` | varchar(30) | | Optionnel, SMS channel |
| `inviter_user_id` | uuid FK | NOT NULL REFERENCES users(id) | Audit trace |
| `role_suggéré` | varchar(20) | NOT NULL CHECK IN {...} | BR-MEM-011 |
| `expires_at` | timestamptz | NOT NULL | BR-INV-003 |
| `status` | varchar(20) | NOT NULL CHECK IN {pending, accepted, rejected, expired, cancelled} | Lifecycle invite |
| `accept_token_hash` | varchar(60) | NOT NULL | bcrypt/scrypt hash |
| `group_id` | uuid FK | REFERENCES org_units(id) | Optional scope target |
| `created_at` | timestamptz | NOT NULL DEFAULT now() | Audit trail |
| `_org_id` | uuid | NOT NULL | DOC-023 §8.1 |

Index:
- UNIQUE(org_id, target_email, status='pending') — une invitation active par email par org
- INDEX idx_invitations_org_id ON invitations(org_id)
- INDEX idx_invitations_target_email ON invitations(target_email)
- INDEX idx_invitations_expires_at ON invitations(expires_at) — pour purge scheduler

### 8.2 Integration avec Tables Existantes

| Table existante | Relation avec invitations | Type |
|----------------|--------------------------|------|
| `users` | `inviter_user_id` FK → users.id | Referenced (DOC-023 §3.2) |
| `users` | `target_email` matches → existing user lookup | Polymorphic search (not FK) |
| `members` | Accepted invite creates MemberRecord if needed | Composition (new entry) |
| `group_memberships` | Accepted invite may create GroupMembership entry | Junction (DOC-023 §3.3) |
| `audit_entries` | All invite lifecycle changes logged | Immutable log (NB-PERSIST-006) |

### 8.3 Strat egie de Persistance

La table `invitations` relève de la strategie **Collection** pour OrganizationAggregate (DOC-017 §4.3):
- Bounded queue of pending invitations per org
- Each entry has independent lifecycle (created → accepted/rejected/expired/cancelled)
- Expired entries are periodically purged (retention: 30 days post-expiry)
- Confirmed (accepted) entries are soft-deleted (tombstoned) then purged after retention

---

## 9. TRACABILITE

| Section ORG-002 | Document Source | Reference | Commentaire |
|----------------|-----------------|-----------|-------------|
| Distinctions fondamentales | DOC-012 §1-2-4 | OrganizationAggregate, IdentityAggregate, RelationshipAggregate | Mapping User/Account/Member/Invite/Membership exact |
| Invitation schema | ORG-002 §2.3 (nouveau) | N/A — proposition | Aucune table `invitations` n'existe actuellement dans PG-Schema-v1 |
| Membership etats | DOC-012 §3.2 + §4.1 | ResourceAggregate MemberRecord, RelationshipAggregate GroupMembership | Enums actifs/inactifs/decedes/transfères confirms dans members.statut_membre |
| Transitions membership | DOC-012 §3.2 + DOC-014 | TransitionMemberStatus command | Existing commands in DOC-014 support transitions |
| Multi-org | DOC-012 §2 (IdentityAggregate) | UserRole multi-context | Per-user role variance supported by JWT org_id claim |
| Invitations → onboarding | ORG-002 §2.6 (nouveau) | N/A — gap identification | DOC-012 n'a pas de notion d'invitation actuelle |
| Invitations → membership creation | ORG-002 §2.4 | AcceptInvitation flow | Bridge between new Invitation concept and existing RelationshipAggregate |
| NeverBreak applies | DOC-023 §8, NB-MT-001-004 | Isolement multi-locataire | Appliqué aux invitations et memberships |
| GroupMembership junction | DOC-023 §3.3 | N:N pattern | group_memberships table (PG-Schema-v1 table 11) |

---

## TENSIONS IDENTIFIEES

| # | Tension | Documents Conflituants | Resolution Recommandee |
|---|---------|----------------------|----------------------|
| **T-101** | DOC-012 n'a PAS de concept d'invitation. Il n'existe pas de table `invitations` dans PG-Schema-v1, et aucune commande `CreateInvitation` dans DOC-014. | ORG-002 §2 (invitation model) vs DOC-012/DOC-014/PG-Schema-v1 (absence totale) | L'invitation est un NOUVEAU concept. Elle doit etre formellement ajoutée à DOC-012 comme une entite de OrganizationAggregate, à DOC-014 comme commands/events nouveaux, et au schema PG via migration. **Blocant IGS-v1** si non resolvé. |
| **T-102** | DOC-014 define `AddMemberToGroup` avec acteur "Admin", mais ORG-002 §2.2 dit que "roles admin/treasurer/pastor peuvent inviter". La permission `membership:manage` n'est attribuee qu'à Admin selon DOC-023/SEC-SPEC-003. | ORG-002 §2.2 (3 roles peuvent inviter) vs DOC-014 (Admin seulement pour AddMemberToGroup) | Clarifier: l'invitation (CreateInvitation) est accessible à admin/treasurer/pastor, mais l'ajout DIRECT a un groupe (AddMemberToGroup) reste Admin-only. Deux chemins distincts: invitation (indirect, via accept) vs add-to-group (direct). |
| **T-103** | DOC-012 dit "un user appartient à UNE org" (Relationship: IdentityAggregate N:1 → OrganizationAggregate). ORG-002 §4 dit qu'un utilisateur peut avoir des memberships dans PLUSIEURS orgs avec des roles differents. | DOC-012 (§2.1 Relations: "un user appartient à UNE org") vs ORG-002 §4.1 (multi-org avec bascule JWT) | TENSION ARCHITECTURELLE MAJEURE. DOC-012 definit l'IdentityAggregate avec une relation N:1 stricte vers OrganizationAggregate. Le multi-org necessite soit: (a) changer la relation en N:M, (b) ajouter un intermediaire UserOrgBinding. Cette tension doit etre resolue avant que les invitations puissent fonctionner en contexte multi-org. |
| **T-104** | DOC-015 §MEMBERSHIP INVARIANTS mentionne `MULTI-020: Multi-Membership Autorisée` pour RelationshipAggregate — mais cela concerne les GROUPS au sein d'une org, pas les memberships multi-ORG. | DOC-015 MULTI-020 (multi-group au sein d'une org) vs ORG-002 §4 (multi-org) | MULTI-020 couvre uniquement la multi-appartenance a plusieurs groupes DANS une meme org. La multi-appartenance a plusieurs ORGANISATIONS distinctes n'est PAS couverte par cet invariant et necessite un nouvel invariant ORG-MULTI-001 si adoptee. |
| **T-105** | Le token d'acceptation d'invitation est stocké en hash (bcrypt). Le hash ne peut pas etre recupere — donc si un utilisateur perd le lien d'invitation, il ne peut pas regenerer le token. | ORG-002 §2.3 (accept_token_hash) vs UX (perte de lien = invitation expir ee sans recuperation) | Ajouter un mécanisme de renvoi d'invitation (regenerate_invite) ou limiter la durée de vie des invitations. A discuter dans ADR. |

---

## IMPACT SUR DOCUMENTS CANONIQUES

Ce document identifie les modifications necessaires aux documents canoniques existants:

| Doc affecte | Modification requise | Priorité |
|-------------|---------------------|----------|
| **DOC-012** | Ajouter InvitationEntity à OrganizationAggregate; Clarifier IdentityAggregate N:1 vs N:M vers OrganizationAggregate | P0 — bloque Multi-org |
| **DOC-014** | Ajouter commands: CreateInvitation, AcceptInvitation, RejectInvitation, RevokeInvitation | P0 — bloque feature |
| **DOC-014** | Ajouter events: InvitationCreated, InvitationAccepted, InvitationRejected, InvitationRevoked, InvitationExpired, OnboardingStarted | P0 — bloque feature |
| **DOC-015** | Ajouter section ORGANIZATION INVARIANTS avec ORG-001 à ORG-005 | P1 — validation business |
| **DOC-021** | Ajouter table `invitations` à Physical Data Model | P0 — bloque implémentation |
| **PG-Schema-v1** | Ajouter DDL pour table invitations + indexes | P0 — genere depuis DOC-021 amende |
| **DOC-023** | Clarifier que `_org_id` s'applique aux invitations | P1 — coherence multi-tenant |
| **SEC-SPEC-003** | Ajouter permissions: `invitation:create`, `invitation:accept`, `invitation:revoke` | P1 — authorization |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Architecture Canonique | Creation — Model Membership, Invitation & Access | IGS-v1 COMPLIANT avec tensions identifiees |

---

*Ce document fait partie de la serie canonique IGS-v1. Il introduit des concepts nouveaux (Invitations) non couverts par les documents canoniques existants. Les tensions identifiees (T-101 a T-105) doivent etres resolvees via amendement des documents sources avant que ce modele ne puisse etre considere comme pleinement integre au systeme.*
