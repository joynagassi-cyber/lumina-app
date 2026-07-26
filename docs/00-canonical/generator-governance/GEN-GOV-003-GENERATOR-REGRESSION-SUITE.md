# GEN-GOV-003 — Generator Regression Suite

**Doc ID:** GEN-GOV-003  
**Version:** 1.0  
**Statut:** SPECIFICATION SUITE REGRESSION GENERATEURS FIGEE  
**Date:** 2026-07-26  
**Auteur:** Agnes-2.0-Flash (Sapiens AI) — Agent Generator Governance  
**Source canonique :** IGS-v1 §4 (Determinism Rules), §8 (Validation Loop), MASTER-PIPELINE-SPECIFICATION.md §Phases, IGSC-V1 §Sections A-G  
**Application:** Specification du cadre de tests de regression pour valider la stabilite des generateurs IGS-v1  

---

## 1. PHILOSOPHIE DES TESTS DE REGRESSION

### 1.1 Pourquoi Tester les Generateurs ?

Les tests de regression des generateurs servent a un seul objectif : s'assurer qu'une modification au niveau des documents canoniques (DOC-000 a DOC-024, ARA-v1, IGS-v1) ou des regles de transformation ne change PAS les sorties de maniere inattendue.

En d'autres termes, si le document canonique source N'A PAS CHANGE, l'artefact technique genere DOIT RESTER IDENTIQUE (hors metadonnees de timestamp/hash). Si un artefact change alors que sa source n'a pas change, c'est soit une regression dans le generateur, soit une violation de la regle D-001 (Determinisme).

### 1.2 Principes Directeurs des Tests

| Principe | Description | Justification Constitutionnelle |
|----------|-------------|--------------------------------|
| **Golden Dataset Reference** | Chaque test compare la sortie actuelle contre une reference figee (Golden Dataset, GEN-GOV-004) | Reproducibilite exigeant HASH identique |
| **Determinism First** | Les tests prioritaires sont ceux qui verificient les regles D-001 a D-005 | Determinisme est le principe P-1 fondamental |
| **Traceability Guaranteed** | Chaque artefact teste doit avoir une chaine de traçabilite complete | Traçabilite est le principe P-2 fondamental |
| **Non-Invention Enforced** | Aucune nouvel élément ne peut apparaitre sans changement de source | Non-invention est le principe P-4 fondamental |
| **NeverBreak Immunity** | Aucune generation ne peut violer une regle NeverBreak | Les regles NB-PERSIST-XXX et NB-RR-XXX sont constitutionnelles |
| **Incremental Impact** | Un changement source ne déclenche la regression que sur les generateurs concernés | Indépendance est le principe P-3 fondamental |

### 1.3 What This Specification Is NOT

- Ce document NE definit AUCUNE implementation technique de tests (pas de code Python, TypeScript, etc.).
- Ce document NE spécifie AUCun framework de test (pas de Jest, pytest, Mocha, etc.).
- Ce document NE definit AUCune configuration CI/CD specifique (pas de GitHub Actions, GitLab CI, Jenkinsfile).
- Ce document defini UNIQUEMENT CE qui doit être testé, COMMENT les critères de passage/échec sont définis, et QUAND les tests sont exécutés.

---

## 2. GOLDEN DATASET

### 2.1 Purpose of the Golden Dataset

The Golden Dataset is a frozen snapshot of canonical documents and their expected generated outputs at a specific point in time. It serves as the single source of truth for regression testing. Every generator's output is compared against its corresponding Golden Dataset entry.

The Golden Dataset is defined in detail in GEN-GOV-004 (Canonical Golden Dataset). This section describes HOW the Golden Dataset is used in the regression test suite.

### 2.2 Golden Dataset Components Per Generator

#### 2.2.1 schema-generator Golden Dataset

