import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { PrismaModule } from './common/prisma/prisma.module';
import { TenancyModule } from './modules/tenancy/tenancy.module';
import { DatabaseModule } from './modules/database/database.module';
import { ApiGeneratorModule } from './modules/api-generator/api-generator.module';
import { StorageModule } from './modules/storage/storage.module';
import { RealtimeModule } from './modules/realtime/realtime.module';
import { FunctionsModule } from './modules/functions/functions.module';
import { ScheduledJobsModule } from './modules/scheduled-jobs/scheduled-jobs.module';
import { MonitoringModule } from './modules/monitoring/monitoring.module';
import { SecurityModule } from './modules/security/security.module';
import { ProjectModule } from './modules/project/project.module';
import { RlsModule } from './modules/rls/rls.module';
import { TeamModule } from './modules/team/team.module';
import { AuditModule } from './modules/audit/audit.module';
import { HealthModule } from './modules/health/health.module';
import { AiModule } from './modules/ai/ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: parseInt(config.get('THROTTLE_TTL', '60'), 10) * 1000,
            limit: parseInt(config.get('THROTTLE_LIMIT', '100'), 10),
          },
        ],
      }),
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    TenancyModule,
    RlsModule,
    AuthModule,
    DatabaseModule,
    ApiGeneratorModule,
    StorageModule,
    RealtimeModule,
    FunctionsModule,
    MonitoringModule,
    SecurityModule,
    ProjectModule,
    TeamModule,
    AuditModule,
    HealthModule,
    AiModule,
    ScheduledJobsModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: CsrfGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
  ],
})
export class AppModule {}
