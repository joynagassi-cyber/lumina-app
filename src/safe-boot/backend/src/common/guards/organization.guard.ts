import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Request } from 'express';

/**
 * OrganizationGuard — enforces multi-tenant org_id from authenticated user context.
 * @traceability DOC-023 §8 (multi-tenant isolation)
 */
@Injectable()
export class OrganizationGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { orgId?: string } }>();
    // orgId is injected by auth middleware; if missing, deny access
    return !!request.user?.orgId;
  }
}
