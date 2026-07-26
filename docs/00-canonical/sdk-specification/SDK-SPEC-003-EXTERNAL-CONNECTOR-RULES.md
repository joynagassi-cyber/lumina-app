# External Connector Rules
**Doc ID:** SDK-SPEC-003
**Version:** v1.0
**Statut:** SPÉCIFICATION SDK ET INTÉGRATION DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["SDK-SPEC-001", "PROTO-001", "PAS-001", "API-CONTRACT-001", "API-CONTRACT-002", "SEC-SPEC-001", "ASS-004"]
**Transformation_rule :** "sdk-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## SOMMAIRE

1. [Connector Abstraction Pattern](#section-1-connector-abstraction-pattern)
2. [Connector Types](#section-2-connector-types)
3. [Connector Lifecycle](#section-3-connector-lifecycle)
4. [Connector Security](#section-4-connector-security)
5. [Connector Testing](#section-5-connector-testing)
6. [Connector Extensibility](#section-6-connector-extensibility)
7. [Connector Configuration Model](#section-7-connector-configuration-model)
8. [Cross-Reference Matrix](#section-8-cross-reference-matrix)

---

## SECTION 1: CONNECTOR ABSTRACTION PATTERN

### 1.1 Purpose

Connectors are the abstraction layer that enables Lumina's SDK to communicate with external systems beyond the Lumina server itself. While the SDK's built-in operations cover all 83 canonical API operations (API-CONTRACT-001), connectors extend the SDK's capabilities to synchronize data, authenticate users, deliver notifications, and store files in external systems that exist outside Lumina's boundaries.

A connector is NOT a replacement for an SDK method. It IS a bridge that maps data between the Lumina canonical request/response models and external system representations.

### 1.2 Connector Interface Contract

Every connector MUST implement this abstract interface:

| Method | Input | Output | Responsibility |
|--------|-------|--------|---------------|
| `initialize(config)` | Connector configuration object | void | Validate config, establish connection resources |
| `mapToCanonical(externalData)` | External system data payload | CanonicalRequestModel | Transform external format to Lumina canonical request model |
| `mapFromCanonical(canonicalData)` | Canonical request/response model | External system data payload | Transform Lumina canonical model to external format |
| `syncDirection()` | None | Enum (ONE_WAY_INBOUND / ONE_WAY_OUTBOUND / BIDIRECTIONAL) | Declare synchronization directionality |
| `healthCheck()` | None | HealthStatus | Verify connector is operational and connected |
| `dispose()` | None | void | Clean up connection resources |

### 1.3 Data Transformation Rules

Connectors perform bidirectional data transformation:

**External → Canonical (Inbound):**
1. Receive data from the external system in its native format.
2. Apply field mapping to match canonical request model fields from API-CONTRACT-002.
3. Perform type coercion where needed (e.g., string date to DATE type).
4. Run structural validation against the canonical request contract.
5. Emit a CanonicalRequestModel ready for submission through the standard SDK operation pipeline.

**Canonical → External (Outbound):**
1. Receive CanonicalRequestModel or CanonicalResponseModel from SDK operation.
2. Apply reverse field mapping to match external system fields.
3. Perform type coercion to external system expectations.
4. Construct the external system payload.
5. Transmit via the external system's protocol.

**Invariant:** All transformation logic MUST be deterministic. The same external input must always produce the same canonical output. No transformation may alter business-meaningful data beyond type representation changes.

### 1.4 Error Translation for Connectors

When a connector encounters an error during data transformation or external system communication:

| Source | Connector Behavior | SDK Exception Mapping |
|--------|-------------------|----------------------|
| Transformation failure (field missing, type mismatch) | Log detailed transformation error, reject the record | LuminaValidationError variant with transformation details |
| External system unreachable | Queue the operation in the offline queue, mark as pending retry | LuminaSystemError.DEPENDENCY_FAILURE (E-500-004) |
| External system returns business error | Map to appropriate E-4xx code based on external error type | Category-matched Lumina error class |
| Credentials expired/invalid | Raise auth error, signal SDK to re-authenticate then retry | LuminaAuthError variant |
| Rate limited by external system | Back off per Retry-After equivalent from external system | Transient retry with exponential backoff |

---

## SECTION 2: CONNECTOR TYPES

Connectors are classified by their integration purpose. Each type has specific requirements, configuration models, and behavioral guarantees.

### 2.1 Data Sync Connector

**Purpose:** Bidirectional data synchronization between Lumina aggregates and external databases or data stores.

**Use cases:**
- Synchronize member records between Lumina's ResourceAggregate and an external HR system.
- Mirror transaction data between Lumina and an external accounting platform.
- Keep org unit hierarchies in sync with an external organizational management system.

**Behavioral characteristics:**
- Supports incremental sync (only changed records since last sync timestamp).
- Respects Lumina's offline-first model: sync operations use the OfflineSyncAggregate queue when disconnected.
- Conflict resolution follows the strategies defined in API-CONTRACT-001 §13.3 (LWW, server-wins, immutable, uuid-dedup, side-by-side).
- Approved transactions (ResourceAggregate) are treated as immutable — outbound sync only; inbound attempts to modify approved transactions are rejected with E-422-001-FIN-001.
- Sync intervals are configurable; minimum interval enforced by Lumina server to prevent excessive load.

**Mapped to Lumina aggregates:** ResourceAggregate (transactions, members), OrganizationAggregate (org units), RelationshipAggregate (group memberships).

### 2.2 Authentication Connector

**Purpose:** Bridge Lumina's IdentityAggregate with external identity providers for single sign-on (SSO), OAuth, and SAML federation.

**Use cases:**
- Authenticate Lumina users against an external Active Directory/LDAP directory.
- Federate login through an external OAuth provider (social login, enterprise SSO).
- Synchronize user provisioning between Lumina and an external identity management system.

**Behavioral characteristics:**
- Authentication Connector does NOT replace Lumina's internal authentication (LoginUser, RefreshAccessToken). It EXTENDS it by providing alternative credential verification paths.
- Tokens issued through external identity providers are mapped to Lumina session tokens upon successful authentication.
- User creation via external identity follows the CreateUser command contract, with email uniqueness enforced (EMAIL-001).
- Session lifecycle (logout, revoke, refresh) continues through Lumina's IdentityAggregate regardless of the authentication source.
- Password policy enforcement (BR-ID-001 hash complexity) applies to locally managed passwords; federated identities delegate password policy to the external provider but may impose additional Lumina-specific constraints.

**Security requirement:** Per SEC-SPEC-001 P-SEC-003 (Zero Trust), all external identity responses must be verified. Certificate chains for SAML assertions, token signatures for OAuth responses — verification happens before any Lumina session is created.

### 2.3 Notification Connector

**Purpose:** Bridge Lumina's NotificationAggregate with external notification delivery channels beyond the four native channels (in_app, push, email, sms).

**Use cases:**
- Deliver notifications through a custom messaging platform (e.g., Microsoft Teams, Slack, Telegram).
- Integrate with an external SMS gateway not natively supported.
- Connect to a legacy paging or callback system.
- Route critical notifications through an external incident management platform.

**Behavioral characteristics:**
- Each Notification Connector handles one external channel type.
- Notification content is transformed from Lumina's MessageTemplate canonical format to the external channel's message format.
- Delivery receipts from external systems are mapped back to Lumina domain events (NotificationSent, NotificationFailed).
- Quiet hours (QUIET-004) and rate limits (RATE-002) enforced at the Lumina level before the connector receives the notification.
- Channel preferences (CHANNEL-003) respected: if a user has disabled a channel in Lumina, no notification is sent to that connector for that user.

**Error handling:** Failed delivery through an external notification channel is recorded as a NotificationFailed event. The SDK surfaces this as a domain event, not as an exception to the calling application. The sending operation itself succeeds (the notification was "sent" to the connector; delivery failure is a separate lifecycle stage).

### 2.4 Storage Connector

**Purpose:** Bridge Lumina's file-handling operations with external file or object storage systems.

**Use cases:**
- Store uploaded form attachments in an external cloud storage service.
- Serve exported reports (PDF, CSV, JSON) from an external CDN-backed bucket.
- Archive resource documents (pieces jointes) to long-term cold storage.

**Behavioral characteristics:**
- Storage Connector does not manage Lumina's canonical data (transactions, members, etc.). It manages附件-level data referenced by Lumina entities.
- File upload operations receive a canonical URL reference back into the external storage system.
- File download operations proxy through Lumina's FileStoragePort (PAS-001 Port-013).
- Access controls on stored files respect Lumina's org_id isolation: a file stored for org A is never accessible to org B.
- Encryption at rest is handled by the external storage system; Lumina ensures TLS in transit.

**Mapping to FormAggregate:** Form attachments uploaded through form submissions are stored via the configured Storage Connector. The FormDefinition includes a reference to the storage connector identifier for file operations.

**Mapping to LifecycleAggregate:** Archived resource attachments are migrated to the configured long-term storage via Storage Connector on archive transition.

### 2.5 Connector Type Summary Matrix

| Connector Type | Lumina Aggregates Used | Sync Direction | Configurable | Extensible |
|---------------|----------------------|----------------|-------------|-----------|
| Data Sync | Resource, Organization, Relationship | Bidirectional | Yes (intervals, filters) | Yes (custom field mappings) |
| Authentication | Identity | One-way inbound (auth only) | Yes (provider parameters) | Limited (standard protocols only) |
| Notification | Notification | One-way outbound | Yes (channel templates) | Yes (new channel types) |
| Storage | Form, Lifecycle, Reporting | Bidirectional | Yes (bucket/container config) | Yes (new storage backends) |

---

## SECTION 3: CONNECTOR LIFECYCLE

Every connector goes through a defined lifecycle from registration to retirement. The SDK manages this lifecycle automatically; integrators interact with it through the connector configuration interface.

### 3.1 Lifecycle States

```
[REGISTERED] → [VALIDATING] → [ACTIVE] ↔ [DEGRADED] → [RETIRING] → [RETIRED]
                    ↓              ↑
                  [FAILED] ←──────┘
```

| State | Description | SDK Behavior |
|-------|-------------|-------------|
| **Registered** | Connector configuration saved but not yet activated | Not yet used for any operations |
| **Validating** | SDK performs initial health check and test transformation | Blocks connector activation until validation passes |
| **Active** | Connector is operational and participating in data flows | All mapped operations use this connector |
| **Degraded** | Connector responds slowly or with errors above threshold | Operations fall back to pre-fallback behavior; alerts emitted |
| **Failed** | Connector unreachable or consistently returning errors | Operations routed through offline queue; connection retried |
| **Retiring** | Connector being phased out; new writes disabled, reads still allowed | Operations continue for reads; writes queued for manual migration |
| **Retired** | Connector fully deactivated and removed from configuration | Connector state purged from SDK configuration |

### 3.2 Health Check Protocol

The SDK performs periodic health checks on all active connectors:

| Check | Frequency | Trigger | Response to Failure |
|-------|-----------|---------|---------------------|
| Connectivity ping | Every 60 seconds (configurable) | Scheduled | Move to Degraded after 3 consecutive failures |
| Transformation test | On activation, every 24 hours | Scheduled | Move to Failed if latest test fails |
| Credential validity | On each operation that requires auth | Operation-level | Auto-retry with re-auth; move to Failed if persistent |
| Data integrity sample | Every 1 hour | Scheduled | Alert integrator; do not change connector state |

### 3.3 Failover Behavior

When a connector enters Failed or Degraded state:
1. Operations that would use the failed connector are queued in the OfflineSyncAggregate (SYNC-004 compliance: user ops never blocked).
2. The SDK emits a ConnectorHealthChanged domain event notifying subscribers of the state change.
3. Automatic reconnection attempts follow exponential backoff (matching SYNC-003 pattern).
4. If the connector enters Retiring state, the integrator must select a replacement connector within the configured grace period.

### 3.4 Retirement Process

Connector retirement is a controlled process:
1. **Retiring flag set:** New writes disabled; existing reads continue.
2. **Data migration window:** Remaining data is migrated from the retiring connector's external system to the replacement or to Lumina's local persistence.
3. **Read-only mode:** The retiring connector operates in read-only mode during migration.
4. **Retirement confirmation:** After migration verification, the connector is marked Retired and removed from active configuration.
5. **Configuration cleanup:** Connector metadata and credentials are purged from SDK configuration storage.

---

## SECTION 4: CONNECTOR SECURITY

Every connector, regardless of type, MUST satisfy these security requirements. These are non-negotiable and enforced at multiple layers.

### 4.1 Credential Storage

| Requirement | Enforcement |
|------------|-------------|
| Secrets are NEVER hardcoded in connector configuration files, SDK source code, or logs | ConfigurationPort (PAS-001 Port-008) abstracts credential storage; actual values reside in an external secrets manager |
| Credentials are encrypted at rest in SDK local storage using keys from CryptographicPort | SEC-SPEC-004 encryption rules apply |
| Credential rotation is supported without connector disassembly | New credentials are validated before old ones are retired |
| Connection strings never appear in audit logs | Audit aggregate masks credential fields (OLDNEW-002 compliance) |

### 4.2 Transport Security

| Requirement | Enforcement |
|------------|-------------|
| All external connections use TLS 1.2 or higher | Transport layer enforces minimum TLS version |
| Self-signed certificates are rejected unless explicitly configured (with warning) | Connection validation step rejects unverified chains |
| Certificate pinning is supported for high-assurance integrations | Optional configuration parameter per connector |
| Internal Lumina-to-external connections are logged with correlation IDs | Audit log entry created for every connection establishment |

### 4.3 Authorization Scoping

Per SEC-SPEC-001 P-SEC-002 (Least Privilege):

| Connector Scope Rule | Implementation |
|---------------------|---------------|
| Data Sync connectors operate only on configured entity types | Connector configuration lists permitted resource types; other types are silently ignored |
| Authentication connectors cannot create superadmin users | Superadmin creation reserved exclusively for Lumina's CreateUser boundary |
| Notification connectors respect CHANNEL-003 user preferences | Before dispatch, connector checks user's channel preferences |
| Storage connectors operate only within configured buckets/containers | Connector configuration restricts scope; over-scope attempts return access denied |
| All connector actions are audit-logged | AuditAggregate.LogAction is invoked for every connector-initiated data change |

### 4.4 Permission Boundary

Each connector has an explicit permission boundary defined at registration time:

```
ConnectorPermissionGrant = {
    connectorType: Enum[DataSync, Authentication, Notification, Storage],
    allowedOperations: List[OperationName],
    scopedToAggregates: List[AggregateName],
    scopedToOrgIds: List[UUID] (empty = all orgs),
    maxBatchSize: Integer (default: 50, per SYNC-002),
    allowedExportFormats: List[Enum[pdf, csv, json]],
    credentialStoreRef: String (reference to secrets manager entry)
}
```

The SDK enforces these boundaries at runtime. Attempts by a connector to perform operations outside its grant are rejected with an appropriate error code and logged to the AuditAggregate.

---

## SECTION 5: CONNECTOR TESTING

### 5.1 Unit Tests

Every connector implementation MUST include unit tests covering:

| Test Category | What It Validates |
|--------------|-------------------|
| MapToCanonical | Correct transformation of representative external payloads to canonical models |
| MapFromCanonical | Correct transformation of canonical models to external payloads |
| Edge Cases | Empty payloads, maximum-length fields, special characters, null values |
| Validation | Rejection of malformed external data with appropriate error classification |
| Type Coercion | Correct conversion between external and canonical type representations |
| Determinism | Same input always produces same output (idempotent transformation) |
| Error Propagation | Errors during transformation map to correct Lumina exception classes |

### 5.2 Integration Tests

Every connector MUST include integration tests against:

| Test Environment | Purpose |
|-----------------|---------|
| Mock external system | Full simulation of external system behavior (success, failure, rate limiting, auth errors) |
| Staging environment (if available) | Real external system connection with sandbox/test credentials |
| Local emulator | For connectors without public test endpoints, a local emulation server reproduces external system behavior |

**Integration test scenarios:**
1. Happy path: full round-trip (external → canonical → SDK operation → response → external).
2. Partial failure: external system partially responds (some records succeed, some fail); connector handles mixed results correctly.
3. Timeout: external system does not respond within configured timeout; connector fails gracefully.
4. Auth rotation: simulate credential expiration mid-connection; connector re-authenticates and resumes.
5. Bulk sync: large batch processing (>50 records); connector respects batch size limits and retries correctly.

### 5.3 Connector Test Harness

The SDK provides a built-in test harness for connectors:

```
ConnectorTestHarness {
    runConnectorTests(connectorConfig, testScenarios)
    → TestReport {
        passed: int,
        failed: int,
        skipped: int,
        details: List[TestResult]
      }
}
```

Test results are persisted in the SDK's internal metrics store and can be queried programmatically. Failed connector tests block connector activation — a connector cannot transition from Registered to Active if its integration tests have failed.

---

## SECTION 6: CONNECTOR EXTENSIBILITY

### 6.1 Adding New Connectors Without Core Modifications

New connectors can be added without modifying core SDK code through the following extensibility mechanism:

**Step 1 — Define Connector Implementation:**
Create a module implementing the ConnectorInterface (Section 1.2) with the appropriate data transformation logic for the target external system.

**Step 2 — Register Connector Metadata:**
Register the connector with the SDK's connector registry, providing:
- Connector type and unique identifier
- Configuration schema (fields the integrator must provide)
- Supported external system version(s)
- Mapping definitions (external field names → canonical field names)

**Step 3 — Deploy Connector Module:**
Place the connector module in the SDK's extensibility directory. The SDK discovers and loads new connector modules at startup without requiring core SDK reinstallation.

**Constraint:** Connector implementations CANNOT modify:
- The canonical request/response models (API-CONTRACT-002).
- The error taxonomy (API-CONTRACT-005).
- The aggregate boundary definitions (DOC-013).
- The RBAC permission matrix (API-CONTRACT-004).

Connectors operate strictly as transformers between external formats and canonical contracts. Any business logic must remain in Lumina's server-side aggregates.

### 6.2 Third-Party Connector Marketplace

Third-party developers can publish connector modules for community use. The SDK supports loading third-party connectors through the same registration mechanism, with an additional trust validation step:

| Validation Step | Performed By | Result |
|----------------|-------------|--------|
| Code integrity check | SDK build-time verifier | Hash comparison against published signature |
| Permission scope validation | SDK connector registry | Ensures connector claims no more permissions than declared |
| Test suite execution | SDK test harness (Section 5) | Must pass all required test categories |
| Security scan | External security review tool | No known vulnerabilities in connector dependencies |

Third-party connectors that pass all validations are marked as "certified." Uncertified connectors can still be loaded but emit runtime warnings.

### 6.3 Connector Configuration Schema

Each connector type has a standard configuration schema plus connector-specific extensions:

**Standard fields (all connectors):**
- `connectorId`: Unique identifier for this connector instance.
- `name`: Human-readable name for display in admin interfaces.
- `enabled`: Boolean toggle for activation/deactivation.
- `retryPolicy`: Object defining backoff strategy and max retries.
- `logLevel`: Verbosity of connector logging (debug, info, warn, error, none).

**Type-specific extensions:**
- Data Sync: `syncInterval`, `entityTypes`, `filterExpression`, `conflictStrategy`.
- Authentication: `providerType`, `discoveryUrl`, `clientId`, `scopes`.
- Notification: `channelType`, `apiEndpoint`, `apiKeyRef`, `templateMap`.
- Storage: `storageProvider`, `containerRef`, `region`, `aclMode`.

---

## SECTION 7: CONNECTOR CONFIGURATION MODEL

Connectors are configured through the SDK's ConfigurationEngine (SDK-SPEC-001 Section 3), but with connector-specific extension points:

```
ConnectorConfig = {
    base: StandardSDKConfig,           // From SDK-SPEC-001 Section 3
    connectors: {
        [connectorId]: ConnectorInstanceConfig
    },
    defaultConnectorForType: Enum,     // Fallback connector if not specified per entity type
    globalRetryPolicy: RetryPolicy,    // Applied to all connectors unless overridden
    auditTrail: {
        enabled: boolean,              // Whether connector actions are audit-logged
        includePayloadSnapshot: boolean // Whether full request/response snapshots are logged
    }
}
```

The `auditTrail.includePayloadSnapshot` setting must be false for connectors handling sensitive data (authentication credentials, payment information). Per SEC-SPEC-001 P-SEC-005, sensitive data snapshots are never persisted in audit logs.

---

## SECTION 8: CROSS-REFERENCE MATRIX

This section maps connector types to their source canonical references and validates traceability.

| Section | References | Source Document | Validation |
|---------|-----------|----------------|------------|
| 1.2 ConnectorInterface | PAS-001 Port-008 (ConfigurationPort), Port-010 (AuditPort) | Ports-Adapters Catalog | Interface methods align with port requirements |
| 2.1 Data Sync | API-CONTRACT-001 §3, §13 | API Contracts | Sync operations match OfflineSyncAggregate boundary |
| 2.2 Authentication | API-CONTRACT-001 §2, SEC-SPEC-001 P-SEC-003 | API Contracts + Security | Auth flow respects zero-trust principle |
| 2.3 Notification | API-CONTRACT-001 §7, DOC-014 events | API Contracts + Events | Notification events mapped correctly |
| 2.4 Storage | PAS-001 Port-013 (FileStoragePort), API-CONTRACT-001 §6 | Ports + API Contracts | Storage operations align with FormAggregate boundaries |
| 3 Lifecycle | ASS-001 Application Services | App Services Registry | Connector states mirror service lifecycle |
| 4.1 Credential Storage | SEC-SPEC-005 Secret Handling Rules | Security Specifications | Credential rules conform to secret handling |
| 4.3 Permission Boundary | API-CONTRACT-004 RBAC Matrix | Authorization Mapping | Connector scopes respect role hierarchy |
| 5 Testing | API-CONTRACT-005 Error Taxonomy | Error Specification | Error mapping covers all connector failure modes |
| 6.2 Third-Party | SEC-SPEC-001 P-SEC-001 Defense in Depth | Security Model | Multi-layer validation matches defense-in-depth |

---

END OF SDK-SPEC-003
