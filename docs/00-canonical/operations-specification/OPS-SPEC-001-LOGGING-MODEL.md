# Logging Model — Lumina v1

**Doc ID:** OPS-SPEC-001
**Version:** v1.0
**Statut:** SPÉCIFICATION OPS DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-001", "RTS-002", "ASS-001", "DOC-015", "RTS-003"]
**Transformation_rule :** "ops-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le modèle de journalisation (logging) abstrait pour l'ensemble de l'architecture Lumina v1. Il couvre les principes, le schéma, les catégories, la rétention et le routage des logs -- sans prescrire aucun outil concret (pas de Prometheus, Grafana, ELK, Splunk, etc.). Les spécifications opérationnelles restent indépendantes de toute plateforme d'implémentation.

Ce modèle s'applique à tous les 15 Runtime Components (CRT-001 à CRT-015), aux 83 opérations des 13 Application Services (ASS-001), et à tous les Domain Events catalogués dans DOC-014.

---

## SECTION 1 : PRINCIPES FONDAMENTAUX DU LOGGING

### Principe 1 : Structured Logging Exclusif

Toutes les entrées de log doivent être structurées au format key-value pairs ou objet sérialisé en JSON. Le texte brut (string non parseable) est strictement interdit comme format principal. Chaque log entry est un enregistrement machine-lisible avec des champs typés.

**Règle absolue** : Un parser automatique doit pouvoir extraire chaque champ sans heuristique ni regex. Le format JSON est le standard de facto -- tout autre format structuré équivalent doit fournir la même capacité de parsing mécanique.

**Application** :
- Chaque Runtime Component produit des logs via `Logger.info({...})`, `Logger.error({...})`, etc., jamais via `console.log("message brut")`.
- Les 15 CRTs de RTS-001 écrivent systématiquement dans ce format, y compris les logs de phase (Phase 100-110 de RTS-002).
- Pour les erreurs technique (stack traces), le champ `stack_trace` est inclus (voir Section 2), pas un `message` concaténé manuellement.

**Violation** : Log en format string brut détecté dans un CRT → violation du format structurel. Détectable par analyse statique (grep de patterns `logger\.info\s*\(\s*"[^{]`) ou test d'intégration vérifiant que chaque log entry est parseable JSON.

---

### Principe 2 : Niveaux de Log Restreints

Cinq niveaux sont autorisés, dans cet ordre croissant de gravité :

| Niveau | Code | Sémantique | Usage typique |
|--------|------|------------|---------------|
| DEBUG | 10 | Information détaillée de débogage | Flux internes, parcours de code, état intermédiaire |
| INFO | 20 | Information opérationnelle normale | Démarrage, requêtes traitées, événements métier |
| WARN | 30 | Situation anormale mais non bloquante | Retry imminent, dégradation, comportement contourné |
| ERROR | 40 | Erreur nécessitant intervention | Exception levée, échec persistant d'une opération |
| CRITICAL | 50 | Échec systémique nécessitant action immédiate | Perte de connectivité principale, corruption détectée, processus en erreur |

Aucun niveau personnalisé n'est autorisé (jamais de `TRACE`, `FATAL`, `NOTICE`, `VERBOSE`, `INFO2`, etc.). Si le besoin semble justifier un nouveau niveau, c'est une indication que le contexte des logs existe (ex : un level `DEBUG_DETAIL` devrait simplement être `DEBUG` avec des champs contextuels supplémentaires).

**Application** :
- Le `ConfigurationLoader` (CRT-005) charge le niveau minimal depuis la configuration (`LUMINA_LOG_LEVEL`), applicable globalement. Défaut : `INFO` en production, `DEBUG` en développement.
- Aucun Runtime Component ne peut élever le niveau minimal : seul `ConfigurationPort` change le niveau global.
- Les `AuditEnabler` logs sont toujours au moins `INFO` car l'audit est une obligation constitutionnelle.

---

### Principe 3 : Correlation Tracing Universel

Chaque requête entrante reçoit un `correlation_id` (UUIDv7) qui traverse l'ensemble des composants impliqués dans le traitement. Chaque entry de log inclut ce champ pour permettre le traçage de bout en bout d'une requête.

**Spécification** :
- Le `TenantContextProvider` (CRT-015) injecte le correlation_id dans tous ses logs.
- Le `TransactionCoordinator` (CRT-003) dérive des correlation_ids composites pour les sagas : `{parent_id}-saga:{pattern}:{step}`.
- Le `HealthMonitor` (CRT-007) utilise un prefix spécial `hm-{cycle_number}` pour ses health check logs.
- Le `ShutdownPipeline` (CRT-011) utilise `shutdown-{signal_type}` pendant la phase d'arrêt.

Ce principe est la concrétisation de la règle OR-013 (Logging Traceability) de RTS-003.

---

### Principe 4 : Aucune Donnée Sensible

Aucune entry de log ne contient :
- Mots de passe ou hashes de mots de passe
- Tokens d'authentification, JWT, refresh tokens
- Clés API ou secrets de configuration
- Données personnelles identifiables (NOM, adresse, téléphone, email dans le corps du log)
- Contenu brut de documents ou de formulaires
- Valeurs de colonnes sensibles (champs contenant `password`, `secret`, `credential`, `token`, `api_key`, `authorization`, `email`, `phone`, `ssn`)

