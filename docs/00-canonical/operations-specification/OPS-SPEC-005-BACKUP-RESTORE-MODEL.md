# Backup & Restore Model — Lumina v1

**Doc ID:** OPS-SPEC-005
**Version:** v1.0
**Statut:** SPÉCIFICATION OPS DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-001", "ASS-001", "DOC-015"]
**Transformation_rule :** "ops-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## PRÉSENTATION

Ce document définit le modèle de sauvegarde et restauration abstrait pour l'ensemble de l'architecture Lumina v1. Il couvre la classification des données, les stratégies de sauvegarde, la politique de rétention, les procédures de restauration, la vérification, le chiffrement et la gestion spéciale des données OfflineSync -- sans prescrire aucun outil concret (pas de AWS S3, Azure Backup, Veeam, etc.). Les spécifications opérationnelles restent indépendantes de toute plateforme d'implémentation.

**Lien avec RTS-001** : La persistance est gérée par les RepositoryPort adapters (CRT-003 TransactionCoordinator, CRT-011 ShutdownPipeline flush). Les backups couvrent tous les types de stockage accessibles via ces ports.

**Lien avec ASS-001** : Chaque Aggregate a des données persistantes dont les politiques de backup dépendent de la classification (Section 1). L'OfflineSyncAggregate a des exigences spéciales (Section 7).

**Lien avec DOC-015** : Les invariants de rétention (RETENTION-031 : minimum 7 ans pour audit) et les règles de persistance (NB-PERSIST-005 through NB-PERSIST-012) dictent directement la stratégie de backup.

---

## SECTION 1 : CLASSIFICATION DES DONNÉES

Toutes les données stockées par l'application Lumina sont classées en quatre niveaux de criticité. Cette classification détermine la fréquence, la rétention, et les procédures de backup.

### Niveau 1 : Critiques (sauvegarde continue obligatoire)

Données dont la perte entraînerait une non-conformité réglementaire, une perte financière irréversible, ou une rupture de confiance fondamentale.

| Type de donnée | Aggregate propriétaire | Port de persistance | Invariants associés |
|---------------|----------------------|---------------------|-------------------|
| Audit logs | AuditAggregate (AuditService) | RepositoryPort | RETENTION-031 (7 ans min), AUD-001 |
| Transactions financières approuvées | ResourceAggregate (ResourceService) | RepositoryPort | FIN-001/002, VERSION-001 |
| Données de synchronisation confirmées | OfflineSyncAggregate | RepositoryPort | SYNC-001 (local first) |
| Sessions utilisateur actives | IdentityAggregate (IdentityService) | CachePort/RepositoryPort | INV-008 |
| Clés idempotentes actives | CRT-013 IdempotencyManager | CachePort | -- (TTL-based, see Section 3) |

**Règle** : Les données de niveau 1 nécessitent une sauvegarde transactionnelle continue (WAL/transaction log) avec point de reprise à moins de 5 minutes.

### Niveau 2 : Importantes (sauvegarde quotidienne obligatoire)

Données métier essentielles au fonctionnement normal mais dont la perte peut être compensée partiellement par recalculation ou reconstitution.

| Type de donnée | Aggregate propriétaire | Port de persistance | Invariants associés |
|---------------|----------------------|---------------------|-------------------|
| Définitions d'organisation et org units | OrganizationAggregate | RepositoryPort | REL-001, REL-002, INV-004 |
| Profils utilisateurs et rôles | IdentityAggregate | RepositoryPort | EMAIL-001 |
| Membres et événements | ResourceAggregate | RepositoryPort | MEM-001, STATUS-010 |
| Règles de workflow et instances | WorkflowAggregate | RepositoryPort | CHAINS-003, WF-001 |
| Définitions de formulaires | FormAggregate | RepositoryPort | FRM-001, DUAL-008 |
| Préférences de notification | NotificationAggregate | RepositoryPort | CHANNEL-003, QUIET-004 |
| Vocabulary namespaces/terms/values | VocabularyAggregate | RepositoryPort | VOC-001, STABLE-003 |
| Définitions de rapports | ReportingAggregate | RepositoryPort | BAL-001, MONTH-001 |
| Entrées d'archive | LifecycleAggregate | RepositoryPort | LIF-001, LIF-003 |
| Paramètres de configuration | ConfigurationAggregate | RepositoryPort | CFG-001..004 |
| Règles de relation (group memberships) | RelationshipAggregate | RepositoryPort | MULTI-020, HISTORY-022 |

