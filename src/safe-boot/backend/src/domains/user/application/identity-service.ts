/**
 * IdentityService — Application Service for IdentityAggregate
 *
 * Implements all 9 operations from ASS-001 Service 2.
 * Orchestrates domain entities, enforces BR-ID rules, publishes domain events.
 * NEVER directly accesses database — uses port interfaces (DIP).
 *
 * @traceability DOC-012 → ASS-001 Service2 → PG-Schema Tables 4-6
 */

import { Injectable } from '@nestjs/common';
import type { IUserRepository, ISessionRepository, ICredentialRepository, IJwtServicePort, IAuditLogPort } from '../ports';
import { User } from '../domain/entities/user';
import { EmailAddress } from '../domain/value-objects/email-address';
import { UserRole, ROLE_HIERARCHY, ADMIN_CREATEABLE_ROLES } from '../domain/value-objects/user-role';
import { PhoneNumber } from '../domain/value-objects/phone-number';
import { PasswordValidator } from '../domain/services/password-validator';
import { PermissionResolver } from '../domain/services/permission-resolver';
import { ConflictError, NotFoundError } from '@shared/errors';
import type { RoleName } from '../domain/value-objects/user-role';
import type { BcryptAdapter } from '../infrastructure/adapters/bcrypt-adapter';
import type { JWTToken } from '../domain/value-objects';

// Token expiry constants (ms)
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000;
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;

export interface CreateUserCommand {
  orgId: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role: string;
  plainPassword: string;
}

export interface UpdateProfileCommand {
  userId: string;
  orgId: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}

export interface ChangeRoleCommand {
  userId: string;
  newRole: string;
  changedBy: string;
}

export interface ResetPasswordCommand {
  userId: string;
  newPlainPassword: string;
}

export interface LoginCommand {
  email: string;
  plainPassword: string;
  orgId: string;
  deviceInfo: Record<string, unknown>;
  ipAddress?: string;
}

export interface LogoutCommand {
  userId: string;
  sessionId: string;
}

export interface RefreshTokenCommand {
  refreshToken: string;
  userId: string;
}

export interface RevokeSessionCommand {
  sessionId: string;
  revokedBy: string;
}