**Règle absolue** : Le filtre s'applique au NIVEAU SCHÉMA (noms de champs), pas au niveau valeur. Si un champ s'appelle `password` -- que sa valeur soit `null`, `******` ou `""` -- il ne doit PAS apparaître dans un log. Le filtrage est basé sur les noms de champs de l'objet sérialisé, pas sur son contenu.

**Application** : Le `Diagnostics` service (CRT-008) implémente ce filtrage systématiquement. Tout endpoint de diagnostic (`/health`, `/metrics`, `/debug/dump`) passe les données sortantes par ce filtre schema-based avant sérialisation.

---

### Principe 5 : Échantillonnage Déterministe

Les logs de niveau `DEBUG` en production sont échantillonnés de manière déterministe -- jamais aléatoire. La fonction d'échantillonnage est basée sur un hash du correlation_id :

```
sampled = (hash(correlation_id) mod SAMPLE_RATE) == 0
```

Où `SAMPLE_RATE` est une constante configurable (par défaut 1 sur 100 en production, 1 sur 10 en staging, 1/1 en développement).

Cette approche garantit :
- Un même correlation_id est toujours échantillonné ou toujours exclu (reproductibilité).
- La distribution est uniforme sur un volume suffisant.
- Pas de dépendance à une seed de randomisateur partageable entre instances.

**Application** :
- Avant chaque appel `Logger.debug()` en production, le composant vérifie si le correlation_id actuel est échantillonné.
- En développement (LUMINA_ENV=development), tout échantillonnage est désactivé : tous les DEBUG sont produits.
- La décision d'échantillonnage est prise au niveau du Logger wrapper, pas dans chaque CRT individuellement.

---

### Principe 6 : Séparation Audit Trail / Operational Logs

Les logs opérationnels (Runtime Component logs, Application Service logs) ne remplacent PAS les entrées d'audit du `AuditAggregate`. L'AuditEnabler (CRT-014) écrit des entrées d'audit dédiées avec before/after state via `AuditPort`, conformément à l'invariant AUD-001 et OLDNEW-002 de DOC-015.

**Distinction claire** :
- Un **log opérationnel** dit "transaction created by user-1 in org-a with amount 5000" -- c'est un événement système.
- Une **entrée d'audit** dit "entityType=Transaction, entityId=t-789, oldValues=null, newValues={amount:5000, type:income, categoryId:v-123}, userId=user-1, orgId=org-a, timestamp=T" -- c'est une copie intégrale de la mutation pour compliance.

**Règle absolue** : Les deux flux coexistent, parallèles, sans substitut. Toute tentative de faire reposer la conformité légale uniquement sur les logs opérationnels est une violation.

---

## SECTION 2 : SCHÉMA ABSTRAIT DE LOG ENTRY

Chaque entrée de log suit EXACTEMENT ce schéma structuré. Tous les champs sont définis de manière abstraite -- leur nom, type, et contrainte sont fixes, mais leur implémentation physique (JSON, message bus, ring buffer) dépend de l'adapter de `LoggingPort` choisi.

```
{
  "timestamp":      "ISO8601 avec fuseau horaire (ex: 2026-07-25T14:30:00+02:00)",
  "level":          "DEBUG | INFO | WARN | ERROR | CRITICAL",
  "service":        "Nom du Runtime Component (CRT-NNN) ou App Service (ASS-NNN)",
  "correlation_id": "UUIDv7 pour tracer une requête de bout en bout",
  "org_id":         "UUID de l'organisation concernée, ou null",
  "user_id":        "UUID de l'utilisateur, ou null (si non authentifié)",
  "message":        "Description lisible par un humain",
  "context":        "key-value pairs spécifiques à cet événement (objet ou null)",
  "stack_trace":    "Chaîne de caractères ou null (uniquement pour ERROR et niveaux supérieurs)",
  "duration_ms":    "Entier ou null (uniquement pour les logs de timing)",
  "event_type":     "Identificateur de catégorie d'événement"
}
```

### Description détaillée de chaque champ

#### timestamp
- **Type** : Chaîne ISO 8601 avec timezone explicite.
- **Requis** : OUI -- toujours présent.
- **Contraintes** : Toujours en UTC ou avec offset explicite (+HH:MM). Format : `YYYY-MM-DDTHH:mm:ss.sssZ` ou `YYYY-MM-DDTHH:mm:ss.sss±HH:MM`. Jamais de timestamp naive (sans fuseau).
- **Source** : `ClockPort.now()` retourné par le Runtime Component producteur. Jamais de `Date.now()` ou équivalent côté applicatif direct.

#### level
- **Type** : Chaîne -- exactement une valeur parmi `DEBUG`, `INFO`, `WARN`, `ERROR`, `CRITICAL`.
- **Requis** : OUI -- toujours présent.
- **Contraintes** : Jamais de niveau personnalisé (interdit : `TRACE`, `FATAL`, `DEBUG2`, etc.). Correspond exactement aux 5 niveaux définis au Principe 2.
- **Source** : Déterminé par le composant producteur selon le sémantique de l'événement.

#### service
- **Type** : Chaîne -- nom identifiant le composant responsable de cette entrée de log.
- **Requis** : OUI -- toujours présent.
- **Contraintes** :
  - Pour les logs Runtime : `CRT-NNN` ou nom long du composant (ex : `TransactionCoordinator`, `EventDispatcher`).
  - Pour les logs Application Services : `ASS-NNN` ou nom du service (ex : `ResourceService`, `OfflineSyncService`).
  - Pour les événements de domaine : nom de l'Aggregate (ex : `ResourceAggregate`, `WorkflowAggregate`).
  - Pour les phases de lifecycle : `LifecycleManager`, `StartupPipeline`, `ShutdownPipeline`.
