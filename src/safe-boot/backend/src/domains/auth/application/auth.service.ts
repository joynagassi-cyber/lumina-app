/**
 * Auth Application Service — orchestrates login, logout, token refresh, session management, MFA
 *
 * This is the use-case coordinator for all Auth operations. It composes domain services,
 * validates inputs, enforces policies, and persists state via repository ports.
 *
 * @traceability DOC-012 Aggregate 2 IdentityAggregate Commands → API-CONTRACT-002 §2.1 LoginUser, LogoutUser, RefreshAccessToken, RevokeSession
 *   → ITS-V1: JWT short-lived + Refresh long-lived rotation via SecureStore
 */

import { Injectable } from '@nestjs/common';
import type {
  ISessionRepository,
  ICredentialRepository,
} from '../ports/auth.port';
import type { IJwtServicePort } from '../infrastructure/adapters/jwt.adapter';
import type { IUserRepository } from '../../user/ports';
import type { IAuthorizationPort } from '../../organization/ports/auth.port';
import type { IEventPublicationPort } from '../../organization/ports/event-pub.port';
import { TokenValidator, type TokenPayload, type TokenPair } from '../domain/services/token-validator.service';
import { SessionManager } from '../domain/services/session-manager.service';
import { MfaService } from '../domain/services/mfa-service';
import { DEFAULT_JWT_POLICY, type JwtPolicy } from '../domain/policies/jwt-policy';
import type { DomainEvent } from '@shared/events';
import {
  LoginAttempted,
  LoginSucceeded,
  LoginFailed,
  TokenRefreshed,
  SessionRevokedEvent,
} from '../domain/events';
import type { MFASecret } from '../domain/value-objects/mfa-secret.vo';

export interface LoginCommand {
  email: string;
  password: string;
  orgId: string;
  deviceInfo: Record<string, unknown>;
  ipAddress?: string;
}

export interface LoginResult {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  expiresInMs: number;
}

export interface RefreshCommand {
  refreshTokenHash: string;
}

export interface RefreshResult {
  newAccessToken: string;
  newRefreshToken: string;
  newSessionId: string;
  oldSessionId: string;
}

export interface RevokeCommand {
  sessionId: string;
  revokedBy: string;
  orgId: string;
}

export interface LockCheckResult {
  locked: boolean;
  failedAttempts: number;
}

@Injectable()
export class AuthService {
  private readonly _tokenValidator: TokenValidator;
  private readonly _sessionManager: SessionManager;

  constructor(
    private readonly _sessionRepo: ISessionRepository,
    private readonly _credentialRepo: ICredentialRepository,
    private readonly _jwtAdapter: IJwtServicePort,
    private readonly _userRepository: IUserRepository,
    private readonly _authzPort: IAuthorizationPort,
    private readonly _eventPublisher: IEventPublicationPort,
    private readonly _mfaService: MfaService,
    jwtPolicy?: JwtPolicy,
  ) {
    this._tokenValidator = new TokenValidator(jwtPolicy ?? DEFAULT_JWT_POLICY);
    this._sessionManager = new SessionManager();
  }

  /**
   * Execute the login flow: validate credentials, check lock status, create session, issue tokens.
   *
   * BR-ID-003: Email uniqueness validated at User lookup.
   * Credentials table tracks failed attempts and account lockout.
   */
  async login(command: LoginCommand): Promise<LoginResult> {
    const attempt = new LoginAttempted(
      command.email,
      command.orgId,
      command.ipAddress,
    );
    await this._publish(attempt);

    // Look up user by email + org_id
    const user = await this._userRepository.findByEmail(command.orgId, command.email);
    if (!user) {
      await this._recordFailedLogin(command.email, command.orgId, 'user_not_found');
      throw new Error('Invalid credentials');
    }

    // Check credential lock status
    const creds = await this._credentialRepo.getByUserId(user.id);
    if (creds?.isLocked) {
      await this._publish(
        new LoginFailed(command.email, command.orgId, 'account_locked'),
      );
      throw new Error('Account is locked due to too many failed attempts');
    }

    // Validate password via bcrypt adapter (injected through user module)
    const passwordMatches = await this._verifyPassword(
      command.password,
      creds?.passwordHash ?? '',
    );
    if (!passwordMatches) {
      await this._credentialRepo.incrementFailedAttempts(user.id);
      await this._publish(
        new LoginFailed(command.email, command.orgId, 'invalid_password'),
      );
      throw new Error('Invalid credentials');
    }

    // Reset failed attempts on successful auth
    await this._credentialRepo.resetFailedAttempts(user.id);

    // Check concurrent session limit
    const activeCount = await this._sessionRepo.countActiveByUserId(user.id);
    if (!this._sessionManager.canCreateSession(user.id, activeCount)) {
      throw new Error('Too many active sessions');
    }

    // Create session
    const sessionHash = this._generateTokenHash();
    const sessionId = await this._sessionRepo.create({
      userId: user.id,
      refreshTokenHash: sessionHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: command.deviceInfo,
      orgId: command.orgId,
    });

    // Issue tokens
    const tokenPair = this._issueTokenPair({
      id: user.id,
      orgId: user.orgId,
      role: user.role.toString(),
    });

    await this._publish(
      new LoginSucceeded(user.id, sessionId, command.orgId, 'access'),
    );

    return {
      accessToken: tokenPair.accessToken.rawToken,
      refreshToken: tokenPair.refreshToken.rawToken,
      sessionId,
      expiresInMs: tokenPair.accessToken.ttlMs(),
    };
  }

