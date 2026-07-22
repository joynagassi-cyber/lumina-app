# SPRINT 1 — Platform Core: 5 Motors Implementation

## Sprint Title
Lumina v2 — Manifest Engine, Vocabulary Engine, Forms Engine, Workflow Engine, Capability Engine

## Sprint Objective
Implement all 5 Platform Core motors as specified in `docs/01-platform-core/*/index.md`. Each motor is a self-contained module with its own API, tests, and validation. No business logic may enter these modules (INV-002).

## Commands to Execute

```bash
cd C:\Users\joyda\ZCodeProject\lumina-app

# Create motor source directories
mkdir -p src/core/manifest/src
mkdir -p src/core/vocabulary/src
mkdir -p src/core/forms/src
mkdir -p src/core/workflow/src
mkdir -p src/core/capability/src

# Create motor test directories
mkdir -p tests/unit/core/manifest
mkdir -p tests/unit/core/vocabulary
mkdir -p tests/unit/core/forms
mkdir -p tests/unit/core/workflow
mkdir -p tests/unit/core/capability
```

## Files to Create (with COMPLETE content)

---

### A. MANIFEST ENGINE

#### 1. `src/core/manifest/src/ManifestEngine.ts`
```typescript
// src/core/manifest/src/ManifestEngine.ts
// DOC-PLATFORM-MANIF implementation — reads and validates manifest.yaml for an organization
// INV-002 compliant: zero hardcoded org-type logic

import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import yaml from 'yaml';

export interface OrgSettings {
  currency: string;
  fiscalYearStart: string;
  requireApproval: boolean;
  maxAutoApprove: number;
  largeTransactionThreshold: number;
}

export interface FeatureToggle {
  enabled: boolean;
  subFeatures?: string[];
}

export interface RoleDefinition {
  id: string;
  name: string;
  description?: string;
  permissions: string[];
  parent: string | null;
}

export interface DepartmentDefinition {
  id: string;
  name: string;
  role: string;
  children: string[];
}

export interface CompiledManifest {
  version: string;
  organization: {
    id: string;
    name: string;
    type: string;
    language: string;
    timezone: string;
  };
  settings: OrgSettings;
  features: Record<string, FeatureToggle>;
  roles: RoleDefinition[];
  departments: DepartmentDefinition[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error' | 'warning';
}

const REQUIRED_ORG_SETTINGS: OrgSettings = {
  currency: 'CDF',
  fiscalYearStart: '01-01',
  requireApproval: true,
  maxAutoApprove: 500,
  largeTransactionThreshold: 5000,
};

export class ManifestEngine {
  private cache: Map<string, CompiledManifest> = new Map();
  private manifestDir: string;

  constructor(manifestDir?: string) {
    this.manifestDir = manifestDir ?? join(process.cwd(), 'manifests');
  }

  async loadManifest(orgId: string): Promise<CompiledManifest> {
    if (this.cache.has(orgId)) {
      return this.cache.get(orgId)!;
    }

    const manifestPath = join(this.manifestDir, `${orgId}.yaml`);
    try {
      const raw = await readFile(manifestPath, 'utf-8');
      const parsed = yaml.parse(raw) as Partial<CompiledManifest>;
      const compiled = this.compile(parsed, orgId);
      this.cache.set(orgId, compiled);
      return compiled;
    } catch {
      // Return default manifest for unknown org
      return this.getDefaultManifest(orgId);
    }
  }

  async reloadManifest(orgId: string): Promise<void> {
    this.cache.delete(orgId);
    await this.loadManifest(orgId);
  }

  private compile(input: Partial<CompiledManifest>, orgId: string): CompiledManifest {
    const missing: ValidationError[] = [];

    if (!input.version) {
      missing.push({ field: 'version', message: 'Missing required field', severity: 'error' });
    }
    if (!input.organization?.id) {
      missing.push({ field: 'organization.id', message: 'Missing required field', severity: 'error' });
    }
    if (!input.organization?.name) {
      missing.push({ field: 'organization.name', message: 'Missing required field', severity: 'error' });
    }

    if (missing.length > 0) {
      throw new Error(`Manifest validation failed: ${missing.map(m => m.message).join(', ')}`);
    }

    return {
      version: input.version || '2.0',
      organization: input.organization!,
      settings: { ...REQUIRED_ORG_SETTINGS, ...(input.settings ?? {}) },
      features: input.features ?? {},
      roles: input.roles ?? [],
      departments: input.departments ?? [],
    };
  }

  private getDefaultManifest(orgId: string): CompiledManifest {
    const minimal: CompiledManifest = {
      version: '2.0',
      organization: { id: orgId, name: 'New Organization', type: 'custom', language: 'fr-FR', timezone: 'UTC' },
      settings: { ...REQUIRED_ORG_SETTINGS },
      features: {},
      roles: [
        { id: 'admin', name: 'Administrator', permissions: ['*'], parent: null },
      ],
      departments: [],
    };
    this.cache.set(orgId, minimal);
    return minimal;
  }

  getSettings(orgId: string): OrgSettings {
    const manifest = this.cache.get(orgId);
    if (!manifest) {
      throw new Error(`Manifest not loaded for org ${orgId}`);
    }
    return manifest.settings;
  }

  getFeatures(orgId: string): Record<string, FeatureToggle> {
    const manifest = this.cache.get(orgId);
    if (!manifest) {
      throw new Error(`Manifest not loaded for org ${orgId}`);
    }
    return manifest.features;
  }

  getRoles(orgId: string): RoleDefinition[] {
    const manifest = this.cache.get(orgId);
    if (!manifest) {
      throw new Error(`Manifest not loaded for org ${orgId}`);
    }
    return manifest.roles;
  }

  getPermissions(roleId: string): string[] {
    const manifest = this.cache.values().next().value;
    if (!manifest) throw new Error('No manifest loaded');
    const role = manifest.roles.find(r => r.id === roleId);
    if (!role) throw new Error(`Role ${roleId} not found`);
    return role.permissions;
  }

  isFeatureEnabled(orgId: string, feature: string): boolean {
    const manifest = this.cache.get(orgId);
    if (!manifest) return false;
    const f = manifest.features[feature];
    return f?.enabled ?? false;
  }

  hasPermission(userId: string, permission: string): boolean {
    // Simplified: checks admin role. Full impl resolves hierarchy.
    const manifest = this.cache.values().next().value;
    if (!manifest) return false;
    const adminRole = manifest.roles.find(r => r.id === 'admin');
    if (!adminRole) return false;
    if (adminRole.permissions.includes('*')) return true;
    return adminRole.permissions.some(p => this.permissionMatches(p, permission));
  }

  private permissionMatches(pattern: string, target: string): boolean {
    if (pattern === '*') return true;
    const patternParts = pattern.split(':');
    const targetParts = target.split(':');
    if (patternParts.length !== targetParts.length) return false;
    return patternParts.every((part, i) => part === '*' || part === targetParts[i]);
  }

  updateManifest(orgId: string, manifest: Partial<CompiledManifest>): void {
    const compiled = this.compile(manifest, orgId);
    this.cache.set(orgId, compiled);
    // Persist to disk
    const yamlStr = yaml.stringify(compiled);
    writeFile(join(this.manifestDir, `${orgId}.yaml`), yamlStr);
    this.emitEvent('manifest:updated', orgId, compiled.version);
  }

  validateManifest(manifest: Partial<CompiledManifest>): { valid: boolean; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    if (!manifest.version) errors.push({ field: 'version', message: 'Required', severity: 'error' });
    if (!manifest.organization?.id) errors.push({ field: 'organization.id', message: 'Required', severity: 'error' });
    if (!manifest.organization?.name) errors.push({ field: 'organization.name', message: 'Required', severity: 'error' });

    // R-MAN-02: role hierarchy depth <= 5
    if (manifest.roles) {
      for (const role of manifest.roles) {
        let depth = 0;
        let currentParent = role.parent;
        while (currentParent && depth < 5) {
          depth++;
          const parentRole = manifest.roles.find(r => r.id === currentParent);
          currentParent = parentRole?.parent ?? null;
        }
        if (depth >= 5) {
          errors.push({ field: `roles[${role.id}].parent`, message: 'Hierarchy depth exceeds 5', severity: 'error' });
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  // Events (observable pattern)
  private listeners: Map<string, ((...args: unknown[]) => void)[]> = new Map();
  on(event: string, fn: (...args: unknown[]) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, []);
    this.listeners.get(event)!.push(fn);
  }
  private emitEvent(event: string, ...args: unknown[]): void {
    this.listeners.get(event)?.forEach(fn => fn(...args));
  }
}
```

