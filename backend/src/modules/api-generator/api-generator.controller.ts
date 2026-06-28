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
  Res,
  Headers,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiTags, ApiBearerAuth, ApiParam, ApiQuery, ApiResponse, ApiHeader } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ApiGeneratorService } from './api-generator.service';
import { OpenApiGeneratorService } from './openapi-generator.service';
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
  constructor(
    private readonly apiGeneratorService: ApiGeneratorService,
    private readonly openApiGeneratorService: OpenApiGeneratorService,
  ) {}

  @ApiOperation({ summary: 'Get OpenAPI specification for project tables' })
  @ApiParam({ name: 'projectId', type: String })
  @Get(':projectId/openapi.json')
  async getOpenApiSpec(
    @Param('projectId') projectId: string,
    @Req() req: Request,
  ) {
    const host = `${req.protocol}://${req.get('host')}`;
    return this.openApiGeneratorService.generateSpec(projectId, host);
  }

  @ApiOperation({ summary: 'List records from a table with PostgREST-style query' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiHeader({ name: 'Prefer', required: false, description: 'e.g. count=exact' })
  @ApiHeader({ name: 'Range', required: false, description: 'e.g. 0-9' })
  @ApiHeader({ name: 'Range-Unit', required: false, description: 'e.g. items' })
  @Get(':projectId/:tableName')
  async list(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
    @Headers('prefer') prefer?: string,
    @Headers('range') range?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const preferCount = prefer?.includes('count=exact') ?? false;
    const result = await this.apiGeneratorService.readRecords(
      projectId, tableName, query, preferCount, range, req,
    );

    if (res) {
      if (result.total !== null) {
        res.setHeader('X-Total-Count', result.total);
      }
      const end = result.offset + result.data.length - 1;
      const totalStr = result.total !== null ? String(result.total) : '*';
      res.setHeader('Content-Range', `${result.offset}-${end}/${totalStr}`);
    }

    return result;
  }

  @ApiOperation({ summary: 'Get a single record by primary key' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Get(':projectId/:tableName/:id')
  async get(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
  ) {
    return this.apiGeneratorService.readRecord(projectId, tableName, id, query, req);
  }

  @ApiOperation({ summary: 'Create records (single or bulk) with optional upsert' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiHeader({ name: 'Prefer', required: false, description: 'resolution=merge-duplicates for upsert' })
  @Post(':projectId/:tableName')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Body() data: Record<string, any> | Array<Record<string, any>>,
    @Req() req: any,
    @Headers('prefer') prefer?: string,
    @Query('on_conflict') onConflict?: string,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    const preferResolution = prefer?.includes('resolution=merge-duplicates') ? 'merge-duplicates' : undefined;
    return this.apiGeneratorService.createRecords(
      projectId, tableName, data, userId, preferResolution, onConflict, req,
    );
  }

  @ApiOperation({ summary: 'Update records matching filters (no id path param = filter-based bulk update)' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @Patch(':projectId/:tableName')
  async updateMany(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Body() data: Record<string, any>,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
    @Headers('prefer') prefer?: string,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.updateRecords(
      projectId, tableName, undefined, data, query, userId, undefined, req,
    );
  }

  @ApiOperation({ summary: 'Update a single record by primary key' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Patch(':projectId/:tableName/:id')
  async update(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.updateRecords(
      projectId, tableName, id, data, undefined, userId, undefined, req,
    );
  }

  @ApiOperation({ summary: 'Delete records matching filters (no id path param = filter-based bulk delete)' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @Delete(':projectId/:tableName')
  async deleteMany(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
  ) {
    return this.apiGeneratorService.deleteRecords(projectId, tableName, undefined, query, req);
  }

  @ApiOperation({ summary: 'Delete a record by primary key' })
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
    return this.apiGeneratorService.deleteRecords(projectId, tableName, id, undefined, req);
  }
}
