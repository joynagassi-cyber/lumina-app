/**
 * PhoneNumber value object — E.164 validation
 *
 * Immutable VO. Phone numbers stored in E.164 format.
 *
 * @traceability DOC-012 VO PhoneNumber → PG-Schema Table 4 telephone (varchar(30))
 */

export class PhoneNumber {
  private static readonly E164_REGEX = /^\+[1-9]\d{1,14}$/;

  readonly value: string;

  constructor(phone: string) {
    const normalized = phone.trim();
    if (!PhoneNumber.E164_REGEX.test(normalized)) {
      throw new Error(`Invalid phone number format: "${phone}". Must be E.164 format (e.g., +243XXXYYYYYY)`);
    }
    this.value = normalized;
  }

  toString(): string {
    return this.value;
  }

  static create(phone: string): PhoneNumber | null {
    if (!phone || phone.trim() === '') return null;
    try {
      return new PhoneNumber(phone);
    } catch {
      return null;
    }
  }
}
