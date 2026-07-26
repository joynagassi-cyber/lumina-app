# Encryption Rules — Lumina v1

**Doc ID:** SEC-SPEC-004
**Version:** v1.0
**Statut:** REGLES DE CHIFFREMENT DEFINIES PAR GENESIS
**Date:** 2026-07-25
**Generateur :** security-specifier v1.0
**Source canonique :** ["SEC-SPEC-001", "DOC-015", "DOC-023"]
**Transformation_rule :** "security-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRINCIPE

Ce document etablit les regles de chiffrement et de hachage abstraites qui gouvernent la protection des donnees sensibles dans Lumina. Il definit les exigences par classe de donnee, le cycle de vie des cles, les regles de chiffrement au repos et en transit, et les exigences de hachage pour les credentials.

**Regle constitutionnelle :** Aucune donnee sensible ne peut exister non protegee. Chaque niveau de classification de donnee (SEC-SPEC-001 §4) impose des exigences de chiffrement spécifiques. Ce document specifie QUOI proteger, pas COMMENT proteger — les algorithmes et protocoles exacts sont des details d'implementation delegues a l'adaptateur CryptographicPort.

---

## SECTION 1: EXIGENCES DE CHIFFREMENT PAR CLASSE DE DONNEE

### 1.1 Mapping Classification → Exigences de Protection

Chaque niveau de classification defini dans SEC-SPEC-001 §4 a un ensemble d'exigences de chiffrement derivees :

| Classe de Donnee | Chiffrement au Repos | Chiffrement en Transit | Hashing | Access Logging | Retention |
|-----------------|--------------------|----------------------|---------|---------------|-----------|
| **PUBLIC** | Non requis | Recommande (best-effort) | Non applicable | Non requis | Aucune restriction |
| **INTERNAL** | Non requis (org_id filtre suffisant) | Obligatoire (bout-en-bout) | Non applicable | Requise pour ecritures | Standard (7 ans) |
| **CONFIDENTIAL** | OBLIGATOIRE | OBLIGATOIRE (bout-en-bout) | Non applicable | Requise pour lecture ET ecriture | Limitee au necessaire |
| **RESTRICTED** | OBLIGATOIRE (hash computationnel irreversible) | OBLIGATOIRE (transit uniquement) | OBLIGATOIRE pour credentials | Requise pour TOUT acces | Rotation programmatique |
| **AUDIT-ONLY** | Stocke separement des donnees auditées | Non applicable si interne | Non applicable | Par definition — immuable | 7+ ans minimum |

### 1.2 Regle de Protection Croisante

Une donnee de classification RESTRICTED beneficie de TOUS les protections des niveaux inferieurs (PUBLIC, INTERNAL, CONFIDENTIAL). Une donnee CONFIDENTIEL beneficie des protections INTERNAL et PUBLIC. La classification la plus haute s'applique.

### 1.3 Donnees par Tableau — Classification et Protection

Les tableaux de lumina et leur classification de donnees (de SEC-SPEC-001 §4) imposent les exigences suivantes :

| Niveau | Tables | Exigence de Protection Specifique |
|--------|--------|----------------------------------|
| PUBLIC | organizations (nom seulement), vocab_namespaces, vocab_terms, vocab_values | Aucune protection speciale au-dela du chiffrement standard en transit |
| INTERNAL | transactions, members, events, org_units, group_memberships, org_unit_links, workflow_instances/steps/logs, forms/sections/fields, notifications, reports/snapshots, archives, purge_schedules, pending_operations, sync_statuses | Chiffrement transit obligatoire. Filtrage org_id obligatoire. Audit ecritures obligatoire. |
| CONFIDENTIAL | users (email, phone, date_of_birth), notification_preferences | Chiffrement au repos OBLIGATOIRE sur les champs personnels. Chiffrement transit obligatoire. Logging d'acces renforce. |
| RESTRICTED | credentials (password_hash), sessions (refresh_token_hash) | Hashing computationnel avec sel unique pour credentials. Hash avant stockage pour refresh tokens. Jamais en clair nulle part. |
| AUDIT-ONLY | audit_entries | Stocke separement. Append-only. Immutable. Conservation minimale 7 ans. |

---

## SECTION 2: ABSTRACTION DE GESTION DES CLES

### 2.1 Cycle de Vie des Cles de Chiffrement

Le cycle de vie d'une cle de chiffrement traverse quatre phases sequentielles :

