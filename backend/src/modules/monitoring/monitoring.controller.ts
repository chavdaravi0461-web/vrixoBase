import { Controller, Get, Param, Query, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { MonitoringService } from './monitoring.service';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Monitoring')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('monitoring')
export class MonitoringController {
  constructor(private readonly monitoringService: MonitoringService) {}

  @Get(':projectId/database')
  @ApiOperation({ summary: 'Get database metrics' })
  @ApiParam({ name: 'projectId', type: String })
  getDatabaseMetrics(@Param('projectId') projectId: string) {
    return this.monitoringService.getDatabaseMetrics(projectId);
  }

  @Get(':projectId/api')
  @ApiOperation({ summary: 'Get API metrics' })
  @ApiParam({ name: 'projectId', type: String })
  getApiMetrics(@Param('projectId') projectId: string) {
    return this.monitoringService.getApiMetrics(projectId);
  }

  @Get(':projectId/storage')
  @ApiOperation({ summary: 'Get storage metrics' })
  @ApiParam({ name: 'projectId', type: String })
  getStorageMetrics(@Param('projectId') projectId: string) {
    return this.monitoringService.getStorageMetrics(projectId);
  }

  @Get(':projectId/realtime')
  @ApiOperation({ summary: 'Get realtime metrics' })
  @ApiParam({ name: 'projectId', type: String })
  getRealtimeMetrics(@Param('projectId') projectId: string) {
    return this.monitoringService.getRealtimeMetrics(projectId);
  }

  @Get(':projectId/errors')
  @ApiOperation({ summary: 'Get error tracking' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'timeframe', required: false, enum: ['1h', '24h', '7d', '30d'] })
  getErrorTracking(
    @Param('projectId') projectId: string,
    @Query('timeframe') timeframe = '7d',
  ) {
    return this.monitoringService.getErrorTracking(projectId, timeframe);
  }

  @Get(':projectId/usage')
  @ApiOperation({ summary: 'Get usage metrics' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'metric', required: false })
  getUsage(
    @Param('projectId') projectId: string,
    @Query('metric') metric?: string,
  ) {
    return this.monitoringService.getUsage(projectId, metric);
  }

}
