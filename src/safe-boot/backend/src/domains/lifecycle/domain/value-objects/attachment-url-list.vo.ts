/**
 * AttachmentUrlList — validated list of attachment URLs for archive entries.
 *
 * @traceability DOC-012 Aggregate11 §VO-AttachmentUrlList
 *   → POSTGRESQL-SCHEMA-PACK-v1 archives.url_pieces_jointes text[]
 */

export interface AttachmentUrlListProps {
  readonly urls: string[];
}

const MAX_ATTACHMENTS = 100;

/**
 * Immutable value object representing a list of attachment URLs.
 * Enforces max 100 URLs per BR-LIF-004 cardinality convention.
 */
export class AttachmentUrlList {
  private readonly _urls: ReadonlyArray<string>;

  constructor(urls?: string[]) {
    const filtered = (urls ?? []).filter((u) => {
      try {
        new URL(u);
        return true;
      } catch {
        return false;
      }
    });

    if (filtered.length > MAX_ATTACHMENTS) {
      throw new InvalidAttachmentUrlListError(
        `Maximum ${MAX_ATTACHMENTS} attachments allowed, got ${filtered.length}.`,
      );
    }

    this._urls = Object.freeze(filtered);
  }

  get urls(): ReadonlyArray<string> {
    return this._urls;
  }

  get size(): number {
    return this._urls.length;
  }

  isEmpty(): boolean {
    return this._urls.length === 0;
  }

  add(url: string): AttachmentUrlList {
    if (this._urls.length >= MAX_ATTACHMENTS) {
      throw new InvalidAttachmentUrlListError(
        `Cannot add more than ${MAX_ATTACHMENTS} attachments.`,
      );
    }
    try {
      new URL(url);
    } catch {
      throw new InvalidAttachmentUrlListError(`Invalid URL: "${url}"`);
    }
    return new AttachmentUrlList([...this._urls, url]);
  }
}

/**
 * Error thrown when the attachment URL list exceeds limits or contains invalid URLs.
 */
export class InvalidAttachmentUrlListError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAttachmentUrlListError';
  }
}