```
[Generation] → [Stockage] → [Rotation] → [Destruction]
```

### 2.2 Phase 1: Generation

- Les cles de chiffrement sont generees automatiquement par un generateur dedie au moment de la configuration initiale du systeme ou du tenant.
- Chaque generation produit une cle unique avec un identifiant de version associe.
- Les cles sont stockees dans la Secret Zone (SEC-SPEC-001 §5.5), accessible uniquement via le CryptographicPort.
- La complexite minimale de la cle est determinee par la criticite des donnees protegees.

**Regles de generation :**
- Une nouvelle cle est geneérée pour chaque tenant ou environment de deploiement.
- La generation est tracee dans les logs administratifs mais ne produit PAS d'entries d'audit dans AuditAggregate (generation infrastructurelle, pas metier).
- Les cles N'APPARAISSENT JAMAIS dans les logs, diagnostics, exports, ou reponses API.

### 2.3 Phase 2: Stockage

- Les cles de chiffrement activees sont stockees dans un magasin de cles abstrait accessible uniquement via le CryptographicPort.
- Les cles au repos sont elles-memes chiffrees ou stockees dans un conteneur protege.
- L'acces aux cles est limite aux composants du systeme ayant besoin de chiffrer/déchiffrer des donnees.
- L'accès en clair aux cles N'EST PAS possible depuis l'exterieur de la Secret Zone.

### 2.4 Phase 3: Rotation

- Les cles de chiffrement sont rotatees selon un calendrier programme defini par le type de donnee protege :

| Type de Cle Protegee | Frequence de Rotation | Delai Avant Rotation | Gestionnaire |
|---------------------|---------------------|--------------------|-------------|
| Cle de chiffrement de donnees CONFIDENTIELLES | Tous les 365 jours | J-30 notification planifiee | Scheduler systeme (CRT-009) |
| Cle de chiffrement de donnees RESTRICTEDES | Tous les 180 jours | J-14 notification planifiee | Scheduler systeme (CRT-009) |
| Sel de hashing de credentials | Unique par credential | N/A — pas de rotation car le sel est fixe par hash | N/A |

- Lors de la rotation, les nouvelles cles sont genérees, les anciennes sont marquees comme en cours de depreciation, et les donnees chiffrees sont retirees progressivement vers la nouvelle cle.
- Durant la periode de depreciation, les deux versions de cles peuvent etre utilisées pour le déchiffrement (lecture), mais seul le nouveau cle peut etre utilisé pour le chiffrement (ecriture).
- La rotation est completement transparente pour les acteurs utilisateurs.

### 2.5 Phase 4: Destruction

- Les cles dechuees sont supprimees de maniere securisée.
- La destruction est irreversible : les donnees chiffrees avec une cle destruite ne peuvent plus etre lues.
- La destruction est tracee dans les logs administratifs.
- NB-PERSIST-007 s'applique : la destruction de cles N'est PAS journalisée dans AuditAggregate.

---

## SECTION 3: CHIFFREMENT AU REPOS

### 3.1 Champ par Champ — Identification des Donnees a Chiffrer

Toutes les donnees classées CONFIDENTIEL et RESTRICTED doivent être chiffrees sur le support de stockage physique :

#### Champs de Credentials (RESTRICTED)
- `password_hash` dans la table credentials : stocké sous forme de hash computationnel irreversible. Le credential original n'est jamais stocké en clair. Le sel de generation est stocke associe au hash.
- Le hash est calcule au moment de la creation/reinitialisation du credential puis le secret original est ecarte immediatement.

#### Champs de Données Personnelles (CONFIDENTIAL)
- `email` dans la table users : chiffree au repos. L'email reste visible en transit pour l'unicite mais est stocke hashé/chiffré dans la base.
- `phone` dans la table users : chiffree au repos.
- `date_of_birth` dans la table users : chiffree au repos.
- `notification_channels`, `quiet_hours_enabled`, etc. dans notification_preferences : chiffrees au repos.

#### Champs de Tokens (RESTRICTED)
- `refresh_token_hash` dans la table sessions : hashé avant stockage (la valeur presentee est hashée et comparee au hash stocke).
- Les tokens en transit ne sont JAMAIS stocks au repos (ils existent uniquement en memoire volatile).

#### Champs Systemes Internes
- Les hashes de cles de service dans les tokens de service : hashes avant stockage.
- Les fingerprints de dispositif : hashes avant stockage (ne contiennent aucune information identifying direct).

