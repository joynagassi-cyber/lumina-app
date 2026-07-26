/**
 * AmountInCents — BIGINT positive integer, NEVER float.
 *
 * @traceability DOC-012 Aggregate3 (AmountInCents VO), BR-RES-001, BR-RES-008
 * @invariant Always positive integer (cents), never zero for valid amounts
 */

export class AmountInCents {
  constructor(private readonly value: number) {
    if (!Number.isInteger(value) || value <= 0) {
      throw new Error(`AmountInCents: must be a positive integer (cents), got ${value}`);
    }
  }

  get value(): number {
    return this.value;
  }

  /** Convert to displayable decimal string in primary currency unit. */
  toDecimalString(decimals: number = 2): string {
    const divisor = Math.pow(10, decimals);
    return (this.value / divisor).toFixed(decimals);
  }

  /** Add two amounts together. */
  add(other: AmountInCents): AmountInCents {
    return new AmountInCents(this.value + other.value);
  }

  /** Subtract another amount (throws if result would be non-positive). */
  subtract(other: AmountInCents): AmountInCents {
    const result = this.value - other.value;
    if (result <= 0) {
      throw new Error('AmountInCents: subtraction would produce non-positive amount');
    }
    return new AmountInCents(result);
  }

  equals(other: AmountInCents): boolean {
    return this.value === other.value;
  }

  toString(): string {
    return String(this.value);
  }
}
