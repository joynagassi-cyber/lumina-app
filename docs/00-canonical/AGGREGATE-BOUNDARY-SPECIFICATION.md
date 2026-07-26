# Aggregate Boundary Specification — Frontières Officielles

**Doc ID:** DOC-013 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — BORDURES IMMUABLES  
**Date:** 2026-07-24  

---

## PRINCIPE

Chaque Aggregate a UNE frontière stricte. Ce qui est à l'intérieur appartient exclusivement à cet Aggregate. Ce qui est à l'extérieur doit passer par SON INTERFACE PUBLIQUE.

Règle DDD fondamentale: **un Aggregate ne peut être modifié que par son boundary. Aucune autre couche ne peut modifier son état interne directement.**

---

## BOUNDARY 1: OrganizationAggregate

```
┌─────────────────────────────────────────────┐
│         OrganizationAggregate BOUNDARY       │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Organization profile (name, type, status) │
│  - OrgUnit hierarchy tree (DAG ≤5 depth)    │
│  - Settings (currency, timezone, accent)     │
│  - Manifest configuration                    │
│  - Feature toggles                           │
│                                              │
│  Protège:                                    │
│  - org_id isolation (données jamais mixées)   │
│  - DAG hierarchy integrity (no cycles)       │
│  - Depth limit enforcement (max 5)           │
│  - Settings format validation                │
│                                              │
│  Expose:                                     │
│  - GetOrganizationProfile()                  │
│  - CreateOrgUnit(name, parent, unitType)     │
│  - UpdateSettings(key, value)                │
│  - GetDescendantUnits(rootId)                │
│  - TransferChildOrg(childId, newParentId)   │
│  - MergeOrganizations(sourceId, targetId)   │
│  - ArchiveOrganization()                     │
│                                              │
│  Interdit:                                   │
│  - Créer/modifier Users (→ IdentityAggregate)│
│  - Créer/modifier Transactions (→ Resource)  │
│  - Exécuter Workflows (→ WorkflowAggregate)  │
│  - Connaître la structure SQL                │
│  - Accéder aux données d'une autre org       │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: aucune organisation structurée,  │
│  aucune hiérarchie DAG, aucun isolement      │
│  multi-tenant.                              │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-004 (isolement multi-tenant) serait     │
│  impossible à garantir.                     │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  Uniquement la structure organisationnelle   │
│  et les paramètres globaux de l'org.         │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 2: IdentityAggregate

```
┌─────────────────────────────────────────────┐
│            IdentityAggregate BOUNDARY        │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - User profiles (first/last name, email)    │
│  - Credentials (password_hash only)          │
│  - Role assignments                          │
│  - Sessions (refresh_token hash + expires)   │
│                                              │
│  Protège:                                   │
│  - Password never stored plain               │
│  - JWT never exposed to JS                   │
│  - Email unique per org                      │
│  - Role inheritance (child inherits parent)  │
│  - Session expiration and revocation         │
│                                              │
│  Expose:                                     │
│  - CreateUser(email, password_hash, role)   │
│  - UpdateUserProfile(updates)                │
│  - ChangeUserRole(newRole)                   │
│  - VerifyLogin(email, password)              │
│  - CreateSession(refreshTokenHash)          │
│  - RevokeSession(sessionId)                 │
│  - ResolvePermissions(roleId)                │
│  - ResetPassword(newPassword_hash)          │
│                                              │
│  Interdit:                                  │
│  - Modifier resources (→ ResourceAggregate)  │
│  - Lire data d'autres orgs (→ org_id gate) │
│  - Stocker JWT en clair                      │
│  - Exposer password_hash dans réponses       │
│  - Décider du comportement métier            │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: aucune identité vérifiable,       │
│  aucune session sécurisée, aucun RBAC.      │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-008 (validation double) impossible      │
│  sans credentials. INV-004 (org isolation)   │
│  impossible sans userId injection.           │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  L'identité et l'authentification.           │
│  Le reste n'est pas son problème.            │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 3: ResourceAggregate

