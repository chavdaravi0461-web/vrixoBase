import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody } from '@nestjs/swagger';
import { ScheduledJobsService } from './scheduled-jobs.service';
import { CreateScheduledJobDto } from './dto/create-scheduled-job.dto';
import { UpdateScheduledJobDto } from './dto/update-scheduled-job.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Scheduled Jobs')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('scheduled-jobs')
export class ScheduledJobsController {
  constructor(private readonly scheduledJobsService: ScheduledJobsService) {}

  @Post(':projectId')
  @ApiOperation({ summary: 'Create a scheduled job (cron)' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateScheduledJobDto })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateScheduledJobDto,
  ) {
    return this.scheduledJobsService.create(projectId, dto);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'List scheduled jobs in a project' })
  @ApiParam({ name: 'projectId', type: String })
  list(@Param('projectId') projectId: string) {
    return this.scheduledJobsService.list(projectId);
  }

  @Get(':projectId/:id')
  @ApiOperation({ summary: 'Get a scheduled job by ID' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  get(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.scheduledJobsService.get(projectId, id);
  }

  @Patch(':projectId/:id')
  @ApiOperation({ summary: 'Update a scheduled job' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateScheduledJobDto })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateScheduledJobDto,
  ) {
    return this.scheduledJobsService.update(projectId, id, dto);
  }

  @Patch(':projectId/:id/toggle')
  @ApiOperation({ summary: 'Toggle a scheduled job active/inactive' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  toggle(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.scheduledJobsService.toggleActive(projectId, id, body.isActive);
  }

  @Delete(':projectId/:id')
  @ApiOperation({ summary: 'Delete a scheduled job' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.scheduledJobsService.delete(projectId, id);
  }
}
