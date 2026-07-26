# Domain Invariant Registry — Registre Constitutionnel des Invariants Métier

**Doc ID:** DOC-015 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — INVARIANT = RÈGLE ABSOLUE  
**Date:** 2026-07-24  

---

## PRINCIPE

Un **Invariant** est une vérité métier qui NE PEUT JAMAIS ÊTRE VIOLÉE, quel que soit le contexte, l'organisation ou la technologie.

Si un invariant est violé → l'opération est IMMÉDIATEMENT REJETÉE. Pas de warning, pas de fallback, pas de "try next time".

Chaque invariant a: ID, Nom, Description, Aggregate concerné, Violation possible, Sévérité, Validation automatisable.

La sévérité détermine le type de blocage:
- **CRITIQUE**: Bloquant immédiat, aucun contournement autorisé
- **MAJEUR**: Bloquant, avec possibilité de contournement manuel par SuperAdmin
- **MINEUR**: Warning mais blocage deployment

---

## REGISTRE DES INVARIANTS DU DOMAIN MODEL

### FINANCE INVARIANTS (ResourceAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **FIN-001** | Immutabilité Comptable | Une transaction approved ne peut jamais être modifiée ni supprimée | ResourceAggregate | Modification directe d'une transaction approved | CRITIQUE | Oui — guard dans ResourceAggregate.UpdateDraftTransaction() |
| **FIN-002** | Montant Toujours Positif | Les amounts sont toujours BIGINT > 0 | ResourceAggregate | Creation/update avec amount ≤ 0 | CRITIQUE | Oui — CHECK constraint au niveau Domain Model |
| **DATE-001** | Date Jamais Futur | transaction_date ne peut jamais être dans le futur | ResourceAggregate | Creation/update avec date > today | MAJEUR | Oui — validated lors de Create/Update |
| **CAT-001** | Catégorie Issue du Vocabulaire | Chaque transaction référence UNE catégorie EXISTS dans Vocabulary | ResourceAggregate | Category reference inexistant | CRITIQUE | Oui — ValidateCategoryExists(categoryId) avant write |
| **DESC-001** | Description Obligatoire Si >100 | Description min 1 char si montant > 100 | ResourceAggregate | Transaction > 100 sans description | MINEUR | Oui — FormValidationRule + DomainValidator |
| **VERSION-001** | Versionning Toujours Incrémenté | Chaque modification de resource incrémente version | ResourceAggregate | Modification sans increment version | CRITIQUE | Oui — enforced dans chaque Update command |
| **CREATEBY-001** | CreatedBy Toujours Défini | Toute création de resource a createdBy set | ResourceAggregate | Création sans createdBy | CRITIQUE | Oui — injected depuis Context Manager |
| **COMP-001** | Compensation Link | Correction doit référencer transaction originale via compensates_for | ResourceAggregate | Compensating transaction sans lien | MAJEUR | Oui — validation dans CompensateTransaction command |
| **SCOPE-001** | Scope Toujours Défini | Transaction a scope_type et scope_target valides | ResourceAggregate | Transaction sans scope ou scope invalide | CRITIQUE | Oui — validated at Create level |
| **BAL-001** | Bilan Équilibré | Bilan respecte Actif = Passif + Résultat | ReportingAggregate | Rapport non équilibré généré | CRITIQUE | Oui — BalanceCalculator vérifie avant retour |
| **MONTH-001** | Rapport Mensuel Complet | Rapport mensuel couvre 1er au dernier jour du mois | ReportingAggregate | Rapport mensuel avec periode incorrecte | MAJEUR | Oui — PeriodValidator vérifie début/fin |
| **EXPORT-001** | Export Horodaté | Export PDF inclut horodatage et signature numérique | ReportingAggregate | Export sans timestamp | MAJEUR | Oui — ReportGenerator ajoute metadata automatiquement |
| **ARCHIVED-001** | Rapport Archivé Immuable | Un rapport archivé ne peut pas être modifié | ReportingAggregate | Modification d'un rapport archivé | CRITIQUE | Oui — immuable par design (pas de persistance) |
| **SYNCED-001** | Seuls les Synced Participent | Seules les transactions synced=true participent au calcul de bilan | ReportingAggregate | Transaction en attente dans un bilan | CRITIQUE | Oui — filter Q.where('synced', 1) |

