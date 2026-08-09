/**
 * ConfigurationModule — NestJS module wiring for ConfigurationAggregate.
 *
 * @traceability DOC-012 Aggregate12, PAS-005 DR-004
 */

import { Module, DynamicModule, Provider } from '@nestjs/common';
import { ConfigurationService } from './application/configuration.service';
import { PrismaConfigurationRepository } from './infrastructure/adapters/prisma-configuration.repository';
import type { ISettingPort } from './ports/configuration.port';

const SettingPortToken = 'ISettingPort' as const;

@Module({})
export class ConfigurationModule {
  static forRoot(
    prismaClient: unknown,
  ): DynamicModule {
    return {
      module: ConfigurationModule,
      providers: [
        { provide: SettingPortToken, useClass: PrismaConfigurationRepository },
        {
          provide: ConfigurationService,
          useFactory: (settingPort: ISettingPort) => new ConfigurationService(settingPort),
          inject: [SettingPortToken],
        },
      ],
      exports: [ConfigurationService],
    };
  }
}
