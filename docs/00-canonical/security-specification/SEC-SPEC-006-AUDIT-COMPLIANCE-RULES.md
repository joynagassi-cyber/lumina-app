# Audit & Compliance Rules — Lumina v1

**Doc ID:** SEC-SPEC-006
**Version:** v1.0
**Statut:** REGLES D'AUDIT ET CONFORMITE DEFINIES PAR GENESIS
**Date:** 2026-07-25
**Generateur :** security-specifier v1.0
**Source canonique :** ["SEC-SPEC-001", "DOC-015", "DOC-023", "API-CONTRACT-004"]
**Transformation_rule :** "security-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document etablit les regles d'audit et de conformite abstraites qui gouvernent la traçabilité de toutes les operations dans Lumina. Il definit la philosophie d'audit, le schema des entries d'audit, les garanties d'immuabilite, les politiques de retention, la correspondance avec les frameworks de conformite, les regles d'interrogation, l'auto-audit interdit, et les procedures d'echantillonnage.

**Regle constitutionnelle :** Chaque mutation est capturee; chaque acces aux donnees sensibles est logue; rien n'est traceable de maniere untraceable. L'audit est un effet lateral automatique du systeme, pas une option.

---

## SECTION 1: PHILOSOPHIE D'AUDIT

### 1.1 Principe Fondamental

L'audit dans Lumina repose sur trois piliers fondamentaux :

1. **Tout acte modifiable est capte.** Toute operation d'ecriture sur des donnees persistables est automatiquement capturee avec les valeurs avant (old_values) et apres (new_values). Aucune operation d'écriture ne peut se produire sans generer une entry d'audit correspondant.

2. **Chaque acces est consigne.** Toute lecture de donnees sensibles (credentials, sessions, tokens) est journalisee, meme si la donnee elle-meme n'est pas modifiee. La lecture de donnees CONFIDENTIELLE ou RESTRICTED genere une entry d'audit de type READ_SENSITIVE.

3. **Rien n'est indétournable.** Les entries d'audit sont append-only (NB-PERSIST-006). Elles ne peuvent ni etre modifiées, ni supprimees pendant la periode de retention. Le processus d'audit lui-meme ne s'audite pas (NB-PERSIST-007) pour prevenir les boucles de recursion infinies.

### 1.2 Portee de l'Audit

L'audit couvre toutes les operations sur les 13 aggregates de Lumina :

| Aggregate | Operations Auditees | Operateur |
|-----------|-------------------|-----------|
| OrganizationAggregate | CRUD complet | Admin/SuperAdmin + System auto |
| IdentityAggregate | CreateUser, UpdateUser, ChangeRole, PasswordReset, LoginSuccess/Fail, SessionCreate/Revoke | Admin/SuperAdmin + User self |
| ResourceAggregate | CRUD transactions/members/events, approve/reject | admin, treasurer, pastor, superadmin |
| RelationshipAggregate | membership management, org_unit changes | Admin/SuperAdmin |
| WorkflowAggregate | trigger, approve, reject, cancel, resubmit | System auto + role assigné |
| FormAggregate | create, update, validate (only if data modified) | System auto |
| NotificationAggregate | send, update preferences | System auto + User self |
| VocabularyAggregate | manage terms, deprecate values | Admin |
| ReportingAggregate | generate, calculate, export | admin, treasurer |
| LifecycleAggregate | archive, trash, purge, restore, tag, schedule | Admin/System auto |
| ConfigurationAggregate | update, reset settings | Admin |
| OfflineSyncAggregate | push, pull, resolve conflict, confirm | System auto |
| AuditAggregate | REA D only (query/export) — NEVER audit itself | SuperAdmin, admin |

### 1.3 Audit comme Effet Lateral Automatique

L'audit est implementé via l'AuditEnabler (CRT-014) qui intercepte automatiquement toute operation d'ecriture au niveau de l'Application Service :

```
App Service → Execute Operation → Domain Aggregate → Commit Transaction
     → AuditEnabler.capture() → AuditPort.log() [non-blocking]
```

