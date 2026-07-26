# Security Model — Lumina v1

**Doc ID:** SEC-SPEC-001
**Version:** v1.0
**Statut:** SPECIFICATION SECURITE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-004", "DOC-015", "DOC-023", "RTS-001", "RLS-POLICY-SPECIFICATION-V1", "ASS-001"]
**Transformation_rule :** "security-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document etablit le modele de securite abstrait fondamental de Lumina. Il definit les principes, couches, acteurs, classifications de donnees et zones logiques sans specifier d'algorithme, protocole ou technologie concrete. Chaque section est traceable vers un document canonique source.

**Regle constitutionnelle :** Tout acces a une donnee modifiable doit etre autentifie, autorise, audite, et isole par tenant. Aucune exception.

---

## SECTION 1: PRINCIPES DE SECURITE

L'architecture de securite de Lumina repose sur sept principes fonda-mentaux. Chacun est contraignant, non-negociable, et valideable automatiquement ou structurellement.

### P-SEC-001: Defense in Depth — Securite a Chaque Couche

La securite n'est pas assuree par une seule barriere mais par plusieurs couches independentes qui se renforcent mutuellement. Chaque couche doit pouvoir detecter et bloquer une violation que les couches superieures auraient laisse passer.

| Couche | Mecanisme de Protection | Responsable Canonique | Seuil de Reponse |
|--------|------------------------|----------------------|------------------|
| Perimeter (API) | Validation du jeton d'authentification, validation du schema de requete | IdentityAggregate per ASS-001 §2 | Bloquer et retourner E-401/E-400 |
| Boundary (Application Service) | Resolution du contexte locataire, verification RBAC | TenantContextProvider (CRT-015) per RTS-001 | E-403-002 ORGANIZATION_MISMATCH |
| Domain (Aggregate) | Application des invariants metier (regles business irreversibles) | Tous les Aggregates per DOC-015 | E-422 INVARIANT_VIOLATED |
| Persistence | Politiques de niveau ligne (Row Level Security), contraintes integrite | RLS Policies per RLS-POLICY-SPECIFICATION-V1 | Echec requisition, pas de fuite inter-tenant |
| Storage | Chiffrement au repos des donnees sensibles | CryptographicPort per RTS-001 Composant 1 | Protection passive au repos |
| Transit | Chiffrement bout-en-bout de toutes les communications | TransportPort | Echec de negociation = deconnexion |

Les couches sont independantes : la faillite d'une couche ne signifie pas la faillite du systeme. Par exemple, si l'AuthorizationPort ne detecte pas une violation RBAC, la politique RLS au niveau persistence doit encore empecher l'acces aux donnees d'un autre tenant.

### P-SEC-002: Least Privilege — Minimalisation des Permissions

Chaque acteur (utilisateur, service, role) ne recoit QUE le strict necessaire pour accomplir sa fonction autorisee. Aucun role ne beneficiait de permissions inheritees au-dela de ce qui est explicitement declare dans la matrice RBAC (API-CONTRACT-004).

**Regles derivees :**

1. Un utilisateur ne peut acceder qu'aux donnees de son organisation (`_org_id` resolve depuis sa session, jamais depuis un parametre HTTP).
2. Un role operateur ne peut executer QUE les operations explicitement autorisees. L'interdiction est la valeur par defaut.
3. Les roles de service (service_account, sync_service, migration_role) ont un champ d'action limite a leur domaine functionalDeclare.
4. Le role migration_role n'a aucun acces RLS (travaille uniquement au niveau schema, pas donnees).
5. La lecture des donnees d'identification (credentials) est restreinte aux seuls superadmin et admin — les roles treasurer, pastor, staff, readonly, et sync_service n'ont aucun acces.

### P-SEC-003: Zero Trust by Default — Toute connexion est Non-Fiable par Defaut

Toute entite externe a la zone de confiance du domaine est traitee comme non fiable par defaut. La configuration de zero trust s'applique a chaque perimetre :

