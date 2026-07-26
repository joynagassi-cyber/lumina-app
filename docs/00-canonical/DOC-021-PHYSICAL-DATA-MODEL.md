# DOC-021 — Canonical Physical Data Model

**Doc ID:** DOC-021 (FONDAMENTAL)  
**Version:** 1.0  
**Statut:** CONSTITUTIONNEL — MODÈLE DE PERSISTANCE PHYSIQUE FIGÉ  
**Date:** 2026-07-24  
**Référence:** Dérivé de DOC-017 (Persistence Model), DOC-012 (Domain Model)  
**Application:** Ce modèle décrit la STRUCTURE PHYSIQUE des données. Il peut être implémenté dans PostgreSQL, MySQL, SQL Server, ou tout SGBDR relationnel compatible sans modification du Domain Model.

---

## PRINCIPE

Ce document définit les **Objets Physiques** — la représentation structurelle des données persistées. Chaque Objet Physique dérive d'un Persistence Object de DOC-017.

**Ce que ce document EST :** Un catalogue structurel décrivant les entités persistées, leurs attributs (avec catégories de type conceptuelles), leurs relations, leurs contraintes sémantiques, leur cycle de vie et leur versionning.

**Ce que ce document N'EST PAS :** Un script SQL, un schéma de base de données, une migration, unDDL. Aucune syntaxe spécifique à un moteur n'est utilisée.

---

## 1. ORGANIZATION AGGREGATE

### 1.1 Objet Physique : `organization`

- **Owner Aggregate :** OrganizationAggregate (DOC-012 §2.1)
- **Persistence Object source :** OrganizationPO (§2.1 DOC-017)
- **Stratégie DOC-017 :** Referenced + Embedded Collection + Optimistic versioning

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 Identifiant unique de l'organisation |
| `nom` | chaîne | Requis | Nom complet de l'organisation |
| `nom_court` | chaîne | Optionnel | Nom abrégé pour affichage |
| `type_org` | énumération | Requis | church / school / ngo / company / custom |
| `statut` | énumération | Requis | active / suspended / archived |
| `devise_iso4217` | chaîne | Requis | Code devise ISO 4217 (ex: CDF, USD, EUR) |
| `fuseau_horaire` | chaîne | Requis | Identifiant IANA (ex: Africa/Lubumbashi) |
| `langue_privee` | chaîne | Requis | Code langue principale |
| `accent_hex` | chaîne | Requis | Couleur accentielle format hexadécimal |
| `created_at` | date/heure | Requis | Moment de création |
| `updated_at` | date/heure | Requis | Dernière modification |
| `_persist_version` | numérique | Requis | Numéro de version pour verrouillage optimiste (entier incrémenté) |
| `_sync_timestamp` | date/heure | Requis | Dernière synchronisation réussie |
| `_local_timestamp` | date/heure | Requis | Dernière modification locale |
| `_org_id` | identifiant | Requis | Référence à sa propre organisation (auto-référence multi-tenant) |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| possède | `org_unit` | sortante | 1:N | Compositionnelle |
| possède | `user` | sortante (via IdentityAggregate) | 1:N | Associative |
| référence | `organization` | entrante | N:1 | Organisation enfant → parent (DAG) |

#### Contraintes Conceptuelles

- CC-ORG-001 : `nom` doit être unique au sein d'une portée globale (pas seulement par org_id)
- CC-ORG-002 : Chaque organisation est son propre `org_id` racine
- CC-ORG-003 : `statut` ne peut pas passer de `archived` à `active` (irréversible)

#### Cycle de Vie

Créée → Active → Suspended ou Archived. Archived = irréversible.

#### Versionning

Optimiste : `_persist_version` incrémenté à chaque mutation.

#### Requirements d'Audit

Tous les changements de statut et de settings journalisés avec old_value + new_value.

---

### 1.2 Objet Physique : `org_unit`

- **Owner Aggregate :** OrganizationAggregate
- **Persistence Object source :** OrgUnitPO (§2.1 DOC-017)
- **Stratégie DOC-017 :** Embedded Collection + Versioning

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 Identifiant unique de l'unité |
| `org_id` | identifiant | Requis | Référence à l'organisation parent |
| `parent_id` | identifiant | Optionnel | Référence à l'org_unit parent (auto-référence) |
| `nom` | chaîne | Requis | Nom de l'unité |
| `type_unite` | énumération | Requis | unit_type: department, group, ministry, sub_group, etc. |
| `niveau_profondeur` | numérique | Requis | Niveau hiérarchique (1 à 5 maximum) |
| `statut` | énumération | Requis | active / archived |
| `chemin_hiérarchique` | chaîne | Requis | Chemin complet style "org/unit1/subunit2" |
| `created_at` | date/heure | Requis | |
| `updated_at` | date/heure | Requis | |
| `_persist_version` | numérique | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | Compositionnelle |
| parent de | `org_unit` | sortante | 1:N | Auto-référence (DAG) |
| référencé par | `group_membership` | entrante | 1:N | Associative |
| référencé par | `setting_entry` | entrante | 1:N | Associative (settings scoped to unit) |

#### Contraintes Conceptuelles

