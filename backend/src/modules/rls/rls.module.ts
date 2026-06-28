import { Module, Global, MiddlewareConsumer, NestModule, RequestMethod } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { RlsSessionMiddleware } from './rls-session.middleware';
import { RlsInfrastructureService } from './rls-infrastructure.service';
import { RlsPolicyEngineService } from './rls-policy-engine.service';

@Global()
@Module({
  imports: [
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET', 'default-secret'),
        signOptions: {
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  providers: [
    RlsSessionMiddleware,
    RlsInfrastructureService,
    RlsPolicyEngineService,
  ],
  exports: [
    RlsSessionMiddleware,
    RlsInfrastructureService,
    RlsPolicyEngineService,
  ],
})
export class RlsModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RlsSessionMiddleware)
      .forRoutes(
        { path: 'api/proxy/*', method: RequestMethod.ALL },
        { path: 'api/database/*', method: RequestMethod.ALL },
        { path: 'api/storage/*', method: RequestMethod.ALL },
        { path: 'api/functions/*', method: RequestMethod.ALL },
        { path: 'api/realtime/*', method: RequestMethod.ALL },
        { path: 'api/security/*', method: RequestMethod.ALL },
      );
  }
}
