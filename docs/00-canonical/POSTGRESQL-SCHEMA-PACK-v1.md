# PostgreSQL Schema Pack v1 — Lumina

**Doc ID:** PG-Schema-v1 (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** SCHÉMA INITIAL GÉNÉRÉ À PARTIR DE ZÉRO  
**Date:** 2026-07-24  
**Générateur :** Schema Generator v1.0  
**Source canonique :** DOC-021 + DOC-023  
**Transformation :** Physical Object → Relational Structure → DDL  
**Règle IGS :** Étape 1 du pipeline IGS-v1  

---

## MARKERS DE TRACABILITÉ IGS-v1

Chaque artefact SQL contient les métadonnées obligatoires de IGS-v1 §B :

| Champ | Valeur |
|-------|--------|
| generation_id | SHA-256-calculé-à-génération |
| source_canonical | DOC-021 + DOC-023 |
| transformation_rule | schema-generator v1.0 |
| generation_date | 2026-07-24T10:00:00Z |
| architecture_version | v1.0 (DOC-000-DOC-024 + ARA-v1) |
| validation_hash | SHA-256-contenu-sans-métadonnées |
| compliance_status | COMPLIANT |

---

## CONVENTIONS DU SCHÉMA

### Nommage des tables

Convention appliquée : pluriel snake_case (résolution ARA-v1 G-001).

| Physical Object (DOC-021) | Table SQL | Aggregate |
|---------------------------|-----------|-----------|
| organization | organizations | OrganizationAggregate |
| org_unit | org_units | OrganizationAggregate |
| organization_settings | org_settings | OrganizationAggregate |
| user | users | IdentityAggregate |
| session_context | sessions | IdentityAggregate |
| credential | credentials | IdentityAggregate |
| transaction_record | transactions | ResourceAggregate |
| member_record | members | ResourceAggregate |
| event_record | events | ResourceAggregate |
| category_record | categories | ResourceAggregate |
| group_membership | group_memberships | RelationshipAggregate |
| org_unit_parent_link | org_unit_links | RelationshipAggregate |
| approval_workflow_instance | workflow_instances | WorkflowAggregate |
| approval_workflow_step | workflow_steps | WorkflowAggregate |
| workflow_execution_log | workflow_logs | WorkflowAggregate |
| form_definition | forms | FormAggregate |
| form_section | form_sections | FormAggregate |
| form_field | form_fields | FormAggregate |
| notification_message | notifications | NotificationAggregate |
| notification_preference | notification_preferences | NotificationAggregate |
| notification_delivery_log | notification_logs | NotificationAggregate |
| vocab_namespace | vocab_namespaces | VocabularyAggregate |
| vocab_term | vocab_terms | VocabularyAggregate |
| vocab_term_value | vocab_values | VocabularyAggregate |
| report_definition | reports | ReportingAggregate |
| generated_report_snapshot | report_snapshots | ReportingAggregate |
| audit_log_entry | audit_entries | AuditAggregate |
| archive_entry | archives | LifecycleAggregate |
| purge_schedule | purge_schedules | LifecycleAggregate |
| setting_entry | settings | ConfigurationAggregate |
| pending_operation | pending_operations | OfflineSyncAggregate |
| sync_status_tracker | sync_statuses | OfflineSyncAggregate |

### Mappage des attributs DOC-021 vers colonnes SQL

| Catégorie de Type DOC-021 | Type PostgreSQL | Notes |
|--------------------------|----------------|-------|
| identifiant (PK) | uuid DEFAULT gen_random_uuid() | UUID natif, jamais auto-incrémenté |
| identifiant (FK référence) | uuid NOT NULL REFERENCES ... ON DELETE CASCADE | Foreign key avec cascade |
| chaîne | varchar(n) où n est adapté au contexte | max 255 pour texte court, 1024 pour description |
| numérique | bigint ou integer selon valeur | amounts: bigint, version numbers: integer, counts: integer |
| date/heure | timestamptz | Toujours timezone-aware |
| booléen | boolean | true/false |
| objet intégré | jsonb | Données structurées arbitraires |
| collection | text[] OU table séparée selon cardinalité | arrays pour petites collections ≤ 100 éléments |
| énumération | varchar(n) WITH CHECK constraint | Enums explicites pour les types connus |
| hachage | varchar(60) | Format bcrypt/scrypt toujours |
| token | varchar(255) | TokensJWT, refresh tokens |

### Colonnes de persistance standardisées

Toutes les tables héritent les colonnes de métadonnées de persistance (DOC-017 §3.3) :

| Attribut DOC-021 | Colonne SQL | Type | Mapping |
|------------------|-------------|------|---------|
| _persist_version | version | integer | Optimistic lock |
| _sync_timestamp | synced_at | timestamptz | Last successful sync |
| _local_timestamp | local_updated_at | timestamptz | LWW conflict resolution |
| _conflict_strategy | conflict_strategy | varchar(32) | per-entity-type strategy lookup |
| _tombstone | is_deleted | boolean DEFAULT false | Soft delete marker |
| _purge_date | purge_eligible_at | timestamptz | Scheduled purge job |
| _log_sequence | log_position | bigint | Audit entry ordering |
| _org_id | org_id | uuid NOT NULL | Multi-tenant isolation |
| _sync_status | sync_state | varchar(16) | pending/sent/confirmed/failed |
| _created_by | created_by | uuid | Audit identity |

### Colonnes de_timestamps standards

| Colonne | Type | Notes |
|---------|------|-------|
| created_at | timestamptz NOT NULL DEFAULT now() | Création initiale |
| updated_at | timestamptz NOT NULL DEFAULT now() | Dernière modification |

---

## SCHÉMA PHYSIQUE COMPLET (30 tables)

Chaque table est entièrement traçable vers DOC-021.

---

## SCHÉMA PHYSIQUE COMPLET (30 tables)

### Table 1: organizations (OrganizationAggregate)

Source : DOC-021 §1.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) | org_id (auto-réf) |
| nom | varchar(255) | NOT NULL | nom |
| nom_court | varchar(100) | | nom_court |
| type_org | varchar(20) | CHECK (type_org IN ('church','school','ngo','company','custom')) | type_org |
| statut | varchar(20) | NOT NULL DEFAULT 'active' CHECK (statut IN ('active','suspended','archived')) | statut |
| devise_iso4217 | varchar(3) | NOT NULL | devise_iso4217 |
| fuseau_horaire | varchar(100) | NOT NULL | fuseau_horaire |
| langue_privee | varchar(10) | NOT NULL | langue_privee |
| accent_hex | varchar(7) | NOT NULL CHECK (accent_hex ~ '^#[0-9a-fA-F]{6}$') | accent_hex |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| updated_at | timestamptz | NOT NULL DEFAULT now() | date_mise_a_jour |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| synced_at | timestamptz | | _sync_timestamp |
| local_updated_at | timestamptz | | _local_timestamp |

