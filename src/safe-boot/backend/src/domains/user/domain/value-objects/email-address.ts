/**
 * EmailAddress value object — RFC 5322 subset validation
 *
 * Immutable VO. Represents the user's primary email within an org.
 * BR-ID-003: composite unique (org_id, email) enforced by DB.
 *
 * @traceability DOC-012 VO EmailAddress → PG-Schema Table 4 adresse_email
 */

export class EmailAddress {
  private static readonly EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

  readonly value: string;

  constructor(email: string) {
    const normalized = email.trim().toLowerCase();
    if (!EmailAddress.EMAIL_REGEX.test(normalized)) {
      throw new Error(`Invalid email address format: "${email}"`);
    }
    if (normalized.length > 255) {
      throw new Error(`Email address exceeds 255 characters`);
    }
    this.value = normalized;
  }

  toString(): string {
    return this.value;
  }

  equals(other: EmailAddress): boolean {
    return this.value === other.value;
  }

  static create(email: string): EmailAddress {
    return new EmailAddress(email);
  }
}
