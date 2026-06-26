import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiParam, ApiBody, ApiResponse } from '@nestjs/swagger';
import { ProjectService } from './project.service';
import { CreateProjectDto } from './dto/create-project.dto';
import { UpdateProjectDto } from './dto/update-project.dto';

@ApiTags('Projects')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@Controller('projects')
export class ProjectController {
  constructor(private readonly projectService: ProjectService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new project' })
  @ApiBody({ type: CreateProjectDto })
  create(
    @Body() dto: CreateProjectDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.projectService.create(dto, userId);
  }

  @Get()
  @ApiOperation({ summary: 'List user projects' })
  list(@Req() req: Record<string, unknown>) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.projectService.list(userId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project details' })
  @ApiParam({ name: 'id', type: String })
  get(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.projectService.get(id, userId);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update project' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateProjectDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateProjectDto,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.projectService.update(id, dto, userId);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project' })
  @ApiParam({ name: 'id', type: String })
  delete(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.projectService.delete(id, userId);
  }

  @Get(':id/stats')
  @ApiOperation({ summary: 'Get project statistics' })
  @ApiParam({ name: 'id', type: String })
  getStats(
    @Param('id') id: string,
    @Req() req: Record<string, unknown>,
  ) {
    const userId = (req.user as Record<string, string>)?.id;
    return this.projectService.getStats(id, userId);
  }
}
