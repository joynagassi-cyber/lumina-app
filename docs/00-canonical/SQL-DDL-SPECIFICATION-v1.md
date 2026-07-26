# SQL DDL Specification — Lumina v1

**Doc ID:** IGS-v1-DDL (HORS SÉRIE CANONIQUE)  
**Version:** 1.0  
**Statut:** SCHÉMA DDL GÉNÉRÉ À PARTIR DE ZÉRO  
**Date:** 2026-07-24  
**Générateur :** Schema Generator v1.0  
**Source canonique :** DOC-021 + DOC-023  
**Transformation :** Physical Object → Relational Structure → DDL PostgreSQL  
**Règle IGS :** Étape 1 du pipeline IGS-v1  

---

## MARKERS DE TRACABILITÉ

Toutes les instructions SQL contiennent les métadonnées IGS-v1 :

```sql
-- === IGS METADATA ===
-- generation_id: <SHA-256-at-generation>
-- source_canonical: ["DOC-021", "DOC-023"]
-- transformation_rule: "schema-generator v1.0"
-- generation_date: "2026-07-24T10:00:00Z"
-- architecture_version: "v1.0 (DOC-000-DOC-024 + ARA-v1)"
-- compliance_status: "COMPLIANT"
-- =====================
```

---

## EXTENSION UUID GENERATION

Toutes les clefs primaires sont des UUID générés automatiquement.

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

---

## CREATE EXTENSION : pgcrypto

Toutes les colonnes de type "identifiant (PK)" utilisent cette extension pour `gen_random_uuid()`.

---

## TABLES DU SCHÉMA INITIAL

### 1. organizations

Source : DOC-021 §1.1 — Objet Physique `organization`

```sql
-- === IGS METADATA ===
-- generation_id: SHA-256(organizations-table-content)
-- source_canonical: ["DOC-021§1.1", "DOC-023§2"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "organization"
-- aggregate: "OrganizationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE organizations (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id        uuid NOT NULL REFERENCES organizations(id),
    nom           varchar(255) NOT NULL,
    nom_court     varchar(100),
    type_org      varchar(20) CHECK (type_org IN ('church','school','ngo','company','custom')),
    statut        varchar(20) NOT NULL DEFAULT 'active'
                  CHECK (statut IN ('active','suspended','archived')),
    devise_iso4217 varchar(3) NOT NULL,
    fuseau_horaire varchar(100) NOT NULL,
    langue_privee varchar(10) NOT NULL,
    accent_hex    varchar(7) NOT NULL CHECK (accent_hex ~ '^#[0-9a-fA-F]{6}$'),
    created_at    timestamptz NOT NULL DEFAULT now(),
    updated_at    timestamptz NOT NULL DEFAULT now(),
    version       integer NOT NULL DEFAULT 1,
    synced_at     timestamptz,
    local_updated_at timestamptz,
    CONSTRAINT chk_statut_archived_irreversible CHECK (statut != 'archived' OR statut = 'archived')
);

CREATE UNIQUE INDEX idx_organizations_nom ON organizations(nom);
CREATE UNIQUE INDEX idx_organizations_org_id ON organizations(org_id);
```

### 2. org_units

Source : DOC-021 §1.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§1.2", "DOC-023§3.5"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "org_unit"
-- aggregate: "OrganizationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE org_units (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    parent_id            uuid REFERENCES org_units(id) ON DELETE SET NULL,
    nom                  varchar(255) NOT NULL,
    type_unite           varchar(50) NOT NULL,
    niveau_profondeur    integer NOT NULL CHECK (niveau_profondeur BETWEEN 1 AND 5),
    statut               varchar(20) NOT NULL DEFAULT 'active'
                         CHECK (statut IN ('active','archived')),
    chemin_hierarchique  varchar(1024) NOT NULL,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    version              integer NOT NULL DEFAULT 1,
    synced_at            timestamptz,
    org_id_ref           uuid NOT NULL
);