**Caractéristiques de l'AuditEnabler :**
- Intercepte TOUTES les operations d'ecriture automatiquement.
- Capture les snapshots old_values et new_values au moment du commit.
- Appel AuditPort.log() de maniere non-bloquante (asynchrone).
- Si AuditPort est indisponible → l'operation domaine CONTINUE. L'echec d'audit n'est JAMAIS une raison de rollback une operation metier.

**Exception notable :** L'AuditEnabler filtre systématiquement les champs de la Secret Zone (SEC-SPEC-001 §5.5). Aucun credential, token, hash, ou cle de chiffrement ne transitent vers AuditAggregate.

---

## SECTION 2: SCHEMA DES ENTRIES D'AUDIT

### 2.1 Structure Canonique

Toutes les entries d'audit suivent le schema canonique suivant, aligne sur la structure de la table audit_entries :

| Champ | Type | Description | Obligation |
|-------|------|-------------|------------|
| action | string | Type d'operation executee | OBLIGATOIRE |
| entity_type | string | Nom de l'Aggregate cible audité | OBLIGATOIRE |
| entity_id | string | Identifiant de l'entite spécifique audité | OBLIGATOIRE |
| user_id | string | Identifiant de l'acteur ayant effectue l'operation | OBLIGATOIRE |
| org_id | string | Identifiant du tenant concerne | OBLIGATOIRE |
| old_values | JSON/object | Valeurs AVANT l'operation (vide/null pour CREATE) | OBLIGATOIRE (DOC-015 OLDNEW-002) |
| new_values | JSON/object | Valeurs APRES l'operation (vide/null pour DELETE) | OBLIGATOIRE (DOC-015 OLDNEW-002) |
| timestamp | datetime | Date et heure de l'operation en UTC | OBLIGATOIRE |
| ip_address | string | Adresse IP de l'acteur (si applicable) | Conditionnel |
| device_fingerprint | string | Empreinte du dispositif (hashé) | Conditionnel |
| metadata | JSON/object | Informations supplementaires (session_id, user_agent, etc.) | Optionnel |

### 2.2 Nomenclature des Actions

Les actions d'audit suivent un pattern standard :

| Prefixe | Signification | Exemples |
|---------|--------------|----------|
| ENTITY_CREATE | Creation d'une entite | TRANSACTION_CREATE, USER_CREATE, MEMBER_CREATE |
| ENTITY_UPDATE | Modification d'une entite | TRANSACTION_UPDATE, USER_UPDATE_SETTING, CONFIG_UPDATE |
| ENTITY_DELETE | Suppression logique (archive/trash) | TRANSACTION_ARCHIVE, MEMBER_TRASH |
| ENTITY_APPROVE | Approbation | TRANSACTION_APPROVE, WORKFLOW_STEP_APPROVE |
| ENTITY_REJECT | Rejet | TRANSACTION_REJECT, WORKFLOW_STEP_REJECT |
| ENTITY_RESET | Reset d'un element | PASSWORD_RESET, CONFIG_RESET_TO_DEFAULTS |
| ENTITY_TRANSFER | Transfert | ORGANIZATION_TRANSFER |
| ENTITY_MERGE | Fusion | ORGANIZATION_MERGE |
| ENTITY_SUSPEND | Suspension | ORGANIZATION_SUSPEND, USER_SUSPEND |
| ENTITY_ACTIVATE | Reactivation | ORGANIZATION_ACTIVATE |
| SESSION_CREATE | Creation de session | SESSION_CREATE |
| SESSION_REVOKE | Revoque de session | SESSION_REVOKE, LOGOUT_USER |
| ROLE_CHANGE | Changement de role | USER_ROLE_CHANGE |
| AUDIT_READ | Lecture des logs d'audit | AUDIT_QUERY, AUDIT_EXPORT |
| SENSITIVE_READ | Lecture de donnees sensibles | CREDENTIALS_READ, SESSIONS_READ |
| SYNC_PUSH | Poussee de synchronisation | SYNC_PUSH_BATCH |
| SYNC_PULL | Tirage de synchronisation | SYNC_PULL_BATCH |
| SYNC_RESOLVE | Resolution de conflit | SYNC_CONFLICT_RESOLVED |
| SYSTEM_AUTO | Operation automatique systeme | SYSTEM_AUTO_SCHEDULED_PURGE, SYSTEM_AUTO_SYNC |

### 2.3 Captures old_values / new_values

