/**
 * PrismaWorkflowRepository — Infrastructure Adapter
 *
 * Implements IWorkflowInstanceRepository, IWorkflowStepRepository, and
 * IWorkflowLogRepository using Prisma ORM.
 * Strips persistence metadata before returning entities per PAS-005 PA-NB-007.
 *
 * @traceability DOC-012 Aggregate5 → POSTGRESQL-SCHEMA-PACK-v1 tables: workflow_instances, workflow_steps, workflow_logs
 *   → PAS-005 PA-NB-007 (RepositoryAbstraction)
 *   → PAS-003 DR-007 (Persistence Ignorance)
 */

import { WorkflowInstance, WorkflowInstanceStatus } from '../../domain/entities/workflow-instance.entity';
import { WorkflowStep, WorkflowStepStatus } from '../../domain/entities/workflow-step.entity';
import { StepType } from '../../domain/value-objects/step-type.vo';
import { assertValidStepType } from '../../domain/value-objects/step-type.vo';
import type {
  IWorkflowInstanceRepository,
  IWorkflowStepRepository,
  IWorkflowLogRepository,
  FindInstancesByResourceResult,
  FindStepsByInstanceResult,
  WorkflowLogEntry,
} from '../../ports/repository.port';

// ===========================================================================
// Workflow Instance Repository
// ===========================================================================

export class PrismaWorkflowInstanceRepository implements IWorkflowInstanceRepository {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async findById(
    instanceId: string,
    requestOrgId: string,
  ): Promise<WorkflowInstance | null> {
    const raw = await this._query('findUnique', {
      where: { id: instanceId, org_id: requestOrgId },
    });
    if (!raw) return null;
    return this._toDomain(raw);
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    requestOrgId: string,
  ): Promise<WorkflowInstance[]> {
    const rows = await this._query('findMany', {
      where: {
        ressource_type: resourceType,
        ressource_id: resourceId,
        org_id: requestOrgId,
      },
    });
    return Array.isArray(rows) ? rows.map(r => this._toDomain(r)) : [];
  }

  async findRunningInstances(requestOrgId: string): Promise<WorkflowInstance[]> {
    const rows = await this._query('findMany', {
      where: { statut: 'running', org_id: requestOrgId },
    });
    return Array.isArray(rows) ? rows.map(r => this._toDomain(r)) : [];
  }

  async save(entity: WorkflowInstance): Promise<void> {
    await this._execute('create', this._toPersistence(entity));
  }

  async update(entity: WorkflowInstance): Promise<void> {
    await this._execute('update', {
      where: { id: entity.id, org_id: entity.orgId },
      data: this._toPersistence(entity),
    });
  }

  // ---- Conversion helpers ----

  private _toDomain(row: Record<string, unknown>): WorkflowInstance {
    return new WorkflowInstance({
      id: String(row.id),
      orgId: String(row.org_id),
      resourceType: String(row.ressource_type ?? ''),
      resourceId: String(row.ressource_id ?? ''),
      definitionKey: String(row.definition_key ?? ''),
      currentStepIndex: Number(row.etape_courante ?? 0),
      totalSteps: Number(row.total_etapes ?? 0),
      status: (String(row.statut) as WorkflowInstanceStatus) || WorkflowInstanceStatus.Running,
      createdAt: new Date(String(row.created_at)),
      completionDate: row.date_completion ? new Date(String(row.date_completion)) : null,
      cancellationDate: row.date_annulation ? new Date(String(row.date_annulation)) : null,
      expirationDate: row.date_ecoulement ? new Date(String(row.date_ecoulement)) : null,
      version: Number(row.version) || 1,
    });
  }

  private _toPersistence(instance: WorkflowInstance): Record<string, unknown> {
    return {
      id: instance.id,
      org_id: instance.orgId,
      ressource_type: instance.resourceType,
      ressource_id: instance.resourceId,
      definition_key: instance.definitionKey,
      etape_courante: instance.currentStepIndex,
      total_etapes: instance.totalSteps,
      statut: instance.status,
      created_at: instance.createdAt.toISOString(),
      date_completion: instance.completionDate?.toISOString() ?? null,
      date_annulation: instance.cancellationDate?.toISOString() ?? null,
      date_ecoulement: instance.expirationDate?.toISOString() ?? null,
      version: instance.version,
    };
  }

  private async _query(action: string, params: Record<string, unknown>): Promise<unknown | unknown[]> {
    throw new Error('PrismaWorkflowInstanceRepository requires a PrismaClient instance at composition root.');
  }

  private async _execute(action: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaWorkflowInstanceRepository requires a PrismaClient instance at composition root.');
  }
}

// ===========================================================================
// Workflow Step Repository
// ===========================================================================

