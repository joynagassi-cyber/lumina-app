/**
 * Sync DTOs — request/response contracts for sync API endpoints.
 *
 * @traceability DOC-012 Aggregate13, API-CONTRACT-005 (Error Taxonomy for sync errors)
 */

import { IsEnum, IsString, IsOptional, IsUUID, IsObject } from 'class-validator';
import { SyncAction } from '@domains/sync/value-objects/sync-action.vo';

export class CreatePendingOperationDto {
  @IsString()
  orgId!: string;

  @IsString()
  resourceType!: string;

  @IsUUID()
  resourceId!: string;

  @IsEnum(SyncAction)
  action!: SyncAction;

  @IsObject()
  payload!: Record<string, unknown>;
}

export class ConfirmOperationDto {
  @IsUUID()
  operationId!: string;
}

export class ResolveConflictDto {
  @IsString()
  orgId!: string;

  @IsString()
  resourceType!: string;

  @IsUUID()
  resourceId!: string;

  @IsObject()
  localPayload!: Record<string, unknown>;

  @IsObject()
  remotePayload!: Record<string, unknown>;
}

export class PushRequestDto {
  @IsString()
  orgId!: string;
}

export class PullRequestDto {
  @IsString()
  orgId!: string;

  @IsString()
  tableRef!: string;
}
