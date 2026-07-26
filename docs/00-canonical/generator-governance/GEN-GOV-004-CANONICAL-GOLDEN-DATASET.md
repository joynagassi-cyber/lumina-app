# GEN-GOV-004 — Canonical Golden Dataset

**Doc ID:** GEN-GOV-004  
**Version:** 1.0  
**Statut:** DATASET GOLDEN CANONIQUE FIGEE  
**Date:** 2026-07-26  
**Auteur:** Agnes-2.0-Flash (Sapiens AI) — Agent Generator Governance  
**Source canonique :** IGS-v1 §4 (Determinism), §5 (Traceability), §6 (Regeneration), MASTER-PIPELINE-SPECIFICATION.md, GENERATOR-CERTIFICATION-REPORT.md  
**Application:** Reference figee des documents canoniques et de leurs artefacts generes attendus — unique base de comparaison pour la detection de derive  

---

## 1. OBJET

Le Golden Dataset est un ensemble de donnees de reference utilise pour tester la reproductibilite des generateurs IGS-v1. Il figure le point dans le temps ou les documents canoniques et leurs sorties attendues ont ete figees (gelées) ensemble.

### 1.1 Utilisation Principale

Le Golden Dataset sert UNIQUEMENT a:

1. **Detection de derive**: Comparer l'empreinte SHA-256 d'un artefact genere avec son hash attendu depuis le dataset. Si les hashes different ET que les documents canoniques n'ont pas change, c'est une derive qui doit etre investiguee.
2. **Tests de regression**: Servir de reference pour les tests de regression decrits dans GEN-GOV-003. Chaque test compare la sortie actuelle contre le Golden Dataset.
3. **Validation de regeneration**: Apres avoir supprime tous les artefacts et relance le pipeline, verifier que les nouveaux artefacts correspondent au Golden Dataset (hors timestamps dans les headers).
4. **Audit periodique**: Une fois par an, verifier que le Golden Dataset correspond toujours aux documents canoniques actuels.

### 1.2 Ce Que Le Golden Dataset N'Est PAS

- Ce n'est PAS un archive de documentation. C'est un benchmark technique pour la validation automatique.
- Ce n'est PAS un remplacement de la documentation canonique. Les documents DOC-000 a DOC-024 restent les sources de verite.
- Ce n'est PAS une specification de generation. Il ne contient PAS les regles de transformation, seulement les resultats attendus.

---

## 2. COMPOSANTS DU DATASET

Le Golden Dataset se compose de trois ensembles de donnees lies:

### 2.1 Documents Canoniques de Reference

Pour que le Golden Dataset ait un sens, les documents canoniques qu'il references doivent etre en etat known. Les versions suivantes sont figees comme reference:

| Document | Version Fige | Status de Gel | Note |
|----------|-------------|---------------|------|
| DOC-000 | v1.0 | GELÉ — Canonical Architecture Model | Hierarchie 13 niveaux, 5 regles fondamentales |
| DOC-001 | v1.0 | GELÉ — Canonical Element Registry | 57 elements catalogs |
| DOC-004 | v1.0 | GELÉ — Canonical Mapping Rules | 12 PONTs entre couches |
| DOC-005 | v1.0 | GELÉ — Capability Dependency Graph | DAG 18 capacites, 0 cycle |
| DOC-006 | v1.0 | GELÉ — Concept-Aggregate Mapping | Mapping concepts→aggregates |
| DOC-008 | v1.0 | GELÉ — Architecture Decision Constitution | Pipeline decisionnel 9 étapes |
| DOC-009 | v1.0 | GELÉ — Architecture Decision Trees | 6 arbres de décision |
| DOC-010 | v1.0 | GELÉ — Architecture Smells Paybook | 12 architecture smells |
| DOC-011 | v1.0 | GELÉ — Architecture Governance Workflow | Workflow 6 phases |
| DOC-012 | v1.0 | GELÉ — Canonical Domain Model | 13 Aggregates, 22 Entities, 40+ VOs, 70+ BR |
| DOC-013 | v1.0 | GELÉ — Aggregate Boundary Specification | 13 Boundary specs |
| DOC-014 | v1.0 | GELÉ — Domain Command Event Registry | 70 Commands + 60 Events |
| DOC-015 | v1.0 | GELÉ — Domain Invariant Registry | 58 Invariants (38C/15M/5Mi) |
| DOC-016 | v1.0 | GELÉ — Domain Model Validation Report | Validation DDD complete |
| DOC-017 | v1.0 | GELÉ — Persistence Model | PO metadata, Serialization Patterns |
| DOC-018 | v1.0 | GELÉ — Aggregate Persistence Mapping Rules | 4-etapes mapping pipeline |
| DOC-019 | v1.0 | GELÉ — Persistence Strategy Catalog | 9 strategies, matrice selection |
| DOC-020 | v1.0 | GELÉ — Persistence Validation Report | 10/10 checks PASS |
| DOC-021 | v1.0 | GELÉ — Physical Data Model | 30 Objets Physiques |
| DOC-022 | v1.0 | GELÉ — PO Physical Mapping Rules | Structural Patterns |
| DOC-023 | v1.0 | GELÉ — Canonical Relational Rules | 27 NeverBreak rules |
| DOC-024 | v1.0 | GELÉ — PDM Validation Report | Validation modele physique |
| ARA-v1 | v1.0 | GELÉ — Architecture Review Audit | Verdict GO avec réserves |
| IGS-v1 | v1.0 | GELÉ — Implementation Generation Specification | Pipeline de génération |