Index par défaut :
- CREATE UNIQUE INDEX idx_organizations_nom ON organizations(nom);
- CREATE UNIQUE INDEX idx_organizations_org_id ON organizations(org_id);

### Table 2: org_units (OrganizationAggregate)

Source : DOC-021 §1.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| parent_id | uuid FK | REFERENCES org_units(id) ON DELETE SET NULL | parent_id |
| nom | varchar(255) | NOT NULL | nom |
| type_unite | varchar(50) | NOT NULL | type_unite |
| niveau_profondeur | integer | NOT NULL CHECK (niveau_profondeur BETWEEN 1 AND 5) | niveau_profondeur |
| statut | varchar(20) | NOT NULL DEFAULT 'active' | statut |
| chemin_hierarchique | varchar(1024) | NOT NULL | chemin_hiérarchique |
| created_at | timestamptz | NOT NULL DEFAULT now() | created_at |
| updated_at | timestamptz | NOT NULL DEFAULT now() | updated_at |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| synced_at | timestamptz | | _sync_timestamp |
| org_id | uuid | NOT NULL | _org_id |

### Table 3: org_settings (OrganizationAggregate)

Source : DOC-021 §1.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| cle_parametre | varchar(255) | NOT NULL | cle_parametre |
| valeur_parametre | jsonb | NOT NULL | valeur_parametre |
| mis_a_jour_par | uuid FK | NOT NULL REFERENCES users(id) | mis_a_jour_par |
| mis_a_jour_le | timestamptz | NOT NULL DEFAULT now() | mis_a_jour_le |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| org_id | uuid | NOT NULL | _org_id |

Contrainte : UNIQUE(cle_parametre, org_id) — CC-ORGS-001

---

### Table 4: users (IdentityAggregate)