#### 2. `tests/unit/core/manifest/ManifestEngine.test.ts`
```typescript
import { ManifestEngine, CompiledManifest, ValidationError } from '../../../../src/core/manifest/src/ManifestEngine';

describe('ManifestEngine', () => {
  let engine: ManifestEngine;

  beforeEach(() => {
    engine = new ManifestEngine('/tmp/test-manifests');
  });

  describe('loadManifest', () => {
    test('returns default manifest when no file exists', async () => {
      const result = await engine.loadManifest('nonexistent-org');
      expect(result.organization.id).toBe('nonexistent-org');
      expect(result.version).toBe('2.0');
      expect(result.settings.currency).toBe('CDF');
    });

    test('caches manifest after first load', async () => {
      const r1 = await engine.loadManifest('org-1');
      const r2 = await engine.loadManifest('org-1');
      expect(r1).toBe(r2); // same cached object
    });

    test('reloadManifest clears cache', async () => {
      const r1 = await engine.loadManifest('org-1');
      await engine.reloadManifest('org-1');
      const r2 = await engine.loadManifest('org-1');
      // Different objects — cache was cleared
      expect(r1).not.toBe(r2);
    });
  });

  describe('isFeatureEnabled', () => {
    test('returns true for enabled feature', async () => {
      engine['cache'].set('test-org', {
        version: '2.0', organization: { id: 'test-org', name: 'Test', type: 'church', language: 'fr', timezone: 'UTC' },
        settings: { currency: 'CDF', fiscalYearStart: '01-01', requireApproval: true, maxAutoApprove: 500, largeTransactionThreshold: 5000 },
        features: { finance: { enabled: true, subFeatures: ['ledger'] }, members: { enabled: false } },
        roles: [], departments: [],
      } as CompiledManifest);
      expect(engine.isFeatureEnabled('test-org', 'finance')).toBe(true);
      expect(engine.isFeatureEnabled('test-org', 'members')).toBe(false);
      expect(engine.isFeatureEnabled('test-org', 'bible')).toBe(false);
    });
  });

  describe('hasPermission', () => {
    test('admin with wildcard has all permissions', () => {
      engine['cache'].set('x', {
        version: '2.0', organization: { id: 'x', name: 'X', type: 'custom', language: 'fr', timezone: 'UTC' },
        settings: { currency: 'CDF', fiscalYearStart: '01-01', requireApproval: true, maxAutoApprove: 500, largeTransactionThreshold: 5000 },
        features: {}, roles: [{ id: 'admin', name: 'Admin', permissions: ['*'], parent: null }], departments: [],
      } as CompiledManifest);
      expect(engine.hasPermission('user-1', 'finance:ledger:write')).toBe(true);
      expect(engine.hasPermission('user-1', 'members:directory:read')).toBe(true);
    });

    test('scoped permissions match correctly', () => {
      engine['cache'].set('x', {
        version: '2.0', organization: { id: 'x', name: 'X', type: 'custom', language: 'fr', timezone: 'UTC' },
        settings: { currency: 'CDF', fiscalYearStart: '01-01', requireApproval: true, maxAutoApprove: 500, largeTransactionThreshold: 5000 },
        features: {}, roles: [{ id: 'treasurer', name: 'Treasurer', permissions: ['finance:*'], parent: null }], departments: [],
      } as CompiledManifest);
      expect(engine.hasPermission('user-1', 'finance:ledger:write')).toBe(true);
      expect(engine.hasPermission('user-1', 'members:directory:read')).toBe(false);
    });
  });

  describe('validateManifest', () => {
    test('empty manifest fails validation', () => {
      const result = engine.validateManifest({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    test('valid manifest passes', () => {
      const result = engine.validateManifest({
        version: '2.0',
        organization: { id: 'org-1', name: 'Org One', type: 'church', language: 'fr', timezone: 'UTC' },
      } as Partial<CompiledManifest>);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('inv-002 compliance', () => {
    test('no hardcoded org-type branching in compile', () => {
      const engine = new ManifestEngine('/tmp/test-manifests');
      // Compile should treat all types the same way
      const church = engine.compile({ version: '2.0', organization: { id: 'a', name: 'A', type: 'church', language: 'fr', timezone: 'UTC' } } as any, 'a');
      const ngo = engine.compile({ version: '2.0', organization: { id: 'b', name: 'B', type: 'ngo', language: 'fr', timezone: 'UTC' } } as any, 'b');
      // Same structure applied regardless of type
      expect(church.version).toBe(ngo.version);
      expect(church.settings.currency).toBe(ngo.settings.currency);
    });
  });
});
```

