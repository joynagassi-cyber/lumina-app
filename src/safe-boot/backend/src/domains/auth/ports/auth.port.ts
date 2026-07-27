/**
 * Auth Port — repository contracts for Auth domain operations
 *
 * Defines persistence interfaces for sessions, credentials, and MFA data.
 * Infrastructure adapters (Prisma) implement these contracts.
 * Dependency Inversion Principle: domain depends on abstraction, not concrete storage.
 *
 * @traceability DOC-012 IdentityAggregate → PG-Schema Tables 5 (sessions), 6 (credentials)
 *   → PAS-v1 Port Abstraction pattern
 */

import { AuthSession } from '../domain/entities/auth-session.entity';
import type { MFASecret } from '../domain/value-objects/mfa-secret.vo';

/**
 * Repository for session persistence operations.
 * All operations scoped to org_id per NB-MT-002.
 */
export interface ISessionRepository {
  create(params: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
    orgId: string;
  }): Promise<string>;

  findById(sessionId: string): Promise<AuthSession | null>;
  findByRefreshTokenHash(hash: string): Promise<{
    sessionId: string;
    userId: string;
    expiresAt: Date;
    orgId: string;
  } | null>;

  findByUserId(userId: string): Promise<AuthSession[]>;
  countActiveByUserId(userId: string): Promise<number>;

  revokeById(sessionId: string): Promise<boolean>;
  revokeByUser(userId: string, revokedBy: string): Promise<number>;
}

/**
 * Repository for credential storage (password hashes).
 */
export interface ICredentialRepository {
  create(params: {
    userId: string;
    passwordHash: string;
    orgId: string;
  }): Promise<void>;

  getByUserId(userId: string): Promise<{
    passwordHash: string;
    failedAttempts: number;
    isLocked: boolean;
    lastLoginAt: Date | null;
  } | null>;

  updatePassword(params: {
    userId: string;
    newPasswordHash: string;
  }): Promise<void>;

  incrementFailedAttempts(userId: string): Promise<void>;
  resetFailedAttempts(userId: string): Promise<void>;
  unlockAccount(userId: string): Promise<void>;
}

/**
 * Repository for MFA secret persistence.
 */
export interface IMfaRepository {
  getSecretByUserId(userId: string): Promise<MFASecret | null>;
  saveSecret(params: {
    userId: string;
    encodedSecret: string;
    provisioningUri: string;
  }): Promise<void>;
  deleteSecret(userId: string): Promise<void>;
}
