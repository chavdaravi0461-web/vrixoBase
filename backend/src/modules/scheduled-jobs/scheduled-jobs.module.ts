import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { ScheduledJobsController } from './scheduled-jobs.controller';
import { FunctionsModule } from '../functions/functions.module';

@Module({
  imports: [ScheduleModule, FunctionsModule],
  controllers: [ScheduledJobsController],
  providers: [ScheduledJobsService],
  exports: [ScheduledJobsService],
})
export class ScheduledJobsModule {}
