# REST Adapter Rules Specification — Lumina v1

**Doc ID:** PROTO-002
**Version:** v1.0
**Statut:** SPÉCIFICATION PROTOCOLE ADAPTÉ DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "API-CONTRACT-002", "PROTO-001"]
**Transformation_rule :** "rest-adapter-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## Table of Contents

- [1. Principles](#1-principles)
- [2. Endpoint Mapping](#2-endpoint-mapping)
  - [2.1 Resource Aggregate — Financial Operations](#21-resource-aggregate--financial-operations)
  - [2.2 Resource Aggregate — Member Management](#22-resource-aggregate--member-management)
  - [2.3 Resource Aggregate — Group Lifecycle](#23-resource-aggregate--group-lifecycle)
  - [2.4 Resource Aggregate — Event Coordination](#24-resource-aggregate--event-coordination)
  - [2.5 Resource Aggregate — Celebrations](#25-resource-aggregate--celebrations)
  - [2.6 Dashboard Aggregate — Aggregated Views](#26-dashboard-aggregate--aggregated-views)
  - [2.7 Settings Aggregate — User Preferences](#27-settings-aggregate--user-preferences)
  - [2.8 Settings Aggregate — Organization Configuration](#28-settings-aggregate--organization-configuration)
  - [2.9 Network Aggregate — Peer Discovery](#29-network-aggregate--peer-discovery)
  - [2.10 Network Aggregate — Synchronization](#210-network-aggregate--synchronization)
  - [2.11 Authentication Aggregate — Identity](#211-authentication-aggregate--identity)
  - [2.12 Communication Aggregate — Messaging](#212-communication-aggregate--messaging)
  - [2.13 Communication Aggregate — Notifications](#213-communication-aggregate--notifications)
  - [2.14 Notification Aggregate — Push Channels](#214-notification-aggregate--push-channels)
  - [2.15 Finance Aggregate — Subscription Billing](#215-finance-aggregate--subscription-billing)
  - [2.16 Storage Aggregate — File Operations](#216-storage-aggregate--file-operations)
  - [2.17 Audit Aggregate — Compliance Logging](#217-audit-aggregate--compliance-logging)
- [3. Request/Response Envelopes](#3-requestresponse-envelopes)
- [4. Query Parameter Conventions](#4-query-parameter-conventions)
- [5. Header Conventions](#5-header-conventions)
- [6. Idempotency](#6-idempotency)
- [7. Versioning Strategy](#7-versioning-strategy)
- [8. Rate Limiting](#8-rate-limiting)
- [Appendix A: Error Code Quick Reference](#appendix-a-error-code-quick-reference)
- [Appendix B: Aggregate Endpoint Index](#appendix-b-aggregate-endpoint-index)

---

## 1. Principles

Les principes suivants régissent TOUT adapter REST pour Lumina :

### 1.1 Resource-Oriented Design

Chaque operation d'API canonique est mappée à une ressource endpoint HTTP. L'Operation ID canonique (ex : `UC-ResourceAggregate-001`) est transformé en une combinaison de verbe HTTP + chemin sémantiquement équivalent. Cette règle garantit que l'interface REST est entièrement traçable vers le registre canonique d'opérations.

### 1.2 Verbe HTTP Sémantique

Le mapping des verbes suit les conventions RFC 7231 étendues par les besoins métier de Lumina :

| Verbe | Sémantique canonique | Garantie d'idempotence |
|-------|---------------------|----------------------|
| GET | Lecture / requête sans effet de bord | Oui (naturellement) |
| POST | Création de ressource ou appel de procédure | Non (par défaut) |
| PUT | Mise à jour complète de ressource existante | Oui |
| PATCH | Mise à jour partielle de ressource existante | Non (naturellement) |
| DELETE | Suppression logique de ressource | Oui |
| HEAD | Méta-données d'une ressource sans corps | Oui |
| OPTIONS | Capacités du point de terminaison | Oui |

Toute opération qui crée un nouvel item dans le système utilise POST. Toute opération qui modifie l'état complet d'un resource identifié utilise PUT. Toute opération qui effectue un subsetting de modification utilise PATCH.

### 1.3 Structure de Chemin

Les chemins REST suivent la pattern `/api/{aggregate}/{resource}[/{id}][/{sub-resource}]`.

L'aggregate correspond à la nomenclature DOC-012 (ex : `resource`, `dashboard`, `settings`, `network`, `auth`, `communication`, `notification`, `finance`, `storage`, `audit`).

Le resource est le nom singulier du domaine entity (ex : `transaction`, `member`, `group`, `event`, `message`).

Les paramètres de chemin sont marqués entre crochets `{param}` et sont obligatoirement des UUID v4 pour les identifiants de ressource.

Exemples valides :
- `/api/resource/transactions` — collection de transactions
- `/api/resource/transactions/{id}` — transaction unique
- `/api/resource/transactions/{id}/payments` — sous-collection de paiements
- `/api/auth/tokens/refresh` — endpoint de procédure (non resource-oriented)
- `/api/communication/messages/{id}/read` — opération sur ressource unique

### 1.4 Collection vs Ressource Unique

- Les opérations de liste返回列表 utilisent le chemin pluriel de la collection (`/api/resource/transactions`)
- Les opérations sur entité unique utilisent le chemin singulier avec identifiant (`/api/resource/transactions/{id}`)
- Les sous-ressources suivent la même convention au niveau inférieur (`/api/resource/transactions/{id}/recurring-rules`)

### 1.5 Paramètres de Requête

Le filtrage, la pagination et le tri utilisent des paramètres de requête standardisés :

- `page` : numéro de page (indexé à 1, défaut : 1)
- `pageSize` : nombre d'items par page (défaut : 20, maximum : 100)
- `filter` : critères de filtrage composites (notation dot-extended)
- `sort` : champ(s) de tri (notation `field:asc|desc`, défaut : asc)
- `fields` : projection de champs (liste séparée par virgule)
- `q` : recherche textuelle libre sur champs indexés

Les paramètres multiples peuvent être combinés :
```
GET /api/resource/transactions?filter[amount.gt]=100&sort=-date&page=2&pageSize=25
```

### 1.6 Corps de Requête

Les corps POST/PUT/PATCH utilisent un objet JSON conforme à la structure Canonique Request Payload définie dans API-CONTRACT-002. Chaque propriété du payload correspond à un champ du domaine entity, typé selon le schéma canonique. Les champs en lecture seule sont ignorés côté serveur si présents dans la requête.

### 1.7 Corps de Réponse

Les réponses SUCCESS correspondent à la structure Canonique Response définie dans API-CONTRACT-002, enveloppée dans un envelope HTTP standard (voir Section 3). Le type MIME de réponse est toujours `application/json`.

### 1.8 En-Têtes HTTP

Les en-têtes standardisés assurent le contexte multi-tenant, la corrélation de trace et la localisation :

- `x-org-id` : identifiant de l'organisation contextuelle (toujours requis)
- `Authorization` : jetonBearer JWT pour l'authentification
- `Accept-Language` : préférence de langue de contenu (`fr` ou `en`)
- `x-request-id` : identifiant de corrélation de trace (facultatif mais recommandé)
- `Idempotency-Key` : clé d'idempotence pour les opérations répétibles (facultatif)

### 1.9 Négociation de Contenu

L'en-tête `Accept` contrôle le format de réponse. Lumina retourne toujours `application/json`. La négociation de contenu par version (`application/vnd.lumina.v1+json`) n'est pas activée dans cette version ; la version est contrôlée par le préfixe de chemin `/api/v1/...` si déployé ultérieurement.

### 1.10 Format de Réponse d'Erreur

Toutes les erreurs HTTP retournent un envelope JSON standardisé correspondant à la taxonomie API-CONTRACT-005. Le code de statut HTTP indique la catégorie d'erreur ; l'`error_code` dans le corps fournit le code d'erreur canonique spécifique. L'ensemble des codes d'erreur est documenté dans API-CONTRACT-005 et indexé en Annexe A.

### 1.11 Cohérence des Noms

Tous les noms de chemin, paramètres et champs sont en snake_case pour les clés JSON et kebab-case pour les paramètres de requête, conformément aux conventions REST modernes. Les noms d'ensembles de ressources utilisent le pluriel (`transactions`, pas `transaction`).

### 1.12 Disciplina della Documentazione di Tracabilité

Chaque endpoint dans cette spécification inclut une référence à son Operation ID canonique afin de garantir la traçabilité complète de l'endpoint REST vers la demande utilisateur correspondante dans API-CONTRACT-001. Aucun endpoint ne peut être ajouté ou modifié sans mettre à jour la table de tracabilité correspondante.

---

## 2. Endpoint Mapping

Pour toutes les 83 operations canoniques, le mapping REST suivant est défini. Les operations sont groupées par Aggregate conformement à DOC-012.

---

### 2.1 Resource Aggregate — Financial Operations (transactions)

**Aggregate :** `resource`  
**Domaine :** Transactions financières, règles de répartition automatique, flux de trésorerie par membre  
**Opérations couvertes :** UC-ResourceAggregate-001 à UC-ResourceAggregate-015 (15 opérations)

#### 2.1.1 Transaction CRUD

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| R-001 | CreateTransaction | UC-ResourceAggregate-001 | POST | /api/resource/transactions | CreateTransactionRequest { amount, type, category_id, member_ids[], description, date } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN, E-409-DUPLICATE |
| R-002 | GetTransactionById | UC-ResourceAggregate-002 | GET | /api/resource/transactions/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-003 | UpdateTransaction | UC-ResourceAggregate-003 | PUT | /api/resource/transactions/{id} | UpdateTransactionRequest { amount?, type?, category_id?, member_ids?, description?, date? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-409-CONFLICT |
| R-004 | PartialUpdateTransaction | UC-ResourceAggregate-004 | PATCH | /api/resource/transactions/{id} | PatchTransactionRequest { fields to update } | 200 | E-400-VALIDATION, E-404-NOT_FOUND |
| R-005 | DeleteTransaction | UC-ResourceAggregate-005 | DELETE | /api/resource/transactions/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-006 | ListTransactionsForOrg | UC-ResourceAggregate-006 | GET | /api/resource/transactions | filtres en query params | 200 | E-400-VALIDATION, E-401-UNAUTH |
| R-007 | ListTransactionsForGroup | UC-ResourceAggregate-007 | GET | /api/resource/groups/{group_id}/transactions | filter[member_id]=uuid | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-008 | ListTransactionsForMember | UC-ResourceAggregate-008 | GET | /api/resource/members/{member_id}/transactions | filter[date_range]={start,end} | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-009 | BulkCreateTransactions | UC-ResourceAggregate-009 | POST | /api/resource/transactions/bulk | BulkCreateTransactionRequest { items[] } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-422-PARTIAL_FAILURE |
| R-010 | BulkUpdateTransactions | UC-ResourceAggregate-010 | POST | /api/resource/transactions/bulk/update | BulkUpdateTransactionRequest { ids[], changes{} } | 200 | E-400-VALIDATION, E-404-NOT_FOUND |
| R-011 | BulkDeleteTransactions | UC-ResourceAggregate-011 | POST | /api/resource/transactions/bulk/delete | BulkDeleteRequest { ids[] } | 200 | E-400-VALIDATION, E-404-NOT_FOUND |
| R-012 | SearchTransactions | UC-ResourceAggregate-012 | GET | /api/resource/transactions/search | ?q=search_term&filter[type]=expense | 200 | E-400-VALIDATION, E-401-UNAUTH |
| R-013 | ExportTransactions | UC-ResourceAggregate-013 | POST | /api/resource/transactions/export | ExportRequest { format: csv|json|pdf, filter{} } | 202 | E-400-VALIDATION, E-401-UNAUTH |
| R-014 | GetTransactionCategories | UC-ResourceAggregate-014 | GET | /api/resource/categories | Aucun | 200 | E-401-UNAUTH |
| R-015 | GetTotalSpendingForPeriod | UC-ResourceAggregate-015 | GET | /api/resource/transactions/summary/spending | ?period=month&year=2026&month=7 | 200 | E-400-VALIDATION, E-401-UNAUTH |

#### 2.1.2 Répartition Automatique (Splitting Rules)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| R-016 | CreateSplitRule | UC-ResourceAggregate-016 | POST | /api/resource/split-rules | CreateSplitRuleRequest { name, rule_type, allocation[], conditions{} } | 201 | E-400-VALIDATION, E-401-UNAUTH |
| R-017 | GetSplitRuleById | UC-ResourceAggregate-017 | GET | /api/resource/split-rules/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-018 | UpdateSplitRule | UC-ResourceAggregate-018 | PUT | /api/resource/split-rules/{id} | UpdateSplitRuleRequest { name?, rule_type?, allocation[], conditions? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND |
| R-019 | DeleteSplitRule | UC-ResourceAggregate-019 | DELETE | /api/resource/split-rules/{id} | Aucun | 204 | E-404-NOT_FOUND |
| R-020 | ListActiveSplitRules | UC-ResourceAggregate-020 | GET | /api/resource/split-rules | filter[active]=true | 200 | E-401-UNAUTH |
| R-021 | ApplySplitRuleToTransaction | UC-ResourceAggregate-021 | POST | /api/resource/split-rules/{id}/apply | ApplySplitRuleRequest { transaction_id } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-422-APPLY_FAILED |
| R-022 | GetSplitRuleHistory | UC-ResourceAggregate-022 | GET | /api/resource/split-rules/{id}/history | ?since=timestamp&page=1 | 200 | E-404-NOT_FOUND, E-401-UNAUTH |

---

### 2.2 Resource Aggregate — Member Management

**Aggregate :** `resource`  
**Domaine :** Ajout, recherche, suppression de membres dans le groupe principal  
**Opérations couvertes :** UC-ResourceAggregate-023 à UC-ResourceAggregate-030 (8 opérations)

#### 2.2.1 Membre CRUD

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| R-023 | AddMember | UC-ResourceAggregate-023 | POST | /api/resource/members | AddMemberRequest { email, first_name, last_name, role: member|admin } | 201 | E-400-VALIDATION, E-409-DUPLICATE, E-401-UNAUTH |
| R-024 | GetMemberById | UC-ResourceAggregate-024 | GET | /api/resource/members/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-025 | UpdateMemberProfile | UC-ResourceAggregate-025 | PUT | /api/resource/members/{id} | UpdateMemberRequest { first_name?, last_name?, email?, role? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-409-CONFLICT |
| R-026 | DeleteMember | UC-ResourceAggregate-026 | DELETE | /api/resource/members/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-027 | ListAllMembers | UC-ResourceAggregate-027 | GET | /api/resource/members | filter[role]=member | 200 | E-401-UNAUTH |
| R-028 | SearchMembersByEmail | UC-ResourceAggregate-028 | GET | /api/resource/members/search | ?email=partial_or_full | 200 | E-400-VALIDATION, E-401-UNAUTH |
| R-029 | InviteMember | UC-ResourceAggregate-029 | POST | /api/resource/members/invite | InviteMemberRequest { emails[], message? } | 202 | E-400-VALIDATION, E-429-RATE_LIMIT |
| R-030 | AcceptInvite | UC-ResourceAggregate-030 | POST | /api/resource/members/accept-invite/{token} | AcceptInviteRequest { first_name, last_name } | 201 | E-400-VALIDATION, E-404-NOT_FOUND, E-410-EXPIRED |

---

### 2.3 Resource Aggregate — Group Lifecycle

**Aggregate :** `resource`  
**Domaine :** Création, lecture, mise à jour, suppression de groupes  
**Opérations couvertes :** UC-ResourceAggregate-031 à UC-ResourceAggregate-038 (8 opérations)

#### 2.3.1 Groupe CRUD

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| R-031 | CreateGroup | UC-ResourceAggregate-031 | POST | /api/resource/groups | CreateGroupRequest { name, description, privacy: public|private } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-409-DUPLICATE_NAME |
| R-032 | GetGroupById | UC-ResourceAggregate-032 | GET | /api/resource/groups/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-033 | GetGroupSettings | UC-ResourceAggregate-033 | GET | /api/resource/groups/{id}/settings | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-034 | UpdateGroup | UC-ResourceAggregate-034 | PUT | /api/resource/groups/{id} | UpdateGroupRequest { name?, description?, privacy? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-409-CONFLICT |
| R-035 | DeleteGroup | UC-ResourceAggregate-035 | DELETE | /api/resource/groups/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-036 | ListUserGroups | UC-ResourceAggregate-036 | GET | /api/resource/members/{member_id}/groups | filter[status]=active | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-037 | ListAllGroups | UC-ResourceAggregate-037 | GET | /api/resource/groups | filter[privacy]=public | 200 | E-401-UNAUTH |
| R-038 | SearchGroupsByName | UC-ResourceAggregate-038 | GET | /api/resource/groups/search | ?q=group_name_partial | 200 | E-400-VALIDATION, E-401-UNAUTH |

---

### 2.4 Resource Aggregate — Event Coordination

**Aggregate :** `resource`  
**Domaine :** Planification et gestion d'événements de groupe  
**Opérations couvertes :** UC-ResourceAggregate-039 à UC-ResourceAggregate-044 (6 opérations)

#### 2.4.1 Événement CRUD

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| R-039 | CreateEvent | UC-ResourceAggregate-039 | POST | /api/resource/events | CreateEventRequest { title, description, start_date, end_date, location?, group_id } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-409-CONFLICT |
| R-040 | GetEventById | UC-ResourceAggregate-040 | GET | /api/resource/events/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-041 | UpdateEvent | UC-ResourceAggregate-041 | PUT | /api/resource/events/{id} | UpdateEventRequest { title?, description?, start_date?, end_date?, location? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-409-CONFLICT |
| R-042 | DeleteEvent | UC-ResourceAggregate-042 | DELETE | /api/resource/events/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-043 | RSVPToEvent | UC-ResourceAggregate-043 | POST | /api/resource/events/{id}/rsvp | RSVPRequest { status: attending|maybe|declined } | 201 | E-400-VALIDATION, E-404-NOT_FOUND, E-409-ALREADY_RSVPed |
| R-044 | ListGroupEvents | UC-ResourceAggregate-044 | GET | /api/resource/groups/{group_id}/events | ?from=start_date&to=end_date | 200 | E-404-NOT_FOUND, E-401-UNAUTH |

---

### 2.5 Resource Aggregate — Celebrations

**Aggregate :** `resource`  
**Domaine :** Anniversaires, célébrations de dates clés, rappels automatiques  
**Opérations couvertes :** UC-ResourceAggregate-045 à UC-ResourceAggregate-048 (4 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| R-045 | CreateCelebration | UC-ResourceAggregate-045 | POST | /api/resource/celebrations | CreateCelebrationRequest { type: birthday|anniversary|custom, title, date, description? } | 201 | E-400-VALIDATION, E-401-UNAUTH |
| R-046 | GetCelebrationById | UC-ResourceAggregate-046 | GET | /api/resource/celebrations/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| R-047 | UpcomingCelebrations | UC-ResourceAggregate-047 | GET | /api/resource/celebrations/upcoming | ?days_ahead=30 | 200 | E-400-VALIDATION, E-401-UNAUTH |
| R-048 | DeleteCelebration | UC-ResourceAggregate-048 | DELETE | /api/resource/celebrations/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |

---

### 2.6 Dashboard Aggregate — Aggregated Views

**Aggregate :** `dashboard`  
**Domaine :** Vue agrégée des dépenses par membre, graphiques de répartition, données de synthèse  
**Opérations couvertes :** UC-DashboardAggregate-001 à UC-DashboardAggregate-010 (10 opérations)

#### 2.6.1 Points de vue Dashboard

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| D-001 | GetFinancialOverview | UC-DashboardAggregate-001 | GET | /api/dashboard/overview | ?period=month&year=2026&month=7 | 200 | E-400-VALIDATION, E-401-UNAUTH |
| D-002 | GetSpendingByMember | UC-DashboardAggregate-002 | GET | /api/dashboard/spending/by-member | ?group_id={id}&period=month | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| D-003 | GetCategoryBreakdown | UC-DashboardAggregate-003 | GET | /api/dashboard/spending/categories | ?group_id={id}&period=month | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| D-004 | GetMonthlyTrendChart | UC-DashboardAggregate-004 | GET | /api/dashboard/charts/monthly-trend | ?months=12&type=expense|income|balance | 200 | E-400-VALIDATION, E-401-UNAUTH |
| D-005 | GetDailySpendingChart | UC-DashboardAggregate-005 | GET | /api/dashboard/charts/daily-spending | ?period=month&year=2026&month=7 | 200 | E-400-VALIDATION, E-401-UNAUTH |
| D-006 | GetPieChartByCategory | UC-DashboardAggregate-006 | GET | /api/dashboard/charts/pie-category | ?group_id={id}&period=month | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| D-007 | GetPerCapitaSpending | UC-DashboardAggregate-007 | GET | /api/dashboard/spending/per-capita | ?group_id={id}&period=month | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| D-008 | GetMemberContributionRanking | UC-DashboardAggregate-008 | GET | /api/dashboard/ranking/contributions | ?group_id={id}&period=month | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| D-009 | GetBalanceSummary | UC-DashboardAggregate-009 | GET | /api/dashboard/balances | ?group_id={id} | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| D-010 | GetOverallActivityFeed | UC-DashboardAggregate-010 | GET | /api/dashboard/activity-feed | ?limit=50&since=timestamp | 200 | E-400-VALIDATION, E-401-UNAUTH |

---

### 2.7 Settings Aggregate — User Preferences

**Aggregate :** `settings`  
**Domaine :** Préférences personnelles de chaque membre, langue, devise, thème, notifications  
**Opérations couvertes :** UC-SettingsAggregate-001 à UC-SettingsAggregate-006 (6 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| S-001 | GetUserPreferences | UC-SettingsAggregate-001 | GET | /api/settings/preferences | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| S-002 | UpdateUserPreferences | UC-SettingsAggregate-002 | PUT | /api/settings/preferences | UpdatePreferencesRequest { language: fr|en, currency: EUR|USD, theme: light|dark, locale } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| S-003 | SetDefaultCurrency | UC-SettingsAggregate-003 | PUT | /api/settings/default-currency | CurrencyRequest { currency: EUR|USD } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| S-004 | SetLanguagePreference | UC-SettingsAggregate-004 | PUT | /api/settings/language | LanguageRequest { language: fr|en } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| S-005 | SetThemePreference | UC-SettingsAggregate-005 | PUT | /api/settings/theme | ThemeRequest { theme: light|dark } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| S-006 | ResetUserPreferences | UC-SettingsAggregate-006 | DELETE | /api/settings/preferences | Aucun | 204 | E-401-UNAUTH |

---

### 2.8 Settings Aggregate — Organization Configuration

**Aggregate :** `settings`  
**Domaine :** Configuration globale de l'organisation, règle de répartition par défaut, devise principale  
**Opérations couvertes :** UC-SettingsAggregate-007 à UC-SettingsAggregate-013 (7 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| S-007 | GetOrganizationSettings | UC-SettingsAggregate-007 | GET | /api/settings/organization | filter[org_id]={uuid} | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| S-008 | UpdateOrganizationSettings | UC-SettingsAggregate-008 | PUT | /api/settings/organization | OrganizationSettingsRequest { default_split_rule: equal|proportional|custom, primary_currency: EUR|USD, timezone } | 200 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN |
| S-009 | SetDefaultSplitRule | UC-SettingsAggregate-009 | PUT | /api/settings/organization/split-rule | SplitRuleConfigRequest { strategy: equal|proportional|custom } | 200 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN |
| S-010 | SetPrimaryCurrency | UC-SettingsAggregate-010 | PUT | /api/settings/organization/currency | CurrencyRequest { currency: EUR|USD } | 200 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN |
| S-011 | SetOrganizationTimezone | UC-SettingsAggregate-011 | PUT | /api/settings/organization/timezone | TimezoneRequest { timezone: IANA_identifier } | 200 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN |
| S-012 | GetAllowedCurrencies | UC-SettingsAggregate-012 | GET | /api/settings/currencies | Aucun | 200 | E-401-UNAUTH |
| S-013 | GetAllowedTimezones | UC-SettingsAggregate-013 | GET | /api/settings/timezones | Aucun | 200 | E-401-UNAUTH |

---

### 2.9 Network Aggregate — Peer Discovery

**Aggregate :** `network`  
**Domaine :** Découverte de pairs, partage de réseau via invitation, gestion des connexions pair-à-pair  
**Opérations couvertes :** UC-NetworkAggregate-001 à UC-NetworkAggregate-005 (5 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| N-001 | GetMyPeerConnections | UC-NetworkAggregate-001 | GET | /api/network/peers | filter[status]=connected | 200 | E-401-UNAUTH |
| N-002 | DiscoverPeersByPhone | UC-NetworkAggregate-002 | GET | /api/network/peers/discover | ?phone=number | 200 | E-400-VALIDATION, E-401-UNAUTH, E-429-RATE_LIMIT |
| N-003 | ConnectToPeer | UC-NetworkAggregate-003 | POST | /api/network/peers/connect | PeerConnectRequest { phone|email, message? } | 201 | E-400-VALIDATION, E-409-DUPLICATE_CONNECTION |
| N-004 | DisconnectFromPeer | UC-NetworkAggregate-004 | DELETE | /api/network/peers/{peer_id}/disconnect | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| N-005 | GetPeerNetworkGraph | UC-NetworkAggregate-005 | GET | /api/network/graph | Aucun | 200 | E-401-UNAUTH |

---

### 2.10 Network Aggregate — Synchronization

**Aggregate :** `network`  
**Domaine :** Synchronisation des données locales avec la grappe principale, détection de conflits, résolution manuelle  
**Opérations couvertes :** UC-NetworkAggregate-006 à UC-NetworkAggregate-013 (8 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| N-006 | SyncLocalChanges | UC-NetworkAggregate-006 | POST | /api/network/sync | SyncRequest { local_state_version, changes[], timestamp } | 200 | E-400-VALIDATION, E-401-UNAUTH, E-409-CONFLICT |
| N-007 | PollServerUpdates | UC-NetworkAggregate-007 | GET | /api/network/sync/updates | ?since=timestamp | 200 | E-400-VALIDATION, E-401-UNAUTH |
| N-008 | ResolveConflict | UC-NetworkAggregate-008 | POST | /api/network/conflicts/{conflict_id}/resolve | ConflictResolutionRequest { strategy: server_wins|local_wins|manual_merge } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-401-UNAUTH |
| N-009 | ListConflicts | UC-NetworkAggregate-009 | GET | /api/network/conflicts | filter[status]=pending | 200 | E-401-UNAUTH |
| N-010 | GetSyncStatus | UC-NetworkAggregate-010 | GET | /api/network/sync/status | Aucun | 200 | E-401-UNAUTH |
| N-011 | ForceFullSync | UC-NetworkAggregate-011 | POST | /api/network/sync/full | Aucun | 202 | E-401-UNAUTH, E-429-RATE_LIMIT |
| N-012 | CancelPendingSync | UC-NetworkAggregate-012 | DELETE | /api/network/sync/{sync_id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| N-013 | GetSyncLog | UC-NetworkAggregate-013 | GET | /api/network/sync/logs | ?limit=100&level=info|warn|error | 200 | E-401-UNAUTH |

---

### 2.11 Authentication Aggregate — Identity

**Aggregate :** `auth`  
**Domaine :** Inscription, connexion, gestion de session, authentification multi-facteurs, gestion des mots de passe  
**Opérations couvertes :** UC-AuthAggregate-001 à UC-AuthAggregate-015 (15 opérations)

#### 2.11.1 Inscription et Connexion

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| A-001 | RegisterAccount | UC-AuthAggregate-001 | POST | /api/auth/register | RegisterRequest { email, password, first_name, last_name } | 201 | E-400-VALIDATION, E-409-DUPLICATE_EMAIL |
| A-002 | Login | UC-AuthAggregate-002 | POST | /api/auth/login | LoginRequest { email, password } | 200 | E-400-VALIDATION, E-401-CREDENTIALS_INVALID |
| A-003 | RefreshAccessToken | UC-AuthAggregate-003 | POST | /api/auth/tokens/refresh | RefreshRequest { refresh_token } | 200 | E-400-VALIDATION, E-401-INVALID_REFRESH_TOKEN |
| A-004 | Logout | UC-AuthAggregate-004 | POST | /api/auth/logout | Aucun | 204 | E-401-UNAUTH |
| A-005 | RequestPasswordReset | UC-AuthAggregate-005 | POST | /api/auth/password/reset | ResetPasswordRequest { email } | 202 | E-400-VALIDATION, E-404-NOT_FOUND |
| A-006 | ConfirmPasswordReset | UC-AuthAggregate-006 | POST | /api/auth/password/reset/confirm | ConfirmResetRequest { token, new_password } | 200 | E-400-VALIDATION, E-410-TOKEN_EXPIRED |
| A-007 | ChangePassword | UC-AuthAggregate-007 | POST | /api/auth/password/change | ChangePasswordRequest { current_password, new_password } | 200 | E-400-VALIDATION, E-401-WRONG_CURRENT_PASSWORD |

#### 2.11.2 Authentification Multi-Facteurs

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| A-008 | EnableMFA | UC-AuthAggregate-008 | POST | /api/auth/mfa/enable | Aucun | 200 | E-401-UNAUTH |
| A-009 | DisableMFA | UC-AuthAggregate-009 | POST | /api/auth/mfa/disable | MFAChallengeRequest { code } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| A-010 | VerifyMFACode | UC-AuthAggregate-010 | POST | /api/auth/mfa/verify | MFAChallengeRequest { code } | 200 | E-400-VALIDATION, E-401-INVALID_CODE |

#### 2.11.3 Gestion de Session

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| A-011 | GetCurrentSession | UC-AuthAggregate-011 | GET | /api/auth/session | Aucun | 200 | E-401-UNAUTH |
| A-012 | RevokeSession | UC-AuthAggregate-012 | DELETE | /api/auth/sessions/{session_id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| A-013 | ListActiveSessions | UC-AuthAggregate-013 | GET | /api/auth/sessions | filter[status]=active | 200 | E-401-UNAUTH |
| A-014 | RevokeAllSessions | UC-AuthAggregate-014 | DELETE | /api/auth/sessions | Aucun | 204 | E-401-UNAUTH |
| A-015 | GetSessionSecurityInfo | UC-AuthAggregate-015 | GET | /api/auth/session/security | Aucun | 200 | E-401-UNAUTH |

---

### 2.12 Communication Aggregate — Messaging

**Aggregate :** `communication`  
**Domaine :** Messagerie privée et de groupe, envoi de messages texte, pièces jointes, messages lus/non lus  
**Opérations couvertes :** UC-CommunicationAggregate-001 à UC-CommunicationAggregate-010 (10 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| C-001 | SendMessage | UC-CommunicationAggregate-001 | POST | /api/communication/messages | MessageRequest { conversation_id, content: text|image, reply_to?, attachments[] } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-404-NOT_FOUND |
| C-002 | GetMessageById | UC-CommunicationAggregate-002 | GET | /api/communication/messages/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| C-003 | UpdateMessage | UC-CommunicationAggregate-003 | PUT | /api/communication/messages/{id} | UpdateMessageRequest { content } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-403-FORBIDDEN |
| C-004 | DeleteMessage | UC-CommunicationAggregate-004 | DELETE | /api/communication/messages/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| C-005 | ListMessagesInConversation | UC-CommunicationAggregate-005 | GET | /api/communication/conversations/{conversation_id}/messages | ?before=timestamp&limit=50 | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| C-006 | MarkMessageAsRead | UC-CommunicationAggregate-006 | POST | /api/communication/messages/{id}/read | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| C-007 | ListUnreadMessages | UC-CommunicationAggregate-007 | GET | /api/communication/messages/unread | ?after=timestamp | 200 | E-401-UNAUTH |
| C-008 | ListConversations | UC-CommunicationAggregate-008 | GET | /api/communication/conversations | filter[type]=direct|group | 200 | E-401-UNAUTH |
| C-009 | StartNewConversation | UC-CommunicationAggregate-009 | POST | /api/communication/conversations | ConversationRequest { participant_ids[], type: direct|group } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-409-DUPLICATE_CONVERSATION |
| C-010 | UploadMessageAttachment | UC-CommunicationAggregate-010 | POST | /api/communication/messages/attachments | Multipart form-data with file | 201 | E-400-VALIDATION, E-401-UNAUTH, E-413-PAYLOAD_TOO_LARGE |

---

### 2.13 Communication Aggregate — Notifications (In-App)

**Aggregate :** `communication`  
**Domaine :** Système intégré de notifications, marques de lecture, préférences de notification  
**Opérations couvertes :** UC-CommunicationAggregate-011 à UC-CommunicationAggregate-016 (6 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| C-011 | GetNotifications | UC-CommunicationAggregate-011 | GET | /api/communication/notifications | ?filter[status]=unread&limit=50 | 200 | E-401-UNAUTH |
| C-012 | MarkNotificationRead | UC-CommunicationAggregate-012 | POST | /api/communication/notifications/{id}/read | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| C-013 | MarkAllNotificationsRead | UC-CommunicationAggregate-013 | POST | /api/communication/notifications/read-all | Aucun | 200 | E-401-UNAUTH |
| C-014 | DeleteNotification | UC-CommunicationAggregate-014 | DELETE | /api/communication/notifications/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| C-015 | GetNotificationCount | UC-CommunicationAggregate-015 | GET | /api/communication/notifications/unread-count | filter[status]=unread | 200 | E-401-UNAUTH |
| C-016 | GetNotificationPreferences | UC-CommunicationAggregate-016 | GET | /api/communication/notification-settings | Aucun | 200 | E-401-UNAUTH |

---

### 2.14 Notification Aggregate — Push Channels

**Aggregate :** `notification`  
**Domaine :** Web Push API, notifications push mobiles, configurations push, abonnements  
**Opérations couvertes :** UC-NotificationAggregate-001 à UC-NotificationAggregate-007 (7 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| NP-001 | RegisterPushSubscription | UC-NotificationAggregate-001 | POST | /api/notification/push/subscriptions | PushSubscriptionRequest { endpoint, keys{} } | 201 | E-400-VALIDATION, E-401-UNAUTH |
| NP-002 | UpdatePushSubscription | UC-NotificationAggregate-002 | PUT | /api/notification/push/subscriptions/{id} | PushSubscriptionRequest { endpoint?, keys? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-401-UNAUTH |
| NP-003 | UnregisterPushSubscription | UC-NotificationAggregate-003 | DELETE | /api/notification/push/subscriptions/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| NP-004 | ListPushSubscriptions | UC-NotificationAggregate-004 | GET | /api/notification/push/subscriptions | Aucun | 200 | E-401-UNAUTH |
| NP-005 | SendTestPush | UC-NotificationAggregate-005 | POST | /api/notification/push/test | TestPushRequest { subscription_id? } | 202 | E-400-VALIDATION, E-401-UNAUTH, E-429-RATE_LIMIT |
| NP-006 | GetPushConfiguration | UC-NotificationAggregate-006 | GET | /api/notification/push/config | filter[device_id]={id} | 200 | E-401-UNAUTH |
| NP-007 | UpdatePushConfiguration | UC-NotificationAggregate-007 | PUT | /api/notification/push/config/{id} | PushConfigRequest { enabled, sound?, badge? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-401-UNAUTH |

---

### 2.15 Finance Aggregate — Subscription Billing

**Aggregate :** `finance`  
**Domaine :** Abonnement Freemium/Pro, paiements, factures, suivi des coûts, seuils d'alerte  
**Opérations couvertes :** UC-FinanceAggregate-001 à UC-FinanceAggregate-012 (12 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| F-001 | GetSubscriptionPlan | UC-FinanceAggregate-001 | GET | /api/finance/plan | filter[user_id]={uuid} | 200 | E-401-UNAUTH |
| F-002 | GetUsageStats | UC-FinanceAggregate-002 | GET | /api/finance/usage | ?period=month&year=2026&month=7 | 200 | E-400-VALIDATION, E-401-UNAUTH |
| F-003 | GetCostLimitAlerts | UC-FinanceAggregate-003 | GET | /api/finance/alerts/cost-limit | Aucun | 200 | E-401-UNAUTH |
| F-004 | SetCostLimitThreshold | UC-FinanceAggregate-004 | PUT | /api/finance/alerts/cost-limit/threshold | CostLimitRequest { monthly_limit_cents, notify_at_pct } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| F-005 | UpgradeToPro | UC-FinanceAggregate-005 | POST | /api/finance/plan/upgrade | PlanUpgradeRequest { plan: pro, payment_method_id? } | 202 | E-400-VALIDATION, E-401-UNAUTH, E-402-PAYMENT_REQUIRED |
| F-006 | DowngradeFromPro | UC-FinanceAggregate-006 | POST | /api/finance/plan/downgrade | PlanDowngradeRequest { reason? } | 200 | E-400-VALIDATION, E-401-UNAUTH |
| F-007 | ProcessPayment | UC-FinanceAggregate-007 | POST | /api/finance/payments | PaymentRequest { amount_cents, payment_method_id, description? } | 200 | E-400-VALIDATION, E-401-UNAUTH, E-402-PAYMENT_FAILED |
| F-008 | ListInvoices | UC-FinanceAggregate-008 | GET | /api/finance/invoices | ?filter[status]=paid|unpaid|overdue | 200 | E-401-UNAUTH |
| F-009 | GetInvoiceById | UC-FinanceAggregate-009 | GET | /api/finance/invoices/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| F-010 | DownloadInvoicePDF | UC-FinanceAggregate-010 | GET | /api/finance/invoices/{id}/download | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH, E-415-UNSUPPORTED_FORMAT |
| F-011 | RefundPayment | UC-FinanceAggregate-011 | POST | /api/finance/payments/{id}/refund | RefundRequest { amount_cents?, reason? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-402-REFUND_NOT_ALLOWED |
| F-012 | GetBillingHistory | UC-FinanceAggregate-012 | GET | /api/finance/billing/history | ?period=year&year=2026 | 200 | E-400-VALIDATION, E-401-UNAUTH |

---

### 2.16 Storage Aggregate — File Operations

**Aggregate :** `storage`  
**Domaine :** Stockage de fichiers locaux, upload de documents, images, pièces jointes  
**Opérations couvertes :** UC-StorageAggregate-001 à UC-StorageAggregate-008 (8 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| ST-001 | ListFiles | UC-StorageAggregate-001 | GET | /api/storage/files | filter[type]=document|image|attachment | 200 | E-401-UNAUTH |
| ST-002 | UploadFile | UC-StorageAggregate-002 | POST | /api/storage/files | Multipart form-data { file, name?, type?, folder? } | 201 | E-400-VALIDATION, E-401-UNAUTH, E-413-PAYLOAD_TOO_LARGE |
| ST-003 | GetFileById | UC-StorageAggregate-003 | GET | /api/storage/files/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| ST-004 | DownloadFile | UC-StorageAggregate-004 | GET | /api/storage/files/{id}/download | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH, E-403-FORBIDDEN |
| ST-005 | UpdateFileMetadata | UC-StorageAggregate-005 | PATCH | /api/storage/files/{id} | FileMetadataPatch { name?, type?, folder? } | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-401-UNAUTH |
| ST-006 | DeleteFile | UC-StorageAggregate-006 | DELETE | /api/storage/files/{id} | Aucun | 204 | E-404-NOT_FOUND, E-401-UNAUTH |
| ST-007 | GetStorageQuota | UC-StorageAggregate-007 | GET | /api/storage/quota | filter[user_id]={uuid} | 200 | E-401-UNAUTH |
| ST-008 | ListSharedFiles | UC-StorageAggregate-008 | GET | /api/storage/shared | filter[shared_with_member_id]={uuid} | 200 | E-401-UNAUTH |

---

### 2.17 Audit Aggregate — Compliance Logging

**Aggregate :** `audit`  
**Domaine :** Journalisation de toutes les actions, vérification de conformité, export de logs d'audit  
**Opérations couvertes :** UC-AuditAggregate-001 à UC-AuditAggregate-006 (6 opérations)

| # | Operation | Command/Query | REST Method | REST Path | Request Body | Success Code | Error Codes |
|---|-----------|--------------|-------------|-----------|-------------|-------------|-------------|
| AU-001 | ListAuditLogs | UC-AuditAggregate-001 | GET | /api/audit/logs | ?from=timestamp&to=timestamp&filter[action_type]=create|update|delete | 200 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN |
| AU-002 | GetAuditLogById | UC-AuditAggregate-002 | GET | /api/audit/logs/{id} | Aucun | 200 | E-404-NOT_FOUND, E-401-UNAUTH |
| AU-003 | GetActionByUser | UC-AuditAggregate-003 | GET | /api/audit/logs/user/{user_id} | ?from=timestamp&to=timestamp | 200 | E-400-VALIDATION, E-404-NOT_FOUND, E-403-FORBIDDEN |
| AU-004 | ExportAuditLog | UC-AuditAggregate-004 | POST | /api/audit/logs/export | ExportRequest { format: json|csv, from, to, actions[] } | 202 | E-400-VALIDATION, E-401-UNAUTH, E-403-FORBIDDEN |
| AU-005 | GetComplianceSummary | UC-AuditAggregate-005 | GET | /api/audit/compliance/summary | ?period=month | 200 | E-400-VALIDATION, E-401-UNAUTH |
| AU-006 | RetentionPolicyStatus | UC-AuditAggregate-006 | GET | /api/audit/retention | filter[policy_id]={uuid} | 200 | E-401-UNAUTH, E-403-FORBIDDEN |

---

## 3. Request/Response Envelopes

Cette section définit les enveloppes REST spécifiques pour les réponses HTTP.

### 3.1 Enveloppe de Réponse Succès

Toutes les réponses de succès HTTP retournent l'enveloppe JSON suivante :

```json
{
  "data": {
    "entity_type": "<canonical_entity_name>",
    "entity_id": "<uuid>",
    "attributes": {
      "<field_name>": "<field_value>"
    },
    "relationships": {
      "<related_entity_type>": "<uuid>"
    }
  },
  "version": 1,
  "sync_status": "<pending|synced>",
  "meta": {
    "request_id": "<uuid>",
    "server_timestamp": "<ISO8601>",
    "etag": "<optional_version_hash>"
  }
}
```

**Spécifications de l'enveloppe de succès :**

| Champ | Type | Obligation | Description |
|-------|------|------------|-------------|
| `data.entity_type` | string | Requis | Nom de l'entité canonique (ex : `transaction`, `member`, `group`) |
| `data.entity_id` | string | Requis | UUID v4 de la ressource |
| `data.attributes` | object | Requis | Ensemble de paires clé-valeur correspondant aux champs de l'entité |
| `data.relationships` | object | Facultatif | Mappage des références d'entités liées |
| `version` | integer | Requis | Numéro de version de l'enveloppe (actuellement `1`) |
| `sync_status` | enum | Requis | État de synchronisation depuis l'appareil : `pending` ou `synced` |
| `meta.request_id` | string | Requis | UUID de corrélation identique à `x-request-id` de la requête |
| `meta.server_timestamp` | string | Requis | Horodatage du serveur en format ISO 8601 |
| `meta.etag` | string | Facultatif | Hash de version pour le verrouillage optimiste |

**Exemple de réponse de succès — création de transaction :**

```json
{
  "data": {
    "entity_type": "transaction",
    "entity_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "attributes": {
      "amount": 12500,
      "currency": "EUR",
      "type": "expense",
      "category_id": "cat-food-001",
      "description": "Repas groupe",
      "created_by": "member-abc-123",
      "split_among": ["member-1", "member-2", "member-3"]
    },
    "relationships": {
      "group_id": "group-def-456",
      "category_id": "cat-food-001"
    }
  },
  "version": 1,
  "sync_status": "pending",
  "meta": {
    "request_id": "req-xyz-789",
    "server_timestamp": "2026-07-25T14:30:00Z",
    "etag": "v1-a3f8c2d1"
  }
}
```

**Code de statut HTTP de retour :**

| Opération | Code de statut | Raison |
|-----------|---------------|--------|
| Création réussie | `201 Created` | Ressource créée avec succès |
| Lecture réussie | `200 OK` | Données retournées |
| Mise à jour réussie | `200 OK` | Ressource mise à jour |
| Suppression réussie | `204 No Content` | Pas de corps de réponse requis |
| Exécution asynchrone | `202 Accepted` | Opération traitée en arrière-plan |

### 3.2 Enveloppe de Réponse d'Erreur

Toutes les réponses d'erreur HTTP retournent l'enveloppe JSON suivante :

```json
{
  "error_code": "<E-XXX-YYY>",
  "message": "<human-readable_description_in_Accept-Language>",
  "details": {
    "<specific_context_field>": "<context_value>"
  },
  "request_id": "<uuid>",
  "timestamp": "<ISO8601>",
  "help_url": "<optional_uri_to_docs>"
}
```

**Spécifications de l'enveloppe d'erreur :**

| Champ | Type | Obligation | Description |
|-------|------|------------|-------------|
| `error_code` | string | Requis | Code d'erreur canonique conforme à API-CONTRACT-005 |
| `message` | string | Requis | Description lisible en fonction de `Accept-Language` |
| `details` | object | Facultatif | Contexte additionnel — vide `{}` par défaut |
| `request_id` | string | Requis | UUID de corrélation pour le support |
| `timestamp` | string | Requis | Horodatage de l'erreur en format ISO 8601 |
| `help_url` | string | Facultatif | URI vers la documentation pertinente |

**Exemple de réponse d'erreur — validation invalidée :**

```json
{
  "error_code": "E-400-VALIDATION",
  "message": "La requête contient des champs invalides.",
  "details": {
    "invalid_fields": [
      {
        "field": "amount",
        "reason": "Must be a positive integer representing cents."
      }
    ],
    "valid_values": {
      "amount": "positive integer (minimum 1)"
    }
  },
  "request_id": "req-xyz-789",
  "timestamp": "2026-07-25T14:30:00Z",
  "help_url": "https://lumina-docs.internal/error/E-400-VALIDATION"
}
```

**Correspondance code de statut HTTP — code d'erreur canonique :**

| Code Statut HTTP | Code d'Erreur Canonique | Catégorie API-CONTRACT-005 | Description |
|------------------|----------------------|--------------------------|-------------|
| `400 Bad Request` | `E-400-VALIDATION` | Erreur Client | Payload JSON invalide ou contraintes non respectées |
| `400 Bad Request` | `E-400-MISSING_FIELD` | Erreur Client | Champ requis manquant |
| `401 Unauthorized` | `E-401-UNAUTH` | Erreur Authentification | Jeton manquant ou expiré |
| `401 Unauthorized` | `E-401-CREDENTIALS_INVALID` | Erreur Authentification | Identifiants incorrects |
| `401 Unauthorized` | `E-401-INVALID_REFRESH_TOKEN` | Erreur Authentification | Jeton de rafraîchissement invalide |
| `403 Forbidden` | `E-403-FORBIDDEN` | Erreur Autorisation | Permission insuffisante pour l'action |
| `404 Not Found` | `E-404-NOT_FOUND` | Erreur Client | Ressource inexistante |
| `409 Conflict` | `E-409-CONFLICT` | Erreur Conflit | Modification en conflit avec état actuel |
| `409 Conflict` | `E-409-DUPLICATE_EMAIL` | Erreur Conflit | Email déjà enregistré |
| `409 Conflict` | `E-409-DUPLICATE_CONNECTION` | Erreur Conflit | Connexion paire existante |
| `409 Conflict` | `E-409-ALREADY_RSVPed` | Erreur Conflit | RSVP déjà soumis |
| `410 Gone` | `E-410-TOKEN_EXPIRED` | Erreur Client | Jeton ou lien expiré |
| `413 Payload Too Large` | `E-413-PAYLOAD_TOO_LARGE` | Erreur Client | Fichier dépassant la limite |
| `415 Unsupported Media Type` | `E-415-UNSUPPORTED_FORMAT` | Erreur Client | Format MIME non supporté |
| `402 Payment Required` | `E-402-PAYMENT_REQUIRED` | Erreur Finance | Abonnement requis pour l'action |
| `402 Payment Required` | `E-402-PAYMENT_FAILED` | Erreur Finance | Échec du traitement de paiement |
| `402 Payment Required` | `E-402-REFUND_NOT_ALLOWED` | Erreur Finance | Remboursement non autorisé |
| `422 Unprocessable Entity` | `E-422-PARTIAL_FAILURE` | Erreur Traitement | Une partie des opérations batch ont échoué |
| `422 Unprocessable Entity` | `E-422-APPLY_FAILED` | Erreur Traitement | Règle de répartition impossible à appliquer |
| `429 Too Many Requests` | `E-429-RATE_LIMIT` | Erreur Trafic | Limite de requête dépassée |

**Codes de statut HTTP pour les réponses courantes de collection :**

| Code Statut HTTP | Description |
|------------------|-------------|
| `200 OK` | Liste retournée avec pagination |
| `201 Created` | Nouvelle ressource créée |
| `202 Accepted` | Requête asynchrone acceptée (export, paiement) |
| `204 No Content` | Suppression réussie (pas de corps de réponse) |
| `400 Bad Request` | Requête malformée ou invalide |
| `401 Unauthorized` | Non authentifié |
| `403 Forbidden` | Authentifié mais autorisé |
| `404 Not Found` | Ressource introuvable |
| `409 Conflict` | Conflit de données |
| `429 Too Many Requests` | Limite de taux dépassée |

### 3.3 Enveloppe de Réponse de Pagination

Pour toutes les opérations qui retournent des collections (listes), l'enveloppe de pagination suivante est utilisée :

```json
{
  "items": [
    {
      "entity_type": "<canonical_entity_name>",
      "entity_id": "<uuid>",
      "attributes": { ... },
      "relationships": { ... }
    }
  ],
  "total_count": 142,
  "page_number": 3,
  "page_size": 20,
  "has_next": true,
  "has_prev": true,
  "meta": {
    "request_id": "<uuid>",
    "server_timestamp": "<ISO8601>",
    "filter_applied": {
      "date_range": { "from": "2026-01-01", "to": "2026-07-25" }
    },
    "sorting_applied": [
      { "field": "date", "order": "desc" }
    ]
  }
}
```

**Spécifications de l'enveloppe de pagination :**

| Champ | Type | Obligation | Description |
|-------|------|------------|-------------|
| `items` | array | Requis | Tableau de ressources sérialisées selon l'enveloppe de succès Section 3.1 |
| `total_count` | integer | Requis | Nombre total d'items disponibles dans la collection filtrée |
| `page_number` | integer | Requis | Page actuelle (1-indexé) |
| `page_size` | integer | Requis | Nombre d'items par page demandé |
| `has_next` | boolean | Requis | True s'il existe une page suivante |
| `has_prev` | boolean | Requis | True s'il existe une page précédente |
| `meta.filter_applied` | object | Facultatif | Filtres appliqués à la requête |
| `meta.sorting_applied` | array | Facultatif | Ordre de tri appliqué |

**En-têtes HTTP de Pagination :**

Les en-têtes de pagination standard sont inclus pour faciliter la navigation dans les résultats paginés :

| En-tête | Type | Description |
|---------|------|-------------|
| `X-Total-Count` | integer | Valeur identique à `total_count` |
| `X-Page-Number` | integer | Valeur identique à `page_number` |
| `X-Page-Size` | integer | Valeur identique à `page_size` |
| `Link` | string | URL de pagination (pre, next, last) format RFC 5988 |
| `Content-Range` | string | `items <start>-<end>/<total>` quand applicable |

**Exemple d'en-tête Link :**

```
Link: </api/resource/transactions?page=1&pageSize=20>; rel="first",
      </api/resource/transactions?page=2&pageSize=20>; rel="prev",
      </api/resource/transactions?page=4&pageSize=20>; rel="next",
      </api/resource/transactions?page=8&pageSize=20>; rel="last"
```

---

## 4. Query Parameter Conventions

### 4.1 Paramètres Standardisés de Paginations

Tous les points de terminaison de collection doivent supporter ces paramètres de requête standardisés :

| Paramètre | Type | Défaut | Maximum | Description |
|-----------|------|--------|---------|-------------|
| `page` | integer | `1` | — | Numéro de page (indexé à 1) |
| `pageSize` | integer | `20` | `100` | Nombre d'items par page |

### 4.2 Paramètres de Filtre

Les filtres utilisent la notation dot-extended dans les paramètres de requête :

```
GET /api/resource/transactions?filter[amount.gte]=5000&filter[group_id]={uuid}
```

Convention de notation des opérateurs de filtre :

| Opérateur | Suffixe | Signification |
|-----------|---------|---------------|
| (aucun) | `[field]` | Égalité exacte |
| `.eq` | `[field.eq]` | Égalité explicite |
| `.ne` | `[field.ne]` | Différent de |
| `.gt` | `[field.gt]` | Strictement supérieur |
| `.gte` | `[field.gte]` | Supérieur ou égal |
| `.lt` | `[field.lt]` | Strictement inférieur |
| `.lte` | `[field.lte]` | Inférieur ou égal |
| `.in` | `[field.in]` | Dans une liste de valeurs |
| `.nin` | `[field.nin]` | Hors d'une liste de valeurs |
| `.like` | `[field.like]` | Correspondance de pattern (%) |
| `.between` | `[field.between]` | Intervalle (deux valeurs) |
| `.exists` | `[field.exists]` | Champ présent ou absent (`true`/`false`) |
| `.null` | `[field.null]` | Champ nul (`true`/`false`) |
| `.not_null` | `[field.not_null]` | Champ non nul (`true`/`false`) |

**Exemples de filtres composés :**

```
# Transactions supérieures à 500 cents ce mois-ci
filter[amount.gt]=500&filter[date.gte]=2026-07-01&filter[date.lte]=2026-07-31

# Membres avec rôle admin
filter[role.eq]=admin

# Groupes avec nom contenant "voyage"
filter[name.like]=%voyage%

# Transactions non supprimées logiquement
filter[deleted_at.exists]=false
```

### 4.3 Paramètres de Tri

Les paramètres de tri permettent de spécifier plusieurs champs :

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `sort` | string | `-created_at` | Champs de tri (préfixe `-` = desc) |
| `order` | enum | `desc` | Ordre global (si `sort` ne spécifie pas de direction) |

Format de `sort` :

```
# Tri simple par date descendante
sort=created_at

# Tri composé : date desc, puis montant asc
sort=created_at:-1,amount:1
```

Champs triables autorisés (varient par aggregate) :

| Aggregate | Champs triables autorisés |
|-----------|-------------------------|
| Resource | `created_at`, `updated_at`, `amount`, `name`, `description` |
| Dashboard | N/A (données agrégées) |
| Settings | N/A |
| Network | `created_at`, `status` |
| Auth | `last_login_at`, `created_at` |
| Communication | `created_at`, `is_read` |
| Notification | `created_at`, `is_read`, `priority` |
| Finance | `invoice_date`, `amount`, `status` |
| Storage | `uploaded_at`, `name`, `size` |
| Audit | `timestamp`, `action_type`, `severity` |

### 4.4 Paramètres de Projection de Champs

Le paramètre `fields` permet de limiter les champs retournés pour optimiser le transfert :

```
# Ne retourner que le nom, le solde et l'email
GET /api/resource/members?fields=name,balance,email

# Inclure uniquement les attributs essentiels
GET /api/resource/transactions?fields=amount,type,date
```

Si `fields` n'est pas spécifié, tous les champs canoniques de l'entité sont retournés.

### 4.5 Recherche Textuelle Libre

Le paramètre `q` active la recherche textuelle sur les champs indexés :

```
# Recherche sur le nom du groupe
GET /api/resource/groups/search?q=voyage

# Recherche sur la description de transaction
GET /api/resource/transactions/search?q=repas&filter[type]=expense
```

Les champs indexés pour la recherche varient par aggregate et sont documentés dans API-CONTRACT-001.

### 4.6 Dates et Intervalles

Les paramètres de date utilisent le format ISO 8601 (`YYYY-MM-DD` ou `YYYY-MM-DDTHH:mm:ssZ`) :

```
# Intervalle de dates pour transactions
filter[start_date]=2026-01-01&filter[end_date]=2026-07-25

# Horizon temporel pour événements à venir
GET /api/resource/events?from=2026-07-25&to=2026-12-31

# Période de résumé financier
GET /api/dashboard/overview?period=month&year=2026&month=7

# Filtre de dernier X jours
GET /api/resource/celebrations/upcoming?days_ahead=30

# Historique de synchronisation depuis timestamp
GET /api/network/sync/updates?since=2026-07-25T14:00:00Z
```

---

## 5. Header Conventions

### 5.1 En-têtes Requis

| En-tête | Type | Description | Obligatoire | Exemple |
|---------|------|-------------|-------------|---------|
| `x-org-id` | string (UUID) | Identifiant de l'organisation contextuelle | **Oui** | `x-org-id: a1b2c3d4-e5f6-7890-abcd-ef1234567890` |
| `Authorization` | string | Jeton Bearer JWT d'authentification | **Oui** | `Authorization: Bearer eyJhbGciOiJIUzI1NiIs...` |
| `Accept-Language` | string (locale code) | Préférence de langue pour les réponses textuelles | Facultatif | `Accept-Language: fr` ou `Accept-Language: en` |

**Détails sur l'en-tête `x-org-id` :**

- Le format doit être un UUID v4 valide.
- Ce contexte d'organisation détermine l'isolation des données à travers tous les agrégats.
- Si l'en-tête est manquant, la réponse est `400 Bad Request` avec `E-400-MISSING_HEADER`.
- Si l'en-tête est présent mais invalide, la réponse est `400 Bad Request` avec `E-400-INVALID_UUID`.
- Pour les opérations d'authentification (`/api/auth/*`), `x-org-id` est facultatif car l'organisation est déterminée après l'authentification.

**Détails sur l'en-tête `Authorization` :**

- Utilise le schéma de porteur JWT standard.
- Le jeton doit être valide (non expiré) et non révoqué.
- Le jeton doit contenir les claims `org_id`, `member_id`, `roles`, `permissions`.
- Si le jeton est expiré, la réponse est `401 Unauthorized` avec `E-401-UNAUTH` et un champ `token_expired_at` dans les détails.
- Si le jeton est invalide ou corrompu, la réponse est `401 Unauthorized` avec `E-401-UNAUTH`.

### 5.2 En-têtes Optionnels

| En-tête | Type | Description | Usage |
|---------|------|-------------|-------|
| `x-request-id` | string (UUID) | ID de corrélation de requête unique | Trace distribuée, débogage |
| `Idempotency-Key` | string (UUID) | Clé unique pour les requêtes idempotentes | Anti-doublon sur POST |
| `If-Match` | string (ETag) | Version attendue de la ressource | Verrouillage optimiste |
| `If-None-Match` | string (ETag) | Version de la ressource déjà connue | Cache conditional GET |
| `If-Modified-Since` | string (ISO8601) | Dernière modification connue | Cache conditional GET |
| `X-Client-Version` | string | Version du client | Analytics, compatibilité |
| `X-Device-Id` | string (UUID) | Identifiant unique de l'appareil | Gestion de session multi-appareils |
| `X-Offline-Token` | string | Jeton de synchronisation hors ligne | Mode hors ligne |

**Détails sur `Idempotency-Key` :**

- UUID généré par le client avant l'envoi de la requête.
- Le serveur retient la clé pendant 24 heures.
- Si une requête avec la même clé est reçue, la réponse précédente est renvoyée sans exécuter à nouveau l'opération.
- S'applique uniquement aux méthodes POST et PUT.
- Limite de rétention de clé : 24 heures pour éviter la saturation mémoire.

**Détails sur `If-Match` (verrouillage optimiste) :**

- La valeur est le champ `etag` retourné dans la réponse `meta`.
- Si la version actuelle de la ressource ne correspond pas, la réponse est `412 Precondition Failed` avec `E-409-CONFLICT`.
- Utile pour les mises à jour PUT/PATCH où un conflit de dernière minute est possible.

### 5.3 En-têtes de Réponse

| En-tête | Type | Description |
|---------|------|-------------|
| `x-request-id` | string (UUID) | Identifiant de corrélation identique à la requête |
| `x-org-id` | string (UUID) | Organisation traitée (confirmation) |
| `x-rate-limit-remaining` | integer | Requêtes restantes dans la fenêtre de taux |
| `x-rate-limit-reset` | integer (epoch sec) | Moment où la limite se réinitialise |
| `X-Total-Count` | integer | Nombre total d'items pour les réponses paginées |
| `X-Page-Number` | integer | Page actuelle |
| `X-Page-Size` | integer | Taille de la page |
| `Link` | string | Liens de pagination RFC 5988 |
| `Content-Range` | string | Plage d'items retournés |
| `ETag` | string | Hash de version pour cache et verrouillage optimiste |
| `Cache-Control` | string | Directives de cache applicables |
| `Content-Language` | string | Langue effective du contenu retourné |
| `Server-Timestamp` | string (ISO8601) | Horodatage de réponse du serveur |

---

## 6. Idempotency

### 6.1 Principe Général

L'idempotence REST correspond aux garanties de réitération de demande : répéter la même demande de manière cohérente ne change pas l'état du système au-delà de la première application. Cette section définit comment les opérations canoniques de Lumina mappent aux garanties d'idempotence HTTP standards.

### 6.2 Mapping Idempotence par Méthode HTTP

| Méthode HTTP | Idempotent par Défaut | Garantie Lumina |
|-------------|---------------------|-----------------|
| `GET` | **Oui** | Naturellement idempotent — aucune modification d'état |
| `HEAD` | **Oui** | Naturellement idempotent — aucune modification d'état |
| `OPTIONS` | **Oui** | Naturellement idempotent — aucun effet de bord |
| `POST` | **Non** | Non idempotent par défaut ; idempotence possible via `Idempotency-Key` |
| `PUT` | **Oui** | Idempotent — remplacement complet de la ressource |
| `PATCH` | **Non** | Non idempotent par défaut ; modifications partielles cumulatives |
| `DELETE` | **Oui** | Idempotent — suppression logique ; second appel retourne 204 ou 404 |

### 6.3 Idempotence pour POST (Opérations de Création)

Puisque la plupart des créations de ressources dans Lumina utilisent POST (non idempotent par nature), une protection anti-doublon est fournie via l'en-tête `Idempotency-Key` :

**Processus :**

1. Le client génère un UUID unique (`Idempotency-Key`) avant d'envoyer une requête POST.
2. Le clientjoint la clé dans l'en-tête `Idempotency-Key`.
3. Le serveur enregistre la clé + la réponse de succès dans un store de rétention de 24 heures.
4. Si une deuxième requête arrive avec la même clé dans les 24 heures :
   - La réponse originale est renvoyée exactement (même corps, même en-têtes).
   - Aucune création ou mutation supplémentaire ne se produit.
   - La réponse contient l'en-tête `X-Idempotency-Cache-Hit: true`.
5. Au-delà de 24 heures, la clé expire et la nouvelle requête progresse normalement.

**En-têtes associés :**

| En-tête | Direction | Description |
|---------|-----------|-------------|
| `Idempotency-Key` | Requêter | UUID unique fourni par le client |
| `X-Idempotency-Cache-Hit` | Réponse | `true` si la réponse était un cache idempotent |
| `X-Idempotency-TTL` | Réponse | Secondes restantes avant expiration de la clé |

**Exemple d'utilisation :**

```
POST /api/resource/transactions
Idempotency-Key: abcdef12-3456-7890-abcd-ef1234567890
x-org-id: organization-uuid
Content-Type: application/json
Authorization: Bearer <token>

{
  "amount": 12500,
  "type": "expense",
  "category_id": "cat-food-001",
  "member_ids": ["member-1", "member-2"],
  "description": "Lunch at restaurant"
}
```

**Réponse de première demande (création) :**

```
HTTP/1.1 201 Created
X-Idempotency-Cache-Hit: false
X-Idempotency-TTL: 86399
```

**Réponse de redemande (cache hit) :**

```
HTTP/1.1 201 Created
X-Idempotency-Cache-Hit: true
X-Idempotency-TTL: 86300
```

### 6.4 Idempotence pour PUT (Opérations de Mise à Jour Complète)

Les opérations PUT sont naturellement idempotentes selon la spécification HTTP. Envoyer le même corps de requête multiple fois sur un PUT produit le même résultat final. Aucune `Idempotency-Key` n'est requis pour PUT.

**Comportement avec `If-Match` :**

Si `If-Match` est fourni et ne correspond pas à la version actuelle :

```
HTTP/1.1 412 Precondition Failed
{
  "error_code": "E-409-CONFLICT",
  "message": "La version de la ressource a changé.",
  "details": {
    "current_etag": "v1-current-hash",
    "expected_etag": "v1-stale-hash"
  }
}
```

### 6.5 Idempotence pour DELETE

Les opérations DELETE sont idempotentes : supprimer la même ressource deux fois produira un résultat cohérent.

- Première suppression : `204 No Content`
- Deuxième suppression (déjà supprimée) : `204 No Content` ou `404 Not Found` (les deux sont acceptables)

La suppression est logique (soft delete) : le champ `deleted_at` est défini, aucune donnée n'est physiquement supprimée.

### 6.6 Mapping vers les Opérations Canoniques

Chaque opération canonique de Lumina a une garantie d'idempotence définie :

| Opération Canonique | Méthode | Idempotent | Note |
|---------------------|---------|------------|------|
| UC-ResourceAggregate-001 (CreateTransaction) | POST | Non* | Utilise Idempotency-Key si nécessaire |
| UC-ResourceAggregate-002 (GetTransactionById) | GET | Oui | Lecture seule |
| UC-ResourceAggregate-003 (UpdateTransaction) | PUT | Oui | Mise à jour complète |
| UC-ResourceAggregate-004 (PartialUpdateTransaction) | PATCH | Non | Modifications partielles cumulatives |
| UC-ResourceAggregate-005 (DeleteTransaction) | DELETE | Oui | Soft delete |
| UC-ResourceAggregate-006 (ListTransactionsForOrg) | GET | Oui | Lecture seule |
| UC-ResourceAggregate-009 (BulkCreateTransactions) | POST | Non* | Batch — idempotence globale requiert Idempotency-Key |
| UC-DashboardAggregate-001 (GetFinancialOverview) | GET | Oui | Lecture seule |
| UC-AuthAggregate-001 (RegisterAccount) | POST | Non* | Doublon détecté par E-409-DUPLICATE_EMAIL |
| UC-AuthAggregate-002 (Login) | POST | Non | Redonne le même résultat mais peut avoir un effet de bord (logging) |
| UC-AuthAggregate-004 (Logout) | POST | Non | Destruction de session ; idempotence gérée par révocation |
| UC-CommunicationAggregate-001 (SendMessage) | POST | Non* | Message double serait envoyé ; Idempotency-Key recommandé |
| UC-StorageAggregate-002 (UploadFile) | POST | Non* | Upload redondant peut causer doublon ; Idempotency-Key recommandé |

\* Opérations nécessitant `Idempotency-Key` dans les contextes où la redondance réseau est possible.

---

## 7. Versioning Strategy

### 7.1 URL Path Versioning

Lumina utilise le versioning par chemin d'URL comme stratégie principale :

```
/api/{aggregate}/{resource}
```

Le préfixe `/api/` est le marqueur de version implicite v1. Toute rupture d'API future utilisera un préfixe de version explicite :

```
/api/v1/{aggregate}/{resource}   ← Version actuelle
/api/v2/{aggregate}/{resource}   ← Version future (si rupture)
```

### 7.2 Règles de Compatibilité

**Modifications non-rupturales (v1 compatible) :**
- Ajout de nouveaux champs optionnels dans les réponses
- Ajout de nouveaux endpoints dans le même aggregate
- Ajout de nouvelles options de filtre ou de tri
- Dépréciation douce d'anciens champs (avec avertissement de longévité de 6 mois)

**Modifications rupturales (nécessite v2) :**
- Suppression ou renommage de champs existants dans le schéma de réponse
- Modification sémantique de la signification d'un champ
- Changement du format de données d'un champ existant
- Suppression d'un endpoint existant (sans remplacement)
- Modification de la sémantique des codes de statut HTTP

### 7.3 Cycle de Vie des Versions

| Phase | Durée | Description |
|-------|-------|-------------|
| Actif | indéfini | Version courante, soutenue en production |
| Déprécié | 6 mois minimum | Ancienne version toujours fonctionnelle mais avec avertissement `Deprecation` header |
| Retiré | — | Plus accessible ; réponses 410 Gone |

En-tête de dépréciation :

```
Deprecation: true
Sunset: Sat, 25 Jan 2027 00:00:00 GMT
Link: <https://lumina-docs.internal/migration/v1-to-v2>; rel="successor-version"
```

---

## 8. Rate Limiting

### 8.1 Niveaux de Taux par Catégorie d'Endpoint

Les limites de taux protègent le système contre la surcharge et l'abus :

| Catégorie | Limite | Fenêtre | Applicabilité |
|-----------|--------|---------|---------------|
| Lecture (GET) | 1200 req | 1 heure | Tous les endpoints GET |
| Écriture (POST/PUT/PATCH) | 300 req | 1 heure | Tous les endpoints POST/PUT/PATCH |
| Suppression (DELETE) | 100 req | 1 heure | Tous les endpoints DELETE |
| Authentification | 30 req | 15 minutes | `/api/auth/*` |
| Paiement | 10 req | 1 heure | `/api/finance/payments/*` |
| Export | 5 req | 24 heures | `/api/*/export` |
| Push test | 1 req | 5 minutes | `/api/notification/push/test` |
| Découverte de pairs | 20 req | 1 heure | `/api/network/peers/discover` |

### 8.2 En-têtes de Limite de Taux

Chaque réponse inclut des informations de limite de taux :

```
X-RateLimit-Limit: 1200
X-RateLimit-Remaining: 847
X-RateLimit-Reset: 1721899200
Retry-After: 3600
```

Quand la limite est dépassée :

```
HTTP/1.1 429 Too Many Requests
Retry-After: 1800
{
  "error_code": "E-429-RATE_LIMIT",
  "message": "Limite de taux dépassée. Veuillez réessayer plus tard.",
  "details": {
    "limit": 300,
    "window_seconds": 3600,
    "retry_after_seconds": 1800
  }
}
```

### 8.3 Adaptativité des Limits

Les limites de taux peuvent être ajustées dynamiquement en fonction de :
- La charge du serveur (auto-scaling des quotas temporaires)
- Le plan d'abonnement (Pro bénéficie de quotas 5x plus élevés)
- Le type d'opération (lecture prioritaire sur écriture)
- L'historique d'usage du compte (comptes avec historique stable peuvent recevoir des concessions temporaires)

---

## 9. Conformité et Vérification

### 9.1 Matrice de Conformité

Chaque point de terminaison REST de cette spécification doit respecter les règles suivantes :

| Règle | Description |
|-------|-------------|
| REQ-REST-001 | Chaque endpoint doit retourner un code de statut HTTP approprié |
| REQ-REST-002 | Chaque endpoint doit retourner un corps JSON conforme à l'enveloppe correspondante |
| REQ-REST-003 | L'en-tête `x-org-id` est obligatoire sauf pour les endpoints d'authentification |
| REQ-REST-004 | Les erreurs doivent retourner l'enveloppe d'erreur avec `error_code` canonique |
| REQ-REST-005 | Les collections doivent supporter la pagination standardisée |
| REQ-REST-006 | Les réponses doivent inclure `request_id` de corrélation |
| REQ-REST-007 | Les endpoints de lecture doivent être idempotents |
| REQ-REST-008 | Les endpoints PUT doivent être idempotents par conception |
| REQ-REST-009 | Les endpoints DELETE doivent utiliser la suppression logique |
| REQ-REST-010 | Les responses doivent inclure les headers de cache appropriés |
| REQ-REST-011 | Tous les corps de requête doivent valider le schéma API-CONTRACT-002 |
| REQ-REST-012 | L'en-tête `Idempotency-Key` doit être supporté pour POST |
| REQ-REST-013 | Les réponses doivent inclure les en-têtes de limite de taux |
| REQ-REST-014 | Les chemins doivent être en kebab-case |
| REQ-REST-015 | Les noms de champs JSON doivent être en snake_case |

### 9.2 Traçabilité

Chaque endpoint dans cette spécification est tracé vers son Operation ID canonique dans API-CONTRACT-001. Aucun endpoint ne doit exister sans référence canonique. Tout changement doit maintenir cette traçabilité intacte.

### 9.3 Règles de Validation

Avant qu'un endpoint ne soit considéré comme implémenté :

1. Il doit apparaître dans cette spécification avec un Entry ID (R-xxx, D-xxx, S-xxx, etc.)
2. Le schéma de requête doit correspondre exactement à API-CONTRACT-002
3. Le schéma de réponse doit respecter l'enveloppe définie dans Section 3
4. Les codes d'erreur retournés doivent être un sous-ensemble de ceux de API-CONTRACT-005
5. Les en-têtes requis doivent être validés au niveau de la passerelle
6. Les tests d'intégration doivent couvrir au moins : succès, erreur de validation, erreur d'autorisation, cas limites de pagination

---

## Appendix A: Error Code Quick Reference

Taxonomie complète des codes d'erreur utilisés par les endpoints REST, basée sur API-CONTRACT-005 :

| Code | HTTP Status | Catégorie | Description |
|------|------------|-----------|-------------|
| E-400-VALIDATION | 400 | Validation | Schéma de requête invalide |
| E-400-MISSING_FIELD | 400 | Validation | Champ requis manquant |
| E-400-MISSING_HEADER | 400 | Requête | En-tête requis manquant (x-org-id) |
| E-400-INVALID_UUID | 400 | Requête | UUID de chemin ou paramètre invalide |
| E-401-UNAUTH | 401 | Authentification | Non authentifié ou jeton expiré |
| E-401-CREDENTIALS_INVALID | 401 | Authentification | Email ou mot de passe incorrect |
| E-401-INVALID_REFRESH_TOKEN | 401 | Authentification | Jeton de rafraîchissement invalide |
| E-402-PAYMENT_REQUIRED | 402 | Finance | Plan gratuit non autorisé pour cette action |
| E-402-PAYMENT_FAILED | 402 | Finance | Échec du traitement de paiement |
| E-402-REFUND_NOT_ALLOWED | 402 | Finance | Remboursement non autorisé |
| E-403-FORBIDDEN | 403 | Autorisation | Insuffisant pour cette ressource/opération |
| E-404-NOT_FOUND | 404 | Ressources | Identifiant de ressource introuvable |
| E-409-CONFLICT | 409 | Conflit | Conflit de modification (version mismatch) |
| E-409-DUPLICATE_EMAIL | 409 | Conflit | Email déjà utilisé |
| E-409-DUPLICATE_NAME | 409 | Conflit | Nom de groupe déjà pris |
| E-409-DUPLICATE_CONNECTION | 409 | Conflit | Connexion paire existante |
| E-409-ALREADY_RSVPed | 409 | Conflit | RSVP déjà soumis pour cet événement |
| E-410-TOKEN_EXPIRED | 410 | Expiration | Jeton ou lien de réinitialisation expiré |
| E-413-PAYLOAD_TOO_LARGE | 413 | Requête | Fichier ou payload trop volumineux |
| E-415-UNSUPPORTED_FORMAT | 415 | Requête | Type de média non supporté |
| E-422-PARTIAL_FAILURE | 422 | Traitement | Certaines opérations batch ont échoué |
| E-422-APPLY_FAILED | 422 | Traitement | Règle de répartition impossible |
| E-429-RATE_LIMIT | 429 | Trafic | Limite de taux dépassée |

---

## Appendix B: Aggregate Endpoint Index

Index complet des points de terminaison regroupés par aggregate pour une consultation rapide :

| Aggregate | Préfixe de Chemin | Nombre d'Endpoints | Entrées Spécifiées |
|-----------|------------------|-------------------|-------------------|
| Resource (Financial) | `/api/resource/transactions` | 15 | R-001 à R-015 |
| Resource (Members) | `/api/resource/members` | 8 | R-016 à R-023 → R-023 à R-030 |
| Resource (Groups) | `/api/resource/groups` | 8 | R-031 à R-038 |
| Resource (Events) | `/api/resource/events` | 6 | R-039 à R-044 |
| Resource (Celebrations) | `/api/resource/celebrations` | 4 | R-045 à R-048 |
| Dashboard | `/api/dashboard/*` | 10 | D-001 à D-010 |
| Settings (User) | `/api/settings/preferences` | 6 | S-001 à S-006 |
| Settings (Organization) | `/api/settings/organization` | 7 | S-007 à S-013 |
| Network (Peers) | `/api/network/peers` | 5 | N-001 à N-005 |
| Network (Sync) | `/api/network/sync` | 8 | N-006 à N-013 |
| Auth (Identity) | `/api/auth/*` | 15 | A-001 à A-015 |
| Communication (Messages) | `/api/communication/messages` | 10 | C-001 à C-010 |
| Communication (Notifications) | `/api/communication/notifications` | 6 | C-011 à C-016 |
| Notification (Push) | `/api/notification/push` | 7 | NP-001 à NP-007 |
| Finance | `/api/finance/*` | 12 | F-001 à F-012 |
| Storage | `/api/storage/*` | 8 | ST-001 à ST-008 |
| Audit | `/api/audit/*` | 6 | AU-001 à AU-006 |
| **TOTAL** | | **83** | **Entry IDs complets** |

---

## Appendix C: Changelog de Spécification

| Version | Date | Auteur | Changements |
|---------|------|--------|-------------|
| v1.0 | 2026-07-25 | GENESIS | Spécification initiale complète — 83 endpoints REST mappés depuis API-CONTRACT-001 |

---

**Fin de la spécification.**

Ce document est une source canonique pour l'adaptation REST dans l'architecture Lumina. Toute déviation doit être documentée via un ADR (Architecture Decision Record) modifiant la traçabilité vers PROTO-001 et API-CONTRACT-001.

Tout nouveau endpoint REST ajouté après cette spécification doit :
1. Être documenté dans cette section Endpoint Mapping avec un Entry ID unique.
2. Avoir son schéma de requête défini dans API-CONTRACT-002.
3. Avoir son code d'erreur catalogué dans API-CONTRACT-005.
4. Passer une revue de conformité contre les 15 règles REQ-REST-001 à REQ-REST-015.

Toutes les demandes de modification de cette spécification doivent être soumises via le processus de changement de constitution de Lumina.