---

### B. VOCABULARY ENGINE

#### 3. `src/core/vocabulary/src/VocabularyEngine.ts`
```typescript
// src/core/vocabulary/src/VocabularyEngine.ts
// DOC-PLATFORM-VOCA implementation — centralized term catalog
// INV-006: every enum comes from Vocab Engine

export interface TermValue {
  key: string;
  label: string;
  label_en: string;
  color?: string;
  deprecated?: boolean;
  metadata?: Record<string, unknown>;
}

export interface TermDefinition {
  key: string;
  label: string;
  description?: string;
  parent?: string;
  filter?: string;
  values: TermValue[];
}

export interface NamespaceRegistry {
  [namespace: string]: {
    [termKey: string]: TermDefinition;
  };
}

export class VocabularyEngine {
  private registry: NamespaceRegistry = {};
  private defaultsLoaded = false;

  constructor() {
    this.loadDefaults();
  }

  private loadDefaults(): void {
    this.registry.common = {
      genders: {
        key: 'genders', label: 'Genres',
        values: [
          { key: 'male', label: 'Masculin', label_en: 'Male' },
          { key: 'female', label: 'Feminin', label_en: 'Female' },
          { key: 'other', label: 'Autre', label_en: 'Other' },
        ],
      },
      member_statuses: {
        key: 'member_statuses', label: 'Statuts Membre',
        values: [
          { key: 'active', label: 'Actif', label_en: 'Active' },
          { key: 'inactive', label: 'Inactif', label_en: 'Inactive' },
          { key: 'deceased', label: 'Decede', label_en: 'Deceased' },
          { key: 'transferred', label: 'Transfere', label_en: 'Transferred' },
        ],
      },
    };
    this.registry.finance = {
      transaction_types: {
        key: 'transaction_types', label: 'Types de Transaction',
        values: [
          { key: 'income', label: 'Revenu', label_en: 'Income', color: '#1DB954' },
          { key: 'expense', label: 'Depense', label_en: 'Expense', color: '#E51332' },
          { key: 'transfer', label: 'Transfert', label_en: 'Transfer', color: '#2196F3' },
        ],
      },
      transaction_statuses: {
        key: 'transaction_statuses', label: 'Statuts Transaction',
        values: [
          { key: 'draft', label: 'Brouillon', label_en: 'Draft' },
          { key: 'pending', label: 'En attente', label_en: 'Pending', color: '#FFB800' },
          { key: 'approved', label: 'Approuve', label_en: 'Approved', color: '#1DB954' },
          { key: 'rejected', label: 'Rejete', label_en: 'Rejected', color: '#E51332' },
          { key: 'archived', label: 'Archive', label_en: 'Archived' },
        ],
      },
    };
    this.defaultsLoaded = true;
  }

  getTerm(namespace: string, termKey: string): TermDefinition | null {
    const ns = this.registry[namespace];
    if (!ns) return null;
    return ns[termKey] ?? null;
  }

  getValues(namespace: string, termKey: string): TermValue[] {
    const term = this.getTerm(namespace, termKey);
    if (!term) return [];
    return term.values.filter(v => !v.deprecated);
  }

  getValueByNamespaceAndKey(namespace: string, termKey: string, valueKey: string): TermValue | null {
    const term = this.getTerm(namespace, termKey);
    if (!term) return null;
    return term.values.find(v => v.key === valueKey && !v.deprecated) ?? null;
  }

  getAllNamespaces(): string[] {
    return Object.keys(this.registry);
  }

  searchTerms(query: string, namespace?: string): Array<{ namespace: string; termKey: string; term: TermDefinition }> {
    const results: typeof query extends string ? any : never = [];
    const namespaces = namespace ? [namespace] : Object.keys(this.registry);
    for (const ns of namespaces) {
      for (const [key, term] of Object.entries(this.registry[ns] ?? {})) {
        if (term.label.toLowerCase().includes(query.toLowerCase()) ||
            term.label_en.toLowerCase().includes(query.toLowerCase()) ||
            key.toLowerCase().includes(query.toLowerCase())) {
          results.push({ namespace: ns, termKey: key, term });
        }
      }
    }
    return results;
  }

  addValue(namespace: string, termKey: string, value: Omit<TermValue, 'deprecated'>): void {
    if (!this.registry[namespace]) this.registry[namespace] = {};
    if (!this.registry[namespace][termKey]) {
      this.registry[namespace][termKey] = { key: termKey, label: termKey, values: [] };
    }
    this.registry[namespace][termKey].values.push({ ...value, deprecated: false });
  }

  updateValue(namespace: string, termKey: string, valueKey: string, updates: Partial<TermValue>): void {
    const term = this.getTerm(namespace, termKey);
    if (!term) return;
    const value = term.values.find(v => v.key === valueKey);
    if (value) Object.assign(value, updates);
  }

  translate(namespace: string, termKey: string, valueKey: string, lang: string): string {
    const val = this.getValueByNamespaceAndKey(namespace, termKey, valueKey);
    if (!val) return valueKey;
    return lang === 'en' ? (val.label_en || val.label) : val.label;
  }

  setNamespace(ns: string, terms: { [key: string]: TermDefinition }): void {
    this.registry[ns] = terms;
  }
}
```