1. **Toutes les requetes API doivent presenter des identifiants valides.** Aucune exception pour les endpoints "publics" — meme les operations de decouverte requierent l'authentification.
2. **Tout parametre fourni par l'appelant doit etre valide.** L'org_id n'est jamais accepte comme valeur brute venant de l'utilisateur ; il est toujours resolue depuis le contexte d'authentification (RTS-001 CRT-015).
3. **Tous les services enregistres doivent etre verifies avant usage.** Les adapters port->bound au composition root sont selectionnes une fois au demarrage et ne changent pas dynamiquement (RTS-001 RN-004).
4. **L'echec doit etre safe.** En cas d'erreur imprevue, le systeme retourne le minimum d'information au client (E-500-001 UNEXPECTED_ERROR avec message generique).

### P-SEC-004: Audit All Actions — toute modification est Tracee

Toute operation d'ecriture sur des donnees persistables est capturee avec une entree d'audit immuable (OLDNEW-002 : old_values ET new_values toujours presents). L'audit est un effet lateral automatique, pas une option.

**Portee :**

- Toutes les operations CRUD sur les aggregates suivants : Organization, Identity, Resource, Relationship, Workflow, Form, Notification, Vocabulary, Reporting, Lifecycle, Configuration, OfflineSync.
- Les operations de lecture sont ecrites uniquement lorsqu'elles concernent des donnees sensibles (credentials, sessions).
- AuditAggregate ne s'audite PAS lui-meme (NB-PERSIST-007, RTS-001 CRT-014). C'est une protection anti-recursion infinie.

Le mecanisme AuditEnabler (CRT-014) intercepte toute operation d'ecriture au niveau Application Service, capture les valeurs before/after, et appelle AuditPort.log() de maniere non-bloquante. Si AuditPort est indisponible, l'operation domaine continue — l'echec d'audit N'EST PAS une raison de rollback l'operation.

### P-SEC-005: Encrypt at Rest and in Transit — Protection des Donnees Sensibles

Toutes les donnees sensibles de Lumina doivent etre protegees :

1. **En transit** : toutes les communications entre client et serveur, entre services, et entre composants internes traversant un perimetre non fiable utilisent un canal chiffre bout-en-bout.
2. **Au repos** : les donnees classees CONFIDENTIEL et RESTRICTED (voir Section 4) doivent etechiffrees sur le support de stockage.
3. **Les passwords** : uses un hachage computationnel irreversible avec sel unique. Ils ne sont JAMAIS stockes en clair, JAMAIS retournes dans une reponse, JAMAIS presentes dans les diagnostics (BR-ID-001 per RTS-001 CRT-008).

Un algorithme de chiffrement est un detail d'implementation — cette specification definit UNIQUEMENT QUOI proteger, pas COMMENT proteger.

### P-SEC-006: Fail Securely — L'Echec Retourne le Minimum

Dans toute decision de securite, le comportement par defaut en cas d'incertitude ou d'erreur est de REFUSER l'acces plutot que de l'accorder.

**Principe :** "Deny by default" s'applique a :

- Authorization : si une permission n'est pas explicitement accordee → refus.
- Authentication : si un credential ne peut pas etre verifie → refus.
- Session management : si une session ne peut pas etre validee → refus.
- Tenant context resolution : si org_id ne peut pas etre resolu → 401 Unauthorized.

**Exemple concret de regle :** Lorsqu'un utilisateur tente d'executer une operation pour laquelle il n'a pas de permission explicite, le systeme retourne E-403-001 INSUFFICIENT_PERMISSION. Il ne revele ni les permissions disponibles, ni la hierarchie des roles, ni aucun renseignement meta sur le modele d'autorisation.

### P-SEC-007: Tenant Isolation Immutable — L'Isolement Multi-Tenant ne Peut Jamais etre Contourne

L'isolement multi-tenant est la regle de securite la plus fondamentale de Lumina. Elle est garantie a quatre niveaux :

