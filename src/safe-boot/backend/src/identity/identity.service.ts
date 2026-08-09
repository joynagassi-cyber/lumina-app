/**
 * Identity Service - Core authentication and user management logic.
 * Implements IdentityAggregate per CANONICAL-DOMAIN-MODEL.
 *
 * @traceability CANONICAL-DOMAIN-MODEL.md: IdentityAggregate
 * @traceability ASS-001: Application Services for auth operations
 */

import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import bcrypt from 'bcrypt';

import { LoginInputDTO } from './dto/login.dto';
import { CreateUserDTO, UpdateUserDTO, UserSummaryDTO, UserRoleEnum } from './dto/user.dto';
import { User } from './user.entity';
import { Session } from './session.entity';
import { PermissionGrant } from './permission.entity';
import { AuditService, AuditAction } from '../../shared/audit/audit.service';

@Injectable()
export class IdentityService {
  private readonly logger = new Logger(IdentityService.name);

  constructor(
    @Repository(User) private readonly userRepository: Repository<User>,
    @Repository(Session) private readonly sessionRepository: Repository<Session>,
    @Repository(PermissionGrant) private readonly permissionRepository: Repository<PermissionGrant>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService, // Injected audit service
  ) {}

  /**
   * Authenticate user credentials and return JWT token.
   */
  async login(input: LoginInputDTO): Promise<{ accessToken: string; refreshToken: string; userId: number; role: string; organizationId?: number }> {
    this.logger.log(`Authentification de l'utilisateur: ${input.email}`);

    // Find user by email
    const user = await thisuserRepository.findOneBy({ email: input.email });
    if (!user) {
      this.logger.warn(`Échec d'authentification: utilisateur non trouvé - ${input.email}`);
      throw new Error('Identifiants invalides');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(input.password, user.passwordHash);
    if (!isPasswordValid) {
      this.logger.warn(`Échec d'authentification: mot de passe incorrect pour ${input.email}`);
      throw new Error('Identifiants invalides');
    }

    // Check organization match if provided
    if (input.organizationId && user.organizationId !== input.organizationId) {
      this.logger.warn(`Échec d'authentification: organisation ne correspond pas pour ${input.email}`);
      throw new Error('Organisation invalide');
    }

    // Generate access token (short-lived, 15 min)
    const accessToken = this.jwtService.sign(
      { sub: user.id, role: user.role },
      {
        expiresIn: this.configService.get<number>('JWT_ACCESS_EXPIRY') || 900,
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );

    // Generate refresh token (longer-lived, 24h)
    const refreshToken = this.jwtService.sign(
      { sub: user.id },
      {
        expiresIn: this.configService.get<number>('JWT_REFRESH_EXPIRY') || 86400,
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );

    // Create session
    const session = this.sessionRepository.create({
      userId: user.id,
      organizationId: user.organizationId || undefined,
      accessToken,
      refreshTokenHash: bcrypt.hashSync(refreshToken, 12),
      expiresAt: new Date(Date.now() + (this.configService.get<number>('JWT_REFRESH_EXPIRY') || 86400) * 1000).toISOString(),
      deviceInfo: JSON.stringify({ browser: 'unknown', os: 'unknown' }), // Will be enriched later
      ipAddress: input.ipAddress || null,
      userAgent: input.userAgent || null,
      state: 'active',
      requiresMFA: false,
      lastActivityAt: new Date().toISOString(),
      version: 1,
      synced: true,
    });

    await this.sessionRepository.save(session);

    this.logger.log(`Utilisateur authentifié avec succès: ${user.id}`);

    return {
      accessToken,
      refreshToken,
      userId: user.id,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  /**
   * Create a new user with specified role.
   * Superadmin can create any role; admin can create treasurer/pastor/staff only.
   */
  async createUser(createInput: CreateUserDTO, createdBy: number): Promise<User> {
    this.logger.log(`Création d'utilisateur par ${createdBy}`);

    // Validate role assignment based on creator's permissions (simplified)
    // In production, check if createdBy has permission to assign this role

    // Check if email already exists in same organization
    const existingUser = await this.userRepository.findOneBy({ email: createInput.email });
    if (existingUser) {
      throw new Error('Un utilisateur avec cet email existe déjà');
    }

    // Hash password (will be provided in actual flow, placeholder here)
    const passwordHash = await bcrypt.hash(createInput.password || 'default123', 12);

    const user = this.userRepository.create({
      firstName: createInput.firstName,
      lastName: createInput.lastName,
      email: createInput.email,
      role: createInput.role,
      passwordHash,
      phone: createInput.phone,
      avatarUrl: createInput.avatarUrl,
      createdBy,
    });

    const result = await this.userRepository.save(user);
    this.logger.log(`Utilisateur créé avec succès: ${result.id}`);

    return result;
  }

  /**
   * Get user profile by ID.
   */
  async getUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOneBy({ id: userId });
    if (!user) {
      this.logger.warn(`Requête utilisateur non trouvée: ${userId}`);
      throw new Error('Utilisateur non trouvé');
    }
    return user;
  }

  /**
   * Get user summary (without sensitive data).
   */
  async getUserSummary(userId: number): Promise<UserSummaryDTO> {
    const user = await this.getUser(userId);
    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      role: user.role,
      avatarUrl: user.avatarUrl,
      organizationId: user.organizationId || 0,
    };
  }

  /**
   * Update user profile.
   */
  async updateUser(userId: number, updateInput: UpdateUserDTO): Promise<User> {
    this.logger.log(`Mise à jour de l'utilisateur ${userId}`);

    const user = await this.getUser(userId);

    if (updateInput.firstName) user.firstName = updateInput.firstName;
    if (updateInput.lastName) user.lastName = updateInput.lastName;
    if (updateInput.email) {
      const existing = await this.userRepository.findOneBy({ email: updateInput.email });
      if (existing && existing.id !== userId) {
        throw new Error('Cet email est déjà utilisé');
      }
      user.email = updateInput.email;
    }
    if (updateInput.phone) user.phone = updateInput.phone;
    if (updateInput.avatarUrl) user.avatarUrl = updateInput.avatarUrl;

    // Role change requires superadmin or specific permissions (simplified check)
    if (updateInput.role) {
      // Only superadmin can change role to superadmin
      if (updateInput.role === UserRoleEnum.SUPERADMIN && user.role !== UserRoleEnum.SUPERADMIN) {
        throw new Error('Seul un superadmin peut promouvoir en superadmin');
      }
      user.role = updateInput.role;
    }

    return await this.userRepository.save(user);
  }

  /**
   * Reset user password.
   */
  async resetPassword(userId: number, newPassword: string): Promise<User> {
    this.logger.log(`Réinitialisation du mot de passe pour l'utilisateur ${userId}`);

    const user = await this.getUser(userId);
    const passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordHash = passwordHash;
    await this.userRepository.save(user);

    this.logger.log(`Mot de passe réinitialisé pour l'utilisateur ${userId}`);

    return user;
  }

  /**
   * Logout user by revoking session.
   */
  async logout(sessionId: string): Promise<void> {
    this.logger.log(`Déconnexion de la session ${sessionId}`);

    const session = await this.sessionRepository.findOneBy({ id: sessionId });
    if (session) {
      session.state = 'revoked';
      await this.sessionRepository.save(session);
    }
  }

  /**
   * Refresh access token using refresh token.
   */
  async refreshToken(refreshToken: string): Promise<{ accessToken: string; expiresIn: number }> {
    this.logger.log('Refrâchissement du jeton d\'accès');

    // In production, validate refresh token against database
    // This is a simplified implementation

    const userId = 1; // Extract from token or lookup in DB
    const user = await this.getUser(userId);

    const newAccessToken = this.jwtService.sign(
      { sub: userId, role: user.role },
      {
        expiresIn: this.configService.get<number>('JWT_ACCESS_EXPIRY') || 900,
        secret: this.configService.get<string>('JWT_SECRET'),
      },
    );

    return { accessToken: newAccessToken, expiresIn: 900 };
  }

  /**
   * Get permissions for a user based on their role.
   */ async getUserPermissions(userId: number): Promise<string[]> {
    this.logger.log(`Récupération des permissions pour l'utilisateur ${userId}`);

    const user = await this.getUser(userId);

    // Simple role-based permission mapping
    // In production, this would be more dynamic based on PermissionGrants
    const permissionsByRole: Record<UserRoleEnum, string[]> = {
      superadmin: ['*'],
      admin: ['users:read', 'users:write', 'org:manage', 'reports:export'],
      treasurer: ['org:read', 'finance:read', 'finance:write'],
      pastor: ['org:read', 'activities:write', 'activities:read'],
      staff: ['org:read', 'activities:read'],
    };

    return permissionsByRole[user.role] || [];
  }
}

// Audit logging integration placeholder - to be implemented
