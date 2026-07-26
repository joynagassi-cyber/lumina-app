# Secrets Strategy — Lumina v1

**Doc ID:** DEP-SPEC-003
**Version:** v1.0
**Statut:** SPÉCIFICATION DÉPLOIEMENT DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-v1", "PAS-001", "BR-ID-001"]
**Transformation_rule :** "deployment-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## TABLE DES MATIÈRES

1. [Secrets Classification](#section-1-secrets-classification)
2. [Secret Storage Patterns](#section-2-secret-storage-patterns)
3. [Secret Rotation Policy](#section-3-secret-rotation-policy)
4. [Secret Access Controls](#section-4-secret-access-controls)
5. [Secret Auditing](#section-5-secret-auditing)
6. [Secret Breach Response](#section-6-secret-breach-response)

---

## SECTION 1: SECRETS CLASSIFICATION

All secrets used by Lumina are categorized into the following classes. Each class has distinct storage, rotation, access control, and auditing requirements defined in subsequent sections.

### S-001: Database Credentials

**Description:** Authentication credentials for connecting to database clusters (primary, replicas, read-only roles).

**Subtypes:**
| Subtype | Purpose | Environment Usage |
|---------|---------|------------------|
| Primary DB User | Read-write access to database primary | All environments |
| Replica DB User | Read-only access to database replicas | Staging, Production, DR |
| Migration Role | Elevated privileges for schema migrations only | Staging, Production (temporary) |
| Service Account DB User | Restricted-privilege user for Lumina service accounts (RLS) | All environments |

**Example Secret Path Pattern:** `/secrets/{env}/database/{role}/credentials`

**Rotation Frequency:** Every 90 days (automated)

**Blast Radius if Compromised:** Full database access within scoped role privileges. RLS policies limit data visibility per role, but the primary user credential has broadest impact.

### S-002: API Keys

**Description:** Keys required for external service authentication consumed by Lumina adapters.

**Subtypes:**
| Subtype | Purpose | Consumed By |
|---------|---------|-------------|
| SMTP Credentials | Email notification delivery | NotificationPort adapter (email.adapter) |
| Push Notification API Key | FCM/APNs push delivery | NotificationPort adapter (push.adapter) |
| File Storage Provider Key | Object storage access | FileStoragePort adapter (blob.adapter) |
| External Auth Server Token | Remote identity provider authentication | IdentityProviderPort adapter (network.adapter) |
| Search Service API Key | External search backend authentication | SearchPort adapter (elasticsearch.adapter) |
| Analytics/Telemetry API Key | External metrics collection | Optional diagnostics integration |

**Example Secret Path Pattern:** `/secrets/{env}/api-keys/{service-name}`

**Rotation Frequency:** Every 180 days, or immediately upon provider-mandated rotation

**Blast Radius if Compromised:** Ability to send notifications on behalf of Lumina, upload/download files from storage bucket, or authenticate to external services. No direct database access.

### S-003: Encryption Keys

**Description:** Cryptographic keys used by Lumina for data-at-rest encryption and data-in-transit integrity verification.

**Subtypes:**
| Subtype | Purpose | Algorithm (Abstract) |
|---------|---------|---------------------|
| Field-Level Encryption Key | Encrypts PII fields (email, phone, name) before persistence | Symmetric AEAD |
| TLS Private Key | Termination of HTTPS connections at load balancer/gateway | Asymmetric (RSA/ECC) |
| JWT Signing Key | Signs and validates JSON Web Tokens for authentication | HMAC-SHA256 (as per RTS-002 Phase 104 binding spec) |
| Audit Log Integrity Key | Ensures audit log entries cannot be tampered with | HMAC-SHA256 |
| Message Bus Encryption Key | Encrypts event payloads at rest on message broker | Symmetric AEAD |

**Example Secret Path Pattern:** `/secrets/{env}/encryption/{key-purpose}`

**Rotation Frequency:**
- Field-level encryption key: Every 365 days with key versioning (old keys retained for decrypting historical data)
- TLS private key: Every 365 days (automated renewal recommended)
- JWT signing key: Every 30 days with dual-key overlap period (see §3.3)
- Audit log integrity key: Every 365 days
- Message bus encryption key: Every 180 days

**Blast Radius if Compromised:** Field-level key → all encrypted PII data readable. TLS key → MITM attacks possible. JWT key → forged authentication tokens. Audit integrity key → tampered audit logs undetectable.

### S-004: Authentication Tokens

**Description:** Ephemeral and long-lived tokens used for service-to-service authentication and session management.

**Subtypes:**
| Subtype | Purpose | Lifetime |
|---------|---------|----------|
| Session Refresh Token | Extends user authentication sessions | Configurable via ConfigurationPort; default short-lived (hours to days) |
| Service Account Token | Inter-service authentication within Lumina runtime | Tied to service account lifecycle |
| OAuth Exchange Token | Temporary token for remote auth server exchange (network mode) | Single-use, minutes |
| Webhook Signing Secret | Validates incoming webhook signatures (if Lumina receives webhooks) | Until rotated |

**Example Secret Path Pattern:** `/secrets/{env}/tokens/{token-purpose}`

**Rotation Frequency:**
- Session refresh tokens: Rotated on each refresh (BY DESIGN — token lifecycle managed by Lumina Application layer)
- Service account tokens: Every 90 days
- OAuth exchange tokens: Per-use (single-use tokens)
- Webhook signing secret: Every 180 days

**Blast Radius if Compromised:** Session tokens → unauthorized access as compromised user (limited by org_id scoping INV-004). Service account tokens → inter-service communication impersonation. OAuth tokens → remote auth server abuse.

### S-005: TLS Certificates

**Description:** X.509 certificates used for HTTPS termination and mutual TLS authentication.

**Subtypes:**
| Subtype | Purpose | Issuer |
|---------|---------|--------|
| Public-Facing TLS Certificate | HTTPS termination at load balancer | Public CA (automated renewal) |
| Internal mTLS Client Certificate | Inter-service authentication (mTLS between nodes) | Internal CA |
| Internal mTLS Server Certificate | Inter-service server authentication (mTLS) | Internal CA |
| Replication TLS Certificate | Encrypted cross-region replication tunnel | Internal CA or public CA |

**Example Secret Path Pattern:** `/secrets/{env}/tls/{certificate-purpose}`

**Rotation Frequency:** 90-day validity with automated renewal (45 days before expiration, renewal triggers)

**Blast Radius if Compromised:** Public certificate compromise → MITM attacks (mitigated by certificate pinning and CRL/OCSP checks). Internal certificate compromise → inter-service impersonation.

### S-006: Organization-Level Settings (Org Config Secrets)

**Description:** Organization-specific configuration values that contain sensitive information, managed through ConfigurationService and stored in the settings table.

**Subtypes:**
| Subtype | Purpose | Stored In |
|---------|---------|-----------|
| Org SMTP Password | Organization's email server password | Lumina settings table (encrypted at rest) |
| Org Push Notification Config | Organization's push notification credentials | Lumina settings table (encrypted at rest) |
| Org Custom Integration Keys | Third-party integration credentials per organization | Lumina settings table (encrypted at rest) |

**Note:** Organization-level secrets are stored DIFFERENTLY from platform-level secrets. Platform-level secrets are resolved once at bootstrap (CRT-005 ConfigurationLoader, Phase 101). Organization-level secrets are resolved per-request from the settings table and must themselves be encrypted at rest using the field-level encryption key (S-003).

**Rotation Frequency:** Per-organization, triggered by organization admin action

**Blast Radius if Compromised:** Per-organization scope only (INV-004 multi-tenant isolation). Limited to the affected organization's integrations.

---

## SECTION 2: SECRET STORAGE PATTERNS

### 2.1 Storage Principle

All secrets MUST be stored in a dedicated secrets management system. NO secret value may exist in plaintext in:
- Source code repositories (git-tracked files or gitignored files)
- Configuration files (even environment-specific ones)
- Environment variable listings visible to non-privileged users
- Application memory beyond the lifetime of the configuration resolution
- Log output (BR-ID-001 constitutionnel: no credentials in any diagnostic or log output)
- Backup snapshots of application containers or deployment artifacts

### 2.2 Platform Secrets vs Organization Secrets

Platform-level secrets (S-001 through S-005) and organization-level secrets (S-006) use DIFFERENT storage patterns:

| Aspect | Platform Secrets (S-001 to S-005) | Organization Secrets (S-006) |
|--------|----------------------------------|------------------------------|
| Storage Location | Dedicated secrets vault/manager | Lumina settings table (Database) |
| Resolution Time | Phase 101 (ConfigurationLoader at bootstrap) | Per-request (ConfigurationService at runtime) |
| Encryption at Rest | Secrets vault managed encryption | Field-level encryption using S-003 key |
| Access Control | IAM/secrets vault RBAC | Lumina RBAC (Admin role only) |
| Audit Trail | Secrets vault audit log + Lumina audit log | Lumina audit log only |
| Rotation Trigger | Automated (schedule-based) | Manual (org admin initiated) |
| Scope | Environment-scoped | Organization-scoped |

### 2.3 Secret Reference Pattern

Configuration files reference secrets by PATH, not by VALUE:

```
Instead of:  db_password: "actual_password_value_12345"
Use:         db_password_ref: "/secrets/prod/database/primary/credentials/password"
```

The secrets manager resolves the path to the actual value at runtime during Phase 101 (ConfigurationLoader). The application NEVER stores the resolved value beyond what is needed for the connection operation. For database connections, the password is passed to the connection pool constructor and may remain in memory for the node's lifetime (connection pool is continuously active). For API key operations (notifications, file storage), keys are cached per-request or per-session.

### 2.4 Secrets in Configuration Snapshot

Once resolved, secrets become part of the `ConfigSnapshot` produced by CRT-005 ConfigurationLoader. This snapshot is IMMUTABLE (cannot be modified after creation, per RTS-002 Phase 101). The ConfigSnapshot is shared via ConfigurationPort (Port-008).

**Memory Exposure Rule:** Secret values within ConfigSnapshot are considered CONFIDENTIAL DATA. They MUST NOT be exposed through:
- Diagnostics endpoint `/debug/dump` (CRT-008 — BR-ID-001)
- Health check responses (CRT-007)
- Log output at any level (CRT-009 LoggingPort — BR-ID-001)
- Error messages propagated to clients

### 2.5 Cold Start Secret Resolution

During Phase 101 (Configuration Loading), if the secrets manager is unavailable:
- **Development:** EXIT — local environment variables serve as secrets manager fallback; if unavailable, EXIT
- **Staging:** EXIT — vault unavailable means configuration cannot be loaded
- **Production:** EXIT — this is a critical dependency failure; incident response procedures activated
- **DR:** EXIT — same as Production

There is NO graceful degradation for secrets manager unavailability during bootstrap. The application CANNOT start without resolving its secrets. Starting without secrets would mean either running with hardcoded defaults (security violation) or running with unresolved configuration (functional impossibility).

---

## SECTION 3: SECRET ROTATION POLICY

### 3.1 Rotation Schedule by Secret Class

| Secret Class | Rotation Frequency | Rotation Method | Overlap Period | Downtime During Rotation |
|-------------|-------------------|-----------------|----------------|-------------------------|
| S-001: Database Credentials | 90 days | Automated via secrets manager | 0 minutes | Zero (rolling restart) |
| S-002: API Keys | 180 days | Automated or manual | 0 minutes | Zero (per-adapter) |
| S-003: Encryption Keys | 30-365 days (varies by subtype) | Manual with versioning | Dual-key overlap: 7 days | Zero (both keys accepted during overlap) |
| S-003: JWT Signing Key | 30 days | Automated | Dual-key overlap: 24 hours | Zero (both keys validate during overlap) |
| S-004: Service Account Tokens | 90 days | Automated | 0 minutes | Zero (re-auth on next use) |
| S-004: Webhook Signing Secret | 180 days | Manual | 0 minutes | Potential brief gap |
| S-005: TLS Certificates | 90 days validity, renew at 45 days | Automated | 0 minutes | Zero (cert hot-reload supported) |
| S-006: Org Settings Secrets | Per-org admin action | Manual | N/A | N/A (per-org only) |

### 3.2 Rotation Procedure (Generic)

For all automated rotations, the following procedure applies:

1. **Prepare new secret value** in secrets manager alongside existing value
2. **Mark existing secret** with expiration timestamp (not yet revoked)
3. **Rolling restart** of affected application nodes (one at a time, minimum healthy node count maintained)
4. Each restarting node resolves the NEW secret during Phase 101
5. **Health check verification** on each restarted node (CRT-007 Phase 105 equivalent)
6. After all nodes have adopted new secret, **revoke old secret** in secrets manager
7. **Audit entry** written documenting rotation event (who initiated, when completed, which secrets rotated)

For dual-key overlap rotations (encryption keys, JWT keys):
1. New key created in secrets manager
2. Both old and new keys marked as VALID in secrets manager
3. Application nodes reloaded (may take one or multiple rolling restarts)
4. Overlap period begins: BOTH keys accepted for cryptographic operations
5. After overlap period (7 days for encryption keys, 24 hours for JWT keys), old key marked EXPIRED
6. Old key revoked after 7-day additional grace period

### 3.3 JWT Key Dual-Key Overlap Detail

Because JWT validation occurs per-request and tokens signed by a previous key must still be accepted during rotation:

1. At rotation time, both `jwt_signing_key_vN` and `jwt_signing_key_vN-1` exist in secrets manager with valid status
2. CRT-005 ConfigurationLoader resolves the CURRENT active key (newest, with valid status)
3. CRT-008 Diagnostics exposes which key versions are accepted for validation
4. JWT tokens signed by vN-1 ARE accepted as valid during overlap period
5. New JWT tokens issued use vN (newest key)
6. After overlap period (24 hours), vN-1 marked expired
7. Tokens signed by expired key rejected going forward

This ensures zero authentication disruption during key rotation.

### 3.4 Rotation Failure Handling

If a rotation fails (node restart does not complete, health check fails, old connection cannot establish):

1. Rotation PAUSED on affected node (reverted to previous secret)
2. Remaining nodes continue rollout
3. Operations team investigates the failed node
4. If investigation exceeds 1 hour, escalation to on-call Engineering lead
5. Full rollback of rotation if > 25% of nodes fail

---

## SECTION 4: SECRET ACCESS CONTROLS

### 4.1 Runtime Access (Application)

Secrets are resolved by the Lumina application ONLY during Phase 101 (ConfigurationLoader) or per-request for organization-level settings. No other phase of the application lifecycle requires secret resolution.

**Access Model:**
- CRT-005 ConfigurationLoader (Phase 101) resolves platform secrets referenced in configuration
- ConfigurationService (per-request) resolves organization-level secrets from the settings table
- Resolved secret values enter the ConfigSnapshot or are used directly for the target operation
- After resolution, secret values MUST NOT be stored in variables accessible outside their operational scope

**Memory Discipline:**
- Platform secrets in ConfigSnapshot: persist for node lifetime (active from Phase 101 to Phase 109 shutdown)
- Organization secrets from settings table: resolved per-request, available only during request processing scope
- Neither class of secret may be cached longer than operationally necessary

### 4.2 Human Access (Operations Team)

Human access to secret values follows the principle of LEAST PRIVILEGE:

| Role | Can View Secret Values? | Can Rotate Secrets? | Can List Secret Paths? |
|------|------------------------|---------------------|----------------------|
| Developer | NO | NO | NO |
| QA Engineer | NO | NO | NO |
| Product Owner | NO | NO | NO |
| Operations Engineer | YES (break-glass, logged) | YES (environment-dependent) | YES |
| DevOps Engineer | YES (environment-dependent) | YES | YES |
| Auditor | NO (can verify audit trail only) | NO | YES (paths only, not values) |
| SuperAdmin (app) | NO (application role, infra access separate) | NO | NO |

**Break-Glass Procedure:** When an Operations Engineer needs to view a secret value for troubleshooting:
1. Request logged in break-glass audit system
2. Two-person authorization required (on-call Ops lead + DevOps lead)
3. Time-bound viewing session (maximum 15 minutes)
4. ALL viewing actions recorded (who accessed which secret, when, for how long)
5. Session automatically terminated after timeout

### 4.3 Service-to-Service Access

Secrets are NEVER transmitted between services in plaintext. Inter-service secret access uses:
- Secrets manager authenticated API calls (mTLS or token-based)
- Short-lived session tokens (never master credentials exchanged between services)
- Per-environment isolated secret namespaces (dev/staging/prod secrets never share paths)

### 4.4 Cross-Environment Secret Isolation

Secret paths are strictly isolated per environment:
```
/secrets/dev/...      — Development environment only
/secrets/staging/...  — Staging environment only
/secrets/prod/...     — Production environment only
/secrets/dr/...       — Disaster Recovery environment only
```

NO secret path is shared across environments. NO secret value is replicated between environments (except DR, where production secrets are replicated under strict encryption).

Cross-environment secret leakage is detectable by:
- Monitoring secrets manager access patterns (staging process accessing prod paths = alert)
- Regular audit of secret path mappings per environment
- Automated comparison of secret path prefixes per environment

---

## SECTION 5: SECRET AUDITING

### 5.1 Audit Scope

ALL secret access attempts — successful or failed — MUST be audited. The audit covers:

| Event Type | Who Generates Audit Entry | Where Stored |
|-----------|--------------------------|-------------|
| Secret resolution by ConfigurationLoader (Phase 101) | CRT-005 ConfigurationLoader | Lumina AuditAggregate (Port-010) |
| Secret resolution by ConfigurationService (per-request) | ConfigurationService | Lumina AuditAggregate (Port-010) |
| Secret viewed by human (break-glass) | Secrets manager | External audit system + Lumina AuditAggregate |
| Secret rotated (new value established) | Secrets manager | External audit system + Lumina AuditAggregate |
| Secret rotation attempted and FAILED | Secrets manager | External audit system + Lumina AuditAggregate |
| Secret access attempt by unauthorized principal | Secrets manager (BLOCKED) | External audit system + Lumina AuditAggregate |

### 5.2 Audit Entry Schema

All secret-related audit entries include:

| Field | Type | Example Value |
|-------|------|--------------|
| action | enum | `SECRET_RESOLVED`, `SECRET_ROTATED`, `SECRET_VIEWED`, `SECRET_ACCESS_DENIED` |
| entityType | string | `platform_secret` or `org_secret` |
| entityId | string | Secret path identifier (never the value) |
| userId | string | Human user ID who triggered the action, or `system` if automated |
| orgId | string | Organization scope (for org-level secrets); `SYSTEM-WIDE` for platform secrets |
| correlationId | string | From CRT-013/CR-015 — per-request or per-operation |
| timestamp | ISO 8601 | `2026-07-25T14:30:00Z` |
| result | enum | `SUCCESS`, `FAILURE`, `DENIED` |
| metadata | object | Additional context: rotation reason, overlap key version, etc. |

### 5.3 Audit Retention for Secrets

Secret audit entries follow RETENTION-031: minimum 7 years retention. These entries MUST NOT be deleted, modified, or obscured in any way.

**Exception:** Audit entries themselves MUST NOT contain secret values. They record THAT a secret was accessed, by WHO, WHEN, and with WHAT RESULT — never WHAT the secret value was.

### 5.4 Audit Query Access

Only Admin and Auditor roles may query secret audit entries (per ACCESS-033, restricted to admin/auditor roles). Query filters:
- Must include org_id scope (INV-004)
- Cannot return raw secret values — only path identifiers
- Pagination supported (100 entries per page default)
- Time-range filter required (prevents unbounded queries against 7-year retention data)

---

## SECTION 6: SECRET BREACH RESPONSE

### 6.1 Breach Detection Indicators

A potential secret breach is detected when:
1. An unauthorized principal accesses a secret (access pattern anomaly in secrets manager audit log)
2. A secret value appears in an unexpected location (source code repository, log output, error message, diagnostic dump)
3. A secret is accessed from an unusual geographic location or network range
4. A human break-glass session is initiated but not completed within timeout (possible shoulder surfing)
5. Automated scanning tool detects secret value in deployment artifact hash mismatch
6. External party reports possessing a valid Lumina secret

### 6.2 Breach Response Procedure

**Step 1: Confirm and Contain (T+0 to T+15 minutes)**
- Verify the breach is real (not false positive from monitoring/alerting noise)
- Identify which secret(s) were compromised (class, environment, scope)
- Immediately revoke the compromised secret in the secrets manager
- If production platform secret compromised: initiate emergency node restart to force re-resolution from secrets manager (now pointing to new secret value)
- If organization-level secret compromised: notify affected organization admin immediately

**Step 2: Assess Impact (T+15 min to T+2 hours)**
- Determine what systems/services can be accessed with the compromised secret
- Calculate blast radius: which tenants/orgs are affected
- Check if the compromised secret was used for anything beyond expected operations (data exfiltration analysis)
- Preserve all audit logs related to the compromised secret for forensic analysis

**Step 3: Remediate (T+2 hours to T+24 hours)**
- Issue new secret value for the compromised type
- Rotate all secrets that share the same compromise vector (e.g., if SMTP password compromised, also rotate associated API keys)
- If encryption key compromised: initiate key version upgrade with dual-key overlap
- If TLS certificate compromised: emergency certificate revocation and reissuance
- Restart affected application nodes with new secrets (rolling restart)

**Step 4: Verify (T+24 hours to T+48 hours)**
- Confirm all new secrets are functioning correctly (health checks pass)
- Verify no residual access with old secret value (monitor for denied access attempts using revoked credentials)
- Validate blast radius scope: confirm no unauthorized data was accessed
- Run full security scan against affected environment

**Step 5: Post-Incident Review (T+48 hours to T+1 week)**
- Document full timeline: detection, response, remediation, verification
- Identify root cause: how did the breach occur?
- Identify prevention measures: what controls should be added to prevent recurrence?
- Update secrets strategy (DEP-SPEC-003) if gaps are identified
- Brief stakeholders (operations, security, leadership)

### 6.3 Communication Requirements

| Event | Internal Notification | External Notification | Timeline |
|-------|----------------------|----------------------|----------|
| Confirmed breach of platform secret | Operations team, DevOps lead, Security team | Per regulatory requirements (GDPR, financial regulations) | Within 1 hour of confirmation |
| Confirmed breach of org-level secret | Affected org admin, Operations team | Affected organization user(s) if PII exposed | Within 4 hours of confirmation |
| Suspected breach (unconfirmed) | On-call Ops engineer | None (no public notification until confirmed) | Within 30 minutes of detection signal |
| False positive (no breach) | Alerting team, on-call Ops | None | Within 1 hour of investigation completion |

### 6.4 Pre-Stored Emergency Secrets Reset Procedure

In case of CATASTROPHIC breach requiring immediate full reset of all secrets in an environment:

1. Emergency meeting: Operations lead + DevOps lead + Security lead
2. Decision: FULL SECRETS RESET (all platform secrets for one environment)
3. Generate all new secret values through secrets manager bulk rotation API
4. Maintain OLD secrets in transition state for 5-minute overlap period
5. Rolling restart ALL nodes in affected environment simultaneously (zero-downtime possible only with blue-green deployment; otherwise accept controlled outage window)
6. Each node resolves NEW secrets during Phase 101 on restart
7. Old secrets revoked 5 minutes after all nodes report healthy
8. Full audit trail of emergency reset maintained (who authorized, when, which secrets)

**Risk:** This procedure causes controlled service interruption. It is the NUCLEAR OPTION — reserved for confirmed catastrophic breaches only. Normal rotation (§3) handles all routine secret changes without downtime.

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | deployment-specifier v1.0 | Creation — Secrets Strategy for Lumina v1: classification (6 categories), storage patterns (platform vs org separation), rotation policy (with dual-key overlap), access controls (human/service/runtime), auditing (full coverage), breach response (5-step procedure) | COMPLIANT (verified against BR-ID-001 credential privacy, RETENTION-031 audit retention, CRT-005 ConfigurationLoader bootstrap constraints, INV-004 multi-tenant isolation) |

---

*Ce document definit la strategie de gestion des secrets pour Lumina. Il ne specifie aucun outil de gestion des secrets concret (pas de HashiCorp Vault, AWS Secrets Manager, Azure Key Vault). L'outil est selectionne independemment des regles decrites ici.*