**Canonical inputs (frozen version):**
- DOC-021 v1.0 (Physical Data Model — version figée au moment du gel)
- DOC-023 v1.0 (Canonical Relational Rules — version figée)

**Expected outputs (frozen):**
- POSTGRESQL-SCHEMA-PACK-v1.md — SHA-256 hash attendu figé
- SQL-DDL-SPECIFICATION-v1.md — SHA-256 hash attendu figé

**Testable properties:**
- Nombre exact de tables: 32
- Colonnes par table: conforme à DOC-021 §X.Y
- Types de colonnes: conformes aux catégories de types DOC-021
- Présence de `_org_id` sur chaque table directe ou héritée
- Convention de nommage: pluriel snake_case uniforme
- Headers IGS-v1 présents sur chaque bloc DDL

#### 2.2.2 migration-generator Golden Dataset

**Canonical inputs (frozen):**
- PostgreSQL Schema Pack v1 (version figée, sortie schema-generator)
- DOC-022 v1.0 (PO → Physical Mapping Rules — version figée)

**Expected outputs (frozen):**
- MIGRATION-PACK-V1.md — SHA-256 hash attendu figé

**Testable properties:**
- Nombre exact de migrations: 35 (MIG-001 à MIG-035)
- Ordre topologique preservé (tables parentes avant tables enfants)
- organizations (MIG-001) est la premiere table creee
- IF NOT EXISTS sur chaque CREATE TABLE
- Rollback section sur chaque migration
- Headers IGS-v1 complets sur chaque migration
- Aucun ALTER TABLE sur table existante (sauf OBS-1 non-bloquant)

#### 2.2.3 constraint-index-generator Golden Dataset

**Canonical inputs (frozen):**
- Migration Pack v1 (version figée)
- DOC-023 v1.0 (Canonical Relational Rules §2-9 — version figée)
- DOC-015 v1.0 (Domain Invariant Registry — version figée)

**Expected outputs (frozen):**
- CONSTRAINTS-INDEX-SPECIFICATION-v1.md — SHA-256 hash attendu figé

**Testable properties:**
- 38+ CHECK constraints
- 10 UNIQUE constraints
- ~54 Foreign Key constraints
- ~50+ performance indexes (B-tree)
- 4 GIN indexes for JSONB columns
- Chaque contrainte trace vers DOC-015 IN-XXX ou DOC-023 §X
- Aucun index ne traverse plusieurs Aggregats
- NB-RR-008 respecte (exclusive immutable log pour AuditAggregate uniquement)

#### 2.2.4 rls-generator Golden Dataset

**Canonical inputs (frozen):**
- PostgreSQL Schema Pack v1 (version figée)
- DOC-023 §8 v1.0 (Multi-tenant physical isolation — version figée)
- IdentityAggregate roles de DOC-012 (version figée)

**Expected outputs (frozen):**
- RLS-POLICY-SPECIFICATION-V1.md — SHA-256 hash attendu figé
- BOOTSTRAP-MIGRATION-SPECIFICATION-V1.md — SHA-256 hash attendu figé

**Testable properties:**
- 9 rôles definis, tous NOSUPERUSER NOINHERIT LOGIN
- 32 tables couvertes par politiques RLS
- Nom uniforme `pol_{table}_{role_short}_{action}`
- Clause USING contient org_id filter sur TOUTES les politiques
- FORCE RLS uniquement sur audit_entries
- DROP POLICY IF EXISTS avant chaque CREATE POLICY
- 4 bootstrap scripts presentes

#### 2.2.5 api-contract-generator Golden Dataset

**Canonical inputs (frozen):**
- DOC-014 v1.0 (Commands + Events registry — version figée)
- DOC-013 v1.0 (Boundary specs — version figée)

**Expected outputs (frozen):**
- API Contract Specification — SHA-256 hash attendu figé

