/**
 * UUID Generation Port
 *
 * Generates unique identifiers per PAS-001 Port-005.
 * Replaced with deterministic UUID in tests (PAS-005 PA-NB-009).
 *
 * @traceability PAS-001 Port-005 (UuidPort)
 *   → POSTGRESQL-SCHEMA-PACK-v1 organizations.id DEFAULT gen_random_uuid()
 */

export interface IUuidPort {
  generate(): string;
}