**Règle** : Les données de niveau 2 nécessitent une sauvegarde complète quotidienne avec rétention minimum de 30 jours.

### Niveau 3 : Secondaires (sauvegarde hebdomadaire acceptable)

Données de référence, templates, métadonnées système dont la reconstitution depuis la configuration ou le template est rapide.

| Type de donnée | Aggregate propriétaire | Port de persistance | Invariants associés |
|---------------|----------------------|---------------------|-------------------|
| Templates de manifest | ConfigurationAggregate | FileStoragePort | -- |
| Branding settings | ConfigurationAggregate | FileStoragePort | CFG-003 |
| Configuration d'adapters | CRT-005 ConfigurationLoader | -- (static config files) | -- |
| Logs de debug opérationnels | CRT-008 Diagnostics | FileStoragePort (log storage) | BR-ID-001 |

**Règle** : Les données de niveau 3 nécessitent une sauvegarde hebdomadaire avec rétention minimum de 90 jours. Peuvent être reconstruites depuis les templates de déploiement.

### Niveau 4 : Éphémères (aucune sauvegarde requise)

Données temporaires, caches, états transitoires qui expirent naturellement ou sont reconstruits automatiquement.

| Type de donnée | Source | Nature | Raison de non-backup |
|---------------|--------|--------|---------------------|
| Cache idempotent (CRT-013) | IdempotencyManager | TTL-based, expire après 24h | Reconstruit automatiquement ; redondant avec la source de vérité |
| Ring buffer de logs | LoggingPort (CRT-008) | Mémoire circulaire, overwrite | Les logs persistés (OPS-SPEC-001 Section 5) ont leur propre retention |
| Contexte tenant par requête | CRT-015 TenantContextProvider | Thread-local, lifetime = request | Éphémère par définition |
| État des sessions actives | IdentityAggregate | En cache, répété en repository | Session data backed by RepositoryPort (niveau 2) |

**Règle** : Aucune sauvegarde explicite requise. La perte de données de niveau 4 est sans impact sur l'intégrité du système.

---

## SECTION 2 : STRATÉGIES DE SAUVEGARDE

Trois stratégies de sauvegarde sont définies, complémentaires et utilisées conjointement.

### Stratégie 1 : Sauvegarde Complète (Full Backup)

Une copie intégrale de TOUTES les données de niveau 1 et 2 à un instant T donné.

| Paramètre | Valeur | Justification |
|-----------|--------|--------------|
| Fréquence | Hebdomadaire | Équilibre entre couverture et coût de stockage |
| Jour | Dimanche 02:00 UTC (fenêtre de faible activité) | Minimisé l'impact sur les opérations |
| Durée maximale attendue | 2 heures (pour données ~taille production standard) | Planification capacity |
| Scope | Niveau 1 + Niveau 2 (tous les types listés Section 1) | Données critiques et importantes |
| Format | Snapshot cohérent au niveau du système de persistance | Garantит la consistance transactionnelle |

**Procédure** :
1. Notification de démarrage à `Scheduler` (CRT-009) --暂停 periodiques jobs pendant la durée estimée.
2. Snapshot pris au niveau du RepositoryPort adapter de chaque Aggregate concerné.
3. Hash de vérification calculé sur le snapshot complet.
4. Snapshot copié vers le storage de backup secondaire.
5. Vérification du hash sur la copie secondaire.
6. Rapport de succès/échec généré et loggué (OPS-SPEC-001 AUDIT_LOG).
7. Resume des jobs planifiés.

### Stratégie 2 : Sauvegarde Incrémentielle