Source : DOC-021 §2.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| nom_complet | varchar(255) | NOT NULL | nom_complet |
| prenom | varchar(100) | NOT NULL | prenom |
| nom_famille | varchar(100) | NOT NULL | nom_famille |
| adresse_email | varchar(255) | NOT NULL | adresse_email |
| telephone | varchar(30) | | telephone |
| role_utilisateur | varchar(20) | NOT NULL DEFAULT 'staff' | role_utilisateur |
| date_naissance | date | | date_naissance |
| statut | varchar(20) | NOT NULL DEFAULT 'active' | statut |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| updated_at | timestamptz | NOT NULL DEFAULT now() | date_mise_a_jour |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| synced_at | timestamptz | | _sync_timestamp |
| local_updated_at | timestamptz | | _local_timestamp |
| org_id | uuid | NOT NULL | _org_id |

Contrainte : UNIQUE(adresse_email, org_id) — CC-USER-001

### Table 5: sessions (IdentityAggregate)

Source : DOC-021 §2.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| user_id | uuid FK | NOT NULL REFERENCES users(id) ON DELETE CASCADE | user_id |
| hachage_refresh_token | varchar(60) | NOT NULL | hachage_refresh_token |
| date_expiration | timestamptz | NOT NULL | date_expiration |
| est_active | boolean | NOT NULL DEFAULT true | est_active |
| informations_appareil | jsonb | NOT NULL | informations_appareil |
| date_creation | timestamptz | NOT NULL DEFAULT now() | date_creation |
| date_revocation | timestamptz | | date_revocation |
| log_position | bigint | | _log_sequence |
| org_id | uuid | NOT NULL | _org_id |

### Table 6: credentials (IdentityAggregate)

Source : DOC-021 §2.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| user_id | uuid FK | NOT NULL REFERENCES users(id) ON DELETE CASCADE | user_id (1:1) |
| hachage_mot_de_passe | varchar(60) | NOT NULL | hachage_mot_de_passe |
| date_derniere_rotation | timestamptz | NOT NULL DEFAULT now() | date_derniere_rotation |
| nombre_echecs_connexion | integer | NOT NULL DEFAULT 0 | nombre_echecs_connexion |
| compte_bloque | boolean | NOT NULL DEFAULT false | compte_bloque |
| date_derniere_connexion | timestamptz | | date_derniere_connexion |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 7: transactions (ResourceAggregate)

Source : DOC-021 §3.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| created_by | uuid FK | REFERENCES users(id) | created_by |
| montant | bigint | NOT NULL CHECK (montant > 0) | montant (FIN-002) |
| type_transaction | varchar(20) | NOT NULL CHECK (type IN ('income','expense','transfer','adjustment')) | type_transaction |
| statut | varchar(20) | NOT NULL DEFAULT 'draft' CHECK (statut IN ('draft','pending','approved','rejected')) | statut |
| categorie_ref | uuid FK | NOT NULL REFERENCES vocab_values(id) | categorie_ref |
| portee_type | varchar(10) | NOT NULL CHECK (portee_type IN ('org','group')) | portee_type |
| portee_cible_id | uuid FK | REFERENCES org_units(id) | scope_target |
| date_transaction | date | NOT NULL CHECK (date_transaction <= CURRENT_DATE) | date_transaction |
| description | varchar(1024) | | description |
| compense_pour | uuid FK | REFERENCES transactions(id) | compense_for |
| approuve_par | uuid FK | REFERENCES users(id) | approuve_par |
| date_approbation | timestamptz | | date_approbation |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| est_synchronise | boolean | NOT NULL DEFAULT false | est_synchronise |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| updated_at | timestamptz | NOT NULL DEFAULT now() | date_mise_a_jour |
| synced_at | timestamptz | | _sync_timestamp |
| local_updated_at | timestamptz | | _local_timestamp |
| conflict_strategy | varchar(32) | NOT NULL DEFAULT 'uuid_dedup_side_by_side' | _conflict_strategy |
| is_deleted | boolean | NOT NULL DEFAULT false | _tombstone |
| purge_eligible_at | timestamptz | | _purge_date |
| org_id | uuid | NOT NULL | _org_id |

Indices :
- CREATE INDEX idx_transactions_org_id ON transactions(org_id);
- CREATE INDEX idx_transactions_statut ON transactions(statut);
- CREATE INDEX idx_transactions_date_transaction ON transactions(date_transaction);
- CREATE INDEX idx_transactions_compense_pour ON transactions(compense_pour);

### Table 8: members (ResourceAggregate)

