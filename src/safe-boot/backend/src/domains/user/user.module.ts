/**
 * UserModule — NestJS module wiring for IdentityAggregate
 *
 * Declares all providers, wires port interfaces to infrastructure adapters.
 * Exports domain-layer types for cross-module use (e.g., AuthGuard depends on this).
 *
 * Provider binding chain:
 *   IUserRepository ← PrismaUserRepository
 *   ISessionRepository ← PrismaSessionRepository
 *   ICredentialRepository ← PrismaCredentialRepository
 *   IJwtServicePort ← NestJwsAdapter
 *
 * @traceability DOC-012 → NestJS DI container → PAS-v1 Dependency Injection
 */

import { Module, DynamicModule } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { IdentityService } from './application/identity-service';
import {
  PrismaUserRepository,
  PrismaSessionRepository,
  PrismaCredentialRepository,
  NestJwsAdapter,
} from './infrastructure';
import type {
  IUserRepository,
  ISessionRepository,
  ICredentialRepository,
  IJwtServicePort,
} from './ports';

export { PrismaUserRepository, PrismaSessionRepository, PrismaCredentialRepository } from './infrastructure';

@Module({})
export class UserModule {
  static forRoot(): DynamicModule {
    return {
      module: UserModule,
      imports: [
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET ?? 'change-me-in-production',
          signOptions: { expiresIn: '15m' },
        }),
      ],
      providers: [
        // --- Infrastructure Adapters ---
        PrismaUserRepository,
        PrismaSessionRepository,
        PrismaCredentialRepository,
        NestJwsAdapter,
        // --- Port Interface Bindings ---
        {
          provide: 'IUserRepository',
          useClass: PrismaUserRepository,
        },
        {
          provide: 'ISessionRepository',
          useClass: PrismaSessionRepository,
        },
        {
          provide: 'ICredentialRepository',
          useClass: PrismaCredentialRepository,
        },
        {
          provide: 'IJwtServicePort',
          useClass: NestJwsAdapter,
        },
        // --- Application Layer ---
        IdentityService,
      ],
      exports: [
        IdentityService,
        'IUserRepository',
        'ISessionRepository',
        'ICredentialRepository',
        'IJwtServicePort',
        PrismaUserRepository,
        PrismaSessionRepository,
        PrismaCredentialRepository,
        NestJwsAdapter,
      ],
    };
  }
}
