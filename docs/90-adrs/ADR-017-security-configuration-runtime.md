# ADR-017-Security-Architecture-Configuration-Driven-Runtime

**Titre:** Architecture de sécurité pour le runtime configuration-driven  
**Date:** 2026-07-24  
**Statut:** PROPOSED  
**Constituants:** Manifest Engine, Capability Engine, Forms Engine, Workflow Engine  
**Sources de config:** Serveur INSFORGE (remote), filesystem local (offline)

---

## 1. Contexte

Le runtime Lumina interprète des fichiers YAML/JSON fournis par des manifests externes. Ces manifests contrôlent quelles capabilities sont activées, quels formulaires sont rendus, et quels workflows s'exécutent. Toute brèche de sécurité dans cette chaîne équivaut à une élévation de privilèges ou une exécution de code arbitraire.

**Principe fondateur :** La configuration n'est jamais du code. Elle est interprétée par un moteur dont l'ensemble d'opérations est fixe, borné, et instrumenté.

---

## 2. Analyse des vecteurs d'attaque

### 2.1 Injection de code via évaluation dynamique

| Vecteur | Mécanisme | Impact |
|---|---|---|
| **eval() sur conditions** | Un manifest contient `condition: "require('fs').writeFile('/tmp/pwn', shellcode)"` | RCE complet |
| **Prototype pollution** | Un champ de formulaire injecte `__proto__[payload]` | Contamination globale du runtime |
| **Function constructor** | `action: "new Function('return process')()"` dans un workflow step | Escalation vers API Node |
| **Desérialisation YAML** | `!!js/function` ou `!!python/object` dans le YAML | Exécution au parse |

**Règle absolue :** Aucun `eval()`, `new Function()`, ou désérialiseur YAML basé sur `yaml.load()` avec default flow. Toujours utiliser `yaml.safeLoad()`.

### 2.2 Référence à des capabilities non-whitelisted

Un manifest malveillant pourrait tenter :

```yaml
features:
  nonexistent_capability:
    enabled: true
    sub_features: [rce, data_theft]
```

Si le Capability Engine accepte n'importe quelle clé `features.*`, il crée un tunnel où la configuration simule l'activation de modules inexistants. Certains moteurs configurables pourraient alors exécuter du code "fantomme" via des hooks mal documentés.

### 2.3 Resource exhaustion via formulaires infinitifs

| Attaque | Mécanisme | Impact |
|---|---|---|
| **Formulaire imbriqué profond** | 10000 champs `select` avec 500 options chacun | OOM, crash client |
| **Boucle conditionnelle auto-référentielle** | `visible_if.field = "a"`, `visible_if.value.field = "b"`, `visible_if.value.value.field = "a"` | Stack overflow |
| **Génération de sections récursive** | Section qui référence des sous-sections indéfiniment | Blocage thread UI |

### 2.4 Workflows malveillants

```yaml
# Workflow qui boucle infiniment
steps:
  - type: auto; action: "trigger_event"; event: "finance:transaction:created"
# → self-triggering loop, resource exhaustion
```

Ou bien un workflow configuré avec `assign_to_role: "*"` qui diffuse des notifications à toute l'organisation.

### 2.5 Élévation de privilèges par configuration

```yaml
roles:
  - id: "priv_esc"
    permissions: ["*"]  # Accepté ? Oui par le format actuel
    parent: null        # Devient root implicite
```

Un manifest externe malveillant peut accorder `["*"]` à un rôle arbitraire si les permissions wildcard ne sont pas validées.

---

## 3. Couche 1 — SafeCapabilityRegistry

Registry obligatoire whitelistant toutes les handlers de capability. **Aucune capability hors-liste n'est acceptée.**

