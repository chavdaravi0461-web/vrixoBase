import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Body,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('API Keys')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('api-keys')
export class ApiKeysController {
  constructor(private readonly apiKeysService: ApiKeysService) {}

  @ApiOperation({ summary: 'Create an API key for a project' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateApiKeyDto })
  @Post(':projectId')
  async create(
    @Param('projectId') projectId: string,
    @Body() dto: CreateApiKeyDto,
    @Req() req: any,
  ) {
    const userId = req.user?.id || req.apiKeyInfo?.createdById || 'system';
    return this.apiKeysService.createApiKey(projectId, dto, userId);
  }

  @ApiOperation({ summary: 'List all API keys for a project' })
  @ApiParam({ name: 'projectId', type: String })
  @Get(':projectId')
  async list(@Param('projectId') projectId: string) {
    return this.apiKeysService.listApiKeys(projectId);
  }

  @ApiOperation({ summary: 'Revoke an API key' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiParam({ name: 'id', type: String })
  @Delete(':projectId/:id')
  async revoke(@Param('id') id: string) {
    return this.apiKeysService.revokeApiKey(id);
  }
}
