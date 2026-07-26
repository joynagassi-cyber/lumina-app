/**
 * TransactionReference — UUID linking to a compensating transaction.
 *
 * @traceability DOC-012 Aggregate3 (TransactionReference VO), INV-001, BR-RES-002
 * @invariant References the id of an approved TransactionRecord
 */

export class TransactionReference {
  constructor(public readonly value: string) {}

  static from(resourceId: string): TransactionReference {
    return new TransactionReference(resourceId);
  }
}
