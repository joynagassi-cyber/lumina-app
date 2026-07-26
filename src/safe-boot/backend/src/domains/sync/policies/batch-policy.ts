/**
 * BatchPolicy — enforces max batch size of 50 operations per push.
 *
 * @traceability DOC-012 Aggregate13 (BatchPolicy), BR-SYNC-006, E-422-001-SYNC-002
 */

import { PushBatchSize } from '../value-objects/push-batch-size.vo';

export class BatchPolicy {
  /**
   * Split an array of operations into batches respecting the maximum batch size.
   * Returns an array of sub-arrays, each at most `PushBatchSize.MAX` items long.
   */
  static splitIntoBatches<T>(
    operations: T[],
    maxSize?: number,
  ): T[][] {
    const limit = maxSize ?? PushBatchSize.MAX;
    const batches: T[][] = [];

    for (let i = 0; i < operations.length; i += limit) {
      batches.push(operations.slice(i, i + limit));
    }

    return batches;
  }

  /**
   * Validate that a collection does not exceed the batch limit.
   */
  static validateBatchLimit(count: number): void {
    if (count > PushBatchSize.MAX) {
      throw new Error(
        `BatchPolicy: ${count} operations exceed maximum batch size of ${PushBatchSize.MAX} (SYNC-002)`,
      );
    }
  }

  static getMaximumBatchSize(): number {
    return PushBatchSize.MAX;
  }
}
