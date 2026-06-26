import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Query,
  Req,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiBody,
  ApiResponse,
} from '@nestjs/swagger';
import { RealtimeService } from './realtime.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { Subscription, ActiveConnection, PresenceEvent } from './entities/realtime-event.entity';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProjectGuard } from '../auth/guards/project.guard';

@ApiTags('Realtime')
@ApiBearerAuth('JWT-auth')
@ApiBearerAuth('ApiKey-auth')
@UseGuards(ProjectGuard)
@Controller('realtime')
export class RealtimeController {
  constructor(private readonly realtimeService: RealtimeService) {}

  @Get(':projectId/subscriptions')
  @ApiOperation({ summary: 'List all subscriptions for a project' })
  @ApiParam({ name: 'projectId', type: String })
  getSubscriptions(
    @Param('projectId') projectId: string,
  ): Subscription[] {
    return this.realtimeService.getSubscriptions(projectId);
  }

  @Post(':projectId/subscriptions')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new table subscription' })
  @ApiParam({ name: 'projectId', type: String })
  @ApiBody({ type: CreateSubscriptionDto })
  async createSubscription(
    @Param('projectId') projectId: string,
    @Body() dto: CreateSubscriptionDto,
    @CurrentUser('id') userId?: string,
  ): Promise<Subscription> {
    return this.realtimeService.subscribeToTable(
      projectId,
      dto.tableId,
      userId || 'system',
    );
  }

  @Delete('subscriptions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a subscription' })
  @ApiParam({ name: 'id', type: String })
  async removeSubscription(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req?: any,
  ): Promise<void> {
    const removed = await this.realtimeService.unsubscribeFromTable(id, req?.user?.id);
    if (!removed) {
      throw new NotFoundException(`Subscription ${id} not found`);
    }
  }

  @Get(':projectId/connections')
  @ApiOperation({ summary: 'List active WebSocket connections for a project' })
  @ApiParam({ name: 'projectId', type: String })
  getConnections(
    @Param('projectId') projectId: string,
  ): ActiveConnection[] {
    return this.realtimeService.getActiveConnections(projectId);
  }

  @Get(':projectId/presence')
  @ApiOperation({ summary: 'Get presence status for all users in a project' })
  @ApiParam({ name: 'projectId', type: String })
  async getPresence(
    @Param('projectId') projectId: string,
  ): Promise<PresenceEvent[]> {
    return this.realtimeService.getPresence(projectId);
  }
}
