/**
 * Configuration Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 9 (ConfigurationAggregate)
 * @traceability DOC-006: Configuration concept
 * @traceability DOC-021: Physical Data Model organization_settings table
 * @traceability ASS-001: Application Services for configuration operations
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Setting value type.
 */
export type SettingValue = string | number | boolean | Record<string, unknown> | null;

/**
 * Setting type for form rendering.
 */
export type SettingType = 'string' | 'number' | 'boolean' | 'select' | 'textarea' | 'json';

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * SettingEntry — a single configuration setting within an organization.
 * Maps to physical table `organization_settings` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface SettingEntry {
  /** Universally unique identifier for this setting entry. */
  readonly id: string;

  /** Organization this setting belongs to. */
  readonly organizationId: string;

  /** Setting key (unique within organization). */
  readonly key: string;

  /** Setting display name/label. */
  readonly label: string;

  /** Setting type (string, number, boolean, select, etc.). */
  readonly type: SettingType;

  /** Setting value. */
  readonly value: SettingValue;

  /** Setting description. */
  readonly description: string | null;

  /** Whether this setting is system-defined. */
  readonly isSystem: boolean;

  /** Version for optimistic locking. */
  readonly version: number;

  /** Whether this record is synced with the server. */
  readonly synced: boolean;

  /** Timestamp when this record was created (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last modification (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * Organization settings profile (aggregated view).
 */
export interface OrganizationSettings {
  /** Organization ID. */
  readonly organizationId: string;

  /** Name of the organization. */
  readonly name: string;

  /** Currency setting. */
  readonly currency: string;

  /** Timezone setting. */
  readonly timezone: string;

  /** Language setting. */
  readonly language: 'fr' | 'en';

  /** Accent color. */
  readonly accent: string;

  /** Additional custom settings. */
  readonly custom: Record<string, SettingValue>;

  /** Version for optimistic locking. */
  readonly version: number;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for GetOrganizationSettings command.
 */
export interface GetSettingsInput {
  /** Organization ID. */
  readonly organizationId: string;
}

/**
 * Input for UpdateSetting command.
 */
export interface UpdateSettingInput {
  /** Setting ID to update. */
  readonly settingId: string;

  /** Organization ID (for context). */
  readonly organizationId: string;

  /** Setting value (required). */
  readonly value: SettingValue;

  /** Setting description (optional update). */
  readonly description?: string | null;
}

/**
 * Input for BulkUpdateSettings command.
 */
export interface BulkUpdateSettingsInput {
  /** Organization ID. */
  readonly organizationId: string;

  /** Map of setting key → value to update. */
  readonly updates: Record<string, SettingValue>;

  /** Whether to validate before update (default: true). */
  readonly validate?: boolean;
}

/**
 * Input for CreateSetting command.
 */
export interface CreateSettingInput {
  /** Organization ID (injected from context). */
  readonly organizationId: string;

  /** Setting key (required, unique within org). */
  readonly key: string;

  /** Setting label (required). */
  readonly label: string;

  /** Setting type (required). */
  readonly type: SettingType;

  /** Setting value (optional, default: null). */
  readonly value?: SettingValue;

  /** Setting description (optional). */
  readonly description?: string | null;

  /** Whether this is a system setting (default: false). */
  readonly isSystem?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Query / Response Types                                             */
/* ------------------------------------------------------------------ */

/**
 * Aggregated structure returned by useSettings().
 */
export interface SettingsDomainModel {
  /** Organization settings profile. */
  readonly settings: OrganizationSettings | null;

  /** Individual setting entries. */
  readonly entries: ReadonlyArray<SettingEntry>;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/**
 * Aggregated structure returned by useSetting().
 */
export interface SettingDomainModel {
  /** The setting entry. */
  readonly setting: SettingEntry | null;

  /** Loading state. */
  readonly isLoading: boolean;

  /** Error state (if any). */
  readonly error: string | null;
}

/* ------------------------------------------------------------------ */
/*  WatermelonDB Attributes                                            */
/* ------------------------------------------------------------------ */

/**
 * Attributes for the SettingEntry WatermelonDB model.
 */
export interface SettingEntryAttrs {
  id: string;
  _updatedAt: number;
  organizationId: string;
  key: string;
  label: string;
  type: SettingType;
  value: string; // JSON serialized
  description: string | null;
  isSystem: boolean;
  version: number;
  synced: boolean;
  createdAt: string;
  updatedAt: string;
}