export class PrismaWorkflowStepRepository implements IWorkflowStepRepository {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async findById(stepId: string, requestOrgId: string): Promise<WorkflowStep | null> {
    const raw = await this._query('findUnique', {
      where: { id: stepId, org_id: requestOrgId },
    });
    if (!raw) return null;
    return this._toDomain(raw);
  }

  async findByInstanceId(
    instanceId: string,
    requestOrgId: string,
  ): Promise<WorkflowStep[]> {
    const rows = await this._query('findMany', {
      where: { instance_id: instanceId, org_id: requestOrgId },
      orderBy: { ordre: 'asc' },
    });
    return Array.isArray(rows) ? rows.map(r => this._toDomain(r)) : [];
  }

  async findPendingOrInProgressSteps(requestOrgId: string): Promise<WorkflowStep[]> {
    const rows = await this._query('findMany', {
      where: {
        org_id: requestOrgId,
        statut: { in: ['pending', 'in_progress'] },
      },
      orderBy: { ordre: 'asc' },
    });
    return Array.isArray(rows) ? rows.map(r => this._toDomain(r)) : [];
  }

  async save(entity: WorkflowStep): Promise<void> {
    await this._execute('create', this._toPersistence(entity));
  }

  async update(entity: WorkflowStep): Promise<void> {
    await this._execute('update', {
      where: { id: entity.id, org_id: entity.orgId },
      data: this._toPersistence(entity),
    });
  }

  // ---- Conversion helpers ----

  private _toDomain(row: Record<string, unknown>): WorkflowStep {
    return new WorkflowStep({
      id: String(row.id),
      instanceId: String(row.instance_id),
      order: Number(row.ordre ?? 0),
      type: assertValidStepType(String(row.type_etape ?? 'auto')),
      assigneeRole: String(row.assigne_a_role ?? ''),
      status: (String(row.statut) as WorkflowStepStatus) || WorkflowStepStatus.Pending,
      timeoutDays: Number(row.timeout_jours) || 1,
      approvalComment: row.commentaire_approbation ? String(row.commentaire_approbation) : null,
      rejectionReason: null,
      expirationDate: row.date_ecoulement ? new Date(String(row.date_ecoulement)) : null,
      executedBy: null,
      createdAt: new Date(String(row.created_at)),
      updatedAt: new Date(String(row.updated_at ?? row.created_at)),
    });
  }

  private _toPersistence(step: WorkflowStep): Record<string, unknown> {
    return {
      id: step.id,
      instance_id: step.instanceId,
      ordre: step.order,
      type_etape: step.type,
      assigne_a_role: step.assigneeRole,
      statut: step.status,
      timeout_jours: step.timeoutDays,
      commentaire_approbation: step.approvalComment ?? null,
      updated_at: step.updatedAt.toISOString(),
    };
  }

  private async _query(action: string, params: Record<string, unknown>): Promise<unknown | unknown[]> {
    throw new Error('PrismaWorkflowStepRepository requires a PrismaClient instance at composition root.');
  }

  private async _execute(action: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaWorkflowStepRepository requires a PrismaClient instance at composition root.');
  }
}

// ===========================================================================
// Workflow Log Repository
// ===========================================================================

export class PrismaWorkflowLogRepository implements IWorkflowLogRepository {
  constructor(
    private readonly prisma: unknown, // PrismaClient injected at composition root
  ) {}

  async findByInstanceId(
    instanceId: string,
    requestOrgId: string,
  ): Promise<WorkflowLogEntry[]> {
    const rows = await this._query('findMany', {
      where: { instance_id: instanceId, org_id: requestOrgId },
      orderBy: { date_heure: 'asc' },
    });
    if (!Array.isArray(rows)) return [];

    return rows.map((r: Record<string, unknown>) => ({
      id: String(r.id),
      instanceId: String(r.instance_id),
      stepId: r.etape_id ? String(r.etape_id) : null,
      action: String(r.action),
      executedBy: String(r.execute_par),
      comment: r.commentaire ? String(r.commentaire) : null,
      occurredAt: new Date(String(r.date_heure)),
    }));
  }

  async save(entry: Omit<WorkflowLogEntry, 'id'> & { id?: string }): Promise<string> {
    await this._execute('create', {
      instance_id: entry.instanceId,
      etape_id: entry.stepId ?? null,
      action: entry.action,
      execute_par: entry.executedBy,
      commentaire: entry.comment ?? null,
      date_heure: entry.occurredAt.toISOString(),
      org_id: '', // set by ORM layer from tenant context
    });
    return String(entry.id ?? '');
  }

  private async _query(action: string, params: Record<string, unknown>): Promise<unknown | unknown[]> {
    throw new Error('PrismaWorkflowLogRepository requires a PrismaClient instance at composition root.');
  }

  private async _execute(action: string, data: Record<string, unknown>): Promise<void> {
    throw new Error('PrismaWorkflowLogRepository requires a PrismaClient instance at composition root.');
  }
}