### 3.2 Chiffrement Transparent au Domaine

Le chiffrement au repos est implementé au niveau de la couche Persistence/Repository. L'Aggregate du domaine NE CONNAIT PAS si ses donnees sont chiffrees au repos :

```
Domain Aggregate → RepositoryPort → [CryptographicPort decrypt] → Persistance
Domain Aggregate → RepositoryPort ← [CryptographicPort encrypt] ← Persistance
```

L'Aggregate voit toujours des donnees en clair. Le chiffrement/transformation est une preoccupation exclusive de la Data Zone (SEC-SPEC-001 Zone 4).

### 3.3 Chiffrement des Exports et Rapports

Lorsqu'une operation d'export (EXPORT-001) genere un fichier contenant des donnees CONFIDENTIELLES ou INTERNAL :
- Le contenu du rapport doit inclure un horodatage de generation.
- Si le rapport contient des donnees classées CONFIDENTIEL, le fichier exporté doit lui-meme etre chiffre ou protège par un acces controle.
- Le rapport ne contient JAMAIS de credentials en clair, ni de hashes, ni de tokens.

---

## SECTION 4: CHIFFREMENT EN TRANSIT

### 4.1 Obligation de Chiffrement Bout-en-Bout

Toutes les communications entre client et serveur, entre services, et entre composants internes traversant un perimetre non fiable utilisent un canal chiffre bout-en-bout :

| Flux de Communication | Chiffrement Requis | Perimetre Securisé |
|----------------------|-------------------|-------------------|
| Client externe → API Layer | Obligatoire | External Zone → Service Zone |
| API Layer → Application Service | Obligatoire si perimetre traverse | Service Zone interne |
| Application Service → Domain Layer | Interne (memorise) | Pas de chiffrement en transit requis (same process) |
| Domain Layer → Persistence Layer | Obligatoire si base distante | Data Zone → Data Storage |
| Service Account / Sync Service ↔ API | Obligatoire | External Zone → Service Zone |
| Migration Role ↔ Schema | Non applicable (DDL uniquement) | N/A |

### 4.2 Negociation Echouée = Deconnexion

