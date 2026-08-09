/**
 * Delegation domain-specific errors.
 *
 * @traceability BR-DEL-002 to BR-DEL-007 — Policy validation errors
 */

export class DelegationError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'DelegationError';
  }
}

export class CircularDelegationError extends DelegationError {
  constructor(message: string = 'Circular delegation detected') {
    super(message);
    this.name = 'CircularDelegationError';
  }
}

export class DurationExceededError extends DelegationError {
  constructor(durationDays: number, maxDays = 90) {
    super(`Duration ${durationDays} days exceeds maximum ${maxDays} days (BR-DEL-002)`);
    this.name = 'DurationExceededError';
  }
}

export class SuperadminDelegationError extends DelegationError {
  constructor(message: string = 'Superadmin roles cannot be delegated or receive delegations') {
    super(message);
    this.name = 'SuperadminDelegationError';
  }
}

export class NonTransitiveError extends DelegationError {
  constructor(message: string = 'Non-transitive delegation violated (BR-DEL-007)') {
    super(message);
    this.name = 'NonTransitiveError';
  }
}

export class CapabilityValidationError extends DelegationError {
  constructor(
    public readonly permission: string,
    message: string = 'Permission violates capability manifest (BR-DEL-001)'
  ) {
    super(message);
    this.name = 'CapabilityValidationError';
  }
}