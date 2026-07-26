# GEN-GOV-002 — Generator SDK Specification

**Doc ID:** GEN-GOV-002  
**Version:** 1.0  
**Statut:** SPECIFICATION INTERFACE SDK GENERATEURS FIGEE  
**Date:** 2026-07-26  
**Auteur:** Agnes-2.0-Flash (Sapiens AI) — Agent Generator Governance  
**Source canonique :** IGS-v1 §3, MASTER-PIPELINE-SPECIFICATION.md §Phases, IGSC-V1 §Sections A-G, GENERATOR-DEPENDENCY-MATRIX.md  
**Application:** Interface abstraite d'un SDK de générateur — les contrats fonctionnels que tout outil de génération doit respecter  

---

## 1. GENERATOR SDK INTERFACE

### 1.1 Purpose

The Generator SDK defines a standardized abstract interface that ANY tool, script, agent, or process must implement to act as an IGS-v1 generator. This specification does NOT describe a concrete software library. It describes the CONTRACT between a generator and the Master Pipeline orchestrator. Any implementation — whether Python, TypeScript, shell, manual document transformation, or AI-assisted generation — MUST conform to this interface.

### 1.2 Core Interface Methods

Every generator SDK implementation MUST expose the following four methods. These are the only methods defined by the SDK contract. Additional helper functions are permitted but must not be called by the Master Pipeline directly.

#### Method: `generate(sourceDocuments, outputSpec)`

Launches a generation run using canonical source documents and produces technical artifacts.

| Parameter | Type | Description | Constraint |
|-----------|------|-------------|------------|
| `sourceDocuments` | Object Map\<string, DocumentRef\> | Mapping of required canonical documents to their references | Keys MUST match exactly the generator's authorized input list from GENERATOR-DEPENDENCY-MATRIX.md |
| `outputSpec` | OutputSpecification | Configuration describing where and how to write output artifacts | Output directory MUST be writable |

**Return value:**

```
GenerateResult {
    artifacts: Artifact[]        // List of produced artifact objects
    metadata: GenerationMetadata // IGS-v1 headers for each artifact
    validations: ValidationReport[] // Results of V-STRUCT through V-INVENT
    observations: Observation[]  // Non-blocking issues logged during generation
}
```

**Behavioral requirements:**

1. Read ONLY the documents listed in `sourceDocuments`. Reading any other document is a constitution violation (RG-002).
2. Produce ONLY artifacts defined in `outputSpec`. Producing unlisted artifacts is a constitution violation (RG-003).
3. Apply deterministic transformation rules (D-001 through D-005). No randomness, no implicit state.
4. Embed IGS-v1 metadata headers in every artifact (RG-005).
5. Run all six validation steps (V-STRUCT → V-COHERE → V-TRACE → V-NB → V-REGRESS → V-INVENT). If ANY validation blocks, the generation MUST fail with the specific validation that failed.
6. Return observations for any non-blocking issues detected during generation.
7. Signal rejection criteria R-001 through R-008 when applicable (IGS-v1 §7).

**Error conditions:**

| Error Code | Condition | Generator Action |
|-----------|-----------|-----------------|
| `ERR_INPUT_MISSING` | A required document from `sourceDocuments` is absent or unreadable | Reject per R-001, return error |
| `ERR_INPUT_CORRUPT` | A required document exists but cannot be parsed/validated | Reject per R-001, return error with corruption details |
| `ERR_DEPENDENCY_MISSING` | A prior phase artifact needed as input is incomplete | Reject per R-002, return error with missing dependency |
| `ERR_AMBIGUITY` | Contradiction detected between source documents | Reject per R-004, return error with contradiction details |
| `ERR_INVENTION` | Generated content traces to uncataloged concept | Reject per R-003, return error with invented element |
| `ERR_NEBREAK` | Generated artifact violates a NeverBreak rule | Reject per R-006, return error with violated rule |
| `ERR_SEQUENTIAL` | Phase N+1 attempted without Phase N completion | Reject per R-007, return error |
| `ERR_UNTRACEABLE` | Artifact element has no canonical source reference | Reject per R-008, return error with orphan element details |

#### Method: `verify(artifacts)`