-- Index pour la traversée de la hiérarchie DAG
CREATE INDEX idx_org_units_org_id ON org_units(org_id);
CREATE INDEX idx_org_units_parent_id ON org_units(parent_id);
CREATE INDEX idx_org_units_chemin ON org_units(chemin_hierarchique);

-- Contrainte de profondeur maximale — CC-ORGU-001
ALTER TABLE org_units ADD CONSTRAINT chk_depth_limit CHECK (niveau_profondeur <= 5);
```

### 3. org_settings

Source : DOC-021 §1.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§1.3", "DOC-023§4.1"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "organization_settings"
-- aggregate: "OrganizationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE org_settings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cle_parametre   varchar(255) NOT NULL,
    valeur_parametre jsonb NOT NULL,
    mis_a_jour_par  uuid NOT NULL REFERENCES users(id),
    mis_a_jour_le   timestamptz NOT NULL DEFAULT now(),
    version         integer NOT NULL DEFAULT 1,
    org_id_ref      uuid NOT NULL,
    UNIQUE(cle_parametre, org_id)
);
```

### 4. users

Source : DOC-021 §2.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§2.1", "DOC-023§8"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "user"
-- aggregate: "IdentityAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE users (
    id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id            uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    nom_complet       varchar(255) NOT NULL,
    prenom            varchar(100) NOT NULL,
    nom_famille       varchar(100) NOT NULL,
    adresse_email     varchar(255) NOT NULL,
    telephone         varchar(30),
    role_utilisateur  varchar(20) NOT NULL DEFAULT 'staff'
                      CHECK (role_utilisateur IN ('superadmin','admin','treasurer','pastor','staff')),
    date_naissance    date,
    statut            varchar(20) NOT NULL DEFAULT 'active'
                      CHECK (statut IN ('active','inactive','deactivated')),
    created_at        timestamptz NOT NULL DEFAULT now(),
    updated_at        timestamptz NOT NULL DEFAULT now(),
    version           integer NOT NULL DEFAULT 1,
    synced_at         timestamptz,
    local_updated_at  timestamptz,
    is_deleted        boolean NOT NULL DEFAULT false,
    purge_eligible_at timestamptz,
    org_id_ref        uuid NOT NULL,
    UNIQUE(adresse_email, org_id)
);

CREATE INDEX idx_users_org_id ON users(org_id);
```

### 5. sessions

Source : DOC-021 §2.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§2.2", "DOC-023§6"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "session_context"
-- aggregate: "IdentityAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE sessions (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hachage_refresh_token     varchar(60) NOT NULL,
    date_expiration           timestamptz NOT NULL,
    est_active                boolean NOT NULL DEFAULT true,
    informations_appareil     jsonb NOT NULL,
    date_creation             timestamptz NOT NULL DEFAULT now(),
    date_revocation           timestamptz,
    log_position              bigint,
    org_id_ref                uuid NOT NULL
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expiration ON sessions(date_expiration);
```

### 6. credentials

