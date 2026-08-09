/**
 * GeneratedReport entity — a report snapshot produced by the reporting domain.
 *
 * @traceability DOC-012 Aggregate9 Entity GeneratedReport
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 26 (report_snapshots)
 */

import { v4 as uuidv4 } from 'uuid';
import { BalanceTotals } from '../value-objects/balance-totals.vo';

/** Rapport déjà signé — immuable (BR-RPT-004). */
export class AlreadySignedError extends Error {
  constructor(reportId: string) {
    super(`Report ${reportId} is already signed (BR-RPT-004)`);
    this.name = 'AlreadySignedError';
  }
}

export interface GeneratedReportProps {
  id: string;
  orgId: string;
  periodStart: Date;
  periodEnd: Date;
  scope: string;
  balance: BalanceTotals;
  categoryBreakdown: Record<string, CategoryBreakdown>;
  transactionCount: number;
  createdAt: Date;
  signature?: string | null;
}

export interface CategoryBreakdown {
  readonly income: number;
  readonly expense: number;
}

/**
 * Immutable entity representing a generated report snapshot.
 * Once created with a signature, it becomes immutable per BR-RPT-004.
 */
export class GeneratedReport {
  private readonly _emittedEvents: unknown[] = [];

  private constructor(private readonly props: GeneratedReportProps) {}

  static create(params: Omit<GeneratedReportProps, 'id' | 'createdAt'>): GeneratedReport {
    // Validate balance invariant before creation
    params.balance.validateBalance();

    const now = new Date();
    return new GeneratedReport({ ...params, id: uuidv4(), createdAt: now });
  }

  get id(): string { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get periodStart(): Date { return this.props.periodStart; }
  get periodEnd(): Date { return this.props.periodEnd; }
  get scope(): string { return this.props.scope; }
  get balance(): BalanceTotals { return this.props.balance; }
  get categoryBreakdown(): Record<string, CategoryBreakdown> {
    return this.props.categoryBreakdown;
  }
  get transactionCount(): number { return this.props.transactionCount; }
  get createdAt(): Date { return this.props.createdAt; }
  get signature(): string | null { return this.props.signature ?? null; }

  /**
   * Attach a digital signature to the report.
   * After signing, the report is immutable per BR-RPT-004.
   */
  sign(signature: string): void {
    if (this.props.signature) {
      throw new AlreadySignedError(this.props.id);
    }
    this.props.signature = signature;
    this.emitEvent(new ReportSigned(this.props.id, this.props.orgId, signature));
  }

  getAndClearEvents(): unknown[] {
    const events = [...this._emittedEvents];
    this._emittedEvents.length = 0;
    return events;
  }

  private emitEvent(event: unknown): void {
    this._emittedEvents.push(event);
  }

  /** Serialize to persistence column map. */
  toPersistenceMap(): Record<string, unknown> {
    return {
      id: this.props.id,
      org_id: this.props.orgId,
      periode_debut: this.props.periodStart.toISOString(),
      periode_fin: this.props.periodEnd.toISOString(),
      portee: this.props.scope,
      total_revenu: this.props.balance.totalIncome,
      total_depense: this.props.balance.totalExpense,
      resultat_net: this.props.balance.netResult,
      details_par_categorie: JSON.stringify(this.props.categoryBreakdown),
      nombre_transactions: this.props.transactionCount,
      horodatage_genere: this.props.createdAt.toISOString(),
      signature_numerique: this.props.signature,
    };
  }
}

// ---- Domain Events ----

export class ReportGenerated {
  constructor(
    public readonly reportId: string,
    public readonly orgId: string,
    public readonly periodStart: Date,
    public readonly periodEnd: Date,
    public readonly scope: string,
  ) {}
}

export class ReportExported {
  constructor(
    public readonly reportId: string,
    public readonly orgId: string,
    public readonly format: string,
    public readonly timestamp: Date,
  ) {}
}

export class BalanceCalculated {
  constructor(
    public readonly reportId: string,
    public readonly totalIncome: number,
    public readonly totalExpense: number,
    public readonly netResult: number,
  ) {}
}

export class ReportSigned {
  constructor(
    public readonly reportId: string,
    public readonly orgId: string,
    public readonly signature: string,
  ) {}
}