```
┌─────────────────────────────────────────────┐
│           ResourceAggregate BOUNDARY         │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Transactions (income/expense/transfer)    │
│  - Members (profiles with status)            │
│  - Events (calendar items)                   │
│  - Archive entries (lifecycle stateful)      │
│                                              │
│  Protège:                                   │
│  - Amount always positive BIGINT cents       │
│  - Approved transactions immutable           │
│  - Version increment on every change         │
│  - Scope type org/group enforced             │
│  - Category from vocabulary only             │
│  - Created_by always set                     │
│                                              │
│  Expose:                                     │
│  - CreateTransaction(data)                   │
│  - UpdateDraftTransaction(id, updates)      │
│  - SubmitForApproval(id)                    │
│  - ApproveTransaction(id, approver)         │
│  - RejectTransaction(id, reason)            │
│  - CompensateTransaction(approvedTxId)      │
│  - CreateMember(data)                       │
│  - UpdateMember(id, updates)                │
│  - TransitionMemberStatus(id, newStatus)    │
│  - SearchResources(filters)                 │
│  - ExportResources(format, filters)         │
│                                              │
│  Interdit:                                   │
│  - Créer nouveaux concepts (→ Conceptual Model)│
│  - Modifier approved transactions directly  │
│  - Store amounts as float                    │
│  - Bypass vocabulary for categories         │
│  - Skip version increment                   │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: rien n'est manipulable. Les      │
│  transactions, membres et événements sont    │
│  des données mortes sans ce behaviour.       │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-001 (immutabilité financière) impossible│
│  sans controle strict sur les transitions.   │
│  INV-010 (versioning) impossible sans        │
│  controle sur chaque modification.           │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  La manipulation de TOUS les objects        │
│  manipulables: CRUD, validation, transition  │
│  d'état, recherche, export.                  │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 4: RelationshipAggregate

```
┌─────────────────────────────────────────────┐
|         RelationshipAggregate BOUNDARY       │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Group memberships (member ↔ org_unit)     │
│  - Org unit parent links (DAG edges)        │
│                                              │
│  Protège:                                   │
│  - No cycles in org hierarchy               │
│  - Max depth 5 at domain level              │
│  - No duplicate memberships (PK enforce)     │
│  - Membership bidirectional visibility       │
│                                              │
│  Expose:                                     │
│  - AddMemberToGroup(memberId, groupId)     │
│  - RemoveMemberFromGroup(memberId, groupId)│
│  - SetOrgUnitParent(unitId, parentId)       │
│  - GetDescendants(unitId)                   │
│  - GetAllGroupsForMember(memberId)         │
│  - GetAllMembersOfGroup(groupId)           │
│  - DetectCycles(candidateEdges)             │
│                                              │
│  Interdit:                                  │
│  - Contain any business logic              │
│  - Know what the linked entities represent │
│  - Modify entity state directly            │
│  - Create or delete entities               │
│  - Traverse > 5 levels deep                │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: pas de hiérarchie, pas            │
│  d'appartenances multiples, pas de DAG.     │
│  Lumina ne serait qu'un tas de données       │
│  isolées sans connexions.                    │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-004 (isolement multi-tenant) cassé si   │
│  les memberships ne filtrent pas par org_id. │
│  Pas de règle sur la profondeur = hiérarchie │
│  infinie = performances détruites.           │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  UNIQUEMENT les connexions entre entités.    │
│  Pas de business logic, pas de CRUD.         │
│  Juste des liens.                            │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 5: WorkflowAggregate