- CC-ORGU-001 : `niveau_profondeur` ne peut pas dépasser 5
- CC-ORGU-002 : Aucun cycle dans la relation `parent_id` (DAG)
- CC-ORGU-003 : Un OrgUnit ne peut pas être son propre ancêtre

#### Cycle de Vie

Créé → Actif → Archivé. Archived = irréversible.

#### Versionning

Hérite la version de l'org parent (`_persist_version`).

---

### 1.3 Objet Physique : `organization_settings`

- **Owner Aggregate :** OrganizationAggregate
- **Persistence Object source :** OrganizationSettingsPO (§2.1 DOC-017)
- **Stratégie DOC-017 :** Embedded Value Object

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 Identifiant unique du setting |
| `org_id` | identifiant | Requis | Organisation propriétaire |
| `cle_parametre` | chaîne | Requis | Clé unique du paramètre |
| `valeur_parametre` | objet intégré | Requis | Valeur structurée (pouvant contenir nombres, chaînes, booléens, objets) |
| `mis_a_jour_par` | identifiant | Requis | Référence à l'user qui a modifié |
| `mis_a_jour_le` | date/heure | Requis | |
| `_persist_version` | numérique | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | Compositionnelle |
| appartient à | `user` | sortante (N:1) | Associative | Mis à jour par |

#### Contraintes Conceptuelles

- CC-ORGS-001 : `cle_parametre` doit être unique au sein d'une org
- CC-ORGS-002 : `valeur_parametre` doit respecter le format attendu par le type de clé (validation via format rules de DOC-023)

#### Cycle de Vie

Permanente, jamais supprimée. Peut être réinitialisée aux valeurs par défaut.

#### Versionning

In-place update, pas de versionning individuel. La version de l'org parent change.

---

## 2. IDENTITY AGGREGATE

### 2.1 Objet Physique : `user`

- **Owner Aggregate :** IdentityAggregate (§2.2 DOC-017)
- **Persistence Object source :** UserPO
- **Stratégie DOC-017 :** Referenced + Optimistic + Append-only sessions

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 Identifiant unique utilisateur |
| `org_id` | identifiant | Requis | Organisation de rattachement |
| `nom_complet` | chaîne | Requis | Nom complet (prénom + nom concaténés) |
| `prenom` | chaîne | Requis | Prénom |
| `nom_famille` | chaîne | Requis | Nom de famille |
| `adresse_email` | chaîne | Requis | Email unique par org |
| `telephone` | chaîne | Optionnel | Téléphone formaté |
| `hachage_mot_de_passe` | hachage | Requis | Mot de passe haché (jamais en clair) |
| `role_utilisateur` | énumération | Requis | superadmin / admin / treasurer / pastor / staff |
| `date_naissance` | date/heure | Optionnel | |
| `date_creation` | date/heure | Requis | |
| `date_mise_a_jour` | date/heure | Requis | |
| `_persist_version` | numérique | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_local_timestamp` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |
| `status` | énumération | Requis | active / inactive / deactivated |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | Compositionnelle |
| authentifie | `session_context` | sortante | 1:N | Compositionnelle |
| possédé par | `credential` | entrante | 1:1 | Compositionnelle |
| référencé par | `organization` | entrante | N:1 | Superadmin crée |
| référencé par | `group_membership` | entrante | 1:N | Associative |

#### Contraintes Conceptuelles

- CC-USER-001 : `adresse_email` + `org_id` doit être unique (email unique par org)
- CC-USER-002 : `hachage_mot_de_passe` ne peut jamais être exposé en clair
- CC-USER-003 : Un user appartient à exactement UNE organisation

#### Cycle de Vie

Active → Inactive → Deactivated → (suppression après 90 jours configurable)

#### Versionning

Optimiste : `_persist_version`.

#### Requirements d'Audit

Chaque changement de rôle, réinitialisation mot de passe, session révoquée journalisé.

---

### 2.2 Objet Physique : `session_context`

- **Owner Aggregate :** IdentityAggregate
- **Persistence Object source :** SessionContextPO
- **Stratégie DOC-017 :** Embedded + Append-only log

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 Identifiant unique de session |
| `user_id` | identifiant | Requis | Utilisateur propriétaire |
| `hachage_refresh_token` | hachage | Requis | Refresh token haché |
| `date_expiration` | date/heure | Requis | Date d'expiration de la session |
| `est_active` | booléen | Requis | |
| `informations_appareil` | objet intégré | Requis | Données sur l'appareil (OS, navigateur, etc.) |
| `date_creation` | date/heure | Requis | |
| `date_revocation` | date/heure | Optionnel | |
| `_log_sequence` | numérique | Requis | Position dans le journal append-only |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `user` | sortante | N:1 | Compositionnelle (lié生命周期) |

#### Cycle de Vie

Active → Expired ou Revoked. Expiration automatique par TTL.

#### Audit

Revocations, expirations, et créations journalisées.

---

### 2.3 Objet Physique : `credential`

- **Owner Aggregate :** IdentityAggregate
- **Stratégie DOC-017 :** Embedded

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `user_id` | identifiant | Requis | Référencé par User |
| `hachage_mot_de_passe` | hachage | Requis | |
| `date_derniere_rotation` | date/heure | Requis | |
| `nombre_echecs_connexion` | numérique | Requis | Compteur pour bloquage |
| `compte_bloque` | booléen | Requis | |
| `date_derniere_connexion` | date/heure | Optionnel | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `user` | sortante | N:1 | 1:1 Compositionnelle |

#### Contraintes Conceptuelles

- CC-CRED-001 : Un User a EXACTEMENT un credential (1:1)
- CC-CRED-002 : Le hachage est toujours irreversiblement chiffré

---

## 3. RESOURCE AGGREGATE

### 3.1 Objet Physique : `transaction_record`

- **Owner Aggregate :** ResourceAggregate (§2.3 DOC-017)
- **Persistence Object source :** TransactionRecordPO
- **Stratégie DOC-017 :** Collection + Versioned Document + Immutable for approved

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 Identifiant unique de transaction |
| `org_id` | identifiant | Requis | Organisation propriétaire |
| `created_by` | identifiant | Requis | Créateur (réf. user) |
| `montant` | numérique | Requis | Montant dans unité monétaire minimale (positif, jamais zéro ou négatif) |
| `type_transaction` | énumération | Requis | income / expense / transfer / adjustment |
| `statut` | énumération | Requis | draft / pending / approved / rejected |
| `categorie_ref` | identifiant | Requis | Référence à un TermValue du Vocabulary |
| `portee_type` | énumération | Requis | org / group |
| `portee_cible_id` | identifiant | Requis | Référence à un org_unit selon scope_type |
| `date_transaction` | date/heure | Requis | |
| `description` | chaîne | Requis (si montant > seuil) | |
| `compense_pour` | identifiant | Optionnel | Référence à une transaction approuvée originale (compensation) |
| `approuve_par` | identifiant | Optionnel | |
| `date_approbation` | date/heure | Optionnel | |
| `version` | numérique | Requis | Numéro de version |
| `est_synchronise` | booléen | Requis | Vrai si confirmé côté serveur |
| `date_creation` | date/heure | Requis | |
| `date_mise_a_jour` | date/heure | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_local_timestamp` | date/heure | Requis | |
| `_conflict_strategy` | chaîne | Requis | Par type d'entité |
| `_org_id` | identifiant | Requis | |
| `_tombstone` | booléen | Requis | Marqueur suppression logique |
| `_purge_date` | date/heure | Optionnel | Date de purge éligible |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | Compositionnelle |
| créé par | `user` | sortante | N:1 | Associative |
| compensé par | `transaction_record` | entrante | 1:N | Auto-référence (compensates_for) |
| référencé par | `approval_workflow_instance` | entrante | 1:N | Workflow d'approbation |

