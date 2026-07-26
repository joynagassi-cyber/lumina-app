# Authorization Rules — Lumina v1

**Doc ID:** SEC-SPEC-003
**Version:** v1.0
**Statut:** REGLES D'AUTORISATION DEFINIES PAR GENESIS
**Date:** 2026-07-25
**Generateur :** security-specifier v1.0
**Source canonique :** ["SEC-SPEC-001", "API-CONTRACT-004", "DOC-015", "DOC-023", "RLS-POLICY-SPECIFICATION-V1"]
**Transformation_rule :** "security-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document etablit les regles d'autorisation abstraites qui gouvernent l'attribution des permissions aux acteurs de Lumina. Il definit la hierarchie des 9 roles RBAC, la nomenclature des permissions, le flux d'evaluation d'autorisation, la matrice complete d'acces, et les regles d'evaluation dynamique des permissions.

**Regle constitutionnelle :** Aucune operation n'est autorisee par defaut. Seules les operations explicitement permises par la matrice RBAC de ce document sont executees. L'interdiction est la valeur par defaut.

---

## SECTION 1: HIERARCHIE RBAC — LES 9 ROLES

### 1.1 Vue d'Ensemble de la Hierarchie

Lumina utilise un modele Role-Based Access Control (RBAC) avec neuf roles fonctionnels. La hierarchie est structuree en quatre niveaux de privilegie :

```
           [superadmin] — Global Wildcard
                │
           ┌────┴────┐
     [admin]     [readonly]  — Perimetre Org
          │
    ┌─────┼─────┐
 [treasurer] [pastor] [staff]  — Perimetre Fonctionnel
          │
   [service_account]
         │
   [sync_service]
         │
  [migration_role]  — Schema Only (no data access)
```

### 1.2 Description Detaillee de Chaque Role

#### Role 1: superadmin

**Definition :** Administrateur systeme global. Possede l'ensemble complet des permissions sur toutes les organisations.

**Ce qu'il PEUT faire :**
- Creer, lire, mettre a jour, supprimer toute ressource dans TOUTE organisation.
- Creer et superviser d'autres superadmin.
- Changer le role de n'importe quel utilisateur (y compris superadmin).
- Bypass RLS via configuration de session application (SEC-SPEC-001 §7, RLS-POLICY-SPECIFICATION-V1 M-004).
- Archiver, suspendre, fusionner, transférer des organisations.
- Acceder aux donnees de credentials et sessions de toutes organisations.
- Executer des operations avec wildcard `*:*:*`.

**Ce qu'il NE PEUT PAS faire :**
- Utiliser ses privileges pour contourner les invariants du domaine (DOC-15). Les regles metier absolues s'appliquent meme au superadmin.
- Supprimer les entries d'audit (NB-PERSIST-006).
- Modifier les regles de cet invariant lui-meme.

**Type de session :** Courte (max 4h), monitoring renforcee. Reconnexion MFA obligatoire a chaque renouvellement.

#### Role 2: admin

**Definition :** Administrateur d'une organisation specifique. Possede un perimetre large mais confine a UNE organisation.

**Ce qu'il PEUT faire :**
- Gerer les parametres de son organisation (config:update).
- Creer et gerer les membres de son organisation (member:create/update).
- Creer et gerer les units organisationnelles (organization_unit:create).
- Gerer les transactions financieres (transaction:create/approve/reject).
- Gerer les evenements, formulaires, notifications.
- Creer des utilisateurs treasurer, pastor, staff.
- Lire et exporter les rapports financiers (reporting:read).
- Acceder aux donnees de credentials et sessions de SON organisation uniquement.
- Archiver, trasher, restaurer des resources (lifecycle:*).

**Ce qu'il NE PEUT PAS faire :**
- Creer d'autres utilisateurs admin ou superadmin (BR-ID-005).
- Changer le role de qui que ce soit vers admin ou superadmin.
- Acceder aux donnees d'une autre organisation.
- Executer des operations avec wildcard.
- Modifier la configuration RLS.

**Type de session :** Standard (max 8h). Rafraichissement automatique possible.

#### Role 3: treasurer