**Integrite des documents referencés:**

Chaque document figure dans le Golden Dataset avec son empreinte SHA-256. Toute modification d'un document canonique DOIT d'abord verifier que le nouveau SHA-256 ne correspond plus à celui du Golden Dataset, ce qui déclenche une re-generation obligatoire.

### 2.2 Resultats Attendus (Hash SHA-256)

Pour chaque generateur, le Golden Dataset contient les hashes SHA-256 attendus des artefacts produces. Ces hashes servent de référence pour la detection de derive.

#### 2.2.1 schema-generator

| Artefact Attendu | Contenu | Nombre d'Eléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| POSTGRESQL-SCHEMA-PACK-v1.md | Schéma relationnel complet | 32 tables | À figer lors du premier gel | À calculer |
| SQL-DDL-SPECIFICATION-v1.md | Definition DDL complete | Toutes les colonnes detaillees | À figer lors du premier gel | À calculer |

**Proprietes structurelles figees pour validation automatique:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Nombre de tables | 32 | Compte exact |
| Colonnes par table: organizations | 15 | SHA256(POSTGRESQL-SCHEMA-PACK-v1.md) section table |
| Colonnes par table: users | 17 | SHA256(POSTGRESQL-SCHEMA-PACK-v1.md) section table |
| Tables avec org_id direct | 22 | Compte exact |
| Tables avec org_id hérité | 10 | Compte exact |
| Types de colonnes autorisés | uuid, varchar, bigint, integer, timestamptz, date, boolean, jsonb, text[] | Liste exhaustive |
| Convention nommage tables | pluriel snake_case | Pattern regex |
| Primary key pattern | uuid DEFAULT gen_random_uuid() | Pattern sur CREATE TABLE |
| CHECK constraints count | 38+ | Minimum |
| UNIQUE constraints count | 10 | Exact |
| Foreign keys count | ~54 | Range approximative |
| Standard persistence columns | version, synced_at, local_updated_at, conflict_strategy, is_deleted, purge_eligible_at | Liste prescriptive |

#### 2.2.2 migration-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| MIGRATION-PACK-V1.md | 35 migrations séquentielles | 35 scripts SQL | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Nombre de migrations | 35 | Compte exact |
| Numéroation contigue | MIG-001 à MIG-035 | Pattern séquentiel |
| Première migration | MIG-001 créant organizations | Ordre topologique racine |
| IF NOT EXISTS présent | 32/32 CREATE TABLE | Pattern sur chaque CREATE |
| Rollback présent | 35/35 migrations | Section détectée |
| Headers IGS complets | 35/35 migrations | 7 champs metadata présents |
| Table count unique | 32 tables uniques | Pas de doublon |

