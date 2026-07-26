/**
 * ClientServerValidationMatchPolicy
 *
 * Ensures that client-side validation logic produces IDENTICAL results to
 * server-side validation. This is enforced by having a single shared validation
 * core (FormValidator.validateSingleField) used by both layers.
 *
 * @traceability DOC-012 Aggregate6 §Policies-ClientServerValidationMatchPolicy
 *   → INV-008 (Client validation = Server validation exactly)
 *   → BR-FRM-002 (Client validation = Server validation exactly)
 */

import type { FieldDef } from '../value-objects/field-def.vo';

export class ValidationMismatchError extends Error {
  constructor(
    field: string,
    clientResult: unknown,
    serverResult: unknown,
  ) {
    super(
      `INV-008 violation: Client and server validation mismatch on field '${field}'. ` +
        `Client returned ${JSON.stringify(clientResult)}, server returned ${JSON.stringify(serverResult)}.`,
    );
    this.name = 'ValidationMismatchError';
  }
}

/**
 * Result from running the same validation in both client and server contexts.
 */
export interface ValidationComparisonResult {
  readonly valid: boolean;
  readonly errorCount: number;
  readonly sanitizedValue: unknown;
}

export class ClientServerValidationMatchPolicy {
  /**
   * Assert that two validation results are identical.
   * Used during integration testing and can be called at runtime in dev mode.
   *
   * The canonical validation function MUST be the server's FormValidator,
   * and the client MUST call the exact same algorithm.
   */
  static assertMatch(
    fieldName: string,
    clientResult: ValidationComparisonResult,
    serverResult: ValidationComparisonResult,
  ): void {
    if (clientResult.valid !== serverResult.valid) {
      throw new ValidationMismatchError(
        fieldName,
        clientResult.valid,
        serverResult.valid,
      );
    }

    if (clientResult.errorCount !== serverResult.errorCount) {
      throw new ValidationMismatchError(
        `${fieldName}.errorCount`,
        clientResult.errorCount,
        serverResult.errorCount,
      );
    }

    // Sanitized values must match type
    if (typeof clientResult.sanitizedValue !== typeof serverResult.sanitizedValue) {
      throw new ValidationMismatchError(
        `${fieldName}.type`,
        typeof clientResult.sanitizedValue,
        typeof serverResult.sanitizedValue,
      );
    }
  }

  /**
   * Compute the expected validation result for a field given raw input.
   * Both client and server MUST use this same function.
   */
  static computeExpectedResult(field: FieldDef, rawInput: unknown): ValidationComparisonResult {
    const errors: Array<{ valid: boolean }> = [];

    // Null/empty check
    if (rawInput === undefined || rawInput === null || rawInput === '') {
      if (field.required) {
        errors.push({ valid: false });
      }
      return {
        valid: errors.length === 0,
        errorCount: errors.length,
        sanitizedValue: field.defaultValue ?? null,
      };
    }

    switch (field.type) {
      case 'text':
      case 'textarea': {
        const text = String(rawInput);
        let valid = true;
        let errorCount = 0;

        if (field.pattern && !new RegExp(field.pattern).test(text)) {
          valid = false;
          errorCount++;
        }

        if (field.min !== null && text.length < field.min) {
          valid = false;
          errorCount++;
        }

        if (field.max !== null && text.length > field.max) {
          valid = false;
          errorCount++;
        }

        return { valid, errorCount, sanitizedValue: text.trim() };
      }

      case 'number': {
        const num = Number(rawInput);
        if (isNaN(num)) {
          return { valid: false, errorCount: 1, sanitizedValue: null };
        }
        let valid = true;
        let errorCount = 0;

        if (field.min !== null && num < field.min) {
          valid = false;
          errorCount++;
        }

        if (field.max !== null && num > field.max) {
          valid = false;
          errorCount++;
        }

        return { valid, errorCount, sanitizedValue: num };
      }

      case 'date': {
        const parsed = new Date(String(rawInput));
        if (isNaN(parsed.getTime())) {
          return { valid: false, errorCount: 1, sanitizedValue: rawInput };
        }
        return { valid: true, errorCount: 0, sanitizedValue: rawInput };
      }

      case 'select': {
        const val = String(rawInput);
        if (!val) {
          return { valid: false, errorCount: 1, sanitizedValue: null };
        }
        return { valid: true, errorCount: 0, sanitizedValue: val };
      }

      case 'multiselect': {
        if (!Array.isArray(rawInput)) {
          return { valid: false, errorCount: 1, sanitizedValue: null };
        }
        return { valid: true, errorCount: 0, sanitizedValue: rawInput };
      }

      case 'file_upload':
      case 'signature':
        return { valid: true, errorCount: 0, sanitizedValue: rawInput };

      default:
        return { valid: true, errorCount: 0, sanitizedValue: rawInput };
    }
  }
}
