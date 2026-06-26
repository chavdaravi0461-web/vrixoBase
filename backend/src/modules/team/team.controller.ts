import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { TeamService } from './team.service';
import { AddMemberDto } from './dto/add-member.dto';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Team')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Get(':projectId/members')
  @ApiOperation({ summary: 'List project members' })
  @ApiParam({ name: 'projectId', type: String })
  getMembers(@Param('projectId') projectId: string) {
    return this.teamService.getMembers(projectId);
  }

  @Post(':projectId/members')
  @ApiOperation({ summary: 'Add a member or send invitation' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: AddMemberDto })
  addMember(
    @Param('projectId') projectId: string,
    @Body() dto: AddMemberDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.teamService.addMember(projectId, userId, dto);
  }

  @Patch('members/:id')
  @ApiOperation({ summary: 'Update member role' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ schema: { type: 'object', properties: { role: { type: 'string', example: 'admin' } } } })
  updateMemberRole(
    @Param('id') id: string,
    @Body() body: { role: string },
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.teamService.updateMemberRole(id, body.role, userId);
  }

  @Delete('members/:id')
  @ApiOperation({ summary: 'Remove a member' })
  @ApiParam({ name: 'id', type: String })
  removeMember(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.teamService.removeMember(id, userId);
  }
}