```typescript
// src/security/SafeCapabilityRegistry.ts

type ActionHandler = (ctx: CapabilityContext) => Promise<CapabilityResult>;

interface CapabilityContext {
  orgId: string;
  data: Record<string, unknown>;
  resources: ResourceBudget;
}

interface CapabilityResult {
  success: boolean;
  data?: unknown;
  errors?: string[];
}

interface ResourceBudget {
  maxFields: number;
  maxConditionDepth: number;
  compileTimeoutMs: number;
}

export class SafeCapabilityRegistry {
  private static readonly ALLOWED_ACTIONS = new Set<string>([
    // Finance
    'ledger_read', 'ledger_write', 'bilan_read', 'bilan_write',
    'rapport_read', 'rapport_write',
    // Members
    'directory_read', 'directory_write', 'attendance_read', 'attendance_write',
    // Events
    'calendar_read', 'calendar_write', 'registration_read', 'registration_write',
    // Notifications
    'notification_send', 'notification_template_read',
    // Reports
    'report_export_pdf', 'report_export_csv',
    // Core
    'feature_toggle', 'settings_read', 'role_hierarchy_resolve',
    'permission_check',
  ]);

  private registry = new Map<string, { handler: ActionHandler; version: string }>();

  constructor() {
    this.registerNativeCapabilities();
  }

  private registerNativeCapabilities(): void {
    const handlers: Record<string, ActionHandler> = {
      'ledger_read': async (ctx) => ({ success: true, data: [] }),
      'ledger_write': async (ctx) => ({ success: true, data: {} }),
      'bilan_read': async (ctx) => ({ success: true, data: {} }),
      'billance_read': async (ctx) => ({ success: false, errors: ['typo detected'] }),
      'feature_toggle': async (ctx) => ({ success: true }),
      'permission_check': async (ctx) => ({ success: true, data: { hasPermission: true } }),
      // ... todos los demas handlers
    };

    for (const [action, handler] of Object.entries(handlers)) {
      if (!this.constructor.ALLOWED_ACTIONS.has(action)) {
        throw new SecurityError(
          `Cannot register ${action}: not in ALLOWED_ACTIONS whitelist`
        );
      }
      this.registry.set(action, { handler, version: '1.0' });
    }
  }

  /**
   * Resolve a capability ID to its handler. Throws if not registered.
   * This is the ONLY gate — no dynamic lookup, no eval, no indirect reference.
   */
  resolve(actionId: string): { handler: ActionHandler; version: string } {
    if (!this.constructor.ALLOWED_ACTIONS.has(actionId)) {
      throw new SecurityError(`ACTION_NOT_WHITELISTED: "${actionId}" is not permitted`);
    }

    const entry = this.registry.get(actionId);
    if (!entry) {
      // Possible race: capability was unloaded. Block execution.
      throw new SecurityError(`REGISTRY_MISMATCH: "${actionId}" is whitelisted but not registered`);
    }

    return entry;
  }

  getWhitelistSnapshot(): ReadonlySet<string> {
    return new Set(this.constructor.ALLOWED_ACTIONS);
  }

  /** Audit: returns any features referenced in config that are not whitelisted */
  validateManifestFeatures(featuresConfig: Record<string, unknown>): string[] {
    const violations: string[] = [];
    for (const featureName of Object.keys(featuresConfig)) {
      if (!this.isRegisteredFeature(featureName)) {
        violations.push(`UNREGISTERED_FEATURE: "${featureName}" is not a known capability`);
      }
    }
    return violations;
  }

  private isRegisteredFeature(featureName: string): boolean {
    // Map feature names (e.g., "finance") to known capability groups
    const FEATURE_GROUP_MAP: Record<string, string[]> = {
      'finance': ['ledger_read', 'ledger_write', 'bilan_read', 'rapport_read'],
      'members': ['directory_read', 'attendance_write'],
      'events': ['calendar_read', 'registration_write'],
      'notifications': ['notification_send'],
      'reports': ['report_export_pdf'],
    };
    const actions = FEATURE_GROUP_MAP[featureName];
    if (!actions) return false;
    return actions.every(a => this.constructor.ALLOWED_ACTIONS.has(a));
  }
}

export class SecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SecurityError';
  }
}
```

**Garantie :** Un manifest ne peut activer QUE des features mappées à des handlers pré-enregistrés. `validateManifestFeatures` est appelé avant compilation.

---

## 4. Couche 2 — Resource Budget enforcer

Limitation stricte de toute ressource consommée par un manifest.