#### Contraintes Conceptuelles

- CC-TXN-001 : `montant` doit être strictement positif (INV-001 / FIN-002)
- CC-TXN-002 : `date_transaction` ne peut jamais être dans le futur
- CC-TXN-003 : Une transaction approved est IMMUABLE (ne peut ni être modifiée ni supprimée)
- CC-TXN-004 : `categorie_ref` doit pointer vers un TermValue existant du Vocabulary
- CC-TXN-005 : `compense_pour` pointe vers une transaction approved (seule voie de correction)
- CC-TXN-006 : `portee_type` restrict enum : org / group

#### Cycle de Vie

Draft → Pending → Approved (immuable) / Rejected
Rejeté → Draft (retournable).
Approved → Ne change JAMAIS (correction via compenses_for seulement).

#### Versionning

Optimiste + Versioned Document. `_persist_version` incrémente à chaque mutation draft/pending. Approved = locked.

#### Requirements d'Audit

CRITIQUE : Every create/update/approve/reject/compensate action fully audited avec old_value + new_value.

---

### 3.2 Objet Physique : `member_record`

- **Owner Aggregate :** ResourceAggregate
- **Stratégie DOC-017 :** Collection + Versioned Document

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `created_by` | identifiant | Requis |
| `prenom` | chaîne | Requis |
| `nom_famille` | chaîne | Requis |
| `adresse_email` | chaîne | Requis |
| `telephone` | chaîne | Optionnel |
| `date_naissance` | date/heure | Optionnel |
| `sexe` | énumération | Optionnel |
| `statut_membre` | énumération | Requis | active / inactive / deceased / transferred |
| `numero_membre` | chaîne | Requis | Identifiant unique intra-org |
| `date_entree` | date/heure | Requis | |
| `date_sortie` | date/heure | Optionnel | |
| `certificat_transfert` | objet intégré | Optionnel | Documentation jointe pour transfert |
| `version` | numérique | Requis | |
| `est_synchronise` | booléen | Requis | |
| `date_creation` | date/heure | Requis | |
| `date_mise_a_jour` | date/heure | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_local_timestamp` | date/heure | Requis | |
| `_conflict_strategy` | chaîne | Requis |
| `_org_id` | identifiant | Requis | |
| `_tombstone` | booléen | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | |
| référencé par | `archive_entry` | entrante | 1:N | Linked member |

#### Contraintes Conceptuelles

- CC-MBR-001 : `prenom` ET `nom_famille` sont obligatoires (MEM-001)
- CC-MBR-002 : Membre inactive ne peut PAS créer de transactions
- CC-MBR-003 : Transfert vers autre église nécessite certificat (document joint)

#### Cycle de Vie

Active → Inactive / Deceased / Transferred. Deceased et Transferred sont irréversibles.

#### Versionning

Optimiste : `_persist_version`.

---

### 3.3 Objet Physique : `event_record`

- **Owner Aggregate :** ResourceAggregate
- **Stratégie DOC-017 :** Collection + Versioned Document

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `created_by` | identifiant | Requis |
| `titre` | chaîne | Requis |
| `type_evenement` | énumération | Requis | meeting / worship / fellowship / education / custom |
| `date_debut` | date/heure | Requis | |
| `date_fin` | date/heure | Requis | Doit être > date_debut |
| `lieu` | chaîne | Optionnel | |
| `responsable` | identifiant | Optionnel | Organisateur (réf. user/membre) |
| `description` | chaîne | Optionnel | |
| `statut` | énumération | Requis | draft / published / cancelled / completed |
| `version` | numérique | Requis | |
| `est_synchronise` | booléen | Requis | |
| `date_creation` | date/heure | Requis | |
| `date_mise_a_jour` | date/heure | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_local_timestamp` | date/heure | Requis | |
| `_conflict_strategy` | chaîne | Requis |
| `_org_id` | identifiant | Requis | |
| `_tombstone` | booléen | Requis | |

