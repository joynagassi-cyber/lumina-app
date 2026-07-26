# Secret Handling Rules — Lumina v1

**Doc ID:** SEC-SPEC-005
**Version:** v1.0
**Statut:** REGLES DE GESTION DES SECRETS DEFINIES PAR GENESIS
**Date:** 2026-07-25
**Generateur :** security-specifier v1.0
**Source canonique :** ["SEC-SPEC-001", "SEC-SPEC-002", "SEC-SPEC-004", "DOC-015"]
**Transformation_rule :** "security-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document etablit les regles de gestion des secrets abstraites qui gouvernent le cycle de vie complet des informations sensibles dans Lumina. Il definit les categories de secrets, les regles de stockage, d'acces, de rotation, de reponse a une violation, de destruction et d'audit.

**Regle constitutionnelle :** Un secret ne quitte JAMAIS la Secret Zone (SEC-SPEC-001 §5.5) dans un format non protege. Tout secret detecté en dehors de sa zone dediee constitue une violation de securite critiques.

---

## SECTION 1: CATEGORIES DE SECRETS

### 1.1 Classification des Secrets

Tous les secrets de Lumina sont classes en cinq categories fonctionnelles :

| Category | Description | Examples dans Lumina | Classe de Donnee |
|----------|-------------|---------------------|-----------------|
| **Credentials Utilisateur** | Secrets utilises pour l'authentification humaine | Hashes de mots de passe dans credentials.table | RESTRICTED |
| **Cles API** | Secrets utilises pour l'authentification inter-service | Tokens de service account, tokens de sync_service | RESTRICTED |
| **Cles de Chiffrement** | Secrets utilises pour proteger des donnees au repos | Cles utilisees par CryptographicPort pour chiffrer les donnees CONFIDENTIELLES | RESTRICTED |
| **Jetons d'Acces et Refresh** | Secrets transitants utilises pour l'authorization | Jetons d'acces (transit uniquement), refresh tokens (hashes stockés) | RESTRICTED (stocke), PUBLIC (transit) |
| **Certificats et Paires de Cles TLS** | Secrets utilises pour le chiffrement en transit | Paires cle publique/privée pour la negociation de transport chiffre | RESTRICTED |

### 1.2 Differenciation entre Secret et Non-Secret

Un element est un SECRET si et seulement si sa revelation permettrait a quelqu'un d'autorise de :
- Se faire passer pour un utilisateur legitime (credential compromise).
- Acceder a des donnees d'un autre tenant (cle de chiffrement compromise).
- Bypasser les mecanismes d'authorization (token valide intercepte).
- Decrypter des donnees protegees (cle de chiffrement accessible).

