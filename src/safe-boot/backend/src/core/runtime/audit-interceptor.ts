/**
 * AuditInterceptor — CRT-014 (ADR-018).
 *
 * Intercepteur global : n'audite QUE les handlers annotés @Audit
 * (NB-PERSIST-007 — jamais d'auto-audit). Capture l'état avant (body) et
 * après (réponse) pour OLDNEW-002. Non-bloquant (AUD-001) : l'écriture
 * d'audit est fire-and-forget et n'affecte jamais la réponse.
 *
 * @traceability ADR-018 §3.1 (CRT-014), AUD-001, OLDNEW-002, NB-PERSIST-007
 */

import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { tap } from 'rxjs/operators';
import { Observable } from 'rxjs';
import { AUDIT_METADATA_KEY, AuditMetadata } from './audit.decorator';
import { RuntimeAuditService } from './audit.service';

interface AuditRequest {
  body?: unknown;
  ip?: string;
  user?: { sub?: string };
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private readonly audit: RuntimeAuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = Reflect.getMetadata(
      AUDIT_METADATA_KEY,
      context.getHandler(),
    ) as AuditMetadata | undefined;

    // NB-PERSIST-007 : sans annotation @Audit explicite, aucun audit.
    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuditRequest>();
    const before = request.body ?? {};

    return next.handle().pipe(
      tap({
        next: (after) => {
          void this.audit.log({
            action: metadata.action,
            entityType: metadata.entityType,
            before,
            after,
            userId: request.user?.sub,
            ipAddress: request.ip,
          });
        },
        error: (error: Error) => {
          void this.audit.log({
            action: metadata.action,
            entityType: metadata.entityType,
            before,
            after: { error: error?.message ?? String(error) },
            userId: request.user?.sub,
            ipAddress: request.ip,
          });
        },
      }),
    );
  }
}
