import { Controller, Post, Get, Param, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { AiService, SqlResult } from './ai.service';
import { NlToSqlDto, SqlExplainDto, AiGenerateSchemaDto } from './dto/nl-to-sql.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('AI')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post(':projectId/nl-to-sql')
  @ApiOperation({ summary: 'Convert natural language to SQL using AI' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: NlToSqlDto })
  async nlToSql(
    @Param('projectId') projectId: string,
    @Body() dto: NlToSqlDto,
  ): Promise<SqlResult> {
    return this.aiService.nlToSql(projectId, dto.prompt);
  }

  @Post(':projectId/explain-sql')
  @ApiOperation({ summary: 'Explain SQL query in natural language' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: SqlExplainDto })
  async explainSql(
    @Param('projectId') projectId: string,
    @Body() dto: SqlExplainDto,
  ) {
    return { explanation: `EXPLAIN: ${dto.sql}` };
  }

  @Post(':projectId/generate-schema')
  @ApiOperation({ summary: 'Generate database schema from description' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: AiGenerateSchemaDto })
  async generateSchema(
    @Param('projectId') projectId: string,
    @Body() dto: AiGenerateSchemaDto,
  ): Promise<SqlResult> {
    return this.aiService.nlToSql(projectId, `Create a database table for: ${dto.description}. Generate a complete CREATE TABLE statement with appropriate columns, types, constraints, and indexes.`);
  }
}
