# IGS-v1 — Reserve Handling Appendix

**Doc ID:** IGS-v1-RHA (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** APPENDICE FIGÉ AU RAPPORT D'ARCHE RÉSERTIONS  
**Date:** 2026-07-24  
**Référence :** Traite les réserves de l'Architecture Readiness Assessment (ARA-v1) pour le pipeline de génération IGS-v1

---

## PRÉAMBULE

L'Architecture Readiness Assessment (ARA-v1) a rendu le verdict **GO AVEC RÉSERVES** pour les 24 documents canoniques DOC-000 à DOC-024.

Ce document définit comment CHAQUE réserve identifiée dans ARA-v1 est traitée par le pipeline de génération IGS-v1.

Les réserves sont classées en quatre catégories : **bloquantes** (empêchent la génération), **non-bloquantes** (génération possible avec revue), **améliorations** (bénéfiques mais non requises), et **informations** (à noter pour futur).

Seules les réserves bloquantes doivent être résolues AVANT toute génération. Les autres peuvent être traitées en parallèle du développement.

---

## RAPPEL DES RÉSERVES ARA-v1

| ID | Nom | Sévérité | Nature | Générer? |
|----|-----|----------|--------|----------|
| G-001 | Convention nommage tables | Mineure | Style | ✅ GO |
| G-002 | Références PostgreSQL dans DOC-001/006 | Majeure | Pollution canonique | ⚠️ GO AVEC REVUE |
| G-003 | Spécification Runtime Services | Amélioration | Complémentarité | ✅ GO |
| G-004 | Matrice RLS table×rôle explicite | Amélioration | RLS | ✅ GO INFÉRÉ |
| G-005 | Scénarios E2E complets | Mineure | Tests | ✅ GO LIMITÉ |
| G-006 | Exemple Manifest YAML complet hors canonique | Amélioration | Configuration | ✅ GO |

---

## TRAITEMENT DÉTAILLÉ DE CHAQUE RÉSERVE

### G-001 : Convention de nommage des tables — TRAITÉE PAR CONFIGURATION

**Description :** DOC-021 utilise des noms singuliers (`organization`, `org_unit`). Les conventions SQL courantes utilisent le pluriel (`organizations`, `org_units`). La règle de transformation n'est pas documentée.

**Classification :** Mineure — ne bloque PAS la génération.

**Traitement par le pipeline :**

Le `schema-generator` applique automatiquement la convention de nommage suivante :
```
Physical Object name (DOC-021) → Table name (SQL)
Rule: suffix "record" removed, name converted to plural snake_case
Examples:
  organization → organizations
  org_unit → org_units
  transaction_record → transaction_records
  member_record → member_records
  event_record → event_records
  category_record → categories
  approval_workflow_instance → approval_workflow_instances
  approval_workflow_step → approval_workflow_steps
  workflow_execution_log → workflow_execution_logs
  form_definition → form_definitions
  form_section → form_sections
  form_field → form_fields
  notification_message → notification_messages
  notification_preference → notification_preferences
  notification_delivery_log → notification_delivery_logs
  vocab_namespace → vocab_namespaces
  vocab_term → vocab_terms
  vocab_term_value → vocab_term_values
  report_definition → report_definitions
  generated_report_snapshot → generated_report_snapshots
  audit_log_entry → audit_log_entries
  archive_entry → archive_entries
  purge_schedule → purge_schedules
  setting_entry → settings
  pending_operation → pending_operations
  sync_status_tracker → sync_status_trackers
```

**Règle IGS :** Cette convention est documentée dans `schema-generator` comme transformation fixe. Si une convention différente est souhaitée, elle doit être configurée via un paramètre externe, jamais codée dans le générateur.

**Verdict : NON-BLOQUANT.** Aucune action requise avant génération.

---

### G-002 : Références PostgreSQL dans DOC-001 et DOC-006 — À RÉVIRER

**Description :** DOC-001 §Data Model Elements liste explicitement des noms de tables PostgreSQL (`organizations table`, `users table`, `transactions table`, etc.) et DOC-006 mentionne des persistance techniques (`organizations.table`, `GIN indexes`, `tsvector`, `CHECK constraint`, `self-ref FK`). Cette donnée contrevient à NB-PERSIST-010 de DOC-017.

**Classification :** Majeure — bloque PAS la génération MAIS nécessite une revue.

**Impact sur le pipeline :**

Lors de la génération, les générateurs DOIVENT ignorer toute référence technologique dans les noms de Physical Objects. Les références PostgreSQL dans DOC-001/006 sont considérées comme du bruit historique qui sera nettoyé ultérieurement.

**Règles d'application :**

1. Le `schema-generator` ignore toute occurrence de `table`, `.table`, `GIN`, `tsvector`, `CHECK constraint`, `self-ref FK` dans DOC-001 et DOC-006.
2. Le `test-generator` ne génère PAS de tests basés sur ces références technologiques.
3. L'élément `audit_log_entry` dans DOC-021 est mappé tel quel, sans présumer de GIN index ou tsvector trigger.

**Action corrective recommandée (hors pipeline) :**
Un document Data Model dédié devrait absorber les références PostgreSQL de DOC-001 et DOC-006. Ceci n'est PAS bloquant pour le pipeline IGS-v1 car les générateurs peuvent appliquer les règles ci-dessus pour filtrer le bruit.

**Verdict : NON-BLOQUANT avec revue.** La génération peut commencer en appliquant les règles de filtrage ci-dessus. Le nettoyage de DOC-001/006 se fait en parallèle.

---

### G-003 : Spécification Runtime Services — INFORMATION

**Description :** 9 Runtime Services catalogués dans DOC-001 avec une ligne de description chacun, mais aucune spécification détaillée de l'interface (inputs/outputs/methods) n'existe dans la série canonique.

**Classification :** Amélioration — ne bloque PAS la génération.

**Impact sur le pipeline :**

Les Runtime Services catalogués dans DOC-001 (§Runtime Services) influencent la configuration de déploiement. Le `deployment-config-generator` utilise cette information pour créer les containers correspondants.

Si une spécification d'interface est manquante, elle est inférée depuis les Dependencies de DOC-005 (Capability Dependency Graph). Chaque Runtime Service est invoqué par les Capabilities qui l'utilisent.

**Verdict : NON-BLOQUANT.** Les specs Runtime Services peuvent être dérivées du DAG de DOC-005.

---

### G-004 : Matrice RLS table×rôle explicite — INFÉRÉE AUTOMATIQUEMENT

**Description :** L'isolement multi-tenant (`_org_id`) est documenté partout, mais une matrice explicite (table × rôle × permissions) pour la génération des politiques RLS n'existe pas.

**Classification :** Amélioration — les principes RLS sont suffisants pour la génération.

**Impact sur le pipeline :**

Le `rls-generator` infère la matrice RLS suivante depuis DOC-012 + DOC-015 :

| Table / Physical Object | Rôle | Permissions | Source |
|------------------------|------|-------------|--------|
| Toutes les tables | superadmin | ALL (bypass RLS) | DOC-012 §IdentityAggregate |
| Toutes les tables | admin | ALL dans son org | DOC-012 §IdentityAggregate |
| Tables finance | treasurer | SELECT/INSERT sur transactions | DOC-012 §ResourceAggregate |
| Tables members | staff | SELECT sur member_record | DOC-012 §ResourceAggregate |
| Tables audit | auditor | SELECT sur audit_log_entry uniquement | DOC-015 AUD-003/AUD-004 |
| Toutes les tables | user | READ uniquement sur ses propres données | DOC-012 §IdentityAggregate |

La政策 RLS universelle `USING (org_id = current_setting('request.org_id')::uuid)` s'applique à TOUTES les tables.

Des overrides spécifiques (ex: audit accessible aux auditeurs uniquement) sont documentés dans DOC-015 AUD-003/AUD-004.

**Verdict : NON-BLOQUANT.** La matrice est dérivable des documents canoniques existants.

---

### G-005 : Scénarios E2E complets — LIMITÉ AUX UNIT TESTS

**Description :** Aucun document ne couvre les scénarios E2E complets. La chaîne complète est décrite dans DOC-002 (Traceability Matrix) mais pas sous forme de user journey testable.

**Classification :** Mineure — les tests unitaires couvrent l'essentiel.

**Impact sur le pipeline :**

Le `test-generator` ne génère QUE des tests unitaires et des tests d'intégration par Aggregate. Les tests E2E (flux complets de bout en bout) NE SONT PAS générés.

Règle : Chaque invariant CRITIQUE DOC-015 → au moins 1 test unitaire "violation" + 1 test "respect". Les scenarii E2E nécessitent une spécification manuelle séparée.

**Verdict : NON-BLOQUANT.** La couverture unitaire est suffisante pour démarrer. Les E2E tests viennent en phase 2.

---

### G-006 : Exemple Manifest YAML complet hors canonique — INFORMATIONS

**Description :** Un exemple concret de manifest YAML complet n'existe pas dans les documents canoniques. Il existe dans `docs/03-configuration/mfejc-manifest-example.md` mais ce fichier NE FAIT PAS PARTIE de l'audit canonique.

**Classification :** Amélioration — la structure du manifest est couverte par DOC-001 + DOC-012 + DOC-019.

**Impact sur le pipeline :**

Le `deployment-config-generator` et les autres générateurs nécessitant une connaissance de la structure du manifest peuvent utiliser les sections suivantes (toutes cataloguées dans DOC-001 ou DOC-012) :

| Section du Manifest | Document source | Contenu |
|---------------------|-----------------|---------|
| `lifecycle.types[]` | DOC-012 §LifecycleAggregate | archivable types |
| `forms_overrides[]` | DOC-012 §FormAggregate | form override mappings |
| `workflow_overrides[]` | DOC-012 §WorkflowAggregate | workflow step overrides |
| `roles[]` | DOC-012 §IdentityAggregate | RBAC roles avec permissions |
| `vocabularies[]` | DOC-019 §VocabularyAggregate | namespaces/terms/values |
| `branding` | DOC-001 §Branding | accent_hex, logo_url, presets |
| `settings` | DOC-012 §ConfigurationAggregate | key-value pairs |
| `permissions` | DOC-015 §CFG invariants | ISO 4217, IANA timezone, hex patterns |

**Verdict : NON-BLOQUANT.** La structure du manifest est entièrement dérivable des documents canoniques.

---

## RÉSUMÉ DU TRAITEMENT DES RÉSERVES

| Réserv | Bloque? | Action pipeline | Statut avant génération |
|--------|---------|-----------------|------------------------|
| G-001 | ❌ Non | Convention de nommage appliquée automatiquement | ✅ Prêt |
| G-002 | ⚠️ Avec filtre | Générateurs filtrent références PostgreSQL | ✅ Prêt avec filtre |
| G-003 | ❌ Non | Specs inférées depuis DOC-005 DAG | ✅ Prêt |
| G-004 | ❌ Non | Matrice RLS inférée depuis DOC-012+DOC-015 | ✅ Prêt |
| G-005 | ❌ Non | Tests unitaires ONLY (pas E2E) | ✅ Prêt limité |
| G-006 | ❌ Non | Structure du manifest dérivée de DOC-001/012/019 | ✅ Prêt |

**CONCLUSION :** Aucune réserve ne bloque la génération. Toutes sont traitables soit par configuration automatique, soit par infération depuis les documents canoniques existants.

---

## ANNEXE — COMMENT NOUVELLES RÉSERVES SERAIENT TRAITÉES

Si une nouvelle réserve est découverte lors de la génération :

1. **Cataloguer la réserve** : ID unique, description, impact sur quel générateur
2. **Classifier la sévérité** : Bloquante / Non-bloquante avec revue / Amélioration / Information
3. **Déterminer le traitement** :
   - Bloquante → STOP génération, correction documentaire requise AVANT reprise
   - Non-bloquante avec revue → Génération en cours, revue planifiée dans ≤ 2 jours
   - Amélioration → Documentée mais génération continue
   - Information → Notée, génération continue
4. **Documenter dans cet appendice** : Ajouter une entrée au tableau principal

Cette procédure garantit que les nouvelles réserves sont traitées systématiquement et traçables.

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un appendice de l'Implementation Generation Specification qui dépend entièrement de l'architecture canonique et de l'ARA-v1.*
