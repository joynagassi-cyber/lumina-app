/**
 * RateLimiterMiddleware - Implements rate limiting for authentication endpoints.
 * Limit: 5 attempts per minute per IP address.
 *
 * @traceability Security Requirements: Rate limiting on login endpoint
 */

import { Injectable, NestMiddleware, Req, Res, Next } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

interface RateLimitEntry {
  count: number;
  lastAttempt: number;
}

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  private readonly limits = new Map<string, RateLimitEntry>();
  private readonly maxAttempts = 5;
  private readonly windowMs = 60 * 1000; // 1 minute

  use(@Req() req: Request, @Res() res: Response, @Next() next: NextFunction) {
    const ip = req.ip || req.socket?.remoteAddress || 'unknown';
    const now = Date.now();

    // Check if we have an entry for this IP
    let entry = this.limits.get(ip);
    if (!entry) {
      entry = { count: 1, lastAttempt: now };
      this.limits.set(ip, entry);
    } else {
      // Reset counter if window has passed
      if (now - entry.lastAttempt > this.windowMs) {
        entry.count = 1;
        entry.lastAttempt = now;
      } else {
        entry.count++;
        entry.lastAttempt = now;

        // If limit exceeded, reject the request
        if (entry.count > this.maxAttempts) {
          return res.status(429).json({
            success: false,
            message: 'Trop de tentatives. Veuillez réessayer plus tard.',
          });
        }
      }
    }

    // Add retry-after header if close to limit
    if (entry.count >= this.maxAttempts - 1) {
      const remaining = this.maxAttempts - entry.count;
      res.setHeader('X-Retry-After', `${remaining} attempt${remaining !== 1 ? 's' : ''}`);
    }

    next();
  }

  // Clear old entries periodically
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now - entry.lastAttempt > this.windowMs * 2) {
        this.limits.delete(key);
      }
    }
    // Run cleanup every 5 minutes
    setTimeout(() => this.cleanup(), 5 * 60 * 1000);
  }

  start() {
    this.cleanup();
  }
}