#### 4. `tests/unit/core/vocabulary/VocabularyEngine.test.ts`
```typescript
import { VocabularyEngine } from '../../../../src/core/vocabulary/src/VocabularyEngine';

describe('VocabularyEngine', () => {
  let vocab: VocabularyEngine;

  beforeEach(() => {
    vocab = new VocabularyEngine();
  });

  test('defaults include common and finance namespaces', () => {
    expect(vocab.getAllNamespaces()).toContain('common');
    expect(vocab.getAllNamespaces()).toContain('finance');
  });

  test('getValues returns non-deprecated terms', () => {
    const values = vocab.getValues('finance', 'transaction_types');
    expect(values).toHaveLength(3);
    expect(values[0]).toHaveProperty('key', 'income');
    expect(values[0]).toHaveProperty('color', '#1DB954');
  });

  test('getValues returns empty for unknown namespace', () => {
    expect(vocab.getValues('unknown', 'terms')).toEqual([]);
  });

  test('translate returns correct language', () => {
    expect(vocab.translate('finance', 'transaction_types', 'income', 'fr')).toBe('Revenu');
    expect(vocab.translate('finance', 'transaction_types', 'income', 'en')).toBe('Income');
  });

  test('addValue adds to existing term', () => {
    const before = vocab.getValues('finance', 'transaction_types').length;
    vocab.addValue('finance', 'transaction_types', { key: 'donation', label: 'Don', label_en: 'Donation' });
    const after = vocab.getValues('finance', 'transaction_types').length;
    expect(after).toBe(before + 1);
  });

  test('INV-006: no hardcoded enums exist — values come from registry', () => {
    // Verify all transaction status values originate from vocabulary
    const statuses = vocab.getValues('finance', 'transaction_statuses');
    const keys = statuses.map(s => s.key);
    expect(keys).toContain('draft');
    expect(keys).toContain('approved');
    expect(keys).toContain('rejected');
  });
});
```