| Niveau | Garanti par | Regle | Document Source |
|--------|-------------|-------|-----------------|
| Application | TenantContextProvider (CRT-015) | org_id resolu depuis la session uniquement, jamais depuis un parametre HTTP | RTS-001 §15 |
| Domaine | Invariant INV-004 | Toute operation inclut implicitement le scope org_id | DOC-015 |
| Persistance | Tous les RepositoryPort | Chaque requete inclut org_id comme filtre obligatoire | PAS-003 DR-009 |
| Base de donnees | RLS policies (une par table) | `org_id = current_setting('request.org_id')::uuid` | RLS-POLICY-SPECIFICATION-V1 |

**Rules derives :**

- NB-MT-001 : Aucun objet physique ne peut exister sans `_org_id` valide (DOC-023).
- NB-MT-002 : Aucune requete physique ne peut s'executer sans filtre par `_org_id` (DOC-023).
- NB-MT-003 : Aucune jointure physique ne peut relier des objets de `_org_id` differents (DOC-023).
- NB-MT-004 : L'_org_id d'un objet ne peut jamais etre modifie apres creation (DOC-023).

Le superadmin bypass RLS via une configuration de session (`lumina.bypass_rls`) au niveau application uniquement. Aucun privilege systemique PostgreSQL n'est accorde. Le role lumina_migration_role n'a ABSOLUMENT aucune politique RLS (travaille uniquement au niveau schema DDL).

---

## SECTION 2: CARTE DES COUCHES DE SECURITE

Cette carte definit quelle couche de l'architecture est responsable de quelle mechanisme de securite, et comment ils s'enchainent.

| # | Couche | Mecanisme Principal | Compose Responsabilite | Verifie Par | Invariant Cible | Erreur Retournée |
|---|--------|--------------------|----------------------|-------------|-----------------|-----------------|
| 1 | API Layer — Authentication | Validation du token/credential present dans la requete entrante | IdentityAggregate (Authentication Port) | ASS-001 IdentityService.LoginUser | INV-004, INV-008 | E-401-001 NOT_AUTHENTICATED |
| 2 | API Layer — Authorization | Verification RBAC : l'acteur a-t-il la permission `{resource}:{action}` ? | AuthorizationPort mappee vers API-CONTRACT-004 | API-CONTRACT-004 mapping table | — | E-403-001 INSUFFICIENT_PERMISSION |
| 3 | Application Service — Tenant Context | Resolution de org_id depuis la session authentifiee et injection via TenantContextProvider | CRT-015 TenantContextProvider | RTS-001 §15 | INV-004 | E-403-002 ORGANIZATION_MISMATCH |
| 4 | Application Service — Precondition | Validation des preconditions avant appel Aggregate | Chaque App Service (ASS-001) | DOC-015 invariant list | Multiple selon operation | E-400 series / E-422 series |
| 5 | Domain Layer — Invariant Enforcement | Verification des regles metier absolues (immutable, positive amount, no future date, etc.) | Chacun des 13 Aggregates | DOC-015 DOMAIN-INVARIANT-REGISTRY | DOC-015 invariants | E-422-001 INVARIANT_VIOLATED |
| 6 | Domain Layer — State Machine | Validation des transitions d'etat autorisees | LifecycleAggregate (LIF-003) | DOC-015 + DOC-012 §2.11 | LIF-003 | E-409-003 INVALID_TRANSITION |
| 7 | Persistence — RLS | Filtrage automatique de toutes les requetes SQL par org_id via politiques RLS | Toutes les 32 tables | RLS-POLICY-SPECIFICATION-V1 §3 | NB-MT-001..004 | Echec DB direct (ligne non trouvee) |
| 8 | Persistence — Audit Capture | Enregistrement avant/apres de toute operation d'ecriture | AuditEnabler (CRT-014) + AuditPort | RTS-001 §14, DOC-015 AUD-001/OLDNEW-002 | AUD-001, OLDNEW-002 | E-422-001-AUD-OLDNEW-002 |
| 9 | Persistence — Immutability Guarantee | Prevention structurelle de la modification/suppression des entries d'audit | AuditAggregate (append-only pattern) | DOC-015 AUD-001, DOC-023 NB-PERSIST-006 | AUD-001 | E-422-001-AUD-001 |
| 10 | Data Storage — Encryption at Rest | Protection des donnees confidentielles sur disque | CryptographicPort (adapter selectionne au runtime) | SPEC-004 SEC-SPEC-004 | — | — |
| 11 | Data Transit — Transport Encryption | Chiffrement de toutes les communications exterieures | TransportPort (adapter selectionne au runtime) | SPEC-004 SEC-SPEC-004 | — | — |

