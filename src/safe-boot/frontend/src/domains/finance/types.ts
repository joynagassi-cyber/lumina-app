/**
 * Finance Domain — types exported to the frontend layer.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: Aggregate 3 (ResourceAggregate)
 * @traceability DOC-021: Physical Data Model transaction_record table
 * @traceability ASS-001: Application Services for finance CRUD
 */

/* ------------------------------------------------------------------ */
/*  Value Objects                                                      */
/* ------------------------------------------------------------------ */

/**
 * Transaction type enum. Maps to ResourceAggregate entity TransactionRecord.
 * Source: CANONICAL-DOMAIN-MODEL.md ResourceState for transactions.
 */
export type TransactionType = 'income' | 'expense' | 'transfer';

/**
 * Transaction lifecycle state per BR-RES state machine.
 * draft -> pending -> approved / rejected
 */
export type TransactionState = 'draft' | 'pending' | 'approved' | 'rejected';

/**
 * Amount stored in cents (BIGINT equivalent) — never float per BR-RES-008.
 * Positive values only per BR-RES-001.
 */
export type AmountInCents = number;

/**
 * Scope type for transaction consolidation filtering.
 * Mandatory for transactions per BR-RES-005.
 */
export type ScopeType = 'org' | 'group';

/**
 * Financial period type for reports.
 * Source: CANONICAL-DOMAIN-MODEL.md ReportingAggregate PeriodType VO.
 */
export type PeriodType = 'month' | 'quarter' | 'year' | 'custom';

/**
 * Report export format.
 */
export type ReportFormat = 'pdf' | 'csv' | 'json';

/**
 * Category derived from VocabularyAggregate namespace "finance".
 * BR-RES-006: category reference always from Vocabulary.
 */
export interface Category {
  /** Unique category identifier. */
  readonly id: string;

  /** Namespace key, e.g. "finance". */
  readonly namespace: string;

  /** Category display label (resolved via TermResolver). */
  readonly labelFr: string;

  /** Category display label in English. */
  readonly labelEn: string;

  /** Display color hex code for chart rendering. */
  readonly colorHex: string;

  /** Whether this category is deprecated (still exists but not shown in new UI). */
  readonly isDeprecated: boolean;

  /** Arbitrary metadata from Vocabulary term definition. */
  readonly metadata: Record<string, unknown>;
}

/* ------------------------------------------------------------------ */
/*  Entities                                                           */
/* ------------------------------------------------------------------ */

/**
 * Financial transaction record from ResourceAggregate.
 * Maps to physical table `transaction_record` in POSTGRESQL-SCHEMA-PACK-v1.md.
 */
export interface TransactionRecord {
  /** Universally unique identifier. */
  readonly id: string;

  /** Organization this transaction belongs to (visibility policy). */
  readonly organizationId: string;

  /** Money-in or money-out classification. */
  readonly type: TransactionType;

  /** Human-readable title of the transaction. */
  readonly description: string;

  /** Amount in cents — integer, always positive per BR-RES-008. */
  readonly amount: AmountInCents;

  /** Reference to a Vocabulary category (BR-RES-006). */
  readonly categoryId: string | null;

  /** Transaction date (UTC ISO 8601 date, never future per BR-RES-004). */
  readonly transactionDate: string;

  /** Current lifecycle state. */
  readonly state: TransactionState;

  /** Org or group scope for consolidation (BR-RES-005). */
  readonly scopeType: ScopeType;

  /** Target group ID when scopeType is "group" (nullable). */
  readonly scopeTarget: string | null;

  /** UUID of an opposing compensating transaction if this corrects one (INV-001). */
  readonly compensatesFor: string | null;

  /** User who created this transaction (BR-RES-007). */
  readonly createdBy: string;

  /** User who last modified this transaction (nullable on creation). */
  readonly updatedBy: string | null;

  /** Version counter — auto-incremented on every change (INV-010). */
  readonly version: number;

  /** Arbitrary extensible JSONB metadata. */
  readonly metadata: Record<string, unknown>;

  /** Whether this transaction has been synced to server. */
  readonly synced: boolean;

  /** Timestamp of creation (UTC ISO 8601). */
  readonly createdAt: string;

  /** Timestamp of last update (UTC ISO 8601). */
  readonly updatedAt: string;
}

/**
 * Aggregated report summary for balance sheet / P&L calculations.
 * Source: CANONICAL-DOMAIN-MODEL.md ReportingAggregate GeneratedReport.
 */
export interface ReportSummary {
  /** Report identifier. */
  readonly id: string;

  /** Label in French. */
  readonly labelFr: string;

  /** Label in English. */
  readonly labelEn: string;

  /** Start of the reporting period (inclusive). */
  readonly periodStart: string;

  /** End of the reporting period (inclusive). */
  readonly periodEnd: string;

  /** Total income across all approved transactions. */
  readonly totalIncome: AmountInCents;

  /** Total expense across all approved transactions. */
  readonly totalExpense: AmountInCents;

  /** Net result: income minus expense. */
  readonly netResult: AmountInCents;

  /** Breakdown by category ID. */
  readonly byCategory: Record<
    string,
    { income: AmountInCents; expense: AmountInCents }
  >;

  /** Number of transactions included. */
  readonly transactionCount: number;

  /** Export format selected for this report. */
  readonly exportFormat: ReportFormat;
}

/* ------------------------------------------------------------------ */
/*  Command / Request DTOs                                             */
/* ------------------------------------------------------------------ */

/**
 * Input for CreateResource[Transaction] command.
 * Maps to ASS-001 CreateTransaction operation.
 */
export interface CreateTransactionInput {
  type: TransactionType;
  description: string;
  amount: AmountInCents;
  categoryId?: string | null;
  transactionDate: string;
  scopeType: ScopeType;
  scopeTarget?: string | null;
  organizationId: string;
}

/**
 * Input for TransitionResourceState[Transaction].
 * draft -> pending -> approved / rejected
 */
export interface TransitionTransactionInput {
  transactionId: string;
  newState: TransactionState;
  organizationId: string;
}

/**
 * Input for CompensateTransaction command.
 * INV-001: approved transactions immuable — correction via new tx.
 */
export interface CompensateTransactionInput {
  originalTransactionId: string;
  description: string;
  amount: AmountInCents;
  organizationId: string;
}

/**
 * Input for generating a financial report.
 */
export interface GenerateReportInput {
  periodType: PeriodType;
  periodStart: string;
  periodEnd: string;
  scopeType: ScopeType;
  scopeTarget?: string | null;
  exportFormat: ReportFormat;
  organizationId: string;
}

/**
 * Generic pagination response.
 */
export interface PaginatedResponse<T> {
  readonly items: ReadonlyArray<T>;
  readonly totalCount: number;
  readonly hasNextPage: boolean;
}
