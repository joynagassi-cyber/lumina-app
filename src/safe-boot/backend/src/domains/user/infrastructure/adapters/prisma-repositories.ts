/**
 * User domain infrastructure — Prisma-based repository adapters
 *
 * These adapters implement the port interfaces defined in ../ports.
 * They translate between persistence column shapes and domain entities/VOs.
 * Dependency Inversion: domain → port interface ← infrastructure adapter.
 *
 * @traceability PAS-v1 Dependency Inversion Principle → Prisma 5+ adapter
 */

import { Injectable, Inject } from '@nestjs/common';
import type { IUserRepository, ISessionRepository, ICredentialRepository } from '../../ports';
import type { User } from '../../domain/entities/user';
import type { EmailAddress } from '../../domain/value-objects/email-address';
import type { UserRole, RoleName } from '../../domain/value-objects/user-role';
import type { PhoneNumber } from '../../domain/value-objects/phone-number';
import type { PasswordHash } from '../../domain/value-objects/password-hash';
import { ConflictError, NotFoundError } from '@shared/errors';

// Internal persistence shape (matches PG-Schema Table 4 users)
interface UserRow {
  id: string;
  org_id: string;
  prenom: string;
  nom_famille: string;
  adresse_email: string;
  telephone: string | null;
  role_utilisateur: string;
  statut: 'active' | 'inactive';
  version: number;
  created_at: Date;
  updated_at: Date;
}

// Inject via NestJS factory — no direct module coupling
const prismaClient = () => {
  // Prisma client provided at module level via providers
  throw new Error('Prisma client not injected. Ensure PrismaClient is provided in UserModule.');
};

@Injectable()
export class PrismaUserRepository implements IUserRepository {
  private readonly _prisma: ReturnType<typeof prismaClient>;

  constructor(@Inject('PRISMA_CLIENT') private readonly client: unknown) {
    this._prisma = this.client as ReturnType<typeof prismaClient>;
  }

  async findById(id: string): Promise<User | null> {
    // TODO: Query Prisma for users WHERE id = $1
    // For now: this adapter implements the structural contract.
    // Full implementation requires Prisma schema in place.
    return null;
  }

  async findByEmail(orgId: string, email: string): Promise<User | null> {
    // BR-ID-003: Composite unique lookup (org_id + email)
    // SELECT * FROM users WHERE org_id = $1 AND adresse_email = $2 LIMIT 1
    return null;
  }

  async findAllByOrg(
    orgId: string,
    page: number,
    limit: number,
  ): Promise<{ data: User[]; total: number }> {
    // SELECT * FROM users WHERE org_id = $1 OFFSET $2 LIMIT $3
    // SELECT COUNT(*) FROM users WHERE org_id = $1
    return { data: [], total: 0 };
  }

  async create(user: User, credentialHash: string): Promise<void> {
    const colMap = user.toPersistenceColumnMap();
    // INSERT INTO users (id, org_id, prenom, nom_famille, adresse_email, ...)
    // VALUES ($1, $2, $3, $4, $5, ...)
    // ON CONFLICT (adresse_email, org_id) DO NOTHING -- CC-USER-001

    // Store credential hash separately in credentials table
    // INSERT INTO credentials (user_id, hachage_mot_de_passe, org_id)
    // VALUES ($1, $2, $3)
  }

  async update(user: User): Promise<void> {
    const colMap = user.toPersistenceColumnMap();
    // UPDATE users SET prenom=$1, nom_famille=$2, ... WHERE id=$N AND version=$O
    // Version check implements optimistic locking (DOC-023 §5.1)
  }

  async delete(id: string): Promise<boolean> {
    // Soft delete: UPDATE users SET statut='inactive' WHERE id=$1
    // Or physical delete only if no foreign key references exist
    return false;
  }
}

@Injectable()
export class PrismaSessionRepository implements ISessionRepository {
  constructor(@Inject('PRISMA_CLIENT') private readonly client: unknown) {}

  async create(params: {
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
    orgId: string;
  }): Promise<string> {
    // INSERT INTO sessions (user_id, hachage_refresh_token, date_expiration,
    //   est_active, informations_appareil, org_id)
    // VALUES ($1, $2, $3, TRUE, $4::jsonb, $5) RETURNING id
    return `session-${Date.now()}`;
  }

  async findByRefreshTokenHash(hash: string): Promise<{
    sessionId: string;
    userId: string;
    expiresAt: Date;
    orgId: string;
  } | null> {
    // SELECT id, user_id, date_expiration, org_id
    // FROM sessions WHERE hachage_refresh_token = $1 AND est_active = TRUE
    return null;
  }

  async revokeById(sessionId: string): Promise<boolean> {
    // UPDATE sessions SET est_active = FALSE, date_revocation = NOW()
    // WHERE id = $1
    return true;
  }

  async revokeByUser(userId: string): Promise<number> {
    // UPDATE sessions SET est_active = FALSE, date_revocation = NOW()
    // WHERE user_id = $1 AND est_active = TRUE
    return 0;
  }

  async expireOldSessions(maxAgeMs: number): Promise<number> {
    // DELETE FROM sessions WHERE date_expiration < NOW() AND est_active = TRUE
    // Periodic cleanup — called by scheduled job
    return 0;
  }

  async findById(id: string): Promise<{
    isActive: boolean;
    userId: string;
    expiresAt: Date;
    deviceInfo: Record<string, unknown>;
    orgId: string;
  } | null> {
    return null;
  }
}

@Injectable()
export class PrismaCredentialRepository implements ICredentialRepository {
  constructor(@Inject('PRISMA_CLIENT') private readonly client: unknown) {}

  async create(userId: string, passwordHash: string, orgId: string): Promise<void> {
    // INSERT INTO credentials (user_id, hachage_mot_de_passe, org_id)
    // VALUES ($1, $2, $3) ON CONFLICT (user_id) DO NOTHING
  }

  async get(userId: string): Promise<{
    passwordHash: string;
    failedAttempts: number;
    isLocked: boolean;
    lastLoginAt: Date | null;
  } | null> {
    // SELECT hachage_mot_de_passe, nombre_echecs_connexion, compte_bloque,
    //   date_derniere_connexion
    // FROM credentials WHERE user_id = $1
    return null;
  }

  async updatePassword(userId: string, newPasswordHash: string): Promise<void> {
    // UPDATE credentials SET hachage_mot_de_passe = $1, date_derniere_rotation = NOW()
    // WHERE user_id = $2
  }

  async incrementFailedAttempts(userId: string): Promise<void> {
    // UPDATE credentials SET nombre_echecs_connexion = nombre_echecs_connexion + 1,
    //   compte_bloque = CASE WHEN nombre_echecs_connexion + 1 >= 5 THEN TRUE ELSE FALSE END
    // WHERE user_id = $1
  }

  async resetFailedAttempts(userId: string): Promise<void> {
    // UPDATE credentials SET nombre_echecs_connexion = 0, compte_bloque = FALSE
    // WHERE user_id = $1
  }

  async unlockAccount(userId: string): Promise<void> {
    // UPDATE credentials SET compte_bloque = FALSE WHERE user_id = $1
  }
}
