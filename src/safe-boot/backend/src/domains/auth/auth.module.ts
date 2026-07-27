/**
 * AuthModule — NestJS module for Auth operations within IdentityAggregate
 *
 * Wires together port interfaces, infrastructure adapters, domain services,
 * and the application service for login/logout/token-refresh/session management.
 *
 * Provider binding chain:
 *   ISessionRepository ← PrismaAuthSessionRepository (reuses user domain session repo)
 *   ICredentialRepository ← PrismaCredentialRepository (from user domain)
 *   IJwtServicePort ← JwtAdapter
 *   IUserRepository ← PrismaUserRepository (from user domain)
 *   IAuthorizationPort ← RBACAdapter (from organization domain)
 *   IEventPublisherPort ← EventBusAdapter (from organization domain)
 *
 * @traceability DOC-012 Aggregate 2 (IdentityAggregate) → NestJS DI container
 *   → PAS-v1 Dependency Injection pattern
 */

import { Module, DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from '../application/auth.service';
import { MfaService } from '../domain/services/mfa-service';
import { DEFAULT_JWT_POLICY, type JwtPolicy, JwtPolicy as JwtPolicyClass } from '../domain/policies/jwt-policy';
import type { ISessionRepository, ICredentialRepository, IJwtServicePort } from '@domains/user/ports';

export class AuthModule {
  static forRoot(jwtPolicy?: JwtPolicy): DynamicModule {
    const policy = jwtPolicy ?? DEFAULT_JWT_POLICY;

    return {
      module: AuthModule as unknown as DynamicModule,
      imports: [
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET ?? 'change-me-in-production',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        // --- Domain Services (singleton) ---
        { provide: 'JwtPolicy', useValue: policy },
        MfaService,

        // --- Application Service ---
        AuthService,
      ],
      exports: [
        AuthService,
        MfaService,
        'JwtPolicy',
      ],
    };
  }
}
