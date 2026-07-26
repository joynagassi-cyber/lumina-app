# Constraints & Index Specification — Lumina v1

**Doc ID:** IGS-v1-CI (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** CONTRAINTES ET INDEX GÉNÉRÉS À PARTIR DE ZÉRO  
**Date:** 2026-07-24  
**Générateur :** Constraint & Index Generator v1.0  
**Source canonique :** DOC-023 + DOC-015 + DOC-021  
**Transformation :** Physical Object → Contraintes → Index  
**Règle IGS :** Étape 3 du pipeline IGS-v1  

---

## MARKERS DE TRACABILITÉ

Chaque contrainte et index contient les métadonnées IGS-v1 :

```sql
-- === IGS METADATA ===
-- generation_id: SHA-256(at-content)
-- source_canonical: ["DOC-023", "DOC-015"]
-- transformation_rule: "constraint-index-generator v1.0"
-- generation_date: "2026-07-24T10:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- compliance_status: "COMPLIANT"
-- =====================
```

---

## CONTRAT DE DÉPENDANCES

Ce document dépend des artefacts générés aux étapes précédentes :
- Étape 1 : Schéma SQL (32 tables dans PostgreSQL DDL Spec)
- Étape 2 : Migrations (à générer à partir du schéma)

Les contraintes et index ci-dessous s'appuient sur le schéma déjà défini et ajoutent uniquement les contraintes sémantiques et les indices de performance. Aucune contrainte ne crée de règle métier supplémentaire — toutes sont dérivées des invariants DOC-015 et des règles relationnelles DOC-023.

---

## 1. CONTRAINTES DE NON-NULLITÉ

Ces contraintes garantissent que tous les attributs requis par DOC-021 sont physiquement enforced.

| Table | Colonne | Invariant DOC-015 | Règle DOC-023 |
|-------|---------|-------------------|---------------|
| organizations | nom, statut, devise_iso4217, fuseau_horaire, langue_privee, accent_hex, org_id | CC-ORG-001 | NB-RR-001 |
| org_units | org_id, nom, type_unite, niveau_profondeur, statut, chemin_hierarchique | CC-ORGU-001 | NB-RR-001 |
| users | org_id, prenom, nom_famille, adresse_email, role_utilisateur, statut | CC-USER-001 | NB-RR-001 |
| sessions | user_id, hachage_refresh_token, date_expiration, est_active, informations_appareil | NB-RR-001 | NB-RR-001 |
| credentials | user_id, hachage_mot_de_passe | CC-CRED-002 | NB-RR-001 |
| transactions | org_id, montant, type_transaction, statut, categorie_ref, portee_type, date_transaction | FIN-002, CC-TXN-001 | NB-RR-001 |
| members | org_id, prenom, nom_famille, statut_membre, numero_membre, date_entree | MEM-001 | NB-RR-001 |
| events | org_id, titre, type_evenement, date_debut, date_fin, statut | CC-EVT-001 | NB-RR-001 |
| categories | org_id, cle_vocabulaire, libelle, active | CC-CAT-001 | NB-RR-001 |
| group_memberships | org_id, membre_id, groupe_id, date_adhesion | CC-MEM-GRP-001 | NB-RR-001 |
| org_unit_links | org_id, enfant_id, parent_id | CC-REL-001 | NB-RR-001 |
| workflow_instances | org_id, ressource_type, ressource_id, definition_key, etape_courante, total_etapes, statut | CC-WF-001 | NB-RR-001 |
| workflow_steps | instance_id, ordre, type_etape, assigne_a_role, statut, timeout_jours | CC-WF-001 | NB-RR-001 |
| workflow_logs | instance_id, action, execute_par, date_heure | NB-PERSIST-006 | NB-RR-001 |
| forms | org_id, cle_formulaire, reference_modele, version_semantique | CC-FRM-001 | NB-RR-001 |
| form_sections | definition_id, ordre, titre_fr, titre_en | CC-FRM-002 | NB-RR-001 |
| form_fields | section_id, nom_champ, label_fr, label_en, type_champ, requier | BR-FRM-001 | NB-RR-001 |
| notifications | org_id, destinataire_user_id, sujet_fr, sujet_en, corps_fr, corps_en, canal, severite, statut_notification | CC-NOT-001 | NB-RR-001 |
| notification_preferences | user_id, canaux_autorises, severite_minimale, limite_taux_max | CC-PREF-001 | NB-RR-001 |
| notification_logs | message_id, canal, tentative_num, resultat, date_heure | NB-RR-001 | NB-RR-001 |
| vocab_namespaces | org_id, cle_namespace | CC-VOC-NS-001 | NB-RR-001 |
| vocab_terms | namespace_id, cle_term, label_fr, label_en | CC-VOC-TERM-001 | NB-RR-001 |
| vocab_values | term_id, cle_valeur, libelle_fr, libelle_en | CC-VOC-TERM-002 | NB-RR-001 |
| reports | org_id, cle_rapport, titre_fr, titre_en, periode_type, format_export | NB-RR-001 | NB-RR-001 |
| report_snapshots | org_id, periode_debut, periode_fin, portee, total_revenu, total_depense, resultat_net, details_par_categorie, nombre_transactions | BR-RPT-001 | NB-RR-001 |
| audit_entries | org_id, sequence_log, action_effectuee, entite_type, entite_id, utilisateur_id, valeur_avant, valeur_apres, date_heure_utc, duree_retention_annees | AUD-002, AUD-004 | NB-PERSIST-006 |
| archives | org_id, type_resource_archives, resource_type_original, resource_id_original, etat_lifecycle, date_archivage | CC-LIF-001 | NB-RR-001 |
| purge_schedules | org_id, entry_id, etats_eligibles, programme_par_systeme, date_planifiee | CC-LIF-003 | NB-RR-001 |
| settings | org_id, cle_parametre, valeur, valeur_defaut | CC-CFG-001 | NB-RR-001 |
| pending_operations | org_id, resource_type, resource_id, action, payload, statut_sync, tentative_num | CC-SYNC-001 | NB-RR-001 |
| sync_statuses | org_id, table_reference, derniere_synchro_timestamp, etat_connection | CC-SYNC-003 | NB-RR-001 |

---

## 2. CONTRAINTES D'UNICITÉ

Chaque contrainte d'unicité est tracée vers un invariant ou une contrainte conceptuelle de DOC-021.

| Table | Colonnes | Source | Justification |
|-------|----------|--------|--------------|
| organizations | (nom) | CC-ORG-001 | Nom unique au niveau global |
| users | (adresse_email, org_id) | CC-USER-001, MEM-001 | Email unique par org (DOC-015 INV-ID-003) |
| org_settings | (cle_parametre, org_id) | CC-ORGS-001 | Paramètre unique par org |
| group_memberships | (membre_id, groupe_id) | CC-MEM-GRP-002 | Pas de duplication membership |
| vocab_namespaces | (cle_namespace, org_id) | CC-VOC-NS-001 | Namespace unique par org |
| vocab_terms | (cle_term, namespace_id) | CC-VOC-TERM-001 | Terme unique par namespace |
| settings | (cle_parametre, org_id) | CC-CFG-001 | Setting unique par org |
| credentials | (user_id) | CC-CRED-001 | Un credential par user (1:1) |
| notification_preferences | (user_id) | CC-PREF-001 | Préférences 1:1 par user |
| sync_statuses | (table_reference, org_id) | CC-SYNC-004 | Status unique par table par org |

---

## 3. CONTRAINTES DE RÉFÉRENCE (FOREIGN KEY)

Toutes les clés étrangères respectent les règles de relation de DOC-023 §3.

### 3.1 Relations 1:N

| Table parente | Table fille | Colonne FK | On Delete | Justification |
|---------------|-------------|-----------|-----------|--------------|
| organizations | org_units | org_id | CASCADE | OrgUnits appartiennent à l'org |
| organizations | users | org_id | CASCADE | Users appartiennent à l'org |
| users | sessions | user_id | CASCADE | Sessions liées生命周期 à l'user |
| users | credentials | user_id | CASCADE | 1:1 compositionnelle |
| organizations | transactions | org_id | CASCADE | Transactions scoped à l'org |
| users | transactions | created_by | SET NULL | Traçabilité du créateur |
| transactions | transactions | compense_for | SET NULL | Compensation link |
| org_units | transactions | portee_cible_id | SET NULL | Scope target |
| vocab_values | transactions | categorie_ref | RESTRICT | Catégories vocabulary non supprimées |
| organizations | members | org_id | CASCADE | Members scoped to org |
| users | members | created_by | SET NULL | Traçabilité du créateur |
| organizations | events | org_id | CASCADE | Events scoped to org |
| users | events | created_by | SET NULL | Traçabilité du créateur |
| users | events | responsable | SET NULL | Organisateur optionnel |
| organizations | categories | org_id | CASCADE | Categories scoped to org |
| members | group_memberships | membre_id | RESTRICT | Member historique conservé |
| org_units | group_memberships | groupe_id | RESTRICT | Membership historique conservé |
| organizations | workflow_instances | org_id | CASCADE | Workflows scoped to org |
| workflow_instances | workflow_steps | instance_id | CASCADE | Steps tied to instance |
| workflow_instances | workflow_logs | instance_id | CASCADE | Logs tied to instance |
| workflow_steps | workflow_logs | etape_id | SET NULL | Step reference optional |
| organizations | forms | org_id | CASCADE | Forms scoped to org |
| forms | form_sections | definition_id | CASCADE | Sections part of form |
| form_sections | form_fields | section_id | CASCADE | Fields part of section |
| organizations | notifications | org_id | CASCADE | Notifications scoped to org |
| users | notifications | destinataire_user_id | RESTRICT | Notification historique conservé |
| notifications | notification_logs | message_id | CASCADE | Log tied to notification |
| organizations | vocab_namespaces | org_id | CASCADE | Namespaces scoped to org |
| vocab_namespaces | vocab_terms | namespace_id | CASCADE | Terms part of namespace |
| vocab_terms | vocab_values | term_id | CASCADE | Values part of term |
| organizations | reports | org_id | CASCADE | Report definitions scoped to org |
| reports | report_snapshots | definition_id | SET NULL | Snapshot optional link |
| organizations | audit_entries | org_id | CASCADE | Audit scoped to org |
| users | audit_entries | utilisateur_id | RESTRICT | Audit historique conservé |
| organizations | archives | org_id | CASCADE | Archives scoped to org |
| members | archives | member_lie_id | SET NULL | Link optional |
| archives | purge_schedules | entry_id | CASCADE | Schedule tied to archive |
| organizations | settings | org_id | CASCADE | Settings scoped to org |
| users | settings | mis_a_jour_par | SET NULL | Audit trail |
| organizations | pending_operations | org_id | CASCADE | Operations scoped to org |
| organizations | sync_statuses | org_id | CASCADE | Status scoped to org |

### 3.2 Relations N:N

| Entités impliquées | Table intermédiaire | Justification |
|---------------------|-------------------|--------------|
| members ↔ org_units | group_memberships | Many-to-many (membership groups) |
| org_units ↔ org_units | org_unit_links | Self-referencing DAG hierarchy |

### 3.3 Relations 1:1

| Entités impliquées | Contrainte | Justification |
|---------------------|-----------|--------------|
| users ↔ credentials | UNIQUE(user_id) sur credentials | 1:1 compositionnelle |
| users ↔ notification_preferences | UNIQUE(user_id) sur notification_preferences | 1:1 par user |

---

## 4. CONTRAINTES DE DOMAINE (CHECK)

Ces contraintes traduisent les invariants DOC-015 en règles physiques vérifiables.

| Table | Contrainte | Expression SQL | Source DOC-015 | Justification |
|-------|-----------|---------------|---------------|--------------|
| transactions | Montant positif | `CHECK (montant > 0)` | FIN-002 | AmountInCents always positive BIGINT |
| transactions | Date pas dans le futur | `CHECK (date_transaction <= CURRENT_DATE)` | DATE-001 | Transaction date never future |
| transactions | Stats valides | `CHECK (statut IN ('draft','pending','approved','rejected'))` | BR-RES-001 | ResourceState state machine |
| transactions | Portée valide | `CHECK (portee_type IN ('org','group'))` | SCOPE-001 | Scope enum from Category |
| transactions | Compensé par transaction existante | `FOREIGN KEY (compense_for) REFERENCES transactions(id)` | COMP-001 | Correction links to approved tx |
| org_units | Profondeur max 5 | `CHECK (niveau_profondeur BETWEEN 1 AND 5)` | REL-002, BR-ORG-002 | Depth ≤ 5 |
| org_units | Status valide | `CHECK (statut IN ('active','archived'))` | LIF-001 | Lifecycle states |
| users | Rôle valide | `CHECK (role_utilisateur IN ('superadmin','admin','treasurer','pastor','staff'))` | BR-ID-005 | Role hierarchy |
| users | Status valide | `CHECK (statut IN ('active','inactive','deactivated'))` | MEM-010 | Member status enum |
| sessions | Expiration future | `CHECK (date_expiration > CURRENT_TIMESTAMP)` | BR-ID-006 | Sessions have future expiry |
| groups_memberships | Statut valide | `CHECK (statut IN ('active','archived'))` | LIF-001 | Lifecycle states |
| workflow_steps | Timeout ≤ 30j | `CHECK (timeout_jours > 0 AND timeout_jours <= 30)` | WF-001 | Workflow timeout max 30 days |
| workflow_steps | Type étape valide | `CHECK (type_etape IN ('auto','approval','notification','conditional','delay','parallel'))` | WF-001 | Step type enum |
| workflows | Status valide | `CHECK (statut IN ('running','completed','failed','cancelled'))` | WF-002 | Workflow state machine |
| forms | Type champ valide | `CHECK (type_champ IN ('text','number','date','select','multiselect','file_upload','signature','textarea'))` | BR-FRM-001 | Form field type enum |
| notifications | Canal valide | `CHECK (canal IN ('in_app','push','email','sms'))` | NOT-003 | Channel type enum |
| notifications | Sévérité valide | `CHECK (severite IN ('info','warning','critical'))` | NOT-004 | Severity enum |
| notifications | Status valide | `CHECK (statut_notification IN ('queued','sending','sent','failed','read'))` | NOT-001 | Notification status machine |
| vocab_terms | Termes dépréciés conservés | `est_deprecie BOOLEAN DEFAULT FALSE` | VOC-001 | Never delete, only deprecate |
| report_snapshots | Bilan équilibré | `CHECK (resultat_net = total_revenu - total_depense)` | BAL-001 | Balance equation Actif = Passif + Résultat |
| audit_entries | Actions valides | `CHECK (action_effectuee IN ('create','update','delete','approve','reject','transfer','notify','other'))` | AUD-001 | Action type enum |
| archives | État lifecycle valide | `CHECK (etat_lifecycle IN ('active','archived','trashed','purged'))` | LIF-001 | Lifecycle state machine |
| archives | Type resource valide | `CHECK (resource_type_original IN ('transaction','member','event','archive_entry'))` | BR-LIF-002 | Archiveable resource types |
| pending_operations | Action valide | `CHECK (action IN ('create','update','delete'))` | SYNC-001 | Sync action enum |
| pending_operations | Tentative ≤ 5 | `CHECK (tentative_num <= 5)` | SYNC-003 | Retry exponential backoff max 5 |
| pending_operations | Resource type valide | `CHECK (resource_type IN ('transaction','member','event','archive_entry'))` | SYNC-001 | Same as archives resource_type |
| notification_logs | Résultat valide | `CHECK (resultat IN ('success','failure','retry'))` | NOT-002 | Delivery result enum |
| sync_statuses | Connexion valide | `CHECK (etat_connection IN ('online','offline'))` | SYNC-001 | Connection state enum |
| events | Date fin > début | `CHECK (date_fin > date_debut)` | CC-EVT-001 | Event logical constraint |
| events | Statut valide | `CHECK (statut IN ('draft','published','cancelled','completed'))` | CC-EVT-002 | Event status enum |
| categories | Couleur valide hex | `CHECK (couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$')` | CFG-003 | Color hex validation |
| settings | Valeur default toujours présente | `valeur_defaut jsonb NOT NULL DEFAULT '{}'` | CFG-004 | All settings have default fallback |
| organizations | Type org valide | `CHECK (type_org IN ('church','school','ngo','company','custom'))` | BR-ORG-001 | Organization type enum |
| organizations | Status valide | `CHECK (statut IN ('active','suspended','archived'))` | CC-ORG-003 | Org status enum |
| organizations | Accent hex valide | `CHECK (accent_hex ~ '^#[0-9a-fA-F]{6}$')` | CFG-003 | Color hex pattern |
| organizations | Statut archived irréversible | `ALTER TABLE organizations ADD CONSTRAINT chk_statut_archived_irreversible CHECK (NOT (statut = 'archived' AND LAG(statut) OVER (ORDER BY updated_at) = 'active'))` | CC-ORG-003 | Archived cannot return to active |

---

## 5. INDEX

Index organisés par catégorie de performance.

### 5.1 Index multi-tenant (sur TOUS les objets physiques)

Toutes les tables avec `_org_id` dans DOC-021 ont un index sur `org_id`. C'est une règle canonique de DOC-023 §8.

| Table | Index | Type |
|-------|-------|------|
| organizations | idx_organizations_org_id | B-tree UNIQUE |
| org_units | idx_org_units_org_id | B-tree |
| org_settings | idx_org_settings_org_id | B-tree |
| users | idx_users_org_id | B-tree |
| sessions | idx_sessions_org_id | B-tree |
| credentials | idx_credentials_org_id | B-tree |
| transactions | idx_transactions_org_id | B-tree |
| members | idx_members_org_id | B-tree |
| events | idx_events_org_id | B-tree |
| categories | idx_categories_org_id | B-tree |
| group_memberships | idx_group_memberships_org_id | B-tree |
| org_unit_links | idx_org_unit_links_org_id | B-tree |
| workflow_instances | idx_workflow_instances_org_id | B-tree |
| workflow_steps | idx_workflow_steps_org_id | B-tree |
| workflow_logs | idx_workflow_logs_org_id | B-tree |
| forms | idx_forms_org_id | B-tree |
| form_sections | idx_form_sections_org_id | B-tree |
| form_fields | idx_form_fields_org_id | B-tree |
| notifications | idx_notifications_org_id | B-tree |
| notification_preferences | idx_notification_preferences_org_id | B-tree |
| notification_logs | idx_notification_logs_org_id | B-tree |
| vocab_namespaces | idx_vocab_namespaces_org_id | B-tree |
| vocab_terms | idx_vocab_terms_org_id | B-tree |
| vocab_values | idx_vocab_values_org_id | B-tree |
| reports | idx_reports_org_id | B-tree |
| report_snapshots | idx_report_snapshots_org_id | B-tree |
| audit_entries | idx_audit_entries_org_id | B-tree |
| archives | idx_archives_org_id | B-tree |
| purge_schedules | idx_purge_schedules_org_id | B-tree |
| settings | idx_settings_org_id | B-tree |
| pending_operations | idx_pending_operations_org_id | B-tree |
| sync_statuses | idx_sync_statuses_org_id | B-tree |

### 5.2 Index de performance (par cas d'usage)

| Table | Index | Raison | Cas d'usage |
|-------|-------|--------|------------|
| transactions | idx_statut | Query by status | Dashboard filtering |
| transactions | idx_date_transaction | Temporal queries | Balance calculation by period |
| transactions | idx_compense_pour | Compensation tracking | Audit trail for corrections |
| transactions | idx_est_synchronise | Sync filtering | Offline-first push/pull |
| members | idx_statut_membre | Filter by membership status | Roster queries |
| members | idx_numero_membre | Unique member ID lookup | Quick member access |
| events | idx_date_debut | Calendar queries | Event listing by date |
| groups_memberships | idx_membre_id | Query groups by member | Group membership view |
| groups_memberships | idx_groupe_id | Query members by group | Group roster |
| workflow_instances | idx_statut | Query running/completed workflows | Approval queue |
| workflow_steps | idx_instance_id | Query steps for an instance | Workflow progress view |
| workflow_steps | idx_timeout | Detect expired steps | Escalation monitoring |
| forms | idx_cle_formulaire | Fast form lookup | Form loading by key |
| notifications | idx_destinataire_user_id | User inbox | Personalized notifications |
| notifications | idx_statut_notification | Delivery status tracking | Send queue management |
| audit_entries | idx_entite_type | Entity-specific queries | Audit by entity type |
| audit_entries | idx_entite_id | Entity-specific queries | Audit by entity ID |
| audit_entries | idx_date_heure_utc | Temporal queries | Audit by time range |
| audit_entries | idx_utilisateur_id | Actor queries | Audit by user action |
| archives | idx_etat_lifecycle | State machine queries | Archive browsing |
| archives | idx_resource_type_original | Archive by resource | Archive search by type |
| archives | idx_resource_id_original | Archive by original resource | Archive linking |
| pending_operations | idx_statut_sync | Sync queue processing | Push coordinator |
| pending_operations | idx_resource_type | Type-based sync | Selective sync |
| sync_statuses | idx_table_reference | Status per table | Sync monitoring |

### 5.3 Index GIN (pour JSONB)

Seules les tables avec colonnes jsonb nécessitent des index GIN :

| Table | Colonne | Index type | Raison |
|-------|---------|-----------|--------|
| org_settings | valeur_parametre | GIN | Structured setting values search |
| settings | valeur | GIN | Setting value queries |
| archives | metadonnees_archive | GIN | Extensible archive metadata |
| form_fields | condition_visibilite | GIN | Conditional visibility expressions |

### 5.4 Index EXCLUS (non autorisés)

Les index suivants NE SONT PAS CRÉÉS car ils sont prématurés ou non justifiés :

- Index sur `created_at` : trop courant, impacte performances sans bénéfice mesurable
- Index sur `updated_at` : remplacé par queries temporelles limitées
- Index composite sur toutes les colonnes JSONB : sur-performance non nécessaire
- Index FULL-TEXT sur descriptions : reporté à une phase ultérieure si besoin

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Contraintes + Index dérivés de DOC-023 + DOC-015 + DOC-021 | COMPLIANT |

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un artefact technique dérivé directement du modèle physique canonique. Toute divergence entre les contraintes/index et les documents canoniques est une violation bloquante.*
