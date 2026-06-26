import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RealtimeService } from './realtime.service';
import { PresenceStatus } from './entities/realtime-event.entity';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  projectId?: string;
}

@WebSocketGateway({
  namespace: '/realtime',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
})
@Injectable()
export class RealtimeGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer()
  server: Server;

  constructor(
    @Inject(forwardRef(() => RealtimeService))
    private readonly realtimeService: RealtimeService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  afterInit(): void {
    this.realtimeService.broadcast$.subscribe(({ channel, data }) => {
      try {
        const parts = channel.split(':');
        if (parts.length < 2) return;

        const channelType = parts[0];
        const projectId = parts[1];

        if (channelType === 'table' && parts.length >= 3) {
          const tableName = parts[2];
          const room = `project:${projectId}:table:${tableName}`;
          this.server.to(room).emit('table:change', data);
          this.server
            .to(`project:${projectId}`)
            .emit('table:change', data);
        } else if (channelType === 'presence') {
          this.server
            .to(`presence:${projectId}`)
            .emit('presence:update', data);
        }
      } catch (err) {
        this.logger.error(
          `Broadcast error on channel ${channel}: ${(err as Error).message}`,
        );
      }
    });

    this.logger.log('RealtimeGateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const token =
        client.handshake.auth?.token ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!token) {
        this.logger.warn(`Client ${client.id} connection rejected: no token`);
        client.emit('error', { message: 'Authentication required' });
        client.disconnect();
        return;
      }

      const secret = this.configService.get<string>('JWT_ACCESS_SECRET', 'default-secret');
      const payload = await this.jwtService.verifyAsync(token, { secret });

      const userId = payload.sub || payload.id;
      const projectId =
        client.handshake.auth?.projectId ||
        client.handshake.query?.projectId as string;

      if (!userId || !projectId) {
        this.logger.warn(
          `Client ${client.id} connection rejected: missing userId or projectId`,
        );
        client.emit('error', { message: 'Missing userId or projectId' });
        client.disconnect();
        return;
      }

      client.userId = userId;
      client.projectId = projectId;

      client.join(`project:${projectId}`);
      client.join(`presence:${projectId}`);

      this.realtimeService.registerConnection(client.id, userId, projectId);
      await this.realtimeService.trackPresence(
        userId,
        projectId,
        PresenceStatus.ONLINE,
      );

      client.emit('connected', {
        socketId: client.id,
        userId,
        projectId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Client ${client.id} connected (user=${userId}, project=${projectId})`,
      );
    } catch (err) {
      this.logger.error(
        `Client ${client.id} auth failed: ${(err as Error).message}`,
      );
      client.emit('error', { message: 'Authentication failed' });
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const userId = client.userId;
    const projectId = client.projectId;

    if (userId && projectId) {
      await this.realtimeService.trackPresence(
        userId,
        projectId,
        PresenceStatus.OFFLINE,
      );
      this.realtimeService.removeConnection(client.id);
    }

    this.logger.log(
      `Client ${client.id} disconnected (user=${userId || 'unknown'})`,
    );
  }

  @SubscribeMessage('subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { channel: string; tableName?: string },
  ): Promise<void> {
    try {
      const { channel, tableName } = payload;
      const projectId = client.projectId;

      if (!projectId) {
        client.emit('error', { message: 'Not authenticated with a project' });
        return;
      }

      if (tableName) {
        const tableChannel = `project:${projectId}:table:${tableName}`;
        client.join(tableChannel);
        this.realtimeService.addChannel(client.id, tableChannel);
        client.emit('subscribed', { channel: tableChannel, tableName });
        this.logger.log(
          `Client ${client.id} subscribed to table ${tableName}`,
        );
      } else if (channel) {
        client.join(channel);
        this.realtimeService.addChannel(client.id, channel);
        client.emit('subscribed', { channel });
        this.logger.log(`Client ${client.id} subscribed to ${channel}`);
      } else {
        client.emit('error', { message: 'channel or tableName required' });
      }
    } catch (err) {
      this.logger.error(
        `Subscribe error for ${client.id}: ${(err as Error).message}`,
      );
      client.emit('error', { message: 'Subscription failed' });
    }
  }

  @SubscribeMessage('unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { channel: string },
  ): Promise<void> {
    try {
      const { channel } = payload;
      if (channel) {
        client.leave(channel);
        this.realtimeService.removeChannel(client.id, channel);
        client.emit('unsubscribed', { channel });
        this.logger.log(`Client ${client.id} unsubscribed from ${channel}`);
      }
    } catch (err) {
      this.logger.error(
        `Unsubscribe error for ${client.id}: ${(err as Error).message}`,
      );
      client.emit('error', { message: 'Unsubscribe failed' });
    }
  }

  @SubscribeMessage('presence:join')
  async handlePresenceJoin(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { projectId?: string },
  ): Promise<void> {
    const projectId = payload?.projectId || client.projectId;
    if (!projectId || !client.userId) return;

    const room = `presence:${projectId}`;
    client.join(room);

    await this.realtimeService.trackPresence(
      client.userId,
      projectId,
      PresenceStatus.ONLINE,
    );

    client.emit('presence:joined', { room, userId: client.userId });
  }

  @SubscribeMessage('presence:leave')
  async handlePresenceLeave(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { projectId?: string },
  ): Promise<void> {
    const projectId = payload?.projectId || client.projectId;
    if (!projectId || !client.userId) return;

    const room = `presence:${projectId}`;
    client.leave(room);

    await this.realtimeService.trackPresence(
      client.userId,
      projectId,
      PresenceStatus.AWAY,
    );

    client.emit('presence:left', { room, userId: client.userId });
  }

  @SubscribeMessage('presence:typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { projectId?: string; isTyping: boolean },
  ): Promise<void> {
    const projectId = payload?.projectId || client.projectId;
    if (!projectId || !client.userId) return;

    client
      .to(`presence:${projectId}`)
      .emit('presence:typing', {
        userId: client.userId,
        projectId,
        isTyping: payload.isTyping,
        timestamp: new Date().toISOString(),
      });
  }
}
