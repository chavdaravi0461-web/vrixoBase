import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum RealtimeEventType {
  INSERT = 'INSERT',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  ALL = 'ALL',
}

export enum PresenceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  AWAY = 'AWAY',
  BUSY = 'BUSY',
}

export class RealtimeEvent {
  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Table name' })
  tableName: string;

  @ApiProperty({ enum: RealtimeEventType, description: 'Type of the database event' })
  eventType: RealtimeEventType;

  @ApiProperty({ description: 'New data payload' })
  data: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Previous data before the change' })
  oldData?: Record<string, unknown>;

  @ApiProperty({ description: 'ISO timestamp of the event' })
  timestamp: string;

  @ApiPropertyOptional({ description: 'User who triggered the change' })
  userId?: string;
}

export class PresenceEvent {
  @ApiProperty({ description: 'User ID' })
  userId: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ enum: PresenceStatus, description: 'Current presence status' })
  status: PresenceStatus;

  @ApiProperty({ description: 'ISO timestamp' })
  timestamp: string;
}

export class ActiveConnection {
  @ApiProperty({ description: 'Socket connection ID' })
  socketId: string;

  @ApiProperty({ description: 'Authenticated user ID' })
  userId: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'Connection timestamp' })
  connectedAt: string;

  @ApiProperty({ description: 'Subscribed channels' })
  channels: string[];
}

export class Subscription {
  @ApiProperty({ description: 'Subscription ID' })
  id: string;

  @ApiProperty({ description: 'Table ID' })
  tableId: string;

  @ApiProperty({ description: 'Project ID' })
  projectId: string;

  @ApiProperty({ description: 'User ID who owns the subscription' })
  userId: string;

  @ApiProperty({ enum: RealtimeEventType, description: 'Event type filter' })
  eventType: RealtimeEventType;

  @ApiPropertyOptional({ description: 'Webhook endpoint' })
  endpoint?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: string;
}
