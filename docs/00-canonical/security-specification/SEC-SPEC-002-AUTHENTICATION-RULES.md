# Authentication Rules — Lumina v1

**Doc ID:** SEC-SPEC-002
**Version:** v1.0
**Statut:** REGLES D'AUTHENTIFICATION DEFINIES PAR GENESIS
**Date:** 2026-07-25
**Generateur :** security-specifier v1.0
**Source canonique :** ["SEC-SPEC-001", "API-CONTRACT-004", "DOC-015", "DOC-023"]
**Transformation_rule :** "security-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document etablit les regles d'authentification abstraites qui gouvernent la verification de l'identite des acteurs interagissant avec Lumina. Il definit les cycles de vie des credentials, la gestion des sessions, les politiques de mots de passe, la gestion des jetons et les mechanisms de protection contre les acces non autorises sans specifier aucune technologie concrete d'authentification.

**Regle constitutionnelle :** Aucune requete ne peut etre traitee sans verification prealable de l'identite de son acteur. Cette verification se fait toujours au perimetre de l'IdentityProviderPort. Aucune exception.

---

## SECTION 1: ABSTRACTION D'AUTHENTIFICATION

### 1.1 Definition Fondamentale

L'authentification est le processus abstrait par lequel un acteur prouve son identite aupres du systeme. Ce processus opere a la frontiere entre l'exterieur (Zone Externe de securite) et l'interieur (Zone Service) de l'application.

L'acteur presentee des elements de preuve (credentials). Le systeme verifie ces elements sans jamais les exposer en clair. La verification repose sur la comparaison avec des formes transformees stockees de maniere securisee (Zone Secret).

### 1.2 Principe de Stockage des Credentials

Tous les credentials soumis a l'authentification sont stocks sous une forme transformee irreversible ou pseudo-irreversible :

- Les credentials de type secret utilisateur (mots de passe, secrets de connexion) sont transforms via une fonction de hachage computationnel unique par credential. La transformation inclut un element de randomisation uniqute (sel) genere automatiquement a la creation de chaque credential.
- Les credentials de type jeton de service sont hashes de la meme maniere avant stockage dans la couche de persistance.
- En aucun cas un credential en clair n'est stocke, retourné, ou presente dans les journaux, diagnostics, ou exports.

### 1.3 Frontiere d'Authentification

L'authentification se deroule exclusively a l'Interface Publique API, au niveau de l'IdentityAggregate :