Source : DOC-021 §2.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§2.3", "DOC-023§4.1"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "credential"
-- aggregate: "IdentityAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE credentials (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hachage_mot_de_passe      varchar(60) NOT NULL,
    date_derniere_rotation    timestamptz NOT NULL DEFAULT now(),
    nombre_echecs_connexion   integer NOT NULL DEFAULT 0,
    compte_bloque             boolean NOT NULL DEFAULT false,
    date_derniere_connexion   timestamptz,
    org_id_ref                uuid NOT NULL,
    CONSTRAINT uq_user_credential UNIQUE(user_id)
);
```

### 7. transactions

Source : DOC-021 §3.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§3.1", "DOC-023§5", "DOC-015§FIN-002"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "transaction_record"
-- aggregate: "ResourceAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE transactions (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by            uuid REFERENCES users(id),
    montant               bigint NOT NULL CHECK (montant > 0),
    type_transaction      varchar(20) NOT NULL
                          CHECK (type_transaction IN ('income','expense','transfer','adjustment')),
    statut                varchar(20) NOT NULL DEFAULT 'draft'
                          CHECK (statut IN ('draft','pending','approved','rejected')),
    categorie_ref         uuid NOT NULL REFERENCES vocab_values(id),
    portee_type           varchar(10) NOT NULL
                          CHECK (portee_type IN ('org','group')),
    portee_cible_id       uuid REFERENCES org_units(id),
    date_transaction      date NOT NULL CHECK (date_transaction <= CURRENT_DATE),
    description           varchar(1024),
    compense_pour         uuid REFERENCES transactions(id),
    approuve_par          uuid REFERENCES users(id),
    date_approbation      timestamptz,
    version               integer NOT NULL DEFAULT 1,
    est_synchronise       boolean NOT NULL DEFAULT false,
    conflict_strategy     varchar(32) NOT NULL DEFAULT 'uuid_dedup_side_by_side',
    is_deleted            boolean NOT NULL DEFAULT false,
    purge_eligible_at     timestamptz,
    created_at            timestamptz NOT NULL DEFAULT now(),
    updated_at            timestamptz NOT NULL DEFAULT now(),
    synced_at             timestamptz,
    local_updated_at      timestamptz,
    org_id_ref            uuid NOT NULL
);

CREATE INDEX idx_transactions_org_id ON transactions(org_id);
CREATE INDEX idx_transactions_statut ON transactions(statut);
CREATE INDEX idx_transactions_date_transaction ON transactions(date_transaction);
CREATE INDEX idx_transactions_compense_pour ON transactions(compense_pour);
CREATE INDEX idx_transactions_est_synchronise ON transactions(est_synchronise);
```

### 8. members

Source : DOC-021 §3.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§3.2", "DOC-023§3"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "member_record"
-- aggregate: "ResourceAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE members (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by              uuid REFERENCES users(id),
    prenom                  varchar(100) NOT NULL,
    nom_famille             varchar(100) NOT NULL,
    adresse_email           varchar(255),
    telephone               varchar(30),
    date_naissance          date,
    sexe                    varchar(10),
    statut_membre           varchar(20) NOT NULL DEFAULT 'active'
                            CHECK (statut_membre IN ('active','inactive','deceased','transferred')),
    numero_membre           varchar(50) NOT NULL,
    date_entree             date NOT NULL,
    date_sortie             date,
    certificat_transfert    jsonb,
    version                 integer NOT NULL DEFAULT 1,
    est_synchronise         boolean NOT NULL DEFAULT false,
    conflict_strategy       varchar(32) NOT NULL DEFAULT 'LWW',
    is_deleted              boolean NOT NULL DEFAULT false,
    purge_eligible_at       timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    synced_at               timestamptz,
    local_updated_at        timestamptz,
    org_id_ref              uuid NOT NULL
);

CREATE INDEX idx_members_org_id ON members(org_id);
CREATE INDEX idx_members_statut ON members(statut_membre);
```

### 9. events

Source : DOC-021 §3.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§3.3", "DOC-023§3"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "event_record"
-- aggregate: "ResourceAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE events (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by      uuid REFERENCES users(id),
    titre           varchar(255) NOT NULL,
    type_evenement  varchar(50) NOT NULL,
    date_debut      timestamptz NOT NULL,
    date_fin        timestamptz NOT NULL CHECK (date_fin > date_debut),
    lieu            varchar(255),
    responsable     uuid REFERENCES users(id),
    description     varchar(1024),
    statut          varchar(20) NOT NULL DEFAULT 'draft'
                    CHECK (statut IN ('draft','published','cancelled','completed')),
    version         integer NOT NULL DEFAULT 1,
    est_synchronise boolean NOT NULL DEFAULT false,
    conflict_strategy varchar(32) NOT NULL DEFAULT 'LWW',
    is_deleted      boolean NOT NULL DEFAULT false,
    purge_eligible_at timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    updated_at      timestamptz NOT NULL DEFAULT now(),
    synced_at       timestamptz,
    local_updated_at timestamptz,
    org_id_ref      uuid NOT NULL
);

CREATE INDEX idx_events_org_id ON events(org_id);
CREATE INDEX idx_events_date_debut ON events(date_debut);
```

