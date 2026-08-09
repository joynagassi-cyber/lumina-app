/**
 * Form Domain Events
 *
 * All events defined per DOC-014 registry for the FormAggregate.
 * Each event implements the DomainEvent contract from the event-pub port.
 *
 * @traceability DOC-012 Aggregate6 §DomainEvents
 *   → DOC-014 Event Registry → FormSubmitted, FormValidationFailed, FormSubmittedForApproval
 */

import type { DomainEvent } from '../ports/event-pub.port';

export class FormSubmitted implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'FormSubmitted';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    definitionId: string,
    orgId: string,
    formKey: string,
    modelRef: string,
    submittedBy: string,
    targetModelId: string | null,
    submissionData: Record<string, unknown>,
    timestamp: Date,
  ) {
    this.aggregateId = definitionId;
    this.timestamp = timestamp;
    this.payload = {
      org_id: orgId,
      form_key: formKey,
      model_ref: modelRef,
      submitted_by: submittedBy,
      target_model_id: targetModelId,
      submission_data: submissionData,
    };
  }
}

export class FormValidationFailed implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'FormValidationFailed';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    definitionId: string,
    formKey: string,
    errors: Array<{ field: string; message: string }>,
    timestamp: Date,
  ) {
    this.aggregateId = definitionId;
    this.timestamp = timestamp;
    this.payload = { form_key: formKey, validation_errors: errors };
  }
}

export class FormSubmittedForApproval implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'FormSubmittedForApproval';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    definitionId: string,
    formKey: string,
    submittedBy: string,
    approvers: string[],
    timestamp: Date,
  ) {
    this.aggregateId = definitionId;
    this.timestamp = timestamp;
    this.payload = {
      form_key: formKey,
      submitted_by: submittedBy,
      approvers,
    };
  }
}

export class FormDefinitionCreated implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'FormDefinitionCreated';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    definitionId: string,
    orgId: string,
    key: string,
    version: string,
    createdById: string,
    timestamp: Date,
  ) {
    this.aggregateId = definitionId;
    this.timestamp = timestamp;
    this.payload = {
      org_id: orgId,
      form_key: key,
      version,
      created_by: createdById,
    };
  }
}

export class FormPublished implements DomainEvent {
  readonly aggregateId: string;
  readonly eventType = 'FormPublished';
  readonly timestamp: Date;
  readonly payload: Record<string, unknown>;

  constructor(
    definitionId: string,
    publisherId: string,
    timestamp: Date,
  ) {
    this.aggregateId = definitionId;
    this.timestamp = timestamp;
    this.payload = { published_by: publisherId };
  }
}
