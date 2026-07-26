# Public Integration Rules
**Doc ID:** SDK-SPEC-002
**Version:** v1.0
**Statut:** SPÉCIFICATION SDK ET INTÉGRATION DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["API-CONTRACT-001", "API-CONTRACT-004", "DOC-014", "PROTO-001", "SEC-SPEC-001", "ASS-001"]
**Transformation_rule :** "sdk-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## SOMMAIRE

1. [Public API Contract Stability](#section-1-public-api-contract-stability)
2. [Integration Authentication](#section-2-integration-authentication)
3. [Rate Limiting for External Consumers](#section-3-rate-limiting-for-external-consumers)
4. [Data Export/Import Standards](#section-4-data-exportimport-standards)
5. [Webhook Integration for External Systems](#section-5-webhook-integration-for-external-systems)
6. [Backward Compatibility Policy](#section-6-backward-compatibility-policy)

---

## SECTION 1: PUBLIC API CONTRACT STABILITY

### 1.1 Stable Surface Definition

The stable public surface of the Lumina SDK consists of all methods, models, error classes, and event types explicitly documented across the five SDK specification documents (SDK-SPEC-001 through SDK-SPEC-005). These constitute the guaranteed interface that third-party integrators may rely upon for production use.

**Stable elements include:**
- All 83+ operation methods from SDK-SPEC-001 Section 9, derived directly from API-CONTRACT-001
- All request and response model definitions from SDK-SPEC-001 Section 5, derived from API-CONTRACT-002
- All exception classes from SDK-SPEC-001 Section 6, derived from API-CONTRACT-005
- All event type definitions and subscription interfaces from SDK-SPEC-001 Section 7
- All connector interfaces from SDK-SPEC-003
- All versioning policies from SDK-SPEC-004

### 1.2 Unstable Elements Definition

The following are explicitly UNSTABLE and subject to change without deprecation period:

| Category | What It Includes | Change Scope |
|----------|-----------------|--------------|
| Internal helper methods | Methods not exported from the SDK's main index/re-export file | Any change without notice |
| Debug tools | Logging utilities, trace collectors, diagnostic endpoints exposed only when debug flag is set | Any change without notice |
| Experimental features | Features marked with an experimental prefix or suffix in documentation | Addition, modification, removal without notice |
| Private module internals | Code within modules not part of the public export surface | Any change without notice |
| SDK implementation details | Internal HTTP headers, transport-layer specifics, connection pool parameters | Any change without notice |

### 1.3 Stability Classification Per Aggregate

Not all aggregates carry equal stability guarantees. The classification below reflects the maturity level inferred from the canonical contract scope:

| Stability Tier | Aggregates Included | Rationale |
|---------------|---------------------|-----------|
| **Tier 1 — Maximum Stability** | Organization, Identity, Resource, Relationship, Configuration | Core aggregates with the most operations (37 total) and longest lifecycle; foundation of the system |
| **Tier 2 — High Stability** | Workflow, Form, Vocabulary, Audit, OfflineSync | Defined by canonical contracts with clear boundaries; integral to system operations |
| **Tier 3 — Standard Stability** | Notification, Reporting, Lifecycle | Well-defined but more sensitive to UI-level changes in form rendering and report formats |

All tiers are stable. Tier distinctions indicate relative priority for backward compatibility enforcement during deprecation cycles.

### 1.4 Contract Modification Process

When a change is required to any element on the stable surface:

1. **Identify impact scope:** Determine which aggregates, operations, models, or errors are affected.
2. **Classify change type:** Determine if it is additive (new method/model), non-breaking (new optional field), or breaking (removed field, renamed method, changed return type).
3. **Apply SDK-SPEC-004 versioning rules.** Breaking changes follow major version bumps; non-breaking follow minor; patch-level changes do not modify the stable surface.
4. **Publish migration guide** (per SDK-SPEC-004 Section 6) before the change enters a released SDK version.
5. **Maintain deprecated surface** through the full deprecation period defined in SDK-SPEC-004 Section 2.

---

## SECTION 2: INTEGRATION AUTHENTICATION

### 2.1 Authentication Types

Lumina supports two distinct authentication paths for SDK consumers:

#### User Tokens (Interactive Sessions)

User tokens represent an authenticated end user. They are obtained through the LoginUser command (IdentityAggregate) and provide the full RBAC permission set assigned to that user (API-CONTRACT-004).

**Characteristics:**
- Scoped to the user's org_id (resolved from session, never user-supplied per SEC-SPEC-001 P-SEC-002).
- Ephemeral lifetime with automatic refresh via RefreshAccessToken.
- Subject to all RBAC restrictions: users can only perform operations their role permits.
- Session tracking: every active session is recorded and can be revoked via RevokeSession.

**SDK usage pattern:** The SDK authenticates using credentials (email/password_hash), receives an ephemeral token from the server, and automatically manages its lifecycle (refresh before expiration, replay failed requests after refresh).

#### Service Account Tokens (Programmatic Integrations)

Service account tokens represent system-to-system integration rather than interactive user sessions. They are provisioned through the superadmin role and used by external systems, batch processors, and automated connectors.

**Characteristics:**
- Can span multiple org_ids when explicitly granted cross-org permissions.
- Not tied to a session; no expiration for the token itself (revoked manually by superadmin).
- Subject to RBAC restrictions but at a different granularity: service accounts have explicit permission grants rather than role-based assignments.
- All actions are audit-logged with the service account identifier as the actor_id.

**SDK usage pattern:** The SDK accepts a pre-provisioned service account token at construction time and includes it with every request. No session management is required.

### 2.2 Token Scope Mapping

Each SDK method implicitly carries the permission requirements defined in API-CONTRACT-004. The token presented by the SDK must satisfy these requirements. If the token lacks the necessary permission, the server returns E-403-001 INSUFFICIENT_PERMISSION.

**Example scope mapping:**

| SDK Operation Set | Required Permission Pattern | Example Roles |
|------------------|---------------------------|---------------|
| All read/query methods | resource:read (any subtype) | admin, treasurer, pastor, staff |
| Transaction create/update | transaction:create | admin, treasurer |
| Transaction approval | transaction:approve | admin, treasurer |
| Organization administration | *:*:* (superadmin wildcard) | superadmin only |
| Form loading/rendering | form:read | any authenticated |
| Notification send | notification:send | system, admin |
| Audit log query | audit:read | admin, auditor |
| Sync operations | sync:push, sync:pull | system (auto) |

### 2.3 Credential Handling Requirements

Per SEC-SPEC-001 P-SEC-005, the SDK MUST NOT:
- Store passwords or password hashes in any local persistence (memory-only during login round-trip).
- Log credential fields in any request or response.
- Transmit credentials over unencrypted channels.
- Expose password_hash values in any response model (this prohibition is enforced server-side by the IdentityAggregate boundary rules — the SDK must never attempt to display or cache password data).

### 2.4 Multi-Tenant Isolation Enforcement

Per SEC-SPEC-001 P-SEC-002 and API-CONTRACT-004 Data Isolation Rule:
- The SDK NEVER accepts org_id as a direct parameter for any operation.
- org_id is ALWAYS resolved from the authenticated session context or service account grant.
- If the SDK detects that a response contains org-scoped data that does not match the authenticated context, it MUST reject the response and raise an organizational integrity error.

---

## SECTION 3: RATE LIMITING FOR EXTERNAL CONSUMERS

### 3.1 Rate Limiting Tiers

External SDK consumers are subject to rate limiting applied at the server level, communicated to the SDK through standardized response headers. The SDK does not implement rate limiting logic itself; it observes and responds to server-enforced limits.

**Rate limit tiers:**

| Tier | Description | Approximate Limiting Factor |
|------|-------------|---------------------------|
| **Standard** | Default tier for all authenticated SDK connections | Base limit per operation category per minute |
| **Elevated** | Requested by integrators with documented high-volume needs | Multiplier applied to standard limits |
| **System** | Service account tokens with system-auto classification | Elevated limits for PushPendingOperations, PullRemoteChanges, and similar system operations |

### 3.2 Rate Limit Response Headers

Every API response from Lumina services includes rate limit metadata. The SDK parses these headers and makes them available programmatically:

| Header | Meaning |
|--------|---------|
| `X-RateLimit-Limit` | Maximum requests allowed in the current window |
| `X-RateLimit-Remaining` | Requests remaining in the current window |
| `X-RateLimit-Reset` | Timestamp when the rate limit window resets |
| `Retry-After` | Seconds to wait before retrying (present only on 429-equivalent responses) |

### 3.3 SDK Rate Limit Handling

When the server enforces a rate limit (response indicates quota exceeded):

1. The SDK catches the rate limit error condition (mapped to an appropriate E-422-xxx or E-429-equivalent code).
2. The SDK reads the Retry-After header value.
3. The SDK pauses further requests for the indicated duration.
4. After the pause, the SDK retries the blocked request.
5. If rate limit errors persist for more than N consecutive attempts (configurable), the SDK notifies the application layer so the consumer can escalate (request tier upgrade, reduce call frequency, etc.).

### 3.4 Bulk Operation Considerations

Bulk operations (ExportResources, ExportReport, ExportAuditTrail, PushPendingOperations with large batches) are subject to additional rate limiting beyond simple request count. The SDK should:
- For exports: process results page by page, respecting pagination limits (max 100 items per page per API-CONTRACT-002).
- For sync pushes: batch to maximum 50 operations per batch (SYNC-002).
- Allow the consuming application to configure concurrency limits for parallel bulk operations.

---

## SECTION 4: DATA EXPORT/IMPORT STANDARDS

### 4.1 Export Standards

Lumina data can be exported through dedicated export operations defined in API-CONTRACT-001:

**Available export endpoints:**
- ExportResources (ResourceAggregate) — exports transactions, members, events, archives, notifications
- ExportReport (ReportingAggregate) — exports computed reports in requested format
- ExportAuditTrail (AuditAggregate) — exports immutable audit logs for compliance periods

**Export contract:**
- All exports include a timestamp and digital signature (EXPORT-001 invariant).
- Exported data is scoped to the authenticated user's org_id. Cross-org data access is impossible.
- Formats supported: PDF, CSV, JSON (as defined per operation).
- Large exports are paginated; the SDK processes paginated responses sequentially.

**Export authorization:** Per API-CONTRACT-004:
- ExportResources requires reporting:read permission (admin, treasurer).
- ExportReport requires reporting:read permission (admin, treasurer).
- ExportAuditTrail requires audit:export permission (admin), with minimum 7-year retention enforced (RETENTION-031).

### 4.2 Import Standards

Data import into Lumina is performed through the standard create/update operation methods. There is no separate "bulk import API." Instead, external systems:

1. Read source data from the external system.
2. Transform each record into the appropriate SDK request model (from API-CONTRACT-002).
3. Call the relevant create or update SDK method for each record.
4. Handle returned errors per the SDK error hierarchy.

**Import constraints:**
- Each imported record goes through the same validation pipeline (schema → existence → invariant → domain rule) as user-originated data.
- Version numbers are managed server-side; the SDK handles optimistic locking (E-409-001) automatically per Section 6.4 of SDK-SPEC-001.
- Compensating transactions (CompensateTransaction) must be created through the SDK method, not through direct database writes.
- Approved transactions cannot be modified directly; only compensated.

**Import rate considerations:**
- High-volume imports should be spread across time windows to respect rate limits.
- Transaction creation has higher rate sensitivity than member creation (financial data integrity checks add latency).

### 4.3 Data Format Conventions

All SDK request/response models use canonical types, not language-specific serialization formats. The actual wire format (JSON, XML, binary) is determined by the protocol adapter (PROTO-001) and is transparent to the SDK consumer.

**Type mapping reference (abstract):**
- UUID → stable identifier (128-bit, formatted per UUID spec)
- STRING → UTF-8 text of variable length
- INT32 / INT64 → signed integers, 32-bit / 64-bit
- BOOLEAN → true/false
- DATE → calendar date without time component
- TIMESTAMP → date and time with timezone
- EMAIL_ADDRESS → validated email format string
- PHONE_NUMBER → formatted per region convention
- ENUM → string value from predefined set
- JSONB → structured object/map

---

## SECTION 5: WEBHOOK INTEGRATION FOR EXTERNAL SYSTEMS

### 5.1 Event Subscription Model

External systems receive Lumina domain events through the event subscription mechanism described in SDK-SPEC-001 Section 7. This mechanism supports both push-based delivery (webhooks/events streamed to external endpoints) and pull-based polling (external systems periodically query for new events).

**Supported delivery modes:**
- **Push (Event Stream):** The SDK maintains a persistent connection to the Lumina event stream and delivers events to registered handlers in real time. This is the preferred mode for low-latency integrations.
- **Pull (Polling):** The SDK periodically queries for events since the last known timestamp. Suitable for systems that cannot maintain persistent connections.

### 5.2 Payload Format

Events are delivered in the CloudEvents abstraction format. Each event payload contains:

| Field | Source | Description |
|-------|--------|-------------|
| spec_version | Protocol | CloudEvents version identifier |
| id | DOC-014 | Unique event identifier |
| source | DOC-014 | Originating aggregate name |
| type | DOC-014 | Event type name (e.g., "UserCreated") |
| subject | DOC-014 | Entity subject of the event |
| time | DOC-014 | Server timestamp |
| data_schema | API-CONTRACT-002 §2.2 | Typed data matching the event payload definition |
| org_id | API-CONTRACT-004 | Organization context |
| correlation_id | API-CONTRACT-002 §2.3 | Original request_id for tracing |

### 5.3 Delivery Guarantees

| Guarantee Level | Description | Applicable Events |
|----------------|-------------|-------------------|
| **At-least-once** | Events are delivered one or more times; duplicates possible | All standard event subscriptions |
| **Best-effort** | Events during disconnection are not buffered; gaps possible | Pull-mode polling |

The SDK does NOT guarantee exactly-once delivery. Consumers must implement idempotency in their event handlers. The event `id` field enables deduplication at the consumer side.

### 5.4 Health and Retry

Webhook/event delivery includes these mechanisms:
- **Acknowledgment:** External receivers must acknowledge receipt within a configurable timeout. Unacknowledged events are retried.
- **Retry policy:** Exponential backoff with increasing delay between attempts. Maximum retry count is configurable (default: 5 attempts).
- **Dead letter:** Events exceeding maximum retries are placed in a dead-letter queue observable through the SDK's monitoring interface.
- **Signature verification:** Each webhook delivery includes a signature header enabling the receiver to verify the event originated from Lumina and was not tampered with during transit.

### 5.5 Event Filtering

External subscribers can filter events at registration time:
- By event type (subscribe only to UserCreated, ignore all others).
- By aggregate (subscribe to all ResourceAggregate events).
- By org_id (subscribe only to events from specific organizations).
- By severity (for notification events: info, warning, critical).

Filtered events that do not match the subscription criteria are silently discarded server-side (no unnecessary network overhead).

---

## SECTION 6: BACKWARD COMPATIBILITY POLICY

### 6.1 Semantic Versioning Adoption

The Lumina SDK follows Semantic Versioning (SemVer) for all releases. Each SDK package version uses MAJOR.MINOR.PATCH format:

| Version Component | Meaning | Examples |
|------------------|---------|---------|
| **MAJOR** | Breaking change to stable surface | Method removal, error code removal, model field removal, authentication model change |
| **MINOR** | New functionality, non-breaking additions | New SDK method for new API operation, new event type, new connector type |
| **PATCH** | Bug fixes, performance, documentation | Error message corrections, retry timing fixes, documentation updates |

### 6.2 Deprecation Process

When any element on the stable surface must be removed or significantly changed:

**Step 1 — Deprecation Announcement (MINOR version N):**
- The element is marked deprecated in the release notes and runtime warnings.
- All calls to the deprecated element continue to function identically.
- A deprecation warning is emitted at runtime (log output or callback) indicating the element is deprecated, which version it will be removed in, and what replacement to use.
- A migration guide entry is published in SDK-SPEC-004 Section 6 format.

**Step 2 — Support Period (through MINOR version N+K where K ≥ 2):**
- The deprecated element continues to function without modification.
- Migration guides are maintained and tested.
- Documentation is updated to recommend the replacement.

**Step 3 — Removal (MAJOR version M where M > current MAJOR):**
- The deprecated element is removed from the public SDK surface.
- It may remain available internally for a limited period but is no longer exported.
- Changelog clearly documents the removal and links to the migration guide.

**Minimum support period:** Deprecated elements are supported for a minimum of two major versions before removal. Some Tier 1 aggregates may have extended support periods at the discretion of the architecture governance body.

### 6.3 Migration Guide Requirements

Every migration guide between major SDK versions MUST include:

| Section | Content |
|---------|---------|
| **Summary of Changes** | List of all breaking changes in this version |
| **Impact Assessment** | Which aggregates, methods, models, or errors are affected |
| **Before/After Code Examples** | Side-by-side comparison showing old and new API usage |
| **Automated Migration Tools** | Any available scripts or tools for mechanical updates |
| **Testing Checklist** | Steps to verify the migration works correctly |
| **Rollback Plan** | How to revert to the previous SDK version if issues arise |

### 6.4 Coexistence of Multiple SDK Versions

Applications using Lumina may run multiple SDK versions simultaneously:
- An older SDK version for legacy integration points.
- A newer SDK version for newly developed integration features.

The SDK ensures backward compatibility at the wire level: requests sent by SDK version N are understood by servers supporting API contract versions compatible with SDK version N. Cross-version communication is mediated by the server-side API contract version negotiation.

### 6.5 SDK and API Contract Version Correlation

Each SDK version explicitly states which API contract version(s) it supports. This correlation is documented in SDK-SPEC-004 Section 5 (Compatibility Matrix). The SDK validates the server's API contract version on first connection and raises an incompatibility error if the server's version is outside the supported range.

**Supported range policy:** The SDK supports the current API contract version plus the immediately preceding version. Older API contract versions receive compatibility support for two additional major SDK releases after being superseded.

---

END OF SDK-SPEC-002