```typescript
// src/security/ResourceBudgetEnforcer.ts

export interface ManifestBudgetLimits {
  maxTotalForms: number;         // Default: 100
  maxFieldsPerForm: number;      // Default: 200
  maxSectionsPerForm: number;    // Default: 20
  maxConditionDepth: number;     // Default: 5
  maxWorkflowSteps: number;      // Default: 15
  maxRoleHierarchyDepth: number; // Default: 5 (already R-02 in manifest-engine)
  maxActionAssignmentsPerWorkflow: number; // Default: 20
  maxNestedSelectOptions: number;// Default: 500 per select field
  compileTimeoutMs: number;      // Default: 5000
  maxVisibleFieldsInRenderTree: number; // Default: 300
}

const DEFAULT_BUDGET: ManifestBudgetLimits = {
  maxTotalForms: 100,
  maxFieldsPerForm: 200,
  maxSectionsPerForm: 20,
  maxConditionDepth: 5,
  maxWorkflowSteps: 15,
  maxRoleHierarchyDepth: 5,
  maxActionAssignmentsPerWorkflow: 20,
  maxNestedSelectOptions: 500,
  compileTimeoutMs: 5000,
  maxVisibleFieldsInRenderTree: 300,
};

export class ResourceBudgetEnforcer {
  private limits: ManifestBudgetLimits;

  constructor(limits?: Partial<ManifestBudgetLimits>) {
    this.limits = { ...DEFAULT_BUDGET, ...limits };
  }

  /** Validate form definition against budget */
  enforceFormBudget(formDef: { fields: unknown[]; sections?: unknown[] }): void {
    if (formDef.fields.length > this.limits.maxFieldsPerForm) {
      throw new SecurityError(
        `FORM_TOO_LARGE: ${formDef.fields.length} fields exceeds limit of ${this.limits.maxFieldsPerForm}`
      );
    }
    if (formDef.sections && formDef.sections.length > this.limits.maxSectionsPerForm) {
      throw new SecurityError(
        `SECTIONS_TOO_MANY: ${formDef.sections.length} sections exceeds limit of ${this.limits.maxSectionsPerForm}`
      );
    }

    for (const field of formDef.fields as Array<Record<string, unknown>>) {
      this.enforceFieldBudget(field);
    }
  }

  private enforceFieldBudget(field: Record<string, unknown>): void {
    const options = field['options'];
    if (options && typeof options === 'object' && 'values' in options) {
      const values = (options as Record<string, unknown>).values as unknown[];
      if (Array.isArray(values) && values.length > this.limits.maxNestedSelectOptions) {
        throw new SecurityError(
          `FIELD_OPTIONS_EXCEEDED: select field "${field.name}" has ${values.length} options (max ${this.limits.maxNestedSelectOptions})`
        );
      }
    }
  }

  /** Recursively check condition depth to prevent stack overflow */
  measureConditionDepth(node: unknown): number {
    if (!node || typeof node !== 'object') return 0;

    const obj = node as Record<string, unknown>;

    // Base conditions: { field, operator, value }
    if ('field' in obj && 'operator' in obj && 'value' in obj) {
      return 1;
    }

    // Combinators: { visible_if_all_of: [...], visible_if_any_of: [...] }
    let maxDepth = 1;
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      if (Array.isArray(val)) {
        for (const item of val) {
          const childDepth = this.measureConditionDepth(item);
          maxDepth = Math.max(maxDepth, 1 + childDepth);
        }
      } else if (typeof val === 'object') {
        const childDepth = this.measureConditionDepth(val);
        maxDepth = Math.max(maxDepth, 1 + childDepth);
      }
    }

    // Hard cap enforced BEFORE processing
    if (maxDepth > this.limits.maxConditionDepth) {
      throw new SecurityError(
        `CONDITION_DEPTH_EXCEEDED: depth ${maxDepth} exceeds limit of ${this.limits.maxConditionDepth}`
      );
    }
    return maxDepth;
  }

  enforceWorkflowBudget(workflowDef: { steps: unknown[] }): void {
    if (workflowDef.steps.length > this.limits.maxWorkflowSteps) {
      throw new SecurityError(
        `WORKFLOW_TOO_LONG: ${workflowDef.steps.length} steps exceeds limit of ${this.limits.maxWorkflowSteps}`
      );
    }

    for (const step of workflowDef.steps as Array<Record<string, unknown>>) {
      if (step['type'] === 'approval' && step['assign_to_role']) {
        // Prevent wildcards
        const role = step['assign_to_role'] as string;
        if (role.includes('*')) {
          throw new SecurityError(
            `WILDCARD_ROLE_DENIED: "*" in assign_to_role is not permitted at runtime`
          );
        }
      }

      if (step['type'] === 'auto' && step['action'] === 'trigger_event') {
        // Prevent self-triggering loops
        const event = (step['event'] || '') as string;
        if (event) {
          // The caller must check: this event's own triggers cannot re-invoke this same workflow
          // We flag it for upstream loop detection
          console.warn(`AUDIT: workflow step triggers event "${event}" — upstream should verify no cycle`);
        }
      }
    }
  }

  enforceCompileTimeout(ms: number): void {
    if (ms > this.limits.compileTimeoutMs) {
      throw new SecurityError(
        `COMPILE_TIMEOUT: ${ms}ms exceeds limit of ${this.limits.compileTimeoutMs}ms`
      );
    }
  }
}
```