#### Contraintes Conceptuelles

- CC-EVT-001 : `date_fin` > `date_debut`
- CC-EVT-002 : LWW conflict strategy (timestamp-based)

---

### 3.4 Objet Physique : `category_record`

- **Owner Aggregate :** ResourceAggregate
- **Stratégie DOC-017 :** Collection + Server-wins sync

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `cle_vocabulaire` | chaîne | Requis | Clé de catégorie issue du Vocabulary |
| `libelle` | chaîne | Requis | Label d'affichage |
| `couleur_associee` | chaîne | Optionnel | Hex code pour visualisation |
| `active` | booléen | Requis | |
| `date_creation` | date/heure | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-CAT-001 : `cle_vocabulaire` doit exister dans VocabularyAggregate
- CC-CAT-002 : Server-wins (catégorie est lookup table)

---

## 4. RELATIONSHIP AGGREGATE

### 4.1 Objet Physique : `group_membership`

- **Owner Aggregate :** RelationshipAggregate (§2.4 DOC-017)
- **Stratégie DOC-017 :** Embedded Collection

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `membre_id` | identifiant | Requis | Référencé vers member_record |
| `groupe_id` | identifiant | Requis | Référencé vers org_unit (unité groupe) |
| `date_adhesion` | date/heure | Requis | |
| `date_depart` | date/heure | Optionnel | |
| `role_groupe` | chaîne | Optionnel | Rôle au sein du groupe |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | |
| membre de | `member_record` | sortante | N:1 | Associative |
| groupe de | `org_unit` | sortante | N:1 | Associative |

#### Contraintes Conceptuelles

- CC-MEM-GRP-001 : N:M entre member et org_unit résolu via cet objet
- CC-MEM-GRP-002 : Duplication interdite (même membre + même groupe = unique)
- CC-MEM-GRP-003 : Multi-membership autorisée (un membre peut être dans plusieurs groupes)

#### Cycle de Vie

Instantané : ajout/suppression instantanés, pas de cycle de vie propre.

#### Audit

Chaque adhésion et départ journalisé.

---

### 4.2 Objet Physique : `org_unit_parent_link`

- **Owner Aggregate :** RelationshipAggregate
- **Stratégie DOC-017 :** Referenced

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `enfant_id` | identifiant | Requis | Référencé vers org_unit |
| `parent_id` | identifiant | Requis | Référencé vers org_unit parent |
| `date_modification` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| pointe vers | `org_unit` (enfant) | sortante | N:1 | |
| pointe vers | `org_unit` (parent) | sortante | N:1 | Auto-référence DAG |

#### Contraintes Conceptuelles

