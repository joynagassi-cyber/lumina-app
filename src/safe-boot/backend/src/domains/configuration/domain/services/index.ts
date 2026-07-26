/**
 * Configuration Domain Services — barrel export.
 *
 * @traceability DOC-012 Aggregate12
 */

export { SettingResolver, UnknownSettingKeyError } from './setting-resolver.service';
export type { ISettingStore } from './setting-resolver.service';
export { SettingValidator, ValidationError } from './setting-validator.service';
