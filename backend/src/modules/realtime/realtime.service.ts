import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../common/prisma/prisma.service';
import { requireProjectMembership } from '../../common/authorization/helpers';
import Redis from 'ioredis';
import { Subject, Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';
import {
  RealtimeEvent,
  RealtimeEventType,
  PresenceStatus,
  PresenceEvent,
  ActiveConnection,
  Subscription,
} from './entities/realtime-event.entity';

interface BroadcastMessage {
  channel: string;
  event: string;
  data: RealtimeEvent | PresenceEvent;
}

interface ClientInfo {
  socketId: string;
  userId: string;
  projectId: string;
  connectedAt: Date;
  channels: Set<string>;
}

@Injectable()
export class RealtimeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeService.name);

  private redisPub: Redis | null = null;
  private redisSub: Redis | null = null;
  private readonly broadcastSubject = new Subject<BroadcastMessage>();
  public readonly broadcast$: Observable<BroadcastMessage> =
    this.broadcastSubject.asObservable();

  private readonly subscriptions = new Map<string, Subscription>();
  private readonly connections = new Map<string, ClientInfo>();
  private readonly projectConnections = new Map<string, Set<string>>();
  private readonly presence = new Map<string, Map<string, PresenceStatus>>();

  private readonly redisEnabled: boolean;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    this.redisEnabled =
      this.configService.get<string>('REDIS_ENABLED', 'true') === 'true';
  }

  async onModuleInit(): Promise<void> {
    if (this.redisEnabled) {
      await this.initRedis();
    }
    this.logger.log(
      `RealtimeService initialized (Redis: ${this.redisEnabled ? 'enabled' : 'disabled'})`,
    );
  }

  async onModuleDestroy(): Promise<void> {
    await this.closeRedis();
  }

  private async initRedis(): Promise<void> {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = this.configService.get<number>('REDIS_PORT', 6379);
    const password = this.configService.get<string>('REDIS_PASSWORD', '');

    const commonOpts = {
      host,
      port,
      ...(password ? { password } : {}),
      retryStrategy: (times: number) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    };

    try {
      this.redisPub = new Redis({ ...commonOpts });
      this.redisSub = new Redis({ ...commonOpts });

      this.redisPub.on('error', () => {});
      this.redisSub.on('error', () => {});

      await Promise.all([this.redisPub.connect(), this.redisSub.connect()]);

      this.redisSub.on('message', (channel: string, message: string) => {
        try {
          const payload = JSON.parse(message) as RealtimeEvent | PresenceEvent;
          this.broadcastSubject.next({ channel, event: channel, data: payload });
        } catch (err) {
          this.logger.error(`Failed to parse Redis message on ${channel}: ${(err as Error).message}`);
        }
      });

      await this.redisSub.psubscribe('realtime:*');
      this.logger.log('Connected to Redis and subscribed to realtime:*');
    } catch (err) {
      this.logger.warn(
        `Redis connection failed, operating without cross-instance pub/sub: ${(err as Error).message}`,
      );
      this.redisPub = null;
      this.redisSub = null;
    }
  }

  private async closeRedis(): Promise<void> {
    if (this.redisSub) {
      await this.redisSub.quit().catch(() => {});
    }
    if (this.redisPub) {
      await this.redisPub.quit().catch(() => {});
    }
  }

  registerConnection(socketId: string, userId: string, projectId: string): void {
    const existing = this.connections.get(socketId);
    if (existing) {
      existing.userId = userId;
      existing.projectId = projectId;
      return;
    }

    this.connections.set(socketId, {
      socketId,
      userId,
      projectId,
      connectedAt: new Date(),
      channels: new Set(),
    });

    if (!this.projectConnections.has(projectId)) {
      this.projectConnections.set(projectId, new Set());
    }
    this.projectConnections.get(projectId)!.add(socketId);
  }

  removeConnection(socketId: string): void {
    const info = this.connections.get(socketId);
    if (!info) return;

    const { projectId, userId } = info;
    this.connections.delete(socketId);

    const projectSockets = this.projectConnections.get(projectId);
    if (projectSockets) {
      projectSockets.delete(socketId);
      if (projectSockets.size === 0) {
        this.projectConnections.delete(projectId);
      }
    }

    this.trackPresence(userId, projectId, PresenceStatus.OFFLINE);
  }

  addChannel(socketId: string, channel: string): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.channels.add(channel);
    }
  }

  removeChannel(socketId: string, channel: string): void {
    const info = this.connections.get(socketId);
    if (info) {
      info.channels.delete(channel);
    }
  }

  getClientChannels(socketId: string): string[] {
    const info = this.connections.get(socketId);
    return info ? Array.from(info.channels) : [];
  }

  async broadcast(
    channel: string,
    event: string,
    data: RealtimeEvent | PresenceEvent,
  ): Promise<void> {
    if (this.redisPub) {
      const message = JSON.stringify(data);
      await this.redisPub.publish(`realtime:${channel}`, message).catch((err) => {
        this.logger.error(`Redis publish failed: ${(err as Error).message}`);
        this.broadcastSubject.next({ channel, event, data });
      });
    } else {
      this.broadcastSubject.next({ channel, event, data });
    }
  }

  async subscribeToTable(
    projectId: string,
    tableName: string,
    userId: string,
  ): Promise<Subscription> {
    const subscription: Subscription = {
      id: uuidv4(),
      tableId: tableName,
      projectId,
      userId,
      eventType: RealtimeEventType.ALL,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscription.id, subscription);
    this.logger.log(`Subscription ${subscription.id} created for ${projectId}:${tableName}`);
    return subscription;
  }

  async unsubscribeFromTable(subscriptionId: string, userId?: string): Promise<boolean> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) return false;
    await requireProjectMembership(this.prisma, sub.projectId, userId);
    this.subscriptions.delete(subscriptionId);
    this.logger.log(`Subscription ${subscriptionId} removed`);
    return true;
  }

  async notifyTableChange(
    projectId: string,
    tableName: string,
    event: string,
    data: Record<string, unknown>,
    oldData?: Record<string, unknown>,
  ): Promise<void> {
    const payload: RealtimeEvent = {
      projectId,
      tableName,
      eventType: event as RealtimeEventType,
      data,
      oldData,
      timestamp: new Date().toISOString(),
    };

    const channel = `table:${projectId}:${tableName}`;
    await this.broadcast(channel, event, payload);
  }

  getSubscriptions(projectId: string): Subscription[] {
    return Array.from(this.subscriptions.values()).filter(
      (s) => s.projectId === projectId,
    );
  }

  getSubscription(id: string): Subscription | undefined {
    return this.subscriptions.get(id);
  }

  getActiveConnections(projectId: string): ActiveConnection[] {
    const socketIds = this.projectConnections.get(projectId);
    if (!socketIds) return [];

    return Array.from(socketIds)
      .map((socketId) => {
        const info = this.connections.get(socketId);
        if (!info) return null;
        return {
          socketId: info.socketId,
          userId: info.userId,
          projectId: info.projectId,
          connectedAt: info.connectedAt.toISOString(),
          channels: Array.from(info.channels),
        };
      })
      .filter((c): c is ActiveConnection => c !== null);
  }

  async trackPresence(
    userId: string,
    projectId: string,
    status: PresenceStatus,
  ): Promise<void> {
    if (!this.presence.has(projectId)) {
      this.presence.set(projectId, new Map());
    }
    this.presence.get(projectId)!.set(userId, status);

    const event: PresenceEvent = {
      userId,
      projectId,
      status,
      timestamp: new Date().toISOString(),
    };

    if (this.redisPub) {
      const key = `presence:${projectId}`;
      if (status === PresenceStatus.OFFLINE) {
        await this.redisPub.hdel(key, userId).catch(() => {});
      } else {
        await this.redisPub
          .hset(key, userId, JSON.stringify(event))
          .catch(() => {});
      }
    }

    await this.broadcast(`presence:${projectId}`, 'presence:update', event);
  }

  async getPresence(projectId: string): Promise<PresenceEvent[]> {
    if (this.redisPub) {
      try {
        const raw = await this.redisPub.hgetall(`presence:${projectId}`);
        return Object.values(raw).map((v) => JSON.parse(v) as PresenceEvent);
      } catch {
        return this.getLocalPresence(projectId);
      }
    }
    return this.getLocalPresence(projectId);
  }

  private getLocalPresence(projectId: string): PresenceEvent[] {
    const projectPresence = this.presence.get(projectId);
    if (!projectPresence) return [];

    return Array.from(projectPresence.entries()).map(([userId, status]) => ({
      userId,
      projectId,
      status,
      timestamp: new Date().toISOString(),
    }));
  }
}
