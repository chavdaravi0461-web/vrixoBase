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
import { ProxyQueryDto } from './dto/proxy-query.dto';
import { ApiKeyGuard } from './guards/api-key.guard';
import { Public } from '../auth/decorators/public.decorator';
import { SkipCsrf } from '../../common/decorators/skip-csrf.decorator';

@ApiTags('REST API v1 (Supabase-compatible)')
@Controller('rest/v1')
@Public()
@SkipCsrf()
@UseGuards(ApiKeyGuard)
@ApiBearerAuth('ApiKey-auth')
export class RestV1Controller {
  constructor(private readonly apiGeneratorService: ApiGeneratorService) {}

  @ApiOperation({ summary: 'List records from a table (project detected from API key)' })
  @ApiParam({ name: 'tableName', type: String })
  @ApiHeader({ name: 'Prefer', required: false })
  @ApiHeader({ name: 'Range', required: false })
  @ApiHeader({ name: 'Range-Unit', required: false })
  @Get(':tableName')
  async list(
    @Param('tableName') tableName: string,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
    @Headers('prefer') prefer?: string,
    @Headers('range') range?: string,
    @Res({ passthrough: true }) res?: Response,
  ) {
    const projectId = req.projectId;
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
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Get(':tableName/:id')
  async get(
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
  ) {
    return this.apiGeneratorService.readRecord(req.projectId, tableName, id, query, req);
  }

  @ApiOperation({ summary: 'Create records (single or bulk) with optional upsert' })
  @ApiParam({ name: 'tableName', type: String })
  @ApiHeader({ name: 'Prefer', required: false })
  @Post(':tableName')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('tableName') tableName: string,
    @Body() data: Record<string, any> | Array<Record<string, any>>,
    @Req() req: any,
    @Headers('prefer') prefer?: string,
    @Query('on_conflict') onConflict?: string,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    const preferResolution = prefer?.includes('resolution=merge-duplicates') ? 'merge-duplicates' : undefined;
    return this.apiGeneratorService.createRecords(
      req.projectId, tableName, data, userId, preferResolution, onConflict, req,
    );
  }

  @ApiOperation({ summary: 'Update records matching filters' })
  @ApiParam({ name: 'tableName', type: String })
  @Patch(':tableName')
  async updateMany(
    @Param('tableName') tableName: string,
    @Body() data: Record<string, any>,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.updateRecords(
      req.projectId, tableName, undefined, data, query, userId, undefined, req,
    );
  }

  @ApiOperation({ summary: 'Update a single record by primary key' })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Patch(':tableName/:id')
  async update(
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Body() data: Record<string, any>,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById;
    return this.apiGeneratorService.updateRecords(
      req.projectId, tableName, id, data, undefined, userId, undefined, req,
    );
  }

  @ApiOperation({ summary: 'Delete records matching filters' })
  @ApiParam({ name: 'tableName', type: String })
  @Delete(':tableName')
  async deleteMany(
    @Param('tableName') tableName: string,
    @Query() query: ProxyQueryDto,
    @Req() req: any,
  ) {
    return this.apiGeneratorService.deleteRecords(req.projectId, tableName, undefined, query, req);
  }

  @ApiOperation({ summary: 'Delete a record by primary key' })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'id', type: String })
  @Delete(':tableName/:id')
  async delete(
    @Param('tableName') tableName: string,
    @Param('id') id: string,
    @Req() req: any,
  ) {
    return this.apiGeneratorService.deleteRecords(req.projectId, tableName, id, undefined, req);
  }
}