1. L'acteur presente ses credentials dans la requete entrante.
2. L'IdentityAggregate transmet les credentials a l'AuthenticationPort (boundary de l'IdentityProvider).
3. L'AuthenticationPort compare les credentials presentes avec les transformations stockees (CredentialStorePort).
4. Si la correspondance est etablie → l'acteur est autentifie ; le systeme cree une session et un jeton d'acces.
5. Si la correspondance echoue → E-401-001 NOT_AUTHENTICATED est retourne. Aucune information supplementaire n'est revelée sur la cause precise de l'echec (ni "utilisateur inexistant", ni "mot de passe incorrect").

L'erreur retournee doit etre generique : `E-401-001 NOT_AUTHENTICATED` avec le message : "Les credentials presentes ne sont pas valides." L'acteur ne sait pas si l'utilisateur existe ou si le secret est incorrect.

### 1.4 Authentication Par Type d'Acteur

| Type d'Acteur | Mechanisme d'Authentification | Presentation des Credentials |
|---------------|------------------------------|-----------------------------|
| Utilisateur Standard | Credentials (identifiant + secret) | Identifiant + secret verifies par IdentityAggregate |
| Compte de Service | Jeton de service associe a un compte enregistré | Jeton inclus dans les requetes système |
| Service de Synchronisation | Jeton dedie distinct des jetons utilisateurs | Jeton synch spécifié dans l'en-tête de requete system |
| SuperAdmin | Credentials renforcés + verification multi-facteurs supplementaire | Identifiant + secret + deuxieme facteur |
| Role de Migration | Credentials de service temporaires | Credentials temporaires valables uniquement pendant la fenetre de migration |

Chaque mecanisme d'authentification respecte les regles generales definies ci-dessus : transformation irreversible des credentials, stockage hashé, et verification par comparaison.

### 1.5 Regle de Non-Retour de Secrets

Les credentials transitants (presentes dans une requete) ne sont JAMAIS :
- Logs dans les journaux applicatifs (CRT-008)
- Retournees dans les reponses API
- presentes dans les messages d'erreur
- visibles dans les diagnostics techniques
- captures dans les valeurs old_values/new_values de l'audit

Cette regle s'applique a TOUT type de credential, quel que soit le mecanisme d'authentification utilise.

---

## SECTION 2: CYCLE DE VIE DES CREDENTIALS

### 2.1 Vue d'Ensemble du Cycle

Le cycle de vie complet d'un credential traverse six phases sequentielles. Chaque phase est geree par des composants dedies du systeme et fait partie integrante du modele de securite definit dans SEC-SPEC-001.

```
[Creation] → [Stockage] → [Verification] → [Rotation] → [Revocation] → [Destruction]
```

Chaque transition entre phases est tracee dans AuditAggregate.

### 2.2 Phase 1: Creation

La phase de creation est la premiere intervention du credential dans le systeme.

**Regles :**
- Un credential est cree exclusivement lors de la creation ou de la reinitialisation d'un compte.
- Au moment de la creation, un element de randomisation unique (sel) est genere automatiquement. Ce sel est stocke associe a la transformation du credential mais N'EST PAS un credential lui-meme.
- Le credential en clair est transmis au systeme, transforme, puis ecarte immediatement. Il ne quitte JAMAIS la zone de reception temporaire de la External Zone.
- Pour les comptes utilisateurs, la creation initiale se fait via les operations CreateUser du superadmin ou de l'admin (selon la hierarchie RBAC, API-CONTRACT-004).
- Pour les comptes de service, la creation se fait via une operation systeme autorisee.
- Pour le role de migration, les credentials sont crees dynamiquement au debut de la fenetre de migration et detruits automatiquement a sa fin.

**Invariant de validation :** BR-ID-001 — Tous les credentials doivent respecter la politique de complexite avant stockage.

### 2.3 Phase 2: Stockage

Apres transformation, seul le resultat hashé (associé au sel de generation) est persisté.

**Regles :**
- La version transformee du credential est stockee dans la table credentials de l'IdentityAggregate, dans la colonne de hachage specifiquement reservee a cet usage.
- Le credential en clair N'EXISTE PLUS dans le systeme apres cette phase. Il a ete ecarte de la memoire volatile aussitot la transformation effectuee.
- Le sel de generation est stocke associe au hash dans le systeme de persistance, permettant la verification future.
- Le stockage est protege par les regles de classification RESTRICTED (SEC-SPEC-001 §4). Seuls superadmin et admin ont l'autorisation de lire la table credentials.

**Classement de donnee :** RESTRICTED (SEC-SPEC-001 §4). Chiffrement au repos obligatoire selon SEC-SPEC-004.

### 2.4 Phase 3: Verification

La verification a lieu a chaque tentative de connexion.

**Processus :**
1. L'acteur presente ses credentials lors d'une requete d'authentification.
2. Le systeme recupere la version stockee du credential associe a l'identifiant presente.
3. Le systeme applique la meme transformation computationnelle au credential presente en utilisant le sel stocke.
4. Le resultat de la transformation presentee est compare de maniere chronologique-scurisée (temps constant) avec le resultat stocke.
5. Correspondance → authentification reussie. Creation de session.
6. Non-correspondance → echec d'authentification. Incrementation du compteur d'echecs (Section 6).

La comparaison se fait STRICTEMENT a l'interieur de l'IdentityAggregate, au contact du CredentialStorePort. Aucun credential en clair ne sort de la External Zone vers la Service Zone.

### 2.5 Phase 4: Rotation

La rotation est le remplacement programme d'un credential ancien par un nouveau.

**Calendrier de rotation par type d'acteur :**

| Type d'Acteur | Frequence de Rotation | Delai Avant Rotation Obligation | Gestionnaire |
|---------------|----------------------|--------------------------------|---------------|
| Utilisateur Standard | Tous les 90 jours | J-15 notification, J-0 obligation | Auto-notified + Admin force possible |
| SuperAdmin | Tous les 60 jours | J-7 notification, J-0 obligation | Auto-notified + MFA renforcee obligatoire |
| Compte de Service | Tous les 90 jours | J-0 rotation automatique | Scheduler systeme (CRT-009) |
| Sync Service | Tous les 60 jours | J-0 rotation automatique | Scheduler systeme (CRT-009) |
| Role de Migration | Une fois par fenetre | Fin de fenetre de migration | Cleanup automatique post-migration |

**Regles de rotation :**
- Un nouveau credential est genere et remplace l'ancien.
- L'ancien credential est marque comme expire dans les sessions actives (les sessions existantes continuent de fonctionner, mais une nouvelle authentication est necessaire a expiration).
- La rotation ne change pas le compte utilisateur — seulement le credential lie au compte.
- Une notification est envoyee avant la rotation pour informer l'acteur concerné.
- La rotation est tracee dans AuditAggregate : qui a provoque la rotation, quand, et quel compte concerne.

### 2.6 Phase 5: Revocation

La revocation met fin immediatement a la validite d'un credential.

**Causes de revocation :**
- Suspected compromise signale par l'acteur ou detecte par le systeme.
- Depart ou changement de role de l'utilisateur (admin force la revocation lors d'un changement de departement).
- Echec de rotation dans le delai imparti.
- Decision du superadmin (revocation globale de tous les credentials d'une organisation).
- Suspension de l'organisation (BR-ORG-006).

**Effets immediats de la revocation :**
1. Le credential marque comme revoke ne peut plus passer la phase de verification.
2. Toutes les sessions associées a ce credential sont invalidées.
3. L'acteur doit se reconnecter avec un nouveau credential.
4. L'evenement est journalisé dans AuditAggregate avec le niveau d'escalade approprié.

### 2.7 Phase 6: Destruction

La destruction est l'etape finale du cycle de vie d'un credential.

**Regles :**
- La destruction n'a lieu qu'apres une periode de retention minimale (alignée sur la politique de retention d'audit, RETENTION-031).
- La version hashée est supprimee de la table credentials par un processus dedie.
- La suppression est tracee dans AuditAggregate (si NB-PERSIST-007 le permet — voir Section VI.7).
- Les sessions actives associees au credential sont automatiquement invalidatees avant suppression.
- La destruction est irreversible : une fois le credential supprime, il ne peut pas etre restaure. Seule la recreation d'un nouveau credential est possible.

---

## SECTION 3: GESTION DES SESSIONS

### 3.1 Concept de Session

Une session represente la periode durant laquelle un acteur autentifie benefit d'un acces continu au systeme sans avoir a presenter ses credentials a chaque requete. La session est liee au token d'acces issu de l'authentification.

### 3.2 Creation de Session

**Preconditions :**
- Authentification reussie (verification du credential).
- Resolu org_id depuis la session (CRT-015).
- L'acteur n'a pas de limite de sessions concurrentes depassee.

**Donnees de session stockees :**
- Identifiant unique de session.
- Identifiant de l'acteur.
- Org_id associee.
- Role(s) de l'acteur.
- Horodatage de creation.
- Horodatage d'expiration prevu.
- Empreinte du dispositif (device fingerprint) pour lier la session a un appareil.
- Adresse IP de creation.
- Version du jeton de rafraichissement associee.

**Regles :**
- La duree de vie de la session est determinee par le role de l'acteur (voir Tableau 3.4).
- L'empreinte du dispositif est capturee et stockee pour la liaison de session.
- La session est creee dans la table sessions de l'IdentityAggregate.

### 3.3 Validation de Session

A chaque requete, le systeme valide la session associee au credential presente :

**Etapes de validation :**
1. Le token d'acces presente est extrait de la requete.
2. Le systeme verifie que le jeton n'est pas expire.
3. Le systeme verifie que la session est toujours active (non revoquee).
4. Le systeme verifie que l'org_id du token correspond bien au contexte attendu.
5. Le systeme verifie que l'empreinte du dispositif correspond a celle enregistree (pour les sessions liees).

**Si la validation echoue :**
- Token expire → E-401-002 SESSION_EXPIRED. L'acteur peut tenter un rafraichissement de token.
- Session revoquee → E-401-003 SESSION_REVOKED. Reconnexion obligatoire.
- Empreinte mismatch → E-401-004 DEVICE_MISMATCH. Reconnexion obligatoire.
- org_id mismatch → E-403-002 ORGANIZATION_MISMATCH.

### 3.4 Expiration de Session

**Durees maximales de session par role :**

| Role | Duree Maximale Session | Type de Session | Rafraichissement |
|------|----------------------|-----------------|------------------|
| superadmin | 4 heures | courte, monitorée | Obligatoire MFA a chaque renouvellement |
| admin | 8 heures | standard | Auto-rafraichissement possible |
| treasurer | 8 heures | standard | Auto-rafraichissement possible |
| pastor | 8 heures | standard | Auto-rafraichissement possible |
| staff | 8 heures | standard | Auto-rafraichissement possible |
| readonly | 4 heures | courte | Rafraichissement simple |
| service_account | 24 heures | longue (scheduler gere) | Rotation programmatique automatique |
| sync_service | 24 heures | longue (scheduler gere) | Rotation programmatique automatique |
| migration_role | Fenetre migration uniquement | temporaire | Inapte (lifetime defini par fenetre) |

Les durees ci-dessus representent les maximums. L'administrateur peut configurer des durees plus courtes via les parametres d'organisation (ConfigurationAggregate), mais jamais plus longues.

### 3.5 Limitation de Sessions Concurrentes

Pour gerer les risques lies aux connexions multiples simultanées :

| Role | Sessions Concurrentes Maximes | Comportement depassement |
|------|-----------------------------|------------------------|
| superadmin | 2 sessions | La session la plus ancienne est revoquee |
| admin | 5 sessions | La session la plus ancienne est revoquee |
| treasurer | 3 sessions | La session la plus ancienne est revoquee |
| pastor | 3 sessions | La session la plus ancienne est revoquee |
| staff | 5 sessions | La session la plus ancienne est revoquee |
| readonly | 3 sessions | La session la plus ancienne est revoquee |
| service_account | illimitee (scheduler gere) | N/A |
| sync_service | illimitee (scheduler gere) | N/A |
| migration_role | 1 session | La session precedente est revoquee |

### 3.6 Liaison par Empreinte de Dispositif

Chaque session peut etre liee a un dispositif spécifique via une empreinte capturee au moment de la creation.

**Regles :**
- L'empreinte est calculée a partir d'elements caractéristiques du dispositif (type, version OS, navigateur, identifiant technique).
- Si une requete presente une empreinte differente de celle enregistree → la session est consideree suspecte.
- Pour les sessions superadmin, la liaison est obligatoire.
- Pour les autres roles, la liaison est optionnelle et activee par l'administrateur de l'organisation.

### 3.7 Revoque de Session

Toute session peut etre revoquee independamment du cycle de vie du credential associe.

**Revoque par l'acteur :** Chaque acteur peut revoquer sa propre session actuelle ou toutes ses sessions via l'operation LogoutUser.

**Revoque par admin :** L'admin ou le superadmin peuvent revoquer les sessions de tout utilisateur de leur organisation via l'operation RevokeSession.

**Revoque automatique :** Les sessions expirees automatiquement par le scheduler (CRT-009) sont marquees comme expirees dans la base.

---

## SECTION 4: POLITIQUE DE MOT DE PASSE

### 4.1 Complexite Minimale

Tout credential de type secret utilisateur soumis a la creation ou a la rotation doit respecter les regles de complexite suivantes :

**Exigences fondamentales :**
- Longueur minimale de 12 caracteres.
- Contient au moins 3 des 4 categories suivantes : lettres minuscules, lettres majuscules, chiffres, caracteres speciaux non alphanumeriques.
- Ne contient pas plus de 3 repetitions consecutives du meme caractere.

### 4.2 Interdiction de Rech utilisation

- Le nouveau credential ne peut pas etre identique a l'un des N derniers credentials utilises (N = 12). Les hashes des N derniers credentials sont conserves pour cette verification.
- Si un utilisateur tente de reutiliser un ancien credential dans la fenetre de non-reutilisation, l'operation est rejtee avec E-400-007 PASSWORD_REUSED.

### 4.3 Analyse des Patterns Courants

Le systeme verifie que le credential ne contient pas de patterns couramment utilises comme credentials faibles :
- Sequences evidentes ("azerty", "123456", "qwerty").
- Mot du dictionnaire courant en tant que sous-chaine de plus de 6 caracteres.
- Information personnelle de l'utilisateur (nom, email, date de naissance) en tant que sous-chaîne de plus de 4 caracteres.
- Patterns répétés ("aaaaaa", "111111").

Ces vérifications se font côté réception dans la External Zone avant propagation vers la Service Zone.

### 4.4 Affichage du Credential

- Lors de la saisie, le credential peut etre affiche masqué par defaut (remplace par des caracteres generiques).
- Une option de visibilité temporaire est disponible mais n'est pas activee par défaut.
- Le credential n'est JAMAIS logué, meme avec la visibilité activee.

### 4.5 Reset Force de Credential

Quand un admin force la reinitialisation d'un credential (password:reset:any) :
- L'ancien credential est immediatement revoque.
- Toutes les sessions de l'utilisateur cible sont invalidatees.
- Un credential temporaire est genere et transmis a l'utilisateur par un canal externe a l'application (ex: email sécurisé, canal hors-ligne).
- L'utilisateur DOIT changer ce credential temporaire a sa prochaine connexion.
- Le changement forcé est journalisé dans AuditAggregate.

---

## SECTION 5: GESTION DES JETONS

### 5.1 Types de Jetons

Le systeme utilise trois types de jetons abstrait, chacun avec un cycle de vie et un perimetre d'utilisation differs :

| Type de Jeton | Duree de Vie | Perimetre | Stocke ? | Refreshable |
|--------------|-------------|-----------|----------|-------------|
| Jeton d'acces | Courte (alignee sur la session) | Operations autorisees par le role | Oui (en memoire coté client) | Non (nouvelle emission requise) |
| Jeton de rafraichissement | Longue (multi-session) | Renouvellement de jeton d'acces | Hashé en base (sessions.table) | Oui (rotation a chaque utilisation) |
| Jeton de service | Defini par le compte | Capabilities declarees dans le compte | Hashé en base | Rotation programmée |

### 5.2 Emission de Jeton

Apres une authentification reussie :
1. Un jeton d'acces est emis avec les permissions scopees au role de l'acteur.
2. Un jeton de rafraichissement est emis (si applicable au type d'acteur).
3. Le jeton de rafraichissement est hashé avant stockage dans la session.
4. Les jetons sont retournes au client dans une reponse structuriée ne contenant AUCUN credential en clair.

### 5.3 Inclusion dans les Requetes

Chaque requete ultérieure doit presenter le jeton d'acces dans l'en-tête d'authorisation de la requete entrante. Le jeton est extrait et valide au premier étage de la security layers map (SEC-SPEC-001 Layer 1).

**Regles :**
- Le jeton ne doit pas etre present dans les URLs (parametres de requete).
- Le jeton ne doit pas etre stocke dans les logs ou les fichiers de configuration.
- Le jeton est valide uniquement pour l'org_id declare dans sa payload.

### 5.4 Validation a Chaque Hop

A chaque reception de requete contenant un jeton :
1. Le jeton est extrait et decode structurellement (sans verifie de signature concrète — ce detail estdelegate a l'adapter du TransportPort).
2. L'org_id resident dans le jeton est compare avec celui resolue par CRT-015.
3. Les permissions scopees dans le jeton sont verifiees contre l'operation demandée (RBAC matrix, SEC-SPEC-003).
4. La date d'expiration du jeton est verifiée.
5. La liste de revocation des jetons est vérifiée (si le jeton y figure → revoqué).

### 5.5 Mecanisme de Rafraichissement

Le rafraichissement de jeton permet de renouveler un jeton d'acces expire sans re-authentifier l'utilisateur :

1. Le client presente le jeton de rafraichissement valide.
2. Le systeme verifie que le jeton existe en base (hash matching) et n'est pas expire.
3. Un nouveau jeton d'acces est emis.
4. L'ancien jeton de rafraichissement est rotate (un nouveau jeton de rafraichissement est emis, l'ancien est marké utilisé).
5. Le cycle de vie de la session n'est pas affecte.

### 5.6 Revocation de Jeton

Un jeton peut etre revoque pour plusieurs raisons :
- Revocation de toute la session associée.
- Rotation de credential utilisateur.
- Suspension du compte utilisateur.
- Decision du superadmin ou admin.
- Expiree naturelle.

Les jetons revoques sont ajoutes a une liste de revocation consulteée a chaque validation de jeton.

---

## SECTION 6: VERROUILLAGE DE COMPTE

### 6.1 Seuil de Verrouillage

Après un nombre configure d'echecs consecutifs de verification de credentials pour un meme compte :

| Type de Compte | Seuil d'Echecs Consecutifs | Action |
|---------------|---------------------------|--------|
| Utilisateur Standard | 10 echecs consecutifs | Verrouillage automatique |
| SuperAdmin | 5 echecs consecutifs | Verrouillage automatique (plus strict) |
| Compte de Service | Non applicable (pas d'interface de connexion humaine) | N/A |
| Sync Service | Non applicable | N/A |
| Role de Migration | Non applicable | N/A |

Le compteur d'echecs se remet a zero apres un succes d'authentification.

### 6.2 duree de Verrouillage

La durée de verrouillage depend du nombre d'echecs consecutifs observes :

| Nombre d'Echecs | Duree de Verrouillage |
|----------------|---------------------|
| 10 (seuil standard) | 30 minutes |
| 15 (seuil etendu) | 2 heures |
| 20 (seuil critique) | 24 heures |
| 30+ (seuil alarme) | Intervention superadmin necessaire |

### 6.3 Procedure de Deverrouillage

**Deverrouillage automatique :**
- Apres la periode de verrouillage ecoulée, le compteur d'echecs est remis a zero.
- L'acteur peut tentér une nouvelle connexion.

**Deverrouillage manuel par admin :**
- L'admin ou le superadmin peut deverrouiller manuellement tout compte verrouillé dans son périmètre.
- Cette action est journalisée dans AuditAggregate.
- Le compteur d'echecs est remis a zero.

**Deverrouillage d'urgence par superadmin :**
- Le superadmin peut deverrouiller tout compte de toute organisation en cas d'urgence operative.
- Cette action declenche une notification immédiate a tous les admins des organisations concernées.

### 6.4 Notification a l'Acteur

En cas de verrouillage de compte :
- L'acteur est notifié par le canal preference defini dans ses notification preferences.
- Le message indique : "Votre compte a été temporairement bloque pour des raisons de sécurité. Veuillez réessayer dans [duree]."
- Le message NE REVELE PAS le nombre exact d'echecs observes (privacy protection).
- Si le verrouillage dépasse le seuil critique, une notification supplementaire est envoyee a l'administrateur de l'organisation.

### 6.5 Protection Anti-Bruteforce

Au-dela du verrouillage de compte individuel, le systeme implémente des protections au niveau org :
- Limite globale de tentatives d'authentification échouées par org par periode de 1 heure.
- Si le seuil global est depassé → toutes les tentatives d'authentification de l'org sont temporairement rate-limitées (1 tentative par minute pendant 15 minutes).
- Ce rate limiting est transitoire et n'affecte PAS les operations deja autentifiées.

---

## SECTION 7: AUTHENTIFICATION MULTI-FACTEUR

### 7.1 Contextes d'Utilisation Obligatoire du MFA

L'authentification multi-facteurs (MFA) est obligatoire dans les contextes suivants :

| Contexte | Actors Concernés | Fréquence |
|----------|-----------------|-----------|
| Operations superadmin critiques (creation d'autres superadmin, changement de role utilisateur, bypass RLS, suspension/merger d'organisations) | superadmin | Chaque opération |
| Reinitialisation de credentials pour autrui | admin, superadmin | Chaque reset |
| Premiere connection sur un nouvel appareil non reconnu | Tous les actors humains | Une seule fois par appareil |
| Accés aux donnees de la table credentials | superadmin, admin | Chaque accès |

### 7.2 Architecture Abstraite du MFA

Le mecanisme MFA repose sur le principe que l'acteur doit presenter au moins deux facteurs independants parmi les categories suivantes :

| Facteur | Description | Examples dans Lumina |
|---------|-------------|---------------------|
| Facteur 1 — Quelque chose que l'acteur sait | Secret connu uniquement de l'acteur | Mot de passe / secret de connexion |
| Facteur 2 — Quelque chose que l'acteur possede | Objet physique ou logiciel controle par l'acteur | Appareil mobile pour reception de code, jeton matériel |
| Facteur 3 — Quelque chose que l'acteur est | Caracteristique biologique ou comportementale de l'acteur | Empreinte digitale, reconnaissance faciale (si disponible sur le dispositif) |

Le systeme exige toujours au moins 2 facteurs parmi 3 categories differentes. Deux facteurs de la même catégorie ne sont pas consideres comme suffisamment independants.

### 7.3 Flot de Verification MFA

1. L'acteur presente le Facteur 1 (credential principal).
2. La verification du Facteur 1 reussit → le systeme declenche la demande du Facteur 2.
3. L'acteur presente le Facteur 2.
4. La verification du Facteur 2 reussit → l'authentification complete est etablie.
5. Un jeton d'acces est émis avec la flag MFA_verified = true.
6. Les operations critiques exigent MFA_verified = true.

### 7.4 Gestion des Appareils de Confiance

Quand un nouvel appareil est detecté pour la première fois :
- L'acteur doit compléter le MFA obligatoirement sur cet appareil.
- Apres verification reussie MFA, l'appareil peut etre marque comme "confiance".
- Un appareil de confiance beneficie d'une verification MFA reduite (un seul facteur supplementaire au lieu de deux) pendant une periode de confiance de 30 jours.
- Apres expiration de la periode de confiance, le MFA complet est de nouveau requis.
- L'admin peut gerer la liste des appareils de confiance de ses utilisateurs (revoquer des appareils de confiance).

---

## SECTION 8: TRACABILITE ET AUDIT D'AUTHENTIFICATION

### 8.1 Evenements d'Authentification a Journaliser

Tous les evenements下述 sont captures dans AuditAggregate :

| Evenement | Direction | old_values | new_values |
|-----------|-----------|------------|------------|
| Succes d'authentification | CREATE | — | {user_id, org_id, role, device_fingerprint, ip_address, timestamp} |
| Echec d'authentification | CREATE | — | {attempted_identifier, ip_address, failure_count, timestamp} |
| Creation de session | CREATE | — | {session_id, user_id, org_id, device_fingerprint, expires_at} |
| Expiration de session | UPDATE | {session_id, expires_at} | {session_id, status: expired} |
| Revoque de session | UPDATE | {session_id, user_id, reason} | {session_id, status: revoked} |
| Rotation de credential | UPDATE | {credential_type, rotation_date} | {credential_type, rotation_date, new_hash_reference} |
| Verrouillage de compte | UPDATE | {user_id, status: active} | {user_id, status: locked, lock_expiry} |
| Deverrouillage de compte | UPDATE | {user_id, status: locked} | {user_id, status: unlocked} |
| MFA bypass attempt | CREATE | — | {user_id, method_failed, timestamp} |

### 8.2 Regles d'Audit d'Authentification

- Les entries d'audit d'authentification ne contiennent JAMAIS de credentials en clair, ni de hashes, ni de tokens.
- Les adresses IP sont stockees telles quelles (donnee interne).
- Les fingerprints de dispositif sont stockés hashes (donnee confidentielle side systeme).
- La frequency d'audit de ces entries suit la retence normale d'audit (7 ans minimum, RETENTION-031).

---

## SECTION 9: ERREURS D'AUTHENTIFICATION

### 9.1 Taxonomie des Erreurs

| Code Erreur | Signification | Reponse Retournée |
|------------|--------------|-------------------|
| E-401-001 | Credentials invalides | "Les credentials presentes ne sont pas valides." |
| E-401-002 | Session expiree | "Votre session a expire. Veuillez vous reconnecter ou rafraichir votre jeton." |
| E-401-003 | Session revoquee | "Votre session a ete interrompue. Veuillez vous reconnecter." |
| E-401-004 | Empreinte de dispositif invalide | "Dispositif non reconnu. Veuillez vous reconnecter." |
| E-401-005 | Jeton revoque | "Votre jeton a ete revoque. Veuillez vous reconnecter." |
| E-401-006 | Compte verrouillé | "Votre compte est temporairement bloque. Veuillez réessayer plus tard." |
| E-401-007 | MFA requis | "Verification multi-facteurs requise pour cette operation." |
| E-401-008 | MFA echoué | "La verification multi-facteurs a echoue. Veuillez resaisir votre code." |
| E-401-009 | Jeton de rafraichissement invalide | "Le jeton de rafraichissement n'est pas valide. Reconnexion requise." |
| E-400-007 | Credential reutilise | "Ce credential a deja ete utilise. Veuillez en choisir un nouveau." |

### 9.2 Principles de Messages d'Erreur

- Les messages ne donnent JAMAIS d'indices sur la cause precise de l'echec.
- Ils sont generiques et orientes vers la resolution ("veuillez vous reconnecter").
- Ils ne mentionnent AUCUNE technologie ou framework d'authentification.
- Les codes d'erreur sont internes au systeme et ne sont pas exposes tels quels a l'utilisateur final.

---

## SECTION 10: REGLES NON NEGOCIABLES D'AUTHENTIFICATION

| Regle | Description | Source |
|-------|-------------|--------|
| SN-AUTH-001 | Aucun credential en clair n'est JAMAIS stocke, logue, ou retourne | SEC-SPEC-001 P-SEC-005 |
| SN-AUTH-002 | L'org_id est TOUJOURS resolu depuis la session, JAMAIS depuis un parametre HTTP | SEC-SPEC-001 SN-001 |
| SN-AUTH-003 | Le comportement par defaut face a une incertitude d'authentification est DENY | SEC-SPEC-001 P-SEC-006 |
| SN-AUTH-004 | L'echec d'audit d'authentification N'EST PAS une raison de rollback une connexion | SEC-SPEC-001 SN-005 |
| SN-AUTH-005 | Tous les evenements d'authentification sont journa lises avec old/new values | DOC-015 AUD-002 |
| SN-AUTH-006 | L'authentification est obligatoire AVANT toute operation dans la Service Zone | SEC-SPEC-001 Couche 1 |
| SN-AUTH-007 | La limitation par seuil s'applique avant le verrouillage complet | Section 6 de ce document |
| SN-AUTH-008 | Le MFA est obligatoire pour les operations superadmin critiques | Section 7 de ce document |
| SN-AUTH-009 | Les tokens ne transitent que dans les headers, jamais dans les URLs | Section 5 de ce document |
| SN-AUTH-010 | Les diagnostics CRT-008 ne contiennent JAMAIS de données d'identification | RTS-001 CRT-008 |

---

## SECTION 11: MATRICE DE TRACABILITE

| Section SEC-SPEC-002 | Source Canonique(s) | Reference |
|---------------------|--------------------|-----------|
| Authentication Abstraction | SEC-SPEC-001 §1, §5 | 5 security zones, defense in depth |
| Credential Lifecycle | SEC-SPEC-001 P-SEC-005, BR-ID-001 | Hash storage, never plaintext |
| Session Management | SEC-SPEC-001 §2, CRT-015 | Session lifecycle, org_id resolution |
| Password Policy | SEC-SPEC-001 P-SEC-005, BR-ID-001 | Complexity requirements |
| Token Management | SEC-SPEC-001 §2, ASS-001 | Token issuance and validation |
| Account Lockout | SEC-SPEC-001 P-SEC-006 | Fail secure by default |
| Multi-Factor Auth | SEC-SPEC-001 Actor Model | Superadmin hardened auth |
| Audit Logging | DOC-015 AUD-001, OLDNEW-002 | Every auth event captured |
| Error Handling | API-CONTRACT-005 | Error taxonomy for auth failures |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | security-specifier v1.0 | Creation — Authentication Rules pour Lumina v1 | COMPLIANT (trace verify contre SEC-SPEC-001, API-CONTRACT-004, DOC-015, DOC-023) |

---

*Ce document operationalise les regles d'authentification derivees du modele de securite de SEC-SPEC-001. Il complete SEC-SPEC-003 (Authorization) et SEC-SPEC-005 (Secret Handling).*