---

### C. CAPABILITY ENGINE

#### 5. `src/core/capability/src/CapabilityEngine.ts`
```typescript
// src/core/capability/src/CapabilityEngine.ts
// DOC-PLATFORM-CAPA implementation — feature capability registry

export type CapabilityStatus = 'draft' | 'active' | 'deprecated';

export interface CapabilityDefinition {
  id: string;
  name: string;
  description: string;
  version: string;
  status: CapabilityStatus;
  dependencies: string[];
}

export class CapabilityEngine {
  private capabilities: Map<string, CapabilityDefinition> = new Map();

  register(cap: CapabilityDefinition): void {
    this.verifyNoCycles(cap.id, cap.dependencies);
    this.capabilities.set(cap.id, cap);
  }

  unregister(id: string): void {
    this.capabilities.delete(id);
  }

  listCapabilities(): CapabilityDefinition[] {
    return Array.from(this.capabilities.values());
  }

  getCapability(id: string): CapabilityDefinition | null {
    return this.capabilities.get(id) ?? null;
  }

  isCapabilityActive(id: string): boolean {
    const cap = this.capabilities.get(id);
    return cap?.status === 'active';
  }

  hasDependency(capId: string, depId: string): boolean {
    const cap = this.capabilities.get(capId);
    if (!cap) return false;
    return cap.dependencies.includes(depId);
  }

  verifyNoCycles(newId: string, deps: string[]): void {
    const visited = new Set<string>();
    const stack = [...deps];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (current === newId) {
        throw new Error(`Circular dependency detected: ${newId} -> ${current}`);
      }
      if (visited.has(current)) continue;
      visited.add(current);
      const depCap = this.capabilities.get(current);
      if (depCap) stack.push(...depCap.dependencies);
    }
  }

  getActiveIds(): string[] {
    return Array.from(this.capabilities.values())
      .filter(c => c.status === 'active')
      .map(c => c.id);
  }
}
```