Un element n'est PAS un secret s'il ne presente aucun de ces risques :
- Les hashes de mots de passe SONT des secrets (peuvent etre utilises pour l'authentication par replay).
- Les adresses email NE SONT PAS des secrets (donnees CONFIDENTIEL mais pas des credentials).
- Les roles RBAC NE SONT PAS des secrets (information structurelle).
- Les configurations systeme NE SONT PAS des secrets (sauf si elles contiennent des cles ou credentials).

---

## SECTION 2: STOCKAGE DES SECRETS

### 2.1 Interdiction Absolue de Stockage Hors Zone Securisee

Les secrets ne doivent JAMAIS etre stocks dans les emplacements suivants :

| Emplacement Interdit | Type de Secret Concerne | Explication |
|---------------------|----------------------|-------------|
| Code source | TOUS | Aucun secret hardcoded n'existe dans le code |
| Fichiers de configuration commits | TOUS | La configuration ne contient jamais de valeurs de secrets |
| Logs applicatifs | Credentials, Tokens, Cles | Les logs ne capturent jamais de valeur de secret |
| Diagnostics CRT-008 | TOUS | Les diagnostics techniques n'incluent aucune donnee de la Secret Zone |
| Exports de donnees | TODS | Les exports PDF/csv ne contiennent aucun secret |
| Rapports de reporting | TODS | Les rapports financiers ne mentionnent aucun credential ou token |
| Messages d'erreurs API | Credentials | Les erreurs ne revelent aucune information sur les secrets |
| old_values / new_values d'AuditAggregate | TODS | L'audit ne capture jamais de valeur de secret (SEC-SPEC-004 §8) |
| Bases de sauvegarde non chiffrees | TODS | Les sauvegardes doivent etre chiffrees si elles contiennent des donnees RESTRICTED |
| Environnement variables non proteges | TODS | Les secrets ne sont jamais exposes dans printenv ou equivalente |

### 2.2 Stockage Autorise

Les secrets ne sont stockes que dans les emplacements suivants :

| Emplacement | Secret Associe | Protection Appliquee |
|------------|---------------|--------------------|
| Table credentials (password_hash) | Hash computationnel avec sel | Chiffrement au repos obligatoire (SEC-SPEC-004 §3) |
| Table sessions (refresh_token_hash) | Hash du refresh token | Chiffrement au repos obligatoire |
| CryptographicPort (memorise volatile) | Cles de chiffrement activees | Acces uniquement via port, jamais en clair hors processus |
| Token Memory (memoire volatile) | Jetons d'acces en transit | Existent uniquement durant la requête, ecartes immediatement apres |
| Manager de cles (abstrait) | Cles de chiffrement au repos | Acces programme par programme, rotation automatique |

### 2.3 Generation et Injection de Secrets

Lorsqu'un secret est cree (nouveau credential, nouvelle cle de chiffrement, nouveau token de service) :

1. Le secret est genere par un generateur dedie dans la Secret Zone.
2. Le secret brut est utilise UNIQUEMENT pour la transformation/hashage necessaire.
3. Apres transformation, le secret brut est immediateecarte de toute memoire accessible.
4. Seule la version transformee (hash, cle dechiffree pour usage interne) est persistée.
5. Le processus de creation est trace dans AuditAggregate mais sans inclure le secret lui-meme.

### 2.4 Regle Anti-Hardcoded

AUCUN secret n'est codé en dur dans le code source :

```
Interdit : setting_password = "mon_secret_dur"
Interdit : const API_KEY = "une_valeur_concrete";
Interdit : def GetToken() -> "token_value_fixe";

Autorise : setting_resolver.get("encryption_key_id"); → retoune une reference au Key Manager
Autorise : token_provider.generate(session_context); → generé dynamiquement
```

Cette regle est valider automatiquement par inspection statique du code lors de tout build.

---

## SECTION 3: ACCES AUX SECRETS

### 3.1 Regle de Lecture Uniquement au Runtime

Les secrets sont accessibles uniquement en lecture-memoire volatile au runtime :

**Principe :** Un composant peut charger un secret en memoire pour l'utiliser pendant l'execution d'une operation, mais :
- Le secret ne peut pas etre lu depuis le disque une fois charge (il vient du Key Manager en memoire).
- Le secret ne peut pas etre ecrit hors de la Secret Zone.
- Le secret ne peut pas etre retourne dans une reponse API.
- Le secret ne peut pas etre affiche dans un log, debug output, ou diagnostic.

### 3.2 Acces par Role aux Secrets

| Role | Credentials | Cles API | Cles de Chiffrement | Tokens | Certificats |
|------|------------|----------|-------------------|--------|-------------|
| superadmin | Lecture seule (verification) | Acces programmatique | Acces via CryptographicPort | N/A | N/A |
| admin | Lecture seule (son org uniquement) | N/A | N/A | N/A | N/A |
| treasurer | N/A | N/A | N/A | N/A | N/A |
| pastor | N/A | N/A | N/A | N/A | N/A |
| staff | N/A | N/A | N/A | N/A | N/A |
| service_account | N/A | Utilisation via son token | N/A | Presente son token | N/A |
| migration_role | N/A | N/A | N/A | N/A | N/A |
| readonly | N/A | N/A | N/A | N/A | N/A |
| sync_service | N/A | Utilisation via son token | N/A | Presente son token | N/A |

### 3.3 Interdiction de Retour dans les Reponses

AUCUN secret ne doit etre inclus dans une reponse API sous quelque forme que ce soit :

- Ni en clair (évidence).
- Ni hashé (un hash de credential est lui-meme un secret utilisable par replay).
- Ni partiellement (les 4 derniers caracteres d'un mot de passe sont encore informatifs).
- Ni indirectement (un index dans une liste de tokens actifs revele la presence d'un token).

Les reponses peuvent indiquer qu'un secret a été mis a jour avec succès ("credential rotated") sans jamais reveler sa valeur.

### 3.4 Masquage Systemique dans Toutes les Sorties

Quand un secret pourrait accidentellement transiter vers une sortie (log, reponse, export, diagnostic) :

- Les valeurs de champ identifiees comme secret sont remplacees par `[REDACTED]`.
- Les hashes de credentials (même presentes dans old_values/new_values) sont exclus completement.
- Les adresses IP dans les logs de connexion ne sont pas considerees comme des secrets (donnee operationnelle legitimate).

---

## SECTION 4: ROTATION DES SECRETS

### 4.1 Calendrier de Rotation Par Categorie

Chaque categorie de secret a un calendrier de rotation defini :

| Categorie de Secret | Frequence de Rotation | Mechanisme | Delai de Preavis |
|--------------------|---------------------|-----------|-----------------|
| Credentials Utilisateur (password) | Tous les 90 jours (user), 60 jours (superadmin) | SEC-SPEC-002 §2.5 | J-15 (user), J-7 (superadmin) |
| Tokens de Service Account | Tous les 90 jours | Programmée par scheduler (CRT-009) | Rotation automatique J-0 |
| Tokens Sync Service | Tous les 60 jours | Programmee par scheduler (CRT-009) | Rotation automatique J-0 |
| Cles de Chiffrement | 180-365 jours selon classification | Scheduler systeme | Transparent utilisateur |
| Refresh Tokens | A chaque utilisation (rotation par usage) | SEC-SPEC-002 §5.5 | N/A — rotation continue |
| Cles API (service) | Tous les 90 jours | Scheduler systeme | Rotation automatique J-0 |

### 4.2 Processus de Rotation

La rotation d'un secret suit toujours le meme pattern generique :

```
1. Nouveau secret est genere
2. Ancien secret est marque "deprecie" mais reste fonctionnel pour lecture (depreciation grace period)
3. Nouvel secret est active pour ecriture
4. Donnees existantes chiffrees avec ancien secret sont migratees vers le nouveau
5. Après migration complete, ancien secret est marque "expire"
6. Ancien secret est détruit conformement a Section 6
```

### 4.3 Grace Period de Depreciation

Pendant la rotation :
- L'ancien secret reste valide pour les operations de lecture (dechiffrement) pendant une periode grace de 7 jours maximum.
- L'ancien secret ne peut PLUS servir pour les operations d'écriture.
- Les sessions actives liees a un credential roté continuent de fonctionner jusqu'a expiration naturelle de leur session.
- La grace period est notifiée aux composants concernes via le Key Manager.

---

## SECTION 5: REPONSE A UNE VIOLATION DE SECRET

### 5.1 Definition de Violation

Une violation de secret est detectée lorsqu'il existe des preuves ou de fortes suspicions que :
- Un credential a été expose (fuite de logs, demande suspecte, signalement utilisateur).
- Une cle de chiffrement a été compromises (acces non autorise detecté au Key Manager).
- Un token a été intercepté en transit (anomalie de traffic detectee).
- Un certificat TLS a été compromise (certificat revoke par une autorité de certification tierce).

### 5.2 Reponse Immédiate

En cas de suspicion ou confirmation de violation :

| Etape | Action | Responsable | Delai |
|-------|--------|------------|-------|
| 1 | Revocation IMMEDIATE du secret compromet | System automatique ou Admin | < 1 minute |
| 2 | Invalidisation de TOUTES les sessions associees | SessionManager automatique | < 1 minute |
| 3 | Emission de nouveaux credentials/tokens | SecurityPort | < 5 minutes |
| 4 | Review des logs d'audit pour evaluation de l'impact | Admin/SuperAdmin | < 24 heures |
| 5 | Notification aux utilisateurs affectes | NotificationAggregate | < 24 heures |
| 6 | Documentation de l'incident dans les logs administratifs | System auto | < 1 heure |

### 5.3 Evaluation d'Impact

La review d'audit post-violation examine :
- Depuis quand le secret compromis etait-il actif (date de derniere rotation) ?
- Combien de sessions etaient utilisees avec ce secret ?
- Quelles operations ont été executees avec ce secret entre la violation et la detection ?
- Y a-t-il des tentatives d'utilisation anormale detectees pendant la periode compromise ?

### 5.4 Re-Emission

Apres revocation, les nouveaux secrets sont generes et remis aux acteurs concerned :
- Pour les credentials utilisateur : via un canal externe sécurisé (email, message hors application).
- Pour les tokens de service : via le Key Manager, injection automatique dans le composant concerne.
- Pour les cles de chiffrement : rotation transparente via le scheduler.

---

## SECTION 6: DESTRUCTION DES SECRETS

### 6.1 Procedures de Destruction Sécurisée

Tout secret arrive a expiration ou suite a une violation doit etre detruit de maniere irreversible :

**Pour les hashes stockes en base :**
1. La ligne dans credentials ou sessions est marquee comme `expired=true`.
2. Le hash est supprime physiquement de la table par un processus de nettoyage automatique.
3. La suppression est traçée dans les logs administratifs (pas dans AuditAggregate — NB-PERSIST-007).

**Pour les cles de chiffrement dépréciées :**
1. La cle est retiree du Key Manager.
2. Les references a la cle dans les metadonnées de chiffrement sont mises a jour.
3. Toute copie en memoire volatile du systeme est effacee.

**Pour les tokens expirés :**
1. Les refresh tokens expirés sont marques comme invalides.
2. Ils ne peuvent plus passer la phase de verification de SEC-SPEC-002 §2.4.

### 6.2 Verification de Destruction

Pour garantir qu'un secret a bien été detruit :
- Un jeton de destruction est emis par le process de destruction.
- Ce jeton est consigné dans les logs administratifs avec timestamp et operateur (ou process id si automatique).
- Le Key Manager tient un registre des destructions effectuees.

### 6.3 Destruction Irreversible

La destruction d'un secret est une opération irreversible :
- Une fois détruit, le secret ne peut pas etre restaure.
- Les donnees chiffrees avec une cle détruite ne sont plus accesibles (sauf backup chiffré avec une autre cle).
- Les sessions liees a un credential detruit doivent se reconnecter avec un nouveau credential.

---

## SECTION 7: AUDIT DES SECRETS

### 7.1 Journalisation de Tous les Acces aux Secrets

Chaque acces a un secret est journalisé. L'entry d'audit contient :

| Champ | Contenu | Exemple |
|-------|---------|---------|
| action | Type d'acces | secret_read, secret_created, secret_rotated, secret_revoked, secret_destroyed |
| entity_type | Type de secret | password_hash, refresh_token, encryption_key, api_token, certificate |
| entity_id | Identifiant du secret cible | ID de la session, ID du credential, ID de la cle |
| user_id | Qui a effectue l'acces | ID de l'utilisateur/service |
| org_id | Organisation concerne | UUID de l'org |
| timestamp | Date de l'acces | ISO 8601 |
| result | Succes ou echec de l'acces | success, denied, error |

### 7.2 Regles d'Audit des Secrets

- TOUT accès en lecture a une cle de chiffrement est journalisé.
- TOUTe creation, rotation, revoque, ou destruction de secret est journalisée.
- TOUT refus d'acces a un secret (tentative non autorisée) est journalise avec une severité accrue.
- Les entries d'audit relatives aux secrets sont particulierement surveillées (alerte si frequency anormale detectee).
- Les entries d'audit elles-memes ne contiennent AUCUN secret (SEC-SPEC-004 §8).

### 7.3 Surveillance Automatisée

Le systeme surveille automatiquement les schémas d'acces aux secrets et alerte sur :
- Plus de N acces a un meme secret dans une fenetre de temps anormalement courte.
- Des acces a des secrets en dehors des heures habituelles.
- Des acces a des secrets depuis des adresses IP inhabituelles.
- Des echecs d'acces multipliés sur un meme secret.
- Des rotations de secret multiples dans un delai court (signe possible de compromise).

---

## SECTION 8: INVENTAIRE DES SECRETS PAR TABLE

### 8.1 Inventario Complet

Voici l'inventaire de tous les secrets presents dans la base de donnees physique :

| Table | Colonne | Type de Secret | Classe | Rotation | Protection |
|-------|---------|---------------|--------|----------|-----------|
| credentials | password_hash | Hash credential utilisateur | RESTRICTED | A chaque changement/mot de passe | Hashing computationnel + sel unique |
| credentials | salt | Sel de generation du hash | RESTRICTED | Unique par credential | Lie au hash, pas rotatif |
| sessions | refresh_token_hash | Hash refresh token | RESTRICTED | Rotation a chaque refresh usage | Hash avant stockage |
| sessions | device_fingerprint_hash | Hash empreinte dispositif | RESTRICTED | Unique par session | Hash avant stockage |

### 8.2 Secrets Non-Stockés en Base

| Secret | Ou il Reside | Protection |
|--------|-------------|-----------|
| Jetons d'acces en transit | Memoire volatile (requete courante) | Chiffrement transit |
| Cles de chiffrement actives | Key Manager (memoire) | CryptographicPort uniquement |
| Certificats TLS | Gestionnaire de certificats | TransportPort |
| Tokens de service en transit | Memoire volatile (requete courante) | Chiffrement transit |

---

## SECTION 9: REGLES NON NEGOCIABLES DE GESTION DES SECRETS

| Regle | Description | Source |
|-------|-------------|--------|
| SN-SEC-001 | Aucun secret n'est stocke dans le code source | Section 2.4 |
| SN-SEC-002 | Aucun secret ne sort de la Secret Zone en clair | SEC-SPEC-001 §5.5 |
| SN-SEC-003 | Un secret ne traverse jamais un endpoint API public | Section 3.3 |
| SN-SEC-004 | Tout acces a un secret est journalise | Section 7 |
| SN-SEC-005 | La rotation est automatique et程序ée | Section 4 |
| SN-SEC-006 | En cas de violation, revocation immediate | Section 5 |
| SN-SEC-007 | La destruction est irreversible | Section 6 |
| SN-SEC-008 | Les diagnostics CRT-008 ne contiennent jamais de secrets | RTS-001 CRT-008 |
| SN-SEC-009 | Les old/new values d'audit n'incluent jamais de secrets | SEC-SPEC-004 §8 |
| SN-SEC-010 | Les sauvegardes doivent etre chiffrees si contenant des secrets | Section 2.1 |

---

## SECTION 10: MATRICE DE TRACABILITE

| Section SEC-SPEC-005 | Source Canonique(s) | Reference |
|---------------------|--------------------|-----------|
| Secret Categories | SEC-SPEC-001 §4 | 5 data classification levels |
| Secret Storage | SEC-SPEC-001 Zone 5, BR-ID-001 | Only in Secret Zone |
| Secret Access | API-CONTRACT-004 | Role-based access to secrets |
| Secret Rotation | SEC-SPEC-002 §2.5, CRT-009 | Scheduler-managed rotation |
| Secret Breach Response | SEC-SPEC-001 P-SEC-006 | Fail secure, deny by default |
| Secret Destruction | DOC-015 RETENTION-031 | Secure deletion procedures |
| Secret Audit | DOC-015 AUD-001, OLDNEW-002 | All secret operations logged |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | security-specifier v1.0 | Creation — Secret Handling Rules pour Lumina v1 | COMPLIANT (trace verify contre SEC-SPEC-001, SEC-SPEC-002, SEC-SPEC-004, DOC-015) |

---

*Ce document operationalise la gestion des secrets derives du modele de securite de SEC-SPEC-001. Il complete SEC-SPEC-002 (Authentication), SEC-SPEC-004 (Encryption), et est necessaire a SEC-SPEC-006 (Audit & Compliance).*
