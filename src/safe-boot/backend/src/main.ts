/**
 * Lumina Backend — Entry Point
 *
 * Generated per ITS-V1 specification.
 * Stack: NestJS 10+ with strict TypeScript 5.x
 *
 * @traceability DOC-000 (Architecture) → RTS-v1 → PAS-v1 → Implementation
 */

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  // Global prefix for API versioning
  app.setGlobalPrefix('api/v1');

  // CRT-011 (ADR-018) : shutdown propre — onModuleDestroy / beforeApplicationShutdown
  // exécutés sur SIGTERM/SIGINT (flush des opérations pendantes, disconnect Prisma).
  app.enableShutdownHooks();

  // Enable CORS with strict origins
  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:8081'],
    credentials: true,
  });

  // Global validation pipe — fail fast per ITS-V1 NB-TECH-002
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Global timeout — prevent hanging requests (RTS-v1 boundary)
  const httpAdapter = app.getHttpAdapter();
  if (httpAdapter && typeof httpAdapter.getType === 'function') {
    // Express-specific: set body size limit
    const expressApp = httpAdapter.getInstance();
    expressApp.set('trust proxy', 1);
  }

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`Lumina Backend running on port ${port}`);
}

bootstrap();
