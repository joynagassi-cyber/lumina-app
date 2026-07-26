# PostgreSQL Schema Pack v1 — Lumina

**Doc ID:** PG-Schema-v1 (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** SCHÉMA INITIAL GÉNÉRÉ À PARTIR DE ZÉRO  
**Date:** 2026-07-24  
**Générateur :** Schema Generator v1.0  
**Source canonique :** DOC-021 + DOC-023  
**Transformation :** Physical Object → Relational Structure → DDL  
**Règle IGS :** Étape 1 du pipeline IGS-v1 — aucune étape précédente requise  

---

## MARKERS DE TRACABILITÉ

Tous les artefacts contiennent les métadonnées IGS-v1 :
- `generation_id` : SHA-256 calculé à la génération
- `source_canonical` : DOC-021, DOC-023
- `transformation_rule` : schema-generator v1.0
- `architecture_version` : v1.0 (DOC-000 à DOC-024 + ARA-v1)
- `compliance_status` : COMPLIANT

---

## CONVENTIONS DU SCHÉMA

### Nommage des tables
Convention : pluriel snake_case (résultat de G-001 ARA-v1)
- organization → organizations
- org_unit → org_units
- user → users
- session_context → sessions
- credential → credentials
- transaction_record → transactions
- member_record → members
- event_record → events
- category_record → categories
- group_membership → group_memberships
- org_unit_parent_link → org_unit_links
- approval_workflow_instance → workflow_instances
- approval_workflow_step → workflow_steps
- workflow_execution_log → workflow_logs
- form_definition → forms
- form_section → form_sections
- form_field → form_fields
- notification_message → notifications
- notification_preference → notification_preferences
- notification_delivery_log → notification_logs
- vocab_namespace → vocab_namespaces
- vocab_term → vocab_terms
- vocab_term_value → vocab_values
- report_definition → reports
- generated_report_snapshot → report_snapshots
- audit_log_entry → audit_entries
- archive_entry → archives
- purge_schedule → purge_schedules
- setting_entry → settings
- pending_operation → pending_operations
- sync_status_tracker → sync_statuses

### Nommage des colonnes
- snake_case pour toutes les colonnes
- `_persist_version` → version (integer)
- `_sync_timestamp` → synced_at (timestamptz)
- `_local_timestamp` → local_updated_at (timestamptz)
- `_conflict_strategy` → conflict_strategy (varchar(32))
- `_tombstone` → is_deleted (boolean)
- `_purge_date` → purge_eligible_at (timestamptz)
- `_org_id` → org_id (uuid, NOT NULL)
- `_log_sequence` → log_position (bigint)
- `_sync_status` → sync_state (varchar(16))
- `_created_by` → created_by (uuid)
- `identifier` → id (uuid, PK)

### Timestamps standardisés
- created_at (timestamptz, DEFAULT now())
- updated_at (timestamptz, DEFAULT now())

### Identifiants
- Toutes les clefs primaires sont des UUID (gen_random_uuid())
- Références cross-aggregate par uuid FK uniquement
- Org isolation par org_id (uuid) sur TOUTES les tables

---

`HEREDOC_EOF`
echo "File created successfully"