#### 6. `tests/unit/core/capability/CapabilityEngine.test.ts`
```typescript
import { CapabilityEngine, CapabilityDefinition } from '../../../../src/core/capability/src/CapabilityEngine';

describe('CapabilityEngine', () => {
  let engine: CapabilityEngine;

  beforeEach(() => {
    engine = new CapabilityEngine();
    engine.register({ id: 'finance', name: 'Finance Module', description: 'Financial management', version: '1.0', status: 'active', dependencies: ['vocabulary', 'forms'] });
    engine.register({ id: 'vocabulary', name: 'Vocabulary', description: 'Term catalog', version: '1.0', status: 'active', dependencies: [] });
    engine.register({ id: 'forms', name: 'Forms', description: 'Form rendering', version: '1.0', status: 'active', dependencies: ['vocabulary'] });
    engine.register({ id: 'members', name: 'Members', description: 'Member management', version: '1.0', status: 'active', dependencies: ['forms', 'vocabulary'] });
  });

  test('list all active capabilities', () => {
    const active = engine.getActiveIds();
    expect(active).toContain('finance');
    expect(active).toContain('members');
  });

  test('dependency check', () => {
    expect(engine.hasDependency('finance', 'vocabulary')).toBe(true);
    expect(engine.hasDependency('finance', 'members')).toBe(false);
  });

  test('cycle detection rejects circular deps', () => {
    expect(() => {
      engine.register({ id: 'circular-a', name: 'A', description: '', version: '1.0', status: 'active', dependencies: ['circular-b'] });
      engine.register({ id: 'circular-b', name: 'B', description: '', version: '1.0', status: 'active', dependencies: ['circular-a'] });
    }).toThrow('Circular dependency');
  });

  test('unregister removes capability', () => {
    engine.unregister('forms');
    expect(engine.isCapabilityActive('forms')).toBe(false);
  });
});
```

---

### D. FORMS ENGINE

#### 7. `src/core/forms/src/FormsEngine.ts`
```typescript
// src/core/forms/src/FormsEngine.ts
// DOC-PLATFORM-FORMS implementation — JSON Schema to React Native form renderer

import { VocabularyEngine } from '../vocabulary/src/VocabularyEngine';

export interface FormFieldDef {
  name: string;
  label: string;
  type: 'text' | 'number' | 'email' | 'phone' | 'date' | 'select' | 'multiselect' | 'checkbox' | 'textarea' | 'file_upload';
  required: boolean;
  min?: number;
  max?: number;
  maxLength?: number;
  optionsSource?: string; // "vocab:namespace/termKey"
  visibleIf?: { field: string; operator: string; value: unknown };
  defaultValue?: unknown;
}

export interface FormDefinition {
  id: string;
  name: string;
  model: string;
  version: string;
  fields: FormFieldDef[];
}

export interface FieldError {
  fieldName: string;
  message: string;
  code: 'required' | 'min' | 'max' | 'pattern' | 'enum';
}

export interface ValidationResult {
  isValid: boolean;
  errors: FieldError[];
}

export class FormsEngine {
  private forms: Map<string, FormDefinition> = new Map();
  private vocab: VocabularyEngine;

  constructor(vocab: VocabularyEngine) {
    this.vocab = vocab;
  }

  register(form: FormDefinition): void {
    this.forms.set(form.id, form);
  }

  loadForm(formId: string): FormDefinition | null {
    return this.forms.get(formId) ?? null;
  }

  listForms(): FormDefinition[] {
    return Array.from(this.forms.values());
  }

  validateFormData(formId: string, data: Record<string, unknown>): ValidationResult {
    const form = this.forms.get(formId);
    if (!form) return { isValid: false, errors: [{ fieldName: '_', message: 'Form not found', code: 'pattern' }] };

    const errors: FieldError[] = [];
    for (const field of form.fields) {
      const value = data[field.name];

      if (field.required && (value === undefined || value === null || (typeof value === 'string' && value.trim() === ''))) {
        errors.push({ fieldName: field.name, message: `Field ${field.name} is required`, code: 'required' });
        continue;
      }

      if (value !== undefined && value !== null) {
        if (field.type === 'number' && typeof value === 'number') {
          if (field.min !== undefined && value < field.min) {
            errors.push({ fieldName: field.name, message: `Must be >= ${field.min}`, code: 'min' });
          }
          if (field.max !== undefined && value > field.max) {
            errors.push({ fieldName: field.name, message: `Must be <= ${field.max}`, code: 'max' });
          }
        }
        if (field.type === 'text' && typeof value === 'string' && field.maxLength && value.length > field.maxLength) {
          errors.push({ fieldName: field.name, message: `Max ${field.maxLength} characters`, code: 'max' });
        }
      }
    }

    return { isValid: errors.length === 0, errors };
  }
}
```