**Definition :** Trésorier de l'organisation. Specialise dans les operations financieres et de reporting.

**Ce qu'il PEUT faire :**
- Creer des transactions financieres (transaction:create).
- Approuver des transactions dans son seuil d'autorisation (transaction:approve).
- Lire toutes les transactions de l'organisation (transaction:read).
- Lire les membres et evenements (member:read, event:read).
- Generer et exporter des rapports financiers (reporting:generate, reporting:export).
- Calculer les bilans financiers (reporting:calculate).
- Lire les categories (categories:read).

**Ce qu'il NE PEUT PAS faire :**
- Modifier les parametres de l'organisation.
- Creer ou modifier des membres (member:create/update interdit).
- Creer ou modifier des evenements.
- Gerer les utilisateurs ou roles.
- Acceder aux donnees de credentials ou sessions.
- Acceder aux formulaires en écriture.
- Gerer les workflows (workflow:trigger/approve/cancel interdit).

**Type de session :** Standard (max 8h).

#### Role 4: pastor

**Definition :** Pasteur de l'organisation. Responsable de la gestion des membres, evenements, groupes et formulaires.

**Ce qu'il PEUT faire :**
- Gerer les membres (members): lecture, creation, modification, transition de statut.
- Creer et gerer les evenements (events): lecture, creation, modification.
- Gerer les group memberships (group_memberships): lecture, creation, modification, suppression.
- Gerer les org_units (lecture et ecriture).
- Gerer les formulaires (forms, form_sections, form_fields): lecture et ecriture.
- Lire les notifications et gerer ses preferences.
- Approuver des steps de workflow pour lesquels il est assigné (workflow:approve assigné).
- Lire les transactions et categories (read-only).

**Ce qu'il NE PEUT PAS faire :**
- Creer ou modifier des transactions financieres.
- Approuver des transactions financieres (transaction:approve interdit).
- Generer des rapports financiers.
- Gerer les parametres de l'organisation.
- Gerer les utilisateurs ou roles.
- Acceder aux donnees de credentials ou sessions.
- Archiver ou purger des resources.

**Type de session :** Standard (max 8h).

#### Role 5: staff

**Definition :** Personnel de l'organisation. Acces en lecture etendue aux donnees operationnelles.

**Ce qu'il PEUT faire :**
- Lire presque toutes les donnees de l'organisation (query only sur tous les types de resources).
- Lire les transactions, membres, evenements, groupes, formulaires, notifications, vocabulaire.
- Ecrire sur certains formulaires (forms, form_sections, form_fields).
- Lire les workflow instances, steps, logs (read-only).
- Lire les settings et categories.

**Ce qu'il NE PEUT PAS faire :**
- Creer ou modifier des transactions financieres.
- Creer ou modifier des membres.
- Creer ou modifier des evenements.
- Gerer les utilisateurs ou roles.
- Gerer les parametres de l'organisation.
- Generer des rapports financiers.
- Gerer les workflows (trigger/approve/reject/cancel).
- Acceder aux donnees de credentials ou sessions.
- Archiver ou trasher des resources.

**Type de session :** Standard (max 8h).

#### Role 6: service_account

**Definition :** Compte de service pour l'acces programmatique a l'API backend.