Validates generated artifacts against the expected specification.

| Parameter | Type | Description | Constraint |
|-----------|------|-------------|------------|
| `artifacts` | Artifact[] | Array of artifact objects to verify | Each artifact must have completed `generate()` successfully |

**Return value:**

```
VerificationResult {
    passed: boolean                    // True if ALL validations pass
    validations: ValidationResult[]    // Per-validation results
    blocks: RejectionCriterion[]       // Any rejected rejection criteria R-XXX
    observations: Observation[]        // Non-blocking observations found
}
```

**Validation checklist implemented by `verify`:**

1. **V-STRUCT**: Syntax and format check — artifact structure conforms to its type template
2. **V-COHERE**: Logical relation check — FK relationships, ordering, cardinalities are valid
3. **V-TRACE**: Traceability check — every element traces to ≥1 canonical document
4. **V-NB**: NeverBreak check — zero business rule inventions, zero new concepts, zero boundary changes
5. **V-REGRESS**: Regression check — compare SHA-256 against golden dataset; flag drift
6. **V-INVENT**: Non-invention check — scan for uncataloged concepts, capabilities, aggregates, business rules

Each validation returns: `{ step, result: PASS|FAIL, details: string[], artifactsAffected: string[] }`.

#### Method: `hash(artifacts)`

Computes the SHA-256 fingerprint for one or more artifacts.

| Parameter | Type | Description | Constraint |
|-----------|------|-------------|------------|
| `artifacts` | Artifact \| Artifact[] | Single artifact or array of artifacts to hash | Artifacts must be complete (generated, not draft) |

**Return value:**

```
HashResult {
    artifacts: HashEntry[]
}

HashEntry {
    artifactPath: string     // File path or identifier
    sha256: string           // SHA-256 hex digest of artifact content
    sizeBytes: number        // Size in bytes
    lineCount: number        // Number of lines for text-based artifacts
    headerPresent: boolean   // Whether IGS-v1 metadata header is present
    headerCompliant: boolean // Whether IGS-v1 metadata has all 7 required fields
}
```

**Behavioral requirements:**

- Hash computation uses the COMPLETE artifact content, including IGS-v1 metadata headers.
- For multi-artifact calls, hashing is performed independently per artifact (no combined hash).
- Hash results are deterministic: same content always produces same hash (D-001).

#### Method: `compare(hashOld, hashNew)`

Detects drift between two artifact versions by comparing their hashes.

| Parameter | Type | Description | Constraint |
|-----------|------|-------------|------------|
| `hashOld` | HashEntry \| HashEntry[] | Previous version hash(es) | Must be from a previously verified generation |
| `hashNew` | HashEntry \| HashEntry[] | New version hash(es) | Must correspond to same artifact(s) as hashOld |

**Return value:**

```
DriftResult {
    overallVerdict: DRIFT_DETECTED | DRIFT_CLEAN | ARTIFACT_NOT_FOUND
    entries: DriftEntry[]
    canonicalSourceChangeDetected: boolean
}

DriftEntry {
    artifactPath: string
    hashMatch: boolean         // True if SHA-256 values are identical
    driftLevel: NONE | FORMAT_ONLY | STRUCTURAL | SEMANTIC
    explanation: string        // Human-readable drift description
}
```

**Drift level classification:**

| Level | Definition | Acceptable? |
|-------|-----------|-------------|
| `NONE` | Identical hash | Always acceptable |
| `FORMAT_ONLY` | Content identical, whitespace/timestamp changed | Acceptable (non-significant) |
| `STRUCTURAL` | Different tables/columns/constraints but still traceable | Requires re-validation |
| `SEMANTIC` | Business logic change or new concept detected | BLOCKING — root cause investigation required |

### 1.3 Invocation Order

The Master Pipeline invokes these methods in a strict sequence per generation run:

```
1. generate(sourceDocuments, outputSpec)    → produce artifacts
2. verify(artifacts)                        → validate artifacts
3. hash(artifacts)                          → fingerprint artifacts
4. compare(hashFromGoldenDataset, hashNew) → detect drift vs baseline
5. report(results)                          → output execution log
```

