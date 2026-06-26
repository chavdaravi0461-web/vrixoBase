import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { FunctionsService } from './functions.service';
import { CreateFunctionDto } from './dto/create-function.dto';
import { UpdateFunctionDto } from './dto/update-function.dto';
import { ExecuteFunctionDto } from './dto/execute-function.dto';
import { CreateWebhookDto } from './dto/create-webhook.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Functions')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('functions')
export class FunctionsController {
  constructor(private readonly functionsService: FunctionsService) {}

  @Post(':projectId')
  @ApiOperation({ summary: 'Create a serverless function' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateFunctionDto })
  create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateFunctionDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id || 'system';
    return this.functionsService.create(projectId, dto, userId);
  }

  @Get(':projectId')
  @ApiOperation({ summary: 'List all functions in a project' })
  @ApiParam({ name: 'projectId', type: String })
  list(@Param('projectId') projectId: string) {
    return this.functionsService.list(projectId);
  }

  @Get(':projectId/:id')
  @ApiOperation({ summary: 'Get a function by ID' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  get(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.functionsService.get(projectId, id);
  }

  @Patch(':projectId/:id')
  @ApiOperation({ summary: 'Update a function' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateFunctionDto })
  update(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: UpdateFunctionDto,
  ) {
    return this.functionsService.update(projectId, id, dto);
  }

  @Delete(':projectId/:id')
  @ApiOperation({ summary: 'Delete a function' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  delete(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.functionsService.delete(projectId, id);
  }

  @Post(':projectId/:id/execute')
  @ApiOperation({ summary: 'Execute a function' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: ExecuteFunctionDto })
  execute(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
    @Body() dto: ExecuteFunctionDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.functionsService.executeFunction(projectId, id, dto, userId);
  }

  @Get(':projectId/:id/executions')
  @ApiOperation({ summary: 'Get execution logs for a function' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  getExecutions(
    @Param('projectId') projectId: string,
    @Param('id') id: string,
  ) {
    return this.functionsService.getExecutionLogs(projectId, id);
  }

  @Post(':projectId/webhooks')
  @ApiOperation({ summary: 'Create a webhook for a function' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateWebhookDto })
  createWebhook(
    @Param('projectId') projectId: string,
    @Body() dto: CreateWebhookDto,
  ) {
    return this.functionsService.createWebhook(projectId, dto);
  }

  @Get(':projectId/webhooks')
  @ApiOperation({ summary: 'List webhooks in a project' })
  @ApiParam({ name: 'projectId', type: String })
  listWebhooks(@Param('projectId') projectId: string) {
    return this.functionsService.listWebhooks(projectId);
  }

  @Delete('webhooks/:id')
  @ApiOperation({ summary: 'Delete a webhook' })
  @ApiParam({ name: 'id', type: String })
  deleteWebhook(@Param('id') id: string, @Req() req?: any) {
    return this.functionsService.deleteWebhook(id, req?.user?.id);
  }
}
