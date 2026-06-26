import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiResponse } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Audit')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get(':projectId')
  @ApiOperation({ summary: 'List audit logs' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'action', required: false })
  @ApiQuery({ name: 'userId', required: false })
  @ApiQuery({ name: 'entity', required: false })
  @ApiQuery({ name: 'from', required: false, description: 'Start date (ISO)' })
  @ApiQuery({ name: 'to', required: false, description: 'End date (ISO)' })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  getLogs(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId?: string,
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ) {
    return this.auditService.getLogs(projectId, {
      action,
      userId,
      entity,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
      offset: offset ? Number(offset) : undefined,
    });
  }

  @Get(':projectId/:id')
  @ApiOperation({ summary: 'Get audit log entry' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  getLog(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.auditService.getLog(projectId, id);
  }
}