**Regle OLDNEW-002 (DOC-015) :** old_values ET new_values sont TOUJOURS presents dans chaque entry d'audit.

Cas specifiques :
- **CREATE :** old_values = {} (vide), new_values = {donnees complètes de l'entite creee}
- **UPDATE :** old_values = {etat precedent}, new_values = {etat apres modification}
- **DELETE :** old_values = {etat avant suppression}, new_values = {} (vide)
- **APPROVE/REJECT :** old_values = {status precedent}, new_values = {nouveau status + metadata approbation}

**Masquage des secrets dans old/new values :**
L'AuditEnabler filtre automatiquement toute reference a un secret avant insertion dans l'entry :
- password_hash → jamais presente dans old_values ni new_values.
- refresh_token → jamais present.
- encryption_key → jamais present.
- device_fingerprint_hash → jamais present.
- any field classified as RESTRICTED → exclus systematiquement.

---

## SECTION 3: GARANTIE D'IMMUABILITE

### 3.1 Regle NB-PERSIST-006

Les entries d'audit sont IMMUABLES :

| Operation | Autorisee sur audit_entries ? | Source |
|-----------|-----------------------------|--------|
| INSERT (append) | OUI — automatique via AuditPort | DOC-015 AUD-001 |
| SELECT (read) | OUI — par roles autorises | API-CONTRACT-004 |
| UPDATE (modify) | NON — Jamais, sous aucun pretexte | NB-PERSIST-006 |
| DELETE (purge before retention) | NON — Jusqu'a expiration de retention | NB-PERSIST-006 |

La garantie d'immuabilite est assuree par plusieurs couches :
1. **Application Layer :** AuditAggregate expose uniquement une methode `log()` — pas de `update()` ni `delete()`.
2. **Persistence Layer :** Les RepositoryPorts mappe vers l'audit n'exposent que l'append.
3. **Database Layer :** RLS policy sur audit_entries force le Row Level Security — seul INSERT est permis pour les roles applicatifs (sauf superadmin qui a SELECT mais pas UPDATE/DELETE pendant retention).

### 3.2 Immuabilite Structurelle

L'immuabilite n'est pas seulement logicielle — elle est structurelle :
- AuditAggregate utilise exclusivement le pattern Journal Immuable (NB-PERSIST-006, DOC-019 §4.4).
- Aucun autre Aggregate ne peut adopter ce pattern sans amendement ADR (NB-RR-007).
- Les entries d'audit sont physiquement separes des donnees auditées — elles ne partagent jamais le meme espace de stockage logic que leurs sources (DOC-023 §6.3).

### 3.3 Exception a l'Immuabilite

L'unique exception a l'immuabilite absolue :
- Apres expiration de la periode de retention (RETENTION-031, minimum 7 ans), les entries expirees peuvent etre purgees par un processus systeme dedie.
- Cette purge NE PRODUIT PAS d'entry d'audit dans AuditAggregate (NB-PERSIST-007).
- La purge est journalisee dans les logs administratifs, pas dans AuditAggregate.

---

## SECTION 4: POLITIQUE DE RETENTION

### 4.1 Periodes de Retention Minimales

| Type d'Audit | Periode Minimale de Retention | Justification |
|-------------|------------------------------|--------------|
| Audit Metier General (toutes operations CRUD) | 7 ans | Requirement comptable/legal general (RETENTION-031) |
| Audit de Securite (tentatives d'acces echoues, revoques de session, violations de permission) | 10+ ans | Surveillance de securite, investigation incidents |
| Audit SuperAdmin (operations wildcard) | 10 ans | Operations critiques de niveau systeme |
| Audit de Migration (changelogs DDL schema) | 5 ans | Historique infrastructurel |
| Audit de Synchronisation | 2 ans | Logs de sync transient, moins critique |
| Audit d'Access aux Donnees Sensibles (read_sensitive) | 10 ans | Traçabilite des acces aux donnees RESTRICTED |

### 4.2 Calcul de l'Expiration

Chaque entry d'audit porte un champ `_retention_expires_at` calcule au moment de l'insertion :

```
retention_expires_at = timestamp + configured_retention_period
```

Le processus de purge planifie (PurgeScheduler, DOC-012 §2.11) identifie regulierement les entries dont `_retention_expires_at` est depassé.

### 4.3 Purge Automated

La purge des entries expirees :
1. Est executee par un scheduler systeme (CRT-009).
2. Supprime les entries en batch (max 500 entries par execution pour limiter l'impact).
3. NE GENERE PAS d'entry d'audit dans AuditAggregate (NB-PERSIST-007).
4. Est loggee dans les logs administratifs.
5. Ne peut etre lancee que pour des entries dont la retention est严格 expirée.
6. Un batch de purge contient toujours le nombre d'entries purgees, mais jamais leur contenu.

---

## SECTION 5: CORRESPONDANCE CONFORMITE

### 5.1 Mapping Abstract vers Frameworks de Conformite

Ce document etablit une correspondance abstraite entre les regles d'audit de Lumina et les exigences generiques des frameworks de conformite, SANS nommer aucun framework particulier :

| Exigence de Conformite Abstraite | Regle Lumina Correspondante | Commentaire |
|---------------------------------|---------------------------|------------|
| Traçabilite de toutes les operations utilisateur | DOC-015 AUD-001, SEC-SPEC-006 Section 1 | Every write captured with before/after |
| Immuabilite des logs d'audit | NB-PERSIST-006, SEC-SPEC-006 Section 3 | Cannot modify or delete audit entries |
| Conservation minimale de 7 ans | RETENTION-031, SEC-SPEC-006 Section 4 | 7-year minimum for business audits |
| Separetion des pouvoirs (creator != auditor) | API-CONTRACT-004 audit:read role restriction | Only admin/superadmin can query audit |
| Protection des donnees personnelles | DOC-015 privacy invariants | Access restricted by org and role |
| Non-repudiation des operations financières | FIN-001, AUD-002, finance invariants | Approved transactions immutable + fully audited |
| Gestion securisee des credentials | BR-ID-001, SEC-SPEC-002, SEC-SPEC-005 | Hashed storage, never plaintext |
| Supervision des acces privilegies | SEC-SPEC-003 superadmin rules | All wildcard operations escalated in audit |

### 5.2 Audit de Conformite Interne

Une evaluation periodique de la conformite doit etre realisee :
- Au minimum annuellement pour les regles generales.
- A chaque modification significative de l'architecture de securite.
- En cas de suspicion de violation de securite.
- A la demande du superadmin ou d'un auditor qualifie.

L'evaluation compare les entries d'audit aux exigences de retention, verifie l'absence de tentatives de modification d'entries, et valide la couverture d'audit complete.

---

## SECTION 6: REGLES D'INTERROGATION D'AUDIT

### 6.1 Qui Peut Requeter les Entries d'Audit

| Role | QueryAuditLogs | ExportAuditTrail |
|------|---------------|-----------------|
| superadmin | OUI (toutes orgs) | OUI (toutes orgs) |
| admin | OUI (son org uniquement) | OUI (son org uniquement) |
| treasurer | NON | NON |
| pastor | NON | NON |
| staff | NON | NON |
| service_account | NON | NON |
| migration_role | NON | NON |
| readonly | OUI (SELECT only, son org) | NON (export requires admin) |
| sync_service | NON | NON |

### 6.2 Conditions d'Interrogation

Une requete d'audit ne peut etre executee que sous ces conditions :
1. L'acteur est authentifié (verification SEC-SPEC-002).
2. L'acteur possede la permission audit:read pour l'org_id cible.
3. La requete inclut implicitement le filtre org_id depuis la session.
4. Le resultat ne contient JAMAIS de valeurs de la Secret Zone (SEC-SPEC-004 §8).

### 6.3 Limitations des Requêtes

- Les requêtes d'audit peuvent filtrer par : entity_type, entity_id, action, user_id, date range, org_id.
- Les requêtes ne peuvent PAS modifier, supprimer, ou mettre a jour les entries d'audit.
- Les exports d'audit (audit:export) sont horodatés (EXPORT-001) et tracent l'export dans AuditAggregate.
- Un export ne peut contenir que les donnees auxquelles le role de l'acteur a acces (aucun cross-org).

### 6.4 Protection Anti-Revelation

Les resultats d'audit protegent les informations sensibles :
- old_values et new_values ne contiennent JAMAIS de credentials, tokens, ou hashes.
- Les adresses IP sont incluses (donnee operationnelle legitime).
- Les device fingerprints sont exclus (hashed, ne revelent rien de pertinent).

---

## SECTION 7: PROHIBITION DE L'AUTO-AUDIT

### 7.1 Regle NB-PERSIST-007

AuditAggregate NE S'AUDITE PAS LUI-MEME. C'est une regle absolue (NB-PERSIST-007, RTS-001 CRT-014) qui previent les boucles de recursion infinies et protege l'integrite du systeme d'audit lui-meme.

**Implications :**
- Quand une entry d'audit est insérée dans la base, cette insertion NE GENERE PAS une nouvelle entry d'audit dans AuditAggregate.
- Quand une operation de purge d'entries expirees est executed, cette purge NE GENERE PAS d'entry d'audit.
- Quand un admin requête les logs d'audit, cette lecture NE GENERE PAS d'entry d'audit READ_SENSITIVE.
- L'AuditEnabler contient explicitement un guard qui exclut l'entity_type == "audit_entries" de la capture automatique.

### 7.2 Why No Self-Audit

Plusieurs raisons justifient cette regle :

1. **Prevention de recursion infinie :** Si l'insertion d'une entry d'audit generait elle-meme une entry d'audit, cela creerait une boucle sans fin (entry A genère entry B qui genère entry C qui ...).

2. **Protection anti-modification de l'audit :** Si l'audit s'audite lui-meme, alors quiconque peut modifier les entries d'audit pourrait aussi modifier les entries d'audit de ses modifications — c'est-à-dire modifier son propre trail d'audit, violant ainsi l'immuabilite fondamentale (NB-PERSIST-006).

3. **Performance :** La generation d'entries d'audit pour l'audit lui-meme ajouteraît une surcharge massive et disproportionnée.

4. **Integrite structurelle :** L'audit est le systeme de traçabilité fondamental. Il doit rester externe au systeme qu'il trace pour garantir sa neutralité et son integrity.

### 7.3 Alternative à l'Auto-Audit

Bien qu'AuditAggregate ne s'audite pas lui-meme, les operations critiques sur l'audit sont supervisees par d'autres moyens :
- Acces limité a l'audit : seuls superadmin et admin peuvent requêter les logs (ACCESS-033).
- Monitoring des acces aux entries d'audit : tout accès anormal aux logs d'audit est surveillé par le systeme de monitoring independant.
- Checksums periodiques de l'integrité des entries d'audit (valide par l'auditeur interne).

---

## SECTION 8: ECHANTILLONNAGE D'AUDIT

### 8.1 Objectif de l'Echantillonnage

L'echantillonnage d'audit permet de verifier periodiquement que :
- Les entries d'audit sont bien generées pour toutes les operations attendues.
- Le schema des entries respecte le format canonique (Section 2).
- Les secrets sont correctement exclus des old_values/new_values.
- Les periodes de retention sont correctement appliquees.
- L'immuabilite des entries est respectee (aucune modification detectee).

### 8.2 Metodologie d'Echantillonnage

| Echantillon | Frequency | Taille | Cible |
|------------|-----------|--------|-------|
| Echantillon General | Mensuel | 0,1% des entries | Entrées aleatoires de tous types |
| Echantillon SuperAdmin | Hebdomadaire | 100% des operations wildcard | Toutes les operations superadmin |
| Echantillon Securité | Après incident | Taille variable | Entrées liees a l'incident |
| Echantillon de Conformite | Annuel | 1% stratifié | Tous types representes proportionnellement |

### 8.3 Checks d'Echantillonnage

Pour chaque echantillon, les operations suivantes sont effectuees :
1. Verifier que le nombre d'entries d'audit correspond au nombre attendu d'operations d'ecriture (completude).
2. Valider que chaque entry a old_values ET new_values presents (OLDNEW-002).
3. Scanner les entries pour detecter la presence de champs de la Secret Zone (fuite potentielle).
4. Vérifier que les timestamps sont chronologiques et cohérents avec les logs operatifs.
5. Confirmer qu'aucune entry n'a été modifiée ou supprimée durant la periode couverte.

---

## SECTION 9: ERREURS D'AUDIT

### 9.1 Gestion des Echecs d'Audit

Si l'AuditPort ne peut pas enregistrer une entry d'audit (base de donnee indisponible, timeout, etc.) :

- L'operation domaine continue normalement (SN-005, SEC-SPEC-001).
- L'echec d'audit est loggé dans les logs administratifs applicatifs.
- Une alerte est declenchee pour notification aux administrateurs.
- L'operation est marquee comme "pending_audit" et retentée automatiquement (retry backoff CRT-012).
- Si l'echec persiste, le systeme passe en mode "audit degraded" et notifie le superadmin.

**Principe :** L'echec d'audit N'EST PAS une raison de rollback une operation metier. La disponibilite metier prime sur la traçabilité — mais l'echec doit etre corrige rapidement.

### 9.2 Code d'Erreur Audit

| Code | Signification | Reponse |
|------|--------------|---------|
| E-500-010 | Audit log fail | "Une erreur systeme empeche l'enregistrement de cette operation. L'operation a été executee mais un probleme technique retarde son enregistrement dans les logs." |
| E-403-040 | Audit read denied | "Vous n'avez pas l'autorisation d'interroger les logs d'audit." |
| E-422-020 | Audit schema invalid | "La structure des donnees auditées est invalide." |

---

## SECTION 10: REGLES NON NEGOCIABLES D'AUDIT

| Regle | Description | Source |
|-------|-------------|--------|
| SN-AUDIT-001 | Chaque mutation est capturee avec old + new values | DOC-015 AUD-001, OLDNEW-002 |
| SN-AUDIT-002 | Les entries d'audit sont immuables (pas de UPDATE/DELETE pendant retention) | NB-PERSIST-006 |
| SN-AUDIT-003 | AuditAggregate ne s'audite PAS lui-meme | NB-PERSIST-007 |
| SN-AUDIT-004 | L'echec d'audit n'est PAS une raison de rollback | SEC-SPEC-001 SN-005 |
| SN-AUDIT-005 | Les diagnostics ne contiennent JAMAIS de données d'audit sensibles | RTS-001 CRT-008 |
| SN-AUDIT-006 | Les requetes d'audit filtrent implicitement par org_id | SN-001 |
| SN-AUDIT-007 | Les operations superadmin wildcard sont particulierement auditees | SEC-SPEC-001 Actor Model |
| SN-AUDIT-008 | La retention minimum est de 7 ans pour l'audit metier | RETENTION-031 |
| SN-AUDIT-009 | Les acces aux donnees sensibles (credentials, sessions) sont logs | Section 6 |
| SN-AUDIT-010 | Seul le processus de purge planifiee peut supprimer des entries d'audit | Section 4 |

---

## SECTION 11: MATRICE DE TRACABILITE

| Section SEC-SPEC-006 | Source Canonique(s) | Reference |
|---------------------|--------------------|-----------|
| Audit Philosophy | SEC-SPEC-001 P-SEC-004 | Every write is captured |
| Audit Entry Schema | DOC-015, DOC-023 §6 | Canonical audit_entries structure |
| Immutable Log Guarantee | NB-PERSIST-006, RTS-001 CRT-014 | No modification or deletion |
| Retention Policy | RETENTION-031, DOC-015 | 7 years minimum, 10+ security |
| Compliance Mapping | Abstract frameworks | Generic compliance alignment |
| Audit Query Rules | API-CONTRACT-004 AuditAggregate | Role-based access to audit |
| Self-Audit Prohibition | NB-PERSIST-007, DOC-023 NB-RR-008 | No recursion in audit |
| Audit Sampling | Internal compliance | Periodic audit verification |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | security-specifier v1.0 | Creation — Audit & Compliance Rules pour Lumina v1 | COMPLIANT (trace verify contre SEC-SPEC-001, DOC-015, DOC-023, API-CONTRACT-004) |

---

*Ce document operationalise les regles d'audit derivees du modele de securite de SEC-SPEC-001. Il complete SEC-SPEC-002 (Authentication audit events), SEC-SPEC-003 (Authorization logging), SEC-SPEC-004 (Encryption in audit), SEC-SPEC-005 (Secret handling audit), et est valide par SEC-SPEC-007 (Security Validation Report).*
