/**
 * PushBatchSize — capped batch size for push operations (max 50).
 *
 * @traceability DOC-012 Aggregate13 (PushBatchSize), BR-SYNC-006
 */

export class PushBatchSize {
  static readonly MAX = 50;

  constructor(public readonly value: number) {
    if (!Number.isInteger(value) || value < 1 || value > PushBatchSize.MAX) {
      throw new Error(
        `PushBatchSize: must be integer between 1 and ${PushBatchSize.MAX}, got ${value}`,
      );
    }
  }

  static create(n: number): PushBatchSize {
    return new PushBatchSize(Math.min(n, PushBatchSize.MAX));
  }

  toString(): string {
    return String(this.value);
  }
}