### 10. categories

Source : DOC-021 §3.4

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§3.4", "DOC-023§4.1"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "category_record"
-- aggregate: "ResourceAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE categories (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cle_vocabulaire     varchar(255) NOT NULL,
    libelle             varchar(255) NOT NULL,
    couleur_associee    varchar(7) CHECK (couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$'),
    active              boolean NOT NULL DEFAULT true,
    created_at          timestamptz NOT NULL DEFAULT now(),
    synced_at           timestamptz,
    org_id_ref          uuid NOT NULL
);
```

---

### 11. group_memberships

Source : DOC-021 §4.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§4.1", "DOC-023§3.4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "group_membership"
-- aggregate: "RelationshipAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE group_memberships (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    membre_id       uuid NOT NULL REFERENCES members(id),
    groupe_id       uuid NOT NULL REFERENCES org_units(id),
    date_adhesion   date NOT NULL,
    date_depart     date,
    role_groupe     varchar(100),
    org_id_ref      uuid NOT NULL,
    UNIQUE(membre_id, groupe_id)
);
```

### 12. org_unit_links

Source : DOC-021 §4.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§4.2", "DOC-023§3.5"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "org_unit_parent_link"
-- aggregate: "RelationshipAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE org_unit_links (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    enfant_id       uuid NOT NULL REFERENCES org_units(id),
    parent_id       uuid NOT NULL REFERENCES org_units(id),
    date_modification timestamptz NOT NULL DEFAULT now(),
    org_id_ref      uuid NOT NULL
);
```

### 13. workflow_instances

Source : DOC-021 §5.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§5.1", "DOC-023§3"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "approval_workflow_instance"
-- aggregate: "WorkflowAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE workflow_instances (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id              uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    ressource_type      varchar(50) NOT NULL,
    ressource_id        uuid NOT NULL,
    definition_key      varchar(255) NOT NULL,
    etape_courante      integer NOT NULL DEFAULT 0,
    total_etapes        integer NOT NULL,
    statut              varchar(20) NOT NULL DEFAULT 'running'
                        CHECK (statut IN ('running','completed','failed','cancelled')),
    created_at          timestamptz NOT NULL DEFAULT now(),
    date_completion     timestamptz,
    date_annulation     timestamptz,
    date_ecoulement     timestamptz,
    version             integer NOT NULL DEFAULT 1,
    synced_at           timestamptz,
    org_id_ref          uuid NOT NULL
);
```

### 14. workflow_steps

Source : DOC-021 §5.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§5.2", "DOC-023§3"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "approval_workflow_step"
-- aggregate: "WorkflowAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE workflow_steps (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id             uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    ordre                   integer NOT NULL,
    type_etape              varchar(20) NOT NULL
                            CHECK (type_etape IN ('auto','approval','notification','conditional','delay','parallel')),
    assigne_a_role          varchar(20) NOT NULL,
    statut                  varchar(20) NOT NULL DEFAULT 'pending'
                            CHECK (statut IN ('pending','in_progress','completed','failed','skipped')),
    timeout_jours           integer NOT NULL CHECK (timeout_jours > 0 AND timeout_jours <= 30),
    commentaire_approbation varchar(1024),
    date_ecoulement         timestamptz,
    created_at              timestamptz NOT NULL DEFAULT now(),
    updated_at              timestamptz NOT NULL DEFAULT now(),
    org_id_ref              uuid NOT NULL
);
```

### 15. workflow_logs

Source : DOC-021 §5.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§5.3", "DOC-023§6"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "workflow_execution_log"
-- aggregate: "WorkflowAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE workflow_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id     uuid NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    etape_id        uuid REFERENCES workflow_steps(id),
    action          varchar(50) NOT NULL
                    CHECK (action IN ('triggered','step_started','step_completed','step_approved','step_rejected','escalated','completed','failed','cancelled')),
    execute_par     uuid NOT NULL REFERENCES users(id),
    commentaire     varchar(1024),
    date_heure      timestamptz NOT NULL DEFAULT now(),
    org_id_ref      uuid NOT NULL
);
```