```
┌─────────────────────────────────────────────┐
|          WorkflowAggregate BOUNDARY          │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Workflow definitions (YAML templates)     │
│  - Workflow instances (runtime execution)    │
│  - Steps within an instance                  │
│                                              │
│  Protège:                                   │
│  - Timeout max 30 days                       │
│  - Approval chain max 5 levels               │
│  - Financial workflows NEVER modify approved │
│  - Failed workflows require manual restart   │
│  - All steps logged to audit trail           │
│                                              │
│  Expose:                                     │
│  - TriggerWorkflow(definition, resource)    │
│  - ApproveStep(instanceId, userId)         │
│  - RejectStep(instanceId, userId, reason) │
│  - CancelWorkflow(instanceId, reason)      │
│  - EscalateStep(instanceId, timeoutAction) │
│  - GetPendingApprovals(userId)             │
│  - MarkStepCompleted(instanceId, stepId)  │
│                                              │
│  Interdit:                                  │
│  - Modify financial data directly          │
│  - Create new capabilities                 │
│  - Add to manifest                         │
│  - Exceed max steps without native cap     │
│  - Auto-retry failed workflows             │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: aucune séquence automatisée.      │
│  Approbations, notifications, transitions    │
│  d'état nécessiteraient code dur.           │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-001 (approved transactions immuable)    │
│  breakable si un workflow peut modifier      │
│  directement une transaction approved.       │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  L'orchestration ET seulement l'orchestration│
│  de séquences d'événements.                  │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 6: FormAggregate

```
┌─────────────────────────────────────────────┐
|           FormAggregate BOUNDARY             │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Form definitions (YAML/JSON)             │
│  - Field definitions with types             │
│  - Section layouts                          │
│  - Conditional visibility rules             │
│                                              │
│  Protège:                                   │
│  - NO JSX hardcoded forms                  │
│  - Select options from Vocabulary only     │
│  - Client validation = Server validation    │
│  - Versioned forms (old versions locked)    │
│  - Sensitive forms locked after submission │
│                                              │
│  Expose:                                     │
│  - LoadFormDefinition(formId, version)     │
│  - RenderForm(formDef, data)               │
│  - ValidateFormData(formDef, data)        │
│  - GetVisibleFields(formDef, context)      │
│  - GetValidationErrors(formDef, data)      │
│                                              │
│  Interdit:                                  │
│  - Hardcode any form in JSX                │
│  - Reference vocabulary that doesn't exist │
│  - Return different validation on client   │
│    than on server                          │
│  - Create new capabilities                 │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: tous les formulaires en JSX dur.  │
│  Changement de champ = nouveau déploiement. │
│  Avec lui: YAML → UI dynamique.             │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-009 (formulaire = JSON→UI) impossible  │
│  sans contrôle formel des templates.        │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  La définition ET le rendu de formulaires.   │
│  Jamais la sauvegarde (→ ResourceAggregate).│
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 7: NotificationAggregate

```
┌─────────────────────────────────────────────┐
|         NotificationAggregate BOUNDARY       │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Message templates                       │
│  - Sent records                            │
│  - User preferences                        │
│                                              │
│  Protège:                                   │
│  - Always triggered by something           │
│  - Rate limiting enforced                  │
│  - Channel preferences respected           │
│  - Critical severity bypasses quiet hours  │
│  - In-app always delivered (offline first) │
│                                              │
│  Expose:                                     │
│  - SendNotification(userId, channel, body) │
│  - QueueNotification(...)                  │
│  - MarkAsRead(notificationId)              │
│  - UpdatePreferences(userId, prefs)        │
│  - SetRateLimit(userId, maxPerHour)       │
│  - SuppressUntil(userId, untilTime)        │
│                                              │
│  Interdit:                                  │
│  - Send spontaneous notifications         │
│  - Override user channel preferences      │
│  - Deliver to deleted users               │
│  - Bypass rate limits                     │
│  - Mix notification content with business │
│    logic                                  │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: pas de communication interne.     │
│  Les users ne seraient jamais informés.     │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-003 (offline-first): notifications     │
│  in-app doivent fonctionner hors-ligne.     │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  La messagerie. Rien d'autre.               │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 8: VocabularyAggregate

```
┌─────────────────────────────────────────────┐
|          VocabularyAggregate BOUNDARY        │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Namespaces (finance, common, etc.)       │
│  - Terms with labels (FR/EN)                │
│  - Deprecation flags                        │
│  - Color assignments                        │
│                                              │
│  Protège:                                   │
│  - Never delete values (only deprecated)    │
│  - Minimum FR+EN translations              │
│  - Keys stable forever                      │
│  - Forms referencing nonexistent terms fail │
│    explicitly                               │
│                                              │
│  Expose:                                     │
│  - GetTerms(namespace)                      │
│  - GetTermValues(namespace, termKey)       │
│  - ResolveLabel(namespace, termKey, lang)  │
│  - DeprecateValue(namespace, termKey, val) │
│  - SearchTerms(query, namespace?)          │
│  - GetAllNamespaces()                      │
│                                              │
│  Interdit:                                  │
│  - Delete deprecated values              │
│  - Remove translations below minimum    │
│  - Change key of an existing term       │
│  - Return empty string for missing label│
│  - Mix business logic into labels      │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: chaque liste en dur dans le code. │
│  Dîme/offrande codés → impossible à        │
│  traduire ou configurer.                    │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-006 (vocab是唯一source) impossible     │
│  sans un catalogue centralisé.              │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  Le registre UNIVERSEL de TOUS les termes.  │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 9: ReportingAggregate