**Testable properties:**
- Chaque endpoint correspond à exactement 1 Command DOC-014
- Aucun endpoint n'expose un "Interdit" de DOC-013
- Mapping HTTP method cohérent (POST→Create, PUT→Update, DELETE→Delete, GET→Read)
- Format response uniforme: { data, version, sync_status }
- Headers requis defines: x-org-id, Authorization Bearer JWT

#### 2.2.6 service-generator Golden Dataset

**Canonical inputs (frozen):**
- API Contracts v1 (version figée)
- DOC-012 v1.0 (Domain Model — version figée)
- DOC-015 v1.0 (Invariants — version figée)

**Expected outputs (frozen):**
- Application Service Implementations — SHA-256 hash attendu figé

**Testable properties:**
- Chaque Command DOC-014 mappe à une methode de service
- Chaque invariant CRITIQUE de DOC-015 a un guard correspondant
- Aucun invariant DOC-015 violé par les services
- Domain Events émis après chaque changement d'état
- Audit logging systematique via AuditAggregate.LogAction()

#### 2.2.7 deployment-config-generator Golden Dataset

**Canonical inputs (frozen):**
- DOC-001 v1.0 (Runtime Services — version figée)
- DOC-008 v1.0 (Decision Constitution — version figée)
- ARA-v1 (version figée)

**Expected outputs (frozen):**
- Dockerfiles, docker-compose.yml, CI/CD configs — SHA-256 hash attendu figé

**Testable properties:**
- Chaque container listé dans DOC-001 Runtime Services
- Aucune dépendance non cataloguée introduite

#### 2.2.8 ui-generator Golden Dataset

**Canonical inputs (frozen):**
- DOC-012 FormAggregate (version figée)
- DOC-019 Vocabulary Strategy (version figée)
- API Contracts v1 (version figée)

**Expected outputs (frozen):**
- React Native Component Set — SHA-256 hash attendu figé

**Testable properties:**
- Zéro formulaire hardcoded JSX (BR-FRM-001)
- Toutes les listes référencent Vocabulary (BR-VOC-004)
- Labels FR/EN résolus depuis TranslationPair

#### 2.2.9 test-generator Golden Dataset

**Canonical inputs (frozen):**
- DOC-015 v1.0 (58 Invariants — version figée)
- DOC-012 v1.0 (70+ Business Rules — version figée)
- DOC-014 v1.0 (Commands + Events — version figée)

**Expected outputs (frozen):**
- Test Suite — SHA-256 hash attendu figé

**Testable properties:**
- Chaque invariant CRITIQUE a ≥1 test "violé" + ≥1 test "respecté"
- Chaque invariant MAJEUR a test d'intégration couvrant la guard function
- Chaque invariant MINEUR a test smoke
- Zéro test E2E généré automatiquement

### 2.3 Golden Dataset Update Policy

| Trigger | Action | Approval Required |
|---------|--------|------------------|
| Canonical document modified | Regenerate affected artifacts → compute new hashes → update Golden Dataset | Chief Platform Architect + ADR |
| Pipeline run produces different results for UNCHANGED sources | Investigate drift → fix root cause → re-validate → IF CORRECT, update Golden Dataset | Generator Auditor + Chief Platform Architect |
| New generator added | Run first full generation → validate all checks → freeze hashes → add to Golden Dataset | Full certification process |
| Annual review | Re-compute ALL hashes from current canonical documents | All generator auditors consent |

---

## 3. REGRESSION TEST CATEGORIES

### 3.1 Schema Diff Tests (SDT)

**Purpose:** Compare the generated schema structure against the expected schema structure from the Golden Dataset.

**What is tested:**