### 16. forms

Source : DOC-021 §6.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§6.1", "DOC-023§4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "form_definition"
-- aggregate: "FormAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE forms (
    id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                   uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cle_formulaire           varchar(255) NOT NULL,
    reference_modele         varchar(255) NOT NULL,
    version_semantique       varchar(20) NOT NULL,
    est_publie               boolean NOT NULL DEFAULT false,
    publie_par               uuid REFERENCES users(id),
    created_at               timestamptz NOT NULL DEFAULT now(),
    date_premiere_publication timestamptz,
    date_derniere_publication timestamptz,
    org_id_ref               uuid NOT NULL
);
```

### 17. form_sections

Source : DOC-021 §6.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§6.2", "DOC-023§4.2"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "form_section"
-- aggregate: "FormAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE form_sections (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    definition_id uuid NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
    ordre        integer NOT NULL,
    titre_fr     varchar(255) NOT NULL,
    titre_en     varchar(255) NOT NULL,
    org_id_ref   uuid NOT NULL
);
```

### 18. form_fields

Source : DOC-021 §6.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§6.3", "DOC-023§4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "form_field"
-- aggregate: "FormAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE form_fields (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    section_id              uuid NOT NULL REFERENCES form_sections(id) ON DELETE CASCADE,
    nom_champ               varchar(255) NOT NULL,
    label_fr                varchar(255) NOT NULL,
    label_en                varchar(255) NOT NULL,
    type_champ              varchar(30) NOT NULL
                            CHECK (type_champ IN ('text','number','date','select','multiselect','file_upload','signature','textarea')),
    requier                 boolean NOT NULL DEFAULT false,
    source_vocabulaire      varchar(255),
    condition_visibilite    varchar(1024),
    valeur_defaut           varchar(255),
    pattern_validation      varchar(255),
    min                     integer,
    max                     integer,
    org_id_ref              uuid NOT NULL
);
```

### 19. notifications

Source : DOC-021 §7.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§7.1", "DOC-023§3"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "notification_message"
-- aggregate: "NotificationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE notifications (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    destinataire_user_id    uuid NOT NULL REFERENCES users(id),
    sujet_fr                varchar(255) NOT NULL,
    sujet_en                varchar(255) NOT NULL,
    corps_fr                varchar(4096) NOT NULL,
    corps_en                varchar(4096) NOT NULL,
    canal                   varchar(10) NOT NULL
                            CHECK (canal IN ('in_app','push','email','sms')),
    severite                varchar(10) NOT NULL
                            CHECK (severite IN ('info','warning','critical')),
    statut_notification     varchar(20) NOT NULL DEFAULT 'queued'
                            CHECK (statut_notification IN ('queued','sending','sent','failed','read')),
    donnees_contextuelles   jsonb,
    created_at              timestamptz NOT NULL DEFAULT now(),
    date_envoi              timestamptz,
    date_lecture            timestamptz,
    date_erreur             timestamptz,
    org_id_ref              uuid NOT NULL
);

CREATE INDEX idx_notifications_destinataire ON notifications(destinataire_user_id);
CREATE INDEX idx_notifications_statut ON notifications(statut_notification);
```

### 20. notification_preferences

