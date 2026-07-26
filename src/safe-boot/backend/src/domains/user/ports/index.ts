/**
 * User Domain Ports — IdentityAggregate contract interfaces
 *
 * Defines the abstraction boundary between domain layer and infrastructure.
 * Implements Port & Adapter pattern (PAS-v1).
 * Infrastructure adapters implement these interfaces; domain depends on none.
 *
 * @traceability DOC-012 Aggregate2 → PAS-v1 §3.1
 */

import type { User } from '../domain/entities/user';
import type { SessionContext, JWTToken } from '../domain/value-objects';

/**
 * Repository port for persisting User entities.
 * All CRUD operations are scoped to org_id (NB-MT-001).
 */
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(orgId: string, email: string): Promise<User | null>;
  findAllByOrg(orgId: string, page: number, limit: number): Promise<{ data: User[]; total: number }>;
  create(user: User, credentialHash: string): Promise<void>;
  update(user: User): Promise<void>;
  delete(id: string): Promise<boolean>;
}

/**
 * Session persistence port.
 * Manages session records in the sessions table.
 */
export interface ISessionRepository {
  create(params: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
    orgId: string;
  }): Promise<string>;
  findByRefreshTokenHash(hash: string): Promise<{
    sessionId: string;
    userId: string;
    expiresAt: Date;
    orgId: string;
  } | null>;
  revokeById(sessionId: string): Promise<boolean>;
  revokeByUser(userId: string): Promise<number>;
  expireOldSessions(maxAgeMs: number): Promise<number>;
  findById(id: string): Promise<{
    isActive: boolean;
    userId: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
    orgId: string;
  } | null>;
}

/**
 * Credential management port.
 * Handles password hashing and verification — NEVER stores plain text.
 * BR-ID-001 enforcement at persistence level.
 */
export interface ICredentialRepository {
  create(userId: string, passwordHash: string, orgId: string): Promise<void>;
  get(userId: string): Promise<{
    passwordHash: string;
    failedAttempts: number;
    isLocked: boolean;
    lastLoginAt: Date | null;
  } | null>;
  updatePassword(userId: string, newPasswordHash: string): Promise<void>;
  incrementFailedAttempts(userId: string): Promise<void>;
  resetFailedAttempts(userId: string): Promise<void>;
  unlockAccount(userId: string): Promise<void>;
}

/**
 * JWT token generation/revoke port.
 * Tokens are ephemeral — never stored plain on client.
 * BR-ID-002 enforcement.
 */
export interface IJwtServicePort {
  signAccessToken(payload: Record<string, unknown>, expiresIn: string): JWTToken;
  verifyAccessToken(token: string): Promise<Record<string, unknown>>;
  signRefreshToken(payload: Record<string, unknown>, expiresIn: string): JWTToken;
  verifyRefreshToken(token: string): Promise<Record<string, unknown>>;
}

/**
 * Audit logging port — delegates to AuditAggregate.
 * All identity operations MUST be logged.
 */
export interface IAuditLogPort {
  log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    oldValues: Record<string, unknown>,
    newValues: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void>;
}
