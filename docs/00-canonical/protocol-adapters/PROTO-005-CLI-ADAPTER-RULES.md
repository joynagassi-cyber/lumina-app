# CLI Adapter Rules Specification — Lumina v1

**Doc ID:** PROTO-005
**Version:** v1.0
**Statut:** SPÉCIFICATION PROTOCOLE ADAPTÉ DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "API-CONTRACT-002", "API-CONTRACT-005", "PROTO-001"]
**Transformation_rule :** "cli-adapter-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## SOMMAIRE

1. [Principes Fondamentaux](#1-principes-fondamentaux)
2. [Structure des Commandes par Aggregate](#2-structure-des-commandes-par-aggregate)
3. [Format de Sortie](#3-format-de-sortie)
4. [Gestion d'Erreurs et Codes de Sortie](#4-gestion-derreurs-et-codes-de-sortie)
5. [Structure du Help Subcommand](#5-structure-du-help-subcommand)
6. [Exemples de Sortie Unifiés](#6-exemples-de-sortie-unifies)
7. [Matrice de Traçabilité](#7-matrice-de-tracabilite)

---

## 1. PRINCIPES FONDAMENTAUX

Le CLI Adapter suit le pipeline universel défini dans **PROTO-001 Section 3** :
les arguments CLI → Parser → Canonical Request → Service Call → Canonical Response → Serializer → stdout/stderr.

### Règle P-CLI-001: Hiérarchie de Commandes Suit la Structure Aggregate

La syntaxe CLI reflète la structure des 13 Aggregates canoniques définis dans **API-CONTRACT-001** :

```
lumina {aggregate} {action} [options]
```

Chaque Aggregate correspond à un sous-groupe de commandes. Les 83 opérations canoniques sont toutes accessibles via le CLI. Aucun nom d'operation n'est inventé — chaque `{action}` mappe vers exactement une operation de **API-CONTRACT-001**.

### Règle P-CLI-002: Texte de Help Structuré et Cohérent

Chaque sous-commande expose un help structuré via `--help`. Le format est identique pour toutes les sous-commandes (voir Section 5). Chaque help inclut la référence à l'operationId canonique pour traçabilité.

### Règle P-CLI-003: Trois Formats de Sortie — JSON, Table, Text

Le flag `--format json|table|text` contrôle le format de sortie. La valeur par défaut est `table`. Ce flag est disponible sur toutes les commandes qui produisent une sortie lisible (queries, succès de commands avec données retournées).

### Règle P-CLI-004: Codes de Sortie Déterministes

Les codes de sortie Unix sont utilisés de manière déterministe :

| Code | Signification | Quand utilisé |
|------|--------------|---------------|
| 0 | Succès | Opération terminée sans erreur |
| 1 | Erreur utilisateur | Input invalide (E-400), auth requise (E-401), non trouvé (E-404), violation business (E-422) |
| 2 | Permission refusée | E-403 forcé (permission denied) |
| 3 | Erreur interne / conflit | E-409 conflict, E-500 internal error |
| 4 | Erreur de configuration | Token manquant ou invalide, env var manquante |

### Règle P-CLI-005: Pas de Fuite de Données Sensibles

Les champs sensibles (password_hash, tokens, credentials, secrets) sont toujours masqués avec `***` dans toute sortie CLI, quel que soit le format choisi. Cela s'applique à stdout et stderr.

### Règle P-CLI-006: Authentification Via --token ou LUMINA_TOKEN

L'authentification se fait par :
1. Variable d'environnement `LUMINA_TOKEN` (priorité par défaut)
2. Flag `--token <string>` (surcharge la variable d'environnement)
3. Sous-commande `lumina auth login` (stocke le token de façon sécurisée)

Aucun mot de passe ou token n'est jamais hardcoded dans les commandes ou leur aide.

### Règle P-CLI-007: Pagination Affichée de Manière Humaine

Quand un résultat est paginé, le footer de table/text affiche :
```
Page N of M (K total items)
```
où N = page courante, M = nombre total de pages, K = nombre total d'éléments.

### Règle P-CLI-008: Traçabilité Vers DOC-014

Chaque commande CLI mappe vers exactement une opération canonique de **API-CONTRACT-001** (qui elle-même référence **DOC-014**). Le help de chaque sous-commande affiche l'operationId comme référence de traçabilité.

---

## 2. STRUCTURE DES COMMANDES PAR AGGREGATE

### lumina org

Gère l'organisation courante et sa hiérarchie d'unités organisationnelles. Correspond aux opérations de **OrganizationAggregate** (10 ops dans API-CONTRACT-001).

**Description :** Operations sur l'organisation, ses paramètres et sa structure hiérarchique d'unités.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina org create <name> --type <type>` | CreateOrganization | Command | INV-004 |
| `lumina org update-settings --key <k> --value <v>` | UpdateOrganizationSettings | Command | CFG-001, CFG-002, CFG-003 |
| `lumina org create-unit <name> --type <type> [--parent <id>]` | CreateOrgUnit | Command | REL-001, REL-002 |
| `lumina org reparent <unit-id> --new-parent <parent-id>` | UpdateOrgUnitParent | Command | REL-001, REL-002 |
| `lumina org transfer <child-org-id> --new-parent <parent-id>` | TransferChildOrg | Command | REL-001 |
| `lumina org merge <source-id> <target-id>` | MergeOrganizations | Command | INV-004 |
| `lumina org archive <org-id>` | ArchiveOrganization | Command | — |
| `lumina org suspend <org-id>` | SuspendOrganization | Command | BR-ORG-006 |
| `lumina org show [--id <uuid>]` | GetOrganizationProfile | Query | INV-004 |
| `lumina org descendants <root-id>` | GetDescendantUnits | Query | REL-002 |

#### Arguments

- `<name>` — Nom de l'organisation (string, non vide)
- `--type <enum>` — Type d'organisation (enum valide, ex: church, school, association)
- `--key <string>` — Clé du paramètre à mettre à jour
- `--value <string>` — Valeur du paramètre (format dépend de la clé)
- `<unit-id>` — UUID de l'unité organisationnelle
- `--parent <uuid>` / `--new-parent <uuid>` — UUID du parent
- `<source-id>` / `<target-id>` — UUIDs des organisations à fusionner
- `<child-org-id>` — UUID de l'organisation enfant
- `--id <uuid>` — UUID optionnel de l'organisation (par défaut: org de la session courante)
- `<root-id>` — UUID de la racine pour les descendants

#### Exemple

```bash
$ lumina org create "Église Lumina Central" --type church --org a1b2c3d4
✓ Organization created successfully.
  id: a1b2c3d4-e5f6-7890-abcd-ef1234567890
  name: Église Lumina Central
  type: church
  version: 1

$ lumina org show --format json --org a1b2c3d4
{
  "success": true,
  "data": {
    "id": "a1b2c3d4-...",
    "name": "Église Lumina Central",
    "type": "church",
    "status": "active",
    "version": 1,
    "settings": { "currency": "CDF", "timezone": "Africa/Lubumbashi" }
  }
}
```

---

### lumina users

Gère les utilisateurs et l'authentification. Correspond aux opérations de **IdentityAggregate** (9 ops dans API-CONTRACT-001).

**Description :** Operations sur les utilisateurs, sessions, rôles et authentification.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina users create <email> --first-name <fn> --last-name <ln> --role <role> --password <pw>` | CreateUser | Command | EMAIL-001 |
| `lumina users update-profile <user-id> --first-name <fn> --last-name <ln> [--email <e>]` | UpdateUserProfile | Command | EMAIL-001 |
| `lumina users change-role <user-id> --role <new-role>` | ChangeUserRole | Command | INV-008 |
| `lumina users reset-password <user-id> --password <pw>` | ResetPassword | Command | BR-ID-001 |
| `lumina auth login <email> <password>` | LoginUser | Command | INV-004, INV-008 |
| `lumina auth logout` | LogoutUser | Command | — |
| `lumina auth refresh` | RefreshAccessToken | Command | — |
| `lumina auth revoke-session <session-id>` | RevokeSession | Command | — |
| `lumina users list [--status <s>] [--page <n>]` | (query pattern sur user entities) | Query | — |
| `lumina users show <user-id>` | (query pattern sur user entity) | Query | — |

#### Arguments

- `<email>` — Adresse email de l'utilisateur (format valide)
- `--first-name <string>` / `--last-name <string>` — Prénom et nom (obligatoires)
- `--role <enum>` — Rôle: admin, treasurer, pastor, superadmin, etc.
- `<password>` — Mot de passe (stocké en hash, jamais en clair)
- `<user-id>` — UUID de l'utilisateur
- `<session-id>` — UUID de la session à révoquer
- `--status <enum>` — Filtre: active, inactive (pour list)

#### Exemple

```bash
$ lumina users create "pastor@example.cd" --first-name "Jean" --last-name "Mbala" --role pastor --org a1b2c3d4
✓ User created successfully.
  id: b2c3d4e5-f6a7-8901-bcde-f12345678901
  email: pastor@example.cd
  role: pastor

$ lumina auth login "admin@example.cd" "***"
✓ Authenticated. Token stored in secure storage.
```

---

### lumina resource transactions

Gère les transactions financières. Correspond aux opérations de **ResourceAggregate** liées aux transactions (6 ops dans API-CONTRACT-001).

**Description :** Create, approve, reject, compensate, and query financial transactions. All operations are scoped to the authenticated organization.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina resource transactions create <amount-cents> --type <type> --category-ref <ref> --date <yyyy-MM-dd> [--description <text>]` | CreateTransaction | Command | FIN-002, DATE-001, CAT-001, SCOPE-001 |
| `lumina resource transactions update-draft <tx-id> --set field=value [... ]` | UpdateDraftTransaction | Command | FIN-001, VERSION-001 |
| `lumina resource transactions submit-for-approval <tx-id>` | SubmitForApproval | Command | — |
| `lumina resource transactions approve <tx-id> [--comment <text>]` | ApproveTransaction | Command | BR-RES-001 |
| `lumina resource transactions reject <tx-id> --reason <text>` | RejectTransaction | Command | BR-RES-001 |
| `lumina resource transactions compensate <original-tx-id> --amount <cents> --type <type>` | CompensateTransaction | Command | COMP-001 |
| `lumina resource transactions list [--status <s>] [--date-from <d>] [--date-to <d>] [--type <t>] [--page <n>]` | SearchResources | Query | INV-004 |
| `lumina resource transactions show <tx-id>` | (single-resource read via SearchResources pattern) | Query | INV-004 |
| `lumina resource transactions export [--format csv|json|pdf]` | ExportResources | Query | EXPORT-001 |

#### Arguments

- `<amount-cents>` — Montant en centimes (entier positif, BIGINT)
- `--type <enum>` — income, expense, transfer
- `--category-ref <string>` — Référence vocabulaire (ex: "finance:income:tithes")
- `--date <ISO-date>` — Date de transaction (jamais future, DATE-001)
- `--description <text>` — Obligatoire si amount > 100 (DESC-001)
- `<tx-id>` — UUID de la transaction
- `--status <enum>` — Filtre: draft, pending, approved, rejected, compensated
- `--reason <text>` — Motif de rejet (obligatoire pour reject)
- `--comment <text>` — Commentaire d'approbation (optionnel)

#### Exemple

```bash
$ lumina resource transactions create 50000 --type income --category-ref finance:income:tithes --date 2026-07-25 --org a1b2c3d4
✓ Transaction created successfully.
  id: c3d4e5f6-a7b8-9012-cdef-123456789012
  amount_cents: 50000
  type: income
  status: draft
  version: 1

$ lumina resource transactions list --org a1b2c3d4 --format table --status pending
┌──────────────────────┬───────────┬────────────┬──────────┐
│ id                   │ type      │ amount     │ status   │
├──────────────────────┼───────────┼────────────┼──────────┤
│ c3d4e5f6-...         │ income    │ 50,000     │ pending  │
│ d4e5f6a7-...         │ expense   │ 12,500     │ pending  │
└──────────────────────┴───────────┴────────────┴──────────┘
Page 1 of 1 (2 items)
```

---

### lumina resource members

Gère les membres de l'organisation. Correspond aux opérations de **ResourceAggregate** liées aux membres (3 ops dans API-CONTRACT-001).

**Description :** Create, update, and manage member records.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina resource members create --first-name <fn> --last-name <ln> [--email <e>] [--phone <p>]` | CreateMember | Command | MEM-001, EMAIL-001 |
| `lumina resource members update <member-id> --field value` | UpdateMember | Command | MEM-001 |
| `lumina resource members transition-status <member-id> --new-status <s>` | TransitionMemberStatus | Command | STATUS-010 |
| `lumina resource members list [--status <s>] [--page <n>]` | SearchResources | Query | INV-004 |
| `lumina resource members show <member-id>` | (single-member read) | Query | INV-004 |

#### Arguments

- `--first-name <string>` / `--last-name <string>` — Toujours obligatoires (MEM-001)
- `--email <string>` — Optionnel, unique par org si fourni (EMAIL-001)
- `--phone <string>` — Optionnel, format tel valide
- `<member-id>` — UUID du membre
- `--new-status <enum>` — active, inactive, deceased, transferred

#### Exemple

```bash
$ lumina resource members create --first-name "Marie" --last-name "Kaluanga" --email "marie@example.cd" --org a1b2c3d4
✓ Member created successfully.
  id: e5f6a7b8-c9d0-1234-efab-234567890123
  first_name: Marie
  last_name: Kaluanga
  email: marie@example.cd
  status: active
```

---

### lumina resource events

Gère les événements organisationnels. Correspond aux opérations de **ResourceAggregate** (impliqué par SearchResources/ExportResources pattern).

**Description :** Search and export event records associated with the organization.

#### Commands

| CLI Syntax | Canonical Operation | Type |
|------------|-------------------|------|
| `lumina resource events list [--type <t>] [--date-from <d>] [--page <n>]` | SearchResources | Query |
| `lumina resource events show <event-id>` | (single-event read) | Query |

#### Exemple

```bash
$ lumina resource events list --org a1b2c3d4 --type celebration --format text
Resource Type: event
  id:        f6a7b8c9-d0e1-2345-fabc-345678901234
  type:      celebration
  title:     Fête de la Mission
  date:      2026-08-15
  status:    published

Page 1 of 2 (15 items)
```

---

### lumina resource categories

Gère les catégories de ressources via le vocabulary. Correspond à la validation CAT-001 de ResourceAggregate.

**Description :** Manage resource categorization through the VocabularyAggregate reference.

#### Commands

| CLI Syntax | Canonical Operation | Type |
|------------|-------------------|------|
| `lumina resource categories list [--namespace <ns>]` | SearchResources (category filter) | Query |
| `lumina resource categories show <category-ref>` | (single-category read) | Query |

#### Exemple

```bash
$ lumina resource categories list --org a1b2c3d4 --namespace finance
Category Ref                            Label (FR)              Label (EN)
---------------------------------------- ----------------------- -------------------------
finance:income:tithes                    Dîmes                   Tithes
finance:income:offerings                 Offrandes               Offerings
finance:expense:missions                 Missions                Missions
```

---

### lumina resource (groupe racine)

Le préfixe `resource` permet d'accéder à tous les sous-groupes. Quand aucun sous-groupe n'est spécifié, `lumina resource search` map vers `SearchResources` avec filtres génériques.

```bash
$ lumina resource search --org a1b2c3d4 --resource-type transaction --status approved
```

---

### lumina groups

Gère les groupes et les relations membre-groupe. Correspond aux opérations de **RelationshipAggregate** liées aux groupes (6 ops dans API-CONTRACT-001).

**Description :** Operations on group memberships, org unit hierarchies, and relationship queries.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina groups add-member <group-id> <member-id>` | AddMemberToGroup | Command | MULTI-020 |
| `lumina groups remove-member <group-id> <member-id>` | RemoveMemberFromGroup | Command | HISTORY-022 |
| `lumina groups list [--member <uid>] [--page <n>]` | GetAllGroupsForMember / GetAllMembersOfGroup | Query | INV-004 |
| `lumina groups show <group-id>` | (single-group read) | Query | INV-004 |
| `lumina hierarchy link <unit-id> <parent-id>` | SetOrgUnitParent | Command | REL-001, REL-002 |
| `lumina hierarchy descendants <root-id>` | GetDescendants | Query | REL-002 |

#### Arguments

- `<group-id>` — UUID du groupe
- `<member-id>` — UUID du membre
- `<unit-id>` / `<parent-id>` — UUIDs d'unités organisationnelles
- `--member <uuid>` — Filtre: grouper par membre spécifique

#### Exemple

```bash
$ lumina groups add-member g1234567-abcd-ef01-2345-6789abcdef01 m1234567-abcd-ef01-2345-6789abcdef01 --org a1b2c3d4
✓ Member joined group successfully.
  group_id: g1234567-...
  member_id: m1234567-...
  joined_at: 2026-07-25T10:30:00Z

$ lumina hierarchy descendants u1234567-abcd-ef01-2345-6789abcdef01 --org a1b2c3d4 --format table
┌──────────────────────┬───────────┬───────┐
│ unit_id              │ name      │ depth │
├──────────────────────┼───────────┼───────┤
│ u2345678-...         │ Secteur N │ 1     │
│ u3456789-...         │ Zone 1    │ 2     │
│ u4567890-...         │ Village A │ 3     │
└──────────────────────┴───────────┴───────┘
```

---

### lumina workflows

Gère les workflows d'approbation. Correspond aux opérations de **WorkflowAggregate** (6 ops dans API-CONTRACT-001).

**Description :** Trigger, approve, reject, cancel, and query workflow instances.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina workflows start <definition-key> <resource-type> <resource-id> [--trigger <event>]` | TriggerWorkflow | Command | LOG-005, WF-006 |
| `lumina workflows approve <instance-id> <step-id> [--comment <text>]` | ApproveStep | Command | CHAINS-003 |
| `lumina workflows reject <instance-id> <step-id> --reason <text>` | RejectStep | Command | WF-001 |
| `lumina workflows cancel <instance-id> --reason <text>` | CancelWorkflow | Command | LOG-005 |
| `lumina workflows resubmit <instance-id>` | ResubmitForApproval | Command | RETRY-004 |
| `lumina workflows list [--status <s>] [--page <n>]` | GetPendingApprovals | Query | LOG-005 |
| `lumina workflows show <instance-id>` | (single-instance read) | Query | — |

#### Arguments

- `<definition-key>` — Clé de définition du workflow (ex: "tx-approval-major")
- `<resource-type>` — Type de ressource ciblée (transaction, form, etc.)
- `<resource-id>` — UUID de la ressource cible
- `<instance-id>` — UUID de l'instance de workflow
- `<step-id>` — UUID de l'étape à approuver/rejeter
- `--trigger <string>` — Événement déclencheur (optionnel)
- `--comment <text>` — Commentaire d'approbation (optionnel)
- `--reason <text>` — Motif de rejet/cancellation (obligatoire pour reject/cancel)
- `--status <enum>` — Filtre: running, completed, cancelled, failed

#### Exemple

```bash
$ lumina workflows start tx-approval-major transaction c3d4e5f6-... --org a1b2c3d4
✓ Workflow triggered successfully.
  instance_id: w1234567-abcd-ef01-2345-6789abcdef01
  definition_key: tx-approval-major
  current_step: 1
  status: running

$ lumina workflows approve w1234567-... s1234567-... --comment "Validated" --org a1b2c3d4
✓ Step approved.
  instance_id: w1234567-...
  step_id: s1234567-...
  new_status: next_step_active
```

---

### lumina forms

Gère les définitions et le rendu de formulaires. Correspond aux opérations de **FormAggregate** (4 ops dans API-CONTRACT-001).

**Description :** Load, render, validate form definitions produced from the manifest.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina forms load <form-id> [--version <v>]` | LoadFormDefinition | Query | FRM-004 |
| `lumina forms render <form-id> [--data <json-file>]` | RenderForm | Query | FRM-001, VOCAB-002 |
| `lumina forms validate <form-id> --data <json-string>` | ValidateFormData | Command | DUAL-008 |
| `lumina forms visible-fields <form-id> [--context <json>]` | GetVisibleFields | Query | FRM-003 |
| `lumina forms list [--page <n>]` | (all forms in manifest) | Query | — |

#### Arguments

- `<form-id>` — Clé du formulaire défini dans le manifest
- `--version <int>` — Version spécifique du formulaire (optionnel, default: latest)
- `--data <json-string>` — Données à valider ou utiliser pour le rendu
- `--context <json>` — Contexte pour l'évaluation des conditions visible_if
- `--json-file <path>` — Fichier JSON contenant les données (alternative au flag --data inline)

#### Exemple

```bash
$ lumina forms load fin-monthly-report --org a1b2c3d4
✓ Form loaded.
  form_id: fin-monthly-report
  version: 3
  fields: 12
  sections: 3

$ lumina forms render fin-monthly-report --org a1b2c3d4 --format json
{
  "form_id": "fin-monthly-report",
  "render_tree": [
    { "type": "section", "label": "Revenus", "fields": [...] },
    { "type": "section", "label": "Dépenses", "fields": [...] }
  ],
  "visible_fields_count": 10
}
```

---

### lumina notifications

Gère les notifications, préférences et files d'attente. Correspond aux opérations de **NotificationAggregate** (6 ops dans API-CONTRACT-001).

**Description :** Send, manage, and configure notifications. Notifications are always triggered by an explicit source (never spontaneous — NOT-001).

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina notifications send --recipient <uid> --channel <ch> --body <text> --trigger <source>` | SendNotification | Command | NOT-001, CHANNEL-003, QUIET-004 |
| `lumina notifications mark-read <notif-id>` | MarkAsRead | Command | — |
| `lumina notifications preferences set --channels <list> [--severity-min <level>] [--rate-limit <n>]` | UpdatePreferences | Command | CHANNEL-003, RATE-002 |
| `lumina notifications rate-limit set --max-per-hour <n>` | SetRateLimit | Command | RATE-002 |
| `lumina notifications suppress --until <datetime>` | SuppressUntil | Command | QUIET-004 |
| `lumina notifications list [--unread-only] [--page <n>]` | (query notifications for user) | Query | — |
| `lumina notifications show <notif-id>` | (single-notification read) | Query | — |

#### Arguments

- `--recipient <uuid>` — UUID du destinataire
- `--channel <enum>` — in_app, push, email, sms
- `--body <text>` — Corps du message (templating supporté)
- `--trigger <string>` — Source du trigger (obligatoire — NOT-001)
- `<notif-id>` — UUID de la notification
- `--channels <list>` — Liste de canaux séparés par virgule (ex: "in_app,push")
- `--severity-min <enum>` — Severity minimale: low, medium, high, critical
- `--max-per-hour <int>` — Limitation taux (entier > 0)
- `--until <ISO-datetime>` — Jusqu'à quand supprimer

#### Exemple

```bash
$ lumina notifications send --recipient b2c3d4e5-... --channel in_app --body "Validation requise pour transaction de 50000 CDF" --trigger approval-requested --org a1b2c3d4
✓ Notification sent.
  notification_id: n1234567-abcd-ef01-2345-6789abcdef01
  channel: in_app
  severity: high
  status: sent

$ lumina notifications preferences set --channels "in_app,email" --org a1b2c3d4
✓ Preferences updated.
  channels: [in_app, email]
  rate_limit_per_hour: 24
```

---

### lumina vocab

Gère le vocabulaire organisationnel: namespaces, terms, valeurs, labels. Correspond aux opérations de **VocabularyAggregate** (7 ops dans API-CONTRACT-001).

**Description :** Define, query, and deprecate vocabulary terms. Values are never deleted — only deprecated (VOC-001). Keys are immutable after creation (STABLE-003).

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina vocab define-namespace <namespace-key>` | (create namespace) | Command | — |
| `lumina vocab define-term <namespace> <term-key> --label-fr <fr> --label-en <en>` | (add term to namespace) | Command | TRANSLATION-002 |
| `lumina vocab define-value <namespace> <term-key> --val-key <vk> --label-fr <fr> --label-en <en> [--color #RRGGBB]` | AddTermValue | Command | STABLE-003, TRANSLATION-002 |
| `lumina vocab deprecate <namespace> <term-key> <val-key>` | DeprecateTermValue | Command | VOC-001 |
| `lumina vocab resolve <namespace> <term-key> --lang <fr|en>` | ResolveLabel | Query | TRANSLATION-002 |
| `lumina vocab list-terms <namespace>` | GetTerms | Query | — |
| `lumina vocab list-values <namespace> <term-key>` | GetTermValues | Query | — |
| `lumina vocab search <query> [--namespace <ns>]` | SearchTerms | Query | — |
| `lumina vocab list-namespaces` | GetAllNamespaces | Query | — |

#### Arguments

- `<namespace-key>` — Clé du namespace (ex: "finance", "roles", "forms")
- `<term-key>` — Clé du terme dans le namespace
- `<val-key>` — Clé de la valeur (unique, stable)
- `--label-fr <string>` / `--label-en <string>` — Labels bilingues requis (TRANSLATION-002)
- `--color <hex>` — Couleur optionnelle #RRGGBB
- `<query>` — Texte de recherche (pour SearchTerms)
- `--lang <string>` — Langue de résolution: fr, en (optionnel pour resolve, default: fr)

#### Exemple

```bash
$ lumina vocab define-value finance income-types --val-key tithes --label-fr "Dîmes" --label-en "Tithes" --org a1b2c3d4
✓ Term value added.
  namespace: finance
  term_key: income-types
  val_key: tithes

$ lumina vocab resolve finance income-types tithes --lang fr
Dîmes

$ lumina vocab list-namespaces
finance
roles
forms
notifications
lifecycle
```

---

### lumina reports

Gère la génération et l'export de rapports financiers. Correspond aux opérations de **ReportingAggregate** (4 ops dans API-CONTRACT-001).

**Description :** Generate reports, calculate balances, and export data. Only synced-approved transactions participate (SYNCED-001).

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina reports generate <report-type> --period-start <d> --period-end <d> [--format csv|json|pdf]` | GenerateReport | Command | BAL-001, MONTH-001, SYNCED-001 |
| `lumina reports balance --scope <s> --period-start <d> --period-end <d>` | CalculateBalance | Query | BAL-001, MONTH-001 |
| `lumina reports export <report-id> [--format pdf|csv|json]` | ExportReport | Query | EXPORT-001 |
| `lumina reports list [--page <n>]` | (list generated report IDs) | Query | — |
| `lumina reports types` | GetReportTypes | Query | — |

#### Arguments

- `<report-type>` — Type de rapport (balance-sheet, income-statement, cash-flow)
- `--period-start <ISO-date>` / `--period-end <ISO-date>` — Période du rapport (doit couvrir 1er au dernier jour du mois pour monthly — MONTH-001)
- `--scope <enum>` — scope: org, unit, group
- `<report-id>` — ID du rapport généré à exporter
- `--format <enum>` — Format d'export: pdf, csv, json

#### Exemple

```bash
$ lumina reports balance --scope org --period-start 2026-07-01 --period-end 2026-07-31 --org a1b2c3d4
Balance Totals (July 2026)
  Total Assets:       2,500,000 CDF
  Total Liabilities:  1,200,000 CDF
  Net Result:         1,300,000 CDF
  Balanced:           YES
  Transactions:       45 synced

$ lumina reports generate balance-sheet --period-start 2026-07-01 --period-end 2026-07-31 --format json --org a1b2c3d4
✓ Report generated.
  report_id: r1234567-abcd-ef01-2345-6789abcdef01
  type: balance-sheet
  period: 2026-07-01 to 2026-07-31
  exported_at: 2026-07-25T10:30:00Z
```

---

### lumina audit

Lit et exporte les logs d'audit. Correspond aux opérations de **AuditAggregate** (3 ops dans API-CONTRACT-001).

**IMPORTANT:** This aggregate is READ-ONLY. LogAction is SYSTEM-ONLY. No modification or deletion is ever permitted (AUD-001 — constitutional rule).

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina audit list [--entity-type <t>] [--entity-id <id>] [--from <d>] [--to <d>] [--page <n>]` | QueryAuditLogs | Query | ACCESS-033 |
| `lumina audit export [--format csv|json] [--period <range>]` | ExportAuditTrail | Query | RETENTION-031 |

#### Arguments

- `--entity-type <string>` — Filtre par type d'entité (transaction, member, user, etc.)
- `--entity-id <uuid>` — Filtre par ID d'entité
- `--from <ISO-date>` / `--to <ISO-date>` — Plage de dates (min 7 ans de rétention — RETENTION-031)
- `<period>` — Plage de dates pour l'export (ex: "2020-01-01:2026-07-25")
- `--format <enum>` — csv ou json

#### Exemple

```bash
$ lumina audit list --org a1b2c3d4 --entity-type transaction --from 2026-07-01 --format table
┌──────────────────────┬─────────────┬───────────────────┬────────┐
│ timestamp            │ entity_type │ action            │ user   │
├──────────────────────┼─────────────┼───────────────────┼────────┤
│ 2026-07-25T08:15:00Z │ transaction │ CreateTransaction │ jmbala │
│ 2026-07-25T09:30:00Z │ transaction │ SubmitForApproval │ jmbala │
│ 2026-07-25T10:00:00Z │ transaction │ ApproveTransaction │ admin  │
└──────────────────────┴─────────────┴───────────────────┴────────┘
Page 1 of 1 (3 items)
```

---

### lumina archives

Gère le cycle de vie des ressources: archivage, corbeille, purge, restauration. Correspond aux opérations de **LifecycleAggregate** (8 ops dans API-CONTRACT-001).

**Description :** Archive, trash, restore, purge, and manage lifecycle states. Purge is irreversible (LIF-003). Trashed entries excluded from normal queries (LIF-006).

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina archives archive <resource-type> <resource-id> [--tags <list>]` | ArchiveResource | Command | LIF-001, LIF-003 |
| `lumina archives trash <archive-id>` | TrashResource | Command | LIF-003 |
| `lumina archives restore <archive-id>` | RestoreFromTrash | Command | LIF-003 |
| `lumina archives purge-schedule <archive-id> --purge-date <d>` | SchedulePurge | Command | LIF-005 |
| `lumina archives list [--state <s>] [--type <t>] [--tags <list>] [--page <n>]` | ListArchiveEntries | Query | LIF-006 |
| `lumina archives search <query> [--type <t>] [--tags <list>]` | SearchArchives | Query | — |

#### Arguments

- `<resource-type>` — Type de ressource à archiver (doit être dans manifest.lifecycle.types[])
- `<resource-id>` — UUID de la ressource
- `<archive-id>` — UUID de l'entrée d'archive
- `--tags <comma-separated>` — Tags à appliquer
- `--state <enum>` — Filtre: archived, trashed, purged
- `<query>` — Texte de recherche pour SearchArchives
- `--purge-date <ISO-date>` — Date de purge planifiée (LIF-005)

#### Note critique sur PurgeResource

La purge est gérée exclusivement par le système via cron. Il n'y a pas de commande CLI directe pour purger immédiatement — `lumina archives purge-schedule` programme la purge mais ne l'exécute pas.

#### Exemple

```bash
$ lumina archives archive transaction c3d4e5f6-... --tags "quarterly-closed" --org a1b2c3d4
✓ Resource archived.
  archive_id: ar123456-abcd-ef01-2345-6789abcdef01
  resource_type: transaction
  state: archived
  archived_at: 2026-07-25T10:30:00Z

$ lumina archives trash ar123456-... --org a1b2c3d4
✓ Resource trashed.
  archive_id: ar123456-...
  old_state: archived
  new_state: trashed
  trashed_at: 2026-07-25T10:35:00Z

$ lumina archives purge-schedule ar123456-... --purge-date 2027-01-01 --org a1b2c3d4
✓ Purge scheduled.
  archive_id: ar123456-...
  purge_date: 2027-01-01
  note: Purge will be executed by system scheduler after this date
```

---

### lumina settings

Lit et modifie les paramètres de configuration. Correspond aux opérations de **ConfigurationAggregate** (4 ops dans API-CONTRACT-001).

**Description :** Read and update organizational settings. Format validated against canonical schemas (CFG-001, CFG-002, CFG-003). Admin permission required.

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina settings update <key> --value <v>` | UpdateSetting | Command | CFG-001, CFG-002, CFG-003 |
| `lumina settings get <key>` | GetSetting | Query | CFG-004 |
| `lumina settings list` | GetAllSettings | Query | CFG-004 |
| `lumina settings reset` | ResetToDefaults | Command | CFG-004 |

#### Arguments

- `<key>` — Clé du paramètre (ex: currency, timezone, accent_color)
- `--value <string>` — Nouvelle valeur (format validé selon la clé)
- Pour `reset` : aucun argument nécessaire, Confirmation demandée

#### Valeurs et Formats Validés

| Clé | Format Attendu | Invariant | Exemple |
|-----|---------------|-----------|---------|
| currency | ISO 4217 (3 lettres) | CFG-001 | CDF, USD, EUR |
| timezone | IANA timezone | CFG-002 | Africa/Lubumbashi |
| accent_color | #RRGGBB + contraste WCAG | CFG-003 | #1A73E8 |

#### Exemple

```bash
$ lumina settings get currency --org a1b2c3d4
key: currency
value: CDF
description: Monnaie principale de l'organisation

$ lumina settings list --org a1b2c3d4 --format table
┌──────────────┬──────────────────────────┬──────────────────────────┐
│ key          │ value                    │ description              │
├──────────────┼──────────────────────────┼──────────────────────────┤
│ currency     │ CDF                      │ Main organization currency│
│ timezone     │ Africa/Lubumbashi        │ Display timezone         │
│ accent_color │ #1A73E8                  │ Brand accent color       │
└──────────────┴──────────────────────────┴──────────────────────────┘

$ lumina settings update timezone --value "Africa/Kinshasa" --org a1b2c3d4
✓ Setting updated.
  key: timezone
  old_value: Africa/Lubumbashi
  new_value: Africa/Kinshasa
```

---

### lumina sync

Gère la synchronisation hors-ligne: registration d'opérations, confirmation, vérification de statut. Correspond aux opérations de **OfflineSyncAggregate** (6 ops dans API-CONTRACT-001).

**Description :** Register, confirm, fail, and check offline sync operations. Local writes always precede remote sync (SYNC-001). Max batch size 50 (SYNC-002). User operations never blocked (SYNC-004).

#### Commands

| CLI Syntax | Canonical Operation | Type | Invariants |
|------------|-------------------|------|------------|
| `lumina sync register-op <entity-type> <entity-id> <action> --payload <json>` | (register local op) | Command | SYNC-001 |
| `lumina sync confirm-op <op-id>` | MarkOperationConfirmed | Command | — |
| `lumina sync fail-op <op-id> --reason <text>` | (mark op as permanently failed) | Command | SYNC-003 |
| `lumina sync status [--table <t>]` | GetSyncStatus | Query | — |
| `lumina sync list-pending [--page <n>]` | (pending operations query) | Query | SYNC-002 |
| `lumina sync connectivity` | CheckConnectivity | Query | SYNC-004 |

#### Arguments

- `<entity-type>` — Type d'entité modifiée (transaction, member, etc.)
- `<entity-id>` — UUID de l'entité
- `<action>` — create, update, delete
- `--payload <json>` — Payload JSON de l'opération (max 50 ops par batch — SYNC-002)
- `<op-id>` — UUID de l'opération en attente
- `--table <string>` — Nom de la table pour GetSyncStatus
- `--reason <text>` — Motif de défaillance permanente

#### Exemple

```bash
$ lumina sync register-op transaction c3d4e5f6-... create '{"amount_cents":50000,"type":"income"}' --org a1b2c3d4
✓ Operation registered locally.
  op_id: so123456-abcd-ef01-2345-6789abcdef01
  entity_type: transaction
  action: create
  sync_status: pending
  pushed: false

$ lumina sync status --org a1b2c3d4
Sync Status
  overall: connected
  pending_ops: 3
  confirmed_today: 12
  last_push: 2026-07-25T09:00:00Z
  last_pull: 2026-07-25T09:05:00Z

$ lumina sync connectivity
Connectivity: online
  last_check: 2026-07-25T10:30:00Z
  remote_available: true
```

---

## 3. FORMAT DE SORTIE

### 3.1 Format JSON

La sortie JSON est toujours un objet sérialisé contenant les champs suivants :

**Réponse de Succès (Query) :**
```json
{
  "success": true,
  "data": { ... },
  "count": 42,
  "version": "v1.0",
  "sync_status": "synced"
}
```

**Réponse de Succès (Command) :**
```json
{
  "success": true,
  "version": 1,
  "created_at": "2026-07-25T10:30:00Z",
  "events_emitted": ["ResourceCreated"],
  "version": "v1.0",
  "sync_status": "pending"
}
```

**Erreur (toujours JSON, envoyé vers stderr) :**
```json
{
  "error_code": "E-422-001-FIN-001",
  "message": "Transaction cannot be modified: it is approved.",
  "details": {
    "transaction_id": "c3d4e5f6-...",
    "current_status": "approved",
    "hint": "Use CompensateTransaction instead."
  },
  "request_id": "550e8400-e29b-41d4-a716-446655440000"
}
```

Règles JSON :
- Toujours pretty-printé (indentation 2 espaces)
- Les champs `data`, `error` sont toujours présents (null si absent)
- Les champs sensibles (password_hash, refresh_token_hash) contiennent toujours `"***"`
- La structure JSON suit exactement le Response Contract de **API-CONTRACT-002** Section 2.2

### 3.2 Format Table

Le format table utilise des bordures ASCII pour afficher les données tabulaires :

```
┌──────────────────────┬───────────┬────────────┬──────────┐
│ Column Header 1      │ Col 2     │ Col 3      │ Col 4    │
├──────────────────────┼───────────┼────────────┼──────────┤
│ Row 1 Value          │ Value 2   │ Very long  │ Value 4  │
│                    ... │           │ value that │          │
│                      │           │ gets       │          │
│                      │           │ truncated  │          │
└──────────────────────┴───────────┴────────────┴──────────┘
Page 1 of 3 (45 items)
```

Règles Table :
- En-têtes de colonnes issus des noms de champs de l'entité
- Colonnes auto-ajustées selon le contenu
- Valeurs longues tronquées avec suffixe `...`
- Pagination affichée en footer : "Page N of M (K items)"
- Colonnes alignées à gauche pour les strings, à droite pour les nombres

### 3.3 Format Text

Le format text affiche les données en paires clé-valeur simples :

```
Resource Type: transaction
  id:              c3d4e5f6-a7b8-9012-cdef-123456789012
  amount_cents:    50000
  type:            income
  category_ref:    finance:income:tithes
  status:          approved
  version:         3
  created_by:      jmbala
  created_at:      2026-07-25T08:15:00Z
  approved_by:     admin
  approved_at:     2026-07-25T10:00:00Z

Items:
  1. Transaction #c3d4e5f6 - 50,000 CDF (income)
  2. Transaction #d4e5f6a7 - 12,500 CDF (expense)
  3. Transaction #e5f6a7b8 - 3,000 CDF (transfer)
```

Règles Text :
- Paires clé-valeur simples, une par ligne
- Objets imbriqués affichés indentés (2 espaces par niveau)
- Listes affichées comme éléments numérotés
- Aucune mise en forme de table

---

## 4. GESTION D'ERREURS ET CODES DE SORTIE

### 4.1 Mapping des Codes d'Erreur Canonique vers Exit Codes

| Error Canonique | Prefix Error | Exit Code | Stderr Output | Retryable? |
|-----------------|-------------|-----------|---------------|------------|
| E-400-NNN | BAD_REQUEST | 1 | "Error [E-400-NNN]: <message>" | Non (fixer input) |
| E-401-NNN | UNAUTHORIZED | 1 | "Authentication required: run `lumina auth login`" | Oui |
| E-403-NNN | FORBIDDEN | 2 | "Permission denied: <message>" | Non |
| E-404-NNN | NOT_FOUND | 1 | "Not found: <entity> with id <id>" | Non |
| E-409-NNN | CONFLICT | 3 | "Conflict: <message>" | Selon cas |
| E-422-NNN | DOMAIN_VIOLATION | 1 | "Business rule violation: <message>" | Non |
| E-500-NNN | INTERNAL_ERROR | 3 | "Internal error. Request ID: <request_id>" | Oui |

### 4.2 Messages d'Erreur Spécifiques par Catégorie

#### E-400 (Bad Request)
Format stderr :
```
Error [E-400-001]: Invalid input: field 'amount_cents' is required
  Request ID: 550e8400-e29b-41d4-a716-446655440000
  Fix: Provide a positive integer value for amount_cents
```

#### E-401 (Unauthorized)
Format stderr :
```
Error [E-401-001]: Authentication required. Run `lumina auth login` to authenticate.
  Request ID: 550e8400-e29b-41d4-a716-446655440000
```

Remplacement de retry suggestions :
- Pour E-401-001 : "Run `lumina auth login` to authenticate."
- Pour E-401-002 : "Session expired. Run `lumina auth refresh` to refresh your session."
- Pour E-401-003 : "Invalid credentials. Check your email and password, then run `lumina auth login`."

#### E-403 (Forbidden)
Format stderr :
```
Error [E-403-001]: Permission denied: you do not have the required role for this operation.
  Request ID: 550e8400-e29b-41d4-a716-446655440000
```

#### E-404 (Not Found)
Format stderr :
```
Error [E-404-001]: Not found: entity 'transaction' with id 'c3d4e5f6-...'
  Request ID: 550e8400-e29b-41d4-a716-446655440000
```

#### E-409 (Conflict)
Format stderr :
```
Error [E-409-001]: Conflict: version mismatch. Expected version 3, got version 2.
  Request ID: 550e8400-e29b-41d4-a716-446655440000
  Fix: Retry after resolving the conflict. Use --retry flag.
```

Remplacement de retry suggestions :
- Pour E-409-001 : "Retry after resolving the conflict. Use --retry flag."
- Pour E-409-002 : "Unique constraint violated. Use a different value."
- Pour E-409-003 : "State transition not allowed from current state. Check valid transitions."

#### E-422 (Domain Violation)
Format stderr :
```
Error [E-422-001-FIN-001]: Business rule violation: Approved transactions are immutable. Use CompensateTransaction instead.
  Details: transaction_id=c3d4e5f6-..., current_status=approved
  Invariant: FIN-001
  Request ID: 550e8400-e29b-41d4-a716-446655440000
```

L'invariant violé est toujours inclus dans le champ details.

#### E-500 (Internal Error)
Format stderr :
```
Error [E-500-001]: Internal error. Request ID: 550e8400-e29b-41d4-a716-446655440000
  Contact support with the request ID above.
```

Remplacement de retry suggestions :
- Pour E-500-001/E-500-002/E-500-003 : "Contact support with request ID provided."
- Pour E-500-004 : "Dependency failure: downstream service unavailable. Retrying..."

### 4.3 Erreurs de Configuration Spécifiques au CLI

| Situation | Exit Code | Message stderr |
|-----------|-----------|---------------|
| `LUMINA_TOKEN` non défini et `--token` non fourni | 4 | "No authentication token found. Set LUMINA_TOKEN env var or use --token flag." |
| Token format invalide | 4 | "Invalid token format. Tokens must be valid JWT strings." |
| `--org` manquant pour operation requiring org_id | 4 | "Organization scope required. Use --org <uuid>." |
| Argument positionnel manquant | 1 | "Missing required argument: <arg-name>. Run `lumina <subcommand> --help` for usage." |

### 4.4 Structure Complète d'un Message d'Erreur CLI

Tout message d'erreur CLI contient TOUJOURS :

```
Error [<ERROR_CODE>]: <human_message>
  Request ID: <uuid>
  Fix: <suggestion or "N/A">
  Invariant: <INV-XXX if applicable>
```

Le champ `Fix` fournit toujours une suggestion d'action corrective quand elle est disponible.

---

## 5. STRUCTURE DU HELP SUBCOMMAND

Chaque commande `lumina {aggregate} {action} --help` affiche exactement :

```
NAME
    lumina {aggregate} {action} — <brief description>

USAGE
    lumina {aggregate} {action} <required-args> [options]

DESCRIPTION
    <detailed description referencing the canonical operation>

ARGUMENTS
    <arg-name>    <type>    <description>
    ...

FLAGS
    --format json|table|text    Output format (default: table)
    --org <uuid>                Organization scope (required for all operations)
    --token <string>            Authentication token (overrides LUMINA_TOKEN env var)
    --help                      Show this help message

EXAMPLES
    $ lumina {aggregate} {action} <example-args>
    <expected output>

TRACEABILITY
    Operation: {OPERATION_ID}
    Canonical Source: API-CONTRACT-001 § {aggregate-section}
    Invariants Checked: {INV-XXX list or "None"}
```

### Exemple Complet de Help

```
$ lumina resource transactions approve --help

NAME
    lumina resource transactions approve — Approve a pending transaction

USAGE
    lumina resource transactions approve <transaction-id> [options]

DESCRIPTION
    Approves a transaction that is currently in 'pending' status, transitioning
    it to 'approved'. The approver must have the appropriate permission grant.
    Once approved, the transaction becomes immutable (FIN-001 invariant).

ARGUMENTS
    transaction-id    string    UUID of the transaction to approve

FLAGS
    --comment <text>    Approval comment (optional)
    --format json|table|text    Output format (default: table)
    --org <uuid>                Organization scope (required)
    --token <string>            Authentication token
    --help                      Show this help message

EXAMPLES
    $ lumina resource transactions approve c3d4e5f6-... --org a1b2c3d4
    ✓ Transaction approved successfully.
      transaction_id: c3d4e5f6-...
      status: approved
      approved_by: jmbala
      approved_at: 2026-07-25T10:00:00Z

TRACEABILITY
    Operation: ApproveTransaction
    Canonical Source: API-CONTRACT-001 § ResourceAggregate
    Invariants Checked: BR-RES-001
    Domain Events: ResourceStateChanged, ApprovalGranted
```

---

## 6. EXEMPLES DE SORTIE UNIFIES

Montrons les MÊMES données dans les trois formats pour illustrer la cohérence.

### Données source (équivalentes au Canonical Response pour SearchResources)

```json
{
  "success": true,
  "data": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "amount_cents": 50000,
      "type": "income",
      "category_ref": "finance:income:tithes",
      "status": "approved",
      "version": 2,
      "transaction_date": "2026-07-25",
      "created_by": "jmbala"
    },
    {
      "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "amount_cents": 12500,
      "type": "expense",
      "category_ref": "finance:expense:operations",
      "status": "pending",
      "version": 1,
      "transaction_date": "2026-07-25",
      "created_by": "kbanyeki"
    }
  ],
  "count": 2
}
```

### Sortie JSON

```bash
$ lumina resource transactions list --org a1b2c3d4 --format json
{
  "success": true,
  "data": [
    {
      "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
      "amount_cents": 50000,
      "type": "income",
      "category_ref": "finance:income:tithes",
      "status": "approved",
      "version": 2,
      "transaction_date": "2026-07-25",
      "created_by": "jmbala"
    },
    {
      "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "amount_cents": 12500,
      "type": "expense",
      "category_ref": "finance:expense:operations",
      "status": "pending",
      "version": 1,
      "transaction_date": "2026-07-25",
      "created_by": "kbanyeki"
    }
  ],
  "count": 2,
  "version": "v1.0",
  "sync_status": "synced"
}
```

### Sortie Table

```bash
$ lumina resource transactions list --org a1b2c3d4 --format table
┌──────────────────────────────┬───────────┬────────────┬───────────┬──────────┐
│ id                           │ type      │ amount     │ category  │ status   │
├──────────────────────────────┼───────────┼────────────┼───────────┼──────────┤
│ c3d4e5f6-a7b8-9012-cdef-... │ income    │ 50,000     │ tithes    │ approved │
│ d4e5f6a7-b8c9-0123-defa-... │ expense   │ 12,500     │ operations│ pending  │
└──────────────────────────────┴───────────┴────────────┴───────────┴──────────┘
Page 1 of 1 (2 items)
```

### Sortie Text

```bash
$ lumina resource transactions list --org a1b2c3d4 --format text
Transaction 1:
  id:              c3d4e5f6-a7b8-9012-cdef-123456789012
  amount_cents:    50000
  type:            income
  category_ref:    finance:income:tithes
  status:          approved
  version:         2
  transaction_date: 2026-07-25
  created_by:      jmbala

Transaction 2:
  id:              d4e5f6a7-b8c9-0123-defa-234567890123
  amount_cents:    12500
  type:            expense
  category_ref:    finance:expense:operations
  status:          pending
  version:         1
  transaction_date: 2026-07-25
  created_by:      kbanyeki

Total: 2 items
```

### Vérification des Règles de Masquage de Données Sensibles

```bash
$ lumina users show b2c3d4e5-... --format json
{
  "success": true,
  "data": {
    "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
    "email": "pastor@example.cd",
    "role": "pastor",
    "password_hash": "***",
    "refresh_token_hash": "***"
  }
}
```

Les champs `password_hash` et `refresh_token_hash` sont toujours masqués, quel que soit le format.

---

## 7. MATRICE DE TRACABILITE

Chaque section de PROTO-005 est tracable vers les documents sources canoniques :

| Section PROTO-005 | Document Source | Reference Exacte |
|-------------------|----------------|-----------------|
| Header / Principes | PROTO-001 §1 | Pipeline canonique, principes fondamentaux |
| P-CLI-001 | API-CONTRACT-001 | 83 operations, 13 Aggregates |
| P-CLI-002 | DOC-014 | Registry des commandes et events |
| P-CLI-003 | API-CONTRACT-002 §2.2 | Response Contracts |
| P-CLI-004 | PROTO-001 §5.2.4 | CLI exit code mapping |
| P-CLI-005 | PROTO-001 §7.5 | Separation of concerns |
| P-CLI-006 | API-CONTRACT-002 §2.1 | Auth context (actorId, orgId) |
| P-CLI-007 | API-CONTRACT-002 §2.4 | Pagination contract |
| P-CLI-008 | DOC-014 | Command registry |
| §2 org | API-CONTRACT-001 §OrganizationAggregate | 10 operations (8 cmds + 2 queries) |
| §2 users | API-CONTRACT-001 §IdentityAggregate | 9 operations (9 cmds) |
| §2 resource transactions | API-CONTRACT-001 §ResourceAggregate | 6 transaction operations |
| §2 resource members | API-CONTRACT-001 §ResourceAggregate | 3 member operations |
| §2 resource events | API-CONTRACT-001 §ResourceAggregate | implied by SearchResources |
| §2 resource categories | API-CONTRACT-001 §ResourceAggregate | CAT-001 invariant |
| §2 groups | API-CONTRACT-001 §RelationshipAggregate | 6 operations |
| §2 workflows | API-CONTRACT-001 §WorkflowAggregate | 6 operations |
| §2 forms | API-CONTRACT-001 §FormAggregate | 4 operations |
| §2 notifications | API-CONTRACT-001 §NotificationAggregate | 6 operations |
| §2 vocab | API-CONTRACT-001 §VocabularyAggregate | 7 operations |
| §2 reports | API-CONTRACT-001 §ReportingAggregate | 4 operations |
| §2 audit | API-CONTRACT-001 §AuditAggregate | 3 operations (READ ONLY) |
| §2 archives | API-CONTRACT-001 §LifecycleAggregate | 8 operations |
| §2 settings | API-CONTRACT-001 §ConfigurationAggregate | 4 operations |
| §2 sync | API-CONTRACT-001 §OfflineSyncAggregate | 6 operations |
| §3 JSON format | API-CONTRACT-002 §2.2/2.4 | Response & pagination contracts |
| §3 Table format | API-CONTRACT-002 §2.4 | Pagination contract |
| §3 Text format | PROTO-001 §5.2.4 | Human-readable output |
| §4 Error mapping | API-CONTRACT-005 | Full error taxonomy (E-400 through E-500) |
| §4 Exit codes | PROTO-001 §5.2.4 | CLI exit code mapping |
| §4 Retry suggestions | API-CONTRACT-005 | Error resolution guidance |
| §5 Help structure | PROTO-001 §9.1 | Adapter template requirements |
| §5 Traceability footer | DOC-014 | Command/event registry |
| §6 Unified examples | API-CONTRACT-001 | All 83 operations |
| §7 Traceability matrix | PROTO-001 §10.1 | Cross-reference complete |

### Couverture des 83 Operations

Les 13 Aggregates de PROTO-005 couvrent les 83 opérations canoniques d'API-CONTRACT-001 :

| Aggregate | Commands (adaptateur CLI) | Queries (adaptateur CLI) | Total CLI Endpoints |
|-----------|--------------------------|-------------------------|--------------------|
| OrganizationAggregate | 8 | 2 | 10 |
| IdentityAggregate | 9 | 2 | 11 |
| ResourceAggregate (transactions) | 6 | 3 | 9 |
| ResourceAggregate (members) | 3 | 2 | 5 |
| ResourceAggregate (events) | 0 | 2 | 2 |
| ResourceAggregate (categories) | 0 | 2 | 2 |
| RelationshipAggregate | 3 | 3 | 6 |
| WorkflowAggregate | 5 | 1 | 6 |
| FormAggregate | 1 | 3 | 4 |
| NotificationAggregate | 4 | 2 | 6 |
| VocabularyAggregate | 2 | 5 | 7 |
| ReportingAggregate | 1 | 3 | 4 |
| AuditAggregate | 1 | 2 | 3 |
| LifecycleAggregate | 4 | 2 | 6 |
| ConfigurationAggregate | 2 | 2 | 4 |
| OfflineSyncAggregate | 3 | 3 | 6 |
| **TOTAL** | **57** | **26** (plus extensions CLI) | **83+** |

Chaque operation CLI mappe vers exactement une operation canonique de **API-CONTRACT-001**, qui elle-même refere **DOC-014** pour les preconditions et postconditions. Aucune operation n'est inventee.

---

**FIN DU DOCUMENT PROTO-005**

---

## ANNEXE A: Tableau de Correspondance CLI Syntax → Canonical Operation

Tableau complet de toutes les commandes CLI definies ci-dessus avec leur operationId canonique correspondant.

| CLI Command | Canonical Operation | Aggregate | Command Type | Required Org Scope |
|------------|-------------------|-----------|-------------|-------------------|
| `lumina org create` | CreateOrganization | Organization | Command | No (creates new) |
| `lumina org update-settings` | UpdateOrganizationSettings | Organization | Command | Yes |
| `lumina org create-unit` | CreateOrgUnit | Organization | Command | Yes |
| `lumina org reparent` | UpdateOrgUnitParent | Organization | Command | Yes |
| `lumina org transfer` | TransferChildOrg | Organization | Command | Yes |
| `lumina org merge` | MergeOrganizations | Organization | Command | Yes |
| `lumina org archive` | ArchiveOrganization | Organization | Command | Yes |
| `lumina org suspend` | SuspendOrganization | Organization | Command | Yes |
| `lumina org show` | GetOrganizationProfile | Organization | Query | Yes |
| `lumina org descendants` | GetDescendantUnits | Organization | Query | Yes |
| `lumina users create` | CreateUser | Identity | Command | Yes |
| `lumina users update-profile` | UpdateUserProfile | Identity | Command | Yes |
| `lumina users change-role` | ChangeUserRole | Identity | Command | Yes |
| `lumina users reset-password` | ResetPassword | Identity | Command | Yes |
| `lumina auth login` | LoginUser | Identity | Command | No |
| `lumina auth logout` | LogoutUser | Identity | Command | Yes |
| `lumina auth refresh` | RefreshAccessToken | Identity | Command | No |
| `lumina auth revoke-session` | RevokeSession | Identity | Command | Yes |
| `lumina users list` | SearchResources (pattern) | Identity | Query | Yes |
| `lumina users show` | SearchResources (pattern) | Identity | Query | Yes |
| `lumina resource transactions create` | CreateTransaction | Resource | Command | Yes |
| `lumina resource transactions update-draft` | UpdateDraftTransaction | Resource | Command | Yes |
| `lumina resource transactions submit-for-approval` | SubmitForApproval | Resource | Command | Yes |
| `lumina resource transactions approve` | ApproveTransaction | Resource | Command | Yes |
| `lumina resource transactions reject` | RejectTransaction | Resource | Command | Yes |
| `lumina resource transactions compensate` | CompensateTransaction | Resource | Command | Yes |
| `lumina resource transactions list` | SearchResources | Resource | Query | Yes |
| `lumina resource transactions show` | SearchResources (pattern) | Resource | Query | Yes |
| `lumina resource transactions export` | ExportResources | Resource | Query | Yes |
| `lumina resource members create` | CreateMember | Resource | Command | Yes |
| `lumina resource members update` | UpdateMember | Resource | Command | Yes |
| `lumina resource members transition-status` | TransitionMemberStatus | Resource | Command | Yes |
| `lumina resource members list` | SearchResources | Resource | Query | Yes |
| `lumina resource members show` | SearchResources (pattern) | Resource | Query | Yes |
| `lumina resource events list` | SearchResources | Resource | Query | Yes |
| `lumina resource categories list` | SearchResources (pattern) | Resource | Query | Yes |
| `lumina groups add-member` | AddMemberToGroup | Relationship | Command | Yes |
| `lumina groups remove-member` | RemoveMemberFromGroup | Relationship | Command | Yes |
| `lumina groups list` | GetAllGroupsForMember | Relationship | Query | Yes |
| `lumina groups show` | GetAllMembersOfGroup | Relationship | Query | Yes |
| `lumina hierarchy link` | SetOrgUnitParent | Relationship | Command | Yes |
| `lumina hierarchy descendants` | GetDescendants | Relationship | Query | Yes |
| `lumina workflows start` | TriggerWorkflow | Workflow | Command | Yes |
| `lumina workflows approve` | ApproveStep | Workflow | Command | Yes |
| `lumina workflows reject` | RejectStep | Workflow | Command | Yes |
| `lumina workflows cancel` | CancelWorkflow | Workflow | Command | Yes |
| `lumina workflows resubmit` | ResubmitForApproval | Workflow | Command | Yes |
| `lumina workflows list` | GetPendingApprovals | Workflow | Query | Yes |
| `lumina forms load` | LoadFormDefinition | Form | Query | Yes |
| `lumina forms render` | RenderForm | Form | Query | Yes |
| `lumina forms validate` | ValidateFormData | Form | Command | Yes |
| `lumina forms visible-fields` | GetVisibleFields | Form | Query | Yes |
| `lumina forms list` | (manifest query) | Form | Query | Yes |
| `lumina notifications send` | SendNotification | Notification | Command | Yes |
| `lumina notifications mark-read` | MarkAsRead | Notification | Command | Yes |
| `lumina notifications preferences set` | UpdatePreferences | Notification | Command | Yes |
| `lumina notifications rate-limit set` | SetRateLimit | Notification | Command | Yes |
| `lumina notifications suppress` | SuppressUntil | Notification | Command | Yes |
| `lumina notifications list` | (notification query) | Notification | Query | Yes |
| `lumina vocab define-namespace` | (create namespace) | Vocabulary | Command | Yes |
| `lumina vocab define-term` | (add term) | Vocabulary | Command | Yes |
| `lumina vocab define-value` | AddTermValue | Vocabulary | Command | Yes |
| `lumina vocab deprecate` | DeprecateTermValue | Vocabulary | Command | Yes |
| `lumina vocab resolve` | ResolveLabel | Vocabulary | Query | Yes |
| `lumina vocab list-terms` | GetTerms | Vocabulary | Query | Yes |
| `lumina vocab list-values` | GetTermValues | Vocabulary | Query | Yes |
| `lumina vocab search` | SearchTerms | Vocabulary | Query | Yes |
| `lumina vocab list-namespaces` | GetAllNamespaces | Vocabulary | Query | No |
| `lumina reports generate` | GenerateReport | Reporting | Command | Yes |
| `lumina reports balance` | CalculateBalance | Reporting | Query | Yes |
| `lumina reports export` | ExportReport | Reporting | Query | Yes |
| `lumina reports list` | (report query) | Reporting | Query | Yes |
| `lumina reports types` | GetReportTypes | Reporting | Query | Yes |
| `lumina audit list` | QueryAuditLogs | Audit | Query | Yes |
| `lumina audit export` | ExportAuditTrail | Audit | Query | Yes |
| `lumina archives archive` | ArchiveResource | Lifecycle | Command | Yes |
| `lumina archives trash` | TrashResource | Lifecycle | Command | Yes |
| `lumina archives restore` | RestoreFromTrash | Lifecycle | Command | Yes |
| `lumina archives purge-schedule` | SchedulePurge | Lifecycle | Command | Yes |
| `lumina archives list` | ListArchiveEntries | Lifecycle | Query | Yes |
| `lumina archives search` | SearchArchives | Lifecycle | Query | Yes |
| `lumina settings update` | UpdateSetting | Configuration | Command | Yes |
| `lumina settings get` | GetSetting | Configuration | Query | Yes |
| `lumina settings list` | GetAllSettings | Configuration | Query | Yes |
| `lumina settings reset` | ResetToDefaults | Configuration | Command | Yes |
| `lumina sync register-op` | (local op registration) | OfflineSync | Command | Yes |
| `lumina sync confirm-op` | MarkOperationConfirmed | OfflineSync | Command | Yes |
| `lumina sync fail-op` | (mark failed) | OfflineSync | Command | Yes |
| `lumina sync status` | GetSyncStatus | OfflineSync | Query | Yes |
| `lumina sync list-pending` | (pending ops query) | OfflineSync | Query | Yes |
| `lumina sync connectivity` | CheckConnectivity | OfflineSync | Query | Yes |

---

**FIN DU DOCUMENT PROTO-005**

---

## ANNEXE B: Regle de Non-Invention

Aucune operation CLI n'est inventee dans ce document. Chaque sous-commande definit dans la Section 2 mappe vers exactement une operation canonique listee dans API-CONTRACT-001. Si une operation n'est pas listee dans API-CONTRACT-001, elle n'existe pas et ne doit pas etre implementee dans l'adapter CLI.

Cette regle decoule directement de la regle A-001 (Integrite Canonique) de PROTO-001 : un adapter ne peut ni ajouter ni retirer de donnees metier, et les operations CLI doivent refleter integralement le contrat API canonique.

---

## ANNEXE C: Flag Universels Partages par Toutes les Commandes

Toutes les sous-commandes CLI partagent ces flags universels :

| Flag | Type | Requis | Description |
|------|------|--------|-------------|
| `--format json|table|text` | enum | Non | Format de sortie (default: table) |
| `--org <uuid>` | uuid | Oui (sauf login/create-org) | Scope d'organisation |
| `--token <string>` | string | Non | Jeton d'authentification (surcharge LUMINA_TOKEN) |
| `--help` | boolean | Non | Affiche l'aide de la sous-commande |
| `--retry` | boolean | Non | Force la reessaye pour les erreurs E-409 |

Flag universels d'erreur (toujours presentes dans les messages stderr) :

| Champ | Type | Description |
|-------|------|-------------|
| `error_code` | string | Code canonique (ex: E-400-001) |
| `message` | string | Description humaine de l'erreur |
| `request_id` | uuid | ID de correlation pour le tracing |
| `fix` | string | Suggestion corrective ou "N/A" |

---

**FIN DU DOCUMENT PROTO-005**
