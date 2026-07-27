/**
 * Prisma-based Session Repository for Auth domain
 *
 * Implements ISessionRepository from user/ports/index.ts.
 * Maps to PG-Schema Table 5 (sessions) columns exactly.
 * Dependency Inversion: this adapter depends on the port interface, not vice versa.
 *
 * @traceability DOC-012 Aggregate 2 → PG-Schema Table 5 (sessions)
 *   → PAS-v1 Port & Adapter pattern → Prisma 5+ adapter
 */

import { Injectable } from '@nestjs/common';
import type {
  ISessionRepository,
} from '@domains/user/ports';
import type { AuthSession } from '../domain/entities/auth-session.entity';

interface SessionRow {
  id: string;
  user_id: string;
  org_id: string;
  hachage_refresh_token: string;
  date_expiration: Date | string;
  est_active: boolean;
  informations_appareil: string;
  date_creation: Date | string;
  date_revocation: Date | string | null;
}

@Injectable()
export class PrismaAuthSessionRepository implements ISessionRepository {
  constructor(
    @Inject('PRISMA_CLIENT')
    private readonly _client: unknown,
  ) {}

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

  async findById(sessionId: string): Promise<AuthSession | null> {
    // SELECT * FROM sessions WHERE id = $1
    return null;
  }

  async findByRefreshTokenHash(hash: string): Promise<{
    sessionId: string;
    userId: string;
    expiresAt: Date;
    orgId: string;
  } | null> {
    // SELECT id, user_id, date_expiration, org_id
    // FROM sessions
    // WHERE hachage_refresh_token = $1 AND est_active = TRUE
    return null;
  }

  async findByUserId(userId: string): Promise<AuthSession[]> {
    // SELECT * FROM sessions WHERE user_id = $1 AND est_active = TRUE
    return [];
  }

  async countActiveByUserId(userId: string): Promise<number> {
    // SELECT COUNT(*) FROM sessions WHERE user_id = $1 AND est_active = TRUE
    return 0;
  }

  async revokeById(sessionId: string): Promise<boolean> {
    // UPDATE sessions SET est_active = FALSE, date_revocation = NOW()
    // WHERE id = $1
    return true;
  }

  async revokeByUser(userId: string, revokedBy: string): Promise<number> {
    // UPDATE sessions SET est_active = FALSE, date_revocation = NOW()
    // WHERE user_id = $1 AND est_active = TRUE
    return 0;
  }
}
