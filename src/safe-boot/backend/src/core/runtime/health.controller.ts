/**
 * HealthController — CRT-007 (ADR-018).
 *
 * Health checks des Ports (DB, cache) via @nestjs/terminus, exposés sur
 * GET /health. Verdict normalisé : HEALTHY / DEGRADED / UNHEALTHY.
 *
 * - HEALTHY    : tous les indicateurs up
 * - DEGRADED   : au moins un indicateur down, d'autres up
 * - UNHEALTHY  : tous les indicateurs down
 *
 * @traceability ADR-018 §3.1 (CRT-007), PAS-001 (HealthMonitor)
 */

import { Controller, Get } from '@nestjs/common';
import {
  HealthCheckResult,
  HealthCheckService,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { IdempotencyManager } from './idempotency-manager';

type Verdict = 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaService,
    private readonly idempotency: IdempotencyManager,
  ) {}

  @Get()
  async check(): Promise<{ status: Verdict; details: HealthCheckResult['details']; timestamp: string }> {
    const result = await this.health.check([
      () => this.dbIndicator(),
      () => this.cacheIndicator(),
    ]);

    const details = result.details;
    const indicatorStatuses = Object.values(details).map(
      (detail) => detail.status,
    );
    const upCount = indicatorStatuses.filter((status) => status === 'up').length;

    let verdict: Verdict;
    if (result.status === 'ok') {
      verdict = 'HEALTHY';
    } else if (upCount > 0) {
      verdict = 'DEGRADED';
    } else {
      verdict = 'UNHEALTHY';
    }

    return { status: verdict, details, timestamp: new Date().toISOString() };
  }

  /** Indicateur DB : requête de ping via le client Prisma. */
  private async dbIndicator(): Promise<HealthIndicatorResult> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { database: { status: 'up' } };
    } catch {
      return { database: { status: 'down' } };
    }
  }

  /** Indicateur cache : le store idempotence est accessible (sweep inclus). */
  private async cacheIndicator(): Promise<HealthIndicatorResult> {
    try {
      this.idempotency.sweep();
      return { cache: { status: 'up' } };
    } catch {
      return { cache: { status: 'down' } };
    }
  }
}
