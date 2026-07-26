/**
 * ConfigurationAggregate — barrel export.
 *
 * @traceability DOC-012 Aggregate12
 */

export { ConfigurationService } from './application/configuration.service';
export type { UpdateSettingInput, BulkUpdateInput } from './application/configuration.service';
export { SettingValidationError } from './application/configuration.service';

export { SettingEntry, DEFAULT_SETTINGS } from './domain/entities/setting-entry.entity';
export { SettingUpdated, SettingsResetToDefaults } from './domain/entities/setting-entry.entity';

export { ConfigSettingKey, InvalidSettingKeyError } from './domain/value-objects/setting-key.vo';
export type { SettingKey } from './domain/value-objects/setting-key.vo';
export { ConfigSettingValue, InvalidSettingValueError } from './domain/value-objects/setting-value.vo';
export type { TypedSettingValue } from './domain/value-objects/setting-value.vo';

export { SettingResolver, UnknownSettingKeyError } from './domain/services/setting-resolver.service';
export type { ISettingStore } from './domain/services/setting-resolver.service';
export { SettingValidator, ValidationError } from './domain/services/setting-validator.service';

export { FormatValidationPolicy } from './domain/policies/format-validation-policy';
export type { FormatValidationResult } from './domain/policies/format-validation-policy';
export { TranslationMinimumPolicy } from './domain/policies/translation-minimum-policy';
export type { TranslationLabel } from './domain/policies/translation-minimum-policy';

export { PrismaConfigurationRepository } from './infrastructure/adapters/prisma-configuration.repository';

export type { ISettingPort, SettingRecord } from './ports/configuration.port';

export { ConfigurationModule } from './configuration.module';
