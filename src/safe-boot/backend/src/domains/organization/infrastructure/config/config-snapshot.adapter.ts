/**
 * ConfigSnapshotAdapter — Infrastructure Adapter for IConfigurationPort
 *
 * Provides runtime configuration values from environment variables.
 *
 * @traceability PAS-001 Port-007 (ConfigurationPort)
 */

import { IConfigurationPort } from '../../ports/config.port';

export class ConfigSnapshotAdapter implements IConfigurationPort {
  constructor(
    private readonly env: NodeJS.ProcessEnv = process.env,
  ) {}

  get<T = string>(key: string): T | undefined {
    const value = this.env[key];
    if (value === undefined) return undefined;
    return value as unknown as T;
  }
}