Steps 2-5 MAY be repeated for each phase until all validations pass and the verdict is GO.

---

## 2. INPUT SPECIFICATION FORMAT

### 2.1 Canonical Document Reference Format

Every generator's input consists of one or more canonical documents, each referenced using a structured reference format:

```
DocumentReference {
    docId: string          // e.g., "DOC-021", "ARA-v1", "IGS-v1"
    section: string        // Optional: e.g., "§3.1", "§8", "Table 5"
    version: string        // Always "v1.0" for current canonical set
    integrity: HashEntry   // SHA-256 of the document file (for corruption detection)
}
```

**Example input maps per generator:**

| Generator | Input Map |
|-----------|-----------|
| schema-generator | `{ "DOC-021": ref, "DOC-023": ref }` |
| migration-generator | `{ "schema-pack": ref, "DOC-022": ref }` |
| constraint-index-generator | `{ "migration-pack": ref, "DOC-023": ref, "DOC-015": ref }` |
| rls-generator | `{ "schema-pack": ref, "DOC-023": ref, "DOC-012": ref }` |
| api-contract-generator | `{ "DOC-014": ref, "DOC-013": ref }` |
| service-generator | `{ "api-contracts": ref, "DOC-012": ref, "DOC-015": ref }` |
| deployment-config-generator | `{ "DOC-001": ref, "DOC-008": ref, "ARA-v1": ref }` |
| ui-generator | `{ "DOC-012": ref, "DOC-019": ref, "api-contracts": ref }` |
| test-generator | `{ "DOC-015": ref, "DOC-012": ref, "DOC-014": ref }` |

### 2.2 Metadata Headers Required in Source Documents

Every canonical document input MUST include verifiable metadata at its top:

| Field | Required | Example Value |
|-------|----------|---------------|
| `docId` | Yes | `DOC-021` |
| `version` | Yes | `v1.0` |
| `status` | Yes | `SPecIFICATION CANONIQUE FIGEE` |
| `date` | Yes | `2026-07-24` |
| `sha256` | Yes | `a1b2c3d4...` |
| `parentCanonicals` | Optional | `["DOC-017", "DOC-018"]` |

A document missing any required metadata field triggers rejection criterion R-001 (input not canonical).

### 2.3 Cross-Reference Validation

Before any generation begins, the SDK MUST validate cross-references between input documents:

1. Every `DOC-XXX§Y.Z` reference in a source document resolves to a real section in the referenced document.
2. No circular dependencies exist among input documents (excluding the pipeline DAG which is linear).
3. All section numbers, table references, and figure numbers cited in inputs exist in their respective documents.

Cross-reference failures produce a `PreFlightFailure` result that blocks `generate()` invocation.

### 2.4 Version Compatibility Check

Each input document's version must match the expected canonical version (`v1.0`). If any input document reports a different version, the SDK MUST:

1. Log a version mismatch warning.
2. Evaluate whether the version difference is compatible (major version match).
3. Block generation if major version differs.
4. Allow generation with observation if minor version differs and compatibility assessment passes.

---

## 3. OUTPUT SPECIFICATION FORMAT

### 3.1 Artifact Structure Template

Every generated artifact MUST conform to a standardized structure:

```
[IGS-v1 Metadata Header]
# ================================================================
# generation_id:     <SHA-256 hash of content before this header>
# source_canonical:  <list of canonical doc references>
# transformation_rule: <generator-name v1.0>
# generation_date:   <ISO 8601 timestamp>
# architecture_version: v1.0 (DOC-000 to DOC-024 + ARA-v1 + IGS-v1)
# validation_hash:   <SHA-256 of entire artifact file>
# compliance_status: COMPLIANT | VIOLATION | BLOCKED
# ================================================================

[Artifact Body]
<Content produced by the generator, organized by its output specification>
```

### 3.2 Artifact Body by Type

Different artifact types have different structural templates:

#### Schema Artifact (Phase 1)

```
SchemaBody {
    tables: TableDefinition[]    // One entry per Physical Object
    tableNamingConvention: string // e.g., "plural_snake_case"
    foreignKeys: ForeignKeyDef[] // Table-to-table reference definitions
    constraints: ConstraintDef[] // CHECK, UNIQUE, NOT NULL specifications
    columns: StandardColumns[]   // Persisted columns from DOC-017
    orgIsolation: OrgIsolationPolicy // Direct or inherited per table
}
```