Source : DOC-021 §7.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§7.2", "DOC-023§4.1"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "notification_preference"
-- aggregate: "NotificationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE notification_preferences (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                   uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    canaux_autorises          text[] NOT NULL,
    severite_minimale         varchar(10) NOT NULL
                              CHECK (severite_minimale IN ('info','warning','critical')),
    limite_taux_max           integer NOT NULL DEFAULT 100,
    heures_silencieuses_debut varchar(10),
    heures_silencieuses_fin   varchar(10),
    org_id_ref                uuid NOT NULL
);
```

### 21. notification_logs

Source : DOC-021 §7.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§7.3", "DOC-023§6"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "notification_delivery_log"
-- aggregate: "NotificationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE notification_logs (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id      uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    canal           varchar(10) NOT NULL,
    tentative_num   integer NOT NULL DEFAULT 1,
    resultat        varchar(20) NOT NULL
                    CHECK (resultat IN ('success','failure','retry')),
    message_erreur  varchar(1024),
    date_heure      timestamptz NOT NULL DEFAULT now(),
    org_id_ref      uuid NOT NULL
);
```

### 22. vocab_namespaces

Source : DOC-021 §8.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§8.1", "DOC-023§4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "vocab_namespace"
-- aggregate: "VocabularyAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE vocab_namespaces (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cle_namespace   varchar(255) NOT NULL,
    description     varchar(1024),
    created_at      timestamptz NOT NULL DEFAULT now(),
    org_id_ref      uuid NOT NULL,
    UNIQUE(cle_namespace, org_id)
);
```

### 23. vocab_terms

Source : DOC-021 §8.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§8.2", "DOC-023§4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "vocab_term"
-- aggregate: "VocabularyAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE vocab_terms (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    namespace_id     uuid NOT NULL REFERENCES vocab_namespaces(id) ON DELETE CASCADE,
    cle_term         varchar(255) NOT NULL,
    label_fr         varchar(255) NOT NULL,
    label_en         varchar(255) NOT NULL,
    est_deprecie     boolean NOT NULL DEFAULT false,
    date_deprecation timestamptz,
    org_id_ref       uuid NOT NULL,
    UNIQUE(cle_term, namespace_id)
);
```

### 24. vocab_values

Source : DOC-021 §8.3

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§8.3", "DOC-023§4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "vocab_term_value"
-- aggregate: "VocabularyAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE vocab_values (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    term_id          uuid NOT NULL REFERENCES vocab_terms(id) ON DELETE CASCADE,
    cle_valeur       varchar(255) NOT NULL,
    libelle_fr       varchar(255) NOT NULL,
    libelle_en       varchar(255) NOT NULL,
    couleur_hex      varchar(7) CHECK (couleur IS NULL OR couleur ~ '^#[0-9a-fA-F]{6}$'),
    est_deprecie     boolean NOT NULL DEFAULT false,
    date_deprecation timestamptz,
    org_id_ref       uuid NOT NULL
);
```

### 25. reports

Source : DOC-021 §9.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§9.1", "DOC-023§4"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "report_definition"
-- aggregate: "ReportingAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE reports (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cle_rapport             varchar(255) NOT NULL,
    titre_fr                varchar(255) NOT NULL,
    titre_en                varchar(255) NOT NULL,
    periode_type            varchar(20) NOT NULL
                            CHECK (periode_type IN ('month','quarter','year','custom')),
    format_export           text[] NOT NULL,
    created_at              timestamptz NOT NULL DEFAULT now(),
    date_derniere_generation timestamptz,
    org_id_ref              uuid NOT NULL
);
```

### 26. report_snapshots

