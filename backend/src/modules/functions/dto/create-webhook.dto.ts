import { IsString, IsArray, IsOptional, IsObject, IsBoolean, IsUrl } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateWebhookDto {
  @ApiProperty({ example: 'Order-Webhook', description: 'Webhook name' })
  @IsString()
  name: string;

  @ApiProperty({ example: 'https://api.example.com/hooks/orders', description: 'Webhook callback URL' })
  @IsUrl({ require_tld: false })
  url: string;

  @ApiProperty({ example: ['order.created', 'order.updated'], type: [String], description: 'Event types to trigger on' })
  @IsArray()
  @IsString({ each: true })
  events: string[];

  @ApiPropertyOptional({ example: 'whsec_abc123', description: 'Secret for webhook verification' })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({ example: { 'X-Custom-Header': 'value' }, type: Object, description: 'Custom headers' })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({ example: true, default: true, description: 'Whether the webhook is active' })
  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', description: 'Associated function ID' })
  @IsOptional()
  @IsString()
  functionId?: string;
}