- **Exemples valides** : `"CRT-003"`, `"CRT-007"`, `"ResourceService"`, `"OrganizationService"`, `"LifecycleManager"`.

#### correlation_id
- **Type** : Chaîne UUIDv7 ou chaîne dérivée (saga prefix, health monitor cycle).
- **Requis** : OUI -- toujours présent.
- **Contraintes** :
  - Requête classique : UUIDv7 généré par l'API layer au début du traitement.
  - Saga step : `{parent_correlation_id}-saga:{pattern}:{step_index}` (règle OR-013 RTS-003).
  - Compensation saga : `{parent_correlation_id}-saga:{pattern}:{step}_compensate`.
  - Health monitor : `hm-{cycle_number}`.
  - Shutdown : `shutdown-{signal_type}` (ex : `shutdown-SIGTERM`).
- **Purpose** : Permet de retrouver TOUTES les logs d'une seule requête via un filtre unique.

#### org_id
- **Type** : Chaîne UUID ou null.
- **Requis** : OUI -- toujours présent (null si non applicable : health check public, startup).
- **Contraintes** :
  - Résolu UNIQUEMENT via `TenantContextProvider` (CRT-015) depuis le token d'authentification.
  - Jamais directement fourni par la requête HTTP (header, paramètre, body).
  - null uniquement pour les entries système (startup, shutdown, health checks publics).
- **Source** : CRT-015 résout depuis IdentityProviderPort au début de chaque requête.

#### user_id
- **Type** : Chaîne UUID ou null.
- **Requis** : OUI -- toujours présent.
- **Contraintes** :
  - null pour les opérations automatiques (scheduled jobs, event handlers sans auth, health checks).
  - UUID de l'utilisateur connecté pour les commandes et queries API.
  - null si l'utilisateur est authentifié mais que le contexte utilisateur n'est pas disponible (ex : operation system-initiated).

#### message
- **Type** : Chaîne de caractères lisible par un humain.
- **Requis** : OUI -- toujours présent.
- **Contraintes** :
  - Phrase concise décrivant ce qui s'est produit.
  - Ne contient JAMAIS de données sensibles (mot de passe, token, email, clé).
  - Ne contient PAS de stack trace -- utilisez `stack_trace` séparément.
  - Format recommandé : verbe au passé ("Transaction approved", "Connection timeout").
  - Longueur recommandée : < 200 caractères. Messages plus longs doivent utiliser `context`.
- **Exemple** : `"Transaction approved by treasurer"` ou `"Cache write retry attempt 3 of 5"`.

#### context
- **Type** : Objet key-value ou null.
- **Requis** : OUI -- toujours présent (null si aucun contexte additionnel).
- **Contraintes** :
  - Tous les key doivent être des strings sans caractères spéciaux (a-z, A-Z, 0-9, underscore, tiret).
  - Toutes les values doivent être de type primitif : string, number, boolean, ou null.
  - Interdit : objets imbriqués, arrays, ou types complexes dans context. Tout type complexe doit être simplifié à une string représentation.
  - Contenu spécifique à l'événement : pour un error log, inclure `error_code`, `retry_count`, `max_retries`. Pour un transaction log, inclure `aggregate_name`, `command_name`, `version_before`, `version_after`.
- **Exemples** :
  ```json
  {"error_code": "E-503-007", "retry_count": 3, "max_retries": 5, "operation": "sync_push"}
  {"aggregate": "ResourceAggregate", "command": "CreateTransaction", "version_before": 4, "version_after": 5}
  ```

#### stack_trace
- **Type** : Chaîne ou null.
- **Requis** : Nominatif -- présent seulement pour les niveaux `ERROR` et `CRITICAL`. Null pour tous les autres niveaux.
- **Contraintes** :
  - Doit inclure au minimum : type d'erreur, message, nom du fichier, numéro de ligne, et call stack complet.
  - Ne doit pas contenir de données sensibles dans les variables locales affichées.
  - Pour les erreurs wrappees (domain error → runtime error), inclure la chaîne complète de cause racine.
  - Maximum recommandé : 50 lignes. Au-delà, tronquer et ajouter `"truncated=true"` dans `context`.
- **Format** : Chaque frame sur sa propre ligne : `"ErrorType: message at filename:line:column"`.