#### Migration Artifact (Phase 2)

```
MigrationBody {
    migrations: MigrationScript[] // Ordered CREATE TABLE scripts
    topologicalOrder: string[]    // Table creation order
    rollbackAvailable: boolean    // Every migration has reverse script
    idempotent: boolean           // IF NOT EXISTS pattern used
    headerCount: number           // Must equal migration count
}
```

#### Constraints Artifact (Phase 3)

```
ConstraintsBody {
    checkConstraints: ConstraintDef[]   // Mapped to DOC-015 invariants
    uniqueConstraints: ConstraintDef[]  // Mapped to DOC-023 relational rules
    foreignKeyConstraints: FKDef[]      // Mapped to DOC-023 relationships
    indexes: IndexDef[]                 // Performance indexes
    ginIndexes: IndexDef[]              // JSONB-specific GIN indexes
    physicalCoverage: CoverageReport   // % of invariants enforceable physically
}
```

#### RLS Policy Artifact (Phase 4)

```
RlsBody {
    roles: RoleDefinition[]    // 9 RBAC roles with attributes
    policies: PolicyDefinition[] // Per-table per-role USING clauses
    bootstrapScripts: Script[]  // Extension, schema, role init, verification
    namingConvention: string    // pol_{table}_{role_short}_{action}
    forceRlsTables: string[]    // Tables with FORCE ROW LEVEL SECURITY
    superadminBypassMethod: string // Application-layer bypass mechanism
}
```

#### API Contract Artifact (Phase 5)

```
ApiContractBody {
    endpoints: EndpointDef[]    // REST endpoint definitions
    requestTypes: TypeDef[]     // HTTP request body type definitions
    responseTypes: TypeDef[]    // HTTP response body type definitions
    errorCodes: ErrorCodeDef[]  // Standardized error codes
    requiredHeaders: HeaderDef[] // x-org-id, Authorization
    commandMapping: CommandMap  // Endpoint → Command DOC-014 mapping
    boundaryMapping: BoundaryMap // Endpoint → Aggregate boundary Expose mapping
}
```

#### Service Artifact (Phase 6)

```
ServiceBody {
    serviceMethods: ServiceMethod[] // Command → method mappings
    guardFunctions: GuardDef[]      // Invariant checks before writes
    domainEvents: DomainEventDef[]  // Events emitted after state changes
    auditLogging: AuditConfigDef    // Systematic audit configuration
    optimisticLocking: LockConfig   // _persist_version enforcement
}
```

#### Deployment Artifact (Phase 7)

```
DeploymentBody {
    dockerfiles: DockerfileDef[]    // Container build definitions
    dockerCompose: ComposeService[] // Runtime service orchestration
    ciPipelines: PipelineDef[]      // CI/CD configuration
    environmentVars: EnvVarDef[]    // Configured environment variables
    runtimeServiceMatches: boolean  // All containers in DOC-001 Runtime Services
}
```

#### UI Artifact (Phase 8)

```
UiBody {
    formComponents: FormComponentDef[] // Dynamic components from FormDefinitions
    vocabularyConsumers: VocabularyConsumerDef[] // Select options from Vocabulary
    translationPairs: TranslationPairDef[] // FR/EN label resolution
    hardcodedForms: number             // MUST BE ZERO
    hardcodedVocabulary: number        // MUST BE ZERO
}
```

#### Test Artifact (Phase 9)

```
TestBody {
    unitTests: TestCaseDef[]          // Per-inv VARIANT tests
    integrationTests: TestCaseDef[]   // Per-invariant MAJEUR coverage
    smokeTests: TestCaseDef[]         // Per-invariant MINEUR regression
    e2eTestsGenerated: number         // MUST BE ZERO
    invariantCoverage: CoverageReport  // % of invariants covered
}
```

### 3.3 Artifact Metadata Completeness Check

After generation, `verify()` MUST check that every artifact has:

1. Complete IGS-v1 header block (all 7 fields present)
2. Correct `source_canonical` matching the generator's authorized inputs
3. Correct `transformation_rule` matching the generator name and version
4. Valid ISO 8601 `generation_date`
5. Architecture version `v1.0`
6. `compliance_status` that matches the actual validation results
7. `validation_hash` that matches the computed SHA-256 of the artifact content

Any missing or incorrect metadata field causes a MINOR violation of V-STRUCT.

---

## 4. ERROR HANDLING

### 4.1 Error Classification

The SDK classifies all errors into three categories:

#### Blockers (Critical Errors Preventing Generation)

Blockers HALT generation immediately. The `generate()` call returns failure with the specific blocker reason. The Master Pipeline treats blockers as NO-GO verdicts.

| Blocker Type | Cause | R-Criterion | Recovery |
|-------------|-------|-------------|----------|
| Missing input | Required canonical document not found | R-001 | Supply missing document from canonical set |
| Corrupt input | Document exists but content is corrupted/unreadable | R-001 | Restore document from verified backup |
| Missing dependency | Prior phase artifact incomplete or missing | R-002 | Complete prior phase first |
| Invented business rule | Generated artifact contains non-cataloged rule | R-003 | Remove invented rule, re-generate |
| Ambiguous input | Two canonical documents contradict on the same point | R-004 | Resolve contradiction via ADR |
| Contradictory input | DOC-000 and DOC-024 disagree fundamentally | R-005 | Resolve contradiction via ADR |
| NeverBreak violation | Artifact violates NB-PERSIST-XXX or NB-RR-XXX | R-006 | Remove violating element, re-generate |
| Sequential skip | Phase N+1 attempted before Phase N completes | R-007 | Execute missing phases first |
| Untraceable element | Artifact contains element without canonical source | R-008 | Remove orphan element, re-generate |

#### Warnings (Non-Blocking Issues)

Warnings DO NOT halt generation. They are recorded in the `observations` field of the `GenerateResult`. The Master Pipeline may proceed with a GO WITH RESERVES verdict.

| Warning Type | Cause | Example |
|-------------|-------|---------|
| Naming convention deviation | Output uses non-standard naming | Table named `User` instead of `users` |
| Informational observation | Architectural note, not a defect | 10 tables inherit org_id via FK |
| Application-level enforcement needed | Invariant cannot be enforced physically | DAG cycle detection requires app code |
| Bootstrap script redundancy | ALTER TABLE SET DEFAULT before CREATE TABLE | MIG-027 ordering observation |

#### Validation Failures

Validation failures occur during the `verify()` phase and indicate that generated artifacts do not meet quality standards. Each validation step may independently FAIL:

| Validation | Failure Mode | Impact |
|-----------|-------------|--------|
| V-STRUCT | Artifact format invalid | BLOCKS advancement |
| V-COHERE | Logical relation invalid | BLOCKS advancement |
| V-TRACE | Orphan element found | BLOCKS advancement |
| V-NB | NeverBreak rule violated | BLOCKS advancement |
| V-REGRESS | Drift detected vs golden dataset | BLOCKS advancement |
| V-INVENT | Invented element detected | BLOCKS advancement |

### 4.2 Error Response Format

All errors MUST be returned using a standardized response:

```
ErrorResponse {
    errorType: "BLOCKER" | "WARNING" | "VALIDATION_FAILURE"
    code: string              // e.g., "R-001", "V-COHERE", "OBS-MG-001"
    severity: "CRITICAL" | "MAJOR" | "MEDIUM" | "LOW" | "INFO"
    message: string           // Human-readable error description
    affectedArtifacts: string[] // Artifact paths affected
    sourceDocument: string    // Which canonical document contributed to the error
    sourceSection: string     // Specific section reference
    recommendedAction: string // What to do to resolve
}
```

### 4.3 Error Propagation Through Pipeline

Errors propagate upward through the pipeline according to these rules:

| Error Origin | Upstream Impact | Downstream Impact |
|-------------|----------------|------------------|
| Phase 1 error | Pipeline blocked at Phase 1 | Phases 2-10 not started |
| Phase 2 error | Pipeline blocked at Phase 2 | Phases 3-10 not started |
| Phase 3 error | Pipeline blocked at Phase 3 | Phases 4-10 not started |
| Phase 4 error | Pipeline blocked at Phase 4 | Phases 5-10 not started |
| Phase 5 (validation) | Pipeline blocked at Phase 5 | Phases 6-10 not started |
| Phase 8 error | Pipeline blocked at Phase 8 | Phases 9-10 not started |
| Phase 9 error | Pipeline blocked at Phase 9 | Phase 10 not started |
| Phase 10 error | Pipeline blocked at Phase 10 | Terminal — full pipeline incomplete |

No downstream artifact is generated until the upstream blocker is resolved.

---

## 5. VERSIONING OF THE GENERATOR SDK

### 5.1 Version Numbering Scheme

The Generator SDK follows semantic versioning (SemVer): `MAJOR.MINOR.PATCH`.

| Component | Meaning | Examples of Changes |
|-----------|---------|-------------------|
| **MAJOR** | Breaking change to the SDK interface | Addition/removal of required interface methods, change to artifact structure format, modification of rejection criteria |
| **MINOR** | New functionality, non-breaking | Addition of optional methods, new validation types, extended metadata fields |
| **PATCH** | Bug fixes only | Correction of false-positive detection, hash computation fix, error message improvement |

### 5.2 Major Version Changes

Major version increments MAY include:

- Adding a new mandatory interface method to the core SDK contract
- Changing the required fields in artifact headers
- Modifying the list of rejection criteria (R-001 through R-008)
- Adding new NeverBreak rules that affect generation
- Restructuring the canonical document set (adding/removing DOC-XXX)

When a major version change occurs:

1. All existing generators must be updated to the new interface before the new version can be activated.
2. The previous major version remains available during a transition period (minimum 2 full pipeline runs).
3. All certifications must be re-run under the new version.
4. An ADR documenting the breaking change MUST be created.

### 5.3 Minor Version Changes

Minor version increments MAY include:

- Adding new optional validation types
- Extending metadata header fields
- Adding new observation categories
- Supporting additional artifact output formats
- Adding pre-flight validation hooks

Minor version changes DO NOT require generator recertification. Existing generators continue to function correctly.

### 5.4 Patch Version Changes

Patch version increments are limited to:

- Fixing incorrect hash computations
- Correcting false-positive validation detections
- Improving error messages
- Fixing metadata parsing bugs

Patch version changes DO NOT change the interface and DO NOT require any recertification.

### 5.5 Version Lifecycle

| Stage | Description | SDK Version Scope |
|-------|------------|------------------|
| **Development** | Interface being refined, not yet locked | Pre-release versions (e.g., 0.1.0-draft) |
| **Stable** | Interface frozen, certified generators | 1.x.x |
| **Deprecated** | Old version still functional but discouraged | Marked with deprecation notice |
| **Retired** | No longer supported, cannot be used | Removed from documentation |

Only ONE stable SDK version may exist at any time. Retired versions lose their certification status upon retirement.

---

## 6. COMPATIBILITY MATRIX

### 6.1 SDK Version to Canonical Document Version Compatibility

This matrix defines which SDK versions support which canonical document versions.

| SDK Version | Supported Canonical Doc Version | Status | Notes |
|------------|-------------------------------|--------|-------|
| 1.0.x | v1.0 (DOC-000 to DOC-024, ARA-v1, IGS-v1) | ACTIVE | Current production version |
| 0.9.x | v1.0 (pre-stable, with known limitations) | DEPRECATED | Do not use for production generation |

### 6.2 Generator to SDK Version Compatibility

Each generator is certified against a specific SDK version:

| Generator | Certified SDK Version | Min SDK Version | Max SDK Version |
|-----------|---------------------|-----------------|-----------------|
| schema-generator | 1.0 | 1.0.0 | 1.x.x |
| migration-generator | 1.0 | 1.0.0 | 1.x.x |
| constraint-index-generator | 1.0 | 1.0.0 | 1.x.x |
| rls-generator | 1.0 | 1.0.0 | 1.x.x |
| api-contract-generator | 1.0 | 1.0.0 | 1.x.x |
| service-generator | 1.0 | 1.0.0 | 1.x.x |
| deployment-config-generator | 1.0 | 1.0.0 | 1.x.x |
| ui-generator | 1.0 | 1.0.0 | 1.x.x |
| test-generator | 1.0 | 1.0.0 | 1.x.x |