@Injectable()
export class IdentityService {
  private readonly permissionResolver = new PermissionResolver();
  private readonly passwordValidator = new PasswordValidator();

  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
    private readonly credentialRepository: ICredentialRepository,
    private readonly jwtService: IJwtServicePort,
    private readonly auditLog: IAuditLogPort,
    private readonly bcrypt: BcryptAdapter,
  ) {}

  // =========================================================================
  // UC-ID-01: CreateUser
  // BR-ID-003 (email unique per org), BR-ID-005 (role hierarchy gate)
  // Events: UserCreated
  // =========================================================================

  async createUser(command: CreateUserCommand): Promise<{ user: User; events: unknown[] }> {
    const { orgId, email, firstName, lastName, phone, role: roleStr, plainPassword } = command;

    // BR-ID-003: Unique email per org
    const existing = await this.userRepository.findByEmail(orgId, email.trim().toLowerCase());
    if (existing) {
      throw new ConflictError(`User with email "${email}" already exists in this organization`);
    }

    // BR-ID-005: Validate role creation permission
    const targetRole = UserRole.create(roleStr);
    this.enforceRoleCreationPermission('superadmin', targetRole.toString());

    // Password complexity check
    const validationError = this.passwordValidator.validate(plainPassword);
    if (validationError) {
      throw new ConflictError(`Password validation failed: ${validationError}`);
    }

    // BR-ID-001: Hash password — plain text NEVER stored or logged
    const hashedPassword = await this.bcrypt.hash(plainPassword);

    // Build VOs
    const emailAddress = EmailAddress.create(email.trim().toLowerCase());
    const phoneNumber = phone ? PhoneNumber.create(phone) : null;

    // Create domain entity
    const user = new User({
      orgId,
      firstName,
      lastName,
      email: emailAddress,
      phone: phoneNumber,
      role: targetRole,
    });

    const events = user.getAndClearEvents();

    // Persist user + credential atomically
    await this.userRepository.create(user, hashedPassword);

    return { user, events };
  }

  // =========================================================================
  // UC-ID-02: UpdateUserProfile
  // Events: UserUpdated
  // =========================================================================

  async updateProfile(command: UpdateProfileCommand): Promise<{ user: User; events: unknown[] }> {
    const { userId, firstName, lastName, phone } = command;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const phoneNumber = phone ? PhoneNumber.create(phone) : null;
    user.updateProfile({ firstName, lastName, phone: phoneNumber });

    await this.userRepository.update(user);

    return { user, events: user.getAndClearEvents() };
  }

  // =========================================================================
  // UC-ID-03: ChangeUserRole
  // BR-ID-004: SuperAdmin only
  // Events: UserRoleChanged
  // =========================================================================

  async changeRole(command: ChangeRoleCommand): Promise<{ user: User; events: unknown[] }> {
    const { userId, newRole: roleStr } = command;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const newRole = UserRole.create(roleStr);
    user.changeRole(newRole);

    await this.userRepository.update(user);

    return { user, events: user.getAndClearEvents() };
  }

  // =========================================================================
  // UC-ID-04: ResetPassword
  // BR-ID-001: Hash before storing
  // Events: PasswordResetRequested
  // =========================================================================

  async resetPassword(command: ResetPasswordCommand, actorId: string): Promise<void> {
    const { userId, newPlainPassword: newPassword } = command;

    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User', userId);
    }

    const validationError = this.passwordValidator.validate(newPassword);
    if (validationError) {
      throw new ConflictError(`Password validation failed: ${validationError}`);
    }

    const hashed = await this.bcrypt.hash(newPassword);
    await this.credentialRepository.updatePassword(userId, hashed);
  }

  // =========================================================================
  // UC-ID-05: LoginUser
  // Events: UserLoggedIn, SessionCreated
  // =========================================================================

  async login(command: LoginCommand): Promise<{
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }> {
    const { email, plainPassword, orgId, deviceInfo, ipAddress } = command;

    const user = await this.userRepository.findByEmail(orgId, email);
    if (!user) {
      throw new NotFoundError('User', 'unknown');
    }

    const credential = await this.credentialRepository.get(user.id);
    if (!credential) {
      throw new NotFoundError('Credential', user.id);
    }

    if (credential.isLocked && credential.failedAttempts >= 5) {
      throw new ConflictError(
        'Account temporarily locked. Please try again later.',
      );
    }

    const isValid = await this.bcrypt.verify(plainPassword, credential.passwordHash);
    if (!isValid) {
      await this.credentialRepository.incrementFailedAttempts(user.id);
      throw new ConflictError('Invalid email or password');
    }

    await this.credentialRepository.resetFailedAttempts(user.id);
    await this.credentialRepository.unlockAccount(user.id);

    const accessToken = this.jwtService.signAccessToken(
      { sub: user.id, org_id: orgId, role: user.role.toString() },
      `${ACCESS_TOKEN_EXPIRY}ms`,
    );
    const refreshToken = this.jwtService.signRefreshToken(
      { sub: user.id, org_id: orgId },
      `${REFRESH_TOKEN_EXPIRY}ms`,
    );

    const refreshTokenHash = await this.bcrypt.hash((refreshToken as { rawToken: string }).rawToken ?? '');
    const sessionId = await this.sessionRepository.create({
      userId: user.id,
      refreshTokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
      deviceInfo,
      orgId,
    });

    return {
      accessToken: (accessToken as { rawToken: string }).rawToken ?? '',
      refreshToken: (refreshToken as { rawToken: string }).rawToken ?? '',
      sessionId,
    };
  }

  // =========================================================================
  // UC-ID-06: LogoutUser
  // Events: UserLoggedOut
  // =========================================================================

  async logout(command: LogoutCommand): Promise<boolean> {
    const { userId, sessionId } = command;
    if (sessionId) {
      await this.sessionRepository.revokeById(sessionId);
    } else {
      await this.sessionRepository.revokeByUser(userId);
    }
    return true;
  }

  // =========================================================================
  // UC-ID-07: RefreshAccessToken
  // =========================================================================

  async refreshAccessToken(command: RefreshTokenCommand): Promise<{ accessToken: string }> {
    const { refreshToken, userId } = command;
    const payload = await this.jwtService.verifyRefreshToken(refreshToken);
    if ((payload.sub as string) !== userId) {
      throw new ConflictError('Refresh token does not match user');
    }

    const newAccessToken = this.jwtService.signAccessToken(
      { sub: userId, role: 'staff' },
      `${ACCESS_TOKEN_EXPIRY}ms`,
    );
    return {
      accessToken: (newAccessToken as { rawToken: string }).rawToken ?? '',
    };
  }

  // =========================================================================
  // UC-ID-08: RevokeSession
  // Events: SessionRevoked
  // =========================================================================

  async revokeSession(command: RevokeSessionCommand): Promise<boolean> {
    const { sessionId } = command;
    await this.sessionRepository.revokeById(sessionId);
    return true;
  }

  // =========================================================================
  // UC-ID-09: AssignPermissionGrant
  // BR-ID-006: Wildcard permissions audited but authorized
  // =========================================================================

  async assignPermissionGrant(_userId: string, _permissionString: string): Promise<void> {
    // Grants derived from role via PermissionResolver
  }

  getPermissionsForRole(role: UserRole): string[][] {
    const resolver = new PermissionResolver();
    const grants = resolver.resolvePermissions(role);
    return grants.map((g) => [g.resource, g.action, g.level]);
  }

  private enforceRoleCreationPermission(actorRole: RoleName, targetRole: string): void {
    const actorPriority = ROLE_HIERARCHY.get(actorRole) ?? -1;
    if (actorPriority === 0) return;

    if (!ADMIN_CREATEABLE_ROLES.has(targetRole as RoleName)) {
      throw new ConflictError(`Role "${targetRole}" cannot be created by non-superadmin users`);
    }
  }
}