| Property | Test Name | Pass Condition | Fail Consequence |
|----------|-----------|---------------|-----------------|
| Table count | SDT-TABLE-COUNT | Generated tables == 32 | Structural deviation from DOC-021 |
| Table naming convention | SDT-TABLE-NAMING | All tables use plural_snake_case | Naming standard violated |
| Column count per table | SDT-COLUMN-COUNT | Each table column count matches DOC-021 | Missing or extra attributes |
| Column type mapping | SDT-COLUMN-TYPE | All column types match DOC-021 category mapping | Incorrect type categories |
| Primary key pattern | SDT-PK-PATTERN | All tables have uuid DEFAULT gen_random_uuid() PK | PK structure deviation |
| org_id presence | SDT-ORG-ID | All 32 tables have direct or inherited _org_id | Multi-tenant isolation violation |
| Standard persistence columns | SDT-STANDARD-COLS | version, synced_at, local_updated_at, conflict_strategy, is_deleted present | DOC-017 compliance violation |
| CHECK constraints | SDT-CHECK-CONSTRAINT | All CHECK constraints match expected count and targets | Invariant enforcement gap |
| UNIQUE constraints | SDT-UNIQUE-CONSTRAINT | All UNIQUE constraints match expected count and targets | Data integrity gap |
| Foreign key count | SDT-FK-COUNT | FK count matches expected range (~54) | Relationship coverage gap |
| Header IGS-v1 | SDT-HEADER | Every DDL block has complete IGS-v1 header | Metadata compliance violation |

**Threshold:** Zero failures allowed. ANY SDT failure is a BLOCKING regression.

### 3.2 Migration Order Tests (MOT)

**Purpose:** Verify that the topological ordering of migration scripts has not changed from the Golden Dataset baseline.

**What is tested:**

| Property | Test Name | Pass Condition | Fail Consequence |
|----------|-----------|---------------|-----------------|
| Migration count | MOT-MIGRATION-COUNT | Exactly 35 migrations (MIG-001 to MIG-035) | Missing or extra migrations |
| Sequential numbering | MOT-SEQUENTIAL-NUMBERS | No gaps in migration numbering | Ordering anomaly |
| Topological order preserved | MOT-TOPOLOGY | Parent tables created before child tables | FK dependency violation |
| First table creation | MOT-FIRST-TABLE | organizations (MIG-001) is the first table | Root anchor missing |
| IF NOT EXISTS pattern | MOT-IDEMPOTENT | All CREATE TABLE statements include IF NOT EXISTS | Non-idempotent migrations |
| Rollback sections | MOT-ROLLBACK | All 35 migrations have rollback sections | Irreversible changes risk |
| ALTER TABLE violation | MOT-NO-ALTER | Zero ALTER TABLE on previously created tables | Migration discipline violation |
| Header completeness | MOT-HEADERS | All 35 migrations have complete IGS headers | Traceability loss |

**Threshold:** Zero structural failures. Only non-blocking warnings allowed for known observations (OBS-MG-001, OBS-MG-002).

### 3.3 RLS Count Tests (RCT)

**Purpose:** Verify that the number of RLS policies, roles, and covered tables match the expected counts.

**What is tested:**

| Property | Test Name | Pass Condition | Fail Consequence |
|----------|-----------|---------------|-----------------|
| Role count | RCT-ROLE-COUNT | Exactly 9 roles defined | RBAC model deviation |
| Role attributes | RCT-ROLE-ATTRIBUTES | All roles NOSUPERUSER NOINHERIT LOGIN | Privilege escalation risk |
| Table coverage | RCT-TABLE-COVERAGE | All 32 tables covered by RLS policies | Multi-tenant isolation gap |
| Policy naming convention | RCT-POLICY-NAMING | All policies follow pol_table_role_action pattern | Convention violation |
| Org_id filter | RCT-ORGID-FILTER | All USING clauses contain org_id filter | Cross-org access risk |
| Force RLS scope | RCT-FORCE-RLS | FORCE ROW LEVEL SECURITY only on audit_entries | Performance/security balance |
| Superadmin bypass | RCT-SUPERADMIN | No SQL policy for superadmin; application-layer bypass documented | Security design violation |
| Idempotence | RCT-IDEMPOTENCE | DROP POLICY IF EXISTS before every CREATE POLICY | Re-run safety |
| Bootstrap scripts | RCT-BOOTSTRAP | 4 bootstrap scripts present (000-003) | Infrastructure setup incomplete |