### Flux de Securite d'une Requête Typique

```
Requete Entrante (HTTP/gRPC/...)
    |
    v
[1] API Layer — Token/Credential Validation (IdentityAggregate)
    → Echec : E-401-001 NOT_AUTHENTICATED
    |
    v
[2] API Layer — RBAC Permission Check (AuthorizationPort)
    → Echec : E-403-001 INSUFFICIENT_PERMISSION
    |
    v
[3] TenantContextProvider — org_id Resolution from Session (CRT-015)
    → Echec : E-403-002 ORGANIZATION_MISMATCH
    |
    v
[4] Application Service — Preconditions Validation (ASS-001 ops)
    → Echec : E-400 series ou E-422 series
    |
    v
[5] Domain Aggregate — Invariant Enforcement (DOC-015)
    → Echec : E-422-001 INVARIANT_VIOLATED (+ invariant code)
    |
    v
[6] Transaction Commit (TransactionCoordinator CRT-003)
    |
    v
[7] AuditEnabler — Before/After Capture (CRT-014)
    → Non-blocking : echec continue l'operation
    |
    v
[8] RLS Policy Enforcement at Database Layer (RLS Spec)
    → echec structurel : lignes d'autres tenants invisibles
    |
    v
Reponse Retournee au Client
```

Chaque echec a un code d'erreur canonique defini dans API-CONTRACT-005. Aucun message d'erreur technique n'est expose au client final.

---

## SECTION 3: MODELE DE SECURITE DES ACTEURS

Cinq types d'acteurs interagissent avec Lumina. Chacun a un profil de securite distinct defini par quatre dimensions : authentification, perimetre d'autorisation, duree de session, et niveau d'audit.

### Acteur 1: Utilisateur Standard (User)

**Perimetres RBAC :** admin, treasurer, pastor, staff, readonly (selon assignation par SuperAdmin ou Admin).

| Dimension | Specification |
|-----------|---------------|
| Methode d'authentification | Credentials (email + secret), verifies par IdentityAggregate (UC-ID-02 LoginUser per ASS-001 §2) |
| Perimetre d'autorisation | Strictement scode a UNE organisation (_org_id resolu depuis sa session). Ne peut pas acceder aux donnees d'une autre organisation sous aucun pretexte. |
| Duree de session | Configuree, expirable, revoquable. Refresh possible par self-service. Revocation possible par SuperAdmin (UC-ID-03, UC-ID-08). |
| Niveau d'audit | Toutes ses operations d'ecriture sont capturees dans AuditAggregate (userId, orgId, entityType, entityId, oldValues, newValues). |

### Acteur 2: Compte de Service (Service Account)

**Perimetre RBAC :** service_account — CRUD complet sur les donnees du tenant courant.

| Dimension | Specification |
|-----------|---------------|
| Methode d'authentification | Token de service, associe a un compte de service enregistré. Verify par IdentityAggregate via IdentityProviderPort. |
| Perimetre d'autorisation | Defini par capabilities explicites dans le token. Scope unique au tenant auquel il est lie. CRUD sur la majorite des tables (sauf credentials et org_settings). |
| Duree de session | Rotation programmatique des tokens. Pas d'expiration utilisateur — expiration geree par le cycle de vie du compte. |
| Niveau d'audit | Toutes ses operations sont entierement auditees. Les operations automatiques (sync push/pull) sont marquees comme system-initiated. |

