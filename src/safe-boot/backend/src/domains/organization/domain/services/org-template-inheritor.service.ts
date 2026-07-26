/**
 * OrgTemplateInheritor Domain Service
 *
 * Resolves template inheritance for organizations. A new organization inherits
 * default settings from a Template → Manifest resolution chain.
 *
 * @traceability DOC-012 Aggregate1 §DomainService-OrgTemplateInheritor
 *   → PAS-003 DR-001 (no Port/Adapter dependencies)
 */

export interface TemplateManifest {
  readonly templateId: string;
  readonly defaults: Record<string, unknown>;
}

export class TemplateNotFoundError extends Error {
  constructor(templateId: string) {
    super(`Template '${templateId}' not found.`);
    this.name = 'TemplateNotFoundError';
  }
}

/**
 * Applies inherited default settings to a new organization based on its type.
 */
export class OrgTemplateInheritor {
  /** Predefined templates keyed by organization type. */
  private static readonly DEFAULT_TEMPLATES: ReadonlyMap<
    string,
    TemplateManifest
  > = new Map([
    ['church', {
      templateId: 'tpl-church-default',
      defaults: {
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#4F46E5',
      },
    }],
    ['school', {
      templateId: 'tpl-school-default',
      defaults: {
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#059669',
      },
    }],
    ['ngo', {
      templateId: 'tpl-ngo-default',
      defaults: {
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#DC2626',
      },
    }],
    ['company', {
      templateId: 'tpl-company-default',
      defaults: {
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#2563EB',
      },
    }],
    ['custom', {
      templateId: 'tpl-custom-default',
      defaults: {
        currencyCode: 'USD',
        timezone: 'UTC',
        language: 'fr',
        accentColor: '#6B7280',
      },
    }],
  ]);

  /**
   * Resolve the manifest for a given organization type.
   * Returns undefined if no template exists (future-proofing).
   */
  static resolve(type: string): TemplateManifest | undefined {
    return OrgTemplateInheritor.DEFAULT_TEMPLATES.get(type);
  }

  /**
   * Merge default settings with user-provided overrides.
   * User values take priority over template defaults.
   */
  static applyDefaults(
    type: string,
    providedOverrides: Record<string, unknown> = {},
  ): Record<string, unknown> {
    const template = OrgTemplateInheritor.resolve(type);
    if (!template) {
      return { ...providedOverrides };
    }

    return { ...template.defaults, ...providedOverrides };
  }
}