**Threshold:** Zero security-related failures. Naming convention deviations are MINOR.

### 3.4 Traceability Tests (TT)

**Purpose:** Verify that every generated element traces back to at least one canonical document.

**What is tested:**

| Property | Test Name | Pass Condition | Fail Consequence |
|----------|-----------|---------------|-----------------|
| Artifact header metadata | TT-HEADER | All 7 IGS metadata fields present | Compliance metadata missing |
| Source_canonical field | TT-SOURCE | source_canonical lists correct canonical documents | Traceability link broken |
| artifact-to-document ratio | TT-RATIO | Every generated element has ≥1 source reference | Orphan element detected |
| Header consistency across artifacts | TT-CROSS-ARTIFACT | All artifacts in same generation share architecture_version | Version mismatch |
| Cross-reference validity | TT-CROSSREF | Every DOC-XXX reference resolves to actual content | False traceability claim |
| Boundary traceability | TT-BOUNDARY | Every API endpoint traces to an Aggregate boundary | Boundary leakage |
| Invariant traceability | TT-INVARIANT | Every constraint traces to a DOC-015 invariant | Invariant enforcement gap |

**Threshold:** Zero orphans permitted. Any untraceable element triggers V-TRACE failure.

### 3.5 NeverBreak Compliance Tests (NBCT)

**Purpose:** Ensure that no generated artifact violates any NeverBreak rule.

**NeverBreak rules tested:**

| Rule ID | Description | Tested By | What Is Verified |
|---------|-------------|-----------|-----------------|
| NB-PERSIST-001 | Persistence model follows DDD boundaries | schema-generator, constraint-index-generator | Tables don't cross Aggregate boundaries |
| NB-PERSIST-002 | Multi-tenant isolation through _org_id | schema-generator, rls-generator | All multi-tenant tables have org_id |
| NB-PERSIST-003 | Storage independence maintained | schema-generator, migration-generator | No storage-specific patterns in schema |
| NB-PERSIST-004 | Serialization patterns preserved | schema-generator | PO-to-storage mapping respects serialization rules |
| NB-PERSIST-005 | Events defined by Commands, not UI | ui-generator | UI doesn't define events |
| NB-PERSIST-006 | Immutable log exclusive to AuditAggregate | constraint-index-generator | Only audit_entries uses append-only pattern |
| NB-PERSIST-007 to NB-PERSIST-012 | Various persistence constraints | appropiate generators | Each tested by the generator whose output it affects |
| NB-RR-001 to NB-RR-008 | Relational rules | constraint-index-generator, rls-generator | FK relationships, naming, indexing rules respected |

**Threshold:** Zero violations permitted. ANY NB rule violation is a BLOCKING regression.

---

## 4. TEST EXECUTION PIPELINE

### 4.1 Trigger Conditions

Regression tests are triggered under these conditions:

| Trigger | Description | Scope |
|---------|-------------|-------|
| **Canonical document change** | Any DOC-000 to DOC-024, ARA-v1, or IGS-v1 is modified | Only affected generators run regression tests |
| **Full pipeline regeneration** | Complete pipeline re-run from Phase 0 | ALL generators run regression tests |
| **Manual request** | Explicit invocation by an authorized stakeholder | ALL generators run regression tests |
| **Periodic audit** | Scheduled periodic verification (annual minimum) | ALL generators run regression tests |
| **Drift detection** | Golden dataset hash comparison detects drift | Only the drifted generator runs regression tests |

### 4.2 Execution Sequence

Tests execute in the following sequence, mirroring the Master Pipeline phases:

```
Phase 0: Pre-flight Checks
  ├── Validate all required canonical documents are present and unchanged
  ├── Verify Golden Dataset is accessible
  └── Check test environment readiness

Phase 1: Schema Generation Tests (after schema-generator runs)
  ├── SDT: Schema Diff Tests
  ├── TT: Schema Traceability Tests
  └── NBCT: Schema NeverBreak Compliance Tests

Phase 2: Migration Generation Tests (after migration-generator runs)
  ├── MOT: Migration Order Tests
  ├── TT: Migration Traceability Tests
  └── NBCT: Migration NeverBreak Compliance Tests

Phase 3: Constraint Index Generation Tests (after constraint-index-generator runs)
  ├── TT: Constraint Traceability Tests (invariant-to-constraint mapping)
  └── NBCT: Constraint NeverBreak Compliance Tests

Phase 4: RLS Generation Tests (after rls-generator runs)
  ├── RCT: RLS Count Tests
  ├── TT: RLS Traceability Tests
  └── NBCT: RLS NeverBreak Compliance Tests

Phase 5: Automated Validation (Master Pipeline Phase 5)
  └── All 65 VRF checks re-run

Phase 6-7: TRR and IRR (Master Pipeline Phases 6-7)
  └── Post-remediation validation

Phase 8: API Contract Tests (after api-contract-generator runs)
  ├── TT: API Contract Traceability Tests
  └── NBCT: API Contract NeverBreak Compliance Tests

Phase 9: Service Generation Tests (after service-generator runs)
  ├── TT: Service Traceability Tests (method→command→entity→guard→invariant)
  └── NBCT: Service NeverBreak Compliance Tests

Phase 10A: Deployment Config Tests
  ├── TT: Deployment Traceability Tests (container→runtime service)
  └── NBCT: Deployment NeverBreak Compliance Tests

Phase 10B: UI Generation Tests
  ├── TT: UI Traceability Tests (screen→formDef→field→vocabulary)
  └── NBCT: UI NeverBreak Compliance Tests (BR-FRM-001, BR-VOC-004)

Phase 10C: Test Generation Tests
  ├── TT: Test Traceability Tests (test→invariant→aggregate→boundary)
  ├── Coverage threshold check (all CRITIQUE invariants covered)
  └── E2E generation prohibition check (must be zero)

Final Phase: Cross-Generator Consistency Tests
  ├── Schema-to-Migration column alignment
  ├── Migration-to-Constraint table coverage
  ├── Constraint-to-RLS table overlap
  ├── API-to-Service method alignment
  ├── Service-to-Test invariant coverage
  └── End-to-end pipeline coherence
```

### 4.3 Parallel Execution Rules

Within a single phase, INDIVIDUAL tests may execute in parallel. However, CROSS-PHASE execution must remain strictly sequential:

| Rule | Description |
|------|------------|
| No parallel phases | Phase N tests cannot start until Phase N-1 tests pass |
| Within-phase parallelism | Individual test cases within a phase MAY run in parallel |
| Cross-phase data | Phase N+1 tests MUST use artifacts produced by Phase N (never pre-computed artifacts) |

---

## 5. THRESHOLDS FOR PASS/FAIL

### 5.1 Overall Threshold Matrix

| Category | Pass Threshold | Fail Threshold | Action on Fail |
|----------|---------------|---------------|----------------|
| **SDT (Schema Diff)** | 0 failures | ≥1 failure | BLOCK regression test, revert schema, investigate root cause |
| **MOT (Migration Order)** | 0 structural failures | ≥1 structural failure | BLOCK regression test, check migration generator logic |
| **RCT (RLS Count)** | 0 security failures, ≤2 minor failures | ≥1 security failure | BLOCK regression test, security audit mandatory |
| **TT (Traceability)** | 0 orphan elements | ≥1 orphan element | BLOCK regression test, traceability gap investigation |
| **NBCT (NeverBreak)** | 0 violations | ≥1 violation | BLOCK regression test, NB rule violation investigation |
| **Cross-Generator Consistency** | 0 misalignments | ≥1 misalignment | BLOCK full pipeline, check inter-phase compatibility |