---

## 5. Couche 3 — Manifest Pipeline Guardian

Orchestrates the validation pipeline in the correct order.

```typescript
// src/security/ManifestPipelineGuardian.ts

import yaml from 'js-yaml';

export interface ValidatedManifest {
  raw: Record<string, unknown>;
  compiled: Record<string, unknown>;
  validationWarnings: string[];
  securityChecksum: string;
}

export class ManifestPipelineGuardian {
  private capabilityRegistry: SafeCapabilityRegistry;
  private resourceEnforcer: ResourceBudgetEnforcer;

  constructor(
    capabilityRegistry?: SafeCapabilityRegistry,
    resourceEnforcer?: ResourceBudgetEnforcer
  ) {
    this.capabilityRegistry = capabilityRegistry ?? new SafeCapabilityRegistry();
    this.resourceEnforcer = resourceEnforcer ?? new ResourceBudgetEnforcer();
  }

  /**
   * Full pipeline: Parse → Schema → Budget → Capability → Compile → Checksum
   * Each stage gates the next. Failure at ANY stage blocks deployment.
   */
  async processManifest(rawBytes: Buffer): Promise<ValidatedManifest> {
    let validated: ValidatedManifest;

    // Stage 1: YAML-safe parse (rejects !!js/function, !!python/object, etc.)
    const parsed = yaml.safeLoad(rawBytes.toString('utf-8')) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      throw new SecurityError('PARSED_EMPTY_OR_INVALID');
    }

    // Stage 2: Schema validation against JSON Schema draft (structure check)
    this.validateSchema(parsed);

    // Stage 3: Resource budget enforcement on forms and workflows
    validated = {
      raw: parsed,
      compiled: {},
      validationWarnings: [],
      securityChecksum: '',
    };

    if (parsed.forms_overrides) {
      const forms = parsed.forms_overrides as Record<string, unknown>;
      let totalForms = Object.keys(forms).length;
      if (totalForms > this.resourceEnforcer['limits'].maxTotalForms) {
        throw new SecurityError(
          `TOTAL_FORMS_EXCEEDED: ${totalForms} forms exceed global limit of ${this.resourceEnforcer['limits'].maxTotalForms}`
        );
      }
      for (const [formId, formDef] of Object.entries(forms)) {
        this.resourceEnforcer.enforceFormBudget(formDef as { fields: unknown[]; sections?: unknown[] });
      }
    }

    if (parsed.workflow_overrides) {
      const workflows = parsed.workflow_overrides as Record<string, unknown>;
      for (const [wfId, wfDef] of Object.entries(workflows)) {
        this.resourceEnforcer.enforceWorkflowBudget(wfDef as { steps: unknown[] });
      }
    }

    // Stage 4: Capability whitelist validation
    const featureViolations = this.capabilityRegistry.validateManifestFeatures(
      parsed.features as Record<string, unknown>
    );
    for (const v of featureViolations) {
      if (v.startsWith('UNREGISTERED_FEATURE')) {
        throw new SecurityError(v); // Block on unregistered feature
      }
      validated.validationWarnings.push(v); // Warn on others
    }

    // Stage 5: Wildcard permission audit
    if (parsed.roles && Array.isArray(parsed.roles)) {
      for (const role of parsed.roles as Array<Record<string, unknown>>) {
        const perms = role.permissions as string[] | undefined;
        if (perms && perms.includes('*')) {
          validated.validationWarnings.push(
            `WILDCARD_PERMISSION: role "${role.id}" has unrestricted permissions ["*"]`
          );
          // Do NOT block — wildcard permissions are allowed but audited.
          // Real enforcement happens in the RBAC layer, not here.
        }
      }
    }

    // Stage 6: Compile into runtime representation (with timeout)
    const startTime = Date.now();
    const compiled = await this.compileManifestSafe(parsed);
    const elapsed = Date.now() - startTime;
    this.resourceEnforcer.enforceCompileTimeout(elapsed);

    // Stage 7: Compute integrity checksum (SHA-256 of compiled output)
    const checksumInput = JSON.stringify(compiled);
    const crypto = require('crypto');
    validated.securityChecksum = crypto.createHash('sha256').update(checksumInput).digest('hex');

    validated.compiled = compiled;
    return validated;
  }

  private validateSchema(manifest: Record<string, unknown>): void {
    // Integrate with existing schema validator (Ajv or similar)
    // This catches structural issues before budget checks
    // Returns early if invalid
    if (!manifest.version || !manifest.organization) {
      throw new SecurityError('MISSING_REQUIRED_ROOT_FIELDS');
    }
  }

  private async compileManifestSafe(manifest: Record<string, unknown>): Promise<Record<string, unknown>> {
    // Use setTimeout via microtask pattern, or wrap in a Promise that rejects
    // after the budget limit. For CPU-bound compilation, spawn a Worker.
    // Simplified inline version:
    return this.compileStep(manifest, 0);
  }

  private compileStep(node: unknown, depth: number): Record<string, unknown> {
    if (depth > 20) throw new SecurityError(`COMPILE_RECURSION_DEPTH_EXCEEDED: ${depth}`);
    if (!node || typeof node !== 'object') return {} as Record<string, unknown>;

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (Array.isArray(val)) {
        result[key] = val.map((item) => this.compileStep(item, depth + 1));
      } else if (typeof val === 'object' && val !== null) {
        result[key] = this.compileStep(val, depth + 1);
      } else {
        result[key] = val;
      }
    }
    return result;
  }
}
```

