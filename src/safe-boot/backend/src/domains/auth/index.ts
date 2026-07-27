/**
 * Auth Domain — Aggregate 2 (IdentityAggregate) Auth operations
 *
 * Exposes all Auth domain types, services, ports, and infrastructure adapters.
 * This module handles login flow, token rotation, session management, MFA.
 * The Identity domain (User/Credential entities) owns user data; Auth owns the gates & guards.
 *
 * @traceability DOC-012 Aggregate 2 (IdentityAggregate) → Auth operations
 *   → API-CONTRACT-002 §2.1 LoginUser, LogoutUser, RefreshAccessToken, RevokeSession
 *   → ITS-V1: JWT short-lived + Refresh long-lived in SecureStore
 */

// --- Ports ---
export type {
  ISessionRepository,
  ICredentialRepository,
  IMfaRepository,
} from './ports/auth.port';

// --- Domain Events ---
export {
  LoginAttempted,
  LoginSucceeded,
  LoginFailed,
  TokenRefreshed,
  SessionRevokedEvent as SessionRevoked,
  MfaEnabled,
  MfaDisabled,
} from './domain/events';
export type { DomainEvent } from '@shared/events';

// --- Entities ---
export { AuthSession } from './domain/entities/auth-session.entity';
export type { AuthSessionProps } from './domain/entities/auth-session.entity';

// --- Value Objects ---
export { AuthToken } from './domain/value-objects/auth-token.vo';
export { RefreshToken } from './domain/value-objects/refresh-token.vo';
export { MFASecret } from './domain/value-objects/mfa-secret.vo';

// --- Policies ---
export { JwtPolicy, DEFAULT_JWT_POLICY } from './domain/policies/jwt-policy';
export { SessionPolicy, DEFAULT_SESSION_POLICY } from './domain/policies/session-policy';
export type { JwtPolicyParams } from './domain/policies/jwt-policy';
export type { SessionPolicyParams } from './domain/policies/session-policy';

// --- Domain Services ---
export { TokenValidator } from './domain/services/token-validator.service';
export type { TokenPayload, TokenPair } from './domain/services/token-validator.service';
export { SessionManager } from './domain/services/session-manager.service';
export { MfaService } from './domain/services/mfa-service';
export type {
  MfaState,
  MfaEnableResult,
  MfaDisableResult,
  MfaVerifyResult,
} from './domain/services/mfa-service';

// --- Application Layer ---
export { AuthService } from './application/auth.service';
export type {
  LoginCommand,
  LoginResult,
  RefreshCommand,
  RefreshResult,
  RevokeCommand,
  LockCheckResult,
} from './application/auth.service';

// --- Infrastructure Adapters ---
export { PrismaAuthSessionRepository } from './infrastructure/adapters/prisma-auth.repository';
export { JwtAdapter } from './infrastructure/adapters/jwt.adapter';
export type {
  JwtSignPayload,
  JwtVerifyPayload,
  IJwtServicePort,
} from './infrastructure/adapters/jwt.adapter';

// --- Module ---
export { AuthModule } from './auth.module';
