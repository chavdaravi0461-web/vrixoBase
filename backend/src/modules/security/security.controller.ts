import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { SecurityService } from './security.service';
import { CreatePolicyDto } from './dto/create-policy.dto';
import { CreateSecretDto } from './dto/create-secret.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Security')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('security')
export class SecurityController {
  constructor(private readonly securityService: SecurityService) {}

  @Get(':projectId/policies')
  @ApiOperation({ summary: 'List RLS policies' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiQuery({ name: 'tableName', required: false })
  listPolicies(
    @Param('projectId') projectId: string,
    @Query('tableName') tableName?: string,
  ) {
    return this.securityService.listPolicies(projectId, tableName);
  }

  @Post(':projectId/policies')
  @ApiOperation({ summary: 'Create an RLS policy' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreatePolicyDto })
  createPolicy(
    @Param('projectId') projectId: string,
    @Body() dto: CreatePolicyDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id || 'system';
    return this.securityService.createPolicy(projectId, userId, dto);
  }

  @Delete('policies/:id')
  @ApiOperation({ summary: 'Delete an RLS policy' })
  @ApiParam({ name: 'id', type: String })
  deletePolicy(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.securityService.deletePolicy(id, userId);
  }

  @Get(':projectId/secrets')
  @ApiOperation({ summary: 'List secrets' })
  @ApiParam({ name: 'projectId', type: String })
  listSecrets(@Param('projectId') projectId: string) {
    return this.securityService.listSecrets(projectId);
  }

  @Post(':projectId/secrets')
  @ApiOperation({ summary: 'Create a secret' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateSecretDto })
  createSecret(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSecretDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id || 'system';
    return this.securityService.createSecret(projectId, userId, dto);
  }
}