#### duration_ms
- **Type** : Entier positif ou null.
- **Requis** : Nominatif -- présent seulement pour les logs de timing (requêtes, transactions, sagas, health checks, retries). Null pour les événements non-temporels (erreurs, changements d'état).
- **Contraintes** :
  - Millisecondes entières (pas de fractions de seconde -- utiliser `timestamp` à la milliseconde près si besoin de sous-ms précision).
  - Représente la durée totale de l'opération logged.
  - Exemples d'utilisation : `duration_ms: 42` pour une requête de 42ms, `duration_ms: 1200` pour un retry de 1.2s.
- **Source** : Mesuré via ClockPort.monotonic() delta au début et à la fin de l'opération.

#### event_type
- **Type** : Chaîne -- identificateur de catégorie.
- **Requis** : OUI -- toujours présent.
- **Contraintes** :
  - Enum fini de catégories définies dans Section 3.
  - Format : `{CATEGORY}_{SUBTYPE}` (ex : `REQUEST_RECEIVED`, `TRANSACTION_COMMITTED`, `AUTH_FAILURE`).
  - Permet un filtrage machine sur les logs agrégés.
- **Valeurs autorisées** : Voir tableau de Section 3.

---

## SECTION 3 : CATÉGORIES DE LOG ET LEUR PURPOSE

Chaque catégorie de log a des contraintes spécifiques sur le niveau minimum, le format de `event_type`, les champs `context` attendus, et la période de rétention.

### Table : Catégories de Log

| Catégorie | event_type Pattern | Min Level | Source (Runtime Component) | Champs context obligatoires | Rétention |
|-----------|-------------------|-----------|--------------------------|----------------------------|-----------|
| **REQUEST_LOG** | `REQUEST_{METHOD}_{STATUS}` | INFO | Tous les composants de traitement de requête | `http_method`, `endpoint`, `status_code`, `duration_ms`, `request_id` | 90 jours |
| **TRANSACTION_LOG** | `TRANSACTION_{ACTION}` | INFO | TransactionCoordinator (CRT-003) | `aggregate_name`, `command_name`, `scope_id`, `version_before`, `version_after`, `duration_ms` | 7 ans |
| **AUTH_EVENT** | `AUTH_{EVENT_NAME}` | WARN | Tous les composants touchant l'authentification | `auth_result` (success/failure/expired), `failure_reason`, `user_id`, `org_id` | 7 ans |
| **DOMAIN_EVENT** | `DOMAIN_{EVENT_NAME}` | INFO | EventDispatcher (CRT-004) | `event_type`, `aggregate_name`, `handler_count`, `success_count`, `failure_count`, `dlq_count` | 7 ans |
| **ERROR_LOG** | `ERROR_{SERVICE}_{CODE}` | ERROR | Tous les composants | `error_code`, `error_type`, `component`, `correlation_id`, `attempt_number`, `max_attempts` | 7 ans |
| **CRITICAL_LOG** | `CRITICAL_{COMPONENT}_{SEVERITY}` | CRITICAL | Tous les composants | `error_code`, `component`, `impact_scope`, `recommended_action` | Permanent |
| **AUDIT_LOG** | `AUDIT_{ACTION_TYPE}` | INFO | AuditEnabler (CRT-014) | `entity_type`, `entity_id`, `action`, `user_id`, `org_id`, `old_values_summary`, `new_values_summary` | 7+ ans |
| **PERFORMANCE_LOG** | `PERF_{METRIC_NAME}` | WARN | HealthMonitor (CRT-007), Diagnostics (CRT-008) | `metric_name`, `value`, `threshold`, `unit`, `component` | 1 an |

### Détails par catégorie

#### REQUEST_LOG

**Purpose** : Suivi de toutes les entrées/sorties de requêtes traversant l'application.

**Quoi logger** :
- Entrée : requête reçue (`REQUEST_RECEIVED`).
- Sortie : requête complétée (`REQUEST_COMPLETED`, avec `duration_ms` et `status_code`).
- Erreur durant le traitement : `REQUEST_FAILED` (niveau ERROR au minimum).
- Timeout : `REQUEST_TIMEOUT`.

**Niveau minimum** : INFO pour requêtes reçues et complétées. ERROR pour les erreurs.

**Quand logging facultatif** : Health check endpoint (`/health`) peut être filtré si le volume est trop élevé.

**Exemple d'entry** :
```json
{
  "timestamp": "2026-07-25T14:30:00.123+02:00",
  "level": "INFO",
  "service": "CRT-001",
  "correlation_id": "01kabc123def456ghij789klm0",
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "user_id": "660e8400-e29b-41d4-a716-446655441111",
  "message": "Request completed successfully",
  "context": {
    "http_method": "POST",
    "endpoint": "/transactions",
    "status_code": 201,
    "duration_ms": 127,
    "request_id": "req-u7abc123"
  },
  "stack_trace": null,
  "duration_ms": 127,
  "event_type": "REQUEST_COMPLETED"
}
```

#### TRANSACTION_LOG

**Purpose** : Traçabilité complète des scopes transactionnels intra-aggregate et cross-aggregate.

**Quoi logger** :
- Begin de scope transactionnel (`TRANSACTION_BEGIN`).
- Commit réussi (`TRANSACTION_COMMITTED`).
- Rollback (`TRANSACTION_ROLLED_BACK`) -- inclure la raison dans context.
- Saga step execute (`TRANSACTION_SAGA_STEP_EXECUTED`) et compensation (`TRANSACTION_COMPENSATION_EXECUTED`).

**Niveau minimum** : INFO.

**Champs context supplémentaires** :
- `transaction_scope_type`: `intra_aggregate` ou `cross_aggregate_linear` ou `cross_aggregate_parallel` ou `cross_aggregate_saga`.
- `compensation_action`: nom de la compensation si applicable (pour saga).

**Règle absolue** : Aucun event domain n'est loggé AVANT le commit (rule OR-004 RTS-003). Le log `TRANSACTION_COMMITTED` doit précéder tout `DOMAIN_EVENT` logging.

#### AUTH_EVENT

**Purpose** : Événements de sécurité liés à l'authentification et à l'autorisation.

**Quoi logger** :
- Tentative de connexion échouée (`AUTH_FAILURE`), niveau WARN minimum.
- Token expiré (`AUTH_TOKEN_EXPIRED`), niveau WARN.
- Token renouvelé avec succès (`AUTH_TOKEN_REFRESHED`), niveau INFO.
- Session révoquée (`AUTH_SESSION_REVOKED`), niveau WARN.
- Permission refusée (`AUTH_FORBIDDEN`), niveau WARN.
- Successful login à un nouveau device/IP (`AUTH_NEW_DEVICE`) -- niveau WARN.

**Niveau minimum** : WARN pour les événements de sécurité négatifs. INFO pour les événements neutres/positifs.

**Champs context obligatoires** :
- `auth_result`: `success`, `failure`, `expired`, `revoked`, `forbidden`, `new_device`.
- `failure_reason`: code d'erreur si échec (ex : `invalid_credentials`, `expired_token`, `insufficient_permission`).
- `user_id` et `org_id` quand disponibles.

**Pourquoi niveau minimum WARN** : Ces logs doivent être visibles sans activer le logging de debug. Un événement de sécurité est toujours important.

#### DOMAIN_EVENT

**Purpose** : Traçabilité de la publication et consommation des Domain Events.

**Quoi logger** :
- Émission : `DOMAIN_EVENT_PUBLISHED`.
- Consommation par handler : `DOMAIN_EVENT_CONSUMED` ou `DOMAIN_EVENT_HANDLER_SUCCESS`.
- Échec de handler : `DOMAIN_EVENT_HANDLER_FAILURE` avec retry count.
- DLQ placement : `DOMAIN_EVENT_DLQ_PLACED` (niveau ERROR minimum).

**Niveau minimum** : INFO pour les événements normaux, ERROR pour les DLQ placements.

**Champs context obligatoires** :
- `event_type`: type du Domain Event (ex : `ResourceCreated`, `ApprovalGranted`, `SettingUpdated`).
- `aggregate_name`: Aggregate source de l'événement.
- `handler_count`: nombre total de handlers inscrits pour cet event type.
- `success_count`: handlers ayant réussi.
- `failure_count`: handlers ayant échoué.
- `dlq_count`: événements placés en DLQ.

**Source primaire** : `EventDispatcher` (CRT-004). Mais tous les Application Services peuvent produire des Domain Events qui passent par CRT-004.

#### ERROR_LOG

**Purpose** : Toutes les erreurs nécessitant attention humaine ou automatique corrective.

**Quoi logger** :
- Exceptions non attrapées.
- Échecs de validation de domaine (invariant violé, E-422).
- Échecs de persistance après retries exhaustés.
- Timeouts de requête dépassant le seuil configuré.
- Échecs de retry exhaustés pour toutes les opérations.

**Niveau minimum** : ERROR.

**Champs context obligatoires** :
- `error_code`: code d'erreur structuré (ex : `E-422-001-FIN-002`).
- `error_type`: `domain_violation`, `persistence_error`, `timeout`, `network_error`, `validation_error`, `authorization_error`, `configuration_error`.
- `component`: nom du CRT ou App Service qui a rencontré l'erreur.
- `attempt_number`: nombre de tentatives effectuées si retry appliqué.

**Règle cruciale** : L'erreur de domaine (invariant violé, E-4xx) N'EST JAMAIS retryée (rule OR-005 RTS-003). Ces erreurs doivent logger directement au niveau ERROR sans boucle de retry.

#### CRITICAL_LOG

**Purpose** : Échecs systémiques qui menacent la disponibilité ou l'intégrité des données.

**Quoi logger** :
- Perte de connectivité à la base de données principale.
- Perte de connectivité au message bus / event bus.
- Corruption de données détectée (checksum mismatch, invariant impossible).
- Out of memory ou ressources système critiques épuisées.
- Configuration invalide détectée au démarrage (CRT-005).

**Niveau minimum** : CRITICAL.

**Champs context obligatoires** :
- `error_code`: code d'erreur CRITICAL (ex : `C-DB-001`, `C-CFG-001`).
- `impact_scope`: `single_tenant`, `all_tenants`, `feature_specific`, `infrastructure`.
- `recommended_action`: suggestion corrective minimale (ex : `"Verify database connectivity"`, `"Check configuration files"`).

**Notification** : Toute entry CRITICAL déclenche automatiquement une notification à l'équipe d'opérations (channel asynchrone -- le système ne spécifie pas quel outil).

#### AUDIT_LOG

**Purpose** : Entrées d'audit opérationnel (différentes des entrées d'audit persists dans AuditAggregate). Ces logs sont les traces temps réel du process d'audit.

