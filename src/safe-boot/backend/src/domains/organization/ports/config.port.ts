/**
 * Configuration Port
 *
 * Provides access to runtime configuration values.
 * Used to resolve template defaults, max depth settings, etc.
 *
 * @traceability PAS-001 Port-007 (ConfigurationPort)
 */

export interface IConfigurationPort {
  get<T = string>(key: string): T | undefined;
}