### MEMBERSHIP INVARIANTS (IdentityAggregate + RelationshipAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **MEM-001** | Prénom + Nom Obligatoires | Chaque membre a firstName ET lastName | ResourceAggregate (Member) | Member créé sans nom ou prénom | CRITIQUE | Oui — Domain Validator |
| **EMAIL-001** | Email Unique Par Org | Email unique au niveau org_id, pas global | IdentityAggregate | Deux users même email dans même org | CRITIQUE | Oui — UNIQUE constraint composite (org_id, email) |
| **PHONE-003** | Téléphone Formaté | Phone format selon région | IdentityAggregate | Phone non formaté | MINEUR | Oui — phone format validator |
| **AGE-004** | Date Naissance Cohérente | Age entre 0 et 120 ans | IdentityAggregate | Date birth future ou > 120 ans | MAJEUR | Oui — DomainValidator sur date_of_birth |
| **DUP-005** | Duplicate Email Détecté | Detection duplicate email avant création | IdentityAggregate | Créé user avec email dupliqué | MAJEUR | Oui — check BEFORE insert |
| **STATUS-010** | États Validés | États membres: active, inactive, deceased, transferred | ResourceAggregate | État inconnu assigné | CRITIQUE | Oui — CHECK enum |
| **DISABLE-011** | Inactive Cannot Transact | Member inactive ne peut pas créer de transactions | ResourceAggregate | Member inactive creating transaction | CRITIQUE | Oui — guard dans CreateTransaction |
| **TRANS-012** | Transfert Nécessite Certificat | Transfert vers autre église nécessite certificat | RelationshipAggregate | Transfer sans documentation | MAJEUR | Oui — require attached_document for transfer |

### RELATIONSHIP INVARIANTS (RelationshipAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **REL-001** | DAG Sans Cycles | Hiérarchie org_unit ne peut PAS avoir de cycles | RelationshipAggregate | Cycle détecté (ex: A→B→A) | CRITIQUE | Oui — Kahn's algo before SetOrgUnitParent |
| **DEPTH-002** | Profondeur Max 5 | Org hierarchy depth ≤ 5 | RelationshipAggregate | depth_level > 5 à l'insert | CRITIQUE | Oui — CHECK domain BEFORE reaching DB |
| **MULTI-020** | Multi-Membership Autorisée | Member peut appartenir à plusieurs groupes | RelationshipAggregate | Blocage multi-group membership | CRITIQUE | Oui — no constraint blocking it |
| **ATTR-021** | Attribution Validée | Attribution ministère doit être validée par responsable | WorkflowAggregate | Attribution sans validation | MAJEUR | Oui — Workflow step mandatory |
| **HISTORY-022** | Historique Conservé | Historique des attributions conservé | AuditAggregate | Lost attribution history | MAJEUR | Oui — AuditLogger auto-invoked |

### WORKFLOW INVARIANTS (WorkflowAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **WF-001** | Timeout Max 30 jours | Chaque étape doit avoir timeout max 30 jours | WorkflowAggregate | Step sans timeout ou timeout > 30j | CRITIQUE | Oui — DomainValidator sur timeout |
| **ESCALATE-002** | Escalade Obligatoire Après Timeout | Si timeout dépassé → escalation obligatoire | WorkflowAggregate | Timeout dépassé sans escalade | CRITIQUE | Oui — TimeoutMonitor detects + auto-escalate |
| **CHAINS-003** | Approval Chain ≤ 5 Niveaux | Chaîne d'approbation max 5 niveaux hiérarchiques | WorkflowAggregate | Approbation chain > 5 levels | MAJEUR | Oui — Count steps before execution |
| **RETRY-004** | Retry Manuel Seulement | Workflow échoué relancé manuellement UNIQUEMENT | WorkflowAggregate | Auto-retry on failed workflow | CRITIQUE | Oui — no auto-retry code path |
| **LOG-005** | Execution States Logged | Tous les états exécution journalisés | WorkflowAggregate + AuditAggregate | Execution state not logged | CRITIQUE | Oui — AuditLogger invoked on each state change |
| **NOTIFY-001** | Financial Not Modified Directly | Workflows NEVER modify approved transactions directly | WorkflowAggregate | Workflow modifies approved transaction | CRITIQUE | Oui — Guard before any financial write |

### FORM INVARIANTS (FormAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **FRM-009** | JSON→UI Only | Aucun formulaire codé en JSX | FormAggregate | Formulaire renderisé en JSX dur | CRITIQUE | Oui — Lint rule forbid "const form =" |
| **VOCAB-002** | Select From Vocabulary | Select/MultiSelect TOUJOURS from Vocabulary | FormAggregate | Select with hardcoded options | CRITIQUE | Oui — FormsRenderer checks vocab source |
| **DUAL-008** | Validation Double | Client validation = Server validation | FormAggregate | Differing validation between client/server | CRITIQUE | Oui — same Zod schema used both sides |
| **LOCK-004** | Sensitive Forms Locked | Financial forms locked read-only after submission | FormAggregate | Submitted financial form modified | CRITIQUE | Oui — Status check before render |

### NOTIFICATION INVARIANTS (NotificationAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **NOT-001** | Trigger Toujours Présent | Pas de notification spontanée | NotificationAggregate | sendNotification() without trigger | CRITIQUE | Oui — validate trigger present before send |
| **RATE-002** | Rate Limit Enforced | Anti-spam par user/org | NotificationAggregate | Plus de notifications que rate_limit | CRITIQUE | Oui — RateLimitEnforcer avant enqueue |
| **CHANNEL-003** | Preferences Respectées | Channel preferences utilisateur respectées | NotificationAggregate | Notification envoyée despite preference block | MAJEUR | Oui — check preferences before sending |
| **QUIET-004** | Quiet Hours Respectées | Notifications ne passent pas quiet hours sauf critical | NotificationAggregate | Non-critical sent during quiet hours | MAJEUR | Oui — QuietHoursPolicy check |