Copie uniquement des données modifiées depuis la dernière sauvegarde (complète ou incrémentielle).

| Paramètre | Valeur | Justification |
|-----------|--------|--------------|
| Fréquence | Quotidienne (lundi à samedi, 03:00 UTC) | Après la sauvegarde complète, avant la fenêtre d'activité |
| Fenêtre de changement追踪 | 24 heures | Couvre les mutations d'une journee complète |
| Scope | Niveau 1 uniquement (données critiques) | Volume raisonnable, valeur élevée |
| Format | Changements delta enregistrés via transaction logs | Efficient, minimal impact |

**Procédure** :
1. Identification des modifications depuis le dernier checkpoint (basé sur timestamps/repository versions).
2. Delta des entités modifiées capturé.
3. Delta compressé et chiffré.
4. Copié vers le storage de backup avec metadata de référence au dernier full backup.
5. Entry de log OPS-SPEC-001 TRANSACTION_LOG générée (`BackupIncrementalCompleted`).

### Stratégie 3 : journaux de Transactions Continus (WAL)

Capture en continu de chaque opération de modification (write, update, delete) au niveau du RepositoryPort. Permet une récupération jusqu'à n'importe quel point dans le temps (Point-in-Time Recovery, PITR).

| Paramètre | Valeur | Justification |
|-----------|--------|--------------|
| Fréquence | Continue (chaque write opération) | Zéro perte de données possible |
| Mode de capture | Write-Ahead Log au niveau RepositoryPort adapter | Ne bloque pas l'opération domaine principale |
| Rétention | 7 jours de WAL actifs, puis archivés | Équilibre entre couverture PITR et stockage |
| Scope | Niveau 1 + Niveau 2 | Tous les writes sur données critiques et importantes |

