import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { RealtimeEventType } from '../entities/realtime-event.entity';

export class CreateSubscriptionDto {
  @ApiProperty({ example: 'cm5abc123def456ghi789jkl', description: 'ID of the table to subscribe to' })
  @IsString()
  tableId: string;

  @ApiProperty({ enum: RealtimeEventType, default: RealtimeEventType.ALL, description: 'Event type to subscribe to' })
  @IsEnum(RealtimeEventType)
  eventType: RealtimeEventType = RealtimeEventType.ALL;

  @ApiPropertyOptional({ example: 'https://api.example.com/notify', description: 'Optional webhook endpoint for out-of-band notifications' })
  @IsOptional()
  @IsString()
  endpoint?: string;
}
