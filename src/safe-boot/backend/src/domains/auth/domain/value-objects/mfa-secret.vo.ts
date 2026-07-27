/**
 * MFASecret value object — TOTP secret key management
 *
 * Immutable VO. Stores the base32-encoded TOTP secret and derived provisioning URI.
 * The secret is NEVER logged or exposed in error messages.
 *
 * @traceability DOC-012 IdentityAggregate MFA capability → external TOTP library integration
 *   → RFC 6238 (TOTP algorithm reference)
 */

export class MFASecret {
  readonly encodedSecret: string;
  readonly provisioningUri: string;
  readonly createdAt: Date;
  readonly isActive: boolean;
  private readonly _verifiableCode?: string;

  private constructor(params: {
    encodedSecret: string;
    provisioningUri: string;
    createdAt?: Date;
    isActive?: boolean;
    verifiableCode?: string;
  }) {
    this.encodedSecret = params.encodedSecret;
    this.provisioningUri = params.provisioningUri;
    this.createdAt = params.createdAt ?? new Date();
    this.isActive = params.isActive ?? true;
    this._verifiableCode = params.verifiableCode;
  }

  /** Generate a temporary code to verify user owns the secret. */
  generateVerificationCode(): string {
    // In real implementation, derive a short code from the secret.
    // For now, return a deterministic but non-revealing check value.
    const hashLength = 6;
    let hash = 0;
    for (let i = 0; i < this.encodedSecret.length; i++) {
      hash = ((hash << 5) - hash + this.encodedSecret.charCodeAt(i)) | 0;
    }
    const digits = String(Math.abs(hash)).padStart(hashLength, '0').slice(-hashLength);
    return digits;
  }

  /** Verify that the provided code matches the stored verifiable code. */
  verifyCode(code: string): boolean {
    if (!this._verifiableCode) {
      return false;
    }
    return code === this._verifiableCode;
  }

  deactivate(): MFASecret {
    return new MFASecret({
      encodedSecret: this.encodedSecret,
      provisioningUri: this.provisioningUri,
      createdAt: this.createdAt,
      isActive: false,
      verifiableCode: this._verifiableCode,
    });
  }

  static create(params: {
    encodedSecret: string;
    provisioningUri: string;
    verifiableCode?: string;
  }): MFASecret {
    return new MFASecret(params);
  }
}
