/**
 * IdentityService Unit Tests — Exception/Failure Cases
 *
 * Tests error handling and failure scenarios for IdentityService operations.
 * @traceability DOC-012 BR-ID-001 through BR-ID-006
 */

import { IdentityService } from '@/domains/user/application/identity-service';
import { IUserRepository, ISessionRepository, ICredentialRepository, IJwtServicePort, IAuditLogPort } from '@/domains/user/ports';
import { User } from '@/domains/user/domain/entities/user';
import { EmailAddress } from '@/domains/user/domain/value-objects/email-address';
import { UserRole } from '@/domains/user/domain/value-objects/user-role';
import { BcryptAdapter } from '@/domains/user/infrastructure/adapters/bcrypt-adapter';
import { ConflictError, NotFoundError } from '@/shared/errors';

describe('IdentityService — Exception Cases', () => {
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
  // createUser — Exception Cases
  // ======================================================================
  describe('createUser — Exception Cases', () => {
    it('should throw ConflictError on duplicate email (org-scoped, BR-ID-003)', async () => {
      userRepo.findByEmail.mockResolvedValue(makeUser() as any);

      await expect(
        service.createUser({
          orgId: 'org-1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'staff',
          plainPassword: 'SecurePass123!',
        }),
      ).rejects.toThrow(ConflictError);
      expect(userRepo.create).not.toHaveBeenCalled();
    });

    it('should throw ConflictError when the password does not meet complexity', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.createUser({
          orgId: 'org-1',
          email: 'test@example.com',
          firstName: 'John',
          lastName: 'Doe',
          role: 'staff',
          plainPassword: 'short',
        }),
      ).rejects.toThrow(/Password validation failed/);
    });
  });

  // ======================================================================
  // changeRole — Exception Cases
  // ======================================================================
  describe('changeRole — Exception Cases', () => {
    it('should throw NotFoundError when the target user is missing', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.changeRole({ userId: 'non-existent', newRole: 'staff', changedBy: 'admin-1' }),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw when the target role is not a valid UserRole', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);

      await expect(
        service.changeRole({ userId: user.id, newRole: 'emperor', changedBy: 'admin-1' }),
      ).rejects.toThrow(/Invalid UserRole/);
    });
  });

  // ======================================================================
  // resetPassword — Exception Cases
  // ======================================================================
  describe('resetPassword — Exception Cases', () => {
    it('should throw NotFoundError when user is missing', async () => {
      userRepo.findById.mockResolvedValue(null);

      await expect(
        service.resetPassword({ userId: 'non-existent', newPlainPassword: 'NewPass123!' }, 'admin-1'),
      ).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError for a weak new password', async () => {
      const user = makeUser();
      userRepo.findById.mockResolvedValue(user);

      await expect(
        service.resetPassword({ userId: user.id, newPlainPassword: 'weak' }, 'admin-1'),
      ).rejects.toThrow(ConflictError);
      expect(credRepo.updatePassword).not.toHaveBeenCalled();
    });
  });

  // ======================================================================
  // login — Exception Cases
  // ======================================================================
  describe('login — Exception Cases', () => {
    const loginCommand = {
      email: 'test@example.com',
      plainPassword: 'password',
      orgId: 'org-1',
      deviceInfo: {},
    };

    it('should throw NotFoundError when the user does not exist', async () => {
      userRepo.findByEmail.mockResolvedValue(null);

      await expect(service.login(loginCommand)).rejects.toThrow(NotFoundError);
    });

    it('should throw NotFoundError when the credential record is missing', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue(null);

      await expect(service.login(loginCommand)).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError when the account is locked', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue({
        passwordHash: 'hashed-xyz',
        failedAttempts: 5,
        isLocked: true,
        lastLoginAt: null,
      });

      await expect(service.login(loginCommand)).rejects.toThrow('Account temporarily locked');
    });

    it('should throw ConflictError on wrong password and record the attempt', async () => {
      const user = makeUser();
      userRepo.findByEmail.mockResolvedValue(user);
      credRepo.get.mockResolvedValue({
        passwordHash: 'hashed-xyz',
        failedAttempts: 2,
        isLocked: false,
        lastLoginAt: null,
      });
      bcrypt.verify.mockResolvedValue(false);

      await expect(service.login(loginCommand)).rejects.toThrow('Invalid email or password');
      expect(credRepo.incrementFailedAttempts).toHaveBeenCalledWith(user.id);
    });
  });

  // ======================================================================
  // refreshAccessToken — Exception Cases
  // ======================================================================
  describe('refreshAccessToken — Exception Cases', () => {
    it('should throw ConflictError when the token subject mismatches the user', async () => {
      jwt.verifyRefreshToken.mockResolvedValue({ sub: 'user-2', org_id: 'org-1' });

      await expect(
        service.refreshAccessToken({ refreshToken: 'token', userId: 'user-1' }),
      ).rejects.toThrow('Refresh token does not match user');
    });
  });
});