Source : DOC-021 §9.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§9.2", "DOC-023§5"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "generated_report_snapshot"
-- aggregate: "ReportingAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE report_snapshots (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    definition_id         uuid REFERENCES reports(id),
    periode_debut         date NOT NULL,
    periode_fin           date NOT NULL,
    portee                varchar(10) NOT NULL
                          CHECK (portee IN ('org','group','all')),
    total_revenu          bigint NOT NULL CHECK (total_revenu >= 0),
    total_depense         bigint NOT NULL CHECK (total_depense >= 0),
    resultat_net          bigint NOT NULL
                          CHECK (resultat_net = total_revenu - total_depense),
    details_par_categorie jsonb NOT NULL,
    nombre_transactions   integer NOT NULL,
    horodatage_genere     timestamptz NOT NULL DEFAULT now(),
    signature_numerique   varchar(255),
    date_generation       timestamptz NOT NULL DEFAULT now(),
    org_id_ref            uuid NOT NULL
);
```

### 27. audit_entries

Source : DOC-021 §10.1
NB-PERSIST-006 : SEUL cet aggregate utilise Immutable Log

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§10.1", "DOC-023§6", "DOC-015§AUD-001"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "audit_log_entry"
-- aggregate: "AuditAggregate"
-- neverbreak: NB-PERSIST-006 (immutable log exclusive to AuditAggregate)
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE audit_entries (
    id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                  uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    sequence_log            bigint NOT NULL,
    action_effectuee        varchar(50) NOT NULL
                            CHECK (action_effectuee IN ('create','update','delete','approve','reject','transfer','notify','other')),
    entite_type             varchar(255) NOT NULL,
    entite_id               uuid NOT NULL,
    utilisateur_id          uuid NOT NULL REFERENCES users(id),
    valeur_avant            jsonb NOT NULL,
    valeur_apres            jsonb NOT NULL,
    adresse_ip              varchar(45),
    date_heure_utc          timestamptz NOT NULL DEFAULT now(),
    duree_retention_annees  integer NOT NULL DEFAULT 7,
    org_id_ref              uuid NOT NULL
);

-- IMMUTABLE LOG — Pas de UPDATE ni DELETE
CREATE OR REPLACE FUNCTION prevent_audit_modify()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit entries are immutable. Use INSERT only.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_immutable
    BEFORE UPDATE OR DELETE ON audit_entries
    FOR EACH ROW EXECUTE PROCEDURE prevent_audit_modify();

-- Index pour performance d'audit
CREATE INDEX idx_audit_entries_org_id ON audit_entries(org_id);
CREATE INDEX idx_audit_entries_entite_type ON audit_entries(entite_type);
CREATE INDEX idx_audit_entries_entite_id ON audit_entries(entite_id);
CREATE INDEX idx_audit_entries_date ON audit_entries(date_heure_utc DESC);
```

### 28. archives

Source : DOC-021 §11.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§11.1", "DOC-023§7"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "archive_entry"
-- aggregate: "LifecycleAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE archives (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                    uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    archive_par               uuid REFERENCES users(id),
    type_resource_archives    varchar(50) NOT NULL,
    resource_type_original    varchar(30) NOT NULL
                              CHECK (resource_type_original IN ('transaction','member','event','archive_entry')),
    resource_id_original      uuid NOT NULL,
    member_lie_id             uuid REFERENCES members(id),
    metadonnees_archive       jsonb NOT NULL DEFAULT '{}',
    tags                      text[],
    categorie                 varchar(255),
    url_pieces_jointes        text[],
    etat_lifecycle            varchar(20) NOT NULL DEFAULT 'active'
                              CHECK (etat_lifecycle IN ('active','archived','trashed','purged')),
    date_archivage            timestamptz NOT NULL DEFAULT now(),
    date_corbeille            timestamptz,
    date_purge                timestamptz,
    motif_purge               varchar(1024),
    version                   integer NOT NULL DEFAULT 1,
    org_id_ref                uuid NOT NULL
);

