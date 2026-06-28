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
import { Injectable, Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WalChangePayload, WalChangeType } from './interfaces/wal-payload.interface';

interface AuthenticatedSocket extends Socket {
  userId?: string;
  projectId?: string;
  subscribedTables: Set<string>;
}

interface PostgresChangesPayload {
  eventType: WalChangeType;
  schema: string;
  table: string;
  commitTimestamp: string;
  newData: Record<string, unknown> | null;
  oldData: Record<string, unknown> | null;
  columns: string[];
}

@WebSocketGateway({
  namespace: '/realtime/v1',
  cors: {
    origin: true,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
  pingInterval: 25000,
  pingTimeout: 20000,
})
@Injectable()
export class RealtimeV1Gateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit
{
  private readonly logger = new Logger(RealtimeV1Gateway.name);

  @WebSocketServer()
  server: Server;

  private readonly apiKeyCache = new Map<string, { projectId: string; type: string; expiresAt: Date | null }>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  afterInit(): void {
    this.logger.log(`RealtimeV1Gateway initialized on namespace /realtime/v1`);
  }

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    try {
      const authToken =
        client.handshake.auth?.token ||
        client.handshake.auth?.apikey ||
        client.handshake.query?.apikey as string ||
        client.handshake.headers?.authorization?.replace('Bearer ', '');

      if (!authToken) {
        this.logger.warn(`Client ${client.id} rejected: no auth token`);
        client.emit('error', { code: 'AUTH_REQUIRED', message: 'Authentication required. Provide token or apikey.' });
        client.disconnect();
        return;
      }

      let projectId: string | null = null;
      let userId: string | null = null;

      if (authToken.startsWith('vb_')) {
        const result = await this.validateApiKey(authToken);
        if (!result) {
          client.emit('error', { code: 'INVALID_API_KEY', message: 'Invalid or expired API key' });
          client.disconnect();
          return;
        }
        projectId = result.projectId;
      } else {
        try {
          const secret = this.configService.get<string>('JWT_ACCESS_SECRET', '');
          const payload = await this.jwtService.verifyAsync(authToken, { secret });
          userId = payload.sub || payload.id || null;
          projectId =
            client.handshake.auth?.projectId ||
            client.handshake.query?.projectId as string ||
            null;
        } catch {
          client.emit('error', { code: 'INVALID_TOKEN', message: 'Invalid or expired JWT token' });
          client.disconnect();
          return;
        }
      }

      if (!projectId) {
        this.logger.warn(`Client ${client.id} rejected: no projectId`);
        client.emit('error', { code: 'PROJECT_REQUIRED', message: 'projectId is required in auth or query' });
        client.disconnect();
        return;
      }

      client.userId = userId || undefined;
      client.projectId = projectId;
      client.subscribedTables = new Set();

      client.join(`user:${userId || 'anonymous'}`);
      client.join(`project:${projectId}`);

      client.emit('connected', {
        socketId: client.id,
        userId: client.userId,
        projectId,
        timestamp: new Date().toISOString(),
      });

      this.logger.log(
        `Client ${client.id} connected (user=${userId || 'apikey'}, project=${projectId})`,
      );
    } catch (err) {
      this.logger.error(
        `Client ${client.id} connection error: ${(err as Error).message}`,
      );
      client.emit('error', { code: 'CONNECTION_ERROR', message: 'Connection failed' });
      client.disconnect();
    }
  }

  handleDisconnect(client: AuthenticatedSocket): void {
    const tables = Array.from(client.subscribedTables);
    this.logger.log(
      `Client ${client.id} disconnected (project=${client.projectId}, tables=[${tables.join(',')}])`,
    );
  }

  @SubscribeMessage('join_channel')
  async handleJoinChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { table?: string; event?: string },
  ): Promise<void> {
    try {
      const projectId = client.projectId;
      if (!projectId) {
        client.emit('error', { code: 'NOT_AUTHENTICATED', message: 'Not authenticated with a project' });
        return;
      }

      const tableName = payload?.table?.trim();
      if (!tableName || tableName.length === 0) {
        client.emit('error', { code: 'TABLE_REQUIRED', message: 'table is required (use "*" for all tables)' });
        return;
      }

      const room = `project_${projectId}:${tableName}`;
      client.join(room);
      client.subscribedTables.add(tableName);

      this.logger.log(
        `Client ${client.id} joined channel: ${room}`,
      );

      client.emit('channel_joined', {
        channel: room,
        projectId,
        table: tableName,
        schema: `proj_${projectId}`,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `join_channel error for ${client.id}: ${(err as Error).message}`,
      );
      client.emit('error', { code: 'JOIN_FAILED', message: 'Failed to join channel' });
    }
  }

  @SubscribeMessage('leave_channel')
  async handleLeaveChannel(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { table?: string },
  ): Promise<void> {
    try {
      const projectId = client.projectId;
      if (!projectId) return;

      const tableName = payload?.table?.trim();
      if (!tableName) return;

      const room = `project_${projectId}:${tableName}`;
      client.leave(room);
      client.subscribedTables.delete(tableName);

      this.logger.log(`Client ${client.id} left channel: ${room}`);

      client.emit('channel_left', {
        channel: room,
        table: tableName,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      this.logger.error(
        `leave_channel error for ${client.id}: ${(err as Error).message}`,
      );
    }
  }

  @SubscribeMessage('subscribe_heartbeat')
  handleHeartbeat(@ConnectedSocket() client: AuthenticatedSocket): void {
    client.emit('heartbeat', {
      timestamp: new Date().toISOString(),
    });
  }

  broadcastToProject(
    projectId: string,
    tableName: string,
    change: WalChangePayload,
  ): void {
    try {
      const eventPayload: PostgresChangesPayload = {
        eventType: change.eventType,
        schema: change.schema,
        table: change.tableName,
        commitTimestamp: change.commitTimestamp.toISOString(),
        newData: change.newData,
        oldData: change.oldData,
        columns: change.columns,
      };

      const specificRoom = `project_${projectId}:${tableName}`;
      this.server.to(specificRoom).emit('postgres_changes', eventPayload);

      const wildcardRoom = `project_${projectId}:*`;
      this.server.to(wildcardRoom).emit('postgres_changes', eventPayload);

      this.logger.debug(
        `Broadcast ${change.eventType} on ${tableName} to ${specificRoom}`,
      );
    } catch (err) {
      this.logger.error(
        `Broadcast error for project=${projectId} table=${tableName}: ${(err as Error).message}`,
      );
    }
  }

  private async validateApiKey(
    key: string,
  ): Promise<{ projectId: string } | null> {
    if (!key.startsWith('vb_')) return null;

    const cached = this.apiKeyCache.get(key);
    if (cached) {
      if (cached.expiresAt && cached.expiresAt < new Date()) {
        this.apiKeyCache.delete(key);
      } else {
        return { projectId: cached.projectId };
      }
    }

    try {
      const hash = crypto.createHash('sha256').update(key).digest('hex');

      const apiKey = await this.prisma.apiKey.findFirst({
        where: {
          OR: [
            { keyHash: hash },
            { key },
          ],
        },
        select: {
          projectId: true,
          type: true,
          expiresAt: true,
        },
      });

      if (!apiKey) return null;
      if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;

      if (apiKey.type !== 'SECRET' && apiKey.type !== 'PUBLIC') {
        return null;
      }

      this.apiKeyCache.set(key, {
        projectId: apiKey.projectId,
        type: apiKey.type,
        expiresAt: apiKey.expiresAt,
      });

      return { projectId: apiKey.projectId };
    } catch (err) {
      this.logger.error(`API key validation error: ${(err as Error).message}`);
      return null;
    }
  }
}