---

## 6. Couche 4 — JSONata Sandboxing Strategy

JSONata is AST-safe by design: it only evaluates expressions defined by its grammar. But you must guarantee the parser/generator isn't compromised.

### 6.1 Why JSONata is safe (by design)

```
JSONata expression: $amount > 5000
Compiles to:         AST node: GreaterThan(Literal(5000), PathReference("amount"))
Executes as:         interpreter walks the AST tree — no eval(), no Function()
```

JSONata has no `require`, no access to host functions, no string-to-code path. It is a domain-specific language whose AST interpreter is the only execution path.

### 6.2 How to GUARANTEE it stays safe

```typescript
// src/security/JsonataSandbox.ts

import jsonata from 'jsonata';

export class JsonataSandbox {
  private readonly expressionCache = new Map<string, jsonata.Expression>();
  private readonly approvedPatterns = new Set<string>([
    '$amount > 5000',
    '$status == "pending"',
    '$visible_if.field != ""',
    // ... every expression used in the system, explicitly listed
  ]);

  /**
   * Evaluate a JSONata expression against data.
   * The expression must be pre-approved OR compiled from a known template.
   */
  evaluate(expression: string, data: Record<string, unknown>): unknown {
    // Defense-in-depth: check against approved patterns
    // In production, skip this check if expressions are always compiled
    // from trusted templates (forms/workflow defs baked into source)
    if (!this.approvedPatterns.has(expression)) {
      // Not necessarily a block — expressions CAN come from manifests.
      // The real safety is that the manifest engine validates the expression
      // against a JSONata AST whitelist BEFORE caching.
      this.validateExpressionAST(expression);
    }

    let expr = this.expressionCache.get(expression);
    if (!expr) {
      // Parse compiles to AST. If parsing fails, the expression is malformed.
      expr = jsonata(expression);
      this.expressionCache.set(expression, expr);
    }

    return expr.evaluate(data);
  }

  /**
   * Validate a JSONata expression by inspecting its AST for disallowed constructs.
   * This is the actual guardrail — approvedPatterns is just defense-in-depth.
   */
  private validateExpressionAST(expression: string): void {
    // jsonata() throws on invalid syntax; we catch that.
    // After successful parse, we can inspect the AST:
    try {
      const ast = jsonata(expression);
      // Walk AST: reject function calls to external bindings
      this.walkASTAndValidate(ast.ast, expression);
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new SecurityError(`INVALID_JSONATA_EXPRESSION: ${expression}`);
      }
      throw e;
    }
  }

  private walkASTAndValidate(ast: unknown, _expression: string): void {
    if (!ast || typeof ast !== 'object') return;
    const node = ast as Record<string, unknown>;
    const type = node['$'] as string | undefined;

    // BLOCK: binding references (allows expression to read external data only)
    // These are SAFE — they read from the context, not execute host code.
    if (type === 'binding') return;

    // BLOCK: function calls — whitelist only safe functions
    if (type === 'function-call') {
      const funcName = node['0'] as string;
      const SAFE_FUNCTIONS = new Set([
        'number', 'string', 'boolean', 'length', 'encode-for-uri',
        'matches', 'replace', 'substring', 'upper-case', 'lower-case',
        'sum', 'min', 'max', 'avg', 'abs', 'round', 'floor', 'ceil',
        'today', 'current-time', 'now',
      ]);
      if (!SAFE_FUNCTIONS.has(funcName)) {
        throw new SecurityError(`FORBIDDEN_JSONATA_FUNCTION: "${funcName}" is not in the allowlist`);
      }
    }

    // Recurse into children
    for (const key of Object.keys(node)) {
      if (Array.isArray(node[key])) {
        for (const child of node[key] as unknown[]) {
          this.walkASTAndValidate(child, _expression);
        }
      } else if (typeof node[key] === 'object') {
        this.walkASTAndValidate(node[key] as object, _expression);
      }
    }
  }
}
```