All nine generators are currently certified against SDK version 1.0. When a new SDK version is released, compatibility must be verified for each generator individually.

### 6.3 Cross-SDK Compatibility Rules

When multiple SDK versions are deployed simultaneously (during transitions):

1. Each generator runs against its CERTIFIED SDK version only.
2. The Master Pipeline routes requests to the appropriate SDK version per generator.
3. Artifacts produced by different SDK versions include their SDK version in metadata.
4. A mixed-version run is ALLOWED during transition windows but DISCOURAGED for final production deliveries.
5. At least one full pipeline run must be completed on the target SDK version before the old version is retired.

---

## 7. GENERATOR REGISTRY

### 7.1 Registry Purpose

The Generator Registry is a centralized inventory of all registered generators, their current certification status, and their SDK version bindings. It is maintained by the Master Pipeline orchestrator.

### 7.2 Registry Entry Structure

```
GeneratorRegistryEntry {
    generatorName: string            // e.g., "schema-generator"
    iGSReference: string            // e.g., "IGS-v1 §3.1"
    sdkVersion: string              // e.g., "1.0.2"
    certificationStatus: string     // "CERTIFIED" | "CERTIFIED_WITH_OBSERVATIONS" | "NOT_CERTIFIED"
    lastCertified: string           // ISO 8601 date of last certification
    inputDocuments: string[]        // Authorized input document IDs
    outputArtifacts: string[]       // Authorized output artifact identifiers
    phaseNumber: number             // Master Pipeline phase number
    dependencyGraph: Edge[]         // Adjacency list of generator dependencies
    currentObservations: Observation[] // Active OBS-XXX entries
    lastRunId: string               // Last pipeline execution run ID
    lastRunVerdict: string          // Verdict from last execution
}
```

### 7.3 Registry Operations

| Operation | Description | Authorization |
|-----------|-------------|--------------|
| REGISTER | Add a new generator to the registry | Chief Platform Architect only |
| UNREGISTER | Remove a generator (must be replaced before pipeline can continue) | Chief Platform Architect + ADR |
| UPDATE_STATUS | Change certification status | Generator Auditor |
| QUERY | Retrieve generator information | Any authorized stakeholder |
| AUDIT | Full registry consistency check | Automated, periodic |

### 7.4 Registry Consistency Rules

1. Every generator active in the Master Pipeline MUST have a registry entry.
2. Every registry entry MUST have a valid certification status.
3. If a generator is marked NOT_CERTIFIED, it MUST NOT appear in any active pipeline execution.
4. Registry entries are immutable except for status updates and observation changes. To change a generator's identity (name, inputs, outputs), unregister and re-register.

---

## 8. EXTENSIBILITY

### 8.1 Adding New Generators

New generators MAY be added to the pipeline via the following process:

1. **Proposal**: Define the new generator's inputs, outputs, transformation rules, and placement in the pipeline sequence.
2. **ADR**: Create an Architectural Decision Record documenting the rationale, impact analysis, and compatibility assessment.
3. **Specification**: Write the generator's specification section matching the format of IGS-v1 §3.x.
4. **Dependency Update**: Update GENERATOR-DEPENDENCY-MATRIX.md with the new node in the DAG.
5. **Master Pipeline Update**: Add the corresponding phase to MASTER-PIPELINE-SPECIFICATION.md.
6. **Registration**: Register the generator in the Generator Registry.
7. **Certification**: Run the full certification process (six criteria).
8. **Validation**: Execute at least one full pipeline run including the new generator.

### 8.2 Removing Generators

A generator MAY be removed only if:

1. An ADR approves the removal.
2. No downstream generator depends on its output.
3. An equivalent capability is provided by another generator or by a future replacement generator.
4. All artifacts produced by the generator are archived before removal.

### 8.3 Third-Party Integration

The SDK interface defines a public contract that third-party tools may implement. Third-party implementations MUST:

1. Pass all six certification criteria.
2. Register in the Generator Registry.
3. Be reviewed by the Chief Platform Architect before pipeline inclusion.
4. Not introduce non-deterministic behavior (enforced by D-001 through D-005).

---

## 9. SDK USAGE EXAMPLES (SPECIFICATION LEVEL)

### 9.1 Schema Generator Invocation Pattern

```
Input:
  sourceDocuments = {
    "DOC-021": { docId: "DOC-021", section: "all", version: "v1.0", integrity: sha256(DOC-021-file) },
    "DOC-023": { docId: "DOC-023", section: "all", version: "v1.0", integrity: sha256(DOC-023-file) }
  }
  outputSpec = {
    directory: "artifacts/schema/",
    format: "markdown-with-sql",
    namingConvention: "plural_snake_case",
    includeHeaders: true
  }

Expected Output:
  GenerateResult {
    artifacts: [
      { path: "POSTGRESQL-SCHEMA-PACK-v1.md", header: { ... }, validations: { V-STRUCT: PASS, V-COHERE: PASS, ... }},
      { path: "SQL-DDL-SPECIFICATION-v1.md", header: { ... }, validations: { V-STRUCT: PASS, V-COHERE: PASS, ... }}
    ],
    metadata: [GenerationMetadata for each artifact],
    validations: [
      { step: "V-STRUCT", result: PASS, details: ["32 CREATE TABLE statements validated"] },
      { step: "V-COHERE", result: PASS, details: ["All FK relationships valid", "Topological order preserved"] },
      { step: "V-TRACE", result: PASS, details: ["All 32 tables traced to DOC-021"] },
      { step: "V-NB", result: PASS, details: ["No NeverBreak violations"] },
      { step: "V-REGRESS", result: PASS, details: ["No drift vs golden dataset"] },
      { step: "V-INVENT", result: PASS, details: ["No invented elements"] }
    ],
    observations: [
      { id: "OBS-SG-001", severity: "LOW", message: "Naming convention follows best practice" }
    ]
  }
```

### 9.2 Verification Invocation Pattern

```
Input:
  artifacts = [
    { path: "POSTGRESQL-SCHEMA-PACK-v1.md", content: "<full file content>" },
    { path: "MIGRATION-PACK-V1.md", content: "<full file content>" }
  ]

Expected Output:
  VerificationResult {
    passed: true,
    validations: [
      { step: "V-STRUCT", result: PASS, details: [...] },
      { step: "V-COHERE", result: PASS, details: [...] },
      { step: "V-TRACE", result: PASS, details: [...] },
      { step: "V-NB", result: PASS, details: [...] },
      { step: "V-REGRESS", result: PASS, details: [...] },
      { step: "V-INVENT", result: PASS, details: [...] }
    ],
    blocks: [],
    observations: []
  }
```

---

## 10. FUTURE EVOLUTION

### 10.1 Interface Stability Guarantee

The four core methods (`generate`, `verify`, `hash`, `compare`) are GUARANTEED to remain stable across all SDK 1.x versions. Only `generate`'s internal behavior may be refined (bug fixes, new validations) without changing its signature.

### 10.2 Extension Points

The following are extension points that MAY change in minor versions without breaking compatibility:

- Additional metadata header fields
- New optional parameters to `outputSpec`
- New observation categories
- New pre-flight and post-flight hooks

### 10.3 Deprecation Policy

When a feature is deprecated:

1. A deprecation notice appears in the SDK changelog.
2. The deprecated feature continues to function for a minimum of 2 minor versions.
3. Warnings are emitted during generation runs using deprecated features.
4. After the grace period, the feature is removed in the next major version.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Statut |
|---------|------|--------|-------------|--------|
| 1.0 | 2026-07-26 | Agnes-2.0-Flash (Sapiens AI) | Creation — Specification interface SDK generateur | ACTIVE |

---

*Ce document est une specification de gouvernance abstrait. Il ne definit AUCUNE implmentation concrete. Toute implmentation d'un SDK de generateur pour Lumina v2 DOIT respecter cette specification. Ce document ne fait pas partie de la serie DOC-000 a DOC-024.*