#### 2.2.3 constraint-index-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| CONSTRAINTS-INDEX-SPECIFICATION-v1.md | Contraintes et indexes | 38 CHECK + 10 UNIQUE + ~54 FK + ~50 index + 4 GIN | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| CHECK constraints | 38+ | Minimum |
| UNIQUE constraints | 10 | Exact |
| Foreign Key constraints | ~54 | Approximation |
| B-tree indexes | 50+ | Minimum |
| Index org_id sur toutes tables | 32 (22 directs + 10 hérités) | Compte exact |
| GIN indexes JSONB | 4 | Exact |
| NB-RR-008 respect | Oui, audit_entries uniquement | Valeur booléenne |
| Coverage invariants physiques | ~78% (45/58) | Ratio |

#### 2.2.4 rls-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| RLS-POLICY-SPECIFICATION-V1.md | Politiques RLS per-table | 32 tables × 9 rôles ≈ 541 politiques | À figer lors du premier gel | À calculer |
| BOOTSTRAP-MIGRATION-SPECIFICATION-V1.md | 4 scripts bootstrap | 4 scripts SQL (000-003) | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Roles définis | 9 | Compte exact |
| Tous NOSUPERUSER NOINHERIT LOGIN | 9/9 | Vérification attributs |
| Tables couvertes | 32/32 | Compte exact |
| Policies naming convention | pol_table_role_action | Pattern regex |
| USING clause contient org_id | 100% | Verification coverage |
| FORCE RLS tables | audit_entries uniquement | Compte exact = 1 |
| Bootstrap scripts | 4 (000-003) | Compte exact |

#### 2.2.5 api-contract-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| API Contract Specification | Endpoints + types + error codes | 70 Commands mappés | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Endpoints par Command | 1:1 mapping | 70 endpoints minimum |
| Error codes definis | 400, 401, 403, 409, 422 | Liste exhaustive |
| Response format uniforme | { data, version, sync_status } | Pattern sur response |
| Headers requis | x-org-id, Authorization Bearer JWT | Liste prescriptive |

#### 2.2.6 service-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| Application Service Implementations | Méthodes de services applicatifs | 70 Commands mappées | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Methodes par Command | 1:1 mapping | 70 methodes minimum |
| Guards invariant présents | ≥58 guards (un par invariant CRITIQUE) | Compte minimum |
| Domain Events émis | après chaque état changé | Present dans chaque methode d'écriture |
| Audit logging systématique | AuditAggregate.LogAction() | Présent dans chaque methode |

#### 2.2.7 deployment-config-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| Deployment Configuration Set | Dockerfiles, docker-compose.yml, CI/CD | Services de DOC-001 | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Containers listés dans DOC-001 | 8 Runtime Services max | Correspondance exacte |
| Dépendances non cataloguées | 0 | Compte exact zéro |

#### 2.2.8 ui-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| React Native Component Set | Composants dynamiques | FormDefinitions + Vocabulary | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Hardcoded JSX forms | 0 | Compte exact zéro |
| Hardcoded vocabulary terms | 0 | Compte exact zéro |
| Labels FR/EN résolus | Tous les labels | Present sur chaque formulaire |

#### 2.2.9 test-generator

| Artefact Attendu | Contenu | Nombre d'Éléments | Hash SHA-256 Attendu | Statut |
|-----------------|---------|------------------|---------------------|--------|
| Test Suite | Tests unitaires + integration | Couverture invariants | À figer lors du premier gel | À calculer |

**Propriétés structurales figees:**

| Propriété | Valeur Attendue | Type de Vérification |
|-----------|----------------|---------------------|
| Tests par invariant CRITIQUE | ≥2 (violé + respecté) | Compte minimum par invariant |
| Tests par invariant MAJEUR | ≥1 (integration guard) | Compte minimum par invariant |
| Tests par invariant MINEUR | ≥1 (smoke) | Compte minimum par invariant |
| E2E tests générés automatiquement | 0 | Compte exact zéro |
| Couverture totale invariants | 100% (58/58) | Ratio 58/58 |

### 2.3 Scripts de Comparaison

Des scripts de comparaison DOIVENT être disponibles pour comparer automatiquement les artefacts générés avec le Golden Dataset. Ces scripts implémentent les vérifications suivantes:

