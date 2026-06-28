import { Module } from '@nestjs/common';
import { ApiGeneratorService } from './api-generator.service';
import { ApiGeneratorController } from './api-generator.controller';
import { OpenApiGeneratorService } from './openapi-generator.service';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

@Module({
  controllers: [ApiGeneratorController, ApiKeysController],
  providers: [ApiGeneratorService, OpenApiGeneratorService, ApiKeysService],
  exports: [ApiGeneratorService, OpenApiGeneratorService, ApiKeysService],
})
export class ApiGeneratorModule {}
