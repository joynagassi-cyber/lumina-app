# Protocol Adapter Canon Specification -- Lumina v1

**Doc ID:** PROTO-001
**Version:** v1.0
**Statut:** SPECIFICATION PROTOCOLE DEFINIE PAR GENESIS
**Date:** 2026-07-25
**Auteur:** Agent Protocol Adapter (Genesis)
**Source canonique:** ["DOC-013", "API-CONTRACT-001" a "API-CONTRACT-006", "PAS-001", "ASS-001", "ASS-003"]
**Transformation_rule:** "protocol-adapter-specifier v1.0"
**architecture_version:** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status:** "COMPLIANT"

---

## SOMMAIRE

1. [Introduction et Principes Fondamentaux](#1-introduction-et-principes-fondamentaux)
2. [Role des Protocol Adapters dans l'Architecture Hexagonale](#2-role-des-protocol-adapters-dans-larchitecture-hexagonale)
3. [Mode Canonique de Transformation -- Pipeline Universel](#3-mode-canonique-de-transformation--pipeline-universel)
4. [Contrats Abstraits par Etape du Pipeline](#4-contrats-abstraits-par-etape-du-pipeline)
5. [Mapping de Status Codes Canonique vers Protocoles](#5-mapping-de-status-codes-canonique-vers-protocoles)
6. [Taxonomie des Erreurs Canoniques et Mapping Protocole](#6-taxonomie-des-erreurs-canoniques-et-mapping-protocole)
7. [Regles Communes a Tous les Adapters](#7-regles-communes-a-tous-les-adapters)
8. [Classification des Operateurs par Type d'Operation](#8-classification-des-operateurs-par-type-doperation)
9. [Cahier des Charges d'Extension pour Nouveaux Adaptateurs](#9-cahier-des-charges-extension-pour-nouveaux-adaptateurs)
10. [Referencement Croise Complet -- Traçabilité](#10-referencement-croise-complet--traçabilite)

---

## 1. Introduction et Principes Fondamentaux

### 1.1 -- Positionnement Architectural

Les **Protocol Adapters** constituent la **Couche d'Adaptation de Transport** dans l'architecture hexagonale de Lumina v1. Ils operent exclusive-ment a la peripherie externe du systeme, entre les protocoles de transport effectifs (HTTP/REST, GraphQL, gRPC, CLI, Webhook, et tout futur protocol defini dans une extension) et les Contrats API Canoniques definis dans **API-CONTRACT-001** a **API-CONTRACT-006**.

Un Protocol Adapter NE MODIFIE JAMAIS le contrat API. Il le TRANSMET integralement, en effectuant uniquement :

1. La **deserialisation** des donnees brutes du protocole en un Canonical Request conforme au schema de **API-CONTRACT-002**.
2. La **serialisation** d'un Canonical Response conforme au schema de **API-CONTRACT-002** en reponses specifiques au protocole.
3. La **traduction bidirectionnelle** des codes d'erreur de **API-CONTRACT-005** vers les codes d'erreur propre a chaque protocole supporte.

Tout traitement situe en amont ou en aval de cette transformation appartient a une autre couche architecturale et ne doit jamais penetrer un adapter.

### 1.2 -- Principe d'Integrite Canonique

Le Canonical Request est toujours identique, quelle que soit la voie d'entree du protocole. Les champs, types, contraintes et semantiques sont definis uniquement par **API-CONTRACT-002** (Request Contracts) et **API-CONTRACT-001** (83 Operations). Un adapter ne peut ni ajouter ni retirer ni transformer de donnees metier. Il peut filtrer des champs propres au protocole (par exemple, un en-tete HTTP qui ne correspond a aucun champ canonique), mais jamais introduire de nouvelle sémantique.

De meme, le Canonical Response est toujours identique. Son format est defini par le Response Contract de **API-CONTRACT-002**, Section 2.2. Un adapter convertit ce reponse canonique vers le format protocole de sortie sans altérer le contenu.

### 1.3 -- Adaptation Unidirectionnelle

L'adaptation est strictement unidirectionnelle :

- **Entrée :** Protocol Input -> Parser/Deserializer -> Canonical Request -> Service Call
- **Sortie :** Canonical Response -> Serializer -> Protocol Output

Aucun flux inverse n'existe. Les données ne circulent jamais du domaine vers le protocole sans passer par le Canonical Response comme repere unique et immuable.

### 1.4 -- Absence Absolue de Logique Métier

Aucune logique métier, aucune condition basée sur le domaine, aucune regle de décision operationnelle ne vit dans un adapter. Les seules decisions qu'un adapter peut prendre sont des decisions de format :

- Quelle structure serialiser ?
- Quel code de statut protocole associer a ce code canonical ?
- Comment formater un en-tête protocol-specific ?

Une condition telle que `if (amount > 10000)` n'a sa place que dans le Domain Layer (Aggregates et Invariants du **DOC-015**), Jamais dans un adapter.

### 1.5 -- Prime de la Validite Canonique

Si une requete entrante est valide selon les regles de son protocole (par exemple, unrequete HTTP aux bonnes en-tetes et au format JSON valide), mais invalide selon les regles canoniques definies par **API-CONTRACT-002** (champs requis manquants, types incorrects, valeurs hors limites), l'adapter doit :

1. Accepter la requete comme parsee correctement.
2. Deleguer au Canonical Request/Response pipeline.
3. Recevoir en retour une erreur canonique conforme a **API-CONTRACT-005**.
4. Traduire cette erreur vers le format protocole.

L'adapter ne fait JAMAIS de validation canonique directe -- la validation canonique est le role du Request Contract definition dans **API-CONTRACT-002**, appliquee par la couche Application Service / Aggregate.

---

## 2. Role des Protocol Adapters dans l'Architecture Hexagonale

### 2.1 -- Positionnement Precis dans la Hierarchie des Couches

Conformement a la hierarchie definie dans **PAS-003 (Dependency Rules)** et a l'Organisation de l'Architecture Hexagonale, les Protocol Adapters occupent la position suivante :

```
Couche 1 (Interne) : Domain Layer -- Aggregates, Entities, Value Objects, Domain Events, Domain Exceptions
      ↑ depend sur
Couche 2             : Application Service Layer -- OrganizationService, IdentityService, ..., OfflineSyncService
      ↑ depend sur
Couche 3             : Port Layer -- 17 Ports abstraits definis dans PAS-001
      ↑ depend sur
Couche 4             : Adapter Layer -- RepositoryAdapter, EventPublicationAdapter, ... (Infrastructure Adapters)
      ↑ depend sur
Couche 5 (Externe)   : Infrastructure Layer -- Bases de donnees, systemes de fichiers, APIs externes, reseaux
```

Les **Protocol Adapters** se situent **dans la Couche 4 (Adapter Layer)**, mais plus precisement a la frontiere immediatement externe de la Couche 3 (Port Layer). Ils implementent la frontiere d'entree/sortie et s'adressent a l'API Layer.

### 2.2 -- Classification des Protocol Adapters

Chaque Protocol Adapter appartient a UNE SEULE categorie de protocole. Un meme service ne peut pas mixer deux protocoles dans le meme handler :

| Categorie | Exemples de Protocoles | Responsabilite Spécifique |
|-----------|----------------------|--------------------------|
| Adapter REST | HTTP/1.1, HTTP/2, HTTP/3 | Parse method, path, headers, query-string, JSON body → Canonical Request |
| Adapter GraphQL | GraphQL Query/Mutation/Subscription | Parse GQL AST, variables, operationName → Canonical Request |
| Adapter gRPC | Protocol Buffers over HTTP/2 | Parse proto messages, metadata headers → Canonical Request |
| Adapter CLI | Ligne de commande stdin/stdout/args | Parse command-line args, flags, stdin payload → Canonical Request |
| Adapter Webhook | HTTP POST event callbacks | Parse webhook signature headers, payload, event-id → Canonical Request |

### 2.3 -- Regle d'Isolation entre Adapters

Chaque adapter est completement interchangeable. Remplacer l'adapter REST par l'adapter GraphQL change UNIQUEMENT la facon dont la requete est recue et envoyee. L'Application Service voit EXACTEMENT le meme Canonical Request et retourne EXACTEMENT le meme Canonical Response. Le Dependency Rule **PAS-003 DR-003** (Adapter Implementation Rule) s'applique pleinement.

### 2.4 -- Relation avec les 17 Ports Canoniques

Les 17 Ports definis dans **PAS-001** (Port-001 a Port-017) restent entierement invisibles des protocol adapters. Un adapter ne sait pas que RepositoryPort, EventPublicationPort, ou ClockPort existent. Ces ports sont utilises par les Application Services (ASS-001) qui sont elles-memes invokées par le Canonical Request pipeline a l'interieur du systeme. La frontiere est absolue.

---

## 3. Mode Canonique de Transformation -- Pipeline Universel

### 3.1 -- Diagramme Universal du Pipeline

Tous les Protocol Adapters de Lumina v1 implémentent exactement le pattern suivant. Aucun variant n'est autorise. Aucun adaptation ne peut omettre une étape.

```
[Données Brutes Protocole]
        │
        ▼
┌─────────────────────┐
│ Étape 1: Parser/     │  Deserialisation brute (bytes/message → structure brute)
│ Deserializer         │  Extraction: method, path, headers, body, query params
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Étape 2: Canonical   │  Canonical Request immuable (API-CONTRACT-002 format)
│ Request              │  Champs: operationId, requestId, orgId, actorId,
│                      │  payload, metadata
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Étape 3: Service     │  Invocation Application Service via Port abstraction
│ Call                 │  (OrganizationService, ResourceService, etc.)
│                      │  Aucun détail protocol ne traverse cette frontière
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Étape 4: Canonical   │  Canonical Response immuable (API-CONTRACT-002 format)
│ Response             │  Champs: statusCode, body, headers, events, error
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│ Étape 5: Serializer  │  Conversion Canonical Response → bytes protocol-specific
│                    │  Mapping status codes, construction response body
└──────────┬──────────┘
           │
           ▼
[Données Protocole Sortantes]
```

### 3.2 -- Regle d'Immortalité du Canonical Request/Réponse

Le Canonical Request de l'Étape 2 et le Canonical Response de l'Étape 4 sont des structures IMMUABLES. Leur schéma, leurs champs, leurs types et leurs contraintes sont definis exclusivement par :

- **API-CONTRACT-002** (Request & Response Contract Catalog)
- **API-CONTRACT-001** (Canonical API Contract -- operations, commands, queries)
- **API-CONTRACT-005** (Error Taxonomy -- codes d'erreur canoniques)

Aucun adapter, a aucun moment, ne peut modifier ces structures. Il peut extraire des sous-ensembles, mapper des noms, ou filtrer des champs protocol-specific, mais il ne peut JAMAIS ajouter, supprimer ou transformer les champs canoniques definis.

### 3.3 -- Determinisme du Mapping

La relation entre Canonical Request/Response et Protocol Input/Output est deterministe : la même entrée canonique combinée au même protocol produit toujours la même sortie protocol. Il n'y aaucun état interne, aucune variabilité, aucune non-déterminisme dans la transformation. Le mapping est une fonction pure.

### 3.4 -- Comportement en Cas d'Erreur de Parsing

Si l'Étape 1 (Parser/Deserializer) échoue (données brutes corrompues, JSON mal forme, binaire non reconnu), l'adapter :

1. Capture l'exception de parsing spécifique au protocole.
2. Ne jamais deleguer au Canonical Request pipeline.
3. Construit une erreur protocol-specific directement, contenant un code d'erreur générique équivalent a **E-400-001 (INVALID_INPUT)**.
4. Retourne une réponse protocol-adaptée indiquant l'échec de parsing.

Cette gestion reste strictement technique -- aucun champ metier n'est impliquée.

---

## 4. Contrats Abstraits par Étape du Pipeline

### 4.1 -- Contrat Abstrait: Étape 1 -- Parser/Deserializer

| Propriété | Specification |
|-----------|--------------|
| Entrée | Données brutes du protocole (bytes HTTP, message binaire gRPC, payload webhook, arguments CLI, texte brut stdin) |
| Sortie | Structure brute intermédiaire permettant la construction du Canonical Request |
| Responsabilités | Extraire: method, path, query-parameters, headers, body, authentication-context. Mapping vers les champs Canonicaux.Request fields defini dans API-CONTRACT-002. |
| Validation | Uniquement la structure brute du PROTOCOLE (syntaxe JSON valide? headers bien formes? proto schemas match?). PAS de validation des regles canoniques (ceci est le role du Request Contract dans API-CONTRACT-002). |
| Erreurs | Si le parsing échoue → retourne "parse error" avec details protocol-specific (ex: "unexpected token at offset 42", "proto field missing"). Ce n'est PAS une erreur canonique. |
| Limites | Ne JAMAIS lire ni vérifier: operationId target, org_id validity, payload types, field requirements. |

**Spécifications par Protocole:**

#### 4.1.1 -- REST Adapter Parser

Inputs analysés :

| Élément | Source Protocol | Champ Canonique Cible |
|---------|----------------|---------------------|
| HTTP Method | GET/POST/PUT/PATCH/DELETE | `operationId` (mapé a une Command ou Query selon verbe) |
| Request Path | `/organizations/:orgId/users` | `operationId` identification (résolution a une Operation API-CONTRACT-001) |
| Query Parameters | `$url.searchParams` | `payload` fields (filters, pagination, search_text) |
| Headers | `Authorization`, `Accept`, `Content-Type`, `X-Request-Id` | `metadata.requestId`, `actorId` (decompression token), org context |
| Body | JSON parsed object | `payload` (command/query data) |

Mapping operationId depuis REST path :

La table de correspondance REST Path → Operation (API-CONTRACT-001) est defini comme suit pour chaque aggregate :

| Method | Path Pattern | Operation (API-CONTRACT-001) | Type |
|--------|-------------|------------------------------|------|
| POST | `/organizations` | CreateOrganization | Command |
| PATCH | `/organizations/{id}/settings` | UpdateOrganizationSettings | Command |
| POST | `/organizations/{id}/org-units` | CreateOrgUnit | Command |
| PUT | `/organizations/{id}/org-units/{unitId}` | UpdateOrgUnitParent | Command |
| POST | `/organizations/transfer` | TransferChildOrg | Command |
| POST | `/organizations/merge` | MergeOrganizations | Command |
| POST | `/organizations/{id}/archive` | ArchiveOrganization | Command |
| POST | `/organizations/{id}/suspend` | SuspendOrganization | Command |
| GET | `/organizations/{id}` | GetOrganizationProfile | Query |
| GET | `/organizations/{id}/descendants` | GetDescendantUnits | Query |
| POST | `/users` | CreateUser | Command |
| PATCH | `/users/{id}/profile` | UpdateUserProfile | Command |
| PUT | `/users/{id}/role` | ChangeUserRole | Command |
| POST | `/users/{id}/reset-password` | ResetPassword | Command |
| POST | `/auth/login` | LoginUser | Command |
| POST | `/auth/logout` | LogoutUser | Command |
| POST | `/auth/refresh` | RefreshAccessToken | Command |
| DELETE | `/sessions/{id}` | RevokeSession | Command |
| POST | `/permissions/grant` | AssignPermissionGrant | Command |
| POST | `/transactions` | CreateTransaction | Command |
| PATCH | `/transactions/{id}` | UpdateDraftTransaction | Command |
| POST | `/transactions/{id}/submit` | SubmitForApproval | Command |
| POST | `/transactions/{id}/approve` | ApproveTransaction | Command |
| POST | `/transactions/{id}/reject` | RejectTransaction | Command |
| POST | `/transactions/{id}/compensate` | CompensateTransaction | Command |
| POST | `/members` | CreateMember | Command |
| PATCH | `/members/{id}` | UpdateMember | Command |
| PUT | `/members/{id}/status` | TransitionMemberStatus | Command |
| GET | `/resources` | SearchResources | Query |
| GET | `/resources/export` | ExportResources | Query |
| POST | `/groups/membership` | AddMemberToGroup | Command |
| DELETE | `/groups/membership/{memberId}/{groupId}` | RemoveMemberFromGroup | Command |
| PUT | `/groups/org-unit-parent` | SetOrgUnitParent | Command |
| GET | `/groups/descendants` | GetDescendants | Query |
| GET | `/groups/member/{memberId}` | GetAllGroupsForMember | Query |
| GET | `/groups/{groupId}/members` | GetAllMembersOfGroup | Query |
| POST | `/workflows/trigger` | TriggerWorkflow | Command |
| POST | `/workflows/{instanceId}/approve` | ApproveStep | Command |
| POST | `/workflows/{instanceId}/reject` | RejectStep | Command |
| POST | `/workflows/{instanceId}/cancel` | CancelWorkflow | Command |
| POST | `/workflows/{instanceId}/resubmit` | ResubmitForApproval | Command |
| GET | `/workflows/{instanceId}/pending` | GetPendingApprovals | Query |
| GET | `/forms/{formId}` | LoadFormDefinition | Query |
| POST | `/forms/{formId}/validate` | ValidateFormData | Command |
| GET | `/forms/{formId}/render` | RenderForm | Query |
| GET | `/forms/{formId}/visible-fields` | GetVisibleFields | Query |
| POST | `/notifications/send` | SendNotification | Command |
| PUT | `/notifications/{id}/read` | MarkAsRead | Command |
| PUT | `/notifications/preferences` | UpdatePreferences | Command |
| PUT | `/notifications/rate-limit` | SetRateLimit | Command |
| PUT | `/notifications/suppress` | SuppressUntil | Command |
| POST | `/notifications/queue` | QueueNotification | Command |
| POST | `/vocab/terms` | AddTermValue | Command |
| POST | `/vocab/deprecate` | DeprecateTermValue | Command |
| GET | `/vocab/resolve` | ResolveLabel | Query |
| GET | `/vocab/terms` | GetTerms | Query |
| GET | `/vocab/values` | GetTermValues | Query |
| GET | `/vocab/search` | SearchTerms | Query |
| GET | `/vocab/namespaces` | GetAllNamespaces | Query |
| POST | `/reports/generate` | GenerateReport | Command |
| GET | `/reports/balance` | CalculateBalance | Query |
| GET | `/reports/export` | ExportReport | Query |
| GET | `/reports/types` | GetReportTypes | Query |
| POST | `/audit/log` | LogAction | Command (SYSTEM ONLY) |
| GET | `/audit/logs` | QueryAuditLogs | Query |
| GET | `/audit/export` | ExportAuditTrail | Query |
| POST | `/lifecycle/archive` | ArchiveResource | Command |
| POST | `/lifecycle/trash` | TrashResource | Command |
| POST | `/lifecycle/purge` | PurgeResource | Command (SYSTEM ONLY) |
| POST | `/lifecycle/restore` | RestoreFromTrash | Command |
| GET | `/lifecycle/archives` | ListArchiveEntries | Query |
| GET | `/lifecycle/search` | SearchArchives | Query |
| POST | `/lifecycle/tags` | ApplyTags | Command |
| POST | `/lifecycle/purge-schedule` | SchedulePurge | Command |
| PUT | `/config/settings` | UpdateSetting | Command |
| POST | `/config/reset` | ResetToDefaults | Command |
| GET | `/config/settings/{key}` | GetSetting | Query |
| GET | `/config/settings` | GetAllSettings | Query |
| POST | `/sync/push` | PushPendingOperations | Command |
| POST | `/sync/pull` | PullRemoteChanges | Command |
| POST | `/sync/resolve-conflict` | ResolveConflict | Command |
| POST | `/sync/confirm` | MarkOperationConfirmed | Command |
| GET | `/sync/connectivity` | CheckConnectivity | Query |
| GET | `/sync/status` | GetSyncStatus | Query |

**Note:** Cette table est exhaustive pour REST. Elle map les 83 Operations definies dans **API-CONTRACT-001** vers des patterns REST. Aucun operation non-liste n'est acceptable.

#### 4.1.2 -- GraphQL Adapter Parser

Inputs analysés :

| Élément | Source Protocol | Champ Canonique Cible |
|---------|----------------|--------------------|
| Operation Name | GraphQL query/mutation name | `operationId` (résolution par introspection du schema) |
| Variables | `{ input: { ... } }` | `payload` |
| Root Field | `mutation { createUser }` | `operationId` (mapping root field → operation) |
| Headers | `Authorization`, `X-Request-Id` | `metadata.requestId`, `actorId` |

Schema GraphQL attendu pour chaque operation d'API-CONTRACT-001 :

Pour chaque Command/Query definie dans **API-CONTRACT-001**, un root field correspondant existe dans le schéma GraphQL :

- Les **Commands** mapent aux `mutation { operationName(input: ...) }`.
- Les **Queries** mapent aux `query { operationName(args: ...) }`.

La validation de structure se fait via le validateur intégré de l'parser GraphQL, qui vérifie la validité syntaxique du document avant que les variables ne soient extraites.

#### 4.1.3 -- gRPC Adapter Parser

Inputs analysés :

| Élément | Source Protocol | Champ Canonique Cible |
|---------|----------------|--------------------|
| Protobuf Message Field | `CreateTransactionRequest.amount_cents` | `payload.amount_cents` (INT64) |
| Metadata Headers | `x-request-id`, `authorization` | `metadata.requestId`, `actorId` |
| Method Descriptor | Protobuf service/method definition | `operationId` (résolu depuis le nom de méthode proto) |

Chaque operation d'**API-CONTRACT-001** correspond a un message protobuf definit via une extension contractuelle. Les messages proto suivent exactement les types definis dans les Request Contracts d'**API-CONTRACT-002**.

#### 4.1.4 -- CLI Adapter Parser

Inputs analysés :

| Élément | Source Protocol | Champ Canonique Cible |
|---------|----------------|--------------------|
| Command Subcommand | `lumina transaction create` | `operationId` |
| Arguments Positionnels | `--amount-cents 50000` | `payload.amount_cents` |
| Flags | `--json --pretty` | `metadata.format`, `metadata.outputStyle` |
| Stdin | Piped JSON from another command | `payload` (raw body) |

Le CLI parser map les sous-commandes aux operations canoniques selon une arborescence :

```
lumina <aggregate> <operation> [flags]
```

Par exemple : `lumina resource transaction create --amount-cents 50000 --type income --date 2026-01-15`.

#### 4.1.5 -- Webhook Adapter Parser

Inputs analysés :

| Élément | Source Protocol | Champ Canonique Cible |
|---------|----------------|--------------------|
| Event Header | `X-Webhook-Event-Type`, `X-Signature` | `metadata.eventType`, `metadata.signatureVerified` |
| Payload Body | JSON body | `payload` (identique a format canonique) |
| Event ID | `X-Event-ID` | `metadata.eventId` (pour idempotency tracking) |

### 4.2 -- Contrat Abstrait: Étape 2 -- Canonical Request

Le Canonical Request est une structure IMMUABLE definie par **API-CONTRACT-002**. Elle contient TOUJOURS les champs suivants, dans l'ordre canonique :

| Champ | Type | Requis | Description | Source |
|-------|------|--------|-------------|--------|
| operationId | STRING | YES | Identifiant de l'operation canonique (nom exact de API-CONTRACT-001) | Résolu par le Parser (étape 1) |
| requestId | UUID | YES | Corrélation unique pour le tracing | Généré par l'adapter ou extrait de header |
| orgId | UUID | YES | Scope d'organisation (résolu depuis contexte auth) | Extrait de session/token |
| actorId | UUID | YES | Identifiant de l'utilisateur acteur | Extrait du token d'authentification |
| payload | STRUCT | YES | Données spécifiques a l'operation | Désérialisé depuis le body/input protocol |
| metadata | STRUCT | NO | Métadonnées protocol-specific filtrées | En-têtes, flags protocol |

**Règles obligatoires pour la construction du Canonical Request :**

1. **operationId** doit correspondre EXACTEMENT au nom de l'operation tel que defini dans **API-CONTRACT-001**. Aucune variation (case-sensitive, exact match).
2. **requestId** doit être un UUID v4 valide. Si fourni par le protocole (ex: `X-Request-Id` en HTTP), il est utilisé tel quel. Sinon, un UUID est généré.
3. **orgId** est TOUJOURS résolu depuis le contexte d'authentification (token/session), Jamais directement depuis les paramètres de l'utilisateur. Cette règle découle du Dependency Rule **PAS-003 DR-009** (Tenant Isolation Enforcement).
4. **actorId** est TOUJOURS résolu depuis le contexte d'authentification.
5. **payload** contient exactement les données définies par le Request Contract de l'operation cible dans **API-CONTRACT-002**. Aucune donnée supplémentaire n'est acceptée. Les champs superflus sont filtrés.
6. **metadata** contient uniquement des informations protocol-specific non-business : format de sortie, traceID, etc.

### 4.3 -- Contrat Abstrait: Étape 3 -- Service Call

L'appel au Service d'Application se fait exclusivement via les Interfaces Port definies dans **PAS-001**. L'adapter n'a AUCUNE connaissance du nom de l'Application Service appelle.

Ce role appartient exclusiverement a la couche Application Service (**ASS-001**), qui orchestre la logique suivante (tel que defini dans **ASS-003 Workflow Specification**) :

| Étape ASS-003 | Responsabilite | Pertinence pour Adapter |
|---------------|---------------|----------------------|
| Step 1: Input Validation | Validation schema fields payload | NON -- fait par le Canonical Request pipeline |
| Step 2: Authorization Check | Vérification RBAC via AuthorizationPort | NON -- fait par layer au-dessus de l'adapter |
| Step 3: Aggregate Loading | Chargement Aggregate via RepositoryPort | NON -- fait par Application Service |
| Step 4: Domain Execution | Invocation method boundary Aggregate | NON -- fait par Application Service |
| Step 5: Invariant Guard | Vérification invariants DOC-015 | NON -- fait par Aggregate |
| Step 6: Persistence | Sauvegarde via RepositoryPort | NON -- fait par Application Service |
| Step 7: Event Publishing | Publication Domain Events | NON -- fait par EventPublicationPort |
| Step 8: Response | Format canonique reponse | NON -- fait par Application Service |

L'adapter transmet le Canonical Request a l'Application Service et récupère le Canonical Response. Il ne controle rien de ce pipeline.

### 4.4 -- Contrat Abstrait: Étape 4 -- Canonical Response

Le Canonical Response est une structure IMMUABLE definie par **API-CONTRACT-002**, Section 2.2. Il contient TOUJOURS les champs suivants, dans l'ordre canonique :

| Champ | Type | Condition | Description |
|-------|------|-----------|-------------|
| statusCode | INT32 | Always | Code de statut canonical (200, 201, 400, 401, etc.) |
| body | ENTITY / NULL | On success | Données retournées (liste d'entités, entity unique, ou void/null) |
| headers | MAP | Always | En-têtes canoniques (Content-Type, X-Request-Id correlation, etc.) |
| events | EventList | Always | Liste des Domain Events émis pendant le traitement |
| error | ErrorObject | On error | Objet d'erreur canonique si statusCode >= 400 |

**Structure de l'objet Error (Canonical Error) :**

Chaque erreur canonique contient (definies par **API-CONTRACT-002**, Section 2.3) :

| Champ | Type | Description |
|-------|------|-------------|
| error_code | STRING | Code stable de **API-CONTRACT-005** (ex: "E-400-001") |
| message | STRING | Explication lisible par l'humain |
| details | OBJECT | Contexte additionnel optionnel |
| request_id | UUID | ID de corrélation pour le tracing |

**Réponse de Succès Standard (Commands) :**

| Champ | Type | Condition | Description |
|-------|------|-----------|-------------|
| success | BOOLEAN | Always | true |
| version | INT32 | Always | Version optimiste (1 pour les créations) |
| created_at | TIMESTAMP | On creates | Horodatage de création |
| events_emitted | EventList | Always | Liste des Domain Events émis |

**Réponse de Succès Standard (Queries) :**

| Champ | Type | Condition | Description |
|-------|------|-----------|-------------|
| data | ENTITY_LIST | Always | Entités demandées |
| count | INT32 | Always | Nombre d'éléments retournés |

### 4.5 -- Contrat Abstrait: Étape 5 -- Serializer

Le Serializer convertit le Canonical Response en sortie protocol-specific. Ses responsabilités exactes :

| Responsabilite | Détail |
|---------------|--------|
| Conversion StatusCode | Mapping canonical → code protocole (voir Section 5) |
| Construction Body | Serialisation du body canonique en format protocole (JSON body, HTML page, binaire frame, etc.) |
| Mapping Error | Si error present → traduction conforme Section 6 |
| Ajout Headers Protocol | Headers spécifiques au protocole (ex: `Content-Type: application/json` pour REST, `grpc-status` pour gRPC) |
| Pagination Envelope | Pour les Queries avec pagination, enveloppe standardisée **API-CONTRACT-002** Section 2.4 |
| Event List Format | Format de la liste des événements selon les exigences du protocole |

---

## 5. Mapping de Status Codes Canonique vers Protocoles

### 5.1 -- Table Globale de Mapping

| Code Canonique | Signification | REST | GraphQL | gRPC | CLI | Webhook |
|---------------|---------------|------|---------|------|-----|---------|
| 200 | Success (Query read, or successful update) | 200 OK | `{data: ...}` | OK (status 0) | 0 (exit code) | 200 OK |
| 201 | Created (resource successfully created) | 201 Created | `{data: ...}` | OK (status 0) | 0 (exit code) | 201 Created |
| 204 | No Content (void command, no data to return) | 204 No Content | `{data: null}` | OK (status 0) | 0 (exit code) | 204 No Content |
| 400 | Bad Request (invalid input schema) | 400 Bad Request | `{errors:[...]}` | INVALID_ARGUMENT | 1 | 400 Bad Request |
| 401 | Unauthorized (no auth / expired / invalid credentials) | 401 Unauthorized | `{errors:[...]}` | UNAUTHENTICATED | 1 | 401 Unauthorized |
| 403 | Forbidden (authenticated but insufficient permissions) | 403 Forbidden | `{errors:[...]}` | PERMISSION_DENIED | 1 | 403 Forbidden |
| 404 | Not Found (entity does not exist) | 404 Not Found | `{errors:[...]}` | NOT_FOUND | 1 | 404 Not Found |
| 409 | Conflict (state conflict, duplicate, version mismatch) | 409 Conflict | `{errors:[...]}` | ALREADY_EXISTS | 1 | 409 Conflict |
| 422 | Domain Violation (invariant/business rule breach) | 422 Unprocessable Entity | `{errors:[...]}` | FAILED_PRECONDITION | 1 | 422 Unprocessable Entity |
| 500 | Internal Error (unexpected system failure) | 500 Internal Server Error | `{errors:[...]}` | INTERNAL | 1 | 500 Internal Server Error |
| 502 | Dependency Failure (downstream service unavailable) | 502 Bad Gateway | `{errors:[...]}` | UNAVAILABLE | 1 | 502 Bad Gateway |
| 503 | Service Unavailable (temporarily overloaded) | 503 Service Unavailable | `{errors:[...]}` | UNAVAILABLE | 1 | 503 Service Unavailable |

### 5.2 -- Détails de Mapping par Protocol

#### 5.2.1 -- REST Mapping Detail

Chaque status code canonical correspond a un code HTTP precise :

| Canonical | HTTP | Body JSON Structure |
|-----------|------|-------------------|
| 200 | 200 | `{ "success": true, "version": N, "data": { ... }, "events_emitted": [...] }` |
| 201 | 201 | `{ "success": true, "version": 1, "created_at": "ISO-timestamp", "events_emitted": [...] }` |
| 204 | 204 | (empty body) |
| 400 | 400 | `{ "error_code": "E-XXX-NNN", "message": "...", "details": {}, "request_id": "uuid" }` |
| 401 | 401 | Idem structure 400, error_code toujours E-401-NNN |
| 403 | 403 | Idem structure 400, error_code toujours E-403-NNN |
| 404 | 404 | Idem structure 400, error_code toujours E-404-NNN |
| 409 | 409 | Idem structure 400, error_code toujours E-409-NNN |
| 422 | 422 | Idem structure 400, error_code toujours E-422-NNN (potentiellement suffixé INV-XXX) |
| 500 | 500 | Idem structure 400, error_code E-500-NNN |

Headers supplémentaires REST obligatoires :

| Header | Valeur | Quand |
|--------|--------|-------|
| Content-Type | `application/json` | Toujours (sauf export binaire) |
| X-Request-Id | Same requestId du Canonical Request | Toujours |
| X-Rate-Limit-Remaining | Count restant | Si RATE-002 applicable |

#### 5.2.2 -- GraphQL Mapping Detail

Le GraphQL utilise toujours un envelope racine avec `data` et/ou `errors` :

| Canonical | GraphQL Structure |
|-----------|-----------------|
| 200 | `{ "data": { "operationName": { "success": true, "version": N, "eventsEmitted": [...] } } }` |
| 201 | `{ "data": { "operationName": { "success": true, "version": 1, "createdAt": "timestamp" } } }` |
| 204 | `{ "data": { "operationName": null } }` |
| 400-500 | `{ "data": null, "errors": [{ "message": "...", "extensions": { "code": "E-XXX-NNN", "requestId": "uuid", "details": {} } }] }` |

**Important:** En GraphQL, une erreur ne peut pas avoir `data` ET `errors` pour la même operation. Si une erreur survient, `data` est `null`.

#### 5.2.3 -- gRPC Mapping Detail

Chaque status canonical correspond a un gRPC Status Code protobuf :

| Canonical | gRPC Status Code | gRPC Details |
|-----------|-----------------|-------------|
| 200/201/204 | OK (0) | response.proto message matching canonical response |
| 400 | INVALID_ARGUMENT (3) | details.error_details{code: "E-XXX-NNN"} |
| 401 | UNAUTHENTICATED (16) | details.auth_details{} |
| 403 | PERMISSION_DENIED (7) | details.permission_details{required: "resource:action:level"} |
| 404 | NOT_FOUND (5) | details.not_found{entity: "TransactionRecord", id: "uuid"} |
| 409 | ALREADY_EXISTS (6) | details.already_exists{entity: "User", field: "email"} |
| 422 | FAILED_PRECONDITION (9) | details.precondition{violation: "FIN-001", invariant: "INV-001"} |
| 500 | INTERNAL (13) | details.internal_error{message: "..."} |
| 502/503 | UNAVAILABLE (14) | details.unavailable{retryAfterMs: N} |

Les Metadata Headers gRPC standards :

| Key | Valeur |
|-----|--------|
| `x-request-id` | Canonical requestId |
| `x-correlation-id` | Event batch ID (pour les Domain Events) |

#### 5.2.4 -- CLI Mapping Detail

Le CLI utilise des codes de sortie Unix standards :

| Canonical | Exit Code | stdout | stderr |
|-----------|-----------|--------|--------|
| 200 | 0 | JSON compact sur stdout | (vide) |
| 201 | 0 | JSON compact sur stdout | (vide) |
| 400-500 | 1 | (vide) | JSON d'erreur format canonical + lisible |

Format stderr en cas d'erreur CLI :

```
Error [E-400-001]: Invalid input -- field 'amount_cents' is required
  Request ID: 550e8400-e29b-41d4-a716-446655440000
  Fix: Provide a positive integer value for amount_cents
```

#### 5.2.5 -- Webhook Mapping Detail

| Canonical | HTTP Response | Body |
|-----------|--------------|------|
| 200 | 200 OK | `{ "status": "accepted", "request_id": "uuid" }` |
| 201 | 201 Created | `{ "status": "created", "request_id": "uuid", "version": 1 }` |
| 400-500 | Corresponding HTTP | `{ "error_code": "E-XXX-NNN", "message": "...", "request_id": "uuid" }` |

---

## 6. Taxonomie des Erreurs Canoniques et Mapping Protocole

### 6.1 -- Reference: Taxonomie API-CONTRACT-005

La taxonomie des erreurs canoniques est definie exhaustivement dans **API-CONTRACT-005** (Error Taxonomy). Chaque code d'erreur suit le format `E-XXX-NNN` ou `E-XXX-NNN_INV-XXX` (avec reference d'invariant optionnelle).

Les 6 categories d'erreurs canoniques supportees par TOUS les adapters sont :

| Category | Prefix | HTTP Equivalence | Protocols Non-Canonic |
|----------|--------|-----------------|----------------------|
| BAD_REQUEST | E-400-NNN | 400 | HTTP 400, gRPC INVALID_ARGUMENT, GraphQL errors[], CLI exit 1, Webhook 400 |
| UNAUTHORIZED | E-401-NNN | 401 | HTTP 401, gRPC UNAUTHENTICATED, GraphQL errors[], CLI exit 1, Webhook 401 |
| FORBIDDEN | E-403-NNN | 403 | HTTP 403, gRPC PERMISSION_DENIED, GraphQL errors[], CLI exit 1, Webhook 403 |
| NOT_FOUND | E-404-NNN | 404 | HTTP 404, gRPC NOT_FOUND, GraphQL errors[], CLI exit 1, Webhook 404 |
| CONFLICT | E-409-NNN | 409 | HTTP 409, gRPC ALREADY_EXISTS, GraphQL errors[], CLI exit 1, Webhook 409 |
| DOMAIN_VIOLATION | E-422-NNN | 422 | HTTP 422, gRPC FAILED_PRECONDITION, GraphQL errors[], CLI exit 1, Webhook 422 |
| INTERNAL_ERROR | E-500-NNN | 500 | HTTP 500, gRPC INTERNAL, GraphQL errors[], CLI exit 1, Webhook 500 |

### 6.2 -- Mapping Complet: E-400-NNN (BAD_REQUEST)

| Error Code | Nom Canonique | REST | GraphQL | gRPC | CLI | Webhook |
|------------|--------------|------|---------|------|-----|---------|
| E-400-001 | INVALID_INPUT | 400 + body | `{errors:[{code:"E-400-001"}]}` | INVALID_ARGUMENT | exit 1 | 400 |
| E-400-002 | INVALID_VALUE | 400 + body | `{errors:[{code:"E-400-002"}]}` | INVALID_ARGUMENT | exit 1 | 400 |
| E-400-003 | INVALID_FORMAT | 400 + body | `{errors:[{code:"E-400-003"}]}` | INVALID_ARGUMENT | exit 1 | 400 |
| E-400-004 | INVALID_ENUM | 400 + body | `{errors:[{code:"E-400-004"}]}` | INVALID_ARGUMENT | exit 1 | 400 |
| E-400-005 | INVALID_REFERENCE | 400 + body | `{errors:[{code:"E-400-005"}]}` | INVALID_ARGUMENT | exit 1 | 400 |
| E-400-006 | INVALID_DATES | 400 + body | `{errors:[{code:"E-400-006"}]}` | INVALID_ARGUMENT | exit 1 | 400 |
| E-400-007 | INVALID_PAYLOAD | 400 + body | `{errors:[{code:"E-400-007"}]}` | INVALID_ARGUMENT | exit 1 | 400 |

Tous les codes E-400-NNN incluent dans leur body/error-details :

```
{
  "error_code": "E-XXX-NNN",
  "message": "Description humaine de l'erreur",
  "details": { "field": "...", "expected": "...", "actual": "..." },
  "request_id": "uuid-correlation"
}
```

### 6.3 -- Mapping Complet: E-401-NNN (UNAUTHORIZED)

| Error Code | Nom Canonique | REST | GraphQL | gRPC | CLI | Webhook |
|------------|--------------|------|---------|------|-----|---------|
| E-401-001 | NOT_AUTHENTICATED | 401 | `{errors:[{code:"E-401-001"}]}` | UNAUTHENTICATED | exit 1 | 401 |
| E-401-002 | SESSION_EXPIRED | 401 | `{errors:[{code:"E-401-002"}]}` | UNAUTHENTICATED | exit 1 | 401 |
| E-401-003 | INVALID_CREDENTIALS | 401 | `{errors:[{code:"E-401-003"}]}` | UNAUTHENTICATED | exit 1 | 401 |

### 6.4 -- Mapping Complet: E-403-NNN (FORBIDDEN)

| Error Code | Nom Canonique | REST | GraphQL | gRPC | CLI | Webhook |
|------------|--------------|------|---------|------|-----|---------|
| E-403-001 | INSUFFICIENT_PERMISSION | 403 | `{errors:[{code:"E-403-001"}]}` | PERMISSION_DENIED | exit 1 | 403 |
| E-403-002 | ORGANIZATION_MISMATCH | 403 | `{errors:[{code:"E-403-002"}]}` | PERMISSION_DENIED | exit 1 | 403 |
| E-403-003 | ROLE_VIOLATION | 403 | `{errors:[{code:"E-403-003"}]}` | PERMISSION_DENIED | exit 1 | 403 |
| E-403-004 | SUSPENDED_ORG | 403 | `{errors:[{code:"E-403-004"}]}` | PERMISSION_DENIED | exit 1 | 403 |
| E-403-005 | ARCHIVED_ORG | 403 | `{errors:[{code:"E-403-005"}]}` | PERMISSION_DENIED | exit 1 | 403 |

### 6.5 -- Mapping Complet: E-404-NNN (NOT_FOUND)

| Error Code | Nom Canonique | REST | GraphQL | gRPC | CLI | Webhook |
|------------|--------------|------|---------|------|-----|---------|
| E-404-001 | ENTITY_NOT_FOUND | 404 | `{errors:[{code:"E-404-001"}]}` | NOT_FOUND | exit 1 | 404 |
| E-404-002 | TENANT_NOT_FOUND | 404 | `{errors:[{code:"E-404-002"}]}` | NOT_FOUND | exit 1 | 404 |
| E-404-003 | SESSION_NOT_FOUND | 404 | `{errors:[{code:"E-404-003"}]}` | NOT_FOUND | exit 1 | 404 |
| E-404-004 | FORM_NOT_FOUND | 404 | `{errors:[{code:"E-404-004"}]}` | NOT_FOUND | exit 1 | 404 |
| E-404-005 | VOCAB_TERM_NOT_FOUND | 404 | `{errors:[{code:"E-404-005"}]}` | NOT_FOUND | exit 1 | 404 |
| E-404-006 | WORKFLOW_DEFINITION_NOT_FOUND | 404 | `{errors:[{code:"E-404-006"}]}` | NOT_FOUND | exit 1 | 404 |

### 6.6 -- Mapping Complet: E-409-NNN (CONFLICT)

| Error Code | Nom Canonique | REST | GraphQL | gRPC | CLI | Webhook |
|------------|--------------|------|---------|------|-----|---------|
| E-409-001 | OPTIMISTIC_LOCK_CONFLICT | 409 | `{errors:[{code:"E-409-001"}]}` | ALREADY_EXISTS | exit 1 | 409 |
| E-409-002 | UNIQUE_VIOLATION | 409 | `{errors:[{code:"E-409-002"}]}` | ALREADY_EXISTS | exit 1 | 409 |
| E-409-003 | INVALID_TRANSITION | 409 | `{errors:[{code:"E-409-003"}]}` | ALREADY_EXISTS | exit 1 | 409 |
| E-409-004 | DUPLICATE_MEMBERSHIP | 409 | `{errors:[{code:"E-409-004"}]}` | ALREADY_EXISTS | exit 1 | 409 |
| E-409-005 | ALREADY_DEPRECATED | 409 | `{errors:[{code:"E-409-005"}]}` | ALREADY_EXISTS | exit 1 | 409 |
| E-409-006 | ALREADY_PURGED | 409 | `{errors:[{code:"E-409-006"}]}` | ALREADY_EXISTS | exit 1 | 409 |

### 6.7 -- Mapping Complet: E-422-NNN (DOMAIN_VIOLATION)

Cette categorie inclut TOUTES les violations d'invariants du **DOC-015**. Les codes étendus incluent le suffixe `_INV-XXX` ou un identifier d'invariant specifique.

#### Codes Generaux E-422

| Error Code | Nom Canonique | Description | Mapping Protocol Unifié |
|------------|--------------|-------------|----------------------|
| E-422-001 | INVARIANT_VIOLATED | Domain invariant check failed | Tous protocols → {code: "E-422-001", details: {invariant: "INV-XXX"}} |
| E-422-002 | BUSINESS_RULE_BREACH | Business rule from DOC-016 violated | Tous protocols → {code: "E-422-002", details: {rule: "BR-XXX"}} |

#### Codes Specifiques E-422 détaillés (tracabilité DOC-015 → Protocol)

Tous les codes étendus ci-dessous sont traduits de la meme manière dans chaque protocole : l'error_code complet (ex: `E-422-001-FIN-001`) est inclus dans le champ `error_code` du mapping protocol, et le detail de l'invariant dans le champ `details`.

| Extended Error Code | Name | Triggers From (Invariant) | Detail pour Mapping Protocol |
|--------------------|------|--------------------------|-----------------------------|
| E-422-001-FIN-001 | APPROVED_TRANSACTION_IMMUTABLE | FIN-001 | `"transaction is approved/cancelled"` |
| E-422-001-FIN-002 | AMOUNT_NOT_POSITIVE | FIN-002 | `"amount must be > 0 in BIGINT cents"` |
| E-422-001-DATE-001 | DATE_IN_FUTURE | DATE-001 | `"date must be today or earlier"` |
| E-422-001-CAT-001 | VOCAB_CATEGORY_MISSING | CAT-001 | `"category_ref not in vocabulary"` |
| E-422-001-DESC-001 | DESCRIPTION_REQUIRED_FOR_LARGE_AMOUNT | DESC-001 | `"description required if amount > 100"` |
| E-422-001-VERSION-001 | VERSION_NOT_INCREMENTED | VERSION-001 | `"write did not increment version"` |
| E-422-001-CREATEBY-001 | CREATED_BY_MISSING | CREATEBY-001 | `"createdBy must be set from auth context"` |
| E-422-001-COMP-001 | COMPENSATION_LINK_MISSING | COMP-001 | `"compensates_for reference required"` |
| E-422-001-SCOPE-001 | SCOPE_UNDEFINED | SCOPE-001 | `"scope_type is mandatory"` |
| E-422-001-MEM-001 | NAME_REQUIRED | MEM-001 | `"firstName AND lastName always required"` |
| E-422-001-EMAIL-001 | EMAIL_DUPLICATE_ORG | EMAIL-001 | `"email already exists within this org"` |
| E-422-001-STATUS-010 | INVALID_MEMBER_STATUS | STATUS-010 | `"status not in active/inactive/deceased/transferred"` |
| E-422-001-DISABLE-011 | INACTIVE_CANNOT_TRANSACT | DISABLE-011 | `"member must be active to transact"` |
| E-422-001-REL-001 | HIERARCHY_CYCLE_DETECTED | REL-001 | `"cycle detected by Kahn's algo"` |
| E-422-001-REL-002 | DEPTH_EXCEEDED | REL-002 | `"max org depth is 5"` |
| E-422-001-WF-001 | STEP_TIMEOUT_EXCEEDED | WF-001 | `"step past 30-day timeout"` |
| E-422-001-WF-005 | WORKFLOW_MODIFIES_APPROVED_TX | WF-005 | `"workflows cannot modify approved tx directly"` |
| E-422-001-RETRY-004 | AUTO_RETRY_BLOCKED | RETRY-004 | `"only manual resubmit allowed"` |
| E-422-001-FRM-009 | HARDCODED_FORM_DETECTED | FRM-009 | `"all forms must come from FormDefinition"` |
| E-422-001-VOCAB-002 | VOCAB_OPTION_MISSING | VOCAB-002 | `"select references non-existent vocab term"` |
| E-422-001-DUAL-008 | CLIENT_SERVER_VALIDATION_MISMATCH | DUAL-008 | `"client/server validation results differ"` |
| E-422-001-LOCK-004 | SENSITIVE_FORM_MODIFIED | LOCK-004 | `"financial form modified after submission"` |
| E-422-001-NOT-001 | SPONTANEOUS_NOTIFICATION | NOT-001 | `"notification called without trigger_source"` |
| E-422-001-RATE-002 | RATE_LIMIT_EXCEEDED | RATE-002 | `"too many notifications per hour"` |
| E-422-001-CHANNEL-003 | CHANNEL_PREFERENCE_BLOCKED | CHANNEL-003 | `"channel blocked by user preference"` |
| E-422-001-QUIET-004 | QUIET_HOURS_VIOLATION | QUIET-004 | `"non-critical during quiet hours"` |
| E-422-001-VOC-001 | DELETE_VALUE_ATTEMPTED | VOC-001 | `"values can only be deprecated, never deleted"` |
| E-422-001-TRANSLATION-002 | MINIMUM_TRANSLATIONS_NOT_MET | TRANSLATION-002 | `"both FR and EN labels required"` |
| E-422-001-STABLE-003 | KEY_MODIFICATION_ATTEMPTED | STABLE-003 | `"keys are immutable after creation"` |
| E-422-001-AUD-001 | AUDIT_LOG_MODIFY_ATTEMPTED | AUD-001 | `"audit logs are append-only, immutable"` |
| E-422-001-AUD-OLDNEW-002 | AUDIT_MISSING_SNAPSHOT | OLDNEW-002 | `"both old AND new snapshots required"` |
| E-422-001-LIF-001 | NON_ARCHIVABLE_TYPE | LIF-001 | `"resource_type not in manifest.lifecycle.types[]"` |
| E-422-001-LIF-003 | PURGE_ATTEMPTED_ON_ACTIVE_ENTRY | LIF-003 | `"entry must be trashed before purge"` |
| E-422-001-LIF-005 | PURGE_DATE_NOT_REACHED | LIF-005 | `"wait until configured purge date"` |
| E-422-001-CFG-001 | INVALID_CURRENCY_FORMAT | CFG-001 | `"use ISO 4217 format (e.g., CDF, USD, EUR)"` |
| E-422-001-CFG-002 | INVALID_TIMEZONE | CFG-002 | `"use IANA format (e.g., Africa/Lubumbashi)"` |
| E-422-001-CFG-003 | INVALID_ACCENT_COLOR | CFG-003 | `"use #RRGGBB with sufficient WCAG contrast"` |
| E-422-001-SYNC-001 | REMOTE_WRITE_BEFORE_LOCAL | SYNC-001 | `"local write ALWAYS precedes remote"` |
| E-422-001-SYNC-002 | BATCH_SIZE_EXCEEDED | SYNC-002 | `"maximum batch size is 50"` |
| E-422-001-SYNC-003 | MAX_RETRIES_EXCEEDED | SYNC-003 | `"operation exceeded 5 retry attempts"` |
| E-422-001-SYNC-004 | SYNC_BLOCKED_USER_OP | SYNC-004 | `"user ops never depend on sync synchronously"` |

### 6.8 -- Mapping Complet: E-500-NNN (INTERNAL_ERROR)

| Error Code | Nom Canonique | REST | GraphQL | gRPC | CLI | Webhook |
|------------|--------------|------|---------|------|-----|---------|
| E-500-001 | UNEXPECTED_ERROR | 500 + body | `{errors:[{code:"E-500-001"}]}` | INTERNAL | exit 1 | 500 |
| E-500-002 | PERSISTENCE_FAILURE | 500 + body | `{errors:[{code:"E-500-002"}]}` | INTERNAL | exit 1 | 500 |
| E-500-003 | SERIALIZATION_ERROR | 500 + body | `{errors:[{code:"E-500-003"}]}` | INTERNAL | exit 1 | 500 |
| E-500-004 | DEPENDENCY_FAILURE | 500 + body | `{errors:[{code:"E-500-004"}]}` | UNAVAILABLE | exit 1 | 500 |

### 6.9 -- Regle Universelle de Traduction d'Erreurs

Pour CHAQUE erreur canonique, la traduction protocol suit ce pattern universel :

```
Canonical Error Object (API-CONTRACT-002, Section 2.3):
  ├── error_code: "E-XXX-NNN" (ou extended)     → toujours présent dans la réponse
  ├── message: STRING                            → toujours traduit fidèlement
  ├── details: OBJECT                            → toujours inclus si non vide
  └── request_id: UUID                           → toujours propagé (corrélation)

Protocol-Specific Translation:
  ├── REST:     HTTP status + JSON body contenant les 4 champs
  ├── GraphQL:  response.data = null, response.errors[].extensions.code = error_code
  ├── gRPC:     Status Code + google.rpc.Status.details[] contenant le code
  ├── CLI:      exit 1 + stderr JSON + message human-lisible
  └── Webhook:  HTTP response status + JSON body contenant les 4 champs
```

**Règle Critique:** Le `error_code` canonique DOIT TOUJOURS être présent dans l'erreur protocolisée. C'est la seule donnée stable et traçable entre tous les protocoles. Sans lui, la corrélation entre l'erreur protocolisée et la source canonique (API-CONTRACT-005) est brisée.

---

## 7. Regles Communes à Tous les Adapters

Les regles suivantes s'appliquent a TOUT adapter de protocole, quelle que soit sa nature ou son implémentation. Elles decoulent directement des invariants architecturaux de PAS-003 et des contrats API-CONTRACT.

### 7.1 -- RÈGLE A-001: Integrite Canonique (Canonical Integrity)

Un adapter ne modifie JAMAIS le Canonical Request ni le Canonical Response. Il peut :

- **Extraire** des champs protocol-specific des donnees brutes du protocol pour les mettre dans Canonical Request (étape 1).
- **Filtrer** des champs protocol-specific du Canonical Request avant de les envoyer a l'Application Service (suppression des en-têtes HTTP non pertinents).
- **Convertir** le Canonical Response en format protocol (étape 5).

Ce qu'il ne peut JAMAIS faire :

- ~~Ajouter des champs metamier au Canonical Request~~
- ~~Transformer des valeurs du payload (ex: convertir une string en number)~~
- ~~Supprimer des champs canoniques exigés (operationId, requestId, orgId, actorId, payload)~~
- ~~Modifier le statusCode du Canonical Response~~

**Source canonique:** **PAS-003 DR-011** (No Business Logic in Ports or Adapters), **API-CONTRACT-002** (contrats immuables).

### 7.2 -- RÈGLE A-002: Absence de Logique Métier (No Business Logic)

Un adapter ne contient AUCUNE condition basée sur le domaine. Voici ce qui est STRICTEMENT INTERDIT :

| Interdit | Exemple | Pourquoi |
|----------|---------|----------|
| Validation metier | `if (amount > 10000) require(description)` | Appartient a DOC-015 DESC-001, vérifié par Aggregate |
| Resolution de permissions | `if (role !== 'superadmin') deny()` | Appartient a AuthorizationPort, Step 2 ASS-003 |
| Gestion d'etat | `if (state === 'approved') rejectUpdate()` | Appartient a FIN-001 invariant, vérifié par Aggregate |
| Transformation de donnees metier | `amount = amount * 100` | Appartient au Domain Layer, pas au transport |
| Routes conditionnelles | `if (path starts with /admin) use admin-service` | Appartient au Request routing layer, pas a la transformation |

**Source canonique:** **PAS-003 DR-011**, **API-CONTRACT-003** (NeverBreak-InvariantPreservation).

### 7.3 -- RÈGLE A-003: Mapping Deterministe (Deterministic Mapping)

La meme input canonical + le meme protocol produit toujours le meme output protocol. Il ne peut y avoir aucune variabilité, aucun hasard, aucun effet de bord dans la transformation.

Formellement : pour tout adapter A, toute input I, tout protocol P, et toute fonction de serialisation S:

```
S(A(I), P) = result   // deterministe, reproductible, side-effect free
```

Les seul exceptions autorisées sont :

1. Le `requestId` qui peut etre genere uniqument pour tracer (mais c'est un UUID, donc statistiquement unique, pas variable).
2. Les timestamps qui sont fournis par ClockPort (**PAS-001 Port-006**), Jamais par l'adapter.

**Source canonique:** **API-CONTRACT-003** NeverBreak rules, **DOC-015 PA-NB-010** (Time Determinism via ClockPort).

### 7.4 -- RÈGLE A-004: Traduction Transparente d'Erreurs (Transparent Error Translation)

Les erreurs canoniques sont traduites fidèlement vers le protocole sans perte d'information. Chacune des 4 proprietes de l'objet Error canonique (**API-CONTRACT-002**, Section 2.3) doit etre presente dans la traduction protocol :

| Propriété Canonique | Doit Être Présent Dans |
|---------------------|----------------------|
| error_code | Champ `error_code` ou `extensions.code` du protocol |
| message | Champ `message` ou champ équivalent lisible |
| details | Champ `details` ou équivalent structuré |
| request_id | En-tête `X-Request-Id`, champ `requestId`, ou équivalent |

**Source canonique:** **API-CONTRACT-002** Section 2.3, **API-CONTRACT-005** (taxonomie complète).

### 7.5 -- RÈGLE A-005: Séparation des Responsabilités (Separation of Concerns)

Chaque adapter a UNE SEULE responsabilite : transformer les donnees entre le format protocol et le format canonical. Rien d'autre.

Responsabilites permises :

- Parser/désérialiser des donnees brutes protocol en structure intermédiaire
- Mapper les champs intermédiaires vers Canonical Request fields
- Mapper les champs Canonical Response vers serialization protocol
- Traduire les codes de statut entre canonical et protocol

Responsabilites interdites (appartenant a d'autres couches) :

- Authentification (c'est le role de IdentityProviderPort, **PAS-001 Port-004**)
- Autorisation (c'est le role de AuthorizationPort, **PAS-001 Port-005**)
- Validation schema (c'est le role du Request Contract pipeline, **API-CONTRACT-002**)
- Validation invariant (c'est le role de l'Aggregate, **DOC-015**)
- Persistance (c'est le role de RepositoryPort, **PAS-001 Port-001**)
- Publication d'événements (c'est le role de EventPublicationPort, **PAS-001 Port-002**)
- Logging (c'est le role de LoggingPort, **PAS-001 Port-009**)
- Gestion du temps (c'est le role de ClockPort, **PAS-001 Port-006**)

**Source canonique:** **PAS-003 DR-005** (API Layer Isolation), **PAS-003 DR-011** (No Business Logic).

### 7.6 -- RÈGLE A-006: Swappabilité (Swappability)

Remplacer un adapter par un autre (ex: passer de REST a GraphQL) change UNIQUEMENT le format d'entree/sortie. L'Application Service voit EXACTEMENT le meme Canonical Request et renvoie EXACTEMENT le meme Canonical Response.

Cela signifie :

- Tous les adapters doivent accepter le MÊME Canonical Request en entrée.
- Tous les adapters doivent renvoyer le MÊME Canonical Response en sortie.
- Le Canonical Request/Response sert de contrat d'interface entre l'Adapter Layer et l'Application Service Layer.

Cette regle garantit que :

1. L'Application Service n'a JAMAIS a connaitre le protocole utilise.
2. Un nouvel adapter peut etre ecrit sans modifier une seule ligne de service.
3. Les tests unitaires des Application Services sont protocol-agnostiques.

**Source canonique:** **PAS-003 DR-002** (Application Service Dependency Direction), **ASS-001** (Application Services framework-agnostic).

### 7.7 -- RÈGLE A-007: Isolement du Tenant (Tenant Isolation via org_id)

Meme si la resolution de `orgId` se fait dans le contexte d'authentification (et non dans l'adapter), l'adapter doit garantir que le `orgId` injecte dans le Canonical Request provient exclusivement du contexte authentifié et Jamais d'un paramètre utilisateur direct.

Cette regle decoule du Dependency Rule **PAS-003 DR-009** (Tenant Isolation Enforcement) :

> Every operation that accesses or stores tenant-scoped data MUST include org_id as part of its interface contract.

L'adapter garantit cela en :

1. Extrayant l'org_id UNIQUEMENT depuis le token/session d'authentification.
2. Ignorant tout org_id fourni explicitement dans le body, les query params ou les headers par le client.
3. Transmettant l'orgId extrait au Canonical Request tel quel, sans modification.

**Source canonique:** **PAS-003 DR-009**, **API-CONTRACT-002** (tous les Request Contracts incluent org_id scope).

### 7.8 -- RÈGLE A-008: Propagation du Request-ID

Chaque requete entrante possede ou reçoit un `requestId` qui sert de corrélation a travers tout le systeme. L'adapter doit :

1. Extraire `X-Request-Id` (ou en-tête équivalent protocol) si present.
2. Sinon, generer un UUID v4.
3. Injecter ce requestId dans le Canonical Request.
4. Reproduire ce meme requestId dans les headers de reponse protocol.

Cela permet le tracing end-to-end de bout en bout, depuis la requete initiale jusqu'aux Domain Events produits.

**Source canonique:** **API-CONTRACT-002** Section 2.3 (Error Contract contient toujours `request_id: UUID`).

---

## 8. Classification des Operateurs par Type d'Operation

### 8.1 -- Classification: Commandes vs Requêtes

Les 83 Operations definies dans **API-CONTRACT-001** se répartissent en deux categories au niveau de l'adapter. Cette classification determine le Canonical Response attendu.

| Type | Count | Canonical Response Attendu | Adapter Behavior |
|------|-------|--------------------------|-----------------|
| COMMAND | 57 | `{ success: boolean, version: int, events_emitted: EventList [, created_at: timestamp] }` | Map HTTP 201/204 (create) or 200 (update/delete) |
| QUERY | 26 | `{ data: entity/list, count: int }` | Map HTTP 200 |

### 8.2 -- Mapping Commande par Commande: Réponse Canonical vs Protocol

Pour chacune des 57 Commands, l'adapter sait a l'avance quel Canonical Response s'attendre, car le Response Contract est defini dans **API-CONTRACT-002** Section 2.2.

Les operations de type Commande et leur type de réponse canonique attendu :

| # | Operation | Aggregate | Response Canonical Type | Protocol Success Code |
|---|-----------|-----------|----------------------|----------------------|
| 1 | CreateOrganization | Org | `{ success:true, version:1, events_emitted:[OrganizationCreated] }` | 201 |
| 2 | UpdateOrganizationSettings | Org | `{ success:true, version:V, events_emitted:[SettingUpdated] }` | 200 |
| 3 | CreateOrgUnit | Org | `{ success:true, version:1, events_emitted:[OrgUnitCreated] }` | 201 |
| 4 | UpdateOrgUnitParent | Org | `{ success:true, version:V, events_emitted:[OrgUnitParentChanged] }` | 200 |
| 5 | TransferChildOrg | Org | `{ success:true, version:V, events_emitted:[ChildOrgTransferred] }` | 200 |
| 6 | MergeOrganizations | Org | `{ success:true, version:V, events_emitted:[ChildOrgMerged] }` | 200 |
| 7 | ArchiveOrganization | Org | `{ success:true, version:V, events_emitted:[OrganizationArchived] }` | 200 |
| 8 | SuspendOrganization | Org | `{ success:true, version:V, events_emitted:[OrganizationSuspended] }` | 200 |
| 9 | CreateUser | Identity | `{ success:true, version:1, events_emitted:[UserCreated] }` | 201 |
| 10 | UpdateUserProfile | Identity | `{ success:true, version:V, events_emitted:[UserUpdated] }` | 200 |
| 11 | ChangeUserRole | Identity | `{ success:true, version:V, events_emitted:[UserRoleChanged] }` | 200 |
| 12 | ResetPassword | Identity | `{ success:true, version:V, events_emitted:[PasswordResetRequested] }` | 200 |
| 13 | LoginUser | Identity | `{ success:true, version:1, events_emitted:[UserLoggedIn, SessionCreated] }` | 200 |
| 14 | LogoutUser | Identity | `{ success:true, version:V, events_emitted:[UserLoggedOut] }` | 200 |
| 15 | RefreshAccessToken | Identity | `{ success:true, version:1, events_emitted:[SessionCreated] }` | 200 |
| 16 | RevokeSession | Identity | `{ success:true, version:V, events_emitted:[SessionRevoked] }` | 200 |
| 17 | AssignPermissionGrant | Identity | `{ success:true, version:V }` | 200 |
| 18 | CreateTransaction | Resource | `{ success:true, version:1, events_emitted:[ResourceCreated] }` | 201 |
| 19 | UpdateDraftTransaction | Resource | `{ success:true, version:V, events_emitted:[ResourceUpdated] }` | 200 |
| 20 | SubmitForApproval | Resource | `{ success:true, version:V, events_emitted:[ApprovalRequested] }` | 200 |
| 21 | ApproveTransaction | Resource | `{ success:true, version:V, events_emitted:[ResourceStateChanged, ApprovalGranted] }` | 200 |
| 22 | RejectTransaction | Resource | `{ success:true, version:V, events_emitted:[ResourceStateChanged, ApprovalRejected] }` | 200 |
| 23 | CompensateTransaction | Resource | `{ success:true, version:1, events_emitted:[TransactionCompensated] }` | 201 |
| 24 | CreateMember | Resource | `{ success:true, version:1, events_emitted:[ResourceCreated] }` | 201 |
| 25 | UpdateMember | Resource | `{ success:true, version:V, events_emitted:[ResourceUpdated] }` | 200 |
| 26 | TransitionMemberStatus | Resource | `{ success:true, version:V, events_emitted:[ResourceStateChanged] }` | 200 |
| 27 | AddMemberToGroup | Rel | `{ success:true, version:1, events_emitted:[MemberJoinedGroup] }` | 201 |
| 28 | RemoveMemberFromGroup | Rel | `{ success:true, version:V, events_emitted:[MemberLeftGroup] }` | 200 |
| 29 | SetOrgUnitParent | Rel | `{ success:true, version:V, events_emitted:[OrgUnitReparented] }` | 200 |
| 30 | TriggerWorkflow | Workflow | `{ success:true, version:1, events_emitted:[WorkflowTriggered] }` | 201 |
| 31 | ApproveStep | Workflow | `{ success:true, version:V, events_emitted:[StepApproved] }` | 200 |
| 32 | RejectStep | Workflow | `{ success:true, version:V, events_emitted:[StepRejected] }` | 200 |
| 33 | CancelWorkflow | Workflow | `{ success:true, version:V, events_emitted:[WorkflowCancelled] }` | 200 |
| 34 | ResubmitForApproval | Workflow | `{ success:true, version:V, events_emitted:[WorkflowTriggered] }` | 200 |
| 35 | ValidateFormData | Form | `{ success:true, version:V }` (validation uniquement) | 200 |
| 36 | SendNotification | Notification | `{ success:true, version:1, events_emitted:[NotificationQueued/Sent/Failed] }` | 201 |
| 37 | MarkAsRead | Notification | `{ success:true, version:V, events_emitted:[NotificationMarkedRead] }` | 200 |
| 38 | UpdatePreferences | Notification | `{ success:true, version:V, events_emitted:[PreferencesUpdated] }` | 200 |
| 39 | SetRateLimit | Notification | `{ success:true, version:V }` | 200 |
| 40 | SuppressUntil | Notification | `{ success:true, version:V }` | 200 |
| 41 | QueueNotification | Notification | `{ success:true, version:V, events_emitted:[NotificationQueued] }` | 201 |
| 42 | AddTermValue | Vocab | `{ success:true, version:1, events_emitted:[TermAdded] }` | 201 |
| 43 | DeprecateTermValue | Vocab | `{ success:true, version:V, events_emitted:[TermValueDeprecated] }` | 200 |
| 44 | GenerateReport | Reporting | `{ success:true, version:1, events_emitted:[ReportGenerated] }` | 201 |
| 45 | LogAction | Audit | `{ success:true, version:V, events_emitted:[ActionLogged] }` | 200 |
| 46 | ArchiveResource | Lifecycle | `{ success:true, version:1, events_emitted:[ResourceArchived] }` | 201 |
| 47 | TrashResource | Lifecycle | `{ success:true, version:V, events_emitted:[ResourceTrashed] }` | 200 |
| 48 | PurgeResource | Lifecycle | `{ success:true, version:V, events_emitted:[ResourcePurged] }` | 200 |
| 49 | RestoreFromTrash | Lifecycle | `{ success:true, version:V, events_emitted:[ResourceRestoredFromTrash] }` | 200 |
| 50 | ApplyTags | Lifecycle | `{ success:true, version:V }` | 200 |
| 51 | SchedulePurge | Lifecycle | `{ success:true, version:V, events_emitted:[PurgeScheduled] }` | 201 |
| 52 | UpdateSetting | Config | `{ success:true, version:V, events_emitted:[SettingUpdated] }` | 200 |
| 53 | ResetToDefaults | Config | `{ success:true, version:V, events_emitted:[SettingsResetToDefaults] }` | 200 |
| 54 | PushPendingOperations | Sync | `{ success:true, version:V, events_emitted:[BatchPushed] }` | 201 |
| 55 | PullRemoteChanges | Sync | `{ success:true, version:V, events_emitted:[DeltaReceived] }` | 200 |
| 56 | ResolveConflict | Sync | `{ success:true, version:V, events_emitted:[ConflictResolved, ConflictDetected] }` | 200 |
| 57 | MarkOperationConfirmed | Sync | `{ success:true, version:V, events_emitted:[SyncCompleted] }` | 200 |

### 8.3 -- Mapping Query par Query: Réponse Canonical vs Protocol

Pour chacune des 26 Queries, le Canonical Response contient toujours `data` et `count`.

| # | Operation | Aggregate | Data Type | Protocol Success Code |
|---|-----------|-----------|-----------|----------------------|
| 1 | GetOrganizationProfile | Org | Organization profile object | 200 |
| 2 | GetDescendantUnits | Org | List of OrgUnit records | 200 |
| 3 | SearchResources | Resource | Paginated list of resource records | 200 |
| 4 | ExportResources | Resource | Export data blob | 200 |
| 5 | GetDescendants | Rel | List of descendant units | 200 |
| 6 | GetAllGroupsForMember | Rel | List of GroupMembership | 200 |
| 7 | GetAllMembersOfGroup | Rel | List of MemberRecords | 200 |
| 8 | GetPendingApprovals | Workflow | List of pending steps | 200 |
| 9 | LoadFormDefinition | Form | FormDefinition render tree | 200 |
| 10 | RenderForm | Form | React Native render tree JSON | 200 |
| 11 | GetVisibleFields | Form | Subset of FormField definitions | 200 |
| 12 | ResolveLabel | Vocab | Label string | 200 |
| 13 | GetTerms | Vocab | List of Term definitions | 200 |
| 14 | GetTermValues | Vocab | List of TermValue definitions | 200 |
| 15 | SearchTerms | Vocab | List of matching Terms | 200 |
| 16 | GetAllNamespaces | Vocab | List of Namespace keys | 200 |
| 17 | CalculateBalance | Reporting | BalanceTotals + category breakdown | 200 |
| 18 | ExportReport | Reporting | Export file contents | 200 |
| 19 | GetReportTypes | Reporting | List of report type defs | 200 |
| 20 | QueryAuditLogs | Audit | Paginated AuditLogEntry list | 200 |
| 21 | ExportAuditTrail | Audit | Exported audit trail data | 200 |
| 22 | ListArchiveEntries | Lifecycle | List of ArchiveEntry records | 200 |
| 23 | SearchArchives | Lifecycle | List of matching ArchiveEntries | 200 |
| 24 | GetSetting | Config | Single SettingValue | 200 |
| 25 | GetAllSettings | Config | List of all SettingEntries | 200 |
| 26 | CheckConnectivity | Sync | Connectivity state object | 200 |

**Note pour l'adapter:** Pour les 26 Queries, l'adapter map TOUJOURS vers le code protocol de succès (ex: HTTP 200, gRPC OK, GraphQL `{data:{...}}`). Aucune Query ne retourne d'erreur sauf en cas de probleme technique (auth, not found).

---

## 9. Cahier des Charges d'Extension pour Nouveaux Adaptateurs

### 9.1 -- Template Obligatoire pour Tout Nouvel Adapter

Toute personne ou tout agent developpant un nouveau Protocol Adapter pour Lumina v1 DOIT strictement suivre ce template. Devier du template constitue une violation architecturale.

```
ADAPTER TEMPLATE REQUIREMENTS

1. NAMING CONVENTION
   - Fichier principal: {protocol-name}-adapter.{extension}
   - Fichiers secondaires: {protocol-name}-parser.{ext}, {protocol-name}-serializer.{ext},
                          {protocol-name}-error-map.{ext}
   - Exemple: websocket-adapter.ts, graphql-parser.js, rest-serializer.ts

2. IMPLEMENTATION OBLIGATOIRE
   L'adapter DOIT implémenter les 3 méthodes abstraites suivantes :

   a) parseInput(rawInput: ProtocolRawData) → CanonicalRequest
      - Entrée: données brutes du protocole (bytes, string, buffer, etc.)
      - Sortie: CanonicalRequest structuré conforme a API-CONTRACT-002
      - Responsabilités:
        * Extraire method, path, headers, body, query params
        * Resoudre operationId depuis les données protocol
        * Extraire ou générer requestId (UUID)
        * Extraire orgId UNIQUEMENT du contexte d'authentification
        * Extraire actorId UNIQUEMENT du contexte d'authentification
        * Extraire payload conforme Request Contract de API-CONTRACT-002
        * Filtrer metadata protocol-specific non-business
      - Exceptions: Si parsing échoue → retourner parseError(protocol-specific)
        NE PAS lever une exception canonique (E-400-NNN)

   b) serializeOutput(canonicalResponse: CanonicalResponse) → ProtocolOutput
      - Entrée: CanonicalResponse conforme a API-CONTRACT-002 Section 2.2
      - Sortie: données protocol spécifiques (response bytes, HTTP status line+body, etc.)
      - Responsabilités:
        * Mapper statusCode canonical vers code protocol (Section 5 de ce doc)
        * Serialiser body canonical vers format protocol
        * Mapper error canonical vers format protocol error (Section 6)
        * Ajouter headers protocol-specific
      - L'adapter NE JAMAIS modifie body ou error fields

   c) mapError(canonicalError: CanonicalError) → ProtocolError
      - Entrée: objet d'erreur canonique conforme a API-CONTRACT-002 Section 2.3
      - Sortie: erreur traduite pour le protocol cible
      - Responsabilités:
        * TOUJOURS inclure error_code canonique dans la sortie
        * Traduire statusCode canonical vers protocol code (Section 5)
        * Traduire message et details fidèlement
        * Propager request_id

3. INTERDICTIONS ABSOLUES
   L'adapter NE DOIT SURTOUT PAS :

   - Importer ou référencer des regles métieres (Business Rules de DOC-016)
   - Importer ou référencer des invariants (DOC-015)
   - Importer ou référencer des Aggregates (DOC-012)
   - Implémenter de la logique de decision basée sur les donnees métier
   - Accéder directement a la base de donnees ou a tout RepositoryPort
   - Créer, modifier ou supprimer des entités du domaine
   - Produire, modifier ou consommer des Domain Events
   - Appeler IdentityProviderPort, AuthorizationPort, ClockPort, UUIDPort, etc.

4. CONFIGURATION
   - Toutes les configurations doivent provenir d'un fichier externe ou de variables d'environnement
   - Ni les regles de mapping, ni les tables de correspondance, ni les contrats de parsing
     ne peuvent être hardcoded dans l'adapter
   - Le mapping operationId est défini dans ce document (PROTO-001), pas dans l'adapter

5. LOGGING
   - Utiliser uniquement LoggingPort (PAS-001 Port-009) pour toute sortie de log
   - Ne jamais logger de données sensibles (password_hash, JWTToken, credentials)
   - Logs de parsing: level debug ou info uniquement
   - Logs d'erreur de parsing: level error avec le protocol raw (sans données business)

6. TESTING
   - Chaque adapter DOIT avoir des tests unitaires couvrant :
     * Le parsing d'une entrée protocol valide vers un Canonical Request valide
     * Le parsing d'une entrée protocol invalide (structure brisée) → parseError
     * La sérialisation d'un Canonical Response valide vers un output protocol valide
     * La traduction de chaque catégorie d'erreur E-400, E-401, E-403, E-404, E-409, E-422, E-500
     * La deterministe: même input × même protocol → même output (testé 2 fois)
   - Les tests doivent etre protocol-agnostiques au niveau de l'App Service

7. COMPOSANTS AUTORISÉS
   L'adapter PEUT utiliser :
   - Bibliothèques de parsing/de-serialization du protocol cible (ex: JSON parser, protobuf lib)
   - UUID generator (via UUIDPort, PAS-001 Port-007)
   - Logging utilities (via LoggingPort, PAS-001 Port-009)
   - Cryptographic primitives pour la verification de signatures protocol (JWT decode, signature verification)
```

### 9.2 -- Verification de Conformité

Avant qu'un nouvel adapter ne soit integre, il doit passer les vérifications suivantes :

| Check | Description | Responsable |
|-------|-------------|-------------|
| C-01 | parseInput produit toujours un CanonicalRequest valide conforme a API-CONTRACT-002 | Test automatique |
| C-02 | serializeOutput respecte le mapping de status codes de Section 5 | Test automatique |
| C-03 | mapError préserve le error_code canonique pour les 42 codes + variantes étendues | Test automatique |
| C-04 | Aucun import de business logic (grep pour INV-, BR-, FIN-, DATE-, CAT- dans le code adapter) | Review statique |
| C-05 | Pas de lecture directe de base de donnees | Review statique |
| C-06 | Configuration externe uniquement | Review manuelle |
| C-07 | Determinisme vérifié (même input → meme output, testé 2x) | Test automatique |
| C-08 | Aucune référence aux 83 operations autre que operationId string literal | Review statique |

---

## 10. Referencement Croise Complet -- Traçabilité

### 10.1 -- Matrice de Traceabilité

Chaque section de ce document est tracable vers au moins un document source canonique :

| Section PROTO-001 | Document Source | Reference Exacte |
|-------------------|----------------|-----------------|
| 1.1 Positionnement | DOC-013 | Boundary specification |
| 1.2 Integrite Canonique | API-CONTRACT-001 | 83 Operations |
| 1.2 Integrite Canonique | API-CONTRACT-002 | Request/Response Contracts |
| 1.3 Adaptation Unidirectionnelle | ASS-001 | 13 Application Services |
| 1.4 Absence de Logique Métier | PAS-003 DR-011 | No Business Logic in Ports/Adapters |
| 1.5 Prime Validite Canonique | API-CONTRACT-002 | Request validation pipeline |
| 2.1 Hierarchie Couches | PAS-003 | DR-001 through DR-012 |
| 2.2 Classification | Protocole Concepts | REST, GraphQL, gRPC, CLI, Webhook |
| 2.3 Isolation entre Adapters | PAS-003 DR-003 | Adapter Implementation Rule |
| 2.4 Relation 17 Ports | PAS-001 | Port-001 through Port-017 |
| 3.1 Diagramme Pipeline | ASS-003 | Workflow Standard Steps 1-8 |
| 3.2 Immortalité CR/CRs | API-CONTRACT-002 | Sections 2.1, 2.2, 2.3 |
| 3.3 Determinisme | API-CONTRACT-003 | NeverBreak rules |
| 4.1 Parser/Deserializer | API-CONTRACT-002 §2.1 | Request Contracts par operation |
| 4.2 Canonical Request | API-CONTRACT-002 §2.1 | Field definitions |
| 4.3 Service Call | ASS-001 | 13 Application Services registry |
| 4.3 Service Call | ASS-003 | Workflow Standard Steps 1-8 |
| 4.4 Canonical Response | API-CONTRACT-002 §2.2 | Response contracts |
| 4.4 Canonical Response | API-CONTRACT-002 §2.3 | Error contract standard |
| 4.4 Canonical Response | API-CONTRACT-002 §2.4 | Pagination contract |
| 4.5 Serializer | Section 5 de ce doc | Status code mapping |
| 5.1 Table Globale | API-CONTRACT-005 | Error taxonomy categories |
| 5.2 Details par Protocol | Protocole Concepts | Mapping convention |
| 6.1 Reference Taxonomie | API-CONTRACT-005 | Full error taxonomy |
| 6.2 Mapping E-400 | API-CONTRACT-005 §E-400 | 7 codes INVALID_INPUT through INVALID_PAYLOAD |
| 6.3 Mapping E-401 | API-CONTRACT-005 §E-401 | 3 codes NOT_AUTHENTICATED through INVALID_CREDENTIALS |
| 6.4 Mapping E-403 | API-CONTRACT-005 §E-403 | 5 codes INSUFFICIENT_PERMISSION through ARCHIVED_ORG |
| 6.5 Mapping E-404 | API-CONTRACT-005 §E-404 | 6 codes ENTITY_NOT_FOUND through WORKFLOW_DEFINITION_NOT_FOUND |
| 6.6 Mapping E-409 | API-CONTRACT-005 §E-409 | 6 codes OPTIMISTIC_LOCK_CONFLICT through ALREADY_PURGED |
| 6.7 Mapping E-422 | API-CONTRACT-005 §E-422 | 38 detailed invariant-specific error mappings |
| 6.8 Mapping E-500 | API-CONTRACT-005 §E-500 | 4 codes UNEXPECTED_ERROR through DEPENDENCY_FAILURE |
| 7.1 RÈGLE A-001 | PAS-003 DR-011 | No Business Logic in Ports/Adapters |
| 7.1 RÈGLE A-001 | API-CONTRACT-002 | Immutable contracts |
| 7.2 RÈGLE A-002 | PAS-003 DR-011 | No Business Logic in Ports/Adapters |
| 7.2 RÈGLE A-002 | API-CONTRACT-003 | NeverBreak-InvariantPreservation |
| 7.3 RÈGLE A-003 | API-CONTRACT-003 | NeverBreak rules |
| 7.3 RÈGLE A-003 | DOC-015 PA-NB-010 | Time Determinism |
| 7.4 RÈGLE A-004 | API-CONTRACT-002 §2.3 | Error contract standard |
| 7.4 RÈGLE A-004 | API-CONTRACT-005 | Full taxonomy |
| 7.5 RÈGLE A-005 | PAS-003 DR-005 | API Layer Isolation |
| 7.5 RÈGLE A-005 | PAS-003 DR-011 | No Business Logic in Ports/Adapters |
| 7.6 RÈGLE A-006 | PAS-003 DR-002 | Application Service Dependency Direction |
| 7.6 RÈGLE A-006 | ASS-001 | Application Services tech-agnostic |
| 7.7 RÈGLE A-007 | PAS-003 DR-009 | Tenant Isolation Enforcement |
| 7.7 RÈGLE A-007 | API-CONTRACT-002 | All Request Contracts include org_id |
| 7.8 RÈGLE A-008 | API-CONTRACT-002 §2.3 | Error contract requestId |
| 8.1 Classification 83 ops | API-CONTRACT-001 | 57 Commands + 26 Queries |
| 8.2 Mapping Commands | API-CONTRACT-002 §2.2 | Standard Success Response |
| 8.2 Mapping Commands | API-CONTRACT-001 | 57 Commands detailées |
| 8.2 Mapping Commands | API-CONTRACT-002 §2.2 | Event List Structure |
| 8.3 Mapping Queries | API-CONTRACT-002 §2.2 | Standard Query Response |
| 8.3 Mapping Queries | API-CONTRACT-001 | 26 Queries detailées |
| 9.1 Template Adapter | PAS-001 | 17 Ports (references interdites) |
| 9.2 Verification | API-CONTRACT-003 | NeverBreak enforcement |
| 10.1 Matrice Traceabilite | Tous documents sources | Cross-reference complète |

### 10.2 -- Couverture des 83 Operations par Protocol Adapters

Toutes les 83 operations definies dans **API-CONTRACT-001** sont couvertes par les protocol adapters suivants, selon le pattern de transformation de la Section 3 :

| Aggregate | Commands (per adapter) | Queries (per adapter) | Total per Adapter |
|-----------|----------------------|---------------------|------------------|
| OrganizationAggregate (10) | 8 | 2 | 10 x 5 protocoles = 50 endpoints |
| IdentityAggregate (9) | 9 | 0 | 9 x 5 protocoles = 45 endpoints |
| ResourceAggregate (12) | 10 | 2 | 12 x 5 protocoles = 60 endpoints |
| RelationshipAggregate (6) | 3 | 3 | 6 x 5 protocoles = 30 endpoints |
| WorkflowAggregate (6) | 5 | 1 | 6 x 5 protocoles = 30 endpoints |
| FormAggregate (4) | 1 | 3 | 4 x 5 protocoles = 20 endpoints |
| NotificationAggregate (6) | 6 | 0 | 6 x 5 protocoles = 30 endpoints |
| VocabularyAggregate (7) | 2 | 5 | 7 x 5 protocoles = 35 endpoints |
| ReportingAggregate (4) | 1 | 3 | 4 x 5 protocoles = 20 endpoints |
| AuditAggregate (3) | 1 | 2 | 3 x 5 protocoles = 15 endpoints |
| LifecycleAggregate (7) | 5 | 2 | 7 x 5 protocoles = 35 endpoints |
| ConfigurationAggregate (4) | 2 | 2 | 4 x 5 protocoles = 20 endpoints |
| OfflineSyncAggregate (6) | 4 | 2 | 6 x 5 protocoles = 30 endpoints |
| **TOTAL** | **57 Commands** | **26 Queries** | **83 Operations × 5 protocoles = 415 endpoint implementations** |

Chaque endpoint est servi par l'adapter de protocole correspondant. L'adapter ne connait pas le nom de l'Application Service qu'il invoque. Il transmet le Canonical Request et attend le Canonical Response.

### 10.3 -- Couverture des 60+ Domain Events par Protocol Adapters

Les Domain Events definis dans **API-CONTRACT-002** Section 2.2 (Event List Structure) sont transmis via le Canonical Response (`events_emitted` champ). Les protocol adapters les transmettent tels quels, sans modification, dans le champ approprié de la reponse protocole :

- REST: `events_emitted` dans le body JSON de la reponse.
- GraphQL: `eventsEmitted` dans le champ de mutation/query result.
- gRPC: dans le protobuf response message, field `events_emitted repeated DomainEvent`.
- CLI: affiché dans le JSON de sortie sur stdout.
- Webhook: `events_emitted` dans le body de la reponse HTTP.

Aucun adapter ne consomme directement les Domain Events -- c'est le role de EventSubscriptionPort (**PAS-001 Port-003**).

### 10.4 -- Couverture des 58 Invariants par Protocol Adapters

Les 58 invariants definis dans **DOC-015** sont tous vérifiés par les Aggregates, Jamais par les protocol adapters. Les adapteurs ne font QUE traduire les erreurs E-422-NNN qui résultent des violations d'invariants, vers le format protocol approprié (Section 6).

La traducion protocol preserve TOUJOURS la référence exacte a l'invariant violée via le `details.invariant` field dans l'erreur protocolisée.

### 10.5 -- Compliance Statement Global

Ce document PROTO-001 est conforme a l'ensemble des specifications canoniques de Lumina v1 :

- **API-CONTRACT-001**: Toutes les 83 operations sont mapées dans les sections 4, 5, 8.
- **API-CONTRACT-002**: Tous les Request/Response/Error contracts sont respectés dans les sections 4 et 6.
- **API-CONTRACT-003**: Tous les NeverBreak rules sont reflétés dans les sections 7 (regles A-001 a A-008).
- **API-CONTRACT-004**: Les mappages RBAC sont gérés par la couche d'authentification/autorisation AVANT l'adapter, pas dans l'adapter.
- **API-CONTRACT-005**: Toutes les 42+ erreurs canoniques (categories E-400 a E-500 avec toutes les variantes étendues) sont mapées dans la section 6.
- **API-CONTRACT-006**: Le rapport de validation confirme la coherence complete entre tous les contrats API.
- **PAS-001**: Les 17 Ports sont declares hors scope de l'adapter (Section 2.4).
- **PAS-003**: Les 12 Dependency Rules sont toutes respequées (Sections 7.1 a 7.7).
- **ASS-001**: Les 13 Application Services sont transparents pour l'adapter (Section 4.3).
- **ASS-003**: Le workflow standard de 8 étapes est respequé au niveau du Canonical Request/Response pipeline (Section 3).
- **DOC-015**: Les 58 invariants sont traités via la traduction d'erreurs (Section 6).

Aucun element de ce document n'invente de nouvelle operation, invariant, port, adapter, ou technologie. Chaque ligne est directement tracable vers au moins un document source canonique liste dans le header.

---

## GLOSSAIRE DE CE DOCUMENT

| Terme | Definition |
|-------|-----------|
| **Protocol Adapter** | Composant de la Couche 4 de l'architecture hexagonale qui transforme les donnees entre un protocole de transport specifique et le format Canonical Request/Response. |
| **Canonical Request** | Structure de demande immuable definie par API-CONTRACT-002, contenant operationId, requestId, orgId, actorId, payload, metadata. |
| **Canonical Response** | Structure de reponse immuable definie par API-CONTRACT-002, contenant statusCode, body, headers, events, error. |
| **Parse Error** | Erreur technique survenant a l'Étape 1 si les donnees brutes du protocole ne sont pas structuralement valides. Différente d'une erreur canonique. |
| **Operation Id** | Identifiant unique d'une operation canonique (exactement les 83 noms d'API-CONTRACT-001). |
| **RequestId** | UUID de corrélation present dans toutes les requetes et reponses, pour le tracing end-to-end. |
| **Tenant Isolation** | Regle PAR-003 DR-009 garantissant que orgId vient uniquement du contexte authentifié. |
| **Deterministic Mapping** | Principe selon lequel la même input canonique × meme protocol → meme output protocol toujours. |
| **Transparent Error Translation** | Principe selon lequel l'erreur canonique est fidelement traduite dans chaque protocole sans perte d'information. |
| **Swappability** | Proprieté garantissant que remplacer un adapter par un autre change uniquement l'entree/sortie protocole. |
| **Domain Events** | Evenements definis dans API-CONTRACT-002 Section 2.2, transmis via Canonical Response events_emitted. |
| **Invariant Violation** | Erreur renvoyee quand un invariant de DOC-015 est viole, code canonique E-422-NNN. |
| **Application Service** | Service d'orchestration definis dans ASS-001, 1 au total par Aggregate, 13 au total. |
| **Port** | Interface abstraite definie dans PAS-001, 17 ports total (RepositoryPort, EventPublicationPort, etc.). |
| **Dependency Rule** | Regle d'architecture definie dans PAS-003, 12 regles total (DR-001 a DR-012). |

---

**FIN DU DOCUMENT PROTO-001**

---

## ANNEXE A: Checklist de Verification pour le Developpement d'un Adapter

Pour faciliter le développement conforme d'un Protocol Adapter, voici une checklist pratique a utiliser avant tout merge :

- [ ] parseInput retourne toujours un CanonicalRequest valide avec TOUS les champs requis
- [ ] Le operationId correspond exactement a un nom d'operation d'API-CONTRACT-001
- [ ] Le orgId est extrait UNIQUEMENT du contexte d'authentification, jamais des donnees utilisateur
- [ ] Le actorId est extrait UNIQUEMENT du contexte d'authentification
- [ ] Le requestId est un UUID v4 valide
- [ ] Le payload respecte EXACTEMENT le Request Contract de l'operation correspondante dans API-CONTRACT-002
- [ ] Les donnees protocol-specific non-business sont filtrees vers metadata
- [ ] serializeOutput map TOUS les status codes canonical vers les codes protocol de la Section 5
- [ ] mapError preserve TOUS les 4 champs de l'erreur canonique (error_code, message, details, request_id)
- [ ] Le error_code canonique EST TOUJOURS present dans la reponse protocol
- [ ] Aucune validation metier n'est effectuee dans l'adapter
- [ ] Aucune condition basee sur le domaine n'existe dans l'adapter
- [ ] L'adapter n'importe AUCune regle metier, invariant, aggregate, ou repository
- [ ] La configuration est externe (fichier ou variables environnement uniquement)
- [ ] Le logging utilise exclusively LoggingPort
- [ ] Aucune donnee sensible (password, token, credential) n'apparait dans les logs
- [ ] Le determinisme est verifie: 2 appels identiques produisent exactement la meme sortie
- [ ] Les tests couvrent les 7 categories d'erreurs (E-400, E-401, E-403, E-404, E-409, E-422, E-500)
- [ ] Les tests couvrent les parses invalides (donnees brutes corrompues)
- [ ] L'adapter implemente exactement 3 methodes obligatoires (parseInput, serializeOutput, mapError)

---

## ANNEXE B: Tableau de Correspondance Operation → Canonical Request Fields

Tableau complet des champs requis dans le Canonical Request pour chaque operation d'API-CONTRACT-001. Ce tableau est gere par API-CONTRACT-002. L'adapter se refere a ce tableau pour construire le payload du Canonical Request.

| Operation | Required Payload Fields | Optional Payload Fields |
|-----------|----------------------|----------------------|
| CreateOrganization | name, type | settings |
| UpdateOrganizationSettings | key, value | — |
| CreateOrgUnit | name, unit_type | parent_id, depth_level |
| UpdateOrgUnitParent | unit_id, new_parent_id | — |
| TransferChildOrg | child_org_id, new_parent_id | — |
| MergeOrganizations | source_org_id, target_org_id | — |
| ArchiveOrganization | org_id | — |
| SuspendOrganization | org_id | — |
| CreateUser | email, password_hash, role, first_name, last_name, org_id | phone |
| UpdateUserProfile | user_id, updates | — |
| ChangeUserRole | user_id, new_role | — |
| ResetPassword | user_id, new_password_hash | — |
| LoginUser | email, password, org_id | — |
| LogoutUser | session_id | — |
| RefreshAccessToken | refresh_token_hash | — |
| RevokeSession | session_id | — |
| AssignPermissionGrant | role_id, permission_string | — |
| CreateTransaction | org_id, amount_cents, type, category_ref, scope_type, transaction_date | status, scope_target_id, description, compensates_for, approved_by |
| UpdateDraftTransaction | transaction_id, updates | — |
| SubmitForApproval | transaction_id | — |
| ApproveTransaction | transaction_id, approver_id | — |
| RejectTransaction | transaction_id, reason | — |
| CompensateTransaction | original_transaction_id, compensation_data | — |
| CreateMember | org_id, first_name, last_name | email, phone, date_of_birth, initial_status |
| UpdateMember | member_id, updates | — |
| TransitionMemberStatus | member_id, new_status | — |
| SearchResources | org_id | resource_type, status, date_from, date_to, category_ref, search_text |
| ExportResources | org_id, format | filters |
| AddMemberToGroup | member_id, group_id | — |
| RemoveMemberFromGroup | member_id, group_id | — |
| SetOrgUnitParent | unit_id, parent_unit_id | — |
| TriggerWorkflow | definition_key, resource_type, resource_id, trigger_event | — |
| ApproveStep | instance_id, step_id | comment |
| RejectStep | instance_id, step_id, reason | — |
| CancelWorkflow | instance_id, reason | — |
| ResubmitForApproval | instance_id | — |
| ValidateFormData | form_id, form_data | — |
| SendNotification | recipient_user_id, channel, body, trigger_source | severity |
| MarkAsRead | notification_id | — |
| UpdatePreferences | user_id | channels, severity_min, rate_limit_per_hour |
| SetRateLimit | user_id, max_per_hour | — |
| SuppressUntil | user_id, until_time | — |
| AddTermValue | namespace, term_key, label_fr, label_en | color_hex |
| DeprecateTermValue | namespace, term_key, value_key | — |
| GenerateReport | report_type, period_start, period_end, scope | format |
| CalculateBalance | scope, period_start, period_end | — |
| ExportReport | report_id, format | — |
| GetReportTypes | org_id | — |
| LogAction | entity_type, entity_id, action, old_values, new_values, user_id | — |
| QueryAuditLogs | filters | pagination |
| ArchiveResource | resource_type, resource_id | — |
| TrashResource | archive_id | — |
| PurgeResource | archive_id | — |
| RestoreFromTrash | archive_id | — |
| ListArchiveEntries | — | filters |
| SearchArchives | query_string | tags, type |
| ApplyTags | archive_id, tags | — |
| SchedulePurge | archive_id, purge_date | — |
| UpdateSetting | key, value | — |
| ResetToDefaults | — | — |
| PushPendingOperations | operations | — |
| PullRemoteChanges | since_timestamp | — |
| ResolveConflict | operation_id, conflict_data, strategy | — |
| MarkConfirmed | operation_id | — |
| CheckConnectivity | — | — |
| GetSyncStatus | table_name | — |

**Source:** API-CONTRACT-002 Section 2.1 (tous les Request Contracts).

---

## ANNEXE C: Tableau de Correspondance Operation → Canonical Response Fields

| Operation | Response Type | Success Body Fields |
|-----------|--------------|--------------------|
| CreateOrganization | Create response | success, version=1, created_at, events_emitted |
| UpdateOrganizationSettings | Update response | success, version, events_emitted |
| CreateOrgUnit | Create response | success, version=1, created_at, events_emitted |
| UpdateOrgUnitParent | Update response | success, version, events_emitted |
| TransferChildOrg | Update response | success, version, events_emitted |
| MergeOrganizations | Update response | success, version, events_emitted |
| ArchiveOrganization | Update response | success, version, events_emitted |
| SuspendOrganization | Update response | success, version, events_emitted |
| CreateUser | Create response | success, version=1, created_at, events_emitted |
| UpdateUserProfile | Update response | success, version, events_emitted |
| ChangeUserRole | Update response | success, version, events_emitted |
| ResetPassword | Update response | success, version, events_emitted |
| LoginUser | Auth response | success, version=1, events_emitted (UserLoggedIn, SessionCreated) |
| LogoutUser | Update response | success, version, events_emitted |
| RefreshAccessToken | Auth response | success, version=1, events_emitted (SessionCreated) |
| RevokeSession | Update response | success, version, events_emitted |
| AssignPermissionGrant | Update response | success, version, events_emitted |
| CreateTransaction | Create response | success, version=1, created_at, events_emitted |
| UpdateDraftTransaction | Update response | success, version, events_emitted |
| SubmitForApproval | Update response | success, version, events_emitted |
| ApproveTransaction | Update response | success, version, events_emitted |
| RejectTransaction | Update response | success, version, events_emitted |
| CompensateTransaction | Create response | success, version=1, created_at, events_emitted |
| CreateMember | Create response | success, version=1, created_at, events_emitted |
| UpdateMember | Update response | success, version, events_emitted |
| TransitionMemberStatus | Update response | success, version, events_emitted |
| AddMemberToGroup | Create response | success, version=1, events_emitted |
| RemoveMemberFromGroup | Update response | success, version, events_emitted |
| SetOrgUnitParent | Update response | success, version, events_emitted |
| TriggerWorkflow | Create response | success, version=1, events_emitted |
| ApproveStep | Update response | success, version, events_emitted |
| RejectStep | Update response | success, version, events_emitted |
| CancelWorkflow | Update response | success, version, events_emitted |
| ResubmitForApproval | Update response | success, version, events_emitted |
| ValidateFormData | Validation response | success, version (valid/invalid + errors) |
| SendNotification | Create response | success, version=1, events_emitted |
| MarkAsRead | Update response | success, version, events_emitted |
| UpdatePreferences | Update response | success, version, events_emitted |
| SetRateLimit | Update response | success, version |
| SuppressUntil | Update response | success, version |
| AddTermValue | Create response | success, version=1, events_emitted |
| DeprecateTermValue | Update response | success, version, events_emitted |
| GenerateReport | Report response | success, version=1, events_emitted |
| LogAction | System response | success, version, events_emitted |
| ArchiveResource | Create response | success, version=1, events_emitted |
| TrashResource | Update response | success, version, events_emitted |
| PurgeResource | System response | success, version, events_emitted |
| RestoreFromTrash | Update response | success, version, events_emitted |
| ApplyTags | Update response | success, version |
| SchedulePurge | Create response | success, version=1, events_emitted |
| UpdateSetting | Update response | success, version, events_emitted |
| ResetToDefaults | Update response | success, version, events_emitted |
| PushPendingOperations | Create response | success, version=1, events_emitted |
| PullRemoteChanges | Update response | success, version, events_emitted |
| ResolveConflict | Update response | success, version, events_emitted |
| MarkOperationConfirmed | Update response | success, version, events_emitted |
| SearchResources | Query response | data (list), count |
| ExportResources | Query response | data (export blob) |
| GetDescendants | Query response | data (list), count |
| GetAllGroupsForMember | Query response | data (list), count |
| GetAllMembersOfGroup | Query response | data (list), count |
| GetPendingApprovals | Query response | data (list), count |
| LoadFormDefinition | Query response | data (FormDefinition) |
| RenderForm | Query response | data (render tree) |
| GetVisibleFields | Query response | data (FormField subset) |
| ResolveLabel | Query response | data (label string) |
| GetTerms | Query response | data (list), count |
| GetTermValues | Query response | data (list), count |
| SearchTerms | Query response | data (list), count |
| GetAllNamespaces | Query response | data (list), count |
| CalculateBalance | Query response | data (BalanceTotals) |
| ExportReport | Query response | data (export file) |
| GetReportTypes | Query response | data (list), count |
| QueryAuditLogs | Query response | data (list), count |
| ExportAuditTrail | Query response | data (trail data) |
| ListArchiveEntries | Query response | data (list), count |
| SearchArchives | Query response | data (list), count |
| GetSetting | Query response | data (SettingValue) |
| GetAllSettings | Query response | data (list), count |
| CheckConnectivity | Query response | data (connectivity state) |
| GetSyncStatus | Query response | data (SyncStatusTracker) |

**Source:** API-CONTRACT-002 Section 2.2 (Standard Success Response pour Commands et Queries).

---

## ANNEXE D: Tableau de Verifier la Compatibilite Protocole

Ce tableau aide a verifier qu'un adapter protocol supporte correctement chaque aspect du Canonical Request/Response pipeline.

| Aspect | REST | GraphQL | gRPC | CLI | Webhook |
|--------|------|---------|------|-----|---------|
| Authentication context extraction | Via Authorization header | Via Authorization header | Via metadata header | Via config file/env | Via signature header |
| org_id resolution | From session token | From session token | From session token | From session token | From session token |
| body parsing | JSON body | GraphQL variables | Protobuf message | CLI args/stdin | JSON body |
| pagination support | Query params | GraphQL arguments | PageToken in proto | CLI flags | Webhook pagination params |
| bulk operations | Multiple sequential requests | Batch mutation | Batch unary calls | Loop in script | Multiple sequential requests |
| streaming support | Not supported (request/response) | Subscription operations | Server-streaming, Client-streaming | Not supported | Not supported (request/response) |
| idempotency key | idempotency-key header | Mutation variable | Metadata header | CLI flag | idempotency-key header |
| request correlation | X-Request-Id header | Variable in query | Metadata header | CLI output field | X-Request-Id header |
| error translation | Full coverage (all 7 categories) | Full coverage (all 7 categories) | Full coverage (all 7 categories) | Full coverage (all 7 categories) | Full coverage (all 7 categories) |
| event propagation | events_emitted in JSON body | eventsEmitted in result | events_emitted in proto | events_emitted in JSON output | events_emitted in JSON body |
| deterministic output | Yes | Yes | Yes | Yes | Yes |
| no business logic | Verified | Verified | Verified | Verified | Verified |
| swappable | Replaces any other adapter | Replaces any other adapter | Replaces any other adapter | Replaces any other adapter | Replaces any other adapter |

---

## ANNEXE E: Decision Records pour les Choix Architecturaux

### DECISION PA-001: Le Canonical Request est une structure plate

**Problème:** Faut-il utiliser une structure hiérarchique ou plate pour le Canonical Request ?

**Décision:** Structure plate avec exactement 6 champs: operationId, requestId, orgId, actorId, payload, metadata.

**Justification:** La structure plate minimise les risques d'erreur de mapping. Chaque adapter sait exactement où trouver chaque information. Une structure hiérarchique ajouterait de la complexité sans bénéfice pour la transformation.

**Source:** Pattern derive de API-CONTRACT-002 Section 2.1 qui definit chaque operation avec ses champs de requete plats.

---

### DECISION PA-002: Le Canonical Response contient le status code en tant que nombre

**Probleme:** Faut-il utiliser des strings ("OK", "BadRequest") ou des nombres (200, 400) pour les status codes canoniques ?

**Decision:** Nombres entiers. Le Canonical Response utilise des codes numeriques canoniques (200, 201, 400, etc.) qui sont ensuite traduits vers le protocol cible.

**Justification:** Les nombres sont plus compacts, plus faciles a comparer programmiquement, et universellement compris. Chaque protocol a sa propre semantique pour les codes numeriques, donc la traduction necessaire rend le choix du string inutile.

**Source:** Pattern derive de API-CONTRACT-002 Section 2.2 et API-CONTRACT-005.

---

### DECISION PA-003: La traduction d'erreur est centralisée dans mapError()

**Probleme:** Chaque adapter implémente-t-il sa propre traduction d'erreur ou partage-t-on la traduction ?

**Decision:** Chaque adapter implémente sa propre methode mapError() dans le template, mais elle utilise EXCLUSIVEMENT les definitions de ce document (Section 6) comme reference unique.

**Justification:** Chaque protocole a des contraintes techniques différentes pour les erreurs (gRPC utilise google.rpc.Status, REST utilise JSON bodies). Une centrale shared serait trop rigide. Mais la Reference (Section 6) est unique et non negociable.

**Source:** Template de la Section 9.1 Requirements point 3c.

---

### DECISION PA-004: Les Domain Events sont transmis via le Canonical Response, pas par un canal separate

**Probleme:** Les Domain Events doivent-ils etre transmis dans le Canonical Response ou via un canal séparé (comme un event bus au niveau de l'adapter) ?

**Decision:** Transmission via le Canonical Response events_emitted field.

**Justification:** Cela garantit que les Domain Events sont toujours disponibles dans la reponse de l'operation. Un canal separe necessiterait une mechanisme de corrélation supplementaire et augmente la complexité sans bénéfice. L'event publishing (ASS-003 Step 7) reste gere par la couche Application Service → EventPublicationPort.

**Source:** API-CONTRACT-002 Section 2.2 (Event List Structure), ASS-003 Step 8 (Response includes events_emitted).

---

### DECISION PA-005: L'adapter ne gere pas le caching

**Probleme:** Un adapter de protocole devrait-il implémenter le caching pour optimiser les reponses ?

**Decision:** Non. Le caching est gere par CachePort (**PAS-001 Port-014**) et est du ressort de la couche Infrastructure, pas de l'adapter.

**Justification:** Le caching introduit de la non-determinisme (cache hit vs miss change la latence et potentiellement la semantique de la reponse). Le dependency rule PAS-003 DR-007 (Persistence Ignorance) s'applique aussi au caching: ni l'adapter ni le service ne doivent savoir comment les donnees sont cachees.

**Source:** PAS-001 Port-014, PAS-003 DR-007.

---

### DECISION PA-006: L'adapter ne valide pas la structure brute du protocole en amont de la delegation

**Probleme:** L'adapter doit-il valider en profondeur la structure des donnees entrantes avant de deleguer ?

**Decision:** Non. L'adapter valide uniquement la syntaxe brute du protocole (est-ce que c'est du JSON valide ? est-ce que le body respecte le schema du protocole ?). La validation semantique (champs requis canoniques, types des champs, ranges, patterns) est delegatee au Canonical Request pipeline qui applique les Request Contracts d'API-CONTRACT-002.

**Justification:** Double validation serait redondante et risquerait de introduire des divergences entre la validation de l'adapter et la validation canonique. Un adapter fait la validation minimale necessaire a l'extraction des champs canoniques; le reste est fait par la couche API/Service qui applique les contrats canoniques.

**Source:** API-CONTRACT-003 NeverBreak-InvariantPreservation: l'API ne modifie pas les invariants, elle les transmet.

---

### DECISION PA-007: Les timestamps utilisent ClockPort, jamais system time

**Probleme:** L'adapter peut-il utiliser l'horloge systeme pour générer des timestamps dans les metadata ?

**Decision:** Non. Les timestamps proviennent exclusivement de ClockPort (**PAS-001 Port-006**).

**Justification:** DOC-015 PA-NB-010 exige que toutes les timestamps viennnent de ClockPort pour garantir le determinisme, notamment pour les tests et la reproductibilite. L'adapter ne doit en aucun cas appeler system clock directement.

**Source:** PAS-001 Port-006, DOC-015 PA-NB-010, PAS-003 DR-010 (Clock Source Unification).

---

### DECISION PA-008: Un Canonical Request est valide meme s'il contient des champs protocol en plus

**Probleme:** Si un protocole ajoute des champs extra non prevus dans le Canonical Request, l'adapter doit-il rejeter la requete ou les ignorer ?

**Decision:** Ignorer. Les champs protocol-specific additionnels sont filtres vers metadata. Le Canonical Request canonique (operationId, requestId, orgId, actorId, payload, metadata) est construit avec les champs canoniques; les champs extra sont ignorés apres extraction.

**Justification:** La swappabilité (RÈGLE A-006) exige que les adapters soient interchangeables. Si un protocole fournit des donnees supplementaires, cela ne doit pas casser la requete. La regexule d'integrite canonique (RÈGLE A-001) dit que l'adapter ne modifie PAS les champs canoniques, mais ne dit pas qu'il ne peut pas ignorér les extras.

**Source:** RÈGLE A-001 et A-006 de Section 7.

---

### DECISION PA-009: Le mapping operationId est definit ici, pas dans l'adapter

**Probleme:** Où sont definies les tables de mapping entre les chemins/handles protocol et les operationIds canoniques ?

**Decision:** Les tables de mapping definitives (chemins REST → operationIds, root fields GraphQL → operationIds, methods gRPC → operationIds, sous-commandes CLI → operationIds, webhook event types → operationIds) sont definies dans ce document (Sections 4.1 et 10.2). Les adapters s'y référent uniquement par reference, sans duplication.

**Justification:** Centraliser les mappings ici empêche la dérive entre le Contrat API (API-CONTRACT-001) et les adapters. Si une operation est ajoutée ou retirée, seule cette specification doit etre mise a jour, puis les adapters s'y conformer.

**Source:** API-CONTRACT-001 (source unique des operations), PROTO-001 Section 4.1 (tables de mapping protocol).

---

### DECISION PA-010: Aucune operation non-listee n'est supportee

**Probleme:** Que se passe-t-il si un protocole essaie d'appeler une operation qui n'existe pas dans API-CONTRACT-001 ?

**Decision:** L'adapter doit retourner une erreur canonique E-404-001 (ENTITY_NOT_FOUND) traduite vers le protocol cible. Aucune operation non definie dans API-CONTRACT-001 ne peut etre invoquee a travers aucun adapter.

**Justification:** API-CONTRACT-001 est la source unique et authoritative pour toutes les operations. Ce qui n'y figure pas n'existe pas architecturalement. C'est la conséquence directe du Dependency Rule PAS-003 DR-005 (API Layer Isolation): l'API Layer n'expose que les Application Services definis, qui ne couvrent que les operations d'API-CONTRACT-001.

**Source:** API-CONTRACT-001 Summary (83 operations totales), PAS-003 DR-005, API-CONTRACT-003 NB-001 (NeverBreak-Boundary).

---

*Document termine.*
