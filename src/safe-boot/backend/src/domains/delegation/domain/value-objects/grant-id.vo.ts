/**
 * GrantId — UUID wrapper for grant identifiers.
 *
 * Immutable value object that provides type safety for grant IDs throughout the
 * delegation domain. Prevents accidental mixing of UUID strings with other IDs.
 *
 * @traceability DOC-012 DelegationAggregate → GrantId VO
 */

import { v4 as uuidv4 } from 'uuid';

export class GrantId {
  constructor(public readonly value: string) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error('Invalid UUID format for GrantId');
    }
  }

  static create(): GrantId {
    return new GrantId(uuidv4());
  }

  toString(): string {
    return this.value;
  }

  equals(other: GrantId): boolean {
    return this.value === other.value;
  }
}