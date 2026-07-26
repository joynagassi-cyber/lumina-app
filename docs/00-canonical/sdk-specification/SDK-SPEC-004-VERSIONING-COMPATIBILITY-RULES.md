# Versioning & Compatibility Rules
**Doc ID:** SDK-SPEC-004
**Version:** v1.0
**Statut:** SPÉCIFICATION SDK ET INTÉGRATION DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["SDK-SPEC-001", "SDK-SPEC-002", "API-CONTRACT-001", "API-CONTRACT-002", "API-CONTRACT-005"]
**Transformation_rule :** "sdk-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## SOMMAIRE

1. [Semantic Versioning for SDK](#section-1-semantic-versioning-for-sdk)
2. [Deprecation Policy](#section-2-deprecation-policy)
3. [API Contract Stability Levels](#section-3-api-contract-stability-levels)
4. [Multi-Version Support](#section-4-multi-version-support)
5. [Compatibility Matrix](#section-5-compatibility-matrix)
6. [Migration Guide Template](#section-6-migration-guide-template)
7. [Long-Term Support (LTS) Policy](#section-7-long-term-support-lts-policy)
8. [Release Engineering Process](#section-8-release-engineering-process)

---

## SECTION 1: SEMANTIC VERSIONING FOR SDK

### 1.1 Semver Adoption

The Lumina SDK follows Semantic Versioning (SemVer 2.0.0) for all public releases. Every SDK package version MUST use the format MAJOR.MINOR.PATCH, optionally followed by pre-release and build metadata identifiers.

```
Format: MAJOR.MINOR.PATCH[-prerelease][+build]
Examples:
  1.0.0          — First stable release
  1.2.3          — Patch release in minor version 2 of major version 1
  2.0.0-beta.1   — Pre-release of major version 2
  1.0.0+build.42 — Build with metadata
```

### 1.2 Major Version Bumps

A MAJOR version increment (N.x.x → N+1.x.x) occurs when ONE OR MORE of the following changes are made to the SDK's stable surface:

| Change Type | Example | Justification |
|------------|---------|--------------|
| Removed SDK method from public API | Removal of an operation method derived from a deprecated API-CONTRACT-001 operation | Public contract change |
| Changed SDK method signature | Renamed parameter, changed parameter type, removed optional parameter that was part of the documented interface | Breaking method contract |
| Changed error code | Renamed or removed an error code from API-CONTRACT-005 | Error taxonomy contract change |
| Changed response model structure | Removed field from standard success envelope, changed data type in response model | Response contract change |
| Changed authentication model | Modified token handling, session management, or credential requirements | Security contract change |
| Changed event payload structure | Added/removed/renamed fields in domain event payloads from DOC-014 | Event contract change |
| Changed pagination contract | Modified page_size limits, offset behavior, or cursor semantics | API-CONTRACT-002 Section 2.4 change |

**Principle:** If a consumer's code that compiles against SDK version X.Y.Z would NOT compile or would produce different runtime behavior after upgrading to SDK version X'+Y'.Z', where X' > X, this is a breaking change requiring a major version bump.

### 1.3 Minor Version Bumps

A MINOR version increment (x.N.x → x.N+1.x) occurs when ONE OR MORE of the following changes are made WITHOUT breaking existing functionality:

| Change Type | Example | Justification |
|------------|---------|--------------|
| Added new SDK method | New operation method for a newly added API-CONTRACT-001 operation | Additive contract change |
| Added new request/response model | New entity model for a new aggregate entity | Additive data type |
| Added new exception class | New error code from API-CONTRACT-005 addition | Additive error type |
| Added new event type | New domain event from DOC-014 update | Additive event type |
| Added new connector type | New DataSync or Notification connector support | Additive extensibility |
| Added optional parameters | New optional field on existing request models | Backward-compatible extension |
| Added new configuration option | New SDK setting in ConfigurationEngine | Non-breaking capability addition |
| Updated documentation | Improved comments, examples, migration guides | Documentation improvement |
| Performance improvements | Faster response parsing, reduced memory usage | Internal optimization |

**Principle:** All code that works against SDK version x.N.y continues to work against SDK version x.N+1.z. Existing method signatures, return types, and exception hierarchies remain identical.

### 1.4 Patch Version Bumps

A PATCH version increment (x.y.N → x.y.N+1) occurs for changes that do NOT modify the public contract in any observable way:

| Change Type | Example | Justification |
|------------|---------|--------------|
| Bug fixes | Incorrect error code mapping, off-by-one in pagination | Defect correction |
| Security patches | Fix in credential handling, TLS certificate validation | Vulnerability remediation |
| Documentation corrections | Typos, outdated examples in comments | Information accuracy |
| Performance micro-optimizations | Faster JSON parsing, reduced allocation overhead | Internal efficiency |
| Translations in error messages | Corrected human-readable error text | Usability improvement |
| Build system fixes | Corrected package manifest, dependency resolution | Packaging correctness |
| Test infrastructure improvements | Better test coverage, faster test execution | Quality assurance |

**Principle:** Patch upgrades are always safe. No behavior change is introduced that a consumer could observe through the public API surface.

### 1.5 Pre-Release Versions

Pre-release versions follow SemVer conventions:

| Identifier | Meaning | Usage |
|-----------|---------|-------|
| `-alpha` | Early development, unstable | Internal testing only |
| `-beta` | Feature-complete but may have compatibility changes | External testing, feedback collection |
| `-rc.1`, `-rc.2` | Release candidates, stabilizing | Production readiness verification |
| `-nightly.build` | Daily snapshot, no stability guarantee | CI/CD pipeline consumption |

Pre-release versions DO NOT increment major, minor, or patch numbers of the base version. They exist solely for validation before a full release.

---

## SECTION 2: DEPRECATION POLICY

### 2.1 Deprecation Lifecycle

When an element on the SDK's stable surface must be removed or significantly altered, it enters a deprecation lifecycle:

```
[STABLE] ──(deprecated in vX.Y)──▶ [DEPRECATED] ──(supported until vX+2.0.0)──▶ [REMOVED]
         Runtime warning emitted          Backward compatible              Publicly gone
         Docs updated                   Migration guide published            Docs updated
```

### 2.2 Deprecation Timeline

| Phase | Version Trigger | Duration | Actions Required |
|-------|----------------|----------|-----------------|
| **Mark Deprecated** | MINOR version N | 0 days | Emit runtime warning, update docs, publish migration guide |
| **Continue Support** | MINOR version N+1 | ≥ 1 minor cycle | Warnings continue; element fully functional |
| **Hard Deprecation** | MINOR version N+2 | ≥ 1 more minor cycle | Warnings upgraded to errors in debug mode; plan removal |
| **Remove** | MAJOR version M (M > current) | At release | Element removed from public export, may exist internally temporarily |

**Minimum timeline:** Deprecated elements are supported for at least two MAJOR versions before removal. In practice, this means: if Element X is deprecated in SDK v2.1.0, it remains available through SDK v4.x.x and is removed in SDK v5.0.0.

### 2.3 Deprecation Warning Format

When the SDK emits a deprecation warning, it includes:

| Field | Content |
|-------|---------|
| Warning type | "DEPRECATION_WARNING" |
| Affected element name | The exact method/model/error identifier being deprecated |
| Deprecated in version | SDK version where deprecation was announced (e.g., "2.1.0") |
| Planned removal version | SDK version where removal is expected (e.g., ">= 5.0.0") |
| Replacement element | The new method/model/error that should be used instead |
| Migration guide link | Reference to the relevant section of the migration guide |

### 2.4 Elements Subject to Deprecation vs. Never Deprecated

| Category | Can Be Deprecated? | Rationale |
|----------|-------------------|-----------|
| Methods derived from active API-CONTRACT-001 operations | Yes, only if the operation is removed from the API contract | SDK methods mirror the canonical contract |
| Error classes from API-CONTRACT-005 | Yes, only if the error code is retired from the taxonomy | Error codes are stable identifiers |
| Request/response models from API-CONTRACT-002 | Yes, for unused models or models replaced by schema evolution | Model lifecycle follows API contract |
| Event type definitions from DOC-014 | Rarely — only if an event type is consolidated | Domain events are historical records |
| Configuration engine options | Yes | Internal SDK settings can evolve |
| Connector interfaces (SDK-SPEC-003) | Yes | Connector extensibility evolves independently |

Elements directly derived from active canonical contracts CANNOT be deprecated unless the underlying canonical contract element itself is deprecated through the architecture governance process (DOC-000 modification procedure).

### 2.5 Transition Period Tooling

The SDK provides tooling to help consumers navigate deprecation:

**Lint rule:** A static analysis rule that scans consumer code for uses of deprecated SDK elements and reports them with deprecation context.

**Upgrade advisor:** A programmatic tool (`SDKUpgradeAdvisor`) that, given an installed SDK version and a target SDK version, produces a list of all breaking and deprecated changes between them, along with recommended migration steps.

**Deprecation audit log:** An internal SDK log tracking all deprecations issued in a given version, accessible programmatically for automated CI checks.

---

## SECTION 3: API CONTRACT STABILITY LEVELS

Three levels of stability guarantee govern different parts of the SDK surface. Each level defines what consumers can reliably depend upon.

### 3.1 GA (Generally Available)

**Stability guarantee:** Full backward compatibility forever. GA elements will never be removed, renamed, or have their behavior changed in a breaking way within the same major version line.

**Applies to:**
- All SDK methods derived from API-CONTRACT-001 operations that are marked as core/foundational.
- All error classes from API-CONTRACT-005 categories that are foundational (E-400, E-401, E-403, E-404, E-409, E-422, E-500 base classes).
- All request/response models from API-CONTRACT-002 for Tier 1 aggregates (Organization, Identity, Resource, Relationship, Configuration per SDK-SPEC-002 Section 1.3).
- The base exception hierarchy (LuminaError and its direct subclasses).
- Standard success response envelope (API-CONTRACT-002 Section 2.2).
- Standard error response envelope (API-CONTRACT-002 Section 2.3).

### 3.2 Beta

**Stability guarantee:** Best-effort compatibility. Beta elements may change within a minor version (e.g., v1.2.0 → v1.3.0) if bugs are discovered or usability issues arise. However, the SDK team commits to minimizing beta changes and documents all modifications in release notes.

**Applies to:**
- SDK methods for Tier 2 and Tier 3 aggregates (SDK-SPEC-002 Section 1.3).
- Newly introduced error sub-classes (e.g., LuminaInvariantViolatedError and its invariant-specific children) during their first minor version cycle.
- Request/response models for entities added in the current or immediately preceding minor version.
- Event subscription interfaces for newly added domain events from DOC-014 updates.
- Pagination models for query operations newly added since the last major version.
- The upgrade advisor tool output format (during first major version using it).

**Beta consumer guidance:** Applications depending on beta features should pin their SDK version to avoid unexpected minor-version changes. When upgrading across minor versions that include beta elements, run the Upgrade Advisor tool and review the changelog.

### 3.3 Experimental

**Stability guarantee:** No stability guarantee. Experimental elements may change in any way between any releases, including removal. They may not work correctly in all environments. They are provided for early feedback and prototyping only.

**Applies to:**
- Preview connectors for protocols or external systems under evaluation.
- SDK methods for aggregates or operations not yet included in a formal API contract document.
- Internal diagnostic tools exposed for developer investigation (debug endpoints, trace collectors).
- Pre-release documentation generation utilities.
- Any feature explicitly prefixed with `experimental_` or `preview_` in its identifier.

**Experimental consumer guidance:** NEVER use experimental elements in production. Experimental APIs are not covered by the deprecation policy. They may disappear without warning.

### 3.4 Stability Level Classification Summary

| Stability Level | Breaking Changes Allowed? | Deprecation Period Required? | Production-Safe? |
|----------------|--------------------------|----------------------------|-----------------|
| GA | No (within same major version) | N/A (never removed within major) | Yes |
| Beta | Yes (within minor version) | Recommended but not required | No (pin version recommended) |
| Experimental | Yes (any version change) | No | No (development/testing only) |

---

## SECTION 4: MULTI-VERSION SUPPORT

### 4.1 Simultaneous SDK Versions in a Single Application

An application may import and use multiple SDK versions simultaneously:

**Mechanism:** Each SDK version is scoped to a distinct namespace (language-dependent: module path, package name, or import alias). This allows:
- Legacy integration code using SDK v1.x while new code uses SDK v2.x.
- Gradual migration from one major version to another without rewrite.
- A/B testing of new SDK capabilities against stable ones.

**Constraints:**
- Both SDK versions must target the SAME Lumina server API contract version range. Cross-API-version communication is mediated by the server, not the SDK.
- Shared dependencies between SDK versions must be compatible. If SDK v1.x depends on library A v1.0 and SDK v2.x depends on library A v2.0, a conflict exists. The SDK packaging must ensure independent dependency trees for coexistence.
- Event handlers registered by different SDK versions receive events according to each version's own filtering rules. There is no cross-version event correlation.

### 4.2 Automatic Version Negotiation

When the SDK client connects to a Lumina server:

1. The SDK sends its version identifier (MAJOR.MINOR.PATCH) in the initial connection handshake.
2. The server responds with its supported API contract version range.
3. The SDK validates compatibility:
   - If the server's API version is within the SDK's supported range, connection proceeds.
   - If the server's API version is outside the supported range, the SDK raises LuminaSystemError.UNEXPECTED_ERROR with details about version mismatch.
   - If the SDK version is deprecated by the server, the server includes a deprecation advisory header.
4. After initial negotiation, the SDK and server maintain consistent version understanding for the lifetime of the connection. Re-negotiation occurs on reconnection after disconnection.

### 4.3 Version-Specific Namespaces

For languages where import scoping is lexical (modules/packages), SDK version isolation is automatic through import paths. For languages without strong namespace isolation:

**Pattern:** All types in SDK version N+1 are placed in a version-scoped module path:
```
lumina_sdk_v{major}::                      # Top-level version namespace
  api::organization::createOrganization()  # Versioned operation method
  models::request::CreateUserRequest       # Versioned model
  errors::LuminaValidationError            # Versioned exception
```

This pattern enables explicit version-qualified imports in any language.

---

## SECTION 5: COMPATIBILITY MATRIX

### 5.1 SDK Version to API Contract Version Mapping

Each released SDK version documents which API contract versions it supports. This mapping ensures consumers know whether their SDK version can communicate with their server deployment.

**Matrix structure:**

| SDK Version | Supported API Contract Versions | Notes |
|------------|--------------------------------|-------|
| 1.0.x | 1.0.x, 1.1.x | Initial SDK release; supports API contract v1.0 and hotfixes |
| 1.1.x | 1.0.x, 1.1.x | Backward compatible with previous API contract; adds support for new operations |
| 2.0.x | 1.1.x, 2.0.x, 2.1.x | Major SDK version; drops support for oldest API contract, adds new contract version |
| 2.1.x | 1.1.x, 2.0.x, 2.1.x | Extended API contract support window |

### 5.2 Compatibility Support Window

The SDK supports API contract versions according to this timeline:

| API Contract Age | SDK Support Status |
|-----------------|-------------------|
| Current version | Fully supported |
| Previous version | Supported with best effort |
| Two versions old | Supported for 1 additional major SDK release |
| Three+ versions old | NOT supported; SDK raises version incompatibility error |

**Example:** If SDK v2.3.0 supports API contracts v1.1 and v2.1, then:
- API v2.1 (current): Full support.
- API v1.1 (previous): Supported.
- API v1.0 (two versions back): Supported until SDK reaches v3.0.0.
- API v0.x (three+ versions back): Already unsupported in SDK v2.x.

### 5.3 Unsupported API Version Behavior

When an SDK version attempts to connect to a server whose API contract version falls outside the supported range:

1. **Connection refused at handshake:** The SDK detects the mismatch before sending any operations.
2. **Clear error message:** The SDK throws LuminaSystemError.DEPENDENCY_FAILURE (E-500-004) with a message containing the SDK's supported range and the server's reported version.
3. **Actionable guidance:** The error message recommends either upgrading the SDK or downgrading the server, with links to version compatibility documentation.

---

## SECTION 6: MIGRATION GUIDE TEMPLATE

Every migration between SDK major versions MUST include a migration guide following this template. The migration guide is a structured document that enables consumers to upgrade with minimum disruption.

### Template Structure

```markdown
# Migration Guide: SDK v{oldMajor}.x → v{newMajor}.x

## Overview
Brief summary of what changed and why. Impact assessment for typical integrations.

## Breaking Changes

### 1. {Change Category}
**Affected elements:** {list of specific methods, models, errors}
**What changed:** Description of the modification
**Impact:** What existing code breaks and why
**Migration step:** Concrete action required
**Before:**
  {description of old behavior/pattern}
**After:**
  {description of new behavior/pattern}

### 2. ... (repeat for each category of change)

## New Features
List of new SDK capabilities introduced in this version.

## Deprecated Features (if any)
Elements marked for removal, with deadlines and replacements.

## Automated Migration
List of available migration scripts, lint rules, or upgrade advisor findings.

## Testing Checklist
1. [ ] Run SDK upgrade advisor against codebase
2. [ ] Apply migration script output
3. [ ] Resolve remaining compilation errors manually
4. [ ] Run integration test suite
5. [ ] Verify event subscriptions still function
6. [ ] Confirm connector configurations are valid
7. [ ] Update deprecation warnings (if present)
8. [ ] Rollback tested: verify downgrade to {oldVersion} works if needed

## Rollback Plan
If migration fails:
1. Revert SDK package to v{oldMajor}.{lastMinor}.{lastPatch}
2. Restore SDK configuration from backup
3. Redeploy application
4. Investigate migration failure against changelog entries

## Changelog Entry
{Standardized changelog block for this version transition}
```

---

## SECTION 7: LONG-TERM SUPPORT (LTS) POLICY

### 7.1 LTS Designation

Certain major SDK versions are designated as Long-Term Support (LTS) releases. LTS releases receive extended maintenance beyond the standard support window.

**LTS eligibility criteria:**
- The SDK version must be a stable MAJOR release (not alpha/beta/RC).
- It must be the first release of a new major version line (e.g., v2.0.0, not v2.1.0).
- The architecture governance body must approve the LTS designation based on: consumer adoption rate, strategic importance of the version line, and resource availability for continued support.

### 7.2 LTS Support Duration

| Support Type | Duration | Coverage |
|-------------|----------|----------|
| Critical security fixes | 24 months from first release | Security vulnerabilities affecting P-SEC-001 through P-SEC-006 principles |
| Bug fixes | 18 months from first release | All non-security defect corrections |
| Feature updates | Last minor version of the LTS line | Optional, at governance body discretion |
| Full support | 12 months from first release | All the above + priority response for support requests |

### 7.3 LTS SDK Version Schedule

| SDK Version | LTS Start | Expected LTS End | Current Status |
|------------|-----------|-----------------|---------------|
| v1.x | At launch | 12 months after v2.0.0 | Active / Extended |
| v2.x | TBD | 24 months after v2.x first release | To be designated |
| v3.x | TBD | 24 months after v3.x first release | Not yet released |

**Note:** Only one major SDK version line is designated LTS at any time. This ensures focused maintenance resources and prevents fragmentation.

### 7.4 Non-LTS Versions

Non-LTS major version lines receive the standard support period defined in SDK-SPEC-004 Section 2 (minimum 2 major versions of deprecation support before element removal). Security patches are provided for non-LTS versions for 6 months from the next major release, or until the next LTS designation, whichever is longer.

---

## SECTION 8: RELEASE ENGINEERING PROCESS

### 8.1 Release Cadence

| Release Type | Frequency | Scope |
|-------------|-----------|-------|
| **Patch release** | As needed (critical bugs/security) | Bug fixes, security patches only |
| **Minor release** | Quarterly | New features, connectors, improved SDK method coverage |
| **Major release** | Annual or as needed for breaking changes | Architecture shifts, deprecation completions, API contract version jumps |
| **Pre-release** | On demand | Testing feedback, contributor validation |

### 8.2 Release Checklist

Every SDK release goes through this validation sequence:

1. **API contract alignment:** Confirm all 83+ operations from API-CONTRACT-001 have corresponding SDK methods (SDK-SPEC-001 Section 9).
2. **Error taxonomy completeness:** Confirm all 45+ error codes from API-CONTRACT-005 have corresponding exception classes (SDK-SPEC-001 Section 6).
3. **Cross-reference integrity:** Confirm all references between SDK-SPEC-001 through SDK-SPEC-005 are consistent.
4. **Connector compatibility:** Confirm all certified connectors pass their full integration test suite against this SDK version.
5. **Security audit:** Confirm no known CVEs in SDK dependencies and that SEC-SPEC-001 principles are upheld.
6. **Documentation review:** Confirm migration guide (if applicable) is complete and tested.
7. **Backward compatibility test:** Confirm existing applications targeting the previous SDK version continue to function.
8. **Performance benchmark:** Confirm no regression in response parsing speed, memory usage, or connection establishment time.

### 8.3 Changelog Generation

Changelogs are generated automatically from commit metadata tagged with change categories. The SDK release engineer reviews the generated changelog for accuracy before publication.

**Required changelog sections per release:**
- Breaking Changes (methods, models, errors removed or modified)
- New Features (new methods, connectors, configurations)
- Deprecations (elements marked for future removal)
- Bug Fixes (errors corrected)
- Security (vulnerabilities addressed)
- Known Issues (limitations in this release)

---

END OF SDK-SPEC-004
