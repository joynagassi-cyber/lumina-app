/**
 * NetInternalTransfersPolicy — prevents double counting of internal transfers.
 *
 * @traceability DOC-012 Aggregate9 §NetInternalTransfersPolicy
 */

export interface InternalTransferConfig {
  readonly active: boolean;
  readonly orgIds: string[];
}

/**
 * Policy that determines whether to net out internal transfers
 * to avoid double counting in consolidated reports.
 */
export class NetInternalTransfersPolicy {
  /**
   * Check if an internal transfer should be excluded from the balance calculation.
   */
  static shouldExcludeTransfer(
    txnOrgId: string,
    config: InternalTransferConfig | null,
  ): boolean {
    if (!config?.active) return false;
    return config.orgIds.includes(txnOrgId);
  }
}