### Acteur 3: Service de Synchronisation (Sync Service)

**Perimetre RBAC :** sync_service — acces special aux tables de synchronisation (pending_operations, sync_statuses) ainsi qu'aux donnees de resources cibles (transactions, members, events).

| Dimension | Specification |
|-----------|---------------|
| Methode d'authentification | Token de service dédié, distinct des tokens utilisateurs standard. |
| Perimetre d'autorisation | Limitée aux operations de push/pull de synchronisation. Respecte scrupuleusement SYNC-001 (local-first), SYNC-002 (batch ≤50), SYNC-003 (retry backoff). |
| Duree de session | Longue durée, rotatee par operational scheduler (CRT-009). |
| Niveau d'audit | Operations synchronisation journalisees via workflow_logs, pending_operations status. Données utilisateur normales non modifiees directement par le sync. |

### Acteur 4: Role de Migration (Migration Role)

**Perimetre RBAC :** migration_role — acces schema-level UNIQUEMENT, zero acces donnee.

| Dimension | Specification |
|-----------|---------------|
| Methode d'authentification | Credentials de service temporaires pour execution de migrations DDL. |
| Perimetre d'autorisation | USAGE + CREATE sur schema public exclusivement. AUCUNE politique RLS appliquee car ce role agit au niveau schema, pas donnees. Désactivé après migration complète. |
| Duree de session | Temporisation stricte : active uniquement pendant la fenetre de migration planifiée. Inactive apres. |
| Niveau d'audit | Les changements schema sont logs dans les journaux de déploiement mais ne produisent pas d'entries d'audit dans AuditAggregate (changement infrastructurel, pas metier). |

### Acteur 5: Super Administrateur Système (SuperAdmin)

**Perimetre RBAC :** superadmin — permissions wildcard `*:*:*`.

| Dimension | Specification |
|-----------|---------------|
| Methode d'authentification | Credentials renforcés (MFA requis). Bypass RLS via configuration de session application (`lumina.bypass_rls = true`). NO SUPERUSER privilege at database level. |
| Perimetre d'autorisation | Global — peut creuser/administer toutes les organisations. Peutaffecter n'importe quel role, y compris superadmin. ChangeRole restriction : seul SuperAdmin peut changer le role d'un utilisateur. |
| Duree de session | Constrainede, monitoring renforce. Sessions revocables a distance par SuperAdmin (UC-ID-08). |
| Niveau d'audit | TOUT action de SuperAdmin est particulierement scrutée. Operations avec wildcard ["*"] sont explicitement auditees et autorisees (API-CONTRACT-004). |

### Matrice Resume des Acteurs

| Acteur | Auth | Scope | Expiration | Audit | RLS Bypass |
|--------|------|-------|------------|-------|------------|
| User | Credentials (email+secret) | 1 org_id unique | Configurable, refreshable | Full | Non |
| Service Account | Service token | Tenant-curved capabilities | Programmatically rotated | Full | Non |
| Sync Service | Dedicated service token | Sync tables + resource data | Scheduler-managed | Full | Non |
| Migration Role | Temporal service creds | Schema-level only (DDL) | Migration window only | Infra-only | N/A (no RLS) |
| SuperAdmin | Credentials + MFA | All orgs, global | Configurable, monitored | Full + escalated | Yes (app-level) |

---

## SECTION 4: CLASSIFICATION DES DONNEES

Toutes les donnees traitees par Lumina sont classees selon leur niveau de sensibilite. Cette classification determine les mesures de protection requises pour chaque type de donnee.

### Echelle de Classification

