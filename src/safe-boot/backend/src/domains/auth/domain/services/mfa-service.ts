/**
 * MFA Service — domain service for TOTP-based multi-factor authentication
 *
 * Handles MFA secret generation, provisioning URI creation, code verification,
 and enable/disable lifecycle.
 *
 * @traceability DOC-012 IdentityAggregate MFA capability → RFC 6238 TOTP
 *   → External TOTP library (node otpauth / speakeasy integration point)
 */

import { MFASecret } from '../value-objects/mfa-secret.vo';

export type MfaState = 'disabled' | 'provisioning' | 'enabled' | 'revoked';

export interface MfaEnableResult {
  state: 'provisioning';
  secret: MFASecret;
  verifiableCode: string;
  userId: string;
  orgId: string;
}

export interface MfaDisableResult {
  state: 'disabled';
  userId: string;
  orgId: string;
}

export interface MfaVerifyResult {
  verified: boolean;
  state: MfaState;
}

export class MfaService {
  /**
   * Generate a new MFA secret for a user. Returns provisioning info.
   * The user must verify with a code before state transitions to 'enabled'.
   */
  generateSecret(userId: string, orgId: string, email: string): MfaEnableResult {
    const encodedSecret = this._generateBase32Secret();
    const provisioningUri = `otpauth://totp/${encodeURIComponent(email)}?secret=${encodedSecret}&issuer=Lumina`;
    const verifiableCode = encodedSecret.slice(-6);

    const secret = MFASecret.create({
      encodedSecret,
      provisioningUri,
      verifiableCode,
    });

    return {
      state: 'provisioning',
      secret,
      verifiableCode,
      userId,
      orgId,
    };
  }

  /**
   * Verify the user-provided code against the stored secret.
   */
  verifyProvisioningCode(
    secret: MFASecret,
    providedCode: string,
  ): MfaVerifyResult {
    const valid = secret.verifyCode(providedCode);
    return {
      verified: valid,
      state: valid ? 'enabled' : 'provisioning',
    };
  }

  /**
   * Disable MFA for a user. Returns deactivated secret.
   */
  disableMfa(secret: MFASecret, userId: string, orgId: string): MfaDisableResult {
    const deactivated = secret.deactivate();
    return {
      state: 'disabled',
      userId,
      orgId,
    };
  }

  /**
   * Validate a TOTP code for an enabled MFA session.
   * In production, this delegates to a TOTP library using the stored secret.
   */
  validateTOTPCode(_storedSecret: string, _providedCode: string): boolean {
    // Stub — integrate with node-otpauth or speakeasy in infrastructure layer
    return false;
  }

  private _generateBase32Secret(): string {
    // Generate a random 16-byte base32-encoded secret.
    // Production: use crypto.randomBytes(20).toString('base32').
    const chars = 'JBSWY3DPEHPK3PXP';
    const bytes = 20;
    let result = '';
    for (let i = 0; i < bytes; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }
}