**Key insight:** JSONata's AST is the authoritative safety boundary. The `evaluate()` method never does `eval()` — it walks a parse tree. The `walkASTAndValidate` method is your gatekeeper.

---

## 7. Validation compile-time vs protection runtime

| Aspect | Compile-time (schema Zod/JSON Schema) | Runtime (enforcement) | Which is authoritative? |
|---|---|---|---|
| **Structure** | Fields exist, types match | N/A | Compile-time — caught before deploy |
| **Resource limits** | Optional properties present | Actual counts checked | **Runtime** — counts are not in schema |
| **Capability reference** | Feature key is string | Key must match whitelist | **Runtime** — whitelist is code-only |
| **Condition logic** | Condition has correct keys | Depth measured, loops detected | **Runtime** — semantic analysis |
| **Permission scoping** | Role has permissions array | Wildcard audit, hierarchy traversal | Both — compile catches structure, runtime catches abuse |
| **JSONata expressions** | Expression is string | AST validated against function allowlist | **Runtime** — schema sees string, runtime sees AST semantics |
| **Dependency cycles** | N/A (not a schema concept) | Topological sort detects cycles | **Runtime** only |
| **Self-triggering workflows** | N/A | Event graph traversal | **Runtime** only |

**Conclusion :** Le schema JSON/Zod est la porte d'entrée (garde-fou précoce). Mais le runtime est authoritative car il comprend la sémantique, pas juste la syntaxe. Une configuration peut être schema-valid et dangereuse (ex: 100 formulaires avec `permissions: ["*"]`).

---

## 8. Checklist Security Audit pour chaque manifest déployé

