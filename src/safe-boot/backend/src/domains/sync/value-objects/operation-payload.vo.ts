/**
 * OperationPayload — JSON string snapshot of the entire resource being synced.
 *
 * @traceability DOC-012 Aggregate13 (OperationPayload)
 * @invariant Must be valid JSON, never empty
 */

export class OperationPayload {
  private static readonly MIN_LENGTH = 2; // '{}' is minimum valid JSON

  constructor(public readonly value: string) {
    if (!OperationPayload.isValid(value)) {
      throw new Error(
        `OperationPayload: invalid JSON — "${value.substring(0, 50)}"`,
      );
    }
  }

  static isValid(input: string): boolean {
    try {
      const parsed = JSON.parse(input);
      return typeof parsed === 'object' && parsed !== null;
    } catch {
      return false;
    }
  }

  parse<T>(): T {
    return JSON.parse(this.value) as T;
  }

  toString(): string {
    return this.value;
  }

  equals(other: OperationPayload): boolean {
    return this.value === other.value;
  }
}
