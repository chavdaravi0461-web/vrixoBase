import { Controller, Get, Header, Logger } from '@nestjs/common';
import { Public } from '../../modules/auth/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { ApiExcludeController } from '@nestjs/swagger';
import * as prometheusClient from 'prom-client';

@ApiExcludeController()
@Public()
@SkipCsrf()
@Controller('metrics')
export class PrometheusController {
  private readonly logger = new Logger(PrometheusController.name);
  private readonly register: prometheusClient.Registry;

  constructor() {
    this.register = new prometheusClient.Registry();
    prometheusClient.collectDefaultMetrics({
      register: this.register,
      prefix: 'vrixo_',
    });

    this.register.setDefaultLabels({
      app: 'vrixo-backend',
    });

    new prometheusClient.Histogram({
      name: 'vrixo_http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'status'],
      buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.register],
    });

    new prometheusClient.Counter({
      name: 'vrixo_http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status'],
      registers: [this.register],
    });

    new prometheusClient.Gauge({
      name: 'vrixo_db_connections_active',
      help: 'Number of active database connections',
      registers: [this.register],
    });

    new prometheusClient.Gauge({
      name: 'vrixo_db_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['query_type'],
      registers: [this.register],
    });

    new prometheusClient.Counter({
      name: 'vrixo_auth_requests_total',
      help: 'Total authentication requests',
      labelNames: ['method', 'status'],
      registers: [this.register],
    });

    new prometheusClient.Gauge({
      name: 'vrixo_realtime_connections',
      help: 'Number of active WebSocket connections',
      registers: [this.register],
    });

    new prometheusClient.Gauge({
      name: 'vrixo_storage_operations_in_progress',
      help: 'Number of storage operations in progress',
      registers: [this.register],
    });

    new prometheusClient.Histogram({
      name: 'vrixo_storage_operation_duration_seconds',
      help: 'Storage operation duration in seconds',
      labelNames: ['operation'],
      buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
      registers: [this.register],
    });

    this.logger.log('Prometheus metrics initialized');
  }

  @Get()
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async metrics(): Promise<string> {
    return this.register.metrics();
  }

  @Get('json')
  @Header('Content-Type', 'application/json')
  async metricsJson() {
    return this.register.getMetricsAsJSON();
  }
}