| Niveau | Description | Mesures Requises | Exemples dans Lumina |
|--------|-------------|------------------|---------------------|
| **PUBLIC** | Aucune restriction d'acces. Ces donnees peuvent etre lues par tous les acteurs authenticques sans restriction RBAC supplementaire. | Aucune protection speciale requise au-dela de l'authentification de base. | Nom de l'organisation, types de formulaires publies, definitions de vocabulaire publiques |
| **INTERNAL** | Donnees operationnelles scoped a une organisation. Accessibles par tout membre authentifie de l'organisation, selon leur role RBAC. | Filtre org_id obligatoire. Controle d'acces RBAC. Audit des ecritures. | Transactions financieres, membres, evenements, group_memberships, workflows, notifications, archives |
| **CONFIDENTIAL** | Donnees personnelles ou sensibles concernant des individus identifiables. | Chiffrement au repos. Logging d'acces renforce. Pas de retention superieure au necessaire. | Adresses email (unique par org), numeros de telephone, dates de naissance, preférences de notification, preference channels |
| **RESTRICTED** | Donnees d'identification et secrets critiques. Ne doivent jamais etre exposes dans les reponses API, les logs, ou les diagnostics. | Hachage computationnel irreversible pour les credentials. Transmis uniquement en transit chiffre. Jamais stockes en clair. Jamais retournes dans une reponse. Jamais presentes dans les exports ou rapports. | Hashes de mots de passe, tokens de refresh (hashes avant stockage), cles API, cles de chiffrement |
| **AUDIT-ONLY** | Registres immuables qui documentent l'historique des operations. Ne contiennent PAS de donnees sensibles en clair. | Append-only. Stockage immuable. Conservation minimale 7 ans (RETENTION-031). Auto-audit interdit (NB-PERSIST-007). | Entries audit_entries (entity_type, entity_id, action, old_values, new_values, user_id, org_id, timestamp) |

### Repartition des Tables par Classification

| Niveau | Tables concernees |
|--------|-----------------|
| PUBLIC | organizations (nom seulement), vocab_namespaces, vocab_terms, vocab_values |
| INTERNAL | organizations (settings non-confidentiels), transactions, members, events, org_units, group_memberships, org_unit_links, workflow_instances/steps/logs, forms/sections/fields, notifications, reports/snapshots, archives, purge_schedules, pending_operations, sync_statuses |
| CONFIDENTIAL | users (email, phone, date_of_birth), notification_preferences |
| RESTRICTED | credentials (password_hash), sessions (refresh_token_hash) |
| AUDIT-ONLY | audit_entries |

### Regle de Protection Croisante

Une donnee classification RESTRICTED beneficie de TOUS les protections des niveaux inferieurs (PUBLIC, INTERNAL, CONFIDENTIAL). Une donnee CONFIDENTIEL beneficie des protections INTERNAL et PUBLIC. La classification la plus haute s'applique.

---

## SECTION 5: ZONES DE SECURITE

L'application est structuree en cinq zones logiques de securite. Chaque zone a des regles d'entree et de sortie definees. Les flux de donnees entre zones sont controlestrictement.

### Zone 1: External Zone — Perimetre Non-Fiable

**Contient :** Point d'entree API, parsing des requetes HTTP/gRPC, validation initiale du schema.

**Regles :**

- Aucune donnee n'est fiable entrant de cette zone. Chaque champ doit etre validate avant propagation.
- Aucun credential ni secret n'est stocke dans cette zone.
- Les connexions entrantes sont chiffrees obligatoirement.
- Erreurs retournees sont generiques : jamais de details internes.

**Sortie unique vers :** Service Zone (couche Application Service).

### Zone 2: Service Zone — Donnees Validatees

**Contient :** Application Services (ASS-001), TenantContextProvider (CRT-015), AuthorizationPort.

**Regles :**

- Entres ici, les donnees ont ete validatees au schema (External Zone) et ont un contexte tenant resolu (CRT-015).
- Chaque operation passe par un check RBAC via API-CONTRACT-004 mapping.
- Les donnees sont preparees pour la propagation dans la Domain Zone sans altération.
- L'IdempotencyManager (CRT-013) operese dans cette zone pour prevent les doubles executions.

