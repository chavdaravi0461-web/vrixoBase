import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { FunctionsService } from './functions.service';
import { FunctionsController } from './functions.controller';

@Module({
  imports: [ScheduleModule],
  controllers: [FunctionsController],
  providers: [FunctionsService],
  exports: [FunctionsService],
})
export class FunctionsModule {}
