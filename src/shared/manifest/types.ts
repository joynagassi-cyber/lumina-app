/**
 * Org Manifest types — the compiled configuration of a Lumina organization.
 *
 * Canonical sources: DOC-000 (Manifest layer), CAPABILITY-DEPENDENCY-GRAPH
 * (Manifest Capability), NB-RULE-05 (AJV validation before compilation).
 */

/** Branding tokens — one accent only, per DESIGN.md (dark canvas). */
export interface OrgBranding {
  accent: string; // hex, e.g. "#FF6B00"
  logoUrl?: string;
  theme: 'dark';
}

export interface OrgConfiguration {
  currency: string; // ISO 4217 (XAF)
  locale: string; // 'fr' | 'en' | ...
  timezone: string; // IANA (Africa/Douala)
  fiscalYearStart?: string; // 'MM-DD'
}

export interface VocabularyTerm {
  key: string; // stable key, e.g. "dime"
  label: Record<string, string>; // locale → label
  aliases?: string[];
}

export interface VocabularyNamespace {
  id: string; // e.g. "finance_categories"
  terms: VocabularyTerm[];
}

export interface FeatureEntry {
  id: string; // matches FeatureModule.id
  version: string;
  toggleKey: string;
  enabled: boolean;
  requiredPermissions: string[];
}

export interface RoleDefinition {
  name: string; // 'admin' | 'treasurer' | 'pastor' | ...
  permissions: string[]; // e.g. "transaction:approve"
}

export interface FormFieldDef {
  key: string;
  type: 'text' | 'number' | 'date' | 'select' | 'multiselect' | 'boolean' | 'currency' | 'richtext';
  required: boolean;
  labelTerm?: string; // vocabulary key for the label
  optionsVocab?: string; // vocabulary namespace id for select options
  min?: number;
  max?: number;
  validationPattern?: string;
}

export interface FormDefinitionRef {
  id: string; // e.g. "transaction_create"
  fields: FormFieldDef[];
}

export interface WorkflowNodeDef {
  id: string;
  type: 'start' | 'task' | 'approval' | 'transition' | 'end';
  transitions: string[];
}

export interface WorkflowDefinition {
  id: string; // e.g. "transaction_state_machine"
  name: string;
  version: string;
  nodes: WorkflowNodeDef[];
}

export interface OrgManifest {
  version: number; // manifest schema version
  orgId: string;
  name: string;
  deployedAt: string; // ISO
  branding: OrgBranding;
  configuration: OrgConfiguration;
  vocabulary: VocabularyNamespace[];
  features: FeatureEntry[];
  permissions: {
    roles: RoleDefinition[];
  };
  forms: FormDefinitionRef[];
  workflows: WorkflowDefinition[];
  serverFetchedAt?: string;
}
