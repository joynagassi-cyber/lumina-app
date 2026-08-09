/**
 * IdentityService Unit Tests — Positive Cases
 *
 * Tests the 9 operations of the canonical IdentityService
 * (createUser, updateProfile, changeRole, resetPassword, login, logout,
 * refreshAccessToken, revokeSession, assignPermissionGrant).
 * @traceability DOC-012 ASS-001 Service 2, API-CONTRACT-001
 */

import { IdentityService } from '@/domains/user/application/identity-service';
import { IUserRepository, ISessionRepository, ICredentialRepository, IJwtServicePort, IAuditLogPort } from '@/domains/user/ports';
import { User } from '@/domains/user/domain/entities/user';
import { EmailAddress } from '@/domains/user/domain/value-objects/email-address';
import { UserRole } from '@/domains/user/domain/value-objects/user-role';
import { BcryptAdapter } from '@/domains/user/infrastructure/adapters/bcrypt-adapter';
import { ConflictError, NotFoundError } from '@/shared/errors';

describe('IdentityService', () => {
  let service: IdentityService;
  let userRepo: jest.Mocked<IUserRepository>;
  let sessionRepo: jest.Mocked<ISessionRepository>;
  let credRepo: jest.Mocked<ICredentialRepository>;
  let jwt: jest.Mocked<IJwtServicePort>;
  let audit: jest.Mocked<IAuditLogPort>;
  let bcrypt: jest.Mocked<BcryptAdapter>;

  beforeEach(() => {
    userRepo = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findAllByOrg: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    } as any;
    sessionRepo = {
      create: jest.fn(),
      findByRefreshTokenHash: jest.fn(),
      revokeById: jest.fn(),
      revokeByUser: jest.fn(),
      expireOldSessions: jest.fn(),
      findById: jest.fn(),
    } as any;
    credRepo = {
      create: jest.fn(),
      get: jest.fn(),
      updatePassword: jest.fn(),
      incrementFailedAttempts: jest.fn(),
      resetFailedAttempts: jest.fn(),
      unlockAccount: jest.fn(),
    } as any;
    jwt = {
      signAccessToken: jest.fn(),
      verifyAccessToken: jest.fn(),
      signRefreshToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    } as any;
    audit = { log: jest.fn() } as any;
    bcrypt = {
      hash: jest.fn(),
      verify: jest.fn(),
    } as any;

    service = new IdentityService(userRepo, sessionRepo, credRepo, jwt, audit, bcrypt);
  });

  function makeUser(overrides: Partial<ConstructorParameters<typeof User>[0]> = {}): User {
    return new User({
      orgId: 'org-1',
      firstName: 'John',
      lastName: 'Doe',
      email: EmailAddress.create('test@example.com'),
      role: UserRole.create('staff'),
      ...overrides,
    });
  }

  // ======================================================================
  // UC-ID-01: createUser
  // ======================================================================
  describe('createUser', () => {
    const validCommand = {
      orgId: 'org-1',
      email: 'test@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      role: 'staff',
      plainPassword: 'SecurePass123!',
    };

    it('should create user and persist with hashed password (positive)', async () => {
      userRepo.findByEmail.mockResolvedValue(null);
      bcrypt.hash.mockResolvedValue('hashed-xyz');

      const result = await service.createUser(validCommand);

      expect(result.user).toBeTruthy();
      expect(result.user.email.value).toBe('test@example.com');
      expect(result.user.role.toString()).toBe('staff');
      expect(bcrypt.hash).toHaveBeenCalledWith('SecurePass123!');
      expect(userRepo.create).toHaveBeenCalledWith(expect.any(User), 'hashed-xyz');
      // UserCreated event emitted by the aggregate
      expect(result.events.length).toBeGreaterThan(0);
    });

    it('should reject when email already exists in org (BR-ID-003)', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser() as any);

      await expect(service.createUser(validCommand)).rejects.toThrow(ConflictError);
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('should reject weak passwords before persisting', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.createUser({ ...validCommand, plainPassword: 'weak' }),
      ).rejects.toThrow(ConflictError);
      expect(userRepo.create).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // UC-ID-02: updateProfile
  // ======================================================================
  describe('updateProfile', () => {
    it('should update user profile successfully (positive)', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.updateProfile({ userId: user.id, orgId: 'org-1', firstName: 'Jane' });

      expect(result.user.firstName).toBe('Jane');
      expect(userRepo.update).toHaveBeenCalledWith(expect.any(User));
    });

    it('should throw NotFoundError when user does not exist', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateProfile({ userId: 'non-existent', orgId: 'org-1', firstName: 'Jane' }),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ======================================================================
  // UC-ID-03: changeRole
  // ======================================================================
  describe('changeRole', () => {
    it('should change user role successfully (positive)', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);
      userRepo.update.mockResolvedValue(undefined);

      const result = await service.changeRole({ userId: user.id, newRole: 'treasurer', changedBy: 'admin-1' });

      expect(result.user.role.toString()).toBe('treasurer');
      expect(userRepo.update).toHaveBeenCalledWith(expect.any(User));
    });

    it('should throw NotFoundError when target user is missing', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.changeRole({ userId: 'non-existent', newRole: 'staff', changedBy: 'admin-1' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should reject unknown role values', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);

      await expect(
        service.changeRole({ userId: user.id, newRole: 'invalidRole', changedBy: 'admin-1' }),
      ).rejects.toThrow(/Invalid UserRole/);
    });
  });

  // ======================================================================
  // UC-ID-04: resetPassword
  // ======================================================================
  describe('resetPassword', () => {
    it('should hash and persist the new password (positive)', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);
      bcrypt.hash.mockResolvedValue('hashed-new-pass');
      credRepo.updatePassword.mockResolvedValue(undefined);

      await service.resetPassword({ userId: user.id, newPlainPassword: 'NewPass123!' }, 'admin-1');

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPass123!');
      expect(credRepo.updatePassword).toHaveBeenCalledWith(user.id, 'hashed-new-pass');
    });

    it('should reject weak new password', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);

      await expect(
        service.resetPassword({ userId: user.id, newPlainPassword: 'weak' }, 'admin-1'),
      ).rejects.toThrow(ConflictError);
      expect(credRepo.updatePassword).not.toHaveBeenCalled();
    });

    it('should throw NotFoundError when user is missing', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.resetPassword({ userId: 'non-existent', newPlainPassword: 'NewPass123!' }, 'admin-1'),
      ).rejects.toThrow(NotFoundError);
    });
  });

  // ======================================================================
  // UC-ID-05: login
  // ======================================================================
  describe('login', () => {
    const loginCommand = {
      email: 'test@example.com',
      plainPassword: 'correctPassword',
      orgId: 'org-1',
      deviceInfo: { browser: 'Chrome' },
      ipAddress: '192.168.1.1',
    };

    beforeEach(() => {
      jwt.signAccessToken.mockReturnValue({ rawToken: 'access-token-123' } as any);
      jwt.signRefreshToken.mockReturnValue({ rawToken: 'refresh-token-456' } as any);
    });

    it('should authenticate and return tokens + session (positive)', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue({
        passwordHash: 'hashed-xyz',
        failedAttempts: 0,
        isLocked: false,
        lastLoginAt: null,
      });
      bcrypt.verify.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('session-hash-123');
      sessionRepo.create.mockResolvedValue('session-123');

      const result = await service.login(loginCommand);

      expect(result).toEqual(expect.objectContaining({
        accessToken: 'access-token-123',
        refreshToken: 'refresh-token-456',
        sessionId: 'session-123',
      }));
      expect(credRepo.resetFailedAttempts).toHaveBeenCalledWith(user.id);
      expect(credRepo.unlockAccount).toHaveBeenCalledWith(user.id);
      expect(sessionRepo.create).toHaveBeenCalledWith(expect.objectContaining({ userId: user.id }));
    });

    it('should throw NotFoundError when user is unknown', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginCommand)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when credential record is missing', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue(null);

      await expect(service.login(loginCommand)).rejects.toThrow(NotFoundError);
    });

    it('should reject locked account', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue({
        passwordHash: 'hashed-xyz',
        failedAttempts: 5,
        isLocked: true,
        lastLoginAt: null,
      });

      await expect(service.login(loginCommand)).rejects.toThrow(/locked/i);
    });

    it('should reject wrong password and increment failed attempts', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue({
        passwordHash: 'hashed-xyz',
        failedAttempts: 0,
        isLocked: false,
        lastLoginAt: null,
      });
      bcrypt.verify.mockResolvedValue(false);

      await expect(service.login(loginCommand)).rejects.toThrow('Invalid email or password');
      expect(credRepo.incrementFailedAttempts).toHaveBeenCalledWith(user.id);
    });
  });

  // ======================================================================
  // UC-ID-06: logout
  // ======================================================================
  describe('logout', () => {
    it('should revoke the session when sessionId is provided', async () => {
      sessionRepo.revokeById.mockResolvedValue(true);

      const result = await service.logout({ userId: 'user-1', sessionId: 'session-123' });

      expect(result).toBe(true);
      expect(sessionRepo.revokeById).toHaveBeenCalledWith('session-123');
      expect(sessionRepo.revokeByUser).not.toHaveBeenCalled();
    });

    it('should revoke all user sessions when sessionId is absent', async () => {
      sessionRepo.revokeByUser.mockResolvedValue(3);

      const result = await service.logout({ userId: 'user-1', sessionId: '' });

      expect(result).toBe(true);
      expect(sessionRepo.revokeByUser).toHaveBeenCalledWith('user-1');
    });
  });

  // ======================================================================
  // UC-ID-07: refreshAccessToken
  // ======================================================================
  describe('refreshAccessToken', () => {
    it('should mint a new access token (positive)', async () => {
      jwt.verifyRefreshToken.mockResolvedValue({ sub: 'user-1', org_id: 'org-1' });
      jwt.signAccessToken.mockReturnValue({ rawToken: 'new-access-token' } as any);

      const result = await service.refreshAccessToken({ refreshToken: 'old-refresh-token', userId: 'user-1' });

      expect(result).toEqual({ accessToken: 'new-access-token' });
    });

    it('should reject when token subject does not match the user', async () => {
      jwt.verifyRefreshToken.mockResolvedValue({ sub: 'user-2', org_id: 'org-1' });

      await expect(
        service.refreshAccessToken({ refreshToken: 'old-refresh-token', userId: 'user-1' }),
      ).rejects.toThrow('Refresh token does not match user');
    });
  });

  // ======================================================================
  // UC-ID-08: revokeSession
  // ======================================================================
  describe('revokeSession', () => {
    it('should revoke the session and return true', async () => {
      sessionRepo.revokeById.mockResolvedValue(true);

      const result = await service.revokeSession({ sessionId: 'session-123', revokedBy: 'admin-1' });

      expect(result).toBe(true);
      expect(sessionRepo.revokeById).toHaveBeenCalledWith('session-123');
    });
  });

  // ======================================================================
  // UC-ID-09: assignPermissionGrant + getPermissionsForRole
  // ======================================================================
  describe('permissions', () => {
    it('should expose permissions derived from the role manifest', () => {
      const adminPermissions = service.getPermissionsForRole(UserRole.create('admin'));
      expect(adminPermissions).toContainEqual(['finance', 'read', '*']);
      expect(adminPermissions).toContainEqual(['finance', 'write', '*']);
    });

    it('should expose the full wildcard for superadmin', () => {
      const superadminPermissions = service.getPermissionsForRole(UserRole.create('superadmin'));
      expect(superadminPermissions).toContainEqual(['*', '*', '*']);
    });
  });
});