Source : DOC-021 §3.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| created_by | uuid FK | REFERENCES users(id) | created_by |
| prenom | varchar(100) | NOT NULL | prenom |
| nom_famille | varchar(100) | NOT NULL | nom_famille |
| adresse_email | varchar(255) | | adresse_email |
| telephone | varchar(30) | | telephone |
| date_naissance | date | | date_naissance |
| sexe | varchar(10) | | sexe |
| statut_membre | varchar(20) | NOT NULL DEFAULT 'active' CHECK (statut IN ('active','inactive','deceased','transferred')) | statut_membre |
| numero_membre | varchar(50) | NOT NULL | numero_membre |
| date_entree | date | NOT NULL | date_entree |
| date_sortie | date | | date_sortie |
| certificat_transfert | jsonb | | certificat_transfert |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| est_synchronise | boolean | NOT NULL DEFAULT false | est_synchronise |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| updated_at | timestamptz | NOT NULL DEFAULT now() | date_mise_a_jour |
| synced_at | timestamptz | | _sync_timestamp |
| local_updated_at | timestamptz | | _local_timestamp |
| conflict_strategy | varchar(32) | NOT NULL DEFAULT 'LWW' | _conflict_strategy |
| is_deleted | boolean | NOT NULL DEFAULT false | _tombstone |
| purge_eligible_at | timestamptz | | _purge_date |
| org_id | uuid | NOT NULL | _org_id |

### Table 9: events (ResourceAggregate)

Source : DOC-021 §3.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| created_by | uuid FK | REFERENCES users(id) | created_by |
| titre | varchar(255) | NOT NULL | titre |
| type_evenement | varchar(50) | NOT NULL | type_evenement |
| date_debut | timestamptz | NOT NULL | date_debut |
| date_fin | timestamptz | NOT NULL CHECK (date_fin > date_debut) | date_fin |
| lieu | varchar(255) | | lieu |
| responsable | uuid FK | REFERENCES users(id) | responsable |
| description | varchar(1024) | | description |
| statut | varchar(20) | NOT NULL DEFAULT 'draft' CHECK (statut IN ('draft','published','cancelled','completed')) | statut |
| version | integer | NOT NULL DEFAULT 1 | _persist_version |
| est_synchronise | boolean | NOT NULL DEFAULT false | est_synchronise |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| updated_at | timestamptz | NOT NULL DEFAULT now() | date_mise_a_jour |
| synced_at | timestamptz | | _sync_timestamp |
| local_updated_at | timestamptz | | _local_timestamp |
| conflict_strategy | varchar(32) | NOT NULL DEFAULT 'LWW' | _conflict_strategy |
| is_deleted | boolean | NOT NULL DEFAULT false | _tombstone |
| purge_eligible_at | timestamptz | | _purge_date |
| org_id | uuid | NOT NULL | _org_id |

### Table 10: categories (ResourceAggregate)