### 5.2 Severity-Based Acceptance Criteria

Not all test failures result in a BLOCKED pipeline. The severity classification determines the impact:

| Severity | SDT Result | MOT Result | RCT Result | TT Result | NBCT Result | Pipeline Impact |
|----------|-----------|-----------|-----------|----------|------------|----------------|
| **CRITICAL** | Fail | Fail | Security fail | Fail | Violation detected | NO-GO — entire pipeline blocked |
| **MAJOR** | Fail (2+) | Fail (ordering) | Fail (count -2) | Fail (traceability) | Violation (minor rule) | NO-GO with mitigation plan — manual review required |
| **MINOR** | Fail (format only) | Fail (naming only) | Fail (naming only) | Warning (info) | Observation logged | GO WITH RESERVES — continue with monitoring |
| **INFO** | Informational | Informational | Informational | Informational | Informational | GO — normal operation |

### 5.3 Known Exceptions

Some test expectations have approved exceptions documented in the Golden Dataset and the Certification Report:

| Exception | Document Reference | Scope | Status |
|-----------|-------------------|-------|--------|
| OBS-MG-001: Invalid LAG() in constraint | GCR-V1 §Migration Generator | MIG-001 chk_statut_archived_irreversible | Accepted — pre-deployment fix required |
| OBS-MG-002: ALTER TABLE ordering | GCR-V1 §Migration Generator | MIG-027 ALTER TABLE SET DEFAULT | Accepted — non-blocking if DEFAULT inline present |
| OBS-SG-002: gen_random_uuid() runtime | GCR-V1 §Schema Generator | Hash variance at PostgreSQL runtime | Accepted — hash is stable in spec files |
| OBS-CIG-001: 4 invariants not enforceable physically | GCR-V1 §Constraint Generator | Physical coverage ~78% | Accepted — enforcement is application-level |
| OBS-RG-001: Superadmin bypass app-layer | GCR-V1 §RLS Generator | No SQL policy for superadmin | Accepted — design decision, documented |

Approved exceptions DO NOT trigger test failures. They are logged but counted as PASS for the associated test criterion.

---

## 6. REGRESSION TEST AUTOMATION

### 6.1 Automation Requirements

While this specification does NOT define a specific CI/CD tool or scripting language, the following automation requirements MUST be met for the regression test suite to be considered operational:

| Requirement | Description | Must Be Capable Of |
|------------|-------------|-------------------|
| **Automated hash computation** | Compute SHA-256 of every generated artifact and compare to Golden Dataset | Run automatically after each generation |
| **Automated property extraction** | Extract structured properties (table counts, column counts, policy counts) from generated artifacts | Parse artifact metadata and content |
| **Automated traceability validation** | Verify every element has a source_canonical reference | Scan artifact headers and body references |
| **Automated NeverBreak checking** | Check artifacts against NB-PERSIST-XXX and NB-RR-XXX rules | Pattern-match forbidden constructs |
| **Automated regression reporting** | Produce a structured report of pass/fail results | Output results in machine-readable format |
| **Automated blocking gate integration** | Prevent Master Pipeline from advancing when regression fails | Return verdict to Master Pipeline orchestrator |

### 6.2 Automation Execution Timing

| When | Which Tests Run | Duration Expectation |
|------|----------------|---------------------|
| **Post-generation** | Tests for the just-completed generator phase only | Fast (per-generator tests) |
| **Post-pipeline** | ALL tests across ALL phases | Full suite |
| **Pre-deployment** | Golden Dataset hash comparison + NBCT critical checks | Critical subset |
| **Periodic (annual)** | Full suite + Golden Dataset re-validation | Full suite |

### 6.3 Integration Points

