import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { ApiGeneratorService } from './api-generator.service';
import { ProxyQueryDto } from './dto/proxy-query.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';

@ApiTags('API Generator')
@Controller('proxy')
@Public()
@SkipCsrf()
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
export class ApiGeneratorController {
  constructor(private readonly apiGeneratorService: ApiGeneratorService) {}

  @ApiOperation({ summary: 'List records from a table' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @Get(':projectId/:tableName')
  async list(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Query() query: ProxyQueryDto,
  ) {
    return this.apiGeneratorService.readRecords(projectId, tableName, query);
  }

  @ApiOperation({ summary: 'Get a single record by ID' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Get(':projectId/:tableName/:id')
  async get(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Query() query: ProxyQueryDto,
  ) {
    return this.apiGeneratorService.readRecord(projectId, tableName, id, query);
  }

  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @Post(':projectId/:tableName')
  @ApiOperation({ summary: 'Create a new record in the specified table' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      description: 'Arbitrary record data matching the target table schema',
      example: { name: 'John Doe', email: 'john@example.com' },
    },
  })
  async create(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Body() data: Record<string, any>,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.createRecord(projectId, tableName, data, userId);
  }

  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Patch(':projectId/:tableName/:id')
  @ApiOperation({ summary: 'Update an existing record' })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: true,
      description: 'Partial record data to update',
      example: { name: 'Jane Doe', email: 'jane@example.com' },
    },
  })
  async update(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.updateRecord(projectId, tableName, id, data, userId);
  }

  @ApiOperation({ summary: 'Delete a record by ID' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Delete(':projectId/:tableName/:id')
  async delete(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.deleteRecord(projectId, tableName, id, userId);
  }
}