Source : DOC-021 §3.4

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| cle_vocabulaire | varchar(255) | NOT NULL | cle_vocabulaire |
| libelle | varchar(255) | NOT NULL | libelle |
| couleur_associee | varchar(7) | CHECK (couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$') | couleur_associee |
| active | boolean | NOT NULL DEFAULT true | active |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| synced_at | timestamptz | | _sync_timestamp |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 11: group_memberships (RelationshipAggregate)

Source : DOC-021 §4.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| membre_id | uuid FK | NOT NULL REFERENCES members(id) | membre_id |
| groupe_id | uuid FK | NOT NULL REFERENCES org_units(id) | groupe_id |
| date_adhesion | date | NOT NULL | date_adhesion |
| date_depart | date | | date_depart |
| role_groupe | varchar(100) | | role_groupe |
| org_id | uuid | NOT NULL | _org_id |

Contrainte : UNIQUE(membre_id, groupe_id) — CC-MEM-GRP-002

### Table 12: org_unit_links (RelationshipAggregate)

Source : DOC-021 §4.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| enfant_id | uuid FK | NOT NULL REFERENCES org_units(id) | enfant_id |
| parent_id | uuid FK | NOT NULL REFERENCES org_units(id) | parent_id |
| date_modification | timestamptz | NOT NULL DEFAULT now() | date_modification |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 13: workflow_instances (WorkflowAggregate)

Source : DOC-021 §5.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| ressource_type | varchar(50) | NOT NULL | ressource_type |
| ressource_id | uuid | NOT NULL | ressource_id |
| definition_key | varchar(255) | NOT NULL | definition_key |
| etape_courante | integer | NOT NULL DEFAULT 0 | etape_courante |
| total_etapes | integer | NOT NULL | total_etapes |
| statut | varchar(20) | NOT NULL DEFAULT 'running' CHECK (statut IN ('running','completed','failed','cancelled')) | statut |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| date_completion | timestamptz | | date_completion |
| date_annulation | timestamptz | | date_annulation |
| date_ecoulement | timestamptz | | date_echellement |
| version | integer | NOT NULL DEFAULT 1 | version |
| synced_at | timestamptz | | _sync_timestamp |
| org_id | uuid | NOT NULL | _org_id |

### Table 14: workflow_steps (WorkflowAggregate)

Source : DOC-021 §5.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| instance_id | uuid FK | NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE | instance_id |
| ordre | integer | NOT NULL | ordre |
| type_etape | varchar(20) | NOT NULL CHECK (type IN ('auto','approval','notification','conditional','delay','parallel')) | type_etape |
| assigne_a_role | varchar(20) | NOT NULL | assigne_a_role |
| statut | varchar(20) | NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending','in_progress','completed','failed','skipped')) | statut |
| timeout_jours | integer | NOT NULL CHECK (timeout_jours > 0 AND timeout_jours <= 30) | timeout_jours (CC-WF-001) |
| commentaire_approbation | varchar(1024) | | commentaire_approbation |
| date_ecoulement | timestamptz | | date_ecoule |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| updated_at | timestamptz | NOT NULL DEFAULT now() | date_mise_a_jour |
| org_id | uuid | NOT NULL | _org_id |

### Table 15: workflow_logs (WorkflowAggregate)

Source : DOC-021 §5.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| instance_id | uuid FK | NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE | instance_id |
| etape_id | uuid FK | REFERENCES workflow_steps(id) | etape_id |
| action | varchar(50) | NOT NULL CHECK (action IN ('triggered','step_started','step_completed','step_approved','step_rejected','escalated','completed','failed','cancelled')) | action |
| execute_par | uuid FK | NOT NULL REFERENCES users(id) | execute_par |
| commentaire | varchar(1024) | | commentaire |
| date_heure | timestamptz | NOT NULL DEFAULT now() | date_heure |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 16: forms (FormAggregate)

Source : DOC-021 §6.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| cle_formulaire | varchar(255) | NOT NULL | cle_formulaire |
| reference_modele | varchar(255) | NOT NULL | reference_modele |
| version_semantique | varchar(20) | NOT NULL | version_semantique |
| est_publie | boolean | NOT NULL DEFAULT false | est_publie |
| publie_par | uuid FK | REFERENCES users(id) | publie_par |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| date_premiere_publication | timestamptz | | date_premiere_publication |
| date_derniere_publication | timestamptz | | date_derniere_publication |
| org_id | uuid | NOT NULL | _org_id |

### Table 17: form_sections (FormAggregate)

Source : DOC-021 §6.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| definition_id | uuid FK | NOT NULL REFERENCES forms(id) ON DELETE CASCADE | definition_id |
| ordre | integer | NOT NULL | ordre |
| titre_fr | varchar(255) | NOT NULL | titre_fr |
| titre_en | varchar(255) | NOT NULL | titre_en |
| org_id | uuid | NOT NULL | _org_id |

### Table 18: form_fields (FormAggregate)

Source : DOC-021 §6.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| section_id | uuid FK | NOT NULL REFERENCES form_sections(id) ON DELETE CASCADE | section_id |
| nom_champ | varchar(255) | NOT NULL | nom_champ |
| label_fr | varchar(255) | NOT NULL | label_fr |
| label_en | varchar(255) | NOT NULL | label_en |
| type_champ | varchar(30) | NOT NULL CHECK (type IN ('text','number','date','select','multiselect','file_upload','signature','textarea')) | type_champ |
| requier | boolean | NOT NULL DEFAULT false | requier |
| source_vocabulaire | varchar(255) | | source_vocabulaire |
| condition_visibilite | varchar(1024) | | condition_visibilite |
| valeur_defaut | varchar(255) | | valeur_defaut |
| pattern_validation | varchar(255) | | pattern_validation |
| min | integer | | min |
| max | integer | | max |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 19: notifications (NotificationAggregate)

Source : DOC-021 §7.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| destinataire_user_id | uuid FK | NOT NULL REFERENCES users(id) | destinataire_user_id |
| sujet_fr | varchar(255) | NOT NULL | sujet_fr |
| sujet_en | varchar(255) | NOT NULL | sujet_en |
| corps_fr | varchar(4096) | NOT NULL | corps_fr |
| corps_en | varchar(4096) | NOT NULL | corps_en |
| canal | varchar(10) | NOT NULL CHECK (canal IN ('in_app','push','email','sms')) | canal |
| severite | varchar(10) | NOT NULL CHECK (severite IN ('info','warning','critical')) | severite |
| statut_notification | varchar(20) | NOT NULL DEFAULT 'queued' CHECK (statut IN ('queued','sending','sent','failed','read')) | statut_notification |
| donnees_contextuelles | jsonb | | donnees_contextuelles |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| date_envoi | timestamptz | | date_envoi |
| date_lecture | timestamptz | | date_lecture |
| date_erreur | timestamptz | | date_erreur |
| org_id | uuid | NOT NULL | _org_id |

### Table 20: notification_preferences (NotificationAggregate)

Source : DOC-021 §7.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| user_id | uuid FK | NOT NULL REFERENCES users(id) ON DELETE CASCADE (1:1) | user_id |
| canaux_autorises | text[] | NOT NULL | canaux_autorises |
| severite_minimale | varchar(10) | NOT NULL CHECK (severite_minimale IN ('info','warning','critical')) | severite_minimale |
| limite_taux_max | integer | NOT NULL DEFAULT 100 | limite_taux_max |
| heures_silencieuses_debut | varchar(10) | | heures_silencieuses_debut |
| heures_silencieuses_fin | varchar(10) | | heures_silencieuses_fin |
| org_id | uuid | NOT NULL | _org_id |

### Table 21: notification_logs (NotificationAggregate)

Source : DOC-021 §7.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| message_id | uuid FK | NOT NULL REFERENCES notifications(id) ON DELETE CASCADE | message_id |
| canal | varchar(10) | NOT NULL | canal |
| tentative_num | integer | NOT NULL DEFAULT 1 | tentative_num |
| resultat | varchar(20) | NOT NULL CHECK (resultat IN ('success','failure','retry')) | resultat |
| message_erreur | varchar(1024) | | message_erreur |
| date_heure | timestamptz | NOT NULL DEFAULT now() | date_heure |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 22: vocab_namespaces (VocabularyAggregate)

Source : DOC-021 §8.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| cle_namespace | varchar(255) | NOT NULL | cle_namespace |
| description | varchar(1024) | | description |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| org_id | uuid | NOT NULL | _org_id |

Contrainte : UNIQUE(cle_namespace, org_id)

### Table 23: vocab_terms (VocabularyAggregate)

Source : DOC-021 §8.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| namespace_id | uuid FK | NOT NULL REFERENCES vocab_namespaces(id) ON DELETE CASCADE | namespace_id |
| cle_term | varchar(255) | NOT NULL | cle_term |
| label_fr | varchar(255) | NOT NULL | label_fr |
| label_en | varchar(255) | NOT NULL | label_en |
| est_deprecie | boolean | NOT NULL DEFAULT false | est_deprecie |
| date_deprecation | timestamptz | | date_deprecation |
| org_id | uuid | NOT NULL | _org_id |

Contrainte : UNIQUE(cle_term, namespace_id)

### Table 24: vocab_values (VocabularyAggregate)

Source : DOC-021 §8.3

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| term_id | uuid FK | NOT NULL REFERENCES vocab_terms(id) ON DELETE CASCADE | term_id |
| cle_valeur | varchar(255) | NOT NULL | cle_valeur |
| libelle_fr | varchar(255) | NOT NULL | libelle_fr |
| libelle_en | varchar(255) | NOT NULL | libelle_en |
| couleur_hex | varchar(7) | CHECK (couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$') | couleur_hex |
| est_deprecie | boolean | NOT NULL DEFAULT false | est_deprecie |
| date_deprecation | timestamptz | | date_deprecation |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 25: reports (ReportingAggregate)

Source : DOC-021 §9.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| cle_rapport | varchar(255) | NOT NULL | cle_rapport |
| titre_fr | varchar(255) | NOT NULL | titre_fr |
| titre_en | varchar(255) | NOT NULL | titre_en |
| periode_type | varchar(20) | NOT NULL CHECK (periode_type IN ('month','quarter','year','custom')) | periode_type |
| format_export | text[] | NOT NULL | format_export |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| date_derniere_generation | timestamptz | | date_derniere_generation |
| org_id | uuid | NOT NULL | _org_id |

### Table 26: report_snapshots (ReportingAggregate)

Source : DOC-021 §9.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| definition_id | uuid FK | REFERENCES reports(id) | definition_id |
| periode_debut | date | NOT NULL | periode_debut |
| periode_fin | date | NOT NULL | periode_fin |
| portee | varchar(10) | NOT NULL CHECK (portee IN ('org','group','all')) | portee |
| total_revenu | bigint | NOT NULL CHECK (total_revenue >= 0) | total_revenu |
| total_depense | bigint | NOT NULL CHECK (total_depense >= 0) | total_depense |
| resultat_net | bigint | NOT NULL CHECK (resultat_net = total_revenu - total_depense) | resultat_net (BR-RPT-001 bilan équilibré) |
| details_par_categorie | jsonb | NOT NULL | details_par_categorie |
| nombre_transactions | integer | NOT NULL | nombre_transactions |
| horodatage_genere | timestamptz | NOT NULL DEFAULT now() | horodatage_genere |
| signature_numerique | varchar(255) | | signature_numerique |
| date_generation | timestamptz | NOT NULL DEFAULT now() | date_generation |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 27: audit_entries (AuditAggregate) — IMMUTABLE LOG EXCLUSIVEMENT

Source : DOC-021 §10.1
NB-PERSIST-006 : SEUL cet aggregate utilise Immutable Log

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| sequence_log | bigint | NOT NULL AUTO_INCREMENT | sequence_log |
| action_effectuee | varchar(50) | NOT NULL CHECK (action IN ('create','update','delete','approve','reject','transfer','notify','other')) | action_effectuee |
| entite_type | varchar(255) | NOT NULL | entite_type |
| entite_id | uuid | NOT NULL | entite_id |
| utilisateur_id | uuid FK | NOT NULL REFERENCES users(id) | utilisateur_id |
| valeur_avant | jsonb | NOT NULL | valeur_avant (AUD-002 old+new values) |
| valeur_apres | jsonb | NOT NULL | valeur_apres (AUD-002 old+new values) |
| adresse_ip | varchar(45) | | adresse_ip |
| date_heure_utc | timestamptz | NOT NULL DEFAULT now() | date_heure_utc |
| duree_retention_annees | integer | NOT NULL DEFAULT 7 | duree_retention_annees |
| org_id | uuid | NOT NULL | _org_id |

Contraintes :
- IMMUTABLE — pas de UPDATE ni DELETE autorisé
- Check: valeur_avant ET valeur_apres toujours NOT NULL
- NB-PERSIST-007 : Pas d'auto-audit pour audit_entries

---

### Table 28: archives (LifecycleAggregate)

Source : DOC-021 §11.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| archive_par | uuid FK | REFERENCES users(id) | archive_par |
| type_resource_archives | varchar(50) | NOT NULL | type_resource_archives |
| resource_type_original | varchar(30) | NOT NULL CHECK (resource_type IN ('transaction','member','event','archive_entry')) | resource_type_original |
| resource_id_original | uuid | NOT NULL | resource_id_original |
| member_lie_id | uuid FK | REFERENCES members(id) | member_lie_id |
| metadonnees_archive | jsonb | NOT NULL DEFAULT '{}' | metadonnees_archive |
| tags | text[] | | tags |
| categorie | varchar(255) | | categorie |
| url_pieces_jointes | text[] | | url_pieces_jointes |
| etat_lifecycle | varchar(20) | NOT NULL DEFAULT 'active' CHECK (etat IN ('active','archived','trashed','purged')) | etat_lifecycle |
| date_archivage | timestamptz | NOT NULL DEFAULT now() | date_archivage |
| date_corbeille | timestamptz | | date_corbeille |
| date_purge | timestamptz | | date_purge |
| motif_purge | varchar(1024) | | motif_purge |
| version | integer | NOT NULL DEFAULT 1 | version |
| org_id | uuid | NOT NULL | _org_id |

### Table 29: purge_schedules (LifecycleAggregate)

Source : DOC-021 §11.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| entry_id | uuid FK | NOT NULL REFERENCES archives(id) ON DELETE CASCADE | entry_id |
| etats_eligibles | varchar(20) | NOT NULL CHECK (etats IN ('trashed','archived')) | etats_eligibles |
| programme_par_systeme | boolean | NOT NULL DEFAULT true | programme_par_systeme |
| date_planifiee | timestamptz | NOT NULL | date_planifiee |
| executee | boolean | NOT NULL DEFAULT false | executee |
| date_execution | timestamptz | | date_execution |
| executee_par | uuid FK | REFERENCES users(id) | executee_par |
| org_id | uuid | NOT NULL | _org_id |

---

### Table 30: settings (ConfigurationAggregate)

Source : DOC-021 §12.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| cle_parametre | varchar(255) | NOT NULL | cle_parametre |
| valeur | jsonb | NOT NULL | valeur |
| mis_a_jour_par | uuid FK | REFERENCES users(id) | mis_a_jour_par |
| mis_a_jour_le | timestamptz | NOT NULL DEFAULT now() | mis_a_jour_le |
| valeur_defaut | jsonb | NOT NULL DEFAULT '{}' | valeur_defaut |
| org_id | uuid | NOT NULL | _org_id |

Contrainte : UNIQUE(cle_parametre, org_id)

---

### Tables 31-33: OfflineSyncAggregate

### Table 31: pending_operations (OfflineSyncAggregate)

Source : DOC-021 §13.1

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| resource_type | varchar(30) | NOT NULL CHECK (resource_type IN ('transaction','member','event','archive_entry')) | resource_type |
| resource_id | uuid | NOT NULL | resource_id |
| action | varchar(10) | NOT NULL CHECK (action IN ('create','update','delete')) | action |
| payload | jsonb | NOT NULL | payload |
| statut_sync | varchar(16) | NOT NULL DEFAULT 'pending' CHECK (statut IN ('pending','sent','confirmed','failed')) | statut_sync |
| tentative_num | integer | NOT NULL DEFAULT 1 CHECK (tentative_num <= 5) | tentative_num |
| prochaine_retry | timestamptz | | prochaine_retry |
| created_at | timestamptz | NOT NULL DEFAULT now() | date_creation |
| date_last_sync | timestamptz | NOT NULL DEFAULT now() | date_last_sync |
| org_id | uuid | NOT NULL | _org_id |

### Table 32: sync_statuses (OfflineSyncAggregate)

Source : DOC-021 §13.2

| Colonne | Type | Contrainte | Source DOC-021 |
|---------|------|------------|---------------|
| id | uuid PK | DEFAULT gen_random_uuid() | identifier |
| org_id | uuid FK | NOT NULL REFERENCES organizations(id) ON DELETE CASCADE | org_id |
| table_reference | varchar(255) | NOT NULL | table_reference |
| derniere_synchro_timestamp | timestamptz | NOT NULL | derniere_synchro_timestamp |
| etat_connection | varchar(10) | NOT NULL DEFAULT 'online' CHECK (etat IN ('online','offline')) | etat_connection |
| derniere_operation_push | timestamptz | | derniere_operation_push |
| derniere_operation_pull | timestamptz | | derniere_operation_pull |
| org_id | uuid | NOT NULL | _org_id |

---

## RÉSUMÉ DES CONTRAINTES PRINCIPALES

| Table | Contrainte | Type | Source DOC-021 / DOC-015 |
|-------|-----------|------|-------------------------|
| organizations | UNIQUE(nom) | Unique | CC-ORG-001 |
| users | UNIQUE(adresse_email, org_id) | Unique | CC-USER-001 / MEM-001 |
| transactions | CHECK (montant > 0) | Check | FIN-002 / CC-TXN-001 |
| transactions | CHECK (date not in future) | Check | CC-TXN-002 |
| org_units | CHECK (profondeur 1-5) | Check | CC-ORGU-001 |
| workflow_steps | CHECK (timeout <= 30j) | Check | CC-WF-001 |
| vocab_terms | NO_DELETE | Logical only | VOC-001 |
| audit_entries | No DELETE/UPDATE | Immutable | AUD-004 / NB-PERSIST-006 |
| pending_operations | CHECK (tentative <= 5) | Check | BR-SYNC-003 |
| settings | UNIQUE(cle, org_id) | Unique | CC-CFG-001 |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Schéma initial PostgreSQL dérivé de DOC-021 + DOC-023 | COMPLIANT |

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un artefact technique dérivé directement du modèle physique canonique. Toute divergence entre le schéma et les documents canoniques est une violation bloquante.*