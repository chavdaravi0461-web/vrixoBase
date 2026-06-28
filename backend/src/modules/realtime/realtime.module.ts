import { Module, Global, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { RealtimeGateway } from './realtime.gateway';
import { RealtimeV1Gateway } from './realtime-v1.gateway';
import { RealtimeService } from './realtime.service';
import { RealtimeController } from './realtime.controller';
import { WalListenerService } from './wal-listener.service';

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
    forwardRef(() => AuthModule),
  ],
  controllers: [RealtimeController],
  providers: [
    RealtimeGateway,
    RealtimeV1Gateway,
    RealtimeService,
    WalListenerService,
  ],
  exports: [
    RealtimeService,
    RealtimeGateway,
    RealtimeV1Gateway,
    WalListenerService,
  ],
})
export class RealtimeModule {}
