import { Module } from '@nestjs/common';
import { ApiGeneratorService } from './api-generator.service';
import { ApiGeneratorController } from './api-generator.controller';
import { RestV1Controller } from './rest-v1.controller';
import { OpenApiGeneratorService } from './openapi-generator.service';
import { ApiKeysService } from './api-keys.service';
import { ApiKeysController } from './api-keys.controller';

@Module({
  controllers: [ApiGeneratorController, ApiKeysController, RestV1Controller],
  providers: [ApiGeneratorService, OpenApiGeneratorService, ApiKeysService],
  exports: [ApiGeneratorService, OpenApiGeneratorService, ApiKeysService],
})
export class ApiGeneratorModule {}