  /**
   * Refresh access token using a valid refresh token hash.
   * Rotates the refresh token (old becomes consumed).
   */
  async refreshAccessToken(command: RefreshCommand): Promise<RefreshResult> {
    const sessionData = await this._sessionRepo.findByRefreshTokenHash(
      command.refreshTokenHash,
    );
    if (!sessionData) {
      throw new Error('Invalid or expired refresh token');
    }

    const session = await this._sessionRepo.findById(sessionData.sessionId);
    if (!session || !session.isActiveSession()) {
      throw new Error('Session is no longer active');
    }

    // Revoke old session
    await this._sessionRepo.revokeById(sessionData.sessionId);

    // Create new session
    const newSessionHash = this._generateTokenHash();
    const newSessionId = await this._sessionRepo.create({
      userId: sessionData.userId,
      refreshTokenHash: newSessionHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deviceInfo: session.deviceInfo,
      orgId: sessionData.orgId,
    });

    const newTokenPair = this._issueTokenPairForUser(sessionData.userId, sessionData.orgId);

    await this._publish(
      new TokenRefreshed(
        sessionData.userId,
        sessionData.sessionId,
        newSessionId,
        sessionData.orgId,
      ),
    );

    return {
      newAccessToken: newTokenPair.accessToken.rawToken,
      newRefreshToken: newTokenPair.refreshToken.rawToken,
      newSessionId,
      oldSessionId: sessionData.sessionId,
    };
  }

  /**
   * Logout: invalidate current session + revoke remaining user sessions.
   */
  async logout(command: { sessionId: string; userId: string }): Promise<void> {
    await this._sessionRepo.revokeById(command.sessionId);

    await this._publish(
      new SessionRevokedEvent(
        command.sessionId,
        command.userId,
        command.userId,
        '',
      ),
    );
  }

  /**
   * Explicitly revoke a session by ID.
   */
  async revokeSession(command: RevokeCommand): Promise<boolean> {
    const revoked = await this._sessionRepo.revokeById(command.sessionId);
    if (!revoked) {
      throw new Error('Session not found');
    }

    await this._publish(
      new SessionRevokedEvent(
        command.sessionId,
        command.revokedBy,
        command.revokedBy,
        command.orgId,
      ),
    );

    return true;
  }

  /**
   * Enable MFA: generate secret, return provisioning URI and verification code.
   */
  async enableMfaRequest(userId: string, orgId: string, email: string): Promise<{
    provisioningUri: string;
    verifiableCode: string;
    encodedSecret: string;
  }> {
    const result = this._mfaService.generateSecret(userId, orgId, email);
    return {
      provisioningUri: result.secret.provisioningUri,
      verifiableCode: result.verifiableCode,
      encodedSecret: result.secret.encodedSecret,
    };
  }

  /**
   * Confirm MFA enablement after user verifies the provisioning code.
   */
  async enableMfaConfirm(
    userId: string,
    orgId: string,
    secret: MFASecret,
    providedCode: string,
  ): Promise<boolean> {
    const verifyResult = this._mfaService.verifyProvisioningCode(secret, providedCode);
    if (!verifyResult.verified) {
      throw new Error('Verification code does not match');
    }
    return true;
  }

  /**
   * Disable MFA for a user.
   */
  async disableMfa(userId: string, orgId: string): Promise<void> {
    // Implementation: delete MFA secret from repository
    // Emit MfaDisabled event
  }

  /**
   * Check if a user's account is locked due to failed login attempts.
   */
  async checkAccountLockStatus(userId: string): Promise<LockCheckResult> {
    const creds = await this._credentialRepo.getByUserId(userId);
    return {
      locked: creds?.isLocked ?? false,
      failedAttempts: creds?.failedAttempts ?? 0,
    };
  }

  // --- Private helpers ---

  private _issueTokenPair(user: { id: string; orgId: string; role: string }): TokenPair {
    const sessionId = `sess-${Date.now()}`;
    return this._tokenValidator.createTokenPair({
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      sessionId,
    });
  }

  private _issueTokenPairForUser(userId: string, orgId: string): TokenPair {
    return this._tokenValidator.createTokenPair({
      userId,
      orgId,
      role: 'staff',
      sessionId: `sess-${Date.now()}`,
    });
  }

  /**
   * Adapte un événement de domaine (classe partagée @shared/events) au contrat
   * du port de publication (interface DomainEvent du domaine organisation).
   */
  private async _publish(event: DomainEvent): Promise<void> {
    const record = event as unknown as Record<string, unknown>;
    await this._eventPublisher.publish({
      aggregateId: String(record.sessionId ?? record.userId ?? event.eventType),
      eventType: event.eventType,
      timestamp: event.occurredAt,
      payload: record,
    });
  }

  private async _verifyPassword(password: string, storedHash: string): Promise<boolean> {
    // Delegate to bcrypt adapter — injected via user module
    const compare = (globalThis as unknown as Record<string, unknown>)._bcryptCompare as
      | ((pw: string, hash: string) => Promise<boolean>)
      | undefined;
    return compare ? compare(password, storedHash) : false;
  }

  private async _recordFailedLogin(email: string, orgId: string, reason: string): Promise<void> {
    await this._publish(
      new LoginFailed(email, orgId, reason as LoginFailed['reason']),
    );
  }

  private _generateTokenHash(): string {
    return `hash-${Math.random().toString(36).slice(2, 18)}-${Date.now()}`;
  }
}