**Quoi logger** :
- Capture before/after state par `AuditEnabler` (CRT-014) pour chaque write command.
- Tentatives d'audit échouées (non bloquant per AUD-001 constitutionnel).
- Entries d'audit écrites avec succès.
- Échec d'écriture audit (warning : audit non-bloquant mais perte de traçabilité).

**Niveau minimum** : INFO pour les succès, WARN pour les échecs non-bloquants.

**Champs context obligatoires** :
- `entity_type`: type de l'entité audited (ex : `TransactionRecord`, `OrgUnit`).
- `entity_id`: UUID de l'entité.
- `action`: action audited (ex : `create`, `update`, `delete`, `approve`).
- `userId` et `orgId` : qui a fait l'action.
- `old_values_summary` : résumé des anciennes valeurs (pas le JSON complet, juste les champs clés).
- `new_values_summary` : résumé des nouvelles valeurs.

**Règle absolue** : Ne jamais auditer `AuditAggregate` lui-même (NB-PERSIST-007 constitutionnel de RTS-001). Toute tentative d'audit récursif est détectée et skipée.

#### PERFORMANCE_LOG

**Purpose** : Métriques de performance détectées en temps réel, utilisées pour identifier les dégradations avant qu'elles ne deviennent des erreurs.

**Quoi logger** :
- Requêtes lentes dépassant le threshold configuré (par défaut > 1000ms).
- Health check response time dégradé.
- Temps de synchronisation offline élevé.
- Taille de la queue pending operations croissante.
- Retry count anormal (plus de la moyenne sur 24h).