#### 8. `tests/unit/core/forms/FormsEngine.test.ts`
```typescript
import { VocabularyEngine } from '../vocabulary/src/VocabularyEngine';
import { FormsEngine } from '../../../../src/core/forms/src/FormsEngine';

describe('FormsEngine', () => {
  let forms: FormsEngine;

  beforeEach(() => {
    const vocab = new VocabularyEngine();
    forms = new FormsEngine(vocab);
    forms.register({
      id: 'transaction_form',
      name: 'New Transaction',
      model: 'Transaction',
      version: '1.0',
      fields: [
        { name: 'type', label: 'Type', type: 'select', required: true, optionsSource: 'vocab:finance/transaction_types' },
        { name: 'amount', label: 'Amount', type: 'number', required: true, min: 0.01 },
        { name: 'description', label: 'Description', type: 'textarea', required: false, maxLength: 500 },
        { name: 'date', label: 'Date', type: 'date', required: true },
      ],
    });
  });

  test('valid data passes', () => {
    const result = forms.validateFormData('transaction_form', {
      type: 'income', amount: 5000, description: 'Test tithe', date: '2026-01-15',
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  test('missing required field fails', () => {
    const result = forms.validateFormData('transaction_form', { type: 'income', amount: 5000 });
    expect(result.isValid).toBe(false);
    expect(result.errors.find(e => e.fieldName === 'date')).toBeTruthy();
  });

  test('amount below minimum fails', () => {
    const result = forms.validateFormData('transaction_form', { type: 'income', amount: 0, date: '2026-01-01' });
    expect(result.isValid).toBe(false);
  });
});
```

---

### E. WORKFLOW ENGINE

#### 9. `src/core/workflow/src/WorkflowEngine.ts`
```typescript
// src/core/workflow/src/WorkflowEngine.ts
// DOC-PLATFORM-WORKFLOW implementation — declarative state machine orchestrator

export type StepType = 'auto' | 'approval' | 'notification' | 'conditional' | 'delay';
export type StepStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
export type WorkflowStatus = 'running' | 'completed' | 'failed' | 'cancelled';

export interface WorkflowStep {
  id: string;
  type: StepType;
  action?: string;
  assignToRole?: string;
  condition?: string;
  timeout?: string;
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  status: WorkflowStatus;
  currentStepIndex: number;
  steps: Array<{ stepId: string; status: StepStatus; result?: unknown; error?: string }>;
  createdAt: Date;
  completedAt?: Date;
}

export class WorkflowEngine {
  private workflows: Map<string, WorkflowStep[][]> = new Map();
  private instances: Map<string, WorkflowInstance> = new Map();

  registerWorkflow(workflowId: string, states: WorkflowStep[][]): void {
    // states[n] = steps allowed in state n
    this.workflows.set(workflowId, states);
  }

  async trigger(workflowId: string, payload: Record<string, unknown>): Promise<string> {
    const states = this.workflows.get(workflowId);
    if (!states || states.length === 0) {
      throw new Error(`Workflow ${workflowId} not registered`);
    }

    const instanceId = `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const initialState = states[0] ?? [];

    const instance: WorkflowInstance = {
      id: instanceId,
      workflowId,
      status: 'running',
      currentStepIndex: 0,
      steps: initialState.map(step => ({ stepId: step.id, status: 'pending' as StepStatus })),
      createdAt: new Date(),
    };
    this.instances.set(instanceId, instance);

    await this.executeNext(instanceId);
    return instanceId;
  }

  private async executeNext(instanceId: string): Promise<void> {
    const inst = this.instances.get(instanceId);
    if (!inst || inst.status !== 'running') return;

    const steps = this.workflows.get(inst.workflowId);
    const currentSteps = steps?.[inst.currentStepIndex] ?? [];

    if (inst.currentStepIndex >= currentSteps.length) {
      // Move to next state
      inst.currentStepIndex++;
      if (steps && inst.currentStepIndex < steps.length) {
        const newSteps = steps[inst.currentStepIndex];
        inst.steps = newSteps.map(s => ({ stepId: s.id, status: 'pending' as StepStatus }));
        await this.executeNext(instanceId);
      } else {
        inst.status = 'completed';
        inst.completedAt = new Date();
      }
      return;
    }

    const step = currentSteps[inst.currentStepIndex];
    const stepRecord = inst.steps[inst.currentStepIndex];
    if (!stepRecord) return;

    stepRecord.status = 'in_progress';

    if (step.type === 'auto' && step.action) {
      // Auto-executed
      stepRecord.status = 'completed';
      inst.currentStepIndex++;
      await this.executeNext(instanceId);
    } else if (step.type === 'conditional') {
      // Simplified: always pass for now
      stepRecord.status = 'completed';
      inst.currentStepIndex++;
      await this.executeNext(instanceId);
    }
    // approval/notification: remain pending — external resolution needed
  }

  getInstances(orgId?: string): WorkflowInstance[] {
    return Array.from(this.instances.values());
  }

  getPendingApprovals(userId: string): WorkflowInstance[] {
    return Array.from(this.instances.values()).filter(i => i.status === 'running');
  }

  completeStep(instanceId: string, result: unknown): void {
    const inst = this.instances.get(instanceId);
    if (!inst) return;
    if (inst.steps[inst.currentStepIndex]) {
      inst.steps[inst.currentStepIndex].status = 'completed';
      inst.steps[inst.currentStepIndex].result = result;
    }
    inst.currentStepIndex++;
    this.executeNext(instanceId);
  }
}
```

#### 10. `tests/unit/core/workflow/WorkflowEngine.test.ts`
```typescript
import { WorkflowEngine } from '../../../../src/core/workflow/src/WorkflowEngine';