The regression test suite integrates with the broader governance framework at these points:

| Integration Point | Direction | Mechanism |
|------------------|-----------|-----------|
| Master Pipeline | Reads test verdicts as Phase advancement gates | Verdict document read by Phase N+1 verifier |
| Golden Dataset (GEN-GOV-004) | Reads expected hashes and structures | Hash comparison against stored baselines |
| Certification Report (GEN-GOV-005) | Writes regression results into certification status | Updated per-generator observations and verdicts |
| Governance Journal (GEN-GOV-001 §7) | Logs all test executions and results | Structured journal entries for every run |
| Generator Registry (GEN-GOV-002 §7) | Updates certification status based on test outcomes | Registry entries updated by auditor |

### 6.4 Escalation on Test Failure

When the regression test suite reports a FAIL verdict:

1. **Immediate**: The Master Pipeline blocks advancement. No further phases execute.
2. **Notification**: The relevant generator owner is notified of the failure.
3. **Diagnosis**: Root cause analysis — was the canonical document changed? Was the transformation rule buggy? Was the Golden Dataset outdated?
4. **Resolution path**:
   - If canonical doc changed → update Golden Dataset → re-run affected tests
   - If transformation rule buggy → fix rule → regenerate → re-run tests
   - If Golden Dataset outdated → verify new output against canonical docs → if correct, update dataset
5. **Certification update**: If the generator was previously CERTIFIED and now shows regressions, its certification status is downgraded to CERTIFIED WITH OBSERVATIONS pending investigation resolution.
6. **Regression prevention**: Once fixed, add the specific failure case as a new regression test to prevent recurrence.

---

## 7. TEST COVERAGE REQUIREMENTS

### 7.1 Minimum Coverage by Generator

| Generator | Min Test Categories Covered | Min Properties Tested | Coverage Percentage Target |
|-----------|---------------------------|---------------------|--------------------------|
| schema-generator | SDT, TT, NBCT | 11+ | 100% |
| migration-generator | MOT, TT, NBCT | 8+ | 100% |
| constraint-index-generator | TT, NBCT | 5+ | 100% |
| rls-generator | RCT, TT, NBCT | 9+ | 100% |
| api-contract-generator | TT, NBCT | 5+ | 100% |
| service-generator | TT, NBCT | 5+ | 100% |
| deployment-config-generator | TT, NBCT | 2+ | 100% |
| ui-generator | TT, NBCT | 3+ | 100% |
| test-generator | TT, Coverage check | 4+ | 100% |

### 7.2 Cross-Phase Coverage

In addition to per-generator tests, the following cross-phase consistency tests are mandatory:

| Test | Compares | Expected Result |
|------|----------|----------------|
| SCHEMA-TO-MIGRATION | Table count in Schema Pack vs Migration Pack | 32 = 32 tables (35 migrations for 32 tables due to indexes/functions) |
| MIGRATION-TO-CONSTRAINT | Tables created in Migration Pack vs tables covered by constraints | All 32 tables have constraint coverage |
| CONSTRAINT-TO-RLS | Tables with constraints vs tables with RLS policies | All 32 tables have RLS coverage |
| API-TO-SERVICE | API endpoints defined vs service methods implemented | 1:1 command-to-method mapping |
| SERVICE-TO-TEST | Service methods/invariants vs test cases covering them | All CRITIQUE invariants have ≥1 test |

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Statut |
|---------|------|--------|-------------|--------|
| 1.0 | 2026-07-26 | Agnes-2.0-Flash (Sapiens AI) | Creation — Specification suite regression generateurs | ACTIVE |

---

*Ce document est une specification de gouvernance abstraite. Il definit UNIQUEMENT ce qui doit etre teste, les thresholds de passage, et la philosophie de regression. Il ne definitive AUCUNE implementation concrete de tests. Ce document ne fait pas partie de la serie DOC-000 a DOC-024.*
