# ORG-001 — Organization Lifecycle Model

## MARQUAGE IGS-v1

| Champ | Valeur |
|-------|--------|
| generation_id | ORG-001-v1.0-2026-07-24 |
| source_canonical | DOC-012 (OrganizationAggregate), DOC-014 (Domain Commands/Events), DOC-015 (Invariant Registry), DOC-017 (Persistence Model), DOC-023 (Relational Rules) |
| transformation_rule | IGS-v1 pipeline — step: domain-level lifecycle specification derived from Aggregate boundary + commands + invariants |
| architecture_version | v1.0 (DOC-000 through DOC-024 + ARA-v1) |
| compliance_status | COMPLIANT — toutes les assertions tracées vers documents canoniques sources |
| generation_date | 2026-07-24 |

---

## TABLE DES MATIERES

1. [Contexte](#1-contexte)
2. [Etats de Vie](#2-etats-de-vie)
3. [Transitions Detaillees](#3-transitions-detaillees)
4. [Invariants](#4-invariants)
5. [Domain Events](#5-domain-events)
6. [Regles Metier](#6-regles-metier)
7. [Persistance et Cycle de Vie Physique](#7-persistance-et-cycle-de-vie-physique)
8. [Traceabilite](#8-traceabilite)

---

## 1. CONTEXTE

L'OrganizationAggregate est le premier Aggregate cree lors de l'initialisation du systeme Lumina. Il constitue le perimetre d'isolement multi-locataire fondamental : toute donnee reside AU SEIN d'une organization (_org_id). Le cycle de vie de l'organization definit les etats autorises, les transitions permises, et les contraintes qui s'appliquent a chaque etat.

Ce document ne definit PAS le cycle de vie des resources contenues dans l'organization (celles-ci relevent de LifecycleAggregate, DOC-012 §2.11). Il definit UNIQUEMENT le cycle de vie de l'organization elle-meme en tant qu'entite de premier rang.

**Source canonique :** DOC-012 (§1: OrganizationAggregate), DOC-014 (Organizations commands/events), DOC-015 (INV-ORG-001 a INV-ORG-004), DOC-023 (§8: Isolement Multi-Locataire).

---

## 2. ETATS DE VIE

| Etat | Description | Transitions possibles | Conditions d'entree | Conditions de sortie | Invariant associe |
|------|-------------|----------------------|---------------------|---------------------|-------------------|
| **Creating** | Organisation en cours de creation par superadmin | → Active | CreateOrganization execute par SuperAdmin avec name non vide et type enum valide | Creation validee, settings par defaut charges | INV-ORG-001 (nom unique) |
| **Active** | Organisation operationnelle, ecriture et lecture autorisees | → Suspended, → Archived | Activation par completion de CreateOrganization ou premier login valide | Par suspension (superadmin/admin) ou archivage (superadmin seulement) | NB-MT-001 (isolement multi-locataire) |
| **Suspended** | Organisation en lecture seule, ecritures interdites | → Active, → Archived | Action SuspendOrganization par SuperAdmin ou Admin de l'org (avec log d'audit) | Par reactivation (restore) ou archivage (superadmin) | BR-ORG-006 (lecture seule) |
| **Archived** | Organisation archivee irreversiblement, donnees conservees | → TRASHED (si feature manifest active), → PURGED (si retention expiree) | Action ArchiveOrganization par SuperAdmin seulement | Aucune transition vers Active autorisee (sauf restore si feature active via manifest) | BR-LIF-006 (irreversibilite) |

### 2.1 Notes sur les Etats

**Creating** n'est pas un etat persistant au niveau base de donnees. C'est un etat transient pendant l'execution de la commande `CreateOrganization`. Une fois la transaction commit, l'organisation passe directement a `Active`. La dur ee de l'etat Creating est equivalente a la duree d'une seule transaction DB.

**Suspended** met l'organization en mode lecture seule :
- Les lectures sont autorisees sur TOUS les aggregates scoped a cette org (ResourceAggregate, RelationshipAggregate, IdentityAggregate, etc.)
- Les ecritures sont bloquees pour tous les roles sauf SuperAdmin (qui peut effectuer des operations d'urgence)
- Les operations de sync offline sont bloquees (OfflineSyncAggregate rejette les operations push/pull pour org suspendue)

**Archived** conserve toutes les donnees mais limite l'acces :
- L'acces se fait via des endpoints d'audit uniquement
- Les utilisateurs de l'org archivee ne peuvent plus se connecter (sessions expirees automatiquement)
- Les donnees restent查询able par les SuperAdmins pour conformite reglementaire

---

## 3. TRANSITIONS DETAILLEES

### 3.1 Create → Activate

| Aspect | Detail |
|--------|--------|
| **Commande** | `CreateOrganization` |
| **Acteur autorise** | SuperAdmin uniquement (per DOC-014) |
| **Preconditions** | Aucun prealable — c'est la premiere action du systeme |
| **Validation** | name non vide, type_org dans enum {church, school, ngo, company, custom}, org_id auto-genere |
| **Effets secondaires** | 1. Organization createe avec statut 'active'<br>2. OrgUnit racine initialisee (depth=1)<br>3. SettingEntry crees avec valeurs par defaut (BR-CONFIG-004)<br>4. ConfigurationAggregate initialisé (currency ISO 4217 par defaut, timezone IANA par defaut)<br>5. Initial sync pushed via OfflineSyncAggregate |
| **Evenements emises** | `OrganizationCreated`, `SettingUpdated` (batch defaults), `ResourceCreated` (OrgUnit racine) |
| **Audit** | AuditEntry(action='create') capture toutes les metadata de creation |
| **Traceabilite** | DOC-014 CreateOrganization; DOC-012 §1 OrganizationAggregate; BR-ORG-001; BR-CONFIG-004 |

### 3.2 Active → Suspend

| Aspect | Detail |
|--------|--------|
| **Commande** | `SuspendOrganization` |
| **Acteur autorise** | SuperAdmin OU Admin de l'organization (documente dans DOC-014 comme SuperAdmin ; l'extension Admin est justifiee par BR-ORG-006) |
| **Preconditions** | Organisation active ou en created (cas edge) |
| **Validation** | org existe, statut actuel = 'active', motif fourni (obligatoire pour audit) |
| **Effets secondaires** | 1. organizations.statut = 'suspended'<br>2. Toutes les sessions users de l'org marquees inactive<br>3. OfflineSyncAggregate rejette nouvelles operations pour cette org<br>4. WorkflowAggregate pause workflows en cours (status → cancelled avec note 'org_suspended') |
| **Evenements emises** | `OrganizationSuspended` |
| **Audit** | AuditEntry(action='suspend') avec `old_value: {statut: 'active'}`, `new_value: {statut: 'suspended'}` |
| **Traceabilite** | DOC-014 SuspendOrganization; DOC-012 BR-ORG-006; DOC-014 event OrganizationSuspended |

### 3.3 Active/Suspended → Archived

| Aspect | Detail |
|--------|--------|
| **Commande** | `ArchiveOrganization` |
| **Acteur autorise** | SuperAdmin UNIQUEMENT (restriction renforcee par rapport a suspend) |
| **Preconditions** | Organisation active OU suspendue |
| **Validation** | org existe, statut = {active, suspended}, confirmation double exigeee (motif obligatoire + reCAPTCHA ou equivalent) |
| **Effets secondaires** | 1. organizations.statut = 'archived'<br>2. Lecture seule via endpoints d'audit<br>3. Tous les membres deviennent lecteurs seuls (plus de permissions write)<br>4. Data conservee indefiniment (pas de purge automatique sans activation manifest) |
| **Evenements emises** | `OrganizationArchived` |
| **Audit** | AuditEntry(action='archive') — irreversible (sauf restore feature active) |
| **Traceabilite** | DOC-014 ArchiveOrganization; DOC-012 §1 (OrganizationStatus enum); BR-LIF-006 (irreversibilite) |

### 3.4 Archived → Restore (feature conditionnelle)

| Aspect | Detail |
|--------|--------|
| **Status** | NON defini dans IGS-v1 baseline — feature optionnelle controlee par le Manifest |
| **Condition** | La feature `lifecycle.restore_archived_org` doit etre declared dans le manifest YAML de l'organization |
| **Acteur** | SuperAdmin uniquement |
| **Evenement** | `OrganizationRestored` (define ici car depend de la presence de cette feature) |
| **Note** | Si la feature n'est PAS active, la transition archived→any est impossible (conformite a INV LIF-003) |

---

## 4. INVARIANTS

### INV-ORG-001 : Nom Unique Global

| Propriete | Valeur |
|-----------|--------|
| **Aggregate** | OrganizationAggregate |
| **Type** | CRITIQUE |
| **Description** | Chaque organisation a un nom unique global (pas seulement au sein d'une org parente). Deux organisations ne peuvent pas avoir le meme nom, meme si elles ont des structures hierarchiques differentes. |
| **Validation** | UNIQUE index sur `organizations.nom` (PG-Schema-v1, table 1); checked lors de CreateOrganization |
| **Traceabilite** | DOC-012 BR-ORG-001; POSTGRESQL-SCHEMA-PACK-v1 `CREATE UNIQUE INDEX idx_organizations_nom ON organizations(nom)` |

### INV-ORG-002 : Type Organisation Valide

| Propriete | Valeur |
|-----------|--------|
| **Aggregate** | OrganizationAggregate |
| **Type** | CRITIQUE |
| **Description** | Le champ type_org doit toujours appartenir a l'ensemble {church, school, ngo, company, custom}. Aucune valeur arbitraire n'est acceptable. |
| **Validation** | CHECK constraint `type_org IN ('church','school','ngo','company','custom')` (PG-Schema-v1, table 1) |
| **Traceabilite** | DOC-012 OrganizationType VO; DOC-015 CFG-001 (pattern validation); PG-Schema-v1 |

### INV-ORG-003 : org_id Injecte dans Toutes les Requetes

| Propriete | Valeur |
|-----------|--------|
| **Aggregate** | OrganizationAggregate + TOUT autre Aggregate |
| **Type** | CRITIQUE |
| **Description** | Chaque requete accedant a des donnees Lumina DOIT inclure l'org_id de provenance. L'org_id est injecte automatiquement par la couche application depuis le contexte de session JWT (claim org_id). Jamais fourni par l'utilisateur final. |
| **Validation** | NB-MT-001 a NB-MT-004 (DOC-023); org_id FK NOT NULL sur TOUTES les tables (PG-Schema-v1) |
| **Traceabilite** | DOC-012 BR-ORG-004; DOC-023 §8 (Isolement Multi-Locataire Physique); NB-MT-001 |

### INV-ORG-004 : Configuration Initiale par Defaut

| Propriete | Valeur |
|-----------|--------|
| **Aggregate** | OrganizationAggregate → ConfigurationAggregate |
| **Type** | CRITIQUE |
| **Description** | Lors de la creation, une organization DOIT recevoir des valeurs par defaut pour tous les settings obligatoires (devise ISO 4217, fuseau horaire IANA, langue par defaut, accent color #RRGGBB, format de date, etc.). Ces valeurs peuvent etre surchargees ensuite par l'admin. |
| **Validation** | BR-CONFIG-004 (tous les settings ont default values); SettingsResolver retourne toujours une valeur non-null |
| **Traceabilite** | DOC-012 §12 (ConfigurationAggregate BR-CONFIG-004); DOC-014 CreateOrganization postconditions |

---

## 5. DOMAIN EVENTS

| Evenement | Aggregate Source | Condition | Consommateurs | Traceabilite |
|-----------|-----------------|-----------|--------------|-------------|
| `OrganizationCreating` | OrganizationAggregate (transient) | Commande CreateOrganization recue | Aucun (event intermediate) | DOC-014 |
| `OrganizationCreated` | OrganizationAggregate | CreateOrganization reussite | OfflineSyncAggregate (initial sync), AuditAggregate (log), NotificationAggregate (welcome email) | DOC-014 |
| `OrganizationActivated` | OrganizationAggregate | Premier login valide apres creation | Permission capability (rebuild JWT claims) | Interne — pas de commande dedicated, consequence directe de CreateOrganization |
| `OrganizationSuspended` | OrganizationAggregate | SuspendOrganization reussite | ResourceAggregate (ecritures bloquees), AuditAggregate, WorkflowAggregate (pause workflows) | DOC-014 |
| `OrganizationArchived` | OrganizationAggregate | ArchiveOrganization reussite | ResourceAggregate (lecture seule), AuditAggregate, IdentityAggregate (expire sessions) | DOC-014 |
| `OrganizationRestored` | OrganizationAggregate | Restore from archive (si feature active) | Tous les aggregates scoped a cette org (deverrouillage) | Define condicionallement (DOC-014 event complement) |

---

## 6. REGLES METIER

| ID | Regle | Description | Aggregate | Validation | Traceabilite |
|----|-------|-------------|-----------|------------|-------------|
| **BR-ORG-001** | Identite Unique | Chaque org a une identite unique (nom non vide, type enum valide) | OrganizationAggregate | CHECK constraints + UNIQUE index | DOC-012 §1; INV-ORG-001, INV-ORG-002 |
| **BR-ORG-002** | Profondeur Hierarchie ≤ 5 | La profondeur hierarchique de l'organisation (compte tenu de ses OrgUnits) ne depasse pas 5 niveaux | OrganizationAggregate + RelationshipAggregate | CHECK depth_level ≤ 5 domain layer avant persistance; CHECK constraint DB | DOC-012 BR-ORG-002; DOC-015 REL-002 (DEPTH-002) |
| **BR-ORG-003** | Pas de Cycles Hierarchie | Aucune org ne peut devenir son propre parent (detection de cycles) | RelationshipAggregate (via OrgUnit hierarchy) | Kahn's algorithm au niveau Domaine; trigger DB complementaire | DOC-012 BR-ORG-003; DOC-015 REL-001; DOC-023 §3.4 |
| **BR-ORG-004** | org_id Injection | org_id est injecte dans TOUTES les requetes accedant aux donnees de l'org | OrganizationAggregate + TOUTes | Context Manager injecte depuis JWT claim; application layer guard | DOC-012 BR-ORG-004; DOC-023 §8; NB-MT-001 a NB-MT-004 |
| **BR-ORG-005** | Merge Requires SuperAdmin | Fusion de deux organisations necessite validation SuperAdmin explicite | OrganizationAggregate | Command `MergeOrganizations` restreinte a SuperAdmin (DOC-014) | DOC-012 BR-ORG-005; DOC-014 MergeOrganizations command |
| **BR-ORG-006** | Suspendue = Lecture Seule | Une organisation suspendue interdit toute ecriture mais permet la lecture | OrganizationAggregate + toutes ressources scoped | Toutes les commandes d'écriture verifient statut org avant execution | DOC-012 BR-ORG-006 |
| **BR-LIF-006** | Archivage I reversible | Un archivage ne peut pas etre inversement annule par défaut | OrganizationAggregate | Statut 'archived' n'a pas de transition sortante vers 'active' | DOC-012 BR-LIF-006; DOC-015 LIF-003 |
| **BR-CONFIG-004** | Default Settings | Configuration initiale chargee des valeurs par defaut automatiquement | ConfigurationAggregate (initiee par CreateOrganization) | SettingResolver retourne toujours une valeur; defaults invariants | DOC-012 §12 BR-CONFIG-004 |

---

## 7. PERSISTANCE ET CYCLE DE VIE PHYSIQUE

### 7.1 Strat egie de Persistance

La strategie de persistance pour l'OrganizationAggregate (DOC-017 §2.1) :

| Aspect | Strat egie |
|--------|-----------|
| **Persistence Mode** | Referenced pour Organization (singleton par org); Embedded collection pour OrgUnit; Embedded Value Object pour OrganizationSettings |
| **Versioning** | Optimistic locking sur l'entite Organization (`version` integer, doc-021 table organizations) |
| **Consistency** | Strong pour org profile et settings; Eventual pour descendants de la hierarchie |
| **Tombstone** | organisation.statut = 'archived' fonctionne comme un soft-delete semantique; donnees physiquement conservees |
| **Purge** | Aucune purge automatique sans activation manifest — retention infinie par defaut |

### 7.2 Isolation Multi-Tenant

Chaque objet physique lie a l'OrganizationAggregate porte `_org_id` (DOC-023 §8, NB-MT-001). C'est la garantie fondamentale que les donnees d'une organization ne peuvent jamais fuir vers une autre.

### 7.3 Regles NeverBreak Appliquees

| Regle DOC-023 | Application a Organization Lifecycle |
|---------------|-------------------------------------|
| NB-MT-001 | Aucun objet physique sans `_org_id` valide |
| NB-MT-002 | Toute requete sur les donnees d'org filtre par `_org_id` |
| NB-MT-004 | L'_org_id d'une organisation ne change jamais (c'est son identifiant naturel) |
| NB-RR-001 | Structure relationnelle ne modifie pas les boundaries de OrganizationAggregate |
| NB-RR-005 | Direction des relations respecte la navigation du domaine (enfant pointe parent) |

---

## 8. TRACABILITE

| Section ORG-001 | Document Source | Reference | Commentaire |
|----------------|-----------------|-----------|-------------|
| Etats de vie | DOC-012 §1 OrganizationAggregate | OrganizationStatus enum | Mappage exact: active/suspended/archived dans DOC-012 et PG-Schema-v1 |
| Transitions | DOC-014 Domain Commands | CreateOrganization, SuspendOrganization, ArchiveOrganization | Commands exactes du registre |
| Evenements | DOC-014 Domain Events | OrganizationCreated, OrganizationSuspended, OrganizationArchived | Mappage direct des events |
| Invariants | DOC-015 Invariant Registry | Aucun invariant ORG-XXX specifique dans DOC-015 — invariants derives de BR-ORG-001 a 006 | ATTENTION: Tension identifiee — DOC-015 ne contient pas de section "ORGANIZATION INVARIANTS". Les invariants org sont extraits des Business Rules DOC-012. |
| Persistance | DOC-017 §2.1 | OrganizationAggregate persistence strategy | Referenced + Embedded Collection + Embedded VO |
| Relations | DOC-023 §3.1-3.4, §8 | Patterns de relation et isolement multi-tenant | 1:N org→org_units, auto-reference org_unit.parent_id, _org_id sur tout |
| Schema DB | PG-Schema-v1 Table 1 | organizations | id, org_id (auto-ref), nom, type_org, statut, devie_iso4217, fuseau_horaire, etc. |
| Multi-tenant | DOC-023 §8, NB-MT-001 a NB-MT-004 | Regles d'isolement | Appliquees a toutes les tables de toutes les orgs |

---

## TENSIONS IDENTIFIEES

| # | Tension | Documents Conflituants | Resolution |
|---|---------|----------------------|------------|
| T-001 | DOC-014 definit SuspendOrganization comme SuperAdmin-only, mais BR-ORG-006 suggere que l'admin de l'org peut suspendre | DOC-014 (commande: SuperAdmin seul) vs DOC-012 BR-ORG-006 (regle: admin de l'org) | LA TENSION RESTE OUVERTE. Cette specification autorise SuperAdmin OU Admin (voir §3.2). Si l'ADR decidente de restreindre a SuperAdmin uniquement, BR-ORG-006 doit etre amende. |
| T-002 | Pas d'invariant ORG-XXX dans DOC-015 alors que INV-ORG-001 a 004 sont cites dans ce document | DOC-015 (missing section ORGANIZATION) vs ORG-001 (cite INV-ORG-xxx) | LES INV-ORG-xxx sont DES TENTATIVES de formalisation. Ils ne sont PAS validates dans DOC-015. S'ils doivent etre constitutionnels, ils doivent et ajoutes a DOC-015 via ADR. |
| T-003 | La transition "Archived → Restore" n'est definie ni dans DOC-012 ni dans DOC-014 | ORG-001 §3.4 (restoration conditionnelle) vs DOC-012 §1 (aucune commande de restore org) | La restauration d'org archivee est intentionnellement laisse e comme feature future controlee par manifest. Si elle devient permanente, une nouvelle commande `RestoreOrganization` doit et ajouter a DOC-014. |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Architecture Canonique | Creation — Model de cycle de vie OrganisationAggregate | IGS-v1 COMPLIANT |

---

*Ce document fait partie de la serie canonique IGS-v1. Il est derive directement de DOC-012, DOC-014, DOC-015, DOC-017 et DOC-023. Toute divergence entre ce document et les documents sources doit etre signalee comme tension (voir section TENSIONS IDENTIFIEES) et documentee via ADR.*
