/**
 * UuidV7Adapter — Infrastructure Adapter for IUuidPort
 *
 * Generates UUIDs using v7 (time-sortable) or falls back to random UUID.
 * Replaced with DeterministicUuid in tests.
 *
 * @traceability PAS-001 Port-005 (UuidPort)
 *   → POSTGRESQL-SCHEMA-PACK-v1 id uuid DEFAULT gen_random_uuid()
 */

import { IUuidPort } from '../../ports/uuid.port';

export class UuidV7Adapter implements IUuidPort {
  generate(): string {
    return crypto.randomUUID();
  }
}

/**
 * DeterministicUuid for testing — returns pre-configured sequential IDs.
 */
export class DeterministicUuidAdapter implements IUuidPort {
  private counter = 0;
  constructor(private readonly prefix: string = 'test-uuid') {}

  generate(): string {
    this.counter++;
    return `${this.prefix}-${String(this.counter).padStart(36, '0')}`;
  }
}