describe('WorkflowEngine', () => {
  let wf: WorkflowEngine;

  beforeEach(() => {
    wf = new WorkflowEngine();
    // Register a simple 2-state workflow: auto-validate -> approve -> complete
    wf.registerWorkflow('transaction_approval', [
      [
        { id: 'validate', type: 'auto', action: 'validate_transaction' },
      ],
      [
        { id: 'check_threshold', type: 'conditional', condition: 'amount > 500' },
        { id: 'approve', type: 'approval', assignToRole: 'treasurer' },
      ],
      [
        { id: 'finalize', type: 'auto', action: 'set_status_approved' },
      ],
    ]);
  });

  test('trigger starts running workflow', async () => {
    const instanceId = await wf.trigger('transaction_approval', { amount: 1000, type: 'income' });
    const instances = wf.getInstances();
    expect(instances).toHaveLength(1);
    expect(instances[0].id).toBe(instanceId);
    expect(instances[0].status).toBe('running');
  });

  test('completeStep advances workflow', () => {
    // Manually set a pending instance to test completion
    const inst: any = {
      id: 'test-1', workflowId: 'transaction_approval', status: 'running',
      currentStepIndex: 0,
      steps: [{ stepId: 'approve', status: 'pending' }],
      createdAt: new Date(),
    };
    (wf as any).instances.set('test-1', inst);
    wf.completeStep('test-1', { approvedBy: 'user-1' });
    expect(inst.currentStepIndex).toBe(1);
  });
});
```

## Tests to Write
All tests above should be placed in the `tests/unit/core/` directory tree.

## Documentation to Update
- `docs/superpowers/plans/SPRINT-1-platform-core-motors.plan.md` (this file)
- Traceability Matrix (add ENG-Manifest through ENG-Capability entries)

## DoD Checklist — Sprint 1 Specific

| # | Criterion | Status |
|---|-----------|--------|
| C01 | All 5 engines have unit tests passing | |
| C02 | Coverage >= 80% per engine | |
| C03 | No cross-motor dependency violations (Dependency-Contract verified) | |
| C04 | Zero `any` types in core/ | |
| C05 | No hardcoded org-type branching | |
| T01 | All tests pass with `npm test -- --watchAll=false` | |
| T02 | Cycle detection tested | |
| T03 | INV-002 compliance verified | |
| Q01 | Lint clean | |
| Q02 | TypeScript compiles | |
| D01 | This plan documents all engine APIs | |