#### 2.3.1 Hash Comparison Script

Fonctionnement attendu:

```
INPUT:
  - Generated artifact file path(s)
  - Golden Dataset expected hash(es)
PROCESS:
  For each artifact:
    1. Compute SHA-256 of generated artifact content
    2. Look up expected SHA-256 in Golden Dataset
    3. Compare: if equal → PASS; if different → DRIFT detected
    4. If DRIFT detected: determine drift level (FORMAT_ONLY, STRUCTURAL, SEMANTIC)
OUTPUT:
  - Pass/fail verdict per artifact
  - Drift level classification if mismatch
  - Detailed diff report for structural/semantic mismatches
```

#### 2.3.2 Property Comparison Script

Fonctionnement attendu:

```
INPUT:
  - Generated artifact file
  - Golden Dataset expected properties (counts, patterns, structures)
PROCESS:
  For each expected property:
    1. Extract the corresponding value from the generated artifact
    2. Compare against expected value
    3. Classify match as: EXACT_MATCH, WITHIN_TOLERANCE, or MISMATCH
OUTPUT:
  - Property-by-property comparison table
  - Summary: N/M properties matching exactly
```

#### 2.3.3 Traceability Verification Script

Fonctionnement attendu:

```
INPUT:
  - Generated artifacts from all active generators
PROCESS:
  For each element in each artifact:
    1. Check for IGS-v1 metadata header
    2. Verify source_canonical field contains valid DOC-XXX reference
    3. Cross-reference reference against source document sections
    4. Flag any element without valid traceability
OUTPUT:
  - List of orphan elements (none expected)
  - Valid traceability chain count
```

#### 2.3.4 NeverBreak Compliance Script

Fonctionnement attendu:

```
INPUT:
  - Generated artifacts from all active generators
  - NeverBreak rules: NB-PERSIST-001 to NB-PERSIST-012, NB-RR-001 to NB-RR-008
PROCESS:
  For each NeverBreak rule:
    1. Scan relevant artifacts for violations of that specific rule
    2. Pattern match for forbidden constructs
    3. Cross-check constraint existence vs invariant declarations
OUTPUT:
  - Rule-by-rule compliance status: PASS/FAIL
  - Details of any violation found
```

---

## 3. HASH REFERENCES — DETAILED PER GENERATOR

### 3.1 Hash Computation Methodology

SHA-256 hashes are computed over the COMPLETE file content, including IGS-v1 metadata headers. The methodology ensures reproducibility:

1. **Content**: Full text of the artifact file (including header comment block).
2. **Encoding**: UTF-8 encoding assumed for all files.
3. **Line endings**: The hash is computed on the file as-is (platform-dependent line endings preserved).
4. **Whitespace**: No trimming — trailing whitespace, blank lines, and indentation are included in the hash.
5. **Timestamps**: The `generation_date` field in the header IS included in the hash. This means the hash will differ across generations. For regression purposes, the `validation_hash` field (which covers the ENTIRE file content) should be compared after replacing the timestamp with a canonical placeholder.

**Canonical placeholder approach for hash comparison:**

Before comparing hashes between generations:
1. Replace `generation_date` value with placeholder string `"__GENERATION_DATE__"`
2. Replace `generation_id` value with placeholder string `"__GENERATION_ID__"`
3. Replace `validation_hash` value with placeholder string `"__VALIDATION_HASH__"`
4. Recompute SHA-256 of the modified content
5. Compare against Golden Dataset hash

This ensures deterministic comparison independent of when the generation occurred.

### 3.2 Current Hash Values

The following hash values WILL BE populated when the Golden Dataset is first frozen. As of v1.0 of this specification, placeholder markers are used:

