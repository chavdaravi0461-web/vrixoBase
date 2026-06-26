import { Module } from '@nestjs/common';
import { MonitoringService } from './monitoring.service';
import { MonitoringController } from './monitoring.controller';
import { PrometheusController } from './prometheus.controller';

@Module({
  controllers: [MonitoringController, PrometheusController],
  providers: [MonitoringService],
  exports: [MonitoringService],
})
export class MonitoringModule {}
