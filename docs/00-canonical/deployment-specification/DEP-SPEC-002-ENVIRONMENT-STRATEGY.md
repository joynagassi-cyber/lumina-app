# Environment Strategy — Lumina v1

**Doc ID:** DEP-SPEC-002
**Version:** v1.0
**Statut:** SPÉCIFICATION DÉPLOIEMENT DÉFINIE PAR GENESIS
**Date:** 2026-07-25
**Source canonique :** ["RTS-v1", "ASS-001", "PAS-001", "TRR-V1.2"]
**Transformation_rule :** "deployment-specifier v1.0"
**architecture_version :** "v1.0 (DOC-000-DOC-024 + ARA-v1)"
**compliance_status :** "COMPLIANT"

---

## TABLE DES MATIÈRES

1. [Environment Provisioning Process](#section-1-environment-provisioning-process)
2. [Data Strategy per Environment](#section-2-data-strategy-per-environment)
3. [Configuration Management](#section-3-configuration-management)
4. [Access Matrix](#section-4-access-matrix)
5. [Environment Lifecycle](#section-5-environment-lifecycle)
6. [Environments Matrix Table](#section-6-environments-matrix-table)

---

## SECTION 1: ENVIRONMENT PROVISIONING PROCESS

### 1.1 Bootstrap Sequence

Each environment is provisioned from scratch through a deterministic bootstrap sequence. This sequence MUST be reproducible identically across all environments and ALL TIMES. The bootstrap follows the same phase ordering defined in RTS-002 (Phases 100-106), applied to infrastructure provisioning rather than application startup.

**Bootstrap Phase E-100: Infrastructure Allocation**

1. Allocate network boundary (VPC, subscription, project, or namespace equivalent)
2. Configure network segmentation: public subnet (load balancer), private subnets (application nodes, databases)
3. Create identity boundaries: service accounts, IAM roles, or equivalent per-environment access isolation
4. Reserve DNS entries for the environment (dev.example.com, staging.example.com, prod.example.com, dr.example.com)
5. Verify resource quota and allocation limits are sufficient for the target environment type

**Bootstrap Phase E-101: Shared Services Provisioning**

1. Deploy database cluster according to selected topology pattern (§4 of DEP-SPEC-001)
   - Single Region: single primary instance
   - Multi-AZ: primary + synchronous replica in different AZ
   - Multi-Region Active-Passive: primary in region A, replica in region B
   - Multi-Region Active-Active: primary in each region with cross-region conflict resolution
2. Deploy message bus cluster with partitioned topics and persistent storage
3. Configure file storage buckets/containers with versioning enabled and cross-region replication (if applicable)
4. Deploy or configure secrets vault and create environment-specific secret paths
5. Deploy cache service (in-memory per-node for Dev; remote cluster for Staging/Production)

**Bootstrap Phase E-102: Application Runtime Deployment**

1. Select the artifact version to deploy (per DEP-SPEC-001 §5 versioning rules)
2. Deploy minimum node count based on environment type
3. Configure health check endpoints (/health, /metrics) exposed to orchestration layer
4. Validate that all 15 Runtime Components can initialize successfully by confirming the Phase 106 READY signal
5. Run the persistence schema verification (Phase 102 via PersistenceVerificationPort) against the deployed database — this ensures the Migration Pack compatibility

**Bootstrap Phase E-103: Validation and Go-Live**

1. Execute health check suite (CRT-007 Phase 105): verify all 10 port-level health checks pass
2. Confirm load balancer routing delivers traffic to healthy nodes
3. Run smoke test suite: execute one representative command and one representative query per Application Service (all 13 services per ASS-001)
4. Verify multi-tenant isolation: create two tenant contexts and confirm data separation
5. Mark environment as ACTIVE and add to deployment registry

### 1.2 Provisioning Idempotence

The entire bootstrap sequence MUST be idempotent. Running the provisioning process multiple times against the SAME environment MUST produce the SAME result without creating duplicate resources, conflicting configurations, or orphaned infrastructure.

**Idempotency Mechanisms:**
- All resource creation uses IF NOT EXISTS equivalents
- Configuration updates compare current state before applying changes
- Database migrations use version tracking (each migration applies at most once)
- DNS records updated atomically (old record removed only after new record confirmed healthy)
- Rolling replacement pattern: old nodes drained and removed before new nodes accept traffic

### 1.3 Environment-Specific Bootstrap Variations

| Bootstrap Step | Development | Staging | Production | DR |
|---------------|-------------|---------|------------|-----|
| E-100: Network | Shared dev network | Dedicated staging VPC | Isolated production VPC | Separate region VPC |
| E-101: Database | Embedded file DB | Primary + 1 replica | Topology-dependent | Read replica from Prod |
| E-101: Message Bus | In-memory | Single broker cluster | Clustered brokers | Mirrored read-only |
| E-101: File Storage | Local filesystem | Regional bucket | Cross-region replicated | Cross-region replicated |
| E-101: Secrets Vault | Local env vars | Staging vault paths | Production vault paths | Replicated vault paths |
| E-102: Nodes | 1 instance | 2 instances | 3+ instances | 2+ warm standby |
| E-103: Smoke Tests | Basic CRUD ops | Full 83-operation suite | Full suite + load test | Failover drill |

---

## SECTION 2: DATA STRATEGY PER ENVIRONMENT

### 2.1 Development Data

**Source:** Synthetic seed data generated from schema definitions.

**Strategy:**
- Each developer branch receives a fresh synthetic dataset on checkout
- Seed data generator creates realistic but fake organizational hierarchies (organizations → org units → users → members → transactions)
- Data volume calibrated to test performance characteristics without exposing sensitive patterns
- Typical seed: 1 organization, 3 org units, 10 users (covering all 9 role types across orgs), 50 transactions (split between drafts, pending, approved, rejected, compensated), 20 members, 5 events
- Vocabulary data populated with minimum FR+EN translations for all required namespaces

**Characteristics:**
- No real personal data — all names, emails, and identifiers are synthetic
- Passwords are known test values (documented in local setup guide)
- Authentication may be bypassed locally for development convenience
- Data regenerated on every new branch creation (branch-scoped isolation)
- Automatic cleanup: data purged when development branch is deleted

**Refresh Cycle:** On every branch checkout. No scheduled refresh needed.

### 2.2 Staging Data

**Source:** Production-like synthetic dataset, refreshed weekly.

**Strategy:**
- Dataset mimics production data distribution, volume, and complexity patterns
- All data is synthetic (no real user information, no real financial data)
- Includes edge cases not commonly encountered in development: concurrent modifications, conflict scenarios, deep org unit hierarchies (depth 5), large transaction batches, vocabulary deprecation scenarios
- Covers all 9 RBAC role types across multiple organizations to validate permission enforcement
- Includes audit trail data spanning > 7 years to test retention policy enforcement (RETENTION-031)
- Incorporates real-world conflict patterns: offline-synced operations with timestamp overlaps, compensating transaction scenarios, multi-step workflow approvals

**Data Categories Included:**
- Organizations with full hierarchy (top-level + multi-level org units down to depth 5)
- Users across all role types (superadmin, admin, treasurer, pastor, staff, service_account, readonly, sync_service)
- Financial transactions spanning multiple categories, statuses, approval states
- Pending operations queue (simulating offline sync backlog)
- Workflow instances in various states (pending, approved, rejected, cancelled, compensated)
- Archive entries at all lifecycle stages (archived, trashed, purge-scheduled, purged)
- Form definitions with file upload fields referencing stored attachments
- Notification preferences covering all channel combinations

**Characteristics:**
- Production-scale data volume (configurable: minimum 1K transactions, 100 users, 10 organizations recommended)
- Identical schema as Production (32 tables, all indexes, all constraints active)
- RLS policies fully enforced
- Audit entries with realistic temporal distribution

**Refresh Cycle:** Weekly automated refresh from synthetic data generator. Manual override available for QA cycle alignment.

### 2.3 Production Data

**Source:** Real customer data.

**Strategy:**
- Organic growth through normal application usage
- Regulated by compliance requirements (GDPR, local financial regulations)
- Backed up per topology pattern RPO targets (DEP-SPEC-001 §4)
- Retained minimum 7 years for audit entries (RETENTION-031 constitutionnel)
- Soft-deleted records preserved through lifecycle transitions until purge eligibility

**Sensitive Data Handling:**
- PII stored encrypted at rest (field-level encryption for email, phone, name fields)
- Access to production data restricted to authorized operations personnel only
- Production data NEVER copied to non-production environments directly
- If production-like data is needed for Staging, it MUST pass through anonymization pipeline first

**Anonymization Pipeline (Production → Staging transfer):**
1. Extract production data snapshot
2. Replace all PII fields with synthetically generated equivalents preserving data types and constraints
3. Preserve referential integrity (foreign keys remain valid after anonymization)
4. Validate output against staging schema requirements
5. Load into staging environment

**Refresh Cycle:** Continuous organic growth. Full snapshot backup daily at midnight local time. Incremental WAL-based backups continuous.

### 2.4 Disaster Recovery Data

**Source:** Continuous replication from Production database.

**Strategy:**
- DR data is a LIVE mirror of Production at a configurable replication lag (default < 5 seconds)
- Application nodes in DR region run in PREPARED state (initialized, health-checked, not accepting traffic)
- On failover activation, DR becomes the authoritative source — all subsequent writes route to DR region
- Post-failover: former Production region becomes new DR (role interchange)

**Replication Monitoring:**
- Replication lag measured continuously by CRT-009 Scheduler job
- Alert triggered if lag exceeds threshold (configurable, default 5 seconds, maximum acceptable 60 seconds)
- During high-replication-lag periods, failover is BLOCKED (manual override required)
- Periodic consistency verification compares row counts and checksums between Production and DR

**Characteristics:**
- Same data volume and distribution as Production (minus any writes in progress during last replication window)
- Same schema, same constraints, same RLS policies
- Offline-sync queue independent in DR region (local pending operations accumulate while disconnected from Production)

**Refresh Cycle:** Continuous automatic replication. No manual intervention required under normal operation.

---

## SECTION 3: CONFIGURATION MANAGEMENT

### 3.1 Configuration Architecture

Configuration flows through Lumina via a strictly ordered multi-source mechanism implemented by CRT-005 (ConfigurationLoader). The priority order is immutable and documented in DEP-SPEC-001 §P-005:

```
Priority 1 (highest):  Environment-specific configuration file
Priority 2:            Environment variables
Priority 3 (lowest):   Template default values
```

**Rule:** When the same configuration key exists in multiple sources, the higher-priority source WINS. No merging, no averaging, no conflict resolution beyond this ordinal priority.

### 3.2 Configuration Categories

| Category | Examples | Priority 1 (File) | Priority 2 (Env) | Priority 3 (Default) |
|----------|----------|-------------------|------------------|---------------------|
| Database Connection | host, port, database_name | lumina.staging.json | `LUMINA_DB_HOST` | N/A (required) |
| Authentication | JWT secret path, token TTL | lumina.staging.json | `LUMINA_JWT_SECRET_PATH` | N/A (required) |
| Feature Flags | offline_sync_enabled, notifications_disabled | lumina.production.json | `LUMINA_FF_OFFLINE_SYNC` | true (enabled by default) |
| Performance | health_check_interval_ms, retry_base_delay_ms | lumina.staging.json | `LUMINA_HCI_MS` | 30000 / 100 |
| Notifications | smtp_host, push_api_key_path | lumina.production.json | `LUMINA_SMTP_HOST` | N/A (channel-dependent) |
| Cache | cache_backend_type, redis_url | lumina.production.json | `LUMINA_CACHE_BACKEND` | lru (in-memory) |
| Logging | log_level, log_output_targets | lumina.staging.json | `LUMINA_LOG_LEVEL` | info |
| Security | tls_certificate_path, cipher_suites | lumina.production.json | `LUMINA_TLS_CERT` | N/A (required for Prod) |
| Organization Settings | currency, timezone, accent_color | Organization-level config | Per-org settings | ISO 4217 / UTC / #RRGGBB |

### 3.3 Configuration Key Naming Convention

All configuration keys follow a structured naming pattern:

```
LUMINA_<COMPONENT>_<SETTING>[_VARIANT]
```

Examples:
- `LUMINA_DB_HOST` — database host
- `LUMINA_DB_PORT` — database port
- `LUMINA_RT_HEALTH_CHECK_INTERVAL_MS` — runtime health check interval
- `LUMINA_RT_SHUTDOWN_GRACE_PERIOD_MS` — shutdown grace period
- `LUMINA_NOTIF_SMTP_HOST` — notification SMTP host
- `LUMINA_CACHE_TTL_SECONDS` — cache time-to-live

### 3.4 Configuration Validation (CFG-001/002/003/004)

Every configuration value is validated at load time by CRT-005 (ConfigurationLoader) during Phase 101:

| Invariant | Validation Rule | Example Invalid Value |
|-----------|----------------|----------------------|
| CFG-001 | Currency must be ISO 4217 three-letter code | `USD`, `EUR`, `XAF` (valid); `Dollar`, `USDA`, `` (invalid) |
| CFG-002 | Timezone must be valid IANA timezone name | `Africa/Douala`, `UTC`, `Europe/Paris` (valid); `EST`, `Dakar` (invalid) |
| CFG-003 | Accent color must be hex (#RRGGBB or #RGBA) with WCAG contrast >= 4.5 | `#1B5E20` (valid); `green`, `#GGHHEE`, `#FFF` (invalid — wrong format) |
| CFG-004 | Every setting has a default; null never returned for valid key | Missing key → default value used |

**Validation Error Behavior:** Invalid configuration value → EXIT IMMEDIATELY (E-CONFIG-002). The application does NOT start with invalid configuration. This is by design — starting with invalid configuration risks silent data corruption or security vulnerabilities.

### 3.5 Configuration Deployment

Configuration is NOT baked into the application artifact. It is supplied EXTERNALLY at deployment time through one of these mechanisms:

1. **Environment-specific configuration files** stored in secured configuration store (not in source control)
2. **Environment variables** injected by the orchestration platform at container/process startup
3. **Secret paths** resolved at runtime by the secrets manager (values never exposed in configuration files or environment variable listings)

**Development Exception:** Local development may use a `.env` file or local JSON configuration file that is gitignored (`lumina.development.local.json`). This file MUST NOT be committed to source control and MUST NOT contain any production credentials.

### 3.6 Configuration Change Process

1. Configuration change proposed via infrastructure artifact update
2. Change reviewed for impact (does it affect runtime behavior? does it require restart?)
3. Change applied to configuration store
4. Affected nodes reload configuration gracefully (or restarted if required)
5. Health check confirms new configuration is valid
6. Audit entry written documenting the change (who, when, what changed)

**No Hot-Temperature Configuration Changes:** CRT-005 loads configuration ONCE at startup (Phase 101). Runtime reconfiguration is explicitly supported ("Recharge only si explicitement demande (administrateur)") but requires an administrative action trigger, not automatic detection.

---

## SECTION 4: ACCESS MATRIX

The access matrix defines which roles may access each environment and what level of access they have. Access is enforced at multiple layers: network-level (firewall/VPC), authentication-level (JWT tokens), authorization-level (RBAC via AuthorizationPort), and operational-level (infrastructure console access).

### 4.1 Role Definitions

| Role | Scope | Description |
|------|-------|-------------|
| Developer | All environments | Software engineer working on Lumina features and bug fixes |
| QA Engineer | Staging, Production (read-only) | Quality assurance tester validating releases |
| Product Owner | Staging (read/write), Production (read-only) | Product manager validating features and business logic |
| Operations Engineer | Staging, Production, DR | Infrastructure and deployment management |
| DevOps Engineer | All environments | CI/CD pipeline management, deployment automation |
| Auditor | Production (read-only), Staging (read-only) | Compliance and audit access |
| SuperAdmin | All environments (as application user) | Highest RBAC role within the application |
| External Contractor | Development (isolated branch only) | Third-party contributors with scoped access |

### 4.2 Environment Access Matrix

Legend: `R/W` = Read/Write, `R/O` = Read Only, `None` = No Access, `Depends` = Conditional access

| Role | Development | Staging | Production | DR |
|------|:-----------:|:-------:|:----------:|:--:|
| Developer | R/W | None | None | None |
| QA Engineer | None | R/W | R/O | N/A (standby) |
| Product Owner | None | R/W | R/O | N/A (standby) |
| Operations Engineer | R/O | R/W | R/W | R/W (failover only) |
| DevOps Engineer | R/W | R/W | R/W | R/W |
| Auditor | None | R/O | R/O | R/O (on failover) |
| SuperAdmin (app) | R/W | R/W | R/W | R/W (on failover) |
| External Contractor | R/W (scoped) | None | None | None |

### 4.3 Access Enforcement Layers

**Network Level:**
- Development: accessible from internal developer network + VPN
- Staging: accessible from QA team network + limited VPN range
- Production: accessible ONLY from load balancer; direct node access blocked
- DR: accessible ONLY from operations team VPN; public endpoint inactive until failover

**Authentication Level:**
- All environments require JWT authentication for API access
- Development may support local development mode (token validation bypassed via explicit config flag, NOT default)
- Staging and Production enforce strict token validation (INV-004: org_id resolved exclusively from authenticated session)
- DR inherits Production authentication configuration; tokens remain valid during failover

**Authorization Level:**
- RBAC rules identical across all environments (same role hierarchy: SuperAdmin > Admin > Treasurer > Pastor > Staff per API-CONTRACT-004)
- Permission evaluation via AuthorizationPort (Port-005) — consistent rules regardless of environment
- Wildcard permissions ("*:*:*") always audit-logged (CRITICAL environment: elevated logging)

**Operational Console Level:**
- Infrastructure console access (cloud provider dashboard, database admin tools) restricted to Operations/DevOps roles
- Database direct access (psql, admin panels) blocked in Production except via emergency break-glass procedure
- All operational console access logged in external audit system (outside Lumina application)

### 4.4 Emergency Access Procedures

In exceptional circumstances (Production incident requiring immediate investigation), emergency access procedures apply:

1. Requestor identifies themselves and declares emergency reason
2. Two concurrent authorizations required (on-call Ops lead + DevOps lead)
3. Time-bound access granted (maximum 2 hours, auto-expiring)
4. ALL actions recorded in external audit system (separate from Lumina application audit trail)
5. Post-emergency review conducted within 24 hours
6. Access revoked automatically after timeout; extension requires re-authorization

---

## SECTION 5: ENVIRONMENT LIFECYCLE

### 5.1 Creation Phase

**Trigger:** New environment requested (feature branch creation for Dev, release candidate for Staging, new deployment for Production, DR region initialization).

**Process:**
1. Request submitted with environment type, topology pattern, and resource specifications
2. Automated provisioning executes bootstrap sequence (§1.1)
3. Schema validation (Phase 102) confirms database structure matches canonical 32-table model
4. Health check suite (Phase 105) confirms all 10 port-level health checks pass
5. Environment marked ACTIVE and registered in deployment registry

**Time to Ready:**
- Development: < 5 minutes (single node, embedded DB)
- Staging: < 30 minutes (multi-node, cluster DB)
- Production: < 2 hours (full topology with monitoring)
- DR: < 4 hours (requires Production cross-region replication establishment)

### 5.2 Activation Phase

**Trigger:** Environment passes all creation validations.

**Process:**
1. Load balancer configured to route traffic to active environment
2. DNS entry updated (for externally-facing environments)
3. Monitoring and alerting activated
4. First successful smoke test recorded
5. Environment status changes to ACTIVE in deployment registry

### 5.3 Maintenance Phase

**Ongoing Operations During Maintenance Phase:**

**Configuration Updates:**
- Non-breaking configuration changes applied in-place (no restart required)
- Breaking configuration changes require rolling restart of affected nodes
- All configuration changes logged via CRT-014 AuditEnabler

**Node Scaling:**
- Horizontal scaling triggers based on metrics (request queue depth, latency, CPU/memory)
- New nodes follow the same Phase 100-106 initialization sequence
- Old nodes drained before removal (OR-012 shutdown drain policy)
- Minimum node count enforced at all times (per topology pattern)

**Database Maintenance:**
- Schema changes via Migration Pack (35 sequential migrations, topologically ordered)
- Index rebuilds during low-traffic windows
- Table statistics updated periodically for query optimizer
- Vacuum/maintenance operations scheduled during low-utilization periods

**Secret Rotation:**
- Database passwords rotated per rotation policy (DEP-SPEC-003)
- TLS certificates renewed before expiration (automated)
- JWT signing keys rotated with dual-key overlap period
- All rotations coordinated to minimize service disruption (rolling restart)

**Health Monitoring:**
- Continuous health polling by CRT-007 (configurable interval)
- Degraded state alerts notify Operations team
- Unhealthy state triggers automatic remediation (node restart, connection pool reset)
- Weekly health report generated from Diagnostics (CRT-008) historical data

### 5.4 Decommission Phase

**Triggers:**
- Planned decommission (end-of-life for deprecated feature, cost optimization)
- Emergency decommission (security breach, irrecoverable data corruption)
- Topology change (moving from Single Region to Multi-AZ)

**Process:**
1. Announce decommission with advance notice (minimum 48 hours for Production)
2. Redirect traffic to replacement environment
3. Export and archive all data required by regulatory retention policies (7 years for audit entries)
4. Stop all scheduled jobs (CRT-009 Scheduler graceful stop)
5. Drain and terminate all application nodes (OR-012 shutdown sequence)
6. Terminate shared services (database, message bus, cache, file storage)
7. Release DNS entries and load balancer configurations
8. Revoke all access credentials and service account permissions
9. Write decommission audit entry (CRT-014) documenting what was decommissioned, why, when, and what data was archived
10. Update deployment registry to reflect decommissioned environment

**Rollback of Decommission:** If decommission is aborted during the process, traffic may be restored to the decommissioning environment IF it remains healthy. Data must be verified intact before restoration. If data integrity cannot be guaranteed, full re-provisioning from backup is required.

---

## SECTION 6: ENVIRONMENTS MATRIX TABLE

Comprehensive comparison of all four environment types side by side.

| Attribute | Development | Staging | Production | Disaster Recovery |
|-----------|:-----------:|:-------:|:----------:|:-----------------:|
| **Primary Purpose** | Feature development, local testing | Integration test, QA, UAT | Live customer traffic | Failover target |
| **Runtime Components** | All 15 CRTs (reduced-capacity adapters) | All 15 CRTs (full capacity) | All 15 CRTs (full capacity) | All 15 CRTs (warm standby) |
| **Port Bindings** | 17 Ports with embedded adapters | 17 Ports with clustered adapters | 17 Ports with production adapters | 17 Ports (replicated from Prod) |
| **Application Nodes** | 1 | 2 minimum | 3+ (topology-dependent) | 2+ warm standby |
| **Database** | Embedded file store | Primary + 1 replica | Topology-dependent (see §4) | Read replica (continuous sync) |
| **Event Bus** | In-memory | Single broker cluster | Clustered brokers | Mirrored read-only |
| **Cache** | In-memory LRU (per node) | Remote cache cluster | Remote cache cluster | Cold start (rebuild on failover) |
| **File Storage** | Local filesystem | Regional bucket | Cross-region replicated | Cross-region replicated |
| **Notification Adapters** | Disabled | SMTP test + Push sandbox | All production adapters | All production adapters (replicated) |
| **Configuration Source** | Template defaults + optional local override | Staging config store | Production config store | Replicated from Production |
| **Secrets Resolution** | Local environment variables | Staging secrets vault | Production secrets vault | Replicated vault paths |
| **Monitoring Level** | Minimal (startup health check only) | Full continuous polling | Full continuous polling + alerting | Production-level on standby |
| **Health Check Interval** | Once at startup | Configurable (default 30s) | Configurable (default 30s) | Continuous (same as Production) |
| **Logging Level** | DEBUG | INFO | INFO (with structured JSON) | INFO (separate audit path) |
| **Audit Trail** | Console only (not persisted) | Persisted, standard retention | Persisted, 7-year retention (RETENTION-031) | Separate append path |
| **Retry Policy (CRT-012)** | Full (max 5 retries) | Full (max 5 retries) | Full (max 5 retries) | Full (max 5 retries) |
| **Idempotency Window** | 1 minute | 5 minutes | 5 minutes | 5 minutes (from Prod config) |
| **Data Source** | Synthetic seed per branch | Production-like synthetic | Real production data | Continuous replication from Prod |
| **Data Refresh Cycle** | On branch checkout | Weekly (synthetic refresh) | Continuous organic growth | Continuous replication |
| **Access Control** | Team-wide, auth may be bypassed | QA + Product Owners | Strict RBAC (all roles) | Operations team (failover only) |
| **RBAC Enforcement** | Optional (dev mode) | Full enforcement | Full enforcement | Full enforcement (on failover) |
| **Multi-Tenant Isolation** | Best-effort (single org typical) | Full INV-004 enforcement | Full INV-004 enforcement | Full INV-004 enforcement |
| **Offline Sync** | Enabled (local push simulated) | Enabled (push to test endpoint) | Enabled (push to remote clients) | Enabled (local queue accumulates) |
| **Schema Migrations** | Auto-create tables | Via Migration Pack | Via Migration Pack (careful scheduling) | Via Migration Pack (copy from Prod) |
| **Backups** | Not required | Daily | Continuous WAL + daily full snapshot | Continuous replication from Prod |
| **RTO Target** | N/A | < 1 hour | Topology-dependent (< 4h to near-0) | Failover target (inherits Prod RTO) |
| **RPO Target** | N/A | < 1 hour | Topology-dependent (< 1h to near-0) | Inherits Prod RPO (replication lag) |
| **Node Count Min** | 1 | 2 | 3 | 2 (standby) |
| **Node Count Max** | 1 (single instance) | 10 (auto-scale) | 50+ (auto-scale) | Scaled to handle Prod failover load |
| **Feature Flags** | All enabled typically | Mirror Production | Production configuration | Mirrors Production |
| **DNS Entry** | dev-{branch}.lumina.internal | staging.lumina.internal | prod.lumina.internal | dr.lumina.internal (inactive) |
| **TLS Certificate** | Self-signed (dev mode) | Internal CA | Public CA (automated renewal) | Replicated from Production |
| **Health Probes** | Startup only | liveness + readiness | liveness + readiness + startup | liveness + readiness (standby) |
| **Incident Response** | Developer resolves locally | On-call ops escalation | Tiered incident response | Drills quarterly |
| **Cost Profile** | Minimal | Moderate | Highest | Moderate (half of Production) |
| **Decommission Frequency** | On branch delete | Per sprint cycle | Rare (planned only) | On topology rebuild |
| **Migration Pack Required** | No (embedded schema) | Yes | Yes | Yes (copied from Production) |
| **Bootstrap Verification** | Quick CRUD smoke tests | Full 83-operation suite | Full suite + load test + failover drill | Failover simulation |

---

## SECTION 7: ENVIRONMENT ISOLATION GUARANTEES

### 7.1 Network Isolation

Each environment MUST operate within its own network boundary. Cross-environment network access is:
- **Prohibited** between Production and all other environments by default
- **Allowed** from Development → Staging for integration testing (one-way, read-only API calls)
- **Allowed** from Staging → Production is NEVER permitted (data flow only goes Production → Staging via anonymized export)
- **Required** between Production → DR for continuous replication

### 7.2 Data Isolation

- **Never write Production data to Development or Staging** without anonymization
- **Never write non-production data to Production** (even for debugging — use synthetic data)
- **DR data is a copy of Production** — treated as Production-equivalent for compliance purposes
- Each environment's database has independent credentials, independent connection pool configuration, and independent schema version tracking

### 7.3 Credential Isolation

- Separate secrets vault paths per environment: `/secrets/dev/lumina`, `/secrets/staging/lumina`, `/secrets/prod/lumina`
- No credential reuse across environments
- Database passwords different per environment even for identical schema
- JWT signing keys different per environment
- SMTP credentials different per environment

### 7.4 DNS Isolation

- Each environment has unique DNS entries
- No DNS entry points to more than one environment at a time
- DNS failover (Production → DR) switches exactly one entry

---

## HISTORIQUE

| Version | Date | Auteur | Modification | Validation |
|---------|------|--------|-------------|------------|
| 1.0 | 2026-07-25 | deployment-specifier v1.0 | Creation — Environment Strategy for Lumina v1: provisioning process, data strategy, configuration management, access matrix, lifecycle, comprehensive comparison table | COMPLIANT (verified against RTS-001 components, RTS-002 phases, RTS-003 OR-011/OR-012 determinism rules, ASS-001 83 operations coverage per environment, PAS-001 17 Port binding requirements, INV-004 multi-tenant isolation) |

---

*Ce document definit la strategie d'environnements pour Lumina. Il ne specifie aucune technologie concrete (pas de Terraform, pas de Kubernetes, pas de scripts de provisionnement). Les details d'implementation sont determines par les choix d'infrastructure-as-code separes.*
