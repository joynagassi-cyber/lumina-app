/**
 * SensitiveFormLockPolicy
 *
 * Financial forms are locked read-only after submission except by admins.
 * This policy enforces INV-011: sensitive form data immutability post-submission.
 *
 * @traceability DOC-012 Aggregate6 §Policies-SensitiveFormLockPolicy
 *   → BR-FRM-004 (Form versioning) combined with financial lock requirement
 */

import type { RoleType } from '../../ports/auth.port';

export class FormLockedError extends Error {
  constructor(formKey: string, reason: string) {
    super(`INV-011: Form '${formKey}' is locked — ${reason}`);
    this.name = 'FormLockedError';
  }
}

export interface FormSubmissionRecord {
  readonly id: string;
  readonly formKey: string;
  readonly submittedBy: string;
  readonly submittedAt: Date;
  readonly isApproved: boolean;
}

export class SensitiveFormLockPolicy {
  /**
   * Models of forms considered "sensitive" (financial).
   * These are configured via manifest.configuration.sensitive_form_models[].
   */
  private static readonly SENSITIVE_MODEL_REF_PATTERN = /^(finance|treasury|payment|expense)/i;

  /**
   * Check if a model reference is considered sensitive for lock purposes.
   */
  static isSensitiveModel(modelRef: string): boolean {
    return SensitiveFormLockPolicy.SENSITIVE_MODEL_REF_PATTERN.test(modelRef);
  }

  /**
   * Assert that the current user may modify a submitted sensitive form.
   * Only admins and form publishers may write after submission.
   * All others get FormLockedError.
   *
   * @param submissionExists — true if the form has already been submitted
   * @param userId — the ID of the user requesting modification
   * @param publisherId — who published/submitted the original form (may be null)
   * @param userRole — the role of the requesting user
   */
  static assertWritable(
    submissionExists: boolean,
    userId: string,
    publisherId: string | null,
    userRole: RoleType,
  ): void {
    if (!submissionExists) {
      // Not yet submitted — always writable
      return;
    }

    // Admin-level roles can always modify
    if (userRole === 'superadmin' || userRole === 'admin') {
      return;
    }

    // Publishers can modify their own submissions
    if (publisherId && userId === publisherId) {
      return;
    }

    // All other users are locked out
    throw new FormLockedError(
      'form_submission',
      'This form has been submitted and is locked. Only admins or the original publisher may modify it.',
    );
  }

  /**
   * Determine if a form definition should trigger the sensitivity check.
   * Called before any write operation on a form submission.
   */
  static requiresLockCheck(definitionKey: string, modelRef: string): boolean {
    return this.isSensitiveModel(modelRef);
  }
}
