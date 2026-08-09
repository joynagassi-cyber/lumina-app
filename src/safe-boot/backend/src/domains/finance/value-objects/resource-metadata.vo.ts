/**
 * ResourceMetadata — extensible JSONB metadata container.
 *
 * @traceability DOC-012 Aggregate3 (ResourceMetadata VO)
 * @invariant All keys are strings, values are serializable primitives or plain objects
 */

export interface MetadataMap {
  [key: string]: MetadataValue;
}

export type MetadataValue = string | number | boolean | null | MetadataValue[] | MetadataMap;

export class ResourceMetadata {
  private _data: Record<string, MetadataValue>;

  constructor(initial?: Record<string, MetadataValue>) {
    this._data = initial ?? {};
  }

  get(key: string): MetadataValue | undefined {
    return this._data[key];
  }

  set(key: string, value: MetadataValue): void {
    this._data[key] = value;
  }

  delete(key: string): boolean {
    if (!(key in this._data)) return false;
    delete this._data[key];
    return true;
  }

  has(key: string): boolean {
    return key in this._data;
  }

  toObject(): Record<string, MetadataValue> {
    return { ...this._data };
  }

  isEmpty(): boolean {
    return Object.keys(this._data).length === 0;
  }
}
