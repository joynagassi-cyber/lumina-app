/**
 * InviteId — Value Object wrapper for UUID
 *
 * Provides type safety for invitation identifiers throughout the domain.
 * Immutable, follows DRY principle across aggregate roots.
 */

import { v4 as uuidv4 } from 'uuid';

export class InviteId {
  readonly value: string;

  constructor(id: string = uuidv4()) {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      throw new Error(`Invalid UUID format: ${id}`);
    }
    this.value = id.toLowerCase();
  }

  toString(): string {
    return this.value;
  }

  equals(other: InviteId): boolean {
    return this.value === other.value;
  }

  static create(): InviteId {
    return new InviteId();
  }

  static from(id: string): InviteId {
    return new InviteId(id);
  }
}