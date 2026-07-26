/**
 * Audit Port
 *
 * Contract for writing audit log entries.
 * Per DOC-023 §6, all state changes in OrganizationAggregate are audited.
 *
 * @traceability DOC-012 Aggregate1 → DOC-023 §6 (Audit Structure)
 *   → PAS-001 Port-009 (AuditPort)
 */

export interface AuditPayload {
  readonly entityType: string;
  readonly entityId: string;
  readonly action: string;
  readonly userId: string;
  readonly before?: Record<string, unknown>;
  readonly after?: Record<string, unknown>;
}

export interface IAuditPort {
  log(payload: AuditPayload): Promise<void>;
}