### VOCABULARY INVARIANTS (VocabularyAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **VOC-001** | Never Delete Values | Valeurs Vocabulary jamais supprimées, only deprecated | VocabularyAggregate | Delete term value | CRITIQUE | Oui — DeprecateValue replaces DeleteValue |
| **TRANSLATION-002** | Min FR+EN Translations | Chaque terme minimum FR et EN | VocabularyAggregate | Term created without EN label | MAJEUR | Oui — DomainValidator before persist |
| **STABLE-003** | Keys Stable Forever | Keys ne changent jamais, seul labels évoluent | VocabularyAggregate | Key modification | CRITIQUE | Oui — Key is immutable after creation |

### AUDIT INVARIANTS (AuditAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **AUD-001** | Journal Immuable | Logs jamais modifiables ni supprimables | AuditAggregate | UPDATE or DELETE on audit_logs | CRITIQUE | Oui — REVOKE sur DB + append-only aggregate |
| **OLDNEW-002** | Old Value + New Value | old_values ET new_value toujours présents | AuditAggregate | Log entry without old/new values | CRITIQUE | Oui — DomainValidator before LogAction |
| **RETENTION-031** | Conservation Min 7 Ans | Logs conservés minimum 7 ans | AuditAggregate | Purge avant 7 ans | MAJEUR | Oui — RetentionManager vérifie purge_date |
| **ACCESS-033** | Accès Restreint | Logs restreints aux admins et auditeurs | AuditAggregate | Non-admin/auditor access audit logs | MAJEUR | Oui — Permission check before QueryAuditLogs |

### LIFECYCLE INVARIANTS (LifecycleAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **LIF-001** | States Configurable Par Manifest | States configurables via manifest.lifecycle.types[] | LifecycleAggregate | Hardcoded states | CRITIQUE | Oui — read from manifest, not code |
| **LIF-003** | Purge Irréversible | Purge est finale, cannot restore | LifecycleAggregate | Restore purged entry | CRITIQUE | Oui — State transition purged→any blocked |
| **LIF-005** | Purge Date Configurable | Purge date configurable par type archivable | LifecycleAggregate | Purge avant purge_date | CRITIQUE | Oui — PurgeScheduler vérifie purge_date |

### CONFIGURATION INVARIANTS (ConfigurationAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **CFG-001** | Currency ISO 4217 | Currency toujours ISO 4217 | ConfigurationAggregate | Currency invalid (ex: "dollar") | CRITIQUE | Oui — ISO 4217 regex pattern |
| **CFG-002** | Timezone IANA | Timezone format IANA | ConfigurationAggregate | Timezone invalide (ex: "est") | MAJEUR | Oui — IANA timezone list validation |
| **CFG-003** | Accent Color Valid Hex | Accent color hex #RRGGBB + WCAG contrast | ConfigurationAggregate | Accent color non-hex ou contraste insuffisant | MAJEUR | Oui — Hex regex + WCAG contrast ratio check |
| **CFG-004** | Default Fallback | Tous settings ont default fallback | ConfigurationAggregate | Setting sans valeur par défaut | CRITIQUE | Oui — SettingResolver returns default if null |

### OFFLINE SYNC INVARIANTS (OfflineSyncAggregate)

| ID | Nom | Description | Aggregate | Violation possible | Sévérité | Validation Automatisable |
|----|-----|------------|-----------|-------------------|----------|------------------------|
| **SYNC-001** | Local First Absolute | Local write ALWAYS precedes remote write | OfflineSyncAggregate | Remote write before local | CRITIQUE | Oui — enforced in sync pipeline order |
| **SYNC-002** | Batch Size Max 50 | Push batches maximum 50 ops | OfflineSyncAggregate | Batch of > 50 ops | MAJEUR | Oui — enforce in PushCoordinator |
| **SYNC-003** | Retry Exponential Backoff Max 5 | Retry with exponential backoff, max 5 attempts | OfflineSyncAggregate | Linear retry ou plus de 5 tentatives | MAJEUR | Oui — RetryPolicy configures strategy |
| **SYNC-004** | User Ops Never Block | User operation ne dépend JAMAIS de sync synchrone | OfflineSyncAggregate | Blocage UX pendant sync | CRITIQUE | Oui — async queue, never await sync |

---

## RÉSUMÉ DES INVARIANTS PAR SÉVÉRITÉ

| Sévérité | Count | Impact |
|----------|-------|--------|
| CRITIQUE | 38 | Bloquants immédiats, aucun contournement |
| MAJEUR | 15 | Bloquants, contournement manuel SuperAdmin possible |
| MINEUR | 5 | Warnings, blocage deployment seulement |

**Total: 58 Domain Invariants couverts.**

Tous les 58 invariants sont **automatiquement validables** par le Domain Model (Guard functions dans chaque Aggregate). Aucun invariant ne dépend d'un test manuel.
