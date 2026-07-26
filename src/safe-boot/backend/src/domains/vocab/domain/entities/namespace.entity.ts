/**
 * Namespace Entity
 *
 * A top-level category grouping related vocabulary terms.
 * Examples: "finance", "common", "membership", "events", "lifecycle".
 * Namespaces are scoped per organization (org_id FK).
 *
 * @traceability DOC-012 Aggregate8 §Entity-Namespace
 *   → POSTGRESQL-SCHEMA-PACK-v1 Table 22: vocab_namespaces
 */

import { NamespaceKey } from '../value-objects/namespace-key.vo';

export interface NamespaceProps {
  readonly id: string;               // uuid PK
  readonly orgId: string;            // FK organizations
  readonly key: NamespaceKey;
  readonly description?: string;
  readonly createdAt: Date;
}

export class Namespace {
  private _props: NamespaceProps;

  constructor(props: NamespaceProps) {
    this._props = { ...props };
  }

  get id(): string { return this._props.id; }
  get orgId(): string { return this._props.orgId; }
  get key(): NamespaceKey { return this._props.key; }
  get description(): string | undefined { return this._props.description; }
  get createdAt(): Date { return this._props.createdAt; }

  /** Returns the namespace key as a plain string. */
  keyString(): string {
    return this._props.key.value;
  }
}