**Niveau minimum** : WARN.

**Champs context obligatoires** :
- `metric_name`: nom de la métrique (ex : `slow_query`, `high_latency`, `queue_growth`, `retry_storm`).
- `value`: valeur mesurée.
- `threshold`: seuil configuré.
- `unit`: unité (ms, count, percentage).
- `component`: CRT ou App Service concerné.

---

## SECTION 4 : POLITIQUE DE RÉTENTION DES LOGS

La politique de rétention établit combien de temps chaque niveau de log est conservé avant purge automatique. Elle est conçue pour satisfaire les exigences légales (DOC-015 RETENTION) et minimiser le coût de stockage.

| Niveau de Log | Rétention | Justification | Base réglementaire |
|---------------|-----------|---------------|-------------------|
| DEBUG | 24 heures | Information de débogage uniquement. Non pertinente après diagnostic. | Aucune exigence légale -- purement opérationnel |
| INFO | 90 jours | Journal opérationnel standard. Suffisant pour tracer les activités régulières. | Conforme aux politiques courantes de journalisation d'entreprise |
| WARN | 1 an | Avertissements de performance et anomalies. Doivent être consultables sur cycle annuel. | Supporte les audits annuels de conformité |
| ERROR | 7 ans | Erreurs business-critical. Correspond à la conservation maximale des records commerciaux. | Invariant RETENTION-031 de DOC-015 (minimum 7 ans pour audit logs) |
| CRITICAL | 10+ ans (permanent) | Failles systémiques. Archive permanente obligatoire. | Conformité légale maximale + lessons learned long terme |

### Règles de rétention

1. **Purge automatique** : Tous les logs doivent être purgés automatiquement après expiration de leur période de rétention. La purge est exécutée par une tâche planifiée (`Scheduler` CRT-009, job `PurgeSchedule`) qui nettoie les archives quotidiennement.

2. **Pas de rétention plus longue sans justification** : Aucun niveau ne doit être retenu plus longtemps que prévu sans approbation explicite. DEBUG ne doit jamais être persisté en production au-delà des 24h (les buffers ring circulaire ne sont pas persistés sur disque).

3. **Audit logs : rétention minimale 7 ans** : Quelle que soit la politique générale, les logs associés à `AUDIT_LOG` respectent STRICTEMENT le minimum de 7 ans défini par l'invariant RETENTION-031 de DOC-015.

4. **Archivage différentiel** : Les logs anciens (entre 1 an et 5 ans pour ERROR, entre 5 et 10 ans pour CRITICAL) peuvent être archivés sur un support de stockage moins cher (cold storage, archive tier). Ils doivent rester queryable mais ne doivent pas occuper le storage primary.

5. **Retention config** : Les durées de rétention sont configurables via `ConfigurationPort` mais ne peuvent jamais être inférieures aux minima ci-dessus. Valeurs par défaut : `LOG_RETENTION_DEBUG_HOURS=24`, `LOG_RETENTION_INFO_DAYS=90`, `LOG_RETENTION_WARN_YEARS=1`, `LOG_RETENTION_ERROR_YEARS=7`, `LOG_RETENTION_CRITICAL_YEARS=10`.

---

## SECTION 5 : ROUTAGE DES LOGS

Le routage détermine où les logs vont en fonction de leur sévérité. Chaque destination décrit un mécanisme abstrait -- pas de mention d'outils concrets (pas de Prometheus, Grafana, ELK, Splunk, etc.).

### Schéma de routage par niveau

| Niveau | Buffer local | Flush | Destination secondaire | Notification |
|--------|-------------|-------|----------------------|--------------|
| DEBUG | Ring buffer (mémoire) | Batch périodique (5s intervalle) | Stockage logs | Jamais |
| INFO | Ring buffer (mémoire) | Batch périodique (10s intervalle) | Logging backend | Jamais |
| WARN | Ring buffer (mémoire) | Flush synchrone immédiat + async push | Monitoring alert system | Async -- pas intrusive |
| ERROR | Flush immédiat (synchrone) | Immédiat | Monitoring alert system + archive ERROR | Alert triggered si non déjà acknowledged |
| CRITICAL | Flush immédiat (synchrone) | Immédiat + push multi-réplica | Monitoring alert system + ops team | Notification immédiate à l'équipe |

### Détail par niveau

#### DEBUG / INFO — Buffering par lots

**Flux** :
1. Le logger écrit dans un ring buffer circulaire en mémoire (taille configurable, défaut 1024 entries).
2. En période inactive, le contenu est flushé par lot toutes les N secondes (INFO : 10s, DEBUG : 5s).
3. Les logs flushed sont envoyés au logging backend en batch (par paquets de 10-100 entries).
4. En mode développement (LUMINA_ENV=development), flush immédiat vers stderr + fichier local.

