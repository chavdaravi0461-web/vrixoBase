import { Module } from '@nestjs/common';
import { ProjectService } from './project.service';
import { ProjectController } from './project.controller';
import { ApiGeneratorModule } from '../api-generator/api-generator.module';

@Module({
  imports: [ApiGeneratorModule],
  controllers: [ProjectController],
  providers: [ProjectService],
  exports: [ProjectService],
})
export class ProjectModule {}