Si la negociation du canal chiffre echoue pour une connexion entrante :
- La connexion est IMMEDIATEMENT fermée.
- Aucun echo d'erreur technique n'est retourne.
- Un evenement de securite est capture dans les logs (sans detail de l'echec de negociation).
- L'acteur doit renouveller la tentative de connexion.

### 4.3 Protection des Tokens en Transit

- Les jetons d'acces et de rafraichissement transitent exclusivement via des en-têtes de requête chiffrés.
- ILS NE SONT JAMAIS transmis via des parametres URL, des cookies non chiffrés, ou des corps de requete non proteges.
- Les jetons en transit sont valables uniquement pour le tenant declare.

---

## SECTION 5: EXIGENCES DE HACHAGE

### 5.1 Hashing des Credentials Utilisateur

Les credentials de type mot de passe/secret doivent absolument utiliser un hashing computationnel avec sel unique :

**Propriétés requises du hachage de credentials :**
1. **Computational :** Le hachage doit etre intentionnellement coûteux en temps de calcul, rendant les attaques par force brute pratiquement impossibles.
2. **Avec Sel Unique :** Chaque credential utilise un sel differents genere automatiquement. Deux credentials identiques mais pour des utilisateurs differents produisent des hashes differents.
3. **Irréversible :** Le hash ne peut pas être inversé pour retrouver le credential original. C'est une proprieté fondamentale de la fonction de hachage utilisee.
4. **Stable :** Pour un meme credential et un meme sel, le hash produit est toujours identique (pour permettre la verification).

**Processus de verification :**
1. Le credential presente est pris en entree avec le sel stocké.
2. La meme transformation computationnelle est appliquee.
3. Le hash resultant est compare au hash stocke.
4. Comparaison chrono-sécurisée (temps constant) pour prevenir les attaques par timing.

### 5.2 Hashing des Refresh Tokens

Avant stockage dans la table sessions, la valeur du refresh token est hashée :
- Le hash est stocké, pas la valeur en clair.
- Lors de la verification d'un refresh token, la valeur presentee est hashée et comparée au hash stocké.
- En cas de reussite de refresh, l'ancien hash est remplace par un nouveau hash (rotation du token).
- Les refresh tokens en transit (presentes dans les requêtes) ne sont jamais logues.

### 5.3 Hashing des Fingerprints de Dispositif

Les empreintes de dispositif capturees lors de la creation de session sont hashées avant stockage :
- Le fingerprint brut est utilisé uniquement pour le calcul du hash.
- Le hash du fingerprint est stocké dans la table sessions.
- La comparaison de fingerprint à la validation de session se fait par correspondance de hash.

### 5.4 Regles Generales de Hachage

- AUCUN hash de credential n'apparait dans les logs, diagnostics, exports, ou reponses API.
- AUCUN hash de credential n'est present dans les valeurs old_values ou new_values de AuditAggregate.
- Les hashes sont consideres comme des donnees RESTRICTED (SEC-SPEC-001 §4).
- La table credentials est accessible UNIQUEMENT par superadmin et admin.

---

## SECTION 6: STOCKAGE DES JETONS

### 6.1 Refresh Tokens

- Valeur hashée avant stockage dans la table sessions (colonnen refresh_token_hash).
- Le hash associe est lie a la session courante.
- A chaque utilisation de refresh, le hash est rotate (nouvelle paire token-hash).
- Les anciens hashes sont invalides apres rotation.

### 6.2 Transport Tokens

- Les jetons d'acces (transport tokens) ne sont JAMAIS stocks au repos.
- Ils existent uniquement en memoire volatile (coté client et coté serveur durant la requête).
- Ils expirent selon la duree definie pour le role de l'acteur (SEC-SPEC-002 §3.4).
- Leur validation se fait par decodage structurel du token presenté dans la requête.

### 6.3 Service Tokens

- Associes a un compte de service enregistré.
- Hashes avant stockage dans le systeme de persistance.
- Rotates programmiquement via CRT-009 (scheduler).
- Non-stockes en clair dans les fichiers de configuration.

---

## SECTION 7: NEUTRALITÉ CRYPTOGRAPHIQUE

### 7.1 Position Abstraite du Document

Ce document NE NOMME AUCUN algorithme, protocole, bibliotheque, ou implémentation cryptographique concrete. Il definit UNIQUEMENT :
- QUOI proteger (classes de donnees)
- QUAND protéger (au repos, en transit)
- COMMENT de maniere abstraite (hashing computationnel avec sel, chiffrement bout-en-bout)
- QUI est autorise (roles d'acces)

### 7.2 Deleguation a l'Implementation

Le choix des algorithmes de chiffrement et de hachage est entierement delegate a la couche d'implementation :

- **CryptographicPort** : L'adaptateur selectionné au composition root decide quels algorithmes utiliser, selon les contraintes du deploiement (ex: capabilities du materiel, reglementation locale, exigences de performance).
- **TransportPort** : L'adaptateur de transport decide quels protocoles de chiffrement utiliser pour les communications en transit.
- **CredentialStorePort** : L'adaptateur decide de la fonction de hachage computationnelle pour les credentials.

### 7.3 Contraintes Minimalos de l'Implementation

Bien que ce document ne nomme aucun algorithme, il impose des proprietes minimales que toute implementation doit satisfaire :

| Propriété | Description Minimale |
|-----------|--------------------|
| Irreversibilité des credentials | Impossible de reconstruire le credential original depuis son hash |
| Unicité par sel | Deux credentials identiques mais sel different produisent des hashes differents |
| Resistance aux collisions | Impossibilité pratique de trouver deux inputs produisant le meme hash |
| Coût computationnel des credentials | Le hash doit etre suffisamment lent pour rendre le bruteforce impraticable |
| Clandestinité des tokens | Impossible de deviner un token valide sans acceder au secret de generation |
| Confidentialité du transit | Lecture impossible du contenu echangé sans les cles de negociation |

### 7.4 Evolution Algorithmique

L'implémentation peut changer d'algorithme a tout moment sans modification de ce document, tant que les proprietes minimales ci-dessus restent satisfaites :
- L'update de hachage des credentials : migration transparente des hashes existants vers le nouvel algorithme.
- L'update de chiffrement : rotation des cles (Section 2.4) avec depreciation progressive de l'ancien algorithme.
- Aucune action utilisateur n'est necessaire pour une evolution d'algorithme.

---

## SECTION 8: INTEGRITE DE LA TRACABILITE D'AUDIT

### 8.1 Entries d'Audit et Donnees Sensibles

Les entries d'audit (AuditAggregate) enregistrent le statut de chiffrement des operations mais ne stockent JAMAIS les secrets eux-memes :

| Champ Audit | Contient des Secrets ? | Explication |
|------------|----------------------|-------------|
| old_values | NON | Copie de l'état AVANT l'operation, avec les champs secrets masqués ou excludes |
| new_values | NON | Copie de l'état APRES l'operation, avec les champs secrets masqués ou excludes |
| action | NON | Type d'operation (create, update, delete, etc.) |
| entity_type | NON | Type de l'entité auditee |
| user_id | NON | Identifiant de l'utilisateur (pas de credential) |

### 8.2 Masquage des Secrets dans l'Audit

L'AuditEnabler (CRT-014) filtre automatiquement les valeurs sensibles avant de les inscrire dans old_values/new_values :

```
Si champ == password_hash → exclu de old_values et new_values
Si champ == refresh_token → exclu de old_values et new_values
Si champ == any_credentials_column → exclu de old_values et new_values
```

**Exception notable :** L'AuditAggregate ne contient PAS de donnees des champs de la Secret Zone (SEC-SPEC-001 Zone 5). L'AuditEnabler intercepte ces donnees et les exclut systematiquement.

### 8.3 Conservation des Entries d'Audit

- Les entries d'audit sont conservees au minimum 7 ans (RETENTION-031).
- Les entries liées a des operations de sécurité (brute-force detecté, revocation multiple, bypass RLS) peuvent etre conservees plus longtemps selon la politique de retention securitaire (10+ ans recommande).
- Les entries d'audit ne peuvent PAS etre modifiées ou supprimées pendant la periode de retention (NB-PERSIST-006).
- La purge d'entries d'audit expirees est geree par un processus dedie et NE genere PAS de notification dans AuditAggregate (NB-PERSIST-007).

---

## SECTION 9: REGLES NON NEGOCIABLES DE CHIFFREMENT

| Regle | Description | Source |
|-------|-------------|--------|
| SN-CRYPT-001 | Les credentials sont JAMAIS stocks en clair | SEC-SPEC-001 P-SEC-005, BR-ID-001 |
| SN-CRYPT-002 | Le chiffrement est transparant pour le Domaine | SEC-SPEC-001 Zone 5 |
| SN-CRYPT-003 | Les algorithms choisis par l'implementation doivent satisfaire les proprietes minimales | Section 7.3 |
| SN-CRYPT-004 | Aucun secret ne traverse la Frontiere Secret Zone en clair | SEC-SPEC-001 Zone 5 |
| SN-CRYPT-005 | L'audit capture le status encryption mais jamais les secrets | Section 8 |
| SN-CRYPT-006 | La rotation des cles est automatique et transparente | Section 2.4 |
| SN-CRYPT-007 | L'echec de chiffrement en transit = deconnexion immediate | Section 4.2 |
| SN-CRYPT-008 | Diagnostic CRT-008 ne contient jamais de donnees de la Secret Zone | RTS-001 CRT-008 |

---

## SECTION 10: MATRICE DE TRACABILITE

| Section SEC-SPEC-004 | Source Canonique(s) | Reference |
|---------------------|--------------------|-----------|
| Requirements by Data Class | SEC-SPEC-001 §4 | 5 data classification levels |
| Key Management | RTS-001 CRT-009 | Scheduler-based key lifecycle |
| Encryption at Rest | SEC-SPEC-001 P-SEC-005 | Per-table encryption requirements |
| Encryption in Transit | SEC-SPEC-001 Couche 11 | End-to-end channel protection |
| Hashing Requirements | SEC-SPEC-001 BR-ID-001, Section 5 | Computational hashing with salt |
| Token Storage | SEC-SPEC-001 §4 RESTRICTED | Refresh tokens hashed, transport tokens ephemeral |
| Cryptographic Neutrality | SEC-SPEC-001 §8 | Abstract specification, no concrete algorithms |
| Audit Integrity | DOC-015 AUD-001, OLDNEW-002 | No secrets in audit entries |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | security-specifier v1.0 | Creation — Encryption Rules pour Lumina v1 | COMPLIANT (trace verify contre SEC-SPEC-001, DOC-015, DOC-023) |

---

*Ce document operationalise les regles de chiffrement derivees du modele de securite de SEC-SPEC-001. Il complete SEC-SPEC-002 (Authentication), SEC-SPEC-005 (Secret Handling), et est necessaire a SEC-SPEC-006 (Audit & Compliance).*