**Ce qu'il PEUT faire :**
- CRUD complet sur la majorite des tables de donnees de SON tenant.
- Accéder aux donnees de users et sessions (pour l'authentification).
- Executer les operations de synchronisation (push/pull).
- Acceder aux pending_operations et sync_statuses.

**Ce qu'il NE PEUT PAS faire :**
- Acceder aux donnees de credentials (table credentials bloqueee).
- Creer ou modifier des users administrateurs.
- Changer les roles d'utilisateurs.
- Executer des operations superadmin.
- Acceder aux donnees d'autres tenants.
- Modifer les settings critiques de l'organisation (org_settings).

**Type de session :** Longue (max 24h). Rotation programmatique automatique via scheduler (CRT-009).

#### Role 7: migration_role

**Definition :** Role temporaire pour l'execution des migrations schema DDL. Ne possede AUCUN acces aux donnees.

**Ce qu'il PEUT faire :**
- USAGE + CREATE sur le schema public exclusivement.
- Executer des scripts DDL (CREATE TABLE, ALTER TABLE, CREATE INDEX, etc.).

**Ce qu'il NE PEUT PAS faire :**
- AUCUN acces SELECT, INSERT, UPDATE, DELETE sur aucune table de donnees.
- AUCUNE politique RLS ne s'applique car ce role opere au niveau schema.
- Acceder a QUOI QUE CE SOIT de la donnee metier.

**Type de session :** Strictement temporisee. Active uniquement pendant la fenetre de migration planifiée. Inactive apres completion.

#### Role 8: readonly

**Definition :** Acces en lecture seule a toutes les donnees de l'organisation pour l'audit et le reporting.

**Ce qu'il PEUT faire :**
- Lecture (SELECT) sur TOUTES les tables du tenant courant.
- Utilisation des endpoints de rapport en lecture.
- Interrogation des donnees d'audit (audit:read).

**Ce qu'il NE PEUT PAS faire :**
- AUCUNE operation CREATE, UPDATE, ou DELETE. Jamais.
- Pas d'acces aux credentials (table credentials bloqueée).
- Pas d'acces aux org_settings.

**Type de session :** Courte (max 4h).

#### Role 9: sync_service

**Definition :** Service de synchronisation offline-first. Acces specialisé aux tables de synchronisation et aux donnees qui necessitent la synchronisation.

**Ce qu'il PEUT faire :**
- CRUD sur les tables pending_operations et sync_statuses.
- CRUD sur les tables de donnees sincronisables : transactions, members, events, archives.
- Check de connectivite et get de statut de synchronisation.

**Ce qu'il NE PEUT PAS faire :**
- Accéder aux donnees de credentials ou sessions.
- Accéder aux org_settings.
- Gerer les users, roles, ou permissions.
- Accéder aux workflow, forms, notifications, vocabulary.
- Accéder aux audit_entries (sauf lecture pour superadmin/admin uniquement).

**Type de session :** Longue (max 24h). Scheduler-managee.

---

## SECTION 2: NAMING CONVENTION DES PERMISSIONS

### 2.1 Pattern Standard

Le pattern standard de nommage des permissions est :

```
{resource}:{action}[:scope]
```

Ou chaque composant :
- **resource** : type de ressource cible (transaction, member, user, organization, config, etc.)
- **action** : action sur la ressource (create, read, update, delete, approve, reject, revoke, reset, trigger, cancel, export, generate, calculate, schedule, list, search, validate, assign, manage, read, status)
- **scope** (optionnel) : perimetre d'application (org, instance, self, any)

### 2.2 Liste Completa des Permissions

Voici l'ensemble des permissions utilisees a travers tous les aggregates :

**IdentityAggregate :**
| Permission | Description |
|-----------|-------------|
| user:create | Creer un nouvel utilisateur |
| user:update:self | Mettre a jour son propre profil |
| user:update:any | Mettre a jour un utilisateur arbitraire |
| user:role:change | Changer le role d'un utilisateur |
| password:reset:self | Reinitialiser son propre credential |
| password:reset:any | Reinitialiser le credential d'un utilisateur arbitraire |
| auth:login | S'authentifier (system action, pas de permission) |
| auth:logout:self | Se deconnecter soi-meme |
| auth:logout:any | Deconnecter un utilisateur arbitraire |
| auth:refresh | Rafraichir son jeton d'acces |
| session:revoke:self | Revoquer sa propre session |
| session:revoke:any | Revoquer une session arbitraire |
| permission:assign | Assigner une permission (superadmin uniquement) |

**ResourceAggregate :**
| Permission | Description |
|-----------|-------------|
| transaction:create | Creer une transaction financiere |
| transaction:update:draft | Mettre a jour une transaction brouillon |
| transaction:submit | Soumettre une transaction pour approbation |
| transaction:approve | Approuver une transaction |
| transaction:reject | Rejeter une transaction |
| transaction:read | Lire les transactions |
| member:create | Creer un membre |
| member:update | Mettre a jour un membre |
| member:status:transition | Changer le statut d'un membre |
| member:read | Lire les membres |
| event:create | Creer un evenement |
| event:update | Mettre a jour un evenement |
| event:read | Lire les evenements |
| categories:create | Creer une categorie |
| categories:update | Mettre a jour une categorie |
| categories:read | Lire les categories |
| export | Exporter les resources |

**RelationshipAggregate :**
| permission | Description |
|-----------|-------------|
| membership:manage | Gerer les memberships (ajouter/retirer membre de groupe) |
| membership:read | Lire les memberships |
| org_unit:create | Creer une unite organisationnelle |
| org_unit:reparent | Changer le parent d'une unite organisationnelle |
| org_unit:read | Lire les org_units |
| organization:create | Creer une organisation |
| organization:transfer | Transférer une organisation enfant |
| organization:merge | Fusionner des organisations |
| organization:archive | Archiver une organisation |
| organization:suspend | Suspendre une organisation |
| organization:read:org | Lire le profil organisationnel |
| organization_unit:read | Lire les descendants d'unités |

**WorkflowAggregate :**
| Permission | Description |
|-----------|-------------|
| workflow:trigger | Detenclencher un workflow |
| workflow:approve | Approuver une étape de workflow |
| workflow:reject | Rejeter une étape de workflow |
| workflow:cancel | Annuler un workflow |
| workflow:resubmit | Resoumettre un workflow rejete |
| workflow:read | Lire les workflows (pending approvals inclus) |

**FormAggregate :**
| Permission | Description |
|-----------|-------------|
| form:read | Lire les definitions de formulaire |
| form:validate | Valider les donnees de formulaire |
| form:render | Rendre le formulaire |
| form:visible_if | Lire les conditions de visibilité des champs |

**NotificationAggregate :**
| Permission | Description |
|-----------|-------------|
| notification:send | Envoyer une notification |
| notification:read:self | Lire ses propres notifications |
| notification:pref:self | Modifier ses preferences de notification |
| notification:pref:any | Modifier les preferences d'un utilisateur arbitraire |
| notification:ratelimit | Configurer les limites de rate |
| notification:suppress | Supprimer temporairement des notifications |
| notification:read | Lire les notifications |

**VocabularyAggregate :**
| Permission | Description |
|-----------|-------------|
| vocabulary:manage | Gerer le vocabulaire (ajouter/modifier/deprecater termes) |
| vocabulary:read | Lire le vocabulaire |

**ReportingAggregate :**
| Permission | Description |
|-----------|-------------|
| reporting:generate | Generer un rapport |
| reporting:calculate | Calculer un bilan |
| reporting:export | Exporter un rapport |
| reporting:read | Lire les types de rapports |

**AuditAggregate :**
| Permission | Description |
|-----------|-------------|
| audit:log | Logger une action (SYSTEM ONLY — non callable user) |
| audit:read | Interroger les logs d'audit |
| audit:export | Exporter le trail d'audit |

**LifecycleAggregate :**
| Permission | Description |
|-----------|-------------|
| lifecycle:archive | Archiver une resource |
| lifecycle:trash | Mettre une resource a la corbeille |
| lifecycle:purge | Purger une resource (SYSTEM ONLY) |
| lifecycle:restore | Restaurer depuis la corbeille |
| lifecycle:tag | Appliquer des tags |
| lifecycle:schedule | Planifier la purge |
| lifecycle:read | Lire les archives |

**ConfigurationAggregate :**
| Permission | Description |
|-----------|-------------|
| config:update | Mettre a jour les parametres de configuration |
| config:reset | Reinitialiser aux valeurs par defaut |
| config:read | Lire les parametres de configuration |

**OfflineSyncAggregate :**
| Permission | Description |
|-----------|-------------|
| sync:push | Pousser les operations en attente (SYSTEM auto) |
| sync:pull | Tirer les changements distants (SYSTEM auto) |
| sync:resolve | Resoudre un conflit de synchronisation |
| sync:confirm | Marquer une operation comme confirmee (SYSTEM auto) |
| sync:status | Verifier le statut de synchronisation |

---

## SECTION 3: FLUX D'AUTORISATION

Chaque requete entrante suit ce processus sequence d'evaluation d'autorisation :

```
Etape 1: Requete arrive a la couche API
         ↓
Etape 2: Validation du token/credential (Authentication, SEC-SPEC-002)
         → Echec → E-401-001 NOT_AUTHENTICATED
         ↓ Reussi
Etape 3: Resolution du contexte tenant (org_id depuis la session via CRT-015)
         → Echec → E-403-002 ORGANIZATION_MISMATCH
         ↓ Resolu
Etape 4: Authentification de l'acteur et determination de son role RBAC
         ← Token decodé → role extrait → role mapping vers API-CONTRACT-004
         ↓ Role determine
Etape 5: Verification de la permission contre l'operation demandée
         ← {resource}:{action} checké contre la matrice RBAC (Section 4)
         ↓ Permission verifiée
Etape 6: Si autorise → passe au Application Service
         → L'operation est executee dans le contexte org_id resolu
         ↓
Etape 7: Verification des invariants du domaine (DOC-015)
         → Echec → E-422 INVARIANT_VIOLATED
         ↓ Invariants passes
Etape 8: Execution de l'operation → reponse retournee
```

### Regles de Flux

1. **Authorization Before Domain :** La verification RBAC se fait AVANT tout appel au domain layer. C'est un guard au niveau Application Service.
2. **org_id Injection :** Le org_id resolue a l'etape 3 est injecte dans le contexte de la requete et presente a TOUTES les operations suivantes. Il n'est JAMAIS accepte comme entrée brute.
3. **Fail Secure :** Si l'evaluateur de permission rencontre une erreur (permission non definie, role inconnu, mapping introuvable), la decision par defaut est DENY → E-403-001 INSUFFICIENT_PERMISSION.
4. **Cross-Aggregate Guards :** Certaines operations requierent des permissions sur plusieurs aggregates simultanément (ex: approbation de transaction verifie WorkflowAggregate ET ResourceAggregate). Voir Section 5.

---

## SECTION 4: MATRICE COMPLETE RBAC

Legende : T = Accès complet (Create, Read, Update, Delete), R = Lecture seule, N = Non autorisé, A = Accès conditionnel (selon contexte operation)

### 4.1 OrganizationAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| organization:create | T | N | N | N | N | N | N | N | N |
| organization:read:org | T | R | R | R | R | R | N | R | N |
| organization:transfer | T | N | N | N | N | N | N | N | N |
| organization:merge | T | N | N | N | N | N | N | N | N |
| organization:archive | T | N | N | N | N | N | N | N | N |
| organization:suspend | T | N | N | N | N | N | N | N | N |
| organization_unit:create | T | T | N | N | N | N | N | N | N |
| organization_unit:read | T | T | R | R | R | R | N | R | N |
| organization_unit:reparent | T | N | N | N | N | N | N | N | N |
| org_settings:read | T | R | R | R | R | R | N | R | N |
| org_settings:update | T | T | N | N | N | N | N | N | N |

### 4.2 IdentityAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| user:create | T | T | N | N | N | N | N | N | N |
| user:update:self | T | A | A | A | A | N | N | N | N |
| user:update:any | T | T | N | N | N | N | N | N | N |
| user:role:change | T | N | N | N | N | N | N | N | N |
| password:reset:self | T | A | A | A | A | N | N | N | N |
| password:reset:any | T | T | N | N | N | N | N | N | N |
| session:revoke:any | T | N | N | N | N | N | N | N | N |
| credentials:read | T | T | N | N | N | N | N | N | N |
| sessions:read | T | T | N | N | N | A | N | A | N |

### 4.3 ResourceAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| transaction:create | T | T | T | N | N | A | N | N | A |
| transaction:update:draft | T | T | T | N | N | A | N | N | A |
| transaction:submit | T | T | T | A | N | A | N | N | A |
| transaction:approve | T | T | T | N | N | N | N | N | N |
| transaction:reject | T | T | N | N | N | N | N | N | N |
| transaction:read | T | T | T | R | R | R | N | R | A |
| member:create | T | T | N | N | N | N | N | N | N |
| member:update | T | T | N | N | N | N | N | N | N |
| member:status:transition | T | T | N | N | N | N | N | N | N |
| member:read | T | T | R | R | R | R | N | R | A |
| event:create | T | T | N | A | N | A | N | N | A |
| event:update | T | T | N | A | N | A | N | N | A |
| event:read | T | T | R | R | R | R | N | R | A |
| categories:create | T | T | A | A | N | A | N | N | N |
| categories:update | T | T | A | A | N | A | N | N | N |
| categories:read | T | T | R | R | R | R | N | R | N |
| export | T | T | T | N | N | N | N | N | N |

### 4.4 RelationshipAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| membership:manage | T | T | N | N | N | N | N | N | N |
| membership:read | T | T | R | R | R | R | N | R | N |
| org_unit_links:read | T | T | R | R | R | A | N | R | N |
| org_unit_links:write | T | T | N | N | N | A | N | N | N |

### 4.5 WorkflowAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| workflow:trigger | T | A | N | N | N | N | N | N | N |
| workflow:approve | T | A | N | A | N | N | N | N | N |
| workflow:reject | T | A | N | A | N | N | N | N | N |
| workflow:cancel | T | A | N | A | N | N | N | N | N |
| workflow:resubmit | T | A | N | A | N | N | N | N | N |
| workflow:read | T | T | R | R | R | R | N | R | R |

### 4.6 FormAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| form:read | T | T | R | A | A | A | N | A | N |
| form:validate | T | T | A | A | A | A | N | A | N |
| form:render | T | T | A | A | A | A | N | A | N |
| form:visible_if | T | T | R | R | R | R | N | R | N |

### 4.7 NotificationAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| notification:send | T | A | N | N | N | N | N | N | N |
| notification:read | T | T | R | R | R | A | N | R | N |
| notification:pref:self | T | A | A | A | A | N | N | N | N |
| notification:pref:any | T | T | N | N | N | N | N | N | N |
| notification:ratelimit | T | T | N | N | N | N | N | N | N |
| notification:suppress | T | T | N | N | N | N | N | N | N |

### 4.8 VocabularyAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| vocabulary:manage | T | T | A | A | N | A | N | A | N |
| vocabulary:read | T | T | T | T | R | T | N | T | N |

### 4.9 ReportingAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| reporting:generate | T | T | T | N | N | N | N | N | N |
| reporting:calculate | T | T | T | N | N | N | N | N | N |
| reporting:export | T | T | T | N | N | N | N | N | N |
| reporting:read | T | T | A | A | A | A | N | A | N |

### 4.10 AuditAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| audit:log | SYSTEM | SYSTEM | N | N | N | N | N | N | N |
| audit:read | T | T | R | R | R | R | N | R | N |
| audit:export | T | T | N | N | N | N | N | N | N |

### 4.11 LifecycleAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| lifecycle:archive | T | T | N | N | N | N | N | N | N |
| lifecycle:trash | T | T | N | N | N | N | N | N | N |
| lifecycle:purge | SYSTEM | SYSTEM | N | N | N | N | N | N | N |
| lifecycle:restore | T | T | N | N | N | N | N | N | N |
| lifecycle:tag | T | T | N | N | N | N | N | N | N |
| lifecycle:schedule | T | T | N | N | N | N | N | N | N |
| lifecycle:read | T | T | R | R | R | A | N | R | N |

### 4.12 ConfigurationAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| config:update | T | T | N | N | N | N | N | N | N |
| config:reset | T | T | N | N | N | N | N | N | N |
| config:read | T | T | R | R | R | A | N | R | N |

### 4.13 OfflineSyncAggregate

| Permission | superadmin | admin | treasurer | pastor | staff | service_account | migration_role | readonly | sync_service |
|-----------|------------|-------|-----------|--------|-------|----------------|---------------|----------|-------------|
| sync:push | SYSTEM | SYSTEM | N | N | N | N | N | N | N |
| sync:pull | SYSTEM | SYSTEM | N | N | N | N | N | N | N |
| sync:resolve | SYSTEM | A | N | N | N | N | N | N | N |
| sync:confirm | SYSTEM | SYSTEM | N | N | N | N | N | N | N |
| sync:status | T | T | R | R | R | A | N | R | A |

---

## SECTION 5: PERMISSIONS CROSS-AGGREGATE

Certaines operations impliquent des restrictions croisées entre aggregates. Voici les regles :

### 5.1 Regle de L'Auteur Ne Peut Pas etre Approveur

Dans le WorkflowAggregate, l'utilisateur qui a initie une requete (creator) ne peut PAS approuver sa propre requete. Cette verification se fait dans le WorkflowExecutor :

```
creator_id != approver_id  →  sinon E-409 CONFLICTING_ROLES
```

### 5.2 Regle de Transact Approved Immutable (FIN-001)

Une fois qu'une transaction est marquee comme approvee dans ResourceAggregate, elle ne peut plus etre modifiée ni supprimée, meme par un admin. Seule une transaction de compensation (compensates_for) peut etre creee.

### 5.3 Regle de SuperAdmin et Invariants

Meme si le superadmin a wildcard `*:*:*`, les invariants du domaine (DOC-015) s'appliquent universellement. Un superadmin ne peut pas :
- Viol FIN-001 : modifier une transaction approved.
- Viol FIN-002 : creer une transaction avec montant ≤ 0.
- Viol AUD-001 : supprimer une entry d'audit.
- Viol LIF-003 : restaurer un objet purge.

### 5.4 Regle de Migration Non-Acces Donnees

Le migration_role n'a AUCUNE permission sur AUCUNE table de donnees. Son champ d'action est strictement limite au schema DDL. Apres la migration, le role est desactive.

### 5.5 Regle de Service Account sans Credentials

La service_account peut acceder aux users et sessions mais PAS a la table credentials. Elle ne peut ni lire ni modifier les hashes de mots de passe.

---

## SECTION 6: EVALUATION DYNAMIQUE DES PERMISSIONS

### 6.1 Permissions Contextuelles

Certaines permissions sont动态 évaluees selon le contexte de l'operation :

| Contexte | Condition Dynamique | Effet sur Permission |
|----------|-------------------|--------------------|
| Draft Transaction Update | L'acteur doit etre admin OU creator du draft | Admin toujours permet; creator permet uniquement pour ses propres drafts |
| Transaction Submit | Tout role avec write sur transaction | admin, treasurer, pastor peuvent soumettre |
| Workflow Approve | L'acteur doit etre assigné a cette étape | L'acteur recu dans le token est compare a l'assignee du step |
| Member Status Transition | L'acteur doit etre admin ET le statut doit être valide | STATUS-010 invariant appliqué avant authorization |
| Self-Update | L'acteur met a jour son propre profil | user:update:self seulement si actor_id == target_user_id |

### 6.2 Evaluation au Cycle de Vie de l'Operation

```
Precondition (API Layer) → Authorization Check (Service Layer) → Domain Guard (Aggregate Layer) → Persistence (Repository)
```

Chaque couche effectue son evaluation independamment :
1. **API Layer** : le token est decode → role est extrait → permission brute est identifiée.
2. **Service Layer** : l'org_id est resolue → la permission est comparee a la matrice RBAC → decision OK/REFUSE.
3. **Domain Layer** : les invariants du domaine sont verifies → si violation → l'operation echoue meme si autorisee RBAC.
4. **Persistence Layer** : RLS policies filtrent les lignes par org_id → isolation guarantee.

### 6.3 Fail-Safe par Defaut

Toute decision d'autorisation ou toute erreur d'evaluation de permission retourne DENY par defaut :

- Permission non definie → DENY.
- Role non reconnu → DENY.
- Erreur interne de l'evaluateur → DENY.
- org_id manquant → DENY (E-403-002).
- Token expire → DENY (E-401-002).

Le message retourne est toujours generique : `E-403-001 INSUFFICIENT_PERMISSION` — il ne revele ni la hierarchie des roles, ni les permissions disponibles, ni la liste des resources accessibles.

---

## SECTION 7: JOURNALISATION D'AUTORISATION

### 7.1 Entries d'Audit d'Authorization

Toutes les decisions d'autorisation sont journalisees dans AuditAggregate :

| Evenement | Informations Capturees |
|-----------|----------------------|
| Permission VERIFIEE (succes) | {user_id, org_id, resource, action, timestamp, result: ALLOWED} |
| Permission REFUSEE | {user_id, org_id, resource, action, timestamp, result: DENIED, reason_code} |
| Role CHANGE | {target_user_id, new_role, changed_by, timestamp, org_id} |
| Session REVOQUEE | {session_id, revoked_by, reason, timestamp} |
| Bypass RLS (superadmin) | {user_id, org_id, timestamp, operation, reason} |

### 7.2 Regles de Journalisation

- Toute decision DENIE pour une operation critique (user:role:change, permission:assign, organization:suspend, organization:merge) est forcement journalisee avec detail completer.
- Les tentatives de bypass RBAC (tentative d'acces a une resource sans permission) sont particulieurement scrutees.
- Les operations superadmin avec wildcard `*:*:*` sont explicitement marquees et prioritees dans l'audit.
- Les entries d'authorization audit ne contiennent JAMAIS de credentials, tokens, ou hashes en clair.

---

## SECTION 8: REGLES NON NEGOCIABLES D'AUTORISATION

| Regle | Description | Source |
|-------|-------------|--------|
| SN-AUTHZ-001 | Une operation sans permission explicite est automatiquement refusee | P-SEC-002 |
| SN-AUTHZ-002 | org_id est TOUJOURS resolu depuis la session, JAMAIS depuis un parametre HTTP | SN-001, SEC-SPEC-001 |
| SN-AUTHZ-003 | Le deny by default s'applique a toute decision d'autorisation incertaine | P-SEC-006 |
| SN-AUTHZ-004 | Les invariants du domaine s'appliquent a TOUS les roles, y compris superadmin | DOC-015 |
| SN-AUTHZ-005 | L'erreur RBAC retournee est generique — aucune information meta revelée | P-SEC-006 |
| SN-AUTHZ-006 | AuditAggregate ne s'audite PAS lui-meme (NB-PERSIST-007) | SN-006 |
| SN-AUTHZ-007 | Le migration_role n'a AUCUNE permission RLS | RLS-POLICY-SPECIFICATION-V1 |
| SN-AUTHZ-008 | La regle auteur != approveur s'applique a toutes les approbations | API-CONTRACT-004 WF-005 |
| SN-AUTHZ-009 | Les operations critiqes superadmin sont particulierement auditees | SEC-SPEC-001 Actor Model |
| SN-AUTHZ-010 | Le bypass RLS superadmin est configure cote APPLICATION uniquement | RLS-POLICY-SPECIFICATION-V1 M-004 |

---

## SECTION 9: MATRICE DE TRACABILITE

| Section SEC-SPEC-003 | Source Canonique(s) | Reference |
|---------------------|--------------------|-----------|
| RBAC Hierarchy (9 roles) | API-CONTRACT-004, RLS-POLICY-SPECIFICATION-V1 | All 9 roles with permissions |
| Permission Naming Convention | API-CONTRACT-004 §Permission Grant Format | resource:action pattern |
| Authorization Flow | SEC-SPEC-001 §2, Layers 1-8 | 8-layer security pipeline |
| RBAC Matrix (complete) | API-CONTRACT-004 per aggregate | 13 aggregates × 9 roles |
| Cross-Aggregate Permissions | API-CONTRACT-004, DOC-015 | Cross-aggregate rules |
| Dynamic Permission Evaluation | API-CONTRACT-004 precondition chains | Context-dependent permissions |
| Authorization Logging | DOC-015 AUD-001, OLDNEW-002 | All auth decisions captured |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | security-specifier v1.0 | Creation — Authorization Rules pour Lumina v1 | COMPLIANT (trace verify contre API-CONTRACT-004, SEC-SPEC-001, DOC-015, RLS-POLICY-SPECIFICATION-V1) |

---

*Ce document operationalise les regles d'autorisation derivees du modele de securite de SEC-SPEC-001. Il complete SEC-SPEC-002 (Authentication) et est croise avec SEC-SPEC-006 (Audit & Compliance).*
