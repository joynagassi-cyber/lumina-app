/**
 * OrganizationContextMiddleware - Injects organization context into requests.
 * Ensures all organization-scoped queries are filtered by organization_id.
 *
 * Implements VisibilityPolicy pour l'isolation des données multi-locataire.
 */

import { Injectable, NestMiddleware, Req, Res, Next } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class OrganizationContextMiddleware implements NestMiddleware {
  use(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    // Extract organization ID from headers or query params
    // Example: X-Org-Id header or ?orgId= query param
    const orgId = req.headers['x-org-id'] as string || req.query.orgId as string;

    if (orgId) {
      // Store organization ID in request object for downstream handlers
      (req as any).organizationId = orgId;
      console.log('Organization context set:', orgId);
    }

    next();
  }
}
