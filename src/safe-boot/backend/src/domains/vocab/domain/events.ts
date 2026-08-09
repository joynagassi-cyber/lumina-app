/**
 * Vocabulary Domain Events
 *
 * All events defined per DOC-014 registry.
 * Each event implements the shared DomainEvent contract.
 *
 * @traceability DOC-012 Aggregate8 §DomainEvents
 *   → TermAdded, TermValueDeprecated, LabelUpdated, TranslationResolved
 */

import { DomainEvent } from '../../../shared/events';

// ---- Term Added Events ----

export class TermAdded extends DomainEvent {
  override readonly eventType = 'TermAdded';
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    termId: string,
    namespaceId: string,
    orgId: string,
    termKey: string,
    labelFr: string,
    labelEn: string,
    occurredAt?: Date,
  ) {
    super('TermAdded', occurredAt);
    this.aggregateId = termId;
    this.payload = {
      namespace_id: namespaceId,
      org_id: orgId,
      term_key: termKey,
      label_fr: labelFr,
      label_en: labelEn,
    };
  }
}

export class TermValueAdded extends DomainEvent {
  override readonly eventType = 'TermValueAdded';
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    valueId: string,
    termId: string,
    orgId: string,
    valueKey: string,
    labelFr: string,
    labelEn: string,
    colorHex: string | null,
    occurredAt?: Date,
  ) {
    super('TermValueAdded', occurredAt);
    this.aggregateId = valueId;
    this.payload = {
      term_id: termId,
      org_id: orgId,
      value_key: valueKey,
      label_fr: labelFr,
      label_en: labelEn,
      color_hex: colorHex,
    };
  }
}

// ---- Deprecation Events ----

export class TermDepreciated extends DomainEvent {
  override readonly eventType = 'TermDepreciated';
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    termId: string,
    namespaceId: string,
    orgId: string,
    termKey: string,
    occurredAt?: Date,
  ) {
    super('TermDepreciated', occurredAt);
    this.aggregateId = termId;
    this.payload = {
      namespace_id: namespaceId,
      org_id: orgId,
      term_key: termKey,
    };
  }
}

export class TermValueDeprecated extends DomainEvent {
  override readonly eventType = 'TermValueDeprecated';
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    valueId: string,
    termId: string,
    orgId: string,
    valueKey: string,
    occurredAt?: Date,
  ) {
    super('TermValueDeprecated', occurredAt);
    this.aggregateId = valueId;
    this.payload = {
      term_id: termId,
      org_id: orgId,
      value_key: valueKey,
    };
  }
}

// ---- Label Update Events ----

export class LabelUpdated extends DomainEvent {
  override readonly eventType = 'LabelUpdated';
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    entityId: string,
    entityType: 'term' | 'value',
    locale: 'fr' | 'en',
    newLabel: string,
    occurredAt?: Date,
  ) {
    super('LabelUpdated', occurredAt);
    this.aggregateId = entityId;
    this.payload = {
      entity_type: entityType,
      locale,
      new_label: newLabel,
    };
  }
}

// ---- Resolution Events ----

export class TranslationResolved extends DomainEvent {
  override readonly eventType = 'TranslationResolved';
  readonly aggregateId: string;
  readonly payload: Record<string, unknown>;

  constructor(
    resolvedFrom: string,       // namespace:term_key or namespace:value_key
    locale: 'fr' | 'en',
    resolvedLabel: string,
    isDeprecated: boolean,
    occurredAt?: Date,
  ) {
    super('TranslationResolved', occurredAt);
    this.aggregateId = resolvedFrom;
    this.payload = {
      locale,
      resolved_label: resolvedLabel,
      is_deprecated: isDeprecated,
    };
  }
}
