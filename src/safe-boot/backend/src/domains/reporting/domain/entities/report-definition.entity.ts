/**
 * ReportDefinition domain entity.
 *
 * @traceability DOC-012 Aggregate9 Entity ReportDefinition
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 25 (reports)
 */

import { v4 as uuidv4 } from 'uuid';

export interface ReportDefinitionProps {
  id: string;
  orgId: string;
  key: string;
  titleFr: string;
  titleEn: string;
  periodType: string;
  exportFormats: string[];
  createdAt: Date;
  lastGeneratedAt?: Date | null;
}

export class ReportDefinition {
  private constructor(private readonly props: ReportDefinitionProps) {}

  static create(params: Omit<ReportDefinitionProps, 'id' | 'createdAt'>): ReportDefinition {
    const now = new Date();
    return new ReportDefinition({ ...params, id: uuidv4(), createdAt: now });
  }

  get id(): string { return this.props.id; }
  get orgId(): string { return this.props.orgId; }
  get key(): string { return this.props.key; }
  get titleFr(): string { return this.props.titleFr; }
  get titleEn(): string { return this.props.titleEn; }
  get periodType(): string { return this.props.periodType; }
  get exportFormats(): string[] { return this.props.exportFormats; }
  get createdAt(): Date { return this.props.createdAt; }
  get lastGeneratedAt(): Date | null { return this.props.lastGeneratedAt ?? null; }
}
