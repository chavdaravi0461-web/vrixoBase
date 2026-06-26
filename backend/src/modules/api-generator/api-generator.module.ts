import { Module } from '@nestjs/common';
import { ApiGeneratorService } from './api-generator.service';
import { ApiGeneratorController } from './api-generator.controller';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

@Module({
  controllers: [ApiGeneratorController, ApiKeysController],
  providers: [ApiGeneratorService, ApiKeysService],
  exports: [ApiGeneratorService, ApiKeysService],
})
export class ApiGeneratorModule {}