**Sorties vers :** Domain Zone (calls Aggregate methods) et Persistence Layer via RepositoryPort.

### Zone 3: Domain Zone — Regles Metier Absolues

**Contient :** 13 Aggregates (DOC-012), leurs invariants (DOC-015), etats et transitions.

**Regles :**

- Les invariants du domaine sont appliques ici. Toute violation = rejet immediat.
- Les aggregrats ne connaissent pas leur mecanisme de persistance.
- Les evenements emit par cette zone sont propages de maniere asynchrone via EventDispatcher (CRT-004).
- La consistency eventuelle est acceptee entre aggregats, la consistency immediate est garantie au sein d'un aggregate.

**Sortie unique vers :** Persistence Layer (RepositoryPort) + Event bus (EventDispatcher CRT-004).

### Zone 4: Data Zone — Isolement par Ligne

**Contient :** RepositoryPort adapters, RLS policies, persistence layer abstraction.

**Regles :**

- Chaque requete inclut implicitement org_id (DR-009, CRT-015).
- Les politiques RLS filtrent systématiquement les donnees par org_id.
- Le superadmin bypass RLS uniquement via configuration de session application, jamais privilege base de donnees.
- Le role migration_role n'a aucunes politiques RLS (schema-level only).

**Entrée depuis :** Domain Zone (via RepositoryPort).
**Sortie vers :** Data Storage Zone.

### Zone 5: Secret Zone — Gestion des Secrets

**Contient :** CryptographicPort, gestion des cles de chiffrement, stockage des hashes.

**Regles :**

- Les secrets ne quittent JAMAIS cette zone dans un format non protege.
- Les hashes de passwords ne sont jamais compares en clair — seule l'operation de verification est permise.
- Les cles de chiffrement sont gerees par un mécanisme dedie, rotation automatee.
- Les diagnostics (CRT-008) ne contiennent JAMAIS de données de cette zone (BR-ID-001).
- L'AuditEnabler (CRT-014) ne capture PAS les valeurs de cette zone dans old_values/new_values.

**Flux entrant :** Domaine demande hachage (create) ou verification (verify).
**Flux sortant :** Resultat de verification (boolean) OU reference chiffrée.

### Matrice de Flux entre Zones

| De → Vers | External | Service | Domain | Data | Secret |
|-----------|----------|---------|--------|------|--------|
| **External** | — | Bidir (req/res) | Non | Non | Non |
| **Service** | Bidir (req/res) | — | Dir (command/query) | Dir (repo calls) | Non |
| **Domain** | Non | Bidir (events) | — | Dir (persist) | Non |
| **Data** | Non | Non | Bidir (repo read/write) | — | Dir (crypto ops) |
| **Secret** | Non | Non | Non | Bidir (read/write encrypted) | — |

**Règle de flux :** Le flux prefférentiel est descendant (External → Service → Domain → Data → Secret pour écritures). Le flux montant (responses, events) remonte via le chemin inverse. Les sauts de zone sont interdits — un composant de la External Zone ne peut pas communiquer directement avec la Data Zone.

---

## SECTION 6: MATRICE DE TRACABILITÉ

Chaque section de ce document est traceable vers un ou plusieurs documents canoniques sources.