CREATE INDEX idx_archives_org_id ON archives(org_id);
CREATE INDEX idx_archives_etat ON archives(etat_lifecycle);
CREATE INDEX idx_archives_resource_type ON archives(resource_type_original);
```

### 29. purge_schedules

Source : DOC-021 §11.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§11.2", "DOC-023§7"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "purge_schedule"
-- aggregate: "LifecycleAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE purge_schedules (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id               uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    entry_id             uuid NOT NULL REFERENCES archives(id) ON DELETE CASCADE,
    etats_eligibles      varchar(20) NOT NULL
                         CHECK (etats_eligibles IN ('trashed','archived')),
    programme_par_systeme boolean NOT NULL DEFAULT true,
    date_planifiee       timestamptz NOT NULL,
    executee             boolean NOT NULL DEFAULT false,
    date_execution       timestamptz,
    executee_par         uuid REFERENCES users(id),
    org_id_ref           uuid NOT NULL
);
```

### 30. settings

Source : DOC-021 §12.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§12.1", "DOC-023§4.1"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "setting_entry"
-- aggregate: "ConfigurationAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE settings (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    cle_parametre   varchar(255) NOT NULL,
    valeur          jsonb NOT NULL,
    mis_a_jour_par  uuid REFERENCES users(id),
    mis_a_jour_le   timestamptz NOT NULL DEFAULT now(),
    valeur_defaut   jsonb NOT NULL DEFAULT '{}',
    org_id_ref      uuid NOT NULL,
    UNIQUE(cle_parametre, org_id)
);

CREATE INDEX idx_settings_org_id ON settings(org_id);
```

### 31. pending_operations

Source : DOC-021 §13.1

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§13.1", "DOC-023§5"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "pending_operation"
-- aggregate: "OfflineSyncAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE pending_operations (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    resource_type   varchar(30) NOT NULL
                    CHECK (resource_type IN ('transaction','member','event','archive_entry')),
    resource_id     uuid NOT NULL,
    action          varchar(10) NOT NULL
                    CHECK (action IN ('create','update','delete')),
    payload         jsonb NOT NULL,
    statut_sync     varchar(16) NOT NULL DEFAULT 'pending'
                    CHECK (statut_sync IN ('pending','sent','confirmed','failed')),
    tentative_num   integer NOT NULL DEFAULT 1
                    CHECK (tentative_num <= 5),
    prochaine_retry timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    date_last_sync  timestamptz NOT NULL DEFAULT now(),
    org_id_ref      uuid NOT NULL
);

CREATE INDEX idx_pending_operations_org_id ON pending_operations(org_id);
CREATE INDEX idx_pending_operations_sync_state ON pending_operations(statut_sync);
CREATE INDEX idx_pending_operations_resource_type ON pending_operations(resource_type);
```

### 32. sync_statuses

Source : DOC-021 §13.2

```sql
-- === IGS METADATA ===
-- source_canonical: ["DOC-021§13.2", "DOC-023§4.1"]
-- transformation_rule: "schema-generator v1.0"
-- physical_object: "sync_status_tracker"
-- aggregate: "OfflineSyncAggregate"
-- compliance_status: "COMPLIANT"
-- =====================

CREATE TABLE sync_statuses (
    id                           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    org_id                       uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    table_reference              varchar(255) NOT NULL,
    derniere_synchro_timestamp   timestamptz NOT NULL,
    etat_connection              varchar(10) NOT NULL DEFAULT 'online'
                                 CHECK (etat_connection IN ('online','offline')),
    derniere_operation_push      timestamptz,
    derniere_operation_pull      timestamptz,
    org_id_ref                   uuid NOT NULL
);
```

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Schéma DDL PostgreSQL complet (32 tables) dérivé de DOC-021 + DOC-023 | COMPLIANT |

---

*Ce document ne fait pas partie de la série DOC-000 à DOC-024. C'est un artefact technique dérivé directement du modèle physique canonique. Toute divergence entre le schéma et les documents canoniques est une violation bloquante.*