**Procédure** :
1. Avant chaque write confirmé au RepositoryPort, l'opération est écrite dans le WAL (CRT-003 TransactionCoordinator coordonne ce mécanisme).
2. Le WAL est écrit de manière append-only (jamais modifié, jamais supprimé dans la fenêtre active).
3. Le WAL estflushed de manière asynchrone vers le backup storage (ne bloque pas l'opération domaine -- SYNC-004).
4. Chaque WAL entry contient : timestamp, operation_type, entity_type, entity_id, old_values (si applicable), new_values (si applicable), org_id, user_id (si applicable).
5. À chaque commit transactionnel, un checkpoint WAL est marqué (permet de réduire la taille des logs nécessaires pour PITR).

**Relation avec AuditEnabler** : Le WAL capture les writes au niveau infrastructure. CRT-014 AuditEnabler capture le before/after state au niveau domaine. Les deux sont complémentaires et independants -- le WAL ne remplace PAS l'audit.

---

## SECTION 3 : POLITIQUE DE RÉTENTION

La politique de rétention établit combien de temps chaque type de sauvegarde est conservé. Elle aligne les exigences légales (DOC-015 RETENTION-031) avec les contraintes opérationnelles.

### Tableau de Rétention Global

| Type de Sauvegarde | Rétention Active | Rétention Archivée | Rétention Permanente | Base |
|-------------------|-----------------|--------------------|---------------------|------|
| Full backup | 4 semaines | 12 mois | -- | Stratégie hebdomadaire |
| Incremental backup | 7 jours | -- | -- | Stratégie quotidienne |
| WAL (actif) | 7 jours | -- | -- | Stratégie continue |
| WAL (archivé) | -- | 30 jours | -- | Conservation PITR historique |
| Audit logs | 7 ans | 10+ ans | Permanent (après 10 ans) | RETENTION-031 constitutionnel |
| Transaction backups | 7 ans | 10+ ans | Permanent (après 10 ans) | FIN-001, versioning |
| Configuration backups | 1 an | 5 ans | -- | CFG-004 defaults allow rebuild |
| Debug operation logs | 24 heures | -- | -- | OPS-SPEC-001 DEBUG retention |

### Règles de Rétention

1. **RET-BKP-001** : Les audits logs (Niveau 1) respectent STRICTEMENT le minimum de 7 ans défini par RETENTION-031 de DOC-015. Après 7 ans, ils passent en cold storage 10+ ans. Après 10 ans, ils peuvent être rendus permanents.

2. **RET-BKP-002** : Les full backups doivent toujours être disponibles avec au moins 4 semaines de profondeur (7 backup hebdomadaires). Au-delà de 4 semaines, ils sont archivés sur cold storage.

3. **RET-BKP-003** : Les WAL ne peuvent pas être supprimés tant qu'un PITR au-delà de leur âge n'est pas requis. La rétention WAL maximale est de 30 jours (7 jours actif + 23 jours archivé).

4. **RET-BKP-004** : La purge automatique est exécutée par le `Scheduler` (CRT-009), job `PurgeSchedule`. La purge respecte les mêmes principes que OPS-SPEC-001 Section 4 (purge programmée, pas de purge manuelle).

5. **RET-BKP-005** : Aucune donnée de niveau 1 ne peut être purgée avant expiration de sa période de rétention légale. Toute tentative de purge anticipée est un événement CRITICAL (OPS-SPEC-001).

6. **RET-BKP-006** : Les backups d'une organisation dissoute ou archivée (OrganizationAggregate.ArchiveOrganization) doivent respecter une rétention minimale de 7 ans même si l'organisation était inactive depuis plus longtemps.

---

## SECTION 4 : PROCÉDURES DE RESTAURATION

### 4.1 Restauration d'une Table/Collection Unique

**Scénario** : Une entité spécifique (ex: un ensemble de transactions) a été accidentellement modifiée ou supprimée.

**Procédure** :

```
1. Identifier l'étendue de la restauration nécessaire
   - Quel Aggregate ? (ex: ResourceAggregate)
   - Quelle entité ? (ex: TransactionRecord)
   - Quelle plage temporelle ? (ex: entre 2026-07-20 14:00 et 2026-07-20 16:00)
   - Combien d'enregistrements affectés ?

2. Localiser le point de backup approprié
   - WAL pour PITR dans la plage horaire identifiée
   - Ou incremental backup couvrant la date
   - Ou full backup si hors fenêtre WAL

3. Préparer l'environnement de restauration
   - Créer une instance temporaire isolée (sandbox)
   - Charger le backup dans l'instance sandbox
   - NE PAS diriger le trafic vers l'instance sandbox

4. Extraire les données pertinentes
   - Filtrer par entity_type, entity_id, org_id
   - Reconstruire l'état correct du point de backup cible
   - Générer les commandes de restauration (INSERT/UPDATE)

5. Appliquer les corrections à l'environnement productif
   - Exécuter les commandes de correction sous TransactionCoordinator (CRT-003)
   - Chaque correction est tracée via CRT-014 AuditEnabler
   - Valider les invariants post-correction (DOC-015)

6. Nettoyer l'environnement sandbox
   - Supprimer l'instance temporaire
   - Purger les données restaurées du sandbox

7. Logger la restauration complète
   - Entry AUDIT_LOG avec avant/aprés état
   - Entry TRANSACTION_LOG avec scope_id et duration_ms
```

**Temps estimé** : 30 minutes à 2 heures selon l'étendue.

### 4.2 Restauration Complète de la Base de Données

**Scénario** : Perte totale ou corruption majeure du stockage principal.

**Procédure** :

```
1. Déclarer l'incident (niveau P0 -- voir OPS-SPEC-006)
   - Activer Incident Commander
   - Notifier l'équipe

2. Arrêter les écritures
   - LifecycleManager (CRT-006) bascule en mode "read-only"
   - Aucun nouvel write n'est autorisé

3. Identifier le dernier backup sain
   - Full backup le plus récent valide (vérifié par hash)
   - WAL le plus récent couvrant la période jusqu'au dernier write connu

4. Restaurer le full backup
   - Charger sur le stockage primaire
   - Vérifier l'intégrité (hash)

5. Appliquer les WALs séquentiellement
   - Du full backup jusqu'au dernier WAL sain
   - Vérifier la cohérence transactionnelle à chaque étape

6. Valider la restauration
   - Compter les records par entity_type et org_id
   - Vérifier les invariants critiques (REL-001 no cycles, FIN-002 amounts positive, etc.)
   - Exécuter la verification suite (OPS-SPEC-005 Section 5)

7. Rétablir les écritures
   - LifecycleManager passe en mode "running"
   - Router le trafic vers l'instance restaurée
   - Monitorer les métriques de santé (CRT-007)

8. Post-restoration audit
   - Documenter la restauration dans l'incident log
   - Programmate une vérification de complétude sous 24h
```

**Temps estimé** : 2 à 8 heures selon la taille des données.

### 4.3 Restauration Cross-Région (Reprise sinistre)

**Scénario** : Catastrophe régionale affectant tout le datacenter primary. Requiert failover vers un site secondaire.

**Procédure** :

```
1. Déclarer le Disaster Recovery (P0 immediate)
   - Incident Commander escalade au niveau management
   - Déclencher le plan DR

2. Basculer le DNS/routing vers la région secondaire
   - Changer les points d'entrée vers la région de recovery
   - Mettre en read-only la région primaire (protéger contre split-brain)

3. Identifier le dernier état synchronisé côté secondaire
   - Le site secondaire doit avoir une réplique des données
   - Déterminer le point de divergence (dernier WAL appliqué)

4. Restaurer le WAL manquant (si réplique asynchronous avec lag)
   - Charger les WALs depuis le backup storage dans la région secondaire
   - Appliquer séquentiellement

5. Promouvoir le site secondaire en production
   - LifecycleManager (CRT-006) démarre l'application sur le site promu
   - Validate composition (CRT-001) complete
   - Health checks passing (CRT-007)

6. Notification et monitoring
   - Informer les parties prenantes (policy d'notification OPS-SPEC-006)
   - Monitorer intensivement les 24 premières heures

7. Planifier la récupération de la région primaire
   - Quand la région primaire est opérationnelle, la ré-syncroniser comme site de disaster recovery
   - Inverser les rôles au moment opportun
```

**Temps estimé** : 4 heures à 24 heures selon la distance régionale et le lag de réplication.

---

## SECTION 5 : PROTOCOLE DE VÉRIFICATION

Les sauvegardes ne valent rien si elles ne peuvent pas être restaurées. Un protocole de vérification mensuel est obligatoire.

### Vérification Automatisée Mensuelle

| Vérification | Méthode | Fréquence | Responsable |
|-------------|---------|-----------|------------|
| Hash validation | Recomputer le hash du backup et comparer avec le hash enregistré | Mensuel | Automatique (CRT-009 Scheduler job) |
| Restore test (sandbox) | Restaurer un subset de données dans un environnement sandbox et vérifier l'intégrité | Mensuel | Automatique (CRT-001 CompositionRoot sandbox mode) |
| PITR validation | Restaurer à un point arbitraire dans les 24 dernières heures et vérifier la consistance | Mensuel | Automatique |
| Audit log completeness | Vérifier que tous les audits logs des 7 derniers jours sont complets et non corrompus | Mensuel | CRT-014 AuditEnabler report |
| Configuration recovery | Restaurer la configuration depuis le backup et vérifier que tous les settings sont présents | Mensuel | Automatique |
| Cross-region DR drill | Simuler un failover complet vers le site secondaire | Trimestriel | Manuel + instrumentation |

### Métriques de Vérification

Chaque vérification produit une entrée de log opérationnelle et met à jour les métriques suivantes :

| Metric Name | Type | Description |
|-------------|------|-------------|
| `system.backup.verification.last_run` | Gauge (timestamp) | Timestamp du dernier run de vérification |
| `system.backup.verification.status` | Gauge | 1=passed, 0=failed |
| `system.backup.verification.hash_mismatches_total` | Counter | Nombre de mismatches détectés (doit être 0) |
| `system.backup.verification.restore_duration_seconds` | Timer | Durée de la restauration de test |

### Règles de Vérification

1. **VRF-BKP-001** : Si une vérification mensuelle échoue, une alerte P1 est automatiquement déclenchée (métrique `system.backup.verification.status == 0`).

2. **VRF-BKP-002** : Trois échecs consécutifs de vérification déclenchent une alerte P0 et suspendent automatiquement le prochain cycle de backup tant que le problème n'est pas résolu.

3. **VRF-BKP-003** : Le rapport de vérification est consigné et conservé pendant 7 ans minimum (aligné avec RETENTION-031).

---

## SECTION 6 : CHIFFREMENT AU REPOS

### Politique de Chiffrement

Toutes les sauvegardes (full, incremental, WAL) sont chiffrées au repos.

| Élément | Algorithme | Gestion des clés |
|---------|-----------|-----------------|
| Chiffrement des backups | Cipher symétrique standard | Clés gérées séparément des données |
| Hash de vérification | Hash sécurisé (SHA-256 ou équivalent) | Intégré au backup, non secret |
| Clés de chiffrement | Stockées hors-band du backup | Rotation périodique requise |

### Politique de Rotation des Clés

| Paramètre | Valeur |
|-----------|--------|
| Fréquence de rotation | Tous les 12 mois |
| Préavis de rotation | 30 jours avant expiration de la clé courante |
| Nouvelle clé | Génération cryptographic séquence aléatoire |
| Ancienne clé | Conservée 12 mois après rotation (pour decrypt backups anciens) |
| Keys per backup set | Each backup set is encrypted with the key valid at time of creation |

### Règles de Chiffrement

1. **ENC-BKP-001** : Les backups NON chiffrés ne peuvent PAS être stockés dans le système de backup. Tout backup non chiffré détecté est automatiquement re-chiffré ou supprimé.

2. **ENC-BKP-002** : La perte des clés de chiffrement rend les backups irrécupérables. La gestion des clés est elle-même un élément critique nécessitant sa propre politique de backup (hors scope de ce document OPS-SPEC).

3. **ENC-BKP-003** : Pendant une restauration, le déchiffrement se fait en mémoire et les données déchiffrées ne sont jamais écrites sur disque en clair temporaire.

---

## SECTION 7 : DONNÉES OFFLINESYNC -- GESTION SPÉCIALE

L'OfflineSyncAggregate a des exigences de backup spécifiques dues à son caractère offline-first. Les `pending_operations` ont un état fragile qui doit être préservé pendant la sauvegarde.

### Problématique Spéciale

Les pending operations sont des données en transit : localement créées mais pas encore confirmées par le serveur. Si une sauvegarde capture un état où certaines opérations ont été pushées mais pas confirmées (ou vice-versa), la restore peut créer des inconsistances dupliquées ou perdues.

### Procédure de Quiescence Avant Backup

Avant toute sauvegarde des données OfflineSyncAggregate, le système doit atteindre un état de quiescence :

```
1. Pause le Scheduler (CRT-009) --暂停 les jobs PushPendingOperations et ConflictDetectionScan
2. Flush final des pending operations
   - OfflineSyncService execute un PushPendingOperations forç
   - Attendre la confirmation de tous les batches pushés (ou timeout de 5 minutes)
3. Marquer toutes les operations avec un checkpoint_timestamp
4. Capturer le snapshot des tables pending_operations et sync_status_tracker
5. Reprendre les jobs du Scheduler normalement
6. Logger le flush + backup (AUDIT_LOG)
```

**Règles de quiescence** :
- **QUIESCE-001** : Le flush final avant backup est GARE par CRT-003 TransactionCoordinator (atomic au niveau aggregate).
- **QUIESCE-002** : Si le flush final timeout à 5 minutes, la sauvegarde proced quand même MAIS les operations non-confirmées sont marquées avec flag `backup_during_unconfirmed=true` pour investigation post-restore.
- **QUIESCE-003** : Après restore, les operations avec `backup_during_unconfirmed=true` sont placées en revue manuelle (pas de retry automatique).
- **QUIESCE-004** : Pendant le flush, les nouvelles operations locales sont toujours acceptées et ajoutées à la queue mais ne seront pushées qu'après le resume.

### Metrics Spéciales OfflineSync Backup

| Metric Name | Type | Description |
|-------------|------|-------------|
| `system.backup.sync.quiesce_duration_seconds` | Timer | Temps passé en état de quiescence pendant backup |
| `system.backup.sync.operations_flushed_before_backup` | Counter | Nombre d'opérations flushées avant capture du snapshot |
| `system.backup.sync.unconfirmed_at_backup_time` | Gauge | Nombre d'opérations non-confirmées au moment du backup |
| `system.backup.sync.revision_required_post_restore` | Counter | Opérations nécessitant révision manuelle post-restore |

---

## SECTION 8 : COMPLIANCE ET VALIDATION

### Règles non-négociables de conformité

1. **BP-001** : Toutes les données de niveau 1 sont couvertes par la sauvegarde continue WAL. Vérifiable par monitoring du WAL write rate.

2. **BP-002** : Les backups complets sont effectués chaque dimanche 02:00 UTC ± 30 minutes. Vérifiable par le Scheduler (CRT-009) logs.

3. **BP-003** : La rétention des audit logs respecte minimum 7 ans (RETENTION-031). Vérifiable par la métrique `business.audit.retention_compliance_age_years`.

4. **BP-004** : La vérification mensuelle automatisée s'exécute et rapporte un résultat PASS/FAIL. Vérifiable par la métrique `system.backup.verification.status`.

5. **BP-005** : Tous les backups sont chiffrés au repos. Vérifiable par inspection du storage (tout fichier de backup doit avoir le metadata de chiffrement).

6. **BP-006** : Les données OfflineSync sont en quiescence avant backup. Vérifiable par la présence d'entries `backup_quiesce_start` et `backup_quiesce_end` dans les logs.

7. **BP-007** : Aucune donnée de niveau 4 (éphémère) ne est sauvegardée explicitement. Vérifiable par absence de règles de backup pour les types de données de niveau 4.

### Matrice de traçabilité OPS-SPEC-005

| Section du Document | Source RTS-001 | Source ASS-001 | Source DOC-015 |
|--------------------|---------------|---------------|---------------|
| Section 1: Classification | CRT-003 (RepoPort), CRT-013 (CachePort), CRT-011 (ShutdownPipeline) | Tous services (données produites) | Tous invariants de persistance |
| Section 2: Stratégies | CRT-009 (Scheduler jobs), CRT-003 (Transaction WAL) | OfflineSyncService (SYNC-001) | NB-PERSIST rules |
| Section 3: Rétention | CRT-009 (PurgeSchedule) | -- | RETENTION-031 (7 ans min) |
| Section 4: Procedures | CRT-006 (LifecycleManager), CRT-001 (CompositionRoot) | -- | -- |
| Section 5: Vérification | CRT-009 (Scheduler automated verification) | -- | -- |
| Section 6: Chiffrement | CRT-008 (Diagnostics encryption reporting) | -- | BR-ID-001 (data sensitivity) |
| Section 7: OfflineSync | CRT-003 (TxCoord flush), CRT-011 (ShutdownPipeline) | OfflineSyncService | SYNC-001, SYNC-003 |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-25 | ops-specifier v1.0 | Création — Modèle de sauvegarde/restauration abstrait pour Lumina v1 | COMPLIANT (trace vérifié contre RTS-001, ASS-001, DOC-015) |

---

*Ce document définit le modèle de sauvegarde et restauration abstrait pour l'architecture Lumina v1. Il ne prescrit AUCUN outil concret (pas de AWS Backup, Azure Backup, Veeam, Veritas, etc.). L'implémentation technique des sauvegardes (stockage, chiffrement, compression, réplication) est déterminée par l'adapter de RepositoryPort/StoragePort choisi lors de la Phase 104 (ASSEMBLAGE ADAPTATORS, RTS-002).*