```
┌─────────────────────────────────────────────┐
|          ReportingAggregate BOUNDARY         │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Report definitions                      │
│  - Generated report snapshots              │
│  - Export configurations (pdf/csv/json)    │
│                                              │
│  Protège:                                   │
│  - Balance must balance (Actif = Passif +  │
│    Résultat)                                │
│  - Monthly covers 1st to last day of month │
│  - Export includes timestamp + signature   │
│  - Archived reports immutable              │
│  - Only synced=1 (approved) participate     │
│                                              │
│  Expose:                                     │
│  - GenerateReport(reportType, period)      │
│  - GetReportTypes(orgId)                   │
│  - ExportReport(reportId, format)          │
│  - CalculateBalance(scope, periodStart,   │
│                     periodEnd)              │
│                                              │
│  Interdit:                                  │
│  - Include pending/unapproved transactions │
│  - Persist generated reports (on-demand)   │
│  - Exceed max field count in output        │
│  - Bypass permission checks               │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: bilan calculé via code dur.      │
│  Impossible d'ajouter de nouvelles           │
│  catégories de rapport sans recompiler.     │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  BR-FIN-020 (bilan équilibré) impossible    │
│  sans calcul structuré.                     │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  La génération ET l'export de rapports.     │
│  Ne stocke PAS les rapports — générés à la  │
│  demande depuis ResourceAggregate.           │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 10: AuditAggregate

```
┌─────────────────────────────────────────────┐
|           AuditAggregate BOUNDARY            │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Immutable log entries                    │
│                                              │
│  Protège:                                   │
│  - Never modify/delete any entry            │
│  - Always capture old_value + new_value     │
│  - Log immediately upon state change       │
│  - Retention min 7 years (configurable)     │
│  - Access restricted to admin/auditor       │
│                                              │
│  Expose:                                     │
│  - LogAction(entityType, entityId, action, │
│                oldValues, newValues)        │
│  - QueryLogs(filters, pagination)          │
│  - ExportAuditTrail(period, format)        │
│                                              │
│  Interdit:                                  │
│  - Append-only: never update or delete     │
│  - Self-log (audit logs aren't audited)    │
│  - Bypass immutability                     │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: aucune traçabilité.              │
│  INV-007 impossible.                        │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-007 (Audit Trail Immuable) IMPOSSIBLE  │
│  sans cet aggregate.                        │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  La journalisation IMMUABLE de toutes les    │
│  actions utilisateur. Rien d'autre.          │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 11: LifecycleAggregate

```
┌─────────────────────────────────────────────┐
|          LifecycleAggregate BOUNDARY         │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Archive entries with states              │
│  - Archivable types (configurable per org)  │
│  - State transition rules                  │
│  - Purge scheduling                        │
│                                              │
│  Protège:                                   │
│  - States configurable via manifest        │
│  - Link to original resource               │
│  - Optional member linking                 │
│  - Tags + categories for organization      │
│  - Purge date configurable per type        │
│  - Trashed not visible in normal queries   │
│  - Purge is irreversible                   │
│                                              │
│  Expose:                                     │
│  - ArchiveResource(resourceType, resourceId)│
│  - TrashResource(archiveId)               │
│  - PurgeResource(archiveId)               │
│  - RestoreFromTrash(archiveId)            │
│  - ListArchiveEntries(filters)            │
│  - SearchArchives(query, tags?, type?)    │
│  - ApplyTags(archiveId, tags)             │
│  - SchedulePurge(archiveId, purgeDate)    │
│                                              │
│  Interdit:                                  │
│  - Create new archivable types in code    │
│  - Purge before purge_date                │
│  - Restore once purged                    │
│  - Mix archive data with non-archive data │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: archive = feature hardcode.      │
│  Avec lui: chaque org déclare ses types     │
│  archivable dans le manifest. Extensible     │
│  sans code.                                 │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-010 (versioning) — states are         │
│  implicit versioning.                       │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  Le cycle de vie de TOUTE ressource qui      │
│  doit être conservée.                        │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 12: ConfigurationAggregate

```
┌─────────────────────────────────────────────┐
|        ConfigurationAggregate BOUNDARY        │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Org settings (key-value pairs)          │
│  - i18n settings (date, number, currency)  │
│  - Performance tuning settings             │
│                                              │
│  Protège:                                   │
│  - Currency ISO 4217 format                │
│  - Timezone IANA format                    │
│  - Accent color valid hex + WCAG check     │
│  - All settings have default fallback      │
│                                              │
│  Expose:                                     │
│  - GetSetting(key)                         │
│  - GetAllSettings()                        │
│  - UpdateSetting(key, value)               │
│  - ResetToDefaults()                       │
│  - BulkUpdateSettings(pairs)               │
│                                              │
│  Interdit:                                  │
│  - Store business data (transactions, etc) │
│  - Bypass format validation               │
│  - Modify settings without admin auth     │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: tous les paramètres en dur.      │
│  Changement de devise = recompile.          │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-005 (configuration > code dur)          │
│  impossible sans un service de config.      │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  Les paramètres de configuration globaux.    │
│  Pas de contenu, pas de logique métier.      │
└─────────────────────────────────────────────┘
```

---

## BOUNDARY 13: OfflineSyncAggregate

```
┌─────────────────────────────────────────────┐
|         OfflineSyncAggregate BOUNDARY        │
├─────────────────────────────────────────────┤
│                                              │
│  Possède:                                    │
│  - Pending operations queue                 │
│  - Sync status trackers                     │
│  - Conflict strategies per entity type      │
│                                              │
│  Protège:                                   │
│  - Local write ALWAYS precedes remote write │
│  - Approved transactions immutable          │
│  - Batch size max 50                         │
│  - Retry exponential backoff max 5          │
│  - User ops never depend on sync            │
│                                              │
│  Expose:                                     │
│  - PushPendingOperations()                  │
│  - PullRemoteChanges(sinceTimestamp)       │
│  - ResolveConflict(operation, serverData)  │
│  - MarkConfirmed(opId)                      │
│  - CheckConnectivity()                      │
│  - GetSyncStatus(tableName)                │
│                                              │
│  Interdit:                                  │
│  - Modify resource data directly          │
│  - Change conflict strategy mid-sync      │
│  - Sync more than batch_size              │
│  - Block user operation during sync       │
│                                              │
│  Pourquoi existe-t-il ?                      │
│  Sans lui: offline-first impossible.         │
│  Toute perte de réseau = perte de données.  │
│                                              │
│  Quel invariant serait cassé sans lui ?      │
│  INV-003 (Offline-Absolute) impossible      │
│  sans coordination push/pull.               │
│                                              │
│  Quelle responsabilité exclusive ?           │
│  La synchronisation. SEULEMENT.              │
└─────────────────────────────────────────────┘
```