| Generator | Artifact | Hash SHA-256 (Frozen) | Last Computed | Frozen On |
|-----------|----------|----------------------|--------------|-----------|
| schema-generator | POSTGRESQL-SCHEMA-PACK-v1.md | `__TO_BE_FROZEN__` | — | — |
| schema-generator | SQL-DDL-SPECIFICATION-v1.md | `__TO_BE_FROZEN__` | — | — |
| migration-generator | MIGRATION-PACK-V1.md | `__TO_BE_FROZEN__` | — | — |
| constraint-index-generator | CONSTRAINTS-INDEX-SPECIFICATION-v1.md | `__TO_BE_FROZEN__` | — | — |
| rls-generator | RLS-POLICY-SPECIFICATION-V1.md | `__TO_BE_FROZEN__` | — | — |
| rls-generator | BOOTSTRAP-MIGRATION-SPECIFICATION-V1.md | `__TO_BE_FROZEN__` | — | — |
| api-contract-generator | API Contract Specification | `__TO_BE_FROZEN__` | — | — |
| service-generator | Application Service Implementations | `__TO_BE_FROZEN__` | — | — |
| deployment-config-generator | Deployment Configuration Set | `__TO_BE_FROZEN__` | — | — |
| ui-generator | React Native Component Set | `__TO_BE_FROZEN__` | — | — |
| test-generator | Test Suite | `__TO_BE_FROZEN__` | — | — |

**Procedure to freeze hashes:**

1. Execute a full pipeline run from Phase 0 through Phase 10C.
2. Collect all output artifacts.
3. Apply canonical placeholder substitution (replace timestamps).
4. Compute SHA-256 of each processed artifact.
5. Record hashes in this table.
6. Sign the frozen dataset (cryptographic signature or manual sign-off by Chief Platform Architect).

### 3.3 Historical Hash Archive

When the Golden Dataset is updated (because a canonical document changed), the OLD hashes must be preserved in an archive for historical audit purposes:

| Archive Entry | Description | Retention |
|--------------|-------------|-----------|
| `golden-dataset-v1.0-original.json` | Original frozen hashes | Indefinite |
| `golden-dataset-v1.1-after-doc021-change.json` | Updated hashes after DOC-021 change | Indefinite |
| Any subsequent update | Each update creates a new numbered entry | Indefinite |

Each archived entry MUST include:
- Date of archival
- Which canonical documents were modified since previous version
- Which generator outputs changed
- Full diff summary of what changed
- New frozen hashes
- Approval sign-off

---

## 4. MISE À JOUR ET GESTION

### 4.1 When to Update

| Trigger | Action Required | Approval Needed |
|---------|----------------|----------------|
| ANY canonical document modified | Recalculate affected hashes → update Golden Dataset | Chief Platform Architect |
| New generator added | Run full generation → add new entries to Golden Dataset | Full certification process |
| Annual review (minimum) | Recalculate ALL hashes → verify consistency | All generator auditors |
| Drift detected | Investigate → if new output is correct per current canonical docs → update dataset | Generator Auditor + Chief Platform Architect |
| Golden Dataset corrupted | Recompute from scratch using current canonical documents | Emergency — notify all stakeholders |

### 4.2 Update Procedure

When updating the Golden Dataset:

1. **Identify scope**: Which canonical document changed? Which generators are affected?
2. **Regenerate**: Run affected generators from the point where the changed document enters the pipeline.
3. **Validate**: Run all 6 validation steps (V-STRUCT through V-INVENT) on regenerated artifacts.
4. **Compare**: Run diff between old artifacts and new artifacts. Document what changed.
5. **Assess**: Was the change intentional (expected due to doc change) or unexpected (potential bug)?
   - If INTENTIONAL → proceed to step 6.
   - If UNEXPECTED → investigate root cause BEFORE updating Golden Dataset.
6. **Freeze new hashes**: Apply canonical placeholder substitution, compute SHA-256, record in dataset.
7. **Archive old hashes**: Create dated archive entry with full history.
8. **Sign off**: Chief Platform Architect signs the updated dataset.
9. **Notify**: All generator owners notified of the update.

### 4.3 Stability Guarantee

Once frozen, the Golden Dataset SHOULD NOT change unless a canonical document changes. This stability is critical for the regression test suite to function correctly. Arbitrary changes to the Golden Dataset (without corresponding canonical document changes) are prohibited.

**Prohibited reasons for Golden Dataset change:**