- CC-REL-001 : DAG sans cycles (Kahn's algo avant écriture)
- CC-REL-002 : Profondeur maximale 5 niveaux
- CC-REL-003 : Suppression préserve les membres sous-jacents

---

## 5. WORKFLOW AGGREGATE

### 5.1 Objet Physique : `approval_workflow_instance`

- **Owner Aggregate :** WorkflowAggregate (§2.5 DOC-017)
- **Stratégie DOC-017 :** Versioned Document + Append-only execution trace

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `ressource_type` | énumération | Requis | Le type de ressource orchestré |
| `ressource_id` | identifiant | Requis | L'ID de la ressource concernée |
| `definition_key` | chaîne | Requis | Clé de définition workflow |
| `etape_courante` | numérique | Requis | Index de l'étape actuelle |
| `total_etapes` | numérique | Requis | |
| `statut` | énumération | Requis | running / completed / failed / cancelled |
| `date_creation` | date/heure | Requis | |
| `date_completion` | date/heure | Optionnel | |
| `date_annulation` | date/heure | Optionnel | |
| `date_echellement` | date/heure | Optionnel | |
| `version` | numérique | Requis | |
| `_sync_timestamp` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| orchestre | `approval_workflow_step` | sortante | 1:N | Compositional |
| orchestre | `workflow_execution_log` | sortante | 1:N | Historique d'exécution |
| concerne | `transaction_record` | sortante | N:1 | Associative |

#### Contraintes Conceptuelles

- CC-WF-001 : Timeout max 30 jours par étape
- CC-WF-002 : Chaîne d'approbation max 5 niveaux
- CC-WF-003 : Workflow échoué ne peut être relancé que manuellement
- CC-WF-004 : Workflows NE MODIFIENT JAMAIS directement des transactions approved

---

### 5.2 Objet Physique : `approval_workflow_step`

- **Owner Aggregate :** WorkflowAggregate
- **Stratégie DOC-017 :** Embedded Collection

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `instance_id` | identifiant | Requis | Instance parent |
| `ordre` | numérique | Requis | Ordre séquentiel |
| `type_etape` | énumération | Requis | auto / approval / notification / conditional / delay / parallel |
| `assigne_a_role` | énumération | Requis | superadmin / admin / treasurer / pastor / staff |
| `statut` | énumération | Requis | pending / in_progress / completed / failed / skipped |
| `timeout_jours` | numérique | Requis | Max 30 |
| `commentaire_approbation` | chaîne | Optionnel | |
| `date_ecoule` | date/heure | Optionnel | |
| `date_creation` | date/heure | Requis | |
| `date_mise_a_jour` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `approval_workflow_instance` | sortante | N:1 | Compositionnelle |

---

### 5.3 Objet Physique : `workflow_execution_log`

- **Owner Aggregate :** WorkflowAggregate
- **Stratégie DOC-017 :** Event Log

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `instance_id` | identifiant | Requis |
| `etape_id` | identifiant | Optionnel |
| `action` | énumération | Requis | triggered / step_started / step_completed / step_approved / step_rejected / escalated / completed / failed / cancelled |
| `executé_par` | identifiant | Requis | User who performed the action |
| `commentaire` | chaîne | Optionnel | |
| `date_heure` | date/heure | Requis | UTC timestamp |
| `_org_id` | identifiant | Requis | |

#### Cycle de Vie

Append-only, jamais modifié. Retention configurable.

---

## 6. FORM AGGREGATE

### 6.1 Objet Physique : `form_definition`

- **Owner Aggregate :** FormAggregate (§2.6 DOC-017)
- **Stratégie DOC-017 :** Embedded + Semantic versioning

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `cle_formulaire` | chaîne | Requis | Clé unique du formulaire |
| `reference_modele` | chaîne | Requis | Modèle de domaine associé |
| `version_semantique` | chaîne | Requis | Format "major.minor" (ex: "1.0", "2.1") |
| `est_publie` | booléen | Requis | |
| `publie_par` | identifiant | Requis | Admin qui a publié |
| `date_creation` | date/heure | Requis | |
| `date_premiere_publication` | date/heure | Optionnel | |
| `date_derniere_publication` | date/heure | Optionnel | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| contient | `form_section` | sortante | 1:N | Compositionnelle |
| contient | `form_field` | sortante | 1:N | Compositionnelle |

#### Contraintes Conceptuelles

- CC-FRM-001 : Version sémantique uniquement, pas de versionning optimiste classique
- CC-FRM-002 : Anciennes versions ne sont jamais modifiées ni supprimées

---

### 6.2 Objet Physique : `form_section`

- **Owner Aggregate :** FormAggregate
- **Stratégie DOC-017 :** Embedded

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `definition_id` | identifiant | Requis | Formulaire parent |
| `ordre` | numérique | Requis | Ordre d'affichage |
| `titre_fr` | chaîne | Requis | |
| `titre_en` | chaîne | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `form_definition` | sortante | N:1 | Compositionnelle |
| contient | `form_field` | entrante | 1:N | Compositionnelle |

---

### 6.3 Objet Physique : `form_field`

- **Owner Aggregate :** FormAggregate
- **Stratégie DOC-017 :** Embedded

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `section_id` | identifiant | Requis | Section parent |
| `nom_champ` | chaîne | Requis | Clé du champ |
| `label_fr` | chaîne | Requis | |
| `label_en` | chaîne | Requis | |
| `type_champ` | énumération | Requis | text / number / date / select / multiselect / file_upload / signature / textarea |
| `requier` | booléen | Requis | |
| `source_vocabulaire` | chaîne | Optionnel | Si select/multiselect, clé vocabulaire |
| `condition_visibilite` | chaîne | Optionnel | JSON expression |
| `valeur_defaut` | chaîne | Optionnel | |
| `pattern_validation` | chaîne | Optionnel | Regex |
| `min` | numérique | Optionnel | |
| `max` | numérique | Optionnel | |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-FIELD-001 : Select/MultiSelect TOUJOURS référencent un namespace Vocabulary
- CC-FIELD-002 : `label_fr` + `label_en` minimum requis

---

## 7. NOTIFICATION AGGREGATE

### 7.1 Objet Physique : `notification_message`

- **Owner Aggregate :** NotificationAggregate (§2.7 DOC-017)
- **Stratégie DOC-017 :** Collection

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `destinataire_user_id` | identifiant | Requis |
| `sujet_fr` | chaîne | Requis |
| `sujet_en` | chaîne | Requis |
| `corps_fr` | chaîne | Requis |
| `corps_en` | chaîne | Requis |
| `canal` | énumération | Requis | in_app / push / email / sms |
| `severite` | énumération | Requis | info / warning / critical |
| `statut_notification` | énumération | Requis | queued / sending / sent / failed / read |
| `donnees_contextuelles` | objet intégré | Optionnel | Données supplémentaires (placeholder substitutions) |
| `date_creation` | date/heure | Requis | |
| `date_envoi` | date/heure | Optionnel | |
| `date_lecture` | date/heure | Optionnel | |
| `date_erreur` | date/heure | Optionnel | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | |
| destiné à | `user` | sortante | N:1 | Associative |

#### Contraintes Conceptuelles

- CC-NOT-001 : Toujours déclenché par un workflow, événement, ou action admin
- CC-NOT-002 : in_app toujours livré (offline-first)
- CC-NOT-003 : critical bypass quiet hours

---

### 7.2 Objet Physique : `notification_preference`

- **Owner Aggregate :** NotificationAggregate
- **Stratégie DOC-017 :** Embedded VO

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `user_id` | identifiant | Requis | 1:1 par user |
| `canaux_autorises` | collection | Requis | List of allowed channels |
| `severite_minimale` | énumération | Requis | Minimum severity to receive |
| `limite_taux_max` | numérique | Requis | Notifications max par heure |
| `heures_silencieuses_debut` | chaîne | Optionnel | Heure début |
| `heures_silencieuses_fin` | chaîne | Optionnel | Heure fin |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-PREF-001 : 1:1 par utilisateur
- CC-PREF-002 : Respecté par NotificationAggregate

---

### 7.3 Objet Physique : `notification_delivery_log`

- **Owner Aggregate :** NotificationAggregate
- **Stratégie DOC-017 :** Event Log

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `message_id` | identifiant | Requis | Message parent |
| `canal` | énumération | Requis |
| `tentative_num` | numérique | Requis | Numéro de tentative |
| `resultat` | énumération | Requis | success / failure / retry |
| `message_erreur` | chaîne | Optionnel |
| `date_heure` | date/heure | Requis |
| `_org_id` | identifiant | Requis |

---

## 8. VOCABULARY AGGREGATE

### 8.1 Objet Physique : `vocab_namespace`

- **Owner Aggregate :** VocabularyAggregate (§2.8 DOC-017)
- **Stratégie DOC-017 :** Embedded Collection

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `cle_namespace` | chaîne | Requis | Clé unique du namespace |
| `description` | chaîne | Optionnel | |
| `date_creation` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-VOC-NS-001 : Namespace immutable once created
- CC-VOC-NS-002 : Toujours au moins finance et common

---

### 8.2 Objet Physique : `vocab_term`

- **Owner Aggregate :** VocabularyAggregate
- **Stratégie DOC-017 :** Embedded Collection

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `namespace_id` | identifiant | Requis | Namespace parent |
| `cle_term` | chaîne | Requis | Clé stable (never changes) |
| `label_fr` | chaîne | Requis |
| `label_en` | chaîne | Requis |
| `est_deprecie` | booléen | Requis |
| `date_deprecation` | date/heure | Optionnel | Si déprécié |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-VOC-TERM-001 : `cle_term` immutable (keys stable forever)
- CC-VOC-TERM-002 : FR+EN minimum toujours présent
- CC-VOC-TERM-003 : Jamais supprimé, seulement déprécié

---

### 8.3 Objet Physique : `vocab_term_value`

- **Owner Aggregate :** VocabularyAggregate
- **Stratégie DOC-017 :** Embedded Collection + Translation Pair

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `term_id` | identifiant | Requis | Terme parent |
| `cle_valeur` | chaîne | Requis | Clé de valeur |
| `libelle_fr` | chaîne | Requis | Traduction FR |
| `libelle_en` | chaîne | Requis | Traduction EN |
| `couleur_hex` | chaîne | Optionnel | Couleur associée |
| `est_deprecie` | booléen | Requis |
| `date_deprecation` | date/heure | Optionnel |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `vocab_term` | sortante | N:1 | Compositionnelle |

---

## 9. REPORTING AGGREGATE

### 9.1 Objet Physique : `report_definition`

- **Owner Aggregate :** ReportingAggregate (§2.9 DOC-017)
- **Stratégie DOC-017 :** Read Model + Snapshot

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `cle_rapport` | chaîne | Requis | Clé unique du rapport |
| `titre_fr` | chaîne | Requis |
| `titre_en` | chaîne | Requis |
| `periode_type` | énumération | Requis | month / quarter / year / custom |
| `format_export` | collection | Requis | pdf / csv / json |
| `date_creation` | date/heure | Requis |
| `date_derniere_generation` | date/heure | Optionnel |
| `_org_id` | identifiant | Requis | |

---

### 9.2 Objet Physique : `generated_report_snapshot`

- **Owner Aggregate :** ReportingAggregate
- **Stratégie DOC-017 :** Snapshot

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `definition_id` | identifiant | Requis | Report definition généré |
| `periode_debut` | date/heure | Requis | Début de période |
| `periode_fin` | date/heure | Requis | Fin de période |
| `portee` | énumération | Requis | org / group / all |
| `total_revenu` | numérique | Requis | Total revenus (montant minimal) |
| `total_depense` | numerical | Requis | Total dépenses |
| `resultat_net` | numérique | Requis | Revenu - dépense |
| `details_par_categorie` | objet intégré | Requis | Breakdown par catégorie |
| `nombre_transactions` | numérique | Requis | |
| `horodatage_genere` | date/heure | Requis | Signature numérique |
| `signature_numerique` | chaîne | Requis | |
| `date_generation` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-RPT-001 : `total_revenu` - `total_depense` doit égaler `resultat_net` (bilan équilibré)
- CC-RPT-002 : Seules les transactions approuvées participent au calcul

---

## 10. AUDIT AGGREGATE

### 10.1 Objet Physique : `audit_log_entry`

- **Owner Aggregate :** AuditAggregate (§2.10 DOC-017)
- **Stratégie DOC-017 :** Immutable Log exclusively
- **NB-PERSIST-006 :** SEUL cet aggregate utilise Immutable Log

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `sequence_log` | numérique | Requis | Position séquentielle (ordre d'insertion) |
| `action_effectuee` | énumération | Requis | create / update / delete / approve / reject / transfer / notify / other |
| `entite_type` | chaîne | Requis | Type de l'entité auditée |
| `entite_id` | identifiant | Requis | ID de l'entité auditée |
| `utilisateur_id` | identifiant | Requis | Qui a effectué l'action |
| `valeur_avant` | objet intégré | Requis | Snapshot avant l'action |
| `valeur_apres` | objet intégré | Requis | Snapshot après l'action |
| `adresse_ip` | chaîne | Optionnel | Origine de la requête |
| `date_heure_utc` | date/heure | Requis |
| ` duree_retention_annees` | numérique | Requis | Minimum 7 ans configurable |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-AUD-001 : Append-only absolu — aucune modification, aucun delete
- CC-AUD-002 : `valeur_avant` + `valeur_apres` toujours présents (FullSnapshotPolicy)
- CC-AUD-003 : Pas d'auto-audit (empêche récursion infinie)
- CC-AUD-004 : Accessible uniquement par admins et auditeurs
- CC-AUD-005 : Conserver minimum 7 ans (configurable)

#### Cycle de Vie

Jamais supprimé pendant la période de rétention. Après : cold storage ou purge (enregistrée dans une entrée d'audit elle-même).

---

## 11. LIFECYCLE AGGREGATE

### 11.1 Objet Physique : `archive_entry`

- **Owner Aggregate :** LifecycleAggregate (§2.11 DOC-017)
- **Stratégie DOC-017 :** Versioned Document

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `archive_par` | identifiant | Requis | User qui a archivé |
| `type_resource_archives` | énumération | Requis | baptism / teaching / program / custom / ... |
| `resource_type_original` | énumération | Requis | transaction / member / event / archive_entry |
| `resource_id_original` | identifiant | Requis | Lien vers la resource originale |
| `member_lié_id` | identifiant | Optionnel | Member lié (facultatif) |
| `metadonnees_archive` | objet intégré | Requis | JSONB extensible par type archivable |
| `tags` | collection | Optionnel | TEXT array pour recherche/filtrage |
| `categorie` | chaîne | Optionnel | Configurable par manifest |
| `url_pieces_jointes` | collection | Optionnel | URLs de fichiers attachés |
| `etat_lifecycle` | énumération | Requis | active / archived / trashed / purged |
| `date_archivage` | date/heure | Requis | |
| `date_corbeille` | date/heure | Optionnel | Soft delete tracking |
| `date_purge` | date/heure | Optionnel | Purge irréversible |
| `motif_purge` | chaîne | Optionnel | |
| `version` | numérique | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| appartient à | `organization` | sortante | N:1 | |
| archive par | `user` | sortante | N:1 | Associative |
| référence | `member_record` | sortante | N:1 | Optionnel |
| pointe vers | `transaction_record` | sortante | N:1 | Original resource link |
| pointe vers | `event_record` | sortante | N:1 | Original resource link |

#### Contraintes Conceptuelles

- CC-LIF-001 : États configurables via manifest.lifecycle.types[]
- CC-LIF-002 : Purge irréversible (N/A restore)
- CC-LIF-003 : Entrées corbeillées invisibles dans requêtes normales

---

### 11.2 Objet Physique : `purge_schedule`

- **Owner Aggregate :** LifecycleAggregate
- **Stratégie DOC-017 :** Versioned Document

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `entry_id` | identifiant | Requis | ArchiveEntry cible |
| `etats_e ligibles` | énumération | Requis | Trashed / Archived |
| `programme_par_systeme` | booléen | Requis | |
| `date_planifiee` | date/heure | Requis | |
| `executee` | booléen | Requis | |
| `date_execution` | date/heure | Optionnel | |
| `executee_par` | identifiant | Optionnel | |
| `_org_id` | identifiant | Requis | |

---

## 12. CONFIGURATION AGGREGATE

### 12.1 Objet Physique : `setting_entry`

- **Owner Aggregate :** ConfigurationAggregate (§2.12 DOC-017)
- **Stratégie DOC-017 :** Embedded Key-Value

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `cle_parametre` | chaîne | Requis | Clé de configuration |
| `valeur` | objet intégré | Requis | String, number, boolean, object |
| `mis_a_jour_par` | identifiant | Requis | Admin |
| `mis_a_jour_le` | date/heure | Requis | |
| `valeur_defaut` | objet intégré | Requis | Fallback si null |
| `_org_id` | identifiant | Requis | |

#### Contraintes Conceptuelles

- CC-CFG-001 : Chaque paramètre a une valeur par défaut (fallback garanti)
- CC-CFG-002 : Jamais supprimé, seulement mis à jour

---

## 13. OFFLINE SYNC AGGREGATE

### 13.1 Objet Physique : `pending_operation`

- **Owner Aggregate :** OfflineSyncAggregate (§2.13 DOC-017)
- **Stratégie DOC-017 :** Collection + Append-only queue

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `resource_type` | énumération | Requis | transaction / member / event / archive_entry |
| `resource_id` | identifiant | Requis | ID de la resource modifiée |
| `action` | énumération | Requis | create / update / delete |
| `payload` | objet intégré | Requis | Snapshot JSON brut de la resource |
| `statut_sync` | énumération | Requis | pending / sent / confirmed / failed |
| `tentative_num` | numérique | Requis | Retry counter (max 5) |
| `prochaine_retry` | date/heure | Optionnel | Pour backoff exponentiel |
| `date_creation` | date/heure | Requis | |
| `date_last_sync` | date/heure | Requis | |
| `_org_id` | identifiant | Requis | |

#### Relations

| Relation | Cible | Direction | Cardinalité | Propriétaire |
|----------|-------|-----------|-------------|-------------|
| opère sur | `transaction_record` | sortante | N:1 | Associative |
| opère sur | `member_record` | sortante | N:1 | Associative |
| opère sur | `event_record` | sortante | N:1 | Associative |

#### Contraintes Conceptuelles

- CC-SYNC-001 : Local write ALWAYS before remote push (BR-SYNC-001)
- CC-SYNC-002 : Batch size max 50 ops (BR-SYNC-002)
- CC-SYNC-003 : Retry exponential backoff max 5 tentatives (BR-SYNC-003)
- CC-SYNC-004 : Jamais bloquer opération utilisateur (BR-SYNC-004)

---

### 13.2 Objet Physique : `sync_status_tracker`

- **Owner Aggregate :** OfflineSyncAggregate
- **Stratégie DOC-017 :** Embedded VO

#### Attributs

| Attribut | Catégorie de Type | Cardinalité | Description |
|----------|------------------|-------------|-------------|
| `identifier` | identifiant | 1:1 |
| `org_id` | identifiant | Requis |
| `table_reference` | chaîne | Requis | Nom logique de la table surveillée |
| `derniere_synchro_timestamp` | date/heure | Requis | |
| `etat_connection` | énumération | Requis | online / offline |
| `derniere_operation_push` | date/heure | Optionnel | |
| `derniere_operation_pull` | date/heure | Optionnel | |
| `_org_id` | identifiant | Requis | |

#### Cycle de Vie

Indéfini, timestamps monotones jamais invalidés.

---

## RESUME DE L'OBJET PHYSIQUE PAR AGGREGAT

| Aggregate | Objets Physiques | Stratégie Principale |
|-----------|-----------------|---------------------|
| OrganizationAggregate | organization, org_unit, organization_settings | Referenced + Embedded Collection + Embedded VO |
| IdentityAggregate | user, session_context, credential | Referenced + Embedded + Append-only (sessions) |
| ResourceAggregate | transaction_record, member_record, event_record, category_record | Collection + Versioned Document |
| RelationshipAggregate | group_membership, org_unit_parent_link | Embedded Collection + Referenced |
| WorkflowAggregate | approval_workflow_instance, approval_workflow_step, workflow_execution_log | Versioned Document + Event Log |
| FormAggregate | form_definition, form_section, form_field | Embedded + Semantic Versioning |
| NotificationAggregate | notification_message, notification_preference, notification_delivery_log | Collection + Embedded VO + Event Log |
| VocabularyAggregate | vocab_namespace, vocab_term, vocab_term_value | Embedded Collection |
| ReportingAggregate | report_definition, generated_report_snapshot | Snapshot |
| AuditAggregate | audit_log_entry | Immutable Log exclusively |
| LifecycleAggregate | archive_entry, purge_schedule | Versioned Document |
| ConfigurationAggregate | setting_entry | Embedded Key-Value |
| OfflineSyncAggregate | pending_operation, sync_status_tracker | Collection + Embedded VO |

**Total : 30 Objets Physiques distribués sur 13 Aggregates.**

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|-----------|
| 1.0 | 2026-07-24 | Chief Platform Architect | Création — Modèle physique canonique pour les 13 Aggregates de Lumina (30 Objets Physiques) | CTO + Arch Principal |