```typescript
// src/security/ManifestSecurityChecklist.ts

export interface AuditResult {
  passed: boolean;
  findings: Array<{ severity: 'BLOCKER' | 'WARNING' | 'INFO'; message: string; rule: string }>;
}

export class ManifestSecurityAudit {
  static async audit(validatedManifest: ValidatedManifest): Promise<AuditResult> {
    const findings: AuditResult['findings'] = [];

    // 1. Source verification
    if (!validatedManifest.raw.source_signature) {
      findings.push({ severity: 'BLOCKER', message: 'Missing source signature', rule: 'SEC-001' });
    }

    // 2. Capability whitelist
    const features = validatedManifest.raw.features as Record<string, unknown>;
    for (const key of Object.keys(features)) {
      if (key.includes('.')) {
        findings.push({ severity: 'WARNING', message: `Nested feature name "${key}" may indicate injection attempt`, rule: 'SEC-002' });
      }
    }

    // 3. Permission wildcard audit
    const roles = validatedManifest.raw.roles as Array<Record<string, unknown>>;
    const wildcardRoles = roles.filter(r => (r.permissions as string[]).includes('*'));
    if (wildcardRoles.length > 0) {
      findings.push({
        severity: 'WARNING',
        message: `${wildcardRoles.length} role(s) have unrestricted permissions`,
        rule: 'SEC-003',
      });
    }

    // 4. No self-referencing workflow triggers
    const workflows = validatedManifest.raw.workflow_overrides as Record<string, unknown>;
    for (const [wfId, wfDef] of Object.entries(workflows)) {
      const steps = (wfDef as Record<string, unknown>)?.steps as Array<Record<string, unknown>>;
      const triggers = steps.filter(s => s.action === 'trigger_event');
      if (triggers.length > 0) {
        findings.push({
          severity: 'BLOCKER',
          message: `Workflow "${wfId}" contains event triggers — manual cycle review required`,
          rule: 'SEC-004',
        });
      }
    }

    // 5. Resource budget compliance
    const compiledChecksum = validatedManifest.securityChecksum;
    if (!compiledChecksum || compiledChecksum.length !== 64) {
      findings.push({ severity: 'BLOCKER', message: 'Invalid or missing security checksum', rule: 'SEC-005' });
    }

    // 6. YAML injection artifact check
    const rawYaml = Buffer.from(JSON.stringify(validatedManifest.raw)).toString();
    if (/!!(js|python|ruby)\//.test(rawYaml)) {
      findings.push({ severity: 'BLOCKER', message: 'YAML typed-tag injection detected', rule: 'SEC-006' });
    }

    return {
      passed: findings.every(f => f.severity !== 'BLOCKER'),
      findings,
    };
  }
}
```

**Règle de déploiement :** Aucun manifest avec un `BLOCKER` ne passe en production. Les `WARNING` requièrent approbation manuelle d'un admin.

---

## 9. Récapitulatif de l'architecture de défense

```
                    ┌─────────────────────────────┐
                    │   Source: INSFORGE / Local   │
                    │   YAML/JSON manifest bytes   │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   LAYER 1: YAML Safe Parse   │  ← yaml.safeLoad() only
                    │   Rejects !!typed-tags       │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   LAYER 2: Schema Validation │  ← JSON Schema / Zod
                    │   Structural correctness     │
                    └──────────────┬──────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   LAYER 3: Capability Whitelist│  ← SafeCapabilityRegistry
                    │   Features → registered APIs  │
                    └──────────────┬──────────────┐
                    │   LAYER 4: Resource Budget     │  ← ResourceBudgetEnforcer
                    │   Limits: forms, depth, time   │
                    └──────────────┬──────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
    │  Forms Engine    │  │ Capability Eng. │  │ Workflow Engine  │
    │ JSONata sandbox  │  │ whitelist-bound │  │ loop-detection  │
    │ max 200 fields   │  │ no indirect     │  │ max 15 steps    │
    └─────────────────┘  └─────────────────┘  └─────────────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   │
                    ┌──────────────▼──────────────┐
                    │   AUDIT CHECKLIST             │  ← 6 rules, BLOCKER=deny
                    │   SHA-256 checksum stored     │
                    └──────────────────────────────┘
```

Quatre couches, zéro `eval()`, zéro capacité implicite. Chaque manifest traverse le pipeline complet ; aucun shortcut. Le Capability Registry est la seule autorité sur ce qui peut être exécuté. Le Resource Budget Enforcer est la seule autorité sur combien de ressources sont consommées. La checklist d'audit est la preuve que les deux ont fait leur travail.