| Reason | Prohibited? | Alternative |
|--------|------------|-------------|
| "Looks nicer" formatting preference | YES — cosmetic changes don't justify dataset update | Leave generation as-is |
| Developer opinion about better approach | YES — subjective preferences are not canonical changes | Raise as improvement observation |
| "Simpler" without canonical basis | YES | Document as suggestion, do not enforce |
| Performance optimization desire | NO IF performance change is mandated by a canonical document change | Must have canonical basis |

---

## 5. GOLDEN DATASET STRUCTURE

### 5.1 File Organization

The Golden Dataset is stored as a collection of structured reference files:

```
docs/00-canonical/generator-governance/
├── GEN-GOV-004-CANONICAL-GOLDEN-DATASET.md  ← THIS DOCUMENT (overview and hash references)
├── golden-dataset-v1.0-metadata.json         ← Machine-readable metadata
├── golden-dataset-v1.0-hashes.json           ← All SHA-256 hashes
├── golden-dataset-v1.0-properties.json       ← Expected structural properties per artifact
└── archive/
    ├── golden-dataset-v1.0-original/
    │   ├── hashes.json
    │   └── properties.json
    └── (future updates appended here)
```

### 5.2 Machine-Readable Metadata Format

The machine-readable companion files use JSON structure to enable automated comparison scripts:

```json
{
  "datasetVersion": "v1.0",
  "frozenDate": "YYYY-MM-DD",
  "canonicalDocumentVersions": {
    "DOC-000": "v1.0",
    "DOC-001": "v1.0",
    "...": "...",
    "DOC-024": "v1.0",
    "ARA-v1": "v1.0",
    "IGS-v1": "v1.0"
  },
  "generators": [
    {
      "name": "schema-generator",
      "phase": 1,
      "inputs": ["DOC-021", "DOC-023"],
      "artifacts": [
        {
          "fileName": "POSTGRESQL-SCHEMA-PACK-v1.md",
          "sha256": "hash_placeholder",
          "properties": {
            "tableCount": 32,
            "directOrgIdTables": 22,
            "inheritedOrgIdTables": 10
          }
        }
      ]
    }
  ],
  "approvalSignatures": {
    "chiefPlatformArchitect": "signed-on YYYY-MM-DD",
    "generatorAuditors": ["auditor1-signed", "auditor2-signed"]
  }
}
```

### 5.3 Hash Integrity Verification

The Golden Dataset itself MUST be integrity-verified periodically:

| Check | Frequency | Method |
|-------|-----------|--------|
| Dataset JSON files unmodified | Monthly | SHA-256 comparison against signed baseline |
| Archive entries intact | Yearly | Manual review + automated checksum |
| Hash signatures valid | Yearly | Cryptographic signature verification or manual confirmation |
| Canonical document versions match current | Continuous | Compare stored versions against actual documents |

---

## 6. GOLDEN DATASET USAGE CONSTRAINTS

### 6.1 Permitted Use

| Activity | Allowed? | Notes |
|----------|---------|-------|
| Automated regression testing | YES | Primary purpose |
| Drift detection comparisons | YES | Primary purpose |
| Manual artifact quality review | YES | Supports human auditing |
| Training material for new auditors | YES | Educational use permitted |
| External sharing | NO | Internal to governance framework only |

### 6.2 Modification Restrictions

| Modification Type | Allowed? | Approver |
|------------------|---------|----------|
| Adding new hash entries for new generators | YES | Chief Platform Architect |
| Updating hashes after canonical doc change | YES | Chief Platform Architect + auditor |
| Updating hashes WITHOUT canonical doc change | NO | Not permitted |
| Removing archived entries | NO | Historical records are immutable |
| Modifying approval signatures | NO | Signatures are final |
| Changing dataset version number | YES | Only on official version bump |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Statut |
|---------|------|--------|-------------|--------|
| 1.0 | 2026-07-26 | Agnes-2.0-Flash (Sapiens AI) | Creation — Specification dataset golden canonique | ACTIVE — hashes TO_BE_FROZEN |

---

*Ce document est une specification de gouvernance abstraite. Il definit les structures, les proprietes attendues, et les procedures de gestion du Golden Dataset. Les hashes SHA-256 reels seront fills lors du premier gel du dataset. Ce document ne fait pas partie de la serie DOC-000 a DOC-024.*