| Section SEC-SPEC-001 | Source Canonique(s) | Reference |
|---------------------|--------------------|-----------|
| Defense in Depth | DOC-000, DOC-012, RTS-001 | 6 layers of security |
| Least Privilege | API-CONTRACT-004, RLS-POLICY-SPECIFICATION-V1 | 9 roles, minimal perms |
| Zero Trust | DOC-015 INV-004, RTS-001 CRT-015 | org_id never from user input |
| Audit All Actions | DOC-015 AUD-001, RTS-001 CRT-014, DOC-023 §6 | Every write is captured |
| Encrypt at Rest/Transit | DOC-015 BR-ID-001 | No plaintext credentials |
| Fail Securely | API-CONTRACT-005 error taxonomy | E-401/E-403 by default |
| Tenant Isolation | DOC-023 NB-MT-001..004, RLS-POLICY-SPECIFICATION-V1 §1 | 4-layer isolation |
| Security Layers Map | RTS-001 all 15 CRT components | Complete component coverage |
| Actor Model | API-CONTRACT-004, RLS-POLICY-SPECIFICATION-V1 §1 | 5 actor types |
| Data Classification | DOC-015, DOC-021 physical model per aggregate | Per-table sensitivity |
| Security Zones | DOC-000 layered architecture | 5 logical zones |

---

## SECTION 7: REGLES NON-NEGOCIABLES

| Regle | Description | Source |
|-------|-------------|--------|
| SN-001 | org_id est TOUJOURS resolve depuis la session authente, JAMAIS depuis un parametre HTTP | RTS-001 CRT-015, DOC-023 NB-MT-001 |
| SN-002 | Une operation sans org_id est automatiquement rejtee | RTC-015 error handling |
| SN-003 | La failure mode par defaut de toute decision de securite est DENY | P-SEC-006 |
| SN-004 | Les erreurs de domaine (invariant viole) ne sont JAMAIS retryees (CRT-012) | RTS-001 CRT-012 |
| SN-005 | L'echec d'audit N'EST PAS une raison de rollback une operation domaine | RTS-001 CRT-014 |
| SN-006 | AuditAggregate ne s'audite PAS lui-meme (NB-PERSIST-007) | RTS-001 CRT-014, DOC-023 NB-RR-008 |
| SN-007 | Les diagnostics ne contiennent JAMAIS de donnees sensibles (passwords, tokens, hashes) | RTS-001 CRT-008, BR-ID-001 |
| SN-008 | L'ordre d'assemblage du Runtime est immuable apres calcul par DependencyResolver | RTS-001 RN-005 |
| SN-009 | Chaque Port a exactement une implementation concrete selectionnee au demarrage | RTS-001 RN-004 |
| SN-010 | L'isolement multi-tenant (_org_id) est applique partout, a toutes les couches | DOC-023 NB-MT-001..004, RTS-001 RN-008 |

---

## SECTION 8: RAPPEL DES CONTRAINTES DE CETTE SPECIFICATION

Cette specification de securite est volontairement technologie-agnostique :

- AUCUN algorithme de chiffrement n'est nomme (ni bcrypt, ni AES, ni RSA, ni SHA).
- AUCUN protocole d'authentification n'est nomme (ni OAuth, ni OIDC, ni SAML).
- AUCUN format de token n'est nomme (ni JWT, ni HS256).
- AUCUNE bibliotheque cryptographique n'est recommande.
- AUCUNE norme de conformite technique n'est citee en detail.

Les specifications detaillees de ces aspects sont dans :

- SEC-SPEC-002 : Regles d'authentication (mechanismes abstracts)
- SEC-SPEC-003 : Regles d'autorisation (RBAC complet)
- SEC-SPEC-004 : Regles de chiffrement (requirements par classe de donnee)
- SEC-SPEC-005 : Regles de gestion des secrets (cycle de vie des secrets)
- SEC-SPEC-006 : Regles d'audit et conformite (immuabilite, retention)

Ce document est le socle. Les 6 autres documents detillent les regles operatoires qui en decoulent.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | security-specifier v1.0 | Creation — Security Model abstrait pour Lumina v1 | COMPLIANT (trace verify contre DOC-000, DOC-015, DOC-023, API-CONTRACT-004, RTS-001, RLS-POLICY-SPECIFICATION-V1, ASS-001) |

---

*Ce document definitive le modele de securite fondamental de Lumina. Les six documents SEC-SPEC-002 a SEC-SPEC-007 operationalisent ce modele en regles applicables a chaque couche de l'architecture.*
