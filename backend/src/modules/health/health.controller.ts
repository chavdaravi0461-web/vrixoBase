import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../auth/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';
import { HealthService } from './health.service';

@ApiTags('Health')
@Public()
@SkipCsrf()
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly healthService: HealthService) {}

  @Get('liveness')
  @ApiOperation({ summary: 'Kubernetes liveness probe' })
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('readiness')
  @ApiOperation({ summary: 'Kubernetes readiness probe' })
  async readiness() {
    const db = await this.healthService.checkDatabase();
    const ready = db.status === 'healthy';
    return { status: ready ? 'ready' : 'not ready', database: db.status, timestamp: new Date().toISOString() };
  }

  @Get('startup')
  @ApiOperation({ summary: 'Kubernetes startup probe' })
  async startup() {
    await this.healthService.waitForReady();
    return { status: 'started', uptime: this.healthService.uptimeSeconds, timestamp: new Date().toISOString() };
  }

  @Get()
  @ApiOperation({ summary: 'Simple health check' })
  check() {
    return {
      status: 'healthy',
      uptime: this.healthService.uptimeSeconds,
      version: process.env.npm_package_version || '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('dependencies')
  @ApiOperation({ summary: 'Full dependency health check' })
  @ApiResponse({ status: 200, description: 'Dependency health status' })
  async dependencies(): Promise<unknown> {
    return this.healthService.checkAll();
  }

  @Get('version')
  @ApiOperation({ summary: 'Version information' })
  async version() {
    return this.healthService.getVersion();
  }
}