**Garantie** : Aucune entry DEBUG/INFO n'est perdue au shutdown -- le `ShutdownPipeline` (CRT-011, Phase 109) flush le ring buffer avant de fermer le logger.

**Couverture Runtime Components** : CRT-001, CRT-002, CRT-003, CRT-004, CRT-005, CRT-007, CRT-008, CRT-009, CRT-010, CRT-011, CRT-012, CRT-013, CRT-014, CRT-015.

#### WARN — Push asynchrone vers monitoring

**Flux** :
1. Même buffering que INFO + flush batch accéléré.
2. En plus du batch flush, chaque entry WARN est poussée asynchrone vers le système d'alerte de monitoring (destination secondaire).
3. Le push est asynchrone : il ne bloque PAS l'opération courante. Si le push échoue, warning loggé (ironie acknowledged) et continué.

**Couverture Runtime Components** : CRT-004 (EventDispatcher -- event handler failures), CRT-007 (HealthMonitor -- degraded health), CRT-008 (Diagnostics -- slow snapshot), CRT-009 (Scheduler -- job retries), CRT-012 (RetryPolicy -- retry storms).

#### ERROR — Push immédiat + alert

**Flux** :
1. Entry écrite immédiatement au logging backend (pas de batching).
2. Push asynchrone vers le système d'alerte de monitoring (si pas déjà fait par le router WARN).
3. Si le même error_code apparaît N fois dans une fenêtre M minutes → alerte consolidée (pas d'alerte par entry individuelle).
4. Stack trace incluse dans l'entry si niveau ERROR ou supérieur.

**Couverture Runtime Components** : Tous les CRTs produisent des ERROR logs pour leurs exceptions non-retryées. Principaux producteurs : CRT-003 (transaction errors), CRT-004 (DLQ placement), CRT-012 (retry exhaustion), CRT-014 (audit write failures -- non-blocking but logged).

#### CRITICAL — Push multi-réplica + notification

**Flux** :
1. Entry écrite immédiatement avec réplication multi-copie (vers au moins 2 destinations distinctes).
2. Notification IMMÉDIATE à l'équipe d'opérations. La notification est un signal -- pas spécifié comme email, SMS, ou autre canal.
3. L'entry contient le champ `recommended_action` pour guider la réponse initiale.
4. Le HealthMonitor (CRT-007) marque le port concerné UNHEALTHY.

**Couverture Runtime Components** : Principalement CRT-005 (configuration error), CRT-007 (multi-port unhealthy), CRT-008 (diagnostic violation -- sensitive data exposed), CRT-010 (startup failure critical).

### Flux de données des logs (vue d'ensemble)

```
┌─────────────┐     ┌──────────────┐     ┌──────────────────┐     ┌───────────────────┐
│  Runtime    │     │  Local       │     │  Batch           │     │  Remote           │
│  Component  │────▶│ Ring Buffer  │────▶│  Flush to        │────▶│  Logging          │
│  (CRT/ASS)  │     │  (Memory)    │     │  Backend         │     │  Backend          │
└─────────────┘     └──────────────┘     └──────────────────┘     └───────────────────┘
                           │                          │                        │
                    (immediate for             (async push                (archived per
                     ERROR/CRITICAL)            to alert system)           retention policy)
```

**Important** : Ce schéma est ABSTRAIT. La destination "Remote Logging Backend" peut être un fichier local, un service cloud, un message bus -- cela dépend de l'adapter de `LoggingPort` choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002). La spécification OPS ne prescrit PAS l'implémentation -- elle prescrit SEULEMENT le modèle, le schéma, et la logique de routage.

---

## SECTION 6 : INTÉGRATION AVEC LES COMPOSANTS RUNTIME

### Couverture logging par Runtime Component

Chaque Runtime Component de RTS-001 doit respecter le modèle de logging ci-dessus. Voici la matrice de couverture :

| CRT | Composant | Categories utilisées | Niveau min | Notes |
|-----|-----------|---------------------|------------|-------|
| CRT-001 | CompositionRoot | REQUEST_LOG, DOMAIN_EVENT | INFO | Service registration, port binding events |
| CRT-002 | DependencyResolver | REQUEST_LOG | INFO | Assembly order resolution, validation events |
| CRT-003 | TransactionCoordinator | TRANSACTION_LOG, ERROR_LOG | INFO | Begin/commit/rollback/saga steps |
| CRT-004 | EventDispatcher | DOMAIN_EVENT, ERROR_LOG | INFO | Publish, consume, DLQ placement |
| CRT-005 | ConfigurationLoader | ERROR_LOG, CRITICAL_LOG | INFO | Config load success/failure |
| CRT-006 | LifecycleManager | REQUEST_LOG, TRANSACTION_LOG | INFO | State transitions (STARTING, RUNNING, SHUTTING_DOWN) |
| CRT-007 | HealthMonitor | PERFORMANCE_LOG, ERROR_LOG | WARN | Health check results, degraded/unhealthy transitions |
| CRT-008 | Diagnostics | REQUEST_LOG, PERFORMANCE_LOG | INFO | Snapshot latencies, resource accounting |
| CRT-009 | Scheduler | REQUEST_LOG, PERFORMANCE_LOG | INFO | Job scheduling, execution, timeout |
| CRT-010 | StartupPipeline | REQUEST_LOG, CRITICAL_LOG | INFO | Pipeline step completion, readiness signal |
| CRT-011 | ShutdownPipeline | REQUEST_LOG, TRANSACTION_LOG | INFO | Drain progress, connection close order |
| CRT-012 | RetryPolicy | PERFORMANCE_LOG, ERROR_LOG | WARN | Retry attempts, backoff delays, exhaustion |
| CRT-013 | IdempotencyManager | REQUEST_LOG | INFO | Hit/miss, eviction, replay handling |
| CRT-014 | AuditEnabler | AUDIT_LOG, ERROR_LOG | INFO | Before/after capture, audit write status |
| CRT-015 | TenantContextProvider | AUTH_EVENT, ERROR_LOG | WARN | Org resolution, tenant override attempts |

### Couverture logging par Application Service (ASS-001)

Chaque des 13 Application Services de ASS-001 doit produire des logs conformes à ce modèle. Les opérations qui produisent des logs :

| Service | Operations with logs | Categories |
|---------|---------------------|------------|
| OrganizationService | Create, Update, Archive, Suspend org units | REQUEST_LOG, DOMAIN_EVENT, AUDIT_LOG |
| IdentityService | CreateUser, Login, ChangeRole, RevokeSession | AUTH_EVENT, REQUEST_LOG, AUDIT_LOG |
| ResourceService | CreateTransaction, Approve, Compensate, Export | REQUEST_LOG, DOMAIN_EVENT, TRANSACTION_LOG |
| RelationshipService | AddMemberToGroup, SetOrgUnitParent | REQUEST_LOG, DOMAIN_EVENT, TRANSACTION_LOG |
| WorkflowService | Trigger, ApproveStep, Cancel, Resubmit | REQUEST_LOG, DOMAIN_EVENT, TRANSACTION_LOG |
| FormService | ValidateFormData, RenderForm | REQUEST_LOG |
| NotificationService | SendNotification, MarkAsRead | AUTH_EVENT, DOMAIN_EVENT, REQUEST_LOG |
| VocabularyService | AddTermValue, DeprecateTermValue | REQUEST_LOG, DOMAIN_EVENT |
| ReportingService | GenerateReport, CalculateBalance | REQUEST_LOG, DOMAIN_EVENT, PERFORMANCE_LOG |
| AuditService | LogAction, QueryLogs | AUDIT_LOG, AUTH_EVENT |
| LifecycleService | ArchiveResource, PurgeResource, SchedulePurge | REQUEST_LOG, DOMAIN_EVENT, AUDIT_LOG |
| ConfigurationService | UpdateSetting, ResetToDefaults | REQUEST_LOG, DOMAIN_EVENT, AUDIT_LOG |
| OfflineSyncService | PushPendingOps, ResolveConflict | REQUEST_LOG, DOMAIN_EVENT, PERFORMANCE_LOG, ERROR_LOG |

---

## SECTION 7 : COMPLIANCE ET VALIDATION

### Règles non-négociables de conformité

1. **TS-001** : Chaque Runtime Component (CRT-NNN) utilise `Logger.{level}({...})` avec objet au lieu de `console.log(message)`. Vérifiable par analyse statique du code source.

2. **TS-002** : Chaque entry log contient `correlation_id` de type UUIDv7. Vérifiable par inspection des logs produits pendant le traitement d'une requête.

3. **TS-003** : Aucun champ contenant `password`, `secret`, `token`, `api_key` n'apparaît dans le schéma de sortie de `Logger.{level}({...})`. Vérifiable par lint rule + test d'intégration.

4. **TS-004** : Les levels utilisés correspondent exactement à l'un des 5 niveaux définis (DEBUG, INFO, WARN, ERROR, CRITICAL). Vérifiable par analyse statique.

5. **TS-005** : L'audit trail via CRT-014 est séparé des logs opérationnels. Vérifiable par la présence de catégories `AUDIT_LOG` distinctes des autres catégories.

6. **TS-006** : Les logs DEBUG sont échantillonnés de manière déterministe en production. Vérifiable par test : mêmes inputs → mêmes entries de log.

7. **TS-007** : La rétention est appliquée automatiquement par le Scheduler. Vérifiable par test : logs anciens supprimés après expiration.

### Matrice de traçabilité OPS-SPEC-001

| Règle OPS-SPEC | Lien RTS-001 | Lien RTS-002 | Lien RTS-003 | Lien DOC-015 |
|----------------|-------------|-------------|-------------|-------------|
| Section 1: Principles | CRT-008 (Diagnostics), CRT-014 (AuditEnabler) | Phases 100-110 | OR-013 (Logging Traceability) | AUD-001, OLDNEW-002 |
| Section 2: Schema | Tous CRTs | Phase 106 | OR-013 | RETENTION-031 |
| Section 3: Categories | CRT-003, CRT-004, CRT-007, CRT-008, CRT-012, CRT-014 | Phase 107 | OR-004, OR-005 | BUS-006 (NB-PERSIST-006) |
| Section 4: Retention | -- | -- | -- | RETENTION-031 |
| Section 5: Routing | CRT-008, CRT-007 | Phase 105, 108 | -- | -- |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | ops-specifier v1.0 | Création — Modèle de logging abstrait pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, RTS-002, RTS-003, ASS-001, DOC-015) |

---

*Ce document définit le modèle de logging abstrait pour l'architecture Lumina v1. Il ne prescrit AUCUN outil concret (pas de Prometheus, Grafana, ELK, Splunk, Datadog, New Relic, etc.). L'implémentation technique du logging (fichiers, bases de données, services de logs) est déterminée par l'adapter de LoggingPort choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002).*
