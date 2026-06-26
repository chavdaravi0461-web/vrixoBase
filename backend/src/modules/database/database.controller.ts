import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { DatabaseService } from './database.service';
import { CreateTableDto } from './dto/create-table.dto';
import { UpdateTableDto } from './dto/update-table.dto';
import { AddColumnDto } from './dto/add-column.dto';
import { UpdateColumnDto } from './dto/update-column.dto';
import { ExecuteQueryDto } from './dto/execute-query.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Database')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('database')
export class DatabaseController {
  constructor(private readonly databaseService: DatabaseService) {}

  @Get(':projectId/tables')
  @ApiOperation({ summary: 'List all tables for a project' })
  @ApiParam({ name: 'projectId', type: String })
  listTables(@Param('projectId') projectId: string) {
    return this.databaseService.listTables(projectId);
  }

  @Get(':projectId/tables/:tableName')
  @ApiOperation({ summary: 'Get table schema details' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  getTable(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
  ) {
    return this.databaseService.getTable(projectId, tableName);
  }

  @Post(':projectId/tables')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new table' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateTableDto })
  createTable(
    @Param('projectId') projectId: string,
    @Body() dto: CreateTableDto,
  ) {
    return this.databaseService.createTable(projectId, dto);
  }

  @Delete(':projectId/tables/:tableName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a table' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  deleteTable(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
  ) {
    return this.databaseService.deleteTable(projectId, tableName);
  }

  @Patch(':projectId/tables/:tableName')
  @ApiOperation({ summary: 'Update table (rename / add columns)' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiBody({ type: UpdateTableDto })
  updateTable(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Body() dto: UpdateTableDto,
  ) {
    return this.databaseService.updateTable(projectId, tableName, dto);
  }

  @Post(':projectId/tables/:tableName/columns')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a column to a table' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiBody({ type: AddColumnDto })
  addColumn(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Body() dto: AddColumnDto,
  ) {
    return this.databaseService.addColumn(projectId, tableName, dto);
  }

  @Patch(':projectId/tables/:tableName/columns/:columnName')
  @ApiOperation({ summary: 'Update a column definition' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'columnName', type: String })
  @ApiBody({ type: UpdateColumnDto })
  updateColumn(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
    @Body() dto: UpdateColumnDto,
  ) {
    return this.databaseService.updateColumn(projectId, tableName, columnName, dto);
  }

  @Delete(':projectId/tables/:tableName/columns/:columnName')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Delete a column from a table' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  @ApiParam({ name: 'columnName', type: String })
  deleteColumn(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
    @Param('columnName') columnName: string,
  ) {
    return this.databaseService.deleteColumn(projectId, tableName, columnName);
  }

  @Post(':projectId/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Execute raw SQL query' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: ExecuteQueryDto })
  executeQuery(
    @Param('projectId') projectId: string,
    @Body() dto: ExecuteQueryDto,
    @CurrentUser('id') userId?: string,
  ) {
    return this.databaseService.executeQuery(projectId, userId || 'system', dto.query);
  }

  @Get(':projectId/query-history')
  @ApiOperation({ summary: 'Get recent query history' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum records to return' })
  getQueryHistory(
    @Param('projectId') projectId: string,
    @CurrentUser('id') userId?: string,
    @Query('limit') limit?: string,
  ) {
    const l = limit ? Math.min(Math.max(parseInt(limit, 10) || 50, 1), 500) : 50;
    return this.databaseService.getQueryHistory(projectId, userId, l);
  }

  @Get(':projectId/performance')
  @ApiOperation({ summary: 'Analyze query performance' })
  @ApiParam({ name: 'projectId', type: String })
  getQueryPerformance(@Param('projectId') projectId: string) {
    return this.databaseService.getQueryPerformance(projectId);
  }

  @Get(':projectId/tables/:tableName/relations')
  @ApiOperation({ summary: 'Get foreign key relationships for a table' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'tableName', type: String })
  getTableRelations(
    @Param('projectId') projectId: string,
    @Param('tableName') tableName: string,
  ) {
    return this.databaseService.getTableRelations(projectId, tableName);
  }

  @Get(':projectId/schema')
  @ApiOperation({ summary: 'Get full schema visualization with all relationships' })
  @ApiParam({ name: 'projectId', type: String })
  getSchemaVisualization(@Param('projectId') projectId: string) {
    return this.databaseService.getSchemaVisualization(projectId);
  }
}